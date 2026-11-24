// Ordinary keyboard reach and observer transparency. Native parity is separate.
// Usage: node tools/rogue-xray-priority-input-gate.mjs [input.json] [report.json]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Is_rogue_level, ROOMOFFSET, W_TOOL} from '../js/const.js';
import {ART_EYES_OF_THE_OVERWORLD} from '../js/artilist_data.js';
import {Blind} from '../js/youprop.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/rogue-xray-priority.json', import.meta.url)));
const input = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2])) : recipe;
assert.equal(input.segments.length, 3);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs = run => ({screens: run.getScreens(), cursors: run.getCursors(),
    rng: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep()});
const hashes = output => Object.fromEntries(Object.entries(output).map(([k, v]) => [k, hash(v)]));
const reports = [];
const observed = {segments: []};

for (const [index, part] of input.segments.entries()) {
    for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
        assert.equal(Object.hasOwn(part, key), Object.hasOwn(recipe.segments[index], key));
        assert.deepEqual(part[key], recipe.segments[index][key], `${part.name}: ${key}`);
    }
    if (part.steps?.length) {
        assert.equal(input.source, 'c');
        assert.equal(input.version, 5);
        assert.deepEqual(part.steps.map(s => s.key), [null, ...part.moves]);
        assert.deepEqual(recordingIntegrityErrors({segments: [part]}), []);
    }
    const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            const u = g.u, roomIndex = g.level.at(u.ux, u.uy).roomno - ROOMOFFSET;
            const room = roomIndex >= 0 ? g.level.rooms[roomIndex] : null;
            let sight = 0, beyondAdjacent = 0, xrayOnly = 0;
            for (let y = 0; y < 21; y++) for (let x = 1; x < 80; x++) {
                const bits = g.viz_array?.[y]?.[x] || 0;
                if (!(bits & 2)) continue;
                sight++;
                if (Math.max(Math.abs(x - u.ux), Math.abs(y - u.uy)) > 1)
                    beyondAdjacent++;
                if (!(bits & 1)) xrayOnly++;
            }
            states.push({step, rogue: !!Is_rogue_level(u.uz), level: {...u.uz},
                ux: u.ux, uy: u.uy, nv: u.nv_range, xray: u.xray_range,
                blind: Blind(), roomLit: !!room?.rlit,
                lightSources: (g.light_sources || []).length,
                eyes: u.ublindf?.oartifact || 0, wornMask: u.ublindf?.owornmask || 0,
                sight, beyondAdjacent, xrayOnly,
                top: g.nhDisplay.grid[0].map(c => c.ch).join('').trimEnd()});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), prior);
    const output = outputs(run), actualHashes = hashes(output);
    // Transient JS observations only, never serialized as a native fixture.
    observed.segments.push({steps: output.screens.map(screen => ({screen}))});
    const unobserved = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
    const last = states.at(-1);
    await test(`${part.name}: complete input and transparent observer`, () => {
        for (const key of ['screens', 'cursors', 'slices', 'frames'])
            assert.equal(output[key].length, part.moves.length + 1, key);
        assert.deepEqual(actualHashes, hashes(unobserved));
        assert.equal(last.nv, 1);
        assert.equal(last.blind, false);
        assert.ok(last.wornMask & W_TOOL);
    });
    await test(`${part.name}: actual producer and C branch`, () => {
        assert.equal(last.rogue, index !== 1);
        assert.equal(last.eyes, index === 2 ? 0 : ART_EYES_OF_THE_OVERWORLD);
        assert.equal(last.xray, index === 2 ? -1 : 3);
        if (index !== 1) {
            assert.equal(last.roomLit, false);
            assert.equal(last.lightSources, 0);
            assert.equal(last.beyondAdjacent, 0,
                'C Rogue dark-room vision stays adjacent even with real Eyes');
            assert.equal(last.sight, 9);
            if (index === 0) {
                assert.ok(states.some(s => s.rogue && s.xray === -1 && s.eyes === 0),
                    'Rogue arrival precedes x-ray acquisition');
                assert.ok(states.filter(s => s.rogue && s.eyes).every(s => s.beyondAdjacent === 0));
            }
        } else {
            assert.ok(last.xrayOnly > 0, 'ordinary x-ray sees through blocked geometry');
        }
    });
    const equip = part.moves.indexOf('Pa') + 2;
    const snapshots = [...new Set([equip - 1, equip, part.moves.length])].map(step => ({
        step, key: step ? part.moves[step - 1] : null, cursor: output.cursors[step],
        rows: decodeScreen(output.screens[step]).map(row => row.map(renderCell).join('')),
    }));
    reports.push({name: part.name, boundaries: output.screens.length,
        calls: output.rng.length, frames: output.frames.flat().length,
        hashes: actualHashes, boundaryScreenHashes: output.screens.map(hash), states, snapshots});
}
await test('paired recipe uses known categories and source-derived observables', () => {
    const coverage = JSON.parse(fs.readFileSync(new URL(
        'gen-sessions/coverage-requirements.json', import.meta.url)));
    const known = new Set(coverage.requirements.map(r => r.id));
    assert.ok(recipe.coverage.every(id => known.has(id)));
    assert.deepEqual(branchAssertionErrors(recipe), []);
    assert.deepEqual(branchAssertionErrors(recipe, observed), []);
});
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify({
    evidence: 'Ordinary JS reach only; no native parity claim', reports,
}, null, 2) + '\n');
