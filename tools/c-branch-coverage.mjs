#!/usr/bin/env node
// Measure actual C decisions, including functions with no RNG calls.
// Usage: node tools/c-branch-coverage.mjs --build
//        node tools/c-branch-coverage.mjs [--out DIR] [session.json | corpus-dir ...]
// Defaults to public + supplemental. Only exact re-recordings earn coverage.
// Linux requires C_COVERAGE_CACHE on NFS, CLANG/LLVM_PROFDATA/LLVM_COV paths,
// and C_COVERAGE_CANARY pointing to a passing signal-canary validation.json.
// Continuous profiles preserve counters when the recorder is killed at the
// final input boundary. Lua and inactive build configurations are outside
// this census. Raw llvm-cov output retains macro expansions' branch counters;
// the concise report counts only conditions written directly in C functions.

import {
    cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync,
    writeFileSync, openSync, closeSync, statSync, realpathSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CACHE = resolve(process.env.C_COVERAGE_CACHE || join(ROOT, '.cache/c-coverage'));
const BUILD = join(CACHE, 'recorder');
const BINARY = join(BUILD, 'src/nethack');
const INSTALL = join(BUILD, 'install/games/lib/nethackdir');
const RECORDER = join(ROOT, 'scripts/record-session.mjs');
const CLANG = process.env.CLANG || 'clang';
const LLVM_PROFDATA = process.env.LLVM_PROFDATA || 'llvm-profdata';
const LLVM_COV = process.env.LLVM_COV || 'llvm-cov';
const PINNED_COMMIT = '16ff59115315917b93185d026aeefea06db9b0f4';

export function coverageFlags(platform) {
    const flags = ['-fprofile-instr-generate', '-fcoverage-mapping'];
    if (platform === 'linux') return [...flags, '-mllvm', '-runtime-counter-relocation'];
    if (platform === 'darwin') return flags;
    throw new Error(`Unsupported coverage platform: ${platform}`);
}

export function llvmCommand(platform, tool, args) {
    return platform === 'darwin' ? ['xcrun', tool, ...args] : [tool, ...args];
}

export function recordingDifference(expected, actual) {
    if (expected.jsGroundTruth || actual.jsGroundTruth)
        return 'JS ground truth is not a C oracle';
    if (expected.version !== actual.version) return 'session version';
    if (!expected.segments.length) return 'empty session';
    if (expected.segments.length !== actual.segments.length)
        return 'segment count';
    for (let s = 0; s < expected.segments.length; ++s) {
        for (const field of ['seed', 'datetime', 'nethackrc', 'moves'])
            if (!isDeepStrictEqual(expected.segments[s][field], actual.segments[s][field]))
                return `segment ${s}: ${field}`;
        const a = expected.segments[s].steps || [];
        const b = actual.segments[s].steps || [];
        if (!a.length || a.length !== b.length)
            return `segment ${s}: step count ${a.length}/${b.length}`;
        for (let i = 0; i < a.length; ++i)
            for (const field of ['key', 'rng', 'screen', 'cursor', 'animation_frames'])
                if (!isDeepStrictEqual(a[i][field], b[i][field]))
                    return `segment ${s}, step ${i}: ${field}`;
    }
    return null;
}

export function summarizeFunctions(coverage, build) {
    return coverage.data.flatMap(data => data.functions).flatMap(fn => {
        const file = relative(build, fn.filenames[0]);
        if (!/^(src|win\/tty)\/[^/]+\.c$/.test(file)) return [];
        // LLVM's branch tuple: start/end line+column, true/false counts,
        // file ID, expanded file ID, region kind. A macro's file ID is nonzero.
        const branches = fn.branches.filter(b => b[6] === 0);
        const missing = branches.flatMap(b => [
            ...(b[4] === 0 ? [{ line: b[0], column: b[1], outcome: true }] : []),
            ...(b[5] === 0 ? [{ line: b[0], column: b[1], outcome: false }] : []),
        ]);
        return [{
            file, name: fn.name.replace(/^.*:/, ''), line: fn.regions[0][0],
            calls: fn.count, outcomes: branches.length * 2,
            covered: branches.length * 2 - missing.length, missing,
        }];
    });
}

export function summarizeSources(functions, inventory) {
    const files = new Map(inventory.map(file => [file, {
        file, functions: 0, entered: 0, outcomes: 0, covered: 0,
    }]));
    for (const fn of functions) {
        const row = files.get(fn.file);
        if (!row) throw new Error(`Mapped source is absent from inventory: ${fn.file}`);
        ++row.functions;
        row.entered += Number(fn.calls > 0);
        row.outcomes += fn.outcomes;
        row.covered += fn.covered;
    }
    return [...files.values()].sort((a, b) => a.file.localeCompare(b.file))
        .map(row => ({ ...row, status: row.functions ? 'mapped' : 'no mapped functions' }));
}

function run(command, args, { strictStderr = false, stderrLog, ...options } = {}) {
    const r = spawnSync(command, args, {
        cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options,
    });
    if (stderrLog) writeFileSync(stderrLog, r.stderr || '');
    if (r.error) throw r.error;
    if (r.status !== 0)
        throw new Error(`${command} exited ${r.status}: ${(r.stderr || '').slice(-1500)}`);
    if (strictStderr && r.stderr?.trim())
        throw new Error(`${command} diagnostics: ${r.stderr.slice(-1500)}`);
    return r.stdout;
}

function llvm(tool, args, stderrLog) {
    const [command, ...argv] = llvmCommand(process.platform, tool, args);
    return run(command, argv, { strictStderr: true, stderrLog });
}

function sha256(file) {
    return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function requireNfs(path) {
    let ancestor = resolve(path);
    while (!existsSync(ancestor)) ancestor = dirname(ancestor);
    if (!/^nfs/.test(run('stat', ['-f', '-c', '%T', realpathSync(ancestor)]).trim()))
        throw new Error(`Linux coverage artifacts must be on NFS: ${path}`);
}

function preflight() {
    const flags = coverageFlags(process.platform);
    if (process.platform === 'linux') {
        for (const name of ['C_COVERAGE_CACHE', 'C_COVERAGE_CANARY', 'CLANG', 'LLVM_PROFDATA', 'LLVM_COV'])
            if (!process.env[name] || !isAbsolute(process.env[name]))
                throw new Error(`Linux coverage requires an absolute ${name}`);
        requireNfs(CACHE);
        requireNfs(process.env.C_COVERAGE_CANARY);
    }
    const tools = {
        clang: { path: CLANG, version: run(CLANG, ['--version'], { strictStderr: true }) },
        'llvm-profdata': { path: LLVM_PROFDATA, version: llvm(LLVM_PROFDATA, ['--version']) },
        'llvm-cov': { path: LLVM_COV, version: llvm(LLVM_COV, ['--version']) },
    };
    let canary = null;
    if (process.platform === 'linux') {
        const path = process.env.C_COVERAGE_CANARY;
        const checked = JSON.parse(readFileSync(path, 'utf8'));
        if (checked.platform !== 'linux' || checked.architecture !== process.arch
            || !isDeepStrictEqual(checked.flags, flags))
            throw new Error('Signal canary platform, architecture or flags differ');
        for (const [name, tool] of Object.entries(tools)) {
            const prior = Object.entries(checked.versions || {})
                .find(([path]) => basename(path).replace(/-\d+$/, '') === name);
            if (prior?.[1] !== tool.version)
                throw new Error(`Signal canary does not match ${name}`);
        }
        for (const termination of ['normal-exit', 'SIGTERM', 'SIGKILL']) {
            const result = checked.results?.find(row => row.termination === termination);
            if (result?.calls !== 2 || !isDeepStrictEqual(result.outcomes, [1, 1]))
                throw new Error(`Signal canary has no passing ${termination} result`);
        }
        canary = { path, sha256: sha256(path) };
    }
    return { platform: process.platform, architecture: process.arch, flags, tools, canary };
}

function sourceInventory() {
    return ['src', 'win/tty'].flatMap(dir => readdirSync(join(BUILD, dir))
        .filter(name => name.endsWith('.c')).sort().map(name => `${dir}/${name}`));
}

function buildIdentity() {
    const inputs = {};
    for (const dir of ['src', 'include', 'win/tty', 'sys/unix', 'sys/share', 'lib/lua-5.4.8/src'])
        for (const name of readdirSync(join(BUILD, dir)).sort())
            if (/\.(c|h)$|^Makefile$/.test(name))
                inputs[`${dir}/${name}`] = sha256(join(BUILD, dir, name));
    return { binarySha256: sha256(BINARY), inputs };
}

function verifyBuild(manifest) {
    if (!isDeepStrictEqual(buildIdentity(), {
        binarySha256: manifest.binarySha256, inputs: manifest.inputs,
    })) throw new Error('Instrumented binary or source changed; discard this run and rebuild');
}

function buildRecorder(configuration) {
    const original = resolve(process.env.C_COVERAGE_RECORDER || join(ROOT, 'nethack-c/recorder'));
    if (!existsSync(join(original, 'src/Makefile')))
        throw new Error('Build the ordinary recorder first with nethack-c/build-recorder.sh.');
    if (existsSync(BUILD)) throw new Error(`Build already exists: ${BUILD}. Choose a fresh C_COVERAGE_CACHE.`);
    const upstream = join(ROOT, 'nethack-c/upstream');
    if (run('git', ['-C', upstream, 'rev-parse', 'HEAD']).trim() !== PINNED_COMMIT
        || run('git', ['-C', upstream, 'status', '--porcelain', '--untracked-files=no']).trim())
        throw new Error('Build requires the clean pinned upstream source');
    if (process.platform === 'linux') {
        requireNfs(original);
        if (!/^HINTSFILE=.*linux-minimal$/m.test(readFileSync(join(original, 'src/Makefile'), 'utf8'))
            || !readFileSync(join(original, 'src/nethack')).subarray(0, 4).equals(Buffer.from([127, 69, 76, 70])))
            throw new Error('The ordinary recorder must be a Linux minimal ELF build');
    }
    mkdirSync(CACHE, { recursive: true });
    mkdirSync(join(CACHE, 'tmp'), { recursive: true });
    cpSync(original, BUILD, { recursive: true, dereference: true });
    for (const name of readdirSync(join(BUILD, 'src')))
        if (name.endsWith('.o') || ['hacklib.a', 'nethack', 'Sysunix'].includes(name))
            rmSync(join(BUILD, 'src', name));
    const log = openSync(join(CACHE, 'build.log'), 'w');
    try {
        // CC is interpreted by make and then the shell; quote both layers.
        const compiler = [CLANG, ...configuration.flags]
            .map(arg => "'" + arg.replace(/'/g, "'\\''").replace(/\$/g, () => '$$') + "'").join(' ');
        run('make', ['-C', join(BUILD, 'src'), `-j${process.env.TELEPORT_BUILD_JOBS || '8'}`,
            `CC=${compiler}`], {
            env: { ...process.env, SOURCE_DATE_EPOCH: '1777723200',
                TMPDIR: join(CACHE, 'tmp'), LLVM_PROFILE_FILE: join(CACHE, 'tmp/build-%p.profraw') },
            stdio: ['ignore', log, log],
        });
    } finally { closeSync(log); }
    const manifest = { ...configuration, ...buildIdentity(), upstream: PINNED_COMMIT,
        original, ordinaryBinarySha256: sha256(join(original, 'src/nethack')),
        build: BUILD, buildEpoch: '1777723200', inventory: sourceInventory() };
    writeFileSync(join(CACHE, 'build.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(`Built ${BINARY}. Log: ${join(CACHE, 'build.log')}`);
}

function sessionFiles(paths) {
    return [...new Set(paths.flatMap(p => {
        const full = resolve(p);
        return statSync(full).isDirectory()
            ? readdirSync(full).filter(n => n.endsWith('.session.json')).sort()
                .map(n => join(full, n))
            : [full];
    }))];
}

function writeReport(out, results, functions, manifest) {
    const sources = summarizeSources(functions, manifest.inventory);
    const credited = results.filter(r => r.credited);
    const covered = functions.reduce((n, f) => n + f.covered, 0);
    const outcomes = functions.reduce((n, f) => n + f.outcomes, 0);
    const called = functions.filter(f => f.calls > 0).length;
    const summary = {
        generatedAt: new Date().toISOString(), binarySha256: manifest.binarySha256,
        sessions: results.length, credited: credited.length,
        functions: { covered: called, total: functions.length },
        branchOutcomes: { covered, total: outcomes }, results,
    };
    writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    writeFileSync(join(out, 'functions.json'), JSON.stringify(functions, null, 2) + '\n');
    writeFileSync(join(out, 'sources.json'), JSON.stringify(sources, null, 2) + '\n');
    const partial = functions.filter(f => f.calls && f.covered < f.outcomes)
        .sort((a, b) => b.missing.length - a.missing.length);
    const never = functions.filter(f => !f.calls)
        .sort((a, b) => b.outcomes - a.outcomes);
    const lines = [
        '# Measured C branch coverage', '', `Generated: ${summary.generatedAt}.`, '',
        `Exact C re-recordings: **${credited.length}/${results.length}**.`,
        `Functions entered: **${called}/${functions.length}**.`,
        `Direct C branch outcomes observed: **${covered}/${outcomes}** `
            + `(${outcomes ? (100 * covered / outcomes).toFixed(2) + '%' : 'n/a'}).`, '',
        'A covered outcome means C executed it, not that JS implements it correctly.',
        'Only byte-identical re-recordings contribute profiles. Rejected recordings',
        'are listed below. This denominator covers the compiled src/ and win/tty/',
        'functions, including unreachable/error paths. It excludes Lua, macro-internal',
        'conditions, and inactive build configurations. It is not whole-game completeness.',
        'Profiles cover process lifetime, including startup and recorder shutdown.',
        '', '## Source inventory', '',
        'Every src/ and win/tty/ C file in the pinned build is listed. A source',
        'without mapped functions is unmeasured; inspect its build inputs to',
        'distinguish inactive code, data-only sources and missing instrumentation.', '',
        '| Source | Entered functions | Direct outcomes | Mapping |',
        '|---|---:|---:|---|',
    ];
    for (const row of sources)
        lines.push(`| ${row.file} | ${row.entered}/${row.functions} | `
            + `${row.outcomes ? `${row.covered}/${row.outcomes}` : 'n/a'} | ${row.status} |`);
    lines.push('', '## Uncovered outcomes in entered functions', '',
        '| Source | Function | Observed outcomes | First missing outcome |',
        '|---|---|---:|---|',
    );
    for (const f of partial.slice(0, 40)) {
        const m = f.missing[0];
        lines.push(`| ${f.file}:${f.line} | ${f.name} | ${f.covered}/${f.outcomes} `
            + `| ${m.line}:${m.column} = ${m.outcome} |`);
    }
    lines.push('', '## Functions never entered', '',
        '| Source | Function | Branch outcomes |', '|---|---|---:|');
    for (const f of never.slice(0, 40))
        lines.push(`| ${f.file}:${f.line} | ${f.name} | ${f.outcomes} |`);
    lines.push('', '## Rejected recordings', '');
    for (const r of results.filter(r => !r.credited))
        lines.push(`- ${r.session}: ${r.reason}`);
    if (credited.length === results.length) lines.push('None.');
    lines.push('', 'Complete function and missing-outcome lists are in `functions.json`.',
        'The original LLVM counters, including macros, are in `coverage.json`.', '');
    writeFileSync(join(out, 'report.md'), lines.join('\n'));
    console.log(`C coverage: ${called}/${functions.length} functions; ${covered}/${outcomes} `
        + `direct branch outcomes. ${credited.length}/${results.length} recordings credited.`);
}

export function main(args = process.argv.slice(2)) {
    args = [...args];
    const configuration = preflight();
    if (args[0] === '--build') { buildRecorder(configuration); return; }
    let out = join(CACHE, 'run');
    const i = args.indexOf('--out');
    if (i >= 0) {
        if (!args[i + 1]) throw new Error('--out needs a directory');
        out = resolve(args[i + 1]); args.splice(i, 2);
    }
    if (!existsSync(BINARY)) throw new Error('Run with --build first.');
    if (existsSync(out)) throw new Error(`Output already exists: ${out}. Choose a fresh --out.`);
    if (process.platform === 'linux') requireNfs(out);
    const manifest = JSON.parse(readFileSync(join(CACHE, 'build.json'), 'utf8'));
    for (const field of ['platform', 'architecture', 'flags', 'tools', 'canary'])
        if (!isDeepStrictEqual(manifest[field], configuration[field]))
            throw new Error(`Build ${field} differs; use a fresh instrumented build`);
    verifyBuild(manifest);
    const files = sessionFiles(args.length ? args : [
        join(ROOT, 'sessions'), join(ROOT, 'tools/gen-sessions/generated'),
    ]);
    if (!files.length) throw new Error('No sessions selected.');
    mkdirSync(out, { recursive: true });
    mkdirSync(join(out, 'tmp'));
    const recorderHash = sha256(RECORDER);
    writeFileSync(join(out, 'manifest.json'), JSON.stringify({ ...manifest,
        recorderSha256: recorderHash, timezone: process.env.RERECORD_TZ || 'America/New_York',
    }, null, 2) + '\n');
    const results = [], profiles = [];
    for (const [index, input] of files.entries()) {
        const dir = join(out, String(index));
        mkdirSync(dir);
        const result = { session: relative(ROOT, input), inputSha256: sha256(input), credited: false };
        try {
            const expected = JSON.parse(readFileSync(input, 'utf8'));
            if (expected.jsGroundTruth) throw new Error('JS ground truth is not a C oracle');
            run(process.execPath, [RECORDER, input, join(dir, 'actual.json')], {
                env: { ...process.env, NETHACK_BINARY: BINARY, NETHACK_INSTALL: INSTALL,
                    TMPDIR: join(out, 'tmp'), LLVM_PROFILE_FILE: join(dir, '%h-%p%c.profraw') },
                stderrLog: join(dir, 'recorder.log'),
            });
            if (sha256(input) !== result.inputSha256) throw new Error('Input changed during rerecording');
            if (/LLVM Profile (Error|Warning)/.test(readFileSync(join(dir, 'recorder.log'), 'utf8')))
                throw new Error('Profile runtime diagnostics; see recorder.log');
            const actual = JSON.parse(readFileSync(join(dir, 'actual.json'), 'utf8'));
            result.actualSha256 = sha256(join(dir, 'actual.json'));
            const diff = recordingDifference(expected, actual);
            if (diff) {
                result.recording = relative(ROOT, join(dir, 'actual.json'));
                throw new Error(diff);
            }
            const raw = readdirSync(dir).filter(n => n.endsWith('.profraw'));
            if (raw.length !== expected.segments.length)
                throw new Error(`expected ${expected.segments.length} profiles, got ${raw.length}`);
            if (raw.some(name => !statSync(join(dir, name)).size))
                throw new Error('Empty raw profile');
            const profile = join(out, `${index}.profdata`);
            llvm(LLVM_PROFDATA, ['merge', '-sparse', '--failure-mode=any',
                ...raw.map(n => join(dir, n)), '-o', profile], join(dir, 'profdata.log'));
            profiles.push(profile);
            result.credited = true;
        } catch (e) { result.reason = e.message; }
        results.push(result);
        if (result.credited) rmSync(dir, { recursive: true, force: true });
        else result.diagnostics = relative(ROOT, dir);
        if (!result.credited || (index + 1) % 10 === 0 || index === files.length - 1)
            console.log(`[${index + 1}/${files.length}] ${result.credited ? 'exact' : 'REJECT'} `
                + `${result.session}${result.reason ? ': ' + result.reason : ''}`);
    }
    verifyBuild(manifest);
    if (sha256(RECORDER) !== recorderHash) throw new Error('Recorder source changed during collection');
    writeFileSync(join(out, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    if (!profiles.length) throw new Error('No exact recordings; no coverage credited.');
    const profile = join(out, 'merged.profdata');
    llvm(LLVM_PROFDATA, ['merge', '-sparse', '--failure-mode=any', ...profiles, '-o', profile],
        join(out, 'merge.log'));
    const data = llvm(LLVM_COV, ['export', '--skip-expansions', BINARY,
        `-instr-profile=${profile}`], join(out, 'export.log'));
    writeFileSync(join(out, 'coverage.json'), data);
    const functions = summarizeFunctions(JSON.parse(data), BUILD);
    if (!functions.some(fn => fn.calls > 0)) throw new Error('Coverage export has no entered C functions');
    writeReport(out, results, functions, manifest);
    if (results.some(r => !r.credited)) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { main(); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
