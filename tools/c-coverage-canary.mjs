// Validate continuous LLVM profiles after normal exit and forced termination.
// node tools/c-coverage-canary.mjs --run /share/NFS/.../fresh-directory
// CLANG, LLVM_PROFDATA and LLVM_COV must name one matching LLVM installation.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coverageFlags } from './c-branch-coverage.mjs';

function run(command, args, options = {}) {
    const r = spawnSync(command, args, { encoding: 'utf8', ...options });
    if (r.error) throw r.error;
    assert.equal(r.status, 0, `${command}: ${r.stderr}`);
    assert.equal(r.stderr.trim(), '', `${command} diagnostics require review`);
    return r.stdout;
}

async function exercise(binary, directory, signal) {
    const child = spawn(binary, signal ? ['wait'] : [], {
        env: { ...process.env, LLVM_PROFILE_FILE: join(directory, '%p%c.profraw') },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '', killed = false, timedOut = false;
    await new Promise((resolveDone, reject) => {
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
        }, 5000);
        child.stdout.on('data', data => {
            stdout += data;
            if (signal && !killed && stdout.includes('ready\n')) {
                killed = true;
                child.kill(signal);
            }
        });
        child.stderr.on('data', data => { stderr += data; });
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('close', (code, actualSignal) => {
            clearTimeout(timer);
            try {
                assert.equal(timedOut, false, 'canary timed out');
                assert.equal(stdout, 'ready\n');
                assert.equal(stderr, '', 'profile runtime diagnostics require review');
                assert.equal(code, signal ? null : 0);
                assert.equal(actualSignal, signal);
                resolveDone();
            } catch (error) { reject(error); }
        });
    });
}

assert.equal(process.argv[2], '--run', 'Requires explicit --run and a fresh NFS directory');
assert.equal(process.argv.length, 4);
assert.equal(process.platform, 'linux', 'Run only on the target Linux host');
const out = resolve(process.argv[3]);
const parent = realpathSync(dirname(out));
assert.match(run('stat', ['-f', '-c', '%T', parent]).trim(), /^nfs/,
    'The validation output must actually be on NFS');
mkdirSync(out); // Fails if the chosen run directory exists.
const clang = process.env.CLANG || 'clang';
const profdata = process.env.LLVM_PROFDATA || 'llvm-profdata';
const cov = process.env.LLVM_COV || 'llvm-cov';
const versions = Object.fromEntries([clang, profdata, cov].map(tool =>
    [tool, run(tool, ['--version'])]));
const source = fileURLToPath(new URL('./c-coverage-canary.c', import.meta.url));
const binary = join(out, 'canary');
const flags = coverageFlags('linux');
run(clang, ['-O0', ...flags, source, '-o', binary], {
    cwd: out, env: { ...process.env, TMPDIR: out },
});
const results = [];
for (const signal of [null, 'SIGTERM', 'SIGKILL']) {
    const directory = join(out, signal || 'normal-exit');
    mkdirSync(directory);
    await exercise(binary, directory, signal);
    const raw = readdirSync(directory).filter(name => name.endsWith('.profraw'));
    assert.equal(raw.length, 1);
    const profile = join(directory, 'canary.profdata');
    run(profdata, ['merge', '-sparse', '--failure-mode=any', join(directory, raw[0]), '-o', profile]);
    const exported = run(cov, ['export', '--skip-expansions', binary, `-instr-profile=${profile}`]);
    writeFileSync(join(directory, 'coverage.json'), exported);
    const fn = JSON.parse(exported).data.flatMap(data => data.functions)
        .find(fn => fn.name === 'decision');
    assert.ok(fn, 'decision must have a coverage mapping');
    assert.equal(fn.count, 2);
    assert.deepEqual(fn.branches.filter(b => b[6] === 0).map(b => b.slice(4, 6)), [[1, 1]]);
    results.push({ termination: signal || 'normal-exit', calls: fn.count, outcomes: [1, 1] });
}
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
writeFileSync(join(out, 'validation.json'), JSON.stringify({
    platform: process.platform, architecture: process.arch, versions, flags,
    sourceSha256: sha256(source), binarySha256: sha256(binary), results,
}, null, 2) + '\n');
console.log(`Validated normal exit, SIGTERM and SIGKILL profiles on NFS: ${out}`);
