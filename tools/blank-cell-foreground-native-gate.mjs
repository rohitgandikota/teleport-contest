// Strict independent C parity. Blank cells retain their color and attributes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const fixtures = [
    ['projectile-trap-callers', '44da2d8ea913186adf38595e5f15e5b7f1591ab9ceac86442a080d8033d4ca7f'],
    ['monster-growth-callback', '9d7885fabf56c6a4ce8f71d28687cac13c89b0245aa3bce9bd58b5ad6a231243'],
    ['accessible-raised-drawbridge', '9d715e570ec7e7c007c7cb7bdcaafbab7df0d69bf86a4bf298c118ec2e4eb0ff'],
    ['hero-species-table-identity', '06cae818c0140935a1d61435f3b7d5d90cf05e96029c2335ea17fbf62bc69715'],
];
const requested = process.argv.slice(2);
for (const name of requested) assert.ok(fixtures.some(([fixture]) => fixture === name), name);
// The supplemental identity fixture requires its separately owned species fix.
const selected = requested.length
    ? fixtures.filter(([name]) => requested.includes(name)) : fixtures.slice(0, 3);
const sha = value => createHash('sha256').update(value).digest('hex');
const hash = value => sha(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Remove diagnostic source labels only. Every RNG call, argument, result and
// position remains part of the comparison; no resynchronization is allowed.
const calls = entries => (entries || []).map(entry => {
    const value = String(entry).replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim();
    assert.match(value, /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/,
        'every RNG entry is retained and recognized');
    return value;
});

function cellDifferences(expected, actual) {
    const c = decodeScreen(expected), js = decodeScreen(actual), differences = [];
    for (let y = 0; y < 24; y++) for (let x = 0; x < 80; x++) {
        const left = c[y][x], right = js[y][x];
        if (renderCell(left) !== renderCell(right)
            || left.color !== right.color || left.attr !== right.attr)
            differences.push({x, y, c: left, js: right});
    }
    return differences;
}

for (const [fixture, expectedSHA] of selected) {
    const raw = readFileSync(new URL(`gen-sessions/generated/${fixture}.session.json`, import.meta.url));
    assert.equal(sha(raw), expectedSHA, fixture);
    const native = JSON.parse(raw);
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.deepEqual(recordingIntegrityErrors(native), []);
    for (const part of native.segments) {
        assert.equal(part.steps.length, part.moves.length + 1);
        assert.equal(part.steps[0].key, null);
        for (let i = 1; i < part.steps.length; i++)
            assert.equal(part.steps[i].key, part.moves[i - 1]);
        const run = await runSegment({...part, storage: new InMemoryStorage()});
        // These hashes cover the original, unmodified JS output arrays.
        const output = {screens: run.getScreens(), cursors: run.getCursors(),
            calls: run.getRngLog(), slices: run.getRngSlices(),
            frames: run.getAnimationFramesByStep()};
        const expectedCalls = part.steps.flatMap(step => calls(step.rng));
        const actualCalls = calls(output.calls);
        const matched = {grids: 0, cursors: 0, slices: 0, frameCounts: 0,
            frameGrids: 0, frameCursors: 0};
        const checks = [], differences = [];
        let expectedFrames = 0, actualFrames = 0;
        for (const [step, recorded] of part.steps.entries()) {
            const cells = cellDifferences(recorded.screen, output.screens[step]);
            const cursor = same(recorded.cursor, output.cursors[step]);
            const rng = same(calls(recorded.rng), calls(output.slices[step]));
            const cframes = recorded.animation_frames || [], jsframes = output.frames[step] || [];
            expectedFrames += cframes.length;
            actualFrames += jsframes.length;
            let frames = cframes.length === jsframes.length;
            matched.frameCounts += +frames;
            for (const [i, frame] of cframes.entries()) {
                const actual = jsframes[i];
                const grid = !!actual && cellDifferences(frame.screen, actual.screen).length === 0;
                const cur = !!actual && same(frame.cursor, actual.cursor);
                matched.frameGrids += +grid;
                matched.frameCursors += +cur;
                frames &&= grid && cur;
            }
            matched.grids += +(cells.length === 0);
            matched.cursors += +cursor;
            matched.slices += +rng;
            checks.push({step, grid: cells.length === 0, cursor, rng, frames});
            if (cells.length || !cursor || !rng || !frames)
                differences.push({step, key: recorded.key, cellCount: cells.length,
                    cellSHA256: hash(cells), cells: cells.slice(0, 24),
                    blankColorOnly: cells.every(c => renderCell(c.c) === ' '
                        && renderCell(c.js) === ' ' && c.c.attr === c.js.attr
                        && c.c.color !== c.js.color), cursor, rng, frames});
        }
        const fullStreamExact = same(expectedCalls, actualCalls);
        const firstCall = expectedCalls.findIndex((c, i) => c !== actualCalls[i]);
        const exact = differences.length === 0 && fullStreamExact
            && output.screens.length === part.steps.length
            && output.cursors.length === part.steps.length
            && output.slices.length === part.steps.length
            && output.frames.length === part.steps.length && actualFrames === expectedFrames;
        console.log(JSON.stringify({fixture, name: part.name, exact, nativeSHA256: expectedSHA,
            expected: {boundaries: part.steps.length, calls: expectedCalls.length, frames: expectedFrames},
            actual: {boundaries: output.screens.length, cursors: output.cursors.length,
                calls: actualCalls.length, slices: output.slices.length,
                frameBoundaries: output.frames.length, frames: actualFrames},
            matched, fullStreamExact,
            firstCall: firstCall < 0 ? null : {index: firstCall, c: expectedCalls[firstCall], js: actualCalls[firstCall]},
            hashes: Object.fromEntries(Object.entries(output).map(([key, value]) => [key, hash(value)])),
            firstDifference: differences[0] || null, differences, checks}));
        if (!exact) process.exitCode = 1;
    }
}
