// Exercise the real collector CLI flow with tiny files and mocked subprocesses.
// All stat/git/make/LLVM/recorder calls are intercepted. No native process runs.
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync,
    rmSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { coverageFlags } from './c-branch-coverage.mjs';

const source = fileURLToPath(new URL('./c-branch-coverage.mjs', import.meta.url));
const pinned = '16ff59115315917b93185d026aeefea06db9b0f4';
const session = (segments = 1) => ({ version: 5, segments: Array.from({ length: segments }, () => ({
    seed: 7, datetime: '20000110090000', nethackrc: '', moves: '',
    steps: [{ key: null, screen: 'map', rng: ['rn2(2)=1 @ example.c:2'],
        cursor: [0, 0, 1], animation_frames: [] }],
})) });

async function fixture(t, platform = 'linux') {
    const root = mkdtempSync(join(dirname(dirname(source)), 'test-'));
    const cache = join(root, 'coverage'), ordinary = join(root, 'nethack-c/recorder');
    const build = join(cache, 'recorder'), calls = [], unknown = [];
    const behavior = {};
    const put = (file, contents) => {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, contents);
    };
    put(join(root, 'tools/c-branch-coverage.mjs'), readFileSync(source));
    put(join(root, 'scripts/record-session.mjs'), 'throw new Error("test fixture, never execute");\n');
    for (const dir of ['src', 'include', 'win/tty', 'sys/unix', 'sys/share', 'lib/lua-5.4.8/src'])
        mkdirSync(join(ordinary, dir), { recursive: true });
    put(join(ordinary, 'src/Makefile'), 'HINTSFILE=sys/unix/hints/linux-minimal\nCFLAGS=-g -I../include\n');
    put(join(ordinary, 'src/nethack'), Buffer.from([127, 69, 76, 70]));
    for (const name of ['old.o', 'hacklib.a', 'Sysunix']) put(join(ordinary, 'src', name), 'old');
    put(join(ordinary, 'src/example.c'), 'int decision(int x) { return x ? 1 : 0; }\n');
    put(join(ordinary, 'src/unmapped.c'), 'const int data_only = 3;\n');
    put(join(ordinary, 'win/tty/topl.c'), 'void unentered(void) {}\n');
    put(join(ordinary, 'include/config.h'), '#define TEST 1\n');
    put(join(ordinary, 'install/games/lib/nethackdir/sysconf'), 'WIZARDS=*\n');

    const tool = name => join(root, "private tools $literal'quote", name);
    const versions = Object.fromEntries(['clang', 'llvm-profdata', 'llvm-cov'].map(name =>
        [tool(name), `Ubuntu ${name} version 18.1.3\n`]));
    const canaryPath = join(root, 'canary/validation.json');
    const canary = { platform: 'linux', architecture: process.arch,
        flags: coverageFlags('linux'), versions,
        results: ['normal-exit', 'SIGTERM', 'SIGKILL'].map(termination => ({
            termination, calls: 2, outcomes: [1, 1],
        })),
    };
    put(canaryPath, JSON.stringify(canary));
    const env = { C_COVERAGE_CACHE: cache, C_COVERAGE_RECORDER: ordinary,
        C_COVERAGE_CANARY: canaryPath, CLANG: tool('clang'),
        LLVM_PROFDATA: tool('llvm-profdata'), LLVM_COV: tool('llvm-cov'),
        RERECORD_TZ: 'Etc/GMT+4', LD_LIBRARY_PATH: '/private-toolchain/lib', TELEPORT_BUILD_JOBS: '4' };
    const savedEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
    const savedExitCode = process.exitCode;
    Object.assign(process.env, env);
    Object.defineProperty(process, 'platform', { ...descriptor, value: platform });

    const ok = (stdout = '', stderr = '', status = 0) => ({ stdout, stderr, status });
    const spawnMock = t.mock.method(childProcess, 'spawnSync', (command, args, options) => {
        calls.push({ command, args, options });
        if (command === 'stat') {
            assert.deepEqual(args.slice(0, 3), ['-f', '-c', '%T']);
            return ok(behavior.localFs && args[3].startsWith(behavior.localFs) ? 'ext2/ext3\n' : 'nfs\n');
        }
        if (command === 'git') return ok(args.includes('rev-parse')
            ? (behavior.pin || pinned) + '\n' : (behavior.dirty || ''));
        if (command === 'make') {
            assert.equal(args[1], join(build, 'src'));
            for (const name of ['old.o', 'hacklib.a', 'Sysunix', 'nethack'])
                assert.equal(existsSync(join(build, 'src', name)), false, `stale ${name}`);
            put(join(build, 'src/nethack'), 'instrumented test binary');
            return ok();
        }
        if (command === process.execPath) {
            assert.equal(args[0], join(root, 'scripts/record-session.mjs'));
            const expected = JSON.parse(readFileSync(args[1], 'utf8'));
            const actual = structuredClone(expected);
            behavior.record?.(actual, expected, args[1]);
            put(args[2], JSON.stringify(actual));
            const count = behavior.rawCount ?? expected.segments.length;
            for (let i = 0; i < count; ++i)
                put(join(dirname(args[2]), `testhost-${100 + i}.profraw`), behavior.raw ?? 'valid raw');
            return ok('', behavior.recorderDiagnostic || '[ok] mocked recorder\n', behavior.recorderStatus || 0);
        }
        let name = command;
        if (command === 'xcrun') [name, ...args] = args;
        if (args[0] === '--version' && versions[name])
            return ok(behavior.changedVersion === name ? 'different toolchain\n' : versions[name]);
        if (name === tool('llvm-profdata')) {
            assert.equal(args[0], 'merge');
            assert.ok(args.includes('--failure-mode=any'));
            const raw = args.filter(arg => arg.endsWith('.profraw'));
            if (raw.some(file => readFileSync(file, 'utf8') === 'corrupt'))
                return ok('', 'invalid raw profile\n', 1);
            put(args[args.indexOf('-o') + 1], 'mock indexed profile');
            return ok('', raw.length ? behavior.mergeDiagnostic || '' : '');
        }
        if (name === tool('llvm-cov')) {
            assert.equal(args[0], 'export');
            assert.ok(args.includes('--skip-expansions'));
            return ok(JSON.stringify({ data: [{ functions: behavior.noMappings ? [] : [{
                name: 'example.c:decision', count: 2,
                filenames: [join(build, 'src/example.c'), join(build, 'include/config.h')],
                regions: [[1, 1, 4, 1, 2, 0, 0, 0]],
                branches: [[2, 1, 2, 2, 1, 0, 0, 0, 4], [2, 1, 2, 2, 0, 1, 0, 0, 4],
                    [3, 1, 3, 2, 1, 1, 1, 0, 4]],
            }, {
                name: 'unentered', count: 0, filenames: [join(build, 'win/tty/topl.c')],
                regions: [[1, 1, 2, 1, 0, 0, 0, 0]], branches: [],
            }] }] }), behavior.exportDiagnostic || '');
        }
        unknown.push({ command, args });
        throw new Error(`Unexpected subprocess: ${command}`);
    });
    syncBuiltinESMExports();
    t.after(() => {
        spawnMock.mock.restore();
        syncBuiltinESMExports();
        Object.defineProperty(process, 'platform', descriptor);
        for (const [key, value] of Object.entries(savedEnv))
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        process.exitCode = savedExitCode;
        rmSync(root, { recursive: true, force: true });
        assert.deepEqual(unknown, [], 'every subprocess must be intercepted');
    });
    const collector = await import(pathToFileURL(join(root, 'tools/c-branch-coverage.mjs')).href);
    const input = join(root, 'inputs/exact.session.json');
    put(input, JSON.stringify(session(2)));
    return { root, cache, build, ordinary, input, canary, canaryPath, env, versions,
        tool, calls, behavior, put, main: collector.main,
        json: file => JSON.parse(readFileSync(file, 'utf8')) };
}

test('Linux build and exact multi-segment collection keep artifacts isolated and report every source', async t => {
    const f = await fixture(t);
    f.main(['--build']);
    const make = f.calls.find(call => call.command === 'make');
    const quoted = "'" + f.tool('clang').replace(/'/g, "'\\''").replace(/\$/g, () => '$$') + "'";
    assert.ok(make.args.at(-1).startsWith(`CC=${quoted} `));
    assert.ok(make.args.at(-1).includes("'-runtime-counter-relocation'"));
    assert.ok(make.args.includes('-j4'));
    assert.equal(make.options.env.TMPDIR, join(f.cache, 'tmp'));
    assert.equal(make.options.env.SOURCE_DATE_EPOCH, '1777723200');
    assert.equal(readFileSync(join(f.ordinary, 'src/old.o'), 'utf8'), 'old');
    f.main([f.input]);
    const run = join(f.cache, 'run');
    const summary = f.json(join(run, 'summary.json'));
    assert.equal(summary.credited, 1);
    assert.deepEqual(summary.branchOutcomes, { covered: 2, total: 4 });
    const rows = f.json(join(run, 'sources.json'));
    assert.equal(rows.length, 3);
    assert.equal(rows[1].status, 'no mapped functions');
    assert.equal(rows.reduce((n, row) => n + row.outcomes, 0), summary.branchOutcomes.total);
    const recorder = f.calls.find(call => call.command === process.execPath);
    assert.equal(recorder.options.env.NETHACK_BINARY, join(f.build, 'src/nethack'));
    assert.equal(recorder.options.env.NETHACK_INSTALL, join(f.build, 'install/games/lib/nethackdir'));
    assert.equal(recorder.options.env.TMPDIR, join(run, 'tmp'));
    assert.equal(recorder.options.env.LD_LIBRARY_PATH, '/private-toolchain/lib');
    assert.equal(recorder.options.env.LLVM_PROFILE_FILE, join(run, '0/%h-%p%c.profraw'));
    assert.equal(f.json(join(run, 'manifest.json')).timezone, 'Etc/GMT+4');
    assert.equal(f.json(join(run, 'manifest.json')).ordinaryBinarySha256.length, 64);
    assert.equal(summary.results[0].inputSha256.length, 64);
    assert.equal(summary.results[0].actualSha256.length, 64);
    assert.ok(!f.calls.some(call => call.command === 'xcrun'));
    assert.throws(() => f.main(['--build']), /Build already exists/);
    assert.throws(() => f.main([f.input]), /Output already exists/);
});

test('Darwin retains xcrun and does not require a Linux canary or NFS', async t => {
    const f = await fixture(t, 'darwin');
    delete process.env.C_COVERAGE_CANARY;
    f.main(['--build']);
    f.main([f.input]);
    assert.equal(f.json(join(f.cache, 'run/summary.json')).credited, 1);
    assert.ok(f.calls.some(call => call.command === 'xcrun'));
    assert.ok(!f.calls.some(call => call.command === 'stat'));
    assert.ok(!f.calls.find(call => call.command === 'make').args.at(-1).includes('relocation'));
});

for (const [name, change, message] of [
    ['missing explicit NFS root', f => { delete process.env.C_COVERAGE_CACHE; }, /C_COVERAGE_CACHE/],
    ['local cache filesystem', f => { f.behavior.localFs = f.root; }, /must be on NFS/],
    ['failed SIGKILL canary', f => { f.canary.results[2].outcomes = [0, 0]; }, /passing SIGKILL/],
    ['toolchain version mismatch', f => { f.behavior.changedVersion = f.tool('clang'); }, /does not match clang/],
    ['canary flags mismatch', f => { f.canary.flags.pop(); }, /flags differ/],
    ['wrong pinned C revision', f => { f.behavior.pin = 'wrong'; }, /clean pinned/],
    ['dirty pinned source', f => { f.behavior.dirty = ' M src/example.c'; }, /clean pinned/],
    ['Darwin ordinary recorder', f => { f.put(join(f.ordinary, 'src/nethack'), 'Mach-O'); }, /Linux minimal ELF/],
]) {
    test(`preflight rejects ${name} before a build or recorder invocation`, async t => {
        const f = await fixture(t);
        change(f);
        f.put(f.canaryPath, JSON.stringify(f.canary));
        assert.throws(() => f.main(['--build']), message);
        assert.ok(!f.calls.some(call => call.command === 'make' || call.command === process.execPath));
        assert.equal(existsSync(f.build), false);
    });
}

test('a custom local output is rejected before recording', async t => {
    const f = await fixture(t);
    f.main(['--build']);
    const local = join(f.root, 'local');
    mkdirSync(local);
    f.behavior.localFs = local;
    assert.throws(() => f.main(['--out', join(local, 'run'), f.input]), /must be on NFS/);
    assert.ok(!f.calls.some(call => call.command === process.execPath));
});

test('a mismatched recording contributes no profile to a mixed exact/rejected union', async t => {
    const f = await fixture(t);
    f.main(['--build']);
    const bad = join(f.root, 'inputs/changed.session.json');
    f.put(bad, JSON.stringify(session()));
    f.behavior.record = (actual, expected, path) => {
        if (path === bad) actual.segments[0].steps[0].rng.push('extra call');
    };
    f.main([f.input, bad]);
    const run = join(f.cache, 'run');
    const summary = f.json(join(run, 'summary.json'));
    assert.equal(summary.credited, 1);
    assert.equal(summary.results[1].credited, false);
    assert.match(summary.results[1].reason, /rng/);
    assert.ok(existsSync(join(run, '1/actual.json')));
    const merges = f.calls.filter(call => call.command === f.tool('llvm-profdata') && call.args[0] === 'merge');
    assert.equal(merges.length, 2);
    assert.deepEqual(merges[1].args.filter(arg => arg.endsWith('.profdata')), [join(run, '0.profdata'), join(run, 'merged.profdata')]);
    assert.equal(process.exitCode, 1);
});

for (const [name, change, message] of [
    ['JS reference', f => { f.put(f.input, JSON.stringify({ ...session(), jsGroundTruth: true })); }, /JS ground truth/],
    ['JS actual recording', f => { f.behavior.record = actual => { actual.jsGroundTruth = true; }; }, /JS ground truth/],
    ['missing segment profile', f => { f.behavior.rawCount = 1; }, /expected 2 profiles/],
    ['empty profile', f => { f.behavior.raw = ''; }, /Empty raw profile/],
    ['corrupt profile', f => { f.behavior.raw = 'corrupt'; }, /invalid raw profile/],
    ['merge warning', f => { f.behavior.mergeDiagnostic = 'profile hash mismatch'; }, /diagnostics/],
    ['runtime profile warning', f => { f.behavior.recorderDiagnostic = 'LLVM Profile Warning: failed mmap'; }, /Profile runtime diagnostics/],
    ['driver failure', f => { f.behavior.recorderStatus = 1; }, /exited 1/],
    ['reference changed during recording', f => { f.behavior.record = (_, expected, path) => f.put(path, JSON.stringify({ ...expected, changed: true })); }, /Input changed/],
]) {
    test(`${name} earns zero coverage credit and retains rejection diagnostics`, async t => {
        const f = await fixture(t);
        f.main(['--build']);
        change(f);
        assert.throws(() => f.main([f.input]), /No exact recordings/);
        const results = f.json(join(f.cache, 'run/results.json'));
        assert.equal(results[0].credited, false);
        assert.match(results[0].reason, message);
        assert.ok(existsSync(join(f.cache, 'run/0')));
        assert.ok(!existsSync(join(f.cache, 'run/summary.json')));
        assert.ok(!f.calls.some(call => call.args.includes('export')));
    });
}

for (const [name, file] of [['binary', 'src/nethack'], ['source', 'src/example.c']]) {
    test(`a changed ${name} prevents replay and reuse of an old build`, async t => {
        const f = await fixture(t);
        f.main(['--build']);
        f.put(join(f.build, file), 'changed');
        assert.throws(() => f.main([f.input]), /changed; discard/);
        assert.ok(!f.calls.some(call => call.command === process.execPath));
    });
}

test('a build modified during recording cannot produce a coverage report', async t => {
    const f = await fixture(t);
    f.main(['--build']);
    f.behavior.record = () => f.put(join(f.build, 'src/example.c'), 'changed');
    assert.throws(() => f.main([f.input]), /changed; discard/);
    assert.ok(!existsSync(join(f.cache, 'run/summary.json')));
});

test('a changed recorder driver cannot produce a coverage report', async t => {
    const f = await fixture(t);
    f.main(['--build']);
    f.behavior.record = () => f.put(join(f.root, 'scripts/record-session.mjs'), 'changed');
    assert.throws(() => f.main([f.input]), /Recorder source changed/);
    assert.ok(!existsSync(join(f.cache, 'run/summary.json')));
});

test('an inconsistent inventory fails before writing a coverage summary', async t => {
    const f = await fixture(t);
    f.main(['--build']);
    const manifestPath = join(f.cache, 'build.json');
    const manifest = f.json(manifestPath);
    manifest.inventory = manifest.inventory.filter(file => file !== 'src/example.c');
    f.put(manifestPath, JSON.stringify(manifest));
    assert.throws(() => f.main([f.input]), /absent from inventory/);
    assert.ok(!existsSync(join(f.cache, 'run/summary.json')));
});

test('export diagnostics and an empty census cannot produce a coverage report', async t => {
    const f = await fixture(t);
    f.main(['--build']);
    f.behavior.exportDiagnostic = 'coverage data may be out of date';
    assert.throws(() => f.main(['--out', join(f.cache, 'warn'), f.input]), /diagnostics/);
    assert.ok(!existsSync(join(f.cache, 'warn/summary.json')));
    f.behavior.exportDiagnostic = '';
    f.behavior.noMappings = true;
    assert.throws(() => f.main(['--out', join(f.cache, 'empty'), f.input]), /no entered C functions/);
    assert.ok(!existsSync(join(f.cache, 'empty/summary.json')));
});
