// Independent C parity, including styles on blank cells and every RNG slice.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {decodeScreen, diffCell, renderCell} from '../frozen/screen-decode.mjs';
import {recordingIntegrityErrors, branchAssertionErrors} from './gen-sessions/assertions.mjs';

const read = path => readFileSync(new URL(path, import.meta.url));
const sha = value => createHash('sha256').update(value).digest('hex');
const hash = value => sha(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const raw = read('gen-sessions/generated/projectile-trap-callers.session.json');
assert.equal(raw.length, 810380);
assert.equal(sha(raw), '44da2d8ea913186adf38595e5f15e5b7f1591ab9ceac86442a080d8033d4ca7f');
const native = JSON.parse(raw);
const recipe = JSON.parse(read('gen-sessions/recipes/projectile-trap-callers.json'));
assert.equal(native.source, 'c');
assert.equal(native.version, 5);
assert.equal(native.segments.length, 4);
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(recipe, native), []);

const calls = entries => (entries || []).map(String)
    .map(s => s.replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim())
    .filter(s => /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(s));
function cellDifferences(expected, actual) {
    const c = decodeScreen(expected), js = decodeScreen(actual), differences = [];
    for (let y = 0; y < 24; y++) for (let x = 0; x < 80; x++) {
        const left = c[y][x], right = js[y][x];
        if (renderCell(left) !== renderCell(right)
            || left.color !== right.color || left.attr !== right.attr)
            differences.push({x, y, c: left, js: right, contestDifference: !!diffCell(left, right)});
    }
    return differences;
}
const rows = screen => decodeScreen(screen).map(row =>
    row.map(renderCell).join('').trimEnd());

for (const [index, part] of native.segments.entries()) {
    const proposed = recipe.segments[index];
    for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves', 'initial']) {
        assert.equal(Object.hasOwn(part, field), Object.hasOwn(proposed, field), field);
        assert.deepEqual(part[field], proposed[field], field);
    }
    assert.equal(part.steps.length, part.moves.length + 1);
    assert.equal(part.steps[0].key, null);
    for (let step = 1; step < part.steps.length; step++)
        assert.equal(part.steps[step].key, part.moves[step - 1]);

    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            const trap = g.level?.traps.find(t => t.tx === g.u.ux && t.ty === g.u.uy);
            states.push({step, hp: g.u.uhp, maxhp: g.u.uhpmax,
                mortality: g.u.umortality || 0, half: g.u.uprops?.HALF_PHDAM || 0,
                trap: trap?.ttyp || 0, once: trap?.once || 0, text: g._toplines || ''});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    // These five hashes use the unmodified JS outputs, including raw RNG logs.
    const output = {screens: run.getScreens(), cursors: run.getCursors(),
        calls: run.getRngLog(), slices: run.getRngSlices(),
        frames: run.getAnimationFramesByStep()};
    const expectedCalls = part.steps.flatMap(step => calls(step.rng));
    const actualCalls = calls(output.calls);
    const matched = {grids: 0, contestGrids: 0, cursors: 0, slices: 0, frameCounts: 0,
        frameGrids: 0, frameCursors: 0};
    let expectedFrames = 0, actualFrames = 0;
    const checks = [], differences = [];
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
        matched.contestGrids += +cells.every(c => !c.contestDifference);
        matched.cursors += +cursor;
        matched.slices += +rng;
        checks.push({step, grid: cells.length === 0, contestGrid: cells.every(c => !c.contestDifference), cursor, rng, frames});
        if (cells.length || !cursor || !rng || !frames) {
            const c = rows(recorded.screen), js = rows(output.screens[step]);
            differences.push({step, key: recorded.key, cellCount: cells.length,
                contestCellCount: cells.filter(c => c.contestDifference).length,
                contestCells: cells.filter(c => c.contestDifference).slice(0, 24),
                blankColorOnly: cells.every(c => renderCell(c.c) === ' ' && renderCell(c.js) === ' '
                    && c.c.attr === c.js.attr && c.c.color !== c.js.color),
                cells: cells.slice(0, 24), cursor, rng, frames,
                cTop: c.slice(0, 2), jsTop: js.slice(0, 2),
                cStatus: c.slice(-2), jsStatus: js.slice(-2),
                state: states.find(s => s.step === step) || null});
        }
    }
    const fullStreamExact = same(expectedCalls, actualCalls);
    const firstCall = expectedCalls.findIndex((c, i) => c !== actualCalls[i]);
    const exact = differences.length === 0 && fullStreamExact
        && output.screens.length === part.steps.length
        && output.cursors.length === part.steps.length
        && output.slices.length === part.steps.length
        && output.frames.length === part.steps.length && actualFrames === expectedFrames;
    const result = {name: part.name, exact, nativeSHA256: sha(raw),
        comparator: 'Rendered glyph plus exact color and attributes for every cell, including spaces; canonical DEC decoding, no blank-style suppression.',
        expected: {boundaries: part.steps.length, calls: expectedCalls.length, frames: expectedFrames},
        actual: {boundaries: output.screens.length, cursors: output.cursors.length,
            calls: actualCalls.length, slices: output.slices.length,
            frameBoundaries: output.frames.length, frames: actualFrames},
        matched, fullStreamExact,
        firstCall: firstCall < 0 ? null : {index: firstCall, c: expectedCalls[firstCall], js: actualCalls[firstCall]},
        hashes: Object.fromEntries(Object.entries(output).map(([k, v]) => [k, hash(v)])),
        firstDifference: differences[0] || null, differences, checks,
        hpEvents: states.filter((s, i) => i && s.hp < states[i - 1].hp),
        observations: {aliveEveryBoundary: states.every(s => s.hp > 0 && s.mortality === 0),
            final: {hp: game.u.uhp, maxhp: game.u.uhpmax, mortality: game.u.umortality || 0,
                half: game.u.uprops?.HALF_PHDAM || 0, text: game._toplines || ''}},
        nativeFinalRows: rows(part.steps.at(-1).screen).slice(-2)};
    console.log(JSON.stringify(result));
    if (!exact) process.exitCode = 1;
}
