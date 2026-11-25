// Real keyboard commands. Optional observations must leave all five outputs unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { ONAMES, MATERIALS } from '../js/objects_data.js';
import { W_ARMH, W_ARMF, W_RINGL, W_TOOL, OBJ_INVENT } from '../js/const.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const recipePath = args[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/accessory-wear-owner.json', import.meta.url));
const recipe = JSON.parse(fs.readFileSync(recipePath));
const cases = JSON.parse(fs.readFileSync(new URL('accessory-wear-owner-input-cases.json', import.meta.url)));
const plain = process.argv.includes('--plain');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
const runs = [], traces = [];
try {
    const storage = new InMemoryStorage();
    for (const part of recipe.segments) {
        const trace = [];
        if (!plain) {
            globalThis.__step_snapshot = { step: '*', cb(game, step) {
                trace.push({ step, water: game.u.uinwater || 0, wasinwater: game.wasinwater || 0,
                    level: { ...game.u.uz }, quest: { ...game.qstart_level },
                    worn: Object.fromEntries(['uwep', 'uarmh', 'uarmf', 'uleft', 'ublindf']
                        .map(slot => [slot, game.u[slot]?.o_id || null])),
                    after: game.afternmv?.name || null,
                    inventory: (game.invent || []).map(obj => ({ id: obj.o_id, type: obj.otyp,
                        count: obj.quan, where: obj.where, worn: obj.owornmask || 0,
                        artifact: obj.oartifact || 0, material: game.objects[obj.otyp].oc_material,
                        discovered: !!game.objects[obj.otyp].oc_name_known })) });
            } };
        }
        const run = await runSegment({ ...part, storage });
        runs.push({ screens: run.getScreens(), cursors: run.getCursors(), rng: run.getRngLog(),
            slices: run.getRngSlices(), frames: run.getAnimationFramesByStep() });
        traces.push(trace);
    }
} finally {
    if (previous)
        Object.defineProperty(globalThis, '__step_snapshot', previous);
    else
        delete globalThis.__step_snapshot;
}
if (plain) {
    await new Promise(resolve => process.stdout.write(JSON.stringify(runs), resolve));
    process.exit(0);
}
const unobserved = spawnSync(process.execPath, [fileURLToPath(import.meta.url), recipePath, '--plain'],
    { encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
assert.equal(unobserved.status, 0, unobserved.stderr || String(unobserved.error));
assert.deepEqual(runs, JSON.parse(unobserved.stdout), 'all five collections are observation-neutral');
const checks = [], failures = [];
function check(name, operation) {
    try {
        operation();
        checks.push(name);
    } catch (error) {
        failures.push({ name, error: error.message });
    }
}
const at = (index, step) => traces[index].find(state => state.step === step);
const last = index => traces[index].at(-1);
const screen = (collection, index, step) => decodeScreen(collection[index].screens[step]).join('\n');
const hashes = runs.map(run => Object.fromEntries(Object.entries(run).map(([key, value]) => [key, hash(value)])));
for (const [index, expected] of Object.entries(cases.negativeHashes)) {
    check(`case ${index} retains all five original negative hashes`, () =>
        assert.deepEqual(hashes[index], expected));
}
for (const [index, step, text] of cases.visible) {
    check(`JS visible witness case ${index} step ${step}`, () =>
        assert.ok(screen(runs, index, step).includes(text), text));
}
check('wielded helmet keeps identity but releases the actual weapon owner', () => {
    assert.equal(at(0, 27).worn.uwep, last(0).inventory[0].id);
    assert.equal(last(0).worn.uwep, null);
    assert.equal(last(0).inventory[0].worn, W_ARMH);
    assert.equal(last(0).inventory[0].where, OBJ_INVENT);
});
check('silver contact rejection preserves the carried ring, human negative wears it', () => {
    assert.equal(last(1).inventory[0].material, MATERIALS.SILVER);
    assert.equal(last(1).inventory[0].worn, 0);
    assert.equal(last(1).inventory[0].where, OBJ_INVENT);
    assert.equal(last(2).inventory[0].material, MATERIALS.SILVER);
    assert.equal(last(2).inventory[0].worn, W_RINGL);
});
check('headless and conflicting eyewear retain the selected and already-worn owners', () => {
    assert.equal(last(3).inventory[0].type, ONAMES.LENSES);
    assert.equal(last(3).inventory[0].worn, 0);
    assert.equal(last(4).inventory[0].worn, 0);
    assert.equal(last(4).inventory[1].type, ONAMES.LENSES);
    assert.equal(last(4).inventory[1].worn, W_TOOL);
});
check('sink removes the ring before the subsequent inventory command', () => {
    assert.equal(last(5).inventory[0].type, ONAMES.RIN_LEVITATION);
    assert.equal(last(5).inventory[0].where, OBJ_INVENT);
    assert.equal(last(5).inventory[0].worn, 0);
    assert.equal(last(5).worn.uleft, null);
});
check('real quest arrival identifies and refuses the helm without wearing it', () => {
    assert.equal(last(7).level.dnum, last(7).quest.dnum);
    assert.equal(last(7).inventory[0].type, ONAMES.HELM_OF_OPPOSITE_ALIGNMENT);
    assert.equal(last(7).inventory[0].worn, 0);
    assert.equal(last(7).inventory[0].discovered, true);
});
check('later artifact contact is distinct from the setup wish blast', () => {
    assert.ok(screen(runs, 8, 51).includes('blasted by'));
    assert.ok(screen(runs, 8, 60).includes('blasted by'));
    assert.ok(last(8).inventory[0].artifact);
    assert.equal(last(8).inventory[0].worn, W_TOOL);
});
check('water latch survives rising until real Boots_on completes discovery', () => {
    assert.equal(at(9, 91).water, 1);
    assert.equal(at(9, 92).water, 0);
    assert.equal(at(9, 92).wasinwater, 1);
    assert.equal(at(9, 92).after, 'Boots_on');
    assert.equal(at(9, 92).inventory[0].discovered, false);
    assert.equal(last(9).wasinwater, 0);
    assert.equal(last(9).inventory[0].type, ONAMES.WATER_WALKING_BOOTS);
    assert.equal(last(9).inventory[0].worn, W_ARMF);
    assert.equal(last(9).inventory[0].discovered, true);
});
const recording = { version: 5, source: 'js', segments: recipe.segments.map((part, index) => ({
    ...part, steps: runs[index].screens.map((screen, step) => ({ key: step ? Array.from(part.moves)[step - 1] : null,
        screen, cursor: runs[index].cursors[step], rng: runs[index].slices[step],
        animation_frames: runs[index].frames[step] })) })) };
check('recipe branch assertions match ordinary JS output', () =>
    assert.deepEqual(branchAssertionErrors(recipe, recording), []));
if (args[1]) {
    const raw = JSON.parse(fs.readFileSync(args[1]));
    check('optional raw retains c/v5 and every original input tuple/key', () => {
        assert.equal(raw.source, 'c');
        assert.equal(raw.version, 5);
        assert.equal(raw.segments.length, recipe.segments.length);
        for (const [index, part] of recipe.segments.entries()) {
            for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
                assert.equal(Object.hasOwn(raw.segments[index], key), Object.hasOwn(part, key), key);
                assert.deepEqual(raw.segments[index][key], part[key], key);
            }
            assert.deepEqual(raw.segments[index].steps.map(step => step.key), [null, ...part.moves]);
        }
        assert.deepEqual(recordingIntegrityErrors(raw), []);
    });
    check('optional raw shows the later contact and other explicit branch witnesses', () => {
        assert.deepEqual(branchAssertionErrors(recipe, raw), []);
        for (const [index, step, text] of cases.visible)
            assert.ok(decodeScreen(raw.segments[index].steps[step].screen).join('\n').includes(text), text);
    });
}
console.log(JSON.stringify({ evidence: args[1] ? 'JS ordinary input plus optional native visible assertions'
    : 'JS ordinary input only; native C pending', checks, failures,
    observerNeutralAllFiveCollections: true,
    counts: runs.map(run => ({ boundaries: run.screens.length, calls: run.rng.length,
        frames: run.frames.reduce((sum, frames) => sum + frames.length, 0) })), hashes }, null, 4));
if (failures.length)
    process.exitCode = 1;
