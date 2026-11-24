// Immutable C input and strict rendered glyph/style, cursor, RNG and frame checks.
// DEC characters are decoded by the existing terminal decoder. Blank cell color
// and every attribute remain in the comparison; no mismatch is waived.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {recordingIntegrityErrors, branchAssertionErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type: 'json'};

const raw = readFileSync(new URL('gen-sessions/generated/monster-slow-touch-completion.session.json', import.meta.url));
const native = JSON.parse(raw);
const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/monster-slow-touch-completion.json', import.meta.url)));
const counts = [[53, 2790, 0], [53, 2790, 0], [49, 2774, 0]];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function calls(entries) {
    return entries.map(entry => {
        const match = entry.match(/^((?:rn2|rnd|rn1|rnl|rne|rnz|d)\([^)]*\)=-?\d+)(?: @ .*)?$/);
        assert.ok(match, 'every RNG entry must be retained and recognized');
        return match[1];
    });
}
function styles(screen) {
    return decodeScreen(screen).map(row => row.map(cell => [renderCell(cell), cell.color, cell.attr]));
}
test('native raw bytes, five input fields and presence bits, every boundary key', () => {
    assert.equal(createHash('sha256').update(raw).digest('hex'),
        '7eb4d47fb20e8592edf0f4bee931dc2e81025b938efb9204486c006af5339e78');
    assert.equal(raw.length, 430044);
    assert.equal(native.source, 'c'); assert.equal(native.version, 5);
    assert.equal(native.segments.length, 3); assert.equal(recipe.segments.length, 3);
    assert.deepEqual(recordingIntegrityErrors(native), []);
    for (const [i, part] of native.segments.entries()) {
        for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
            assert.equal(Object.hasOwn(part, key), true);
            assert.equal(Object.hasOwn(recipe.segments[i], key), true);
            assert.deepEqual(part[key], recipe.segments[i][key]);
        }
        assert.deepEqual(part.steps.map(s => s.key), [null, ...part.moves]);
        assert.equal(part.steps.length, counts[i][0]);
        assert.equal(calls(part.steps.flatMap(s => s.rng || [])).length, counts[i][1]);
        assert.equal(part.steps.reduce((n, s) => n + (s.animation_frames || []).length, 0), counts[i][2]);
    }
});
test('registered categories and unchanged source assertions hold in C', () => {
    const known = new Set(tags.requirements.map(r => r.id));
    for (const category of recipe.coverage) assert.ok(known.has(category), category);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
});
for (const part of native.segments) test(`full native parity: ${part.name}`, async () => {
    const run = await runSegment({...part, storage: new InMemoryStorage()});
    const screens = run.getScreens(), cursors = run.getCursors(), slices = run.getRngSlices();
    const frames = run.getAnimationFramesByStep(), actualCalls = calls(run.getRngLog());
    const expectedCalls = calls(part.steps.flatMap(s => s.rng || []));
    const differences = [];
    for (const [step, recorded] of part.steps.entries()) {
        if (!same(styles(recorded.screen), styles(screens[step]))) differences.push({step, kind: 'styled-grid'});
        if (!same(recorded.cursor, cursors[step])) differences.push({step, kind: 'cursor'});
        if (!same(calls(recorded.rng || []), calls(slices[step] || []))) differences.push({step, kind: 'RNG-slice'});
        if (!same(recorded.animation_frames || [], frames[step])) differences.push({step, kind: 'frame-array'});
    }
    assert.equal(screens.length, part.steps.length);
    assert.equal(cursors.length, part.steps.length);
    assert.equal(slices.length, part.steps.length);
    assert.equal(frames.length, part.steps.length);
    assert.equal(actualCalls.length, expectedCalls.length);
    assert.deepEqual(actualCalls, expectedCalls);
    assert.deepEqual(differences, [], 'every native boundary must match');
});
