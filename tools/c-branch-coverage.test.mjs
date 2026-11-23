import assert from 'node:assert/strict';
import test from 'node:test';
import { recordingDifference, summarizeFunctions, summarizeSources,
    coverageFlags, llvmCommand } from './c-branch-coverage.mjs';

const session = () => ({ segments: [{ steps: [{
    key: null, rng: ['rn2(2)=1 @ f(example.c:3)'], screen: 'map',
    cursor: [5, 4, 1], animation_frames: [{ screen: 'flash', cursor: [3, 4, 1] }],
}] }] });

test('coverage credit requires exact RNG, cells, cursor and animations', () => {
    const expected = session();
    assert.equal(recordingDifference(expected, structuredClone(expected)), null);
    for (const field of ['rng', 'screen', 'cursor', 'animation_frames']) {
        const actual = session();
        actual.segments[0].steps[0][field] = [];
        assert.match(recordingDifference(expected, actual), new RegExp(field));
    }
});

test('truncated and empty recordings cannot earn coverage', () => {
    const actual = session();
    actual.segments[0].steps = [];
    assert.match(recordingDifference(session(), actual), /step count/);
    assert.match(recordingDifference(actual, actual), /step count/);
    assert.equal(recordingDifference(session(), { segments: [] }), 'segment count');
    assert.equal(recordingDifference({ segments: [] }, { segments: [] }), 'empty session');
});

test('an executed condition with one untaken outcome stays a coverage gap', () => {
    const coverage = { data: [{ functions: [{
        name: 'example.c:deterministic', count: 10,
        filenames: ['/build/src/example.c', '/build/include/macros.h'],
        regions: [[2, 1, 8, 2, 10, 0, 0, 0]],
        branches: [[3, 9, 3, 15, 10, 0, 0, 0, 4],
            [4, 9, 4, 16, 0, 0, 0, 0, 4],
            [8, 1, 8, 4, 1, 1, 1, 0, 4]],
    }] }] };
    const [fn] = summarizeFunctions(coverage, '/build');
    assert.equal(fn.name, 'deterministic');
    assert.equal(fn.outcomes, 4);
    assert.equal(fn.covered, 1);
    assert.deepEqual(fn.missing, [
        { line: 3, column: 9, outcome: false },
        { line: 4, column: 9, outcome: true },
        { line: 4, column: 9, outcome: false },
    ]);
});

test('functions without RNG or branches remain in the function census', () => {
    const functions = ['/build/src/cleanup.c', '/build/win/tty/topl.c',
        '/build/include/hack.h', '/build/sys/unix/unixmain.c'].map(filename => ({
        name: 'cleanup', count: 0, filenames: [filename],
        regions: [[2, 1, 4, 2, 0, 0, 0, 0]], branches: [],
    }));
    const rows = summarizeFunctions({ data: [{ functions }] }, '/build');
    assert.deepEqual(rows.map(f => f.file), ['src/cleanup.c', 'win/tty/topl.c']);
    assert.ok(rows.every(f => !f.calls && !f.outcomes));
});

test('Linux enables relocation while Darwin retains its compiler flags and xcrun', () => {
    assert.deepEqual(coverageFlags('linux'), [...coverageFlags('darwin'), '-mllvm', '-runtime-counter-relocation']);
    assert.deepEqual(coverageFlags('darwin'), ['-fprofile-instr-generate', '-fcoverage-mapping']);
    assert.throws(() => coverageFlags('win32'), /Unsupported/);
    assert.deepEqual(llvmCommand('linux', '/llvm/bin/llvm-cov', ['export']), ['/llvm/bin/llvm-cov', 'export']);
    assert.deepEqual(llvmCommand('darwin', 'llvm-cov', ['export']), ['xcrun', 'llvm-cov', 'export']);
});

test('source rows retain duplicate branch identities, unentered functions and unmapped files', () => {
    const functions = summarizeFunctions({ data: [{ functions: [{
        name: 'test.c:decision', count: 2, filenames: ['/build/src/test.c'],
        regions: [[1, 1, 8, 1, 2, 0, 0, 0]],
        branches: [[3, 1, 3, 2, 1, 0, 0, 0, 4], [3, 1, 3, 2, 0, 1, 0, 0, 4]],
    }, {
        name: 'unentered', count: 0, filenames: ['/build/win/tty/topl.c'],
        regions: [[1, 1, 3, 1, 0, 0, 0, 0]], branches: [],
    }] }] }, '/build');
    const rows = summarizeSources(functions, ['src/test.c', 'src/unmapped.c', 'win/tty/topl.c']);
    assert.deepEqual(rows[0], { file: 'src/test.c', functions: 1, entered: 1,
        outcomes: 4, covered: 2, status: 'mapped' });
    assert.equal(rows[1].status, 'no mapped functions');
    assert.equal(rows[2].entered, 0);
    assert.throws(() => summarizeSources(functions, []), /absent from inventory/);
});

test('keys, trailing RNG and omitted animations cannot earn exact credit', () => {
    for (const change of [
        step => { step.key = 'x'; },
        step => { step.rng.push('rn2(1)=0'); },
        step => { delete step.animation_frames; },
    ]) {
        const actual = session();
        change(actual.segments[0].steps[0]);
        assert.notEqual(recordingDifference(session(), actual), null);
    }
});

test('changed replay inputs, session versions and JS ground truth are rejected', () => {
    for (const field of ['seed', 'datetime', 'nethackrc', 'moves']) {
        const actual = session();
        actual.segments[0][field] = 'different';
        assert.match(recordingDifference(session(), actual), new RegExp(field));
    }
    assert.match(recordingDifference(session(), { ...session(), version: 4 }), /version/);
    assert.match(recordingDifference({ ...session(), jsGroundTruth: true }, session()), /JS ground truth/);
    assert.match(recordingDifference(session(), { ...session(), jsGroundTruth: true }), /JS ground truth/);
});
