// Real keyboard inputs. Optional snapshots are read-only and checked for neutrality.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { ONAMES } from '../js/objects_data.js';
import { IRONBARS, ROOM, OBJ_INVENT } from '../js/const.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const recipePath = args[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/eating-prelude-edibility-bars.json', import.meta.url));
const recipe = JSON.parse(fs.readFileSync(recipePath));
const cases = JSON.parse(fs.readFileSync(new URL('doeat-prelude-input-cases.json', import.meta.url)));
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
                trace.push({ step, sense: game.u.uedibility || 0, food: game.u.uconduct.food || 0,
                    hunger: game.u.uhunger, terrain: game.level.at(game.u.ux, game.u.uy).typ,
                    effort: game.context.digging?.effort || 0,
                    inventory: (game.invent || []).map(obj => ({ id: obj.o_id, type: obj.otyp,
                        count: obj.quan, where: obj.where, eaten: obj.oeaten || 0,
                        proof: obj.oerodeproof || 0 })) });
            }};
        }
        const run = await runSegment({ ...part, storage });
        runs.push(structuredClone({ screens: run.getScreens(), cursors: run.getCursors(),
            rng: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep() }));
        traces.push(trace);
    }
} finally {
    if (previous)
        Object.defineProperty(globalThis, '__step_snapshot', previous);
    else
        delete globalThis.__step_snapshot;
}
if (plain) {
    fs.writeFileSync(1, JSON.stringify(runs));
    process.exit(0);
}
const unobserved = spawnSync(process.execPath,
    [fileURLToPath(import.meta.url), ...args, '--plain'],
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
    check(`case ${index} retains all five baseline negative hashes`, () =>
        assert.deepEqual(hashes[index], expected));
}
for (const [index, step, text] of cases.visible) {
    check(`JS visible witness case ${index} step ${step}`, () =>
        assert.ok(screen(runs, index, step).includes(text), text));
}
check('apple warning preserves identity, quantity and uneaten state through decline', () => {
    const before = at(0, 95), after = last(0);
    assert.equal(before.sense, 1);
    assert.equal(after.sense, 0);
    assert.equal(after.food, 0);
    assert.deepEqual(after.inventory, before.inventory);
    assert.equal(after.inventory[0].type, ONAMES.APPLE);
    assert.equal(after.inventory[0].where, OBJ_INVENT);
    assert.equal(after.inventory[0].eaten, 0);
});
check('three real bar choices preserve C effort and remove the terrain only at completion', () => {
    assert.deepEqual([at(1, 57).effort, at(1, 73).effort, at(1, 89).effort], [60, 90, 0]);
    assert.deepEqual([at(1, 57).terrain, at(1, 73).terrain, at(1, 89).terrain], [IRONBARS, IRONBARS, ROOM]);
    assert.deepEqual([at(1, 57).food, at(1, 73).food, at(1, 89).food], [0, 0, 1]);
    assert.ok(at(1, 89).hunger > at(1, 73).hunger);
});
check('rustproof warning decline preserves proof and inventory ownership', () => {
    assert.equal(at(2, 145).sense, 1);
    assert.equal(last(2).sense, 0);
    assert.equal(last(2).food, 0);
    assert.deepEqual(last(2).inventory, at(2, 145).inventory);
    assert.equal(last(2).inventory[0].proof, 1);
});
check('safe food consumes a meal but retains the one-use warning for a later apple', () => {
    assert.equal(at(4, 141).food, 1);
    assert.equal(at(4, 141).sense, 1);
    assert.equal(at(4, 142).sense, 1);
    assert.equal(last(4).sense, 0);
    assert.equal(last(4).food, 1);
    assert.deepEqual(last(4).inventory, at(4, 142).inventory);
});
check('ordinary negatives have no sense or bar consumption', () => {
    assert.equal(last(3).sense, 0);
    assert.equal(last(3).food, 1);
    assert.deepEqual(last(3).inventory, []);
    assert.equal(last(5).terrain, IRONBARS);
    assert.equal(last(5).food, 0);
});

const recording = { version: 5, source: 'js', segments: recipe.segments.map((part, index) => ({
    ...part, steps: runs[index].screens.map((screen, step) => ({ key: step ? Array.from(part.moves)[step - 1] : null,
        screen, cursor: runs[index].cursors[step], rng: runs[index].slices[step],
        animation_frames: runs[index].frames[step] })) })) };
check('recipe branch assertions match the ordinary JS results', () =>
    assert.deepEqual(branchAssertionErrors(recipe, recording), []));

if (args[1]) {
    const raw = JSON.parse(fs.readFileSync(args[1]));
    check('optional raw keeps source, version, tuples and every key', () => {
        assert.equal(raw.source, 'c');
        assert.equal(raw.version, 5);
        assert.equal(raw.segments.length, recipe.segments.length);
        for (const [index, part] of recipe.segments.entries()) {
            for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
                assert.deepEqual(raw.segments[index][key], part[key], key);
            assert.deepEqual(raw.segments[index].steps.map(step => step.key), [null, ...part.moves]);
        }
        assert.deepEqual(recordingIntegrityErrors(raw), []);
    });
    check('optional raw has the expected visible branch witnesses', () => {
        assert.deepEqual(branchAssertionErrors(recipe, raw), []);
        for (const [index, step, text] of cases.visible)
            assert.ok(decodeScreen(raw.segments[index].steps[step].screen).join('\n').includes(text), text);
    });
}
console.log(JSON.stringify({ evidence: args[1] ? 'JS ordinary input plus optional raw branch assertions'
    : 'JS ordinary input only; native C pending',
    checks, failures, observerNeutralAllFiveCollections: true,
    counts: runs.map(run => ({ boundaries: run.screens.length, calls: run.rng.length,
        frames: run.frames.reduce((sum, frames) => sum + frames.length, 0) })), hashes }, null, 4));
if (failures.length)
    process.exitCode = 1;
