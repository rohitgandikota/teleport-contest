// Actual keyboard inputs and read-only snapshots. No runtime overrides.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { ART_EXCALIBUR } from '../js/artilist_data.js';
import { OBJ_INVENT, OBJ_FLOOR, FROMOUTSIDE } from '../js/const.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const recipePath = args[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/accepted-nonfood-meals.json', import.meta.url));
const rawPath = args[1];
const plain = process.argv.includes('--plain');
const recipe = JSON.parse(fs.readFileSync(recipePath));
const runs = [], traces = [];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
try {
    const storage = new InMemoryStorage();
    for (const part of recipe.segments) {
        const trace = [];
        if (!plain) {
            globalThis.__step_snapshot = { step: '*', cb(game, step) {
                const record = obj => ({ id: obj.o_id, type: obj.otyp, count: obj.quan,
                    where: obj.where, proof: obj.oerodeproof || 0, eaten: obj.oeaten || 0,
                    artifact: obj.oartifact || 0 });
                trace.push({ step, turn: game.moves, form: game.u.umonnum,
                    canonicalForm: game.youmonst.data === game.mons[game.u.umonnum],
                    food: game.u.uconduct.food || 0, hunger: game.u.uhunger,
                    meal: game.context.victual?.piece?.o_id || null,
                    sleep: game.u.intrinsic?.HSleep_resistance || 0,
                    inventory: (game.invent || []).map(record),
                    floor: game.level.objects.filter(obj => obj.ox === game.u.ux && obj.oy === game.u.uy).map(record),
                });
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
assert.deepEqual(runs, JSON.parse(unobserved.stdout), 'observation preserves all five output collections');
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
function visibleChecks(collection, label) {
    const witnesses = [
        [0, 69, /This dagger is delicious!/],
        [0, 84, /a - a dagger/],
        [1, 83, /This trident is delicious!.*That was pure chewing satisfaction!/],
        [2, 80, /This gold is delicious!/],
        [2, 110, /Your wallet is empty/],
        [3, 87, /Ulch - that dagger was rustproofed!/],
        [3, 88, /spit the dagger out onto the stairs/],
        [4, 79, /This ring is indigestible!.*Blecch!  Awful metal!/],
        [4, 94, /a - an engagement ring/],
        [5, 89, /Yuck!/],
        [5, 104, /Not carrying anything/],
        [6, 88, /Magic spreads through your body as you digest the ring/],
        [6, 103, /You are sleep resistant intrinsically/],
        [7, 102, /You cannot eat that!/],
        [8, 107, /You cannot eat that!/],
        [9, 69, /This long sword named Excalibur is delicious!/],
        [9, 84, /Not carrying anything/],
    ];
    for (const [index, step, pattern] of witnesses)
        check(`${label} visible witness case ${index} step ${step}`, () =>
            assert.match(screen(collection, index, step), pattern));
}
visibleChecks(runs, 'JS');
check('carried stack survives by identity, with one item consumed in the accepted command', () => {
    const before = at(0, 68), after = at(0, 69);
    assert.equal(before.form, PMNAMES.PM_XORN);
    assert.equal(before.canonicalForm, true);
    assert.equal(before.inventory[0].count, 2);
    assert.equal(after.inventory[0].id, before.inventory[0].id);
    assert.equal(after.inventory[0].count, 1);
    assert.equal(after.inventory[0].eaten, 0);
    assert.equal(after.inventory[0].where, OBJ_INVENT);
    assert.equal(after.food, 1);
    assert.equal(after.meal, null);
});
check('floor trident and gold are consumed, with no inventory relocation', () => {
    for (const index of [1, 2]) {
        assert.equal(last(index).form, PMNAMES.PM_XORN);
        assert.equal(last(index).food, 1);
        assert.equal(last(index).meal, null);
        assert.deepEqual(last(index).inventory, []);
        assert.deepEqual(last(index).floor, []);
    }
});
check('rustproof stack splits once, preserves its original and drops the stripped child', () => {
    const before = at(3, 86), after = last(3);
    assert.equal(after.form, PMNAMES.PM_RUST_MONSTER);
    assert.equal(after.food, 0);
    assert.equal(after.inventory[0].id, before.inventory[0].id);
    assert.equal(after.inventory[0].proof, 1);
    assert.equal(after.inventory[0].count, 1);
    assert.equal(after.floor.length, 1);
    assert.notEqual(after.floor[0].id, before.inventory[0].id);
    assert.equal(after.floor[0].proof, 0);
    assert.equal(after.floor[0].count, 1);
    assert.equal(after.floor[0].where, OBJ_FLOOR);
});
check('indigestible ring remains the same owned object without food conduct', () => {
    assert.equal(last(4).form, PMNAMES.PM_XORN);
    assert.deepEqual(last(4).inventory, at(4, 78).inventory);
    assert.equal(last(4).inventory[0].type, ONAMES.RIN_SLOW_DIGESTION);
    assert.equal(last(4).food, 0);
    assert.equal(last(4).meal, null);
});
check('fire elemental consumes the paper through the accepted owner', () => {
    assert.equal(last(5).form, PMNAMES.PM_FIRE_ELEMENTAL);
    assert.equal(last(5).canonicalForm, true);
    assert.equal(last(5).food, 1);
    assert.deepEqual(last(5).inventory, []);
});
check('free-action ring keeps the form bit while adding sleep resistance after More', () => {
    const before = at(6, 86), pending = at(6, 87), after = at(6, 88);
    assert.equal(before.form, PMNAMES.PM_GELATINOUS_CUBE);
    assert.equal(before.sleep & FROMOUTSIDE, 0);
    assert.equal(pending.sleep, before.sleep);
    assert.equal(pending.inventory[0].id, before.inventory[0].id);
    assert.equal(pending.food, 1);
    assert.equal(after.sleep, before.sleep | FROMOUTSIDE);
    assert.deepEqual(after.inventory, []);
    assert.equal(after.meal, null);
});
for (const [index, form] of [[7, PMNAMES.PM_XORN], [8, PMNAMES.PM_GELATINOUS_CUBE]]) {
    check(`ordinary material negative ${index} retains both items and conduct`, () => {
        assert.equal(last(index).form, form);
        assert.equal(last(index).canonicalForm, true);
        assert.equal(last(index).food, 0);
        assert.equal(last(index).inventory.length, 2);
        assert.ok(last(index).inventory.every(obj => obj.count === 1 && obj.eaten === 0));
    });
}
check('accepted Excalibur is the actual artifact and is gone after the later eat command', () => {
    assert.equal(at(9, 68).inventory[0].artifact, ART_EXCALIBUR);
    assert.equal(at(9, 68).form, PMNAMES.PM_XORN);
    assert.equal(at(9, 69).food, 1);
    assert.deepEqual(at(9, 69).inventory, []);
    assert.equal(at(9, 69).meal, null);
});
check('registered branch assertions describe actual JS output', () => {
    const registry = JSON.parse(fs.readFileSync(new URL(
        'gen-sessions/branch-requirements.json', import.meta.url)));
    const coverage = JSON.parse(fs.readFileSync(new URL(
        'gen-sessions/coverage-requirements.json', import.meta.url)));
    assert.ok(recipe.branches.every(id => registry.requirements.some(row => row.id === id)));
    assert.ok(recipe.coverage.every(id => coverage.requirements.some(row => row.id === id)));
    assert.deepEqual(branchAssertionErrors(recipe), []);
    assert.deepEqual(branchAssertionErrors(recipe, { segments: runs.map(run => ({
        steps: run.screens.map((screen, i) => ({ screen, rng: run.slices[i] })),
    })) }), []);
});
let native = null;
if (rawPath) {
    const bytes = fs.readFileSync(rawPath);
    const raw = JSON.parse(bytes);
    check('raw provenance preserves source, format, all input fields and every key', () => {
        assert.equal(raw.source, 'c');
        assert.equal(raw.version, 5);
        assert.deepEqual(recordingIntegrityErrors(raw), []);
        assert.equal(raw.segments.length, recipe.segments.length);
        for (const [index, part] of raw.segments.entries()) {
            for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
                assert.equal(Object.hasOwn(part, key), Object.hasOwn(recipe.segments[index], key));
                assert.deepEqual(part[key], recipe.segments[index][key]);
            }
            assert.deepEqual(part.steps.map(step => step.key), [null, ...part.moves]);
        }
        assert.deepEqual(branchAssertionErrors(recipe, raw), []);
    });
    visibleChecks(raw.segments.map(part => ({ screens: part.steps.map(step => step.screen) })), 'C');
    native = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
}
console.log(JSON.stringify({ evidence: native ? 'ordinary JS state and optional native visible/input checks'
    : 'ordinary JS state only; native confirmation pending',
    passed: checks.length, total: checks.length + failures.length, checks, failures,
    observationNeutrality: { completeFiveCollectionsEqual: true }, native,
    segments: runs.map((run, i) => ({ name: recipe.segments[i].name,
        boundaries: run.screens.length, calls: run.rng.length, frames: run.frames.flat().length,
        hashes: Object.fromEntries(Object.entries(run).map(([key, value]) => [key, hash(value)])) })),
    limits: ['Only the free-action effect case is an ordinary accessory-effect witness here.',
        'Other accessory branches, vault witness, glass/potion/flint and integer boundaries are constructed source controls.',
        'This gate does not replace a strict complete native output comparison.'] }, null, 4));
process.exitCode = failures.length ? 1 : 0;
