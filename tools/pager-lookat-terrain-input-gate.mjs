// Ordinary input reach and observation neutrality; strict C parity has its own gate.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {is_drawbridge_wall} from '../js/dbridge.js';
import {Is_airlevel, CLOUD, DOOR} from '../js/const.js';
import {cmap_names as CM} from '../js/drawing_data.js';
import {branchAssertionErrors} from './gen-sessions/assertions.mjs';

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/pager-lookat-terrain.json', import.meta.url)));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs = run => ({screens: run.getScreens(), cursors: run.getCursors(),
    calls: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep()});

test('recipe has four explicit, asserted ordinary input cases', () => {
    assert.equal(recipe.name, 'pager-lookat-terrain');
    assert.equal(recipe.segments.length, 4);
    assert.equal(recipe.branchAssertions.length, 4);
    assert.ok(recipe.segments.every(s => typeof s.moves === 'string' && !Object.hasOwn(s, 'steps')));
});

for (const [index, part] of recipe.segments.entries())
test(part.name, async () => {
    const expected = recipe.jsReach[index], states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            const {x, y} = expected.target, loc = g.level.at(x, y);
            states.push({step, text: g._toplines || '', x: g.u.ux, y: g.u.uy,
                hp: g.u.uhp, mortality: g.u.umortality || 0,
                air: Is_airlevel(g.u.uz), typ: loc.typ,
                glyph: structuredClone(loc.disp_glyph),
                bridgeDirection: is_drawbridge_wall(x, y)});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    const output = outputs(run);
    assert.equal(output.screens.length, expected.boundaries);
    const witness = states.find(s => s.text.includes(`(${expected.description})`));
    assert.ok(witness, expected.description);
    assert.ok(witness.x !== expected.target.x || witness.y !== expected.target.y);
    assert.ok(states.every(s => s.hp > 0 && s.mortality === 0));
    if (index === 0 || index === 2) {
        assert.equal(witness.typ, DOOR);
        assert.equal(witness.glyph.cmap, CM.S_ndoor);
        assert.equal(witness.bridgeDirection >= 0, index === 0);
    } else {
        assert.equal(witness.typ, CLOUD);
        assert.equal(witness.glyph.cmap, CM.S_cloud);
        assert.equal(witness.air, index === 1);
    }
    const observed = {source: 'js', version: 5, segments: [{...part,
        steps: output.screens.map((screen, i) => ({screen, cursor: output.cursors[i],
            key: i ? part.moves[i - 1] : null, rng: output.slices[i],
            animation_frames: output.frames[i]}))}]};
    const assertion = {...recipe.branchAssertions[index], segment: 0};
    assert.deepEqual(branchAssertionErrors({...recipe, branches: [assertion.branch],
        branchAssertions: [assertion]}, observed), []);
    const unobserved = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
    const hashes = Object.fromEntries(Object.entries(output).map(([key, value]) => [key, hash(value)]));
    assert.deepEqual(hashes, Object.fromEntries(Object.entries(unobserved).map(([key, value]) => [key, hash(value)])));
    console.log(JSON.stringify({name: part.name, witness, boundaries: output.screens.length,
        calls: output.calls.length, frames: output.frames.flat().length,
        observationAllFiveHashesUnchanged: true, hashes, nativeParity: 'checked separately by pager-lookat-terrain-native-gate.mjs'}));
});
