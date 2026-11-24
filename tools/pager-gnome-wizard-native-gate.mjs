// Independent C parity: every cell's glyph, color and attributes, including blanks.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen, renderCell, diffCell} from '../frozen/screen-decode.mjs';
import {recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const hash = value => sha(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const paths = process.argv.slice(2);
if (!paths.length) paths.push(new URL('gen-sessions/generated/pager-gnome-wizard.session.json', import.meta.url));

// Strip diagnostic source labels only. Keep every call, argument, result and
// position. Full streams and each input's slice must match without resync.
function calls(entries) {
    assert.ok(Array.isArray(entries), 'RNG trace must be an array');
    return entries.map((entry, index) => {
        assert.equal(typeof entry, 'string', `RNG entry ${index} must be a string`);
        const call = entry.replace(/\s+@\s*.*$/, '');
        assert.match(call, /^(?:~d)?(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(-?\d+(?:,\s*-?\d+)*\)=-?\d+$/,
            `Unrecognized RNG entry ${index}: ${entry}`);
        return call;
    });
}
function cellDifferences(expected, actual) {
    const c = decodeScreen(expected), js = decodeScreen(actual), differences = [];
    for (let y = 0; y < 24; y++) for (let x = 0; x < 80; x++) {
        const left = c[y][x], right = js[y][x];
        if (renderCell(left) !== renderCell(right)
            || left.color !== right.color || left.attr !== right.attr)
            differences.push({x, y, c: left, js: right,
                contestDifference: !!diffCell(left, right)});
    }
    return differences;
}
const rows = screen => decodeScreen(screen).map(row => row.map(renderCell).join(''));

for (const path of paths) {
const raw = readFileSync(path), native = JSON.parse(raw);
assert.equal(native.source, 'c');
assert.equal(native.version, 5);
assert.deepEqual(recordingIntegrityErrors(native), []);
for (const [index, part] of native.segments.entries()) {
    assert.equal(part.steps.length, part.moves.length + 1);
    assert.equal(part.steps[0].key, null);
    for (let step = 1; step < part.steps.length; step++)
        assert.equal(part.steps[step].key, part.moves[step - 1]);
    const run = await runSegment({...part, storage: new InMemoryStorage()});
    const output = {screens: run.getScreens(), cursors: run.getCursors(),
        calls: run.getRngLog(), slices: run.getRngSlices(),
        frames: run.getAnimationFramesByStep()};
    const expectedCalls = part.steps.flatMap(step => calls(step.rng));
    const actualCalls = calls(output.calls);
    const sliceCalls = output.slices.flatMap(slice => calls(slice));
    assert.deepEqual(sliceCalls, actualCalls, 'JS slices account for every full-stream entry');
    assert.equal(expectedCalls.length, part.steps.reduce((n, step) => n + step.rng.length, 0));
    assert.equal(actualCalls.length, output.calls.length);
    const matched = {grids: 0, contestGrids: 0, cursors: 0, slices: 0,
        frameCounts: 0, frameGrids: 0, frameCursors: 0, callPositions: 0};
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
        const contestGrid = cells.every(c => !c.contestDifference);
        matched.grids += +(cells.length === 0);
        matched.contestGrids += +contestGrid;
        matched.cursors += +cursor;
        matched.slices += +rng;
        checks.push({step, grid: cells.length === 0, contestGrid, cursor, rng, frames});
        if (cells.length || !cursor || !rng || !frames)
            differences.push({step, key: recorded.key, cellCount: cells.length,
                cellSHA256: hash(cells), cells,
                blankColorOnly: cells.length > 0 && cells.every(c => renderCell(c.c) === ' '
                    && renderCell(c.js) === ' ' && c.c.attr === c.js.attr
                    && c.c.color !== c.js.color),
                cursor, rng, frames, cCursor: recorded.cursor, jsCursor: output.cursors[step],
                cTop: rows(recorded.screen).slice(0, 3),
                jsTop: rows(output.screens[step]).slice(0, 3)});
    }
    let firstCall = null;
    for (let i = 0; i < Math.max(expectedCalls.length, actualCalls.length); i++) {
        if (expectedCalls[i] === actualCalls[i]) matched.callPositions++;
        else if (!firstCall) firstCall = {index: i,
            c: expectedCalls[i] ?? null, js: actualCalls[i] ?? null};
    }
    const fullStreamExact = same(expectedCalls, actualCalls);
    const exact = differences.length === 0 && fullStreamExact
        && output.screens.length === part.steps.length
        && output.cursors.length === part.steps.length
        && output.slices.length === part.steps.length
        && output.frames.length === part.steps.length && actualFrames === expectedFrames;
    console.log(JSON.stringify({path, segment: index, name: part.name ?? `segment-${index}`, exact, nativeSHA256: sha(raw),
        comparator: 'Canonical DEC glyph decoding plus exact color and attributes for all 1920 cells. Contest comparison is diagnostic only and never affects pass/fail.',
        expected: {boundaries: part.steps.length, calls: expectedCalls.length, frames: expectedFrames},
        actual: {boundaries: output.screens.length, cursors: output.cursors.length,
            calls: actualCalls.length, slices: output.slices.length,
            frameBoundaries: output.frames.length, frames: actualFrames},
        matched, fullStreamExact, firstCall,
        recognizedEveryRngEntry: true, discardedRngEntries: 0,
        hashes: Object.fromEntries(Object.entries(output).map(([key, value]) => [key, hash(value)])),
        firstDifference: differences[0] || null,
        firstContestDifference: differences.find(d => d.cells.some(c => c.contestDifference)) || null,
        differences, checks}));
    if (!exact) process.exitCode = 1;
}
}
