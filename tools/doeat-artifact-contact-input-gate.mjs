// Actual keyboard inputs, normal imports and read-only observations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { PMNAMES } from '../js/monst_data.js';
import { ART_MASTER_KEY_OF_THIEVERY, ART_TSURUGI_OF_MURAMASA } from '../js/artilist_data.js';
import { OBJ_FLOOR, OBJ_INVENT, A_LAWFUL, A_CHAOTIC } from '../js/const.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const recipePath = args[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/doeat-artifact-contact.json', import.meta.url));
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
                const inventory = game.invent || [];
                const floor = game.level.objects;
                const artifacts = [...inventory, ...floor]
                    .filter(obj => obj.oartifact)
                    .map(obj => ({
                        id: obj.o_id, artifact: obj.oartifact, where: obj.where,
                        worn: obj.owornmask || 0, eaten: obj.oeaten || 0,
                        count: obj.quan, letter: obj.invlet,
                        inHero: inventory.includes(obj), onFloor: floor.includes(obj),
                    }));
                trace.push({
                    step, turn: game.moves, alignment: game.u.ualign.type,
                    xorn: game.u.umonnum === PMNAMES.PM_XORN,
                    canonicalForm: game.youmonst.data === game.mons[game.u.umonnum],
                    heroHP: game.u.uhp, formHP: game.u.mh ?? null,
                    foodConduct: game.u.uconduct.food || 0,
                    mealId: game.context.victual?.piece?.o_id ?? null,
                    weaponId: game.u.uwep?.o_id ?? null, artifacts,
                });
            }};
        }
        const run = await runSegment({ ...part, storage });
        runs.push(structuredClone({
            screens: run.getScreens(), cursors: run.getCursors(),
            rng: run.getRngLog(), slices: run.getRngSlices(),
            frames: run.getAnimationFramesByStep(),
        }));
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

// The observed replay finishes before this unobserved worker starts.
const unobserved = spawnSync(process.execPath,
    [fileURLToPath(import.meta.url), ...args, '--plain'],
    { encoding: 'utf8', timeout: 30000, maxBuffer: 24 * 1024 * 1024 });
assert.equal(unobserved.status, 0, unobserved.stderr || String(unobserved.error));
assert.deepEqual(runs, JSON.parse(unobserved.stdout), 'observation preserves all five collections');

const checks = [], failures = [];
function check(name, operation) {
    try {
        operation();
        checks.push(name);
    } catch (error) {
        failures.push({ name, error: error.message });
    }
}
const at = (segment, step) => traces[segment].find(state => state.step === step);
const artifact = (state, number) => state.artifacts.find(obj => obj.artifact === number);
const screen = (run, step) => decodeScreen(run.screens[step]).join('\n');
function visibleChecks(collection, label) {
    check(`${label}: floor contact has its own later blast and refusal`, () => {
        assert.match(screen(collection[0], 127), /here; eat it\?/);
        assert.match(screen(collection[0], 128), /You are blasted by/);
        assert.match(screen(collection[0], 129), /Master Key of Thievery evades your grasp/);
        assert.match(screen(collection[0], 144), /You see here a key named the Master Key/);
    });
    check(`${label}: carried contact refuses after alignment and polymorph setup`, () => {
        assert.match(screen(collection[1], 159), /Your mind oscillates briefly/);
        assert.match(screen(collection[1], 203), /You turn into a xorn!/);
        assert.match(screen(collection[1], 233), /What do you want to eat\?/);
        assert.match(screen(collection[1], 234), /You are blasted by/);
        assert.match(screen(collection[1], 235), /Tsurugi of Muramasa is beyond your control/);
        assert.match(screen(collection[1], 249), /a - a long samurai sword named the Tsurugi/);
    });
    check(`${label}: declining the floor item has no second contact`, () => {
        assert.match(screen(collection[2], 127), /here; eat it\?/);
        const after = collection[2].screens.slice(128).map(value => decodeScreen(value).join('\n')).join('\n');
        assert.doesNotMatch(after, /blasted|evades your grasp|delicious/);
        assert.match(screen(collection[2], 144), /You see here a key named the Master Key/);
    });
    check(`${label}: ordinary food and explicit nonedible selection retain their routes`, () => {
        assert.match(screen(collection[3], 33), /Delicious!/);
        assert.match(screen(collection[3], 48), /Not carrying anything/);
        assert.match(screen(collection[4], 70), /You cannot eat that!/);
        for (const segment of [3, 4]) {
            const text = collection[segment].screens.map(value => decodeScreen(value).join('\n')).join('\n');
            assert.doesNotMatch(text, /blasted|evades your grasp|beyond your control/);
        }
    });
}
visibleChecks(runs, 'JS');
check('floor wish leaves the same real artifact for the later edible selection', () => {
    const setup = artifact(at(0, 84), ART_MASTER_KEY_OF_THIEVERY);
    const selected = artifact(at(0, 127), ART_MASTER_KEY_OF_THIEVERY);
    assert.equal(selected.id, setup.id);
    assert.equal(selected.where, OBJ_FLOOR);
    assert.equal(selected.onFloor, true);
    assert.equal(selected.inHero, false);
    assert.equal(at(0, 127).xorn, true);
    assert.equal(at(0, 127).canonicalForm, true);
});
check('carried quest sword survives the real helm transition while inactive', () => {
    const setup = artifact(at(1, 107), ART_TSURUGI_OF_MURAMASA);
    const changed = artifact(at(1, 173), ART_TSURUGI_OF_MURAMASA);
    const selected = artifact(at(1, 233), ART_TSURUGI_OF_MURAMASA);
    assert.equal(at(1, 107).alignment, A_LAWFUL);
    assert.equal(at(1, 173).alignment, A_CHAOTIC);
    assert.equal(at(1, 233).alignment, A_CHAOTIC);
    assert.equal(selected.id, setup.id);
    assert.equal(changed.id, setup.id);
    assert.equal(selected.where, OBJ_INVENT);
    assert.equal(selected.worn, 0);
    assert.equal(at(1, 233).weaponId, null);
    assert.equal(at(1, 233).xorn, true);
    assert.equal(at(1, 233).canonicalForm, true);
});
// C allmain.c:205-390 spends movement credit; one command can advance
// more than one world turn for a speed-9 xorn. These inputs advance two and one.
for (const [segment, selectedStep, artifactNumber, damage, worldTurns] of [
    [0, 127, ART_MASTER_KEY_OF_THIEVERY, 15, 2],
    [1, 233, ART_TSURUGI_OF_MURAMASA, 20, 1],
]) {
    check(`case ${segment}: completed contact costs time without consuming or relocating the object`, () => {
        const before = at(segment, selectedStep), after = traces[segment].at(-1);
        assert.deepEqual(artifact(after, artifactNumber), artifact(before, artifactNumber));
        assert.equal(after.formHP, before.formHP - damage);
        assert.equal(after.heroHP, before.heroHP);
        assert.equal(after.foodConduct, before.foodConduct);
        assert.equal(after.mealId, null);
        assert.equal(after.turn, before.turn + worldTurns);
    });
}
check('decline keeps HP, ownership and conduct unchanged', () => {
    const before = at(2, 127), after = traces[2].at(-1);
    assert.deepEqual(after.artifacts, before.artifacts);
    assert.equal(after.formHP, before.formHP);
    assert.equal(after.heroHP, before.heroHP);
    assert.equal(after.foodConduct, before.foodConduct);
    assert.equal(after.turn, before.turn);
});
check('ordinary food advances food conduct and a nonedible key does not', () => {
    assert.equal(traces[3].at(-1).foodConduct, 1);
    assert.equal(traces[4].at(-1).foodConduct, 0);
    assert.equal(traces[4].at(-1).turn, traces[4][0].turn);
});
check('all ordinary recipe assertions hold', () => {
    assert.deepEqual(branchAssertionErrors(recipe, { segments: runs.map(run => ({
        steps: run.screens.map((value, step) => ({ screen: value, rng: run.slices[step] })),
    })) }), []);
});

let native = null;
if (rawPath) {
    const bytes = fs.readFileSync(rawPath);
    const raw = JSON.parse(bytes);
    assert.equal(raw.source, 'c');
    assert.equal(raw.version, 5);
    assert.deepEqual(recordingIntegrityErrors(raw), []);
    assert.equal(raw.segments.length, recipe.segments.length);
    for (const [index, part] of raw.segments.entries()) {
        for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
            assert.equal(Object.hasOwn(part, key), Object.hasOwn(recipe.segments[index], key));
            assert.deepEqual(part[key], recipe.segments[index][key]);
        }
        assert.equal(part.steps.length, part.moves.length + 1);
        assert.equal(part.steps[0].key, null);
        for (let step = 1; step < part.steps.length; step++)
            assert.equal(part.steps[step].key, part.moves[step - 1]);
    }
    visibleChecks(raw.segments.map(part => ({ screens: part.steps.map(step => step.screen) })), 'C');
    check('all native recipe assertions hold', () => {
        assert.deepEqual(branchAssertionErrors(recipe, raw), []);
    });
    native = {
        sha256: createHash('sha256').update(bytes).digest('hex'),
        scope: 'actual tuples, keys and visible witnesses; strict output comparison is separate',
    };
}
console.log(JSON.stringify({
    evidence: 'ordinary JS input; optional unchanged native witnesses',
    passed: checks.length, total: checks.length + failures.length,
    checks, failures, observationsNeutral: true, native,
    segments: runs.map((run, segment) => ({
        segment, first: traces[segment][0], last: traces[segment].at(-1),
        hashes: Object.fromEntries(Object.entries(run).map(([key, value]) => [key, hash(value)])),
        boundaries: run.screens.length, calls: run.rng.length,
        frames: run.frames.flat().length,
    })),
}, null, 4));
process.exitCode = failures.length ? 1 : 0;
