// Real keys and normal imports. Observations only read the live game state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';
import { W_AMUL } from '../js/const.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const recipePath = args[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/strangulation-form-transitions.json', import.meta.url));
const recipe = JSON.parse(fs.readFileSync(recipePath));
const cases = JSON.parse(fs.readFileSync(new URL('strangulation-transition-input-cases.json', import.meta.url)));
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
                trace.push({ step, timer: game.u.intrinsic.HStrangled || 0,
                    mask: game.u.uprops.STRANGLED || 0, form: game.u.umonnum,
                    energy: game.u.uen, amulet: game.u.uamul?.o_id || null,
                    inventory: (game.invent || []).map(obj => ({ id: obj.o_id,
                        type: obj.otyp, worn: obj.owornmask || 0 })) });
            } };
        }
        const run = await runSegment({ ...part, storage });
        runs.push({ screens: run.getScreens(), cursors: run.getCursors(),
            rng: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep() });
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
// The second game worker runs only after the observed execution has finished.
const unobserved = spawnSync(process.execPath, [fileURLToPath(import.meta.url), recipePath, '--plain'],
    { encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
assert.equal(unobserved.status, 0, unobserved.stderr || String(unobserved.error));
assert.deepEqual(runs, JSON.parse(unobserved.stdout), 'all five collections are observer-neutral');

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
const screen = (index, step) => decodeScreen(runs[index].screens[step]).join('\n');
const hashes = runs.map(run => Object.fromEntries(
    Object.entries(run).map(([key, value]) => [key, hash(value)])));
for (const [index, expected] of Object.entries(cases.negativeHashes)) {
    check(`case ${index} keeps all five original negative hashes`, () =>
        assert.deepEqual(hashes[index], expected));
}
for (const [index, step, text] of cases.visible) {
    check(`visible branch witness case ${index}, step ${step}`, () =>
        assert.ok(screen(index, step).includes(text), text));
}
check('real golem transition cancels the timer but preserves the worn identity and source', () => {
    assert.equal(at(0, 68).timer, 5);
    assert.equal(at(0, 95).timer, 0);
    assert.equal(at(0, 95).mask, W_AMUL);
    assert.equal(at(0, 95).form, PMNAMES.PM_IRON_GOLEM);
    assert.equal(at(0, 68).amulet, last(0).amulet);
    assert.equal(last(0).inventory[0].type, ONAMES.AMULET_OF_STRANGULATION);
    assert.equal(last(0).inventory[0].worn, W_AMUL);
});
check('immune wearer resumes a real countdown on becoming vulnerable', () => {
    assert.equal(at(1, 95).timer, 0);
    assert.equal(at(1, 95).mask, W_AMUL);
    assert.equal(at(1, 123).timer, 6);
    assert.equal(at(1, 123).mask, W_AMUL);
    assert.equal(at(1, 123).form, PMNAMES.PM_WOOD_NYMPH);
    assert.equal(last(1).timer, 0);
    assert.equal(last(1).amulet, null);
});
check('vulnerable transition resets three remaining turns to six', () => {
    assert.equal(at(2, 76).timer, 3);
    assert.equal(at(2, 101).timer, 6);
    assert.equal(at(2, 101).mask, W_AMUL);
    assert.equal(at(2, 101).form, PMNAMES.PM_VAMPIRE);
    assert.equal(last(2).timer, 0);
});
check('breath guard uses the real timer, preserving or spending energy in C order', () => {
    assert.equal(at(0, 95).energy, 80);
    assert.equal(at(0, 119).energy, 65);
    assert.equal(at(3, 70).timer, 30);
    assert.equal(at(3, 70).amulet, null);
    assert.equal(last(3).energy, 80);
    assert.equal(last(3).timer, 30);
});
const recording = { version: 5, source: 'js', segments: recipe.segments.map((part, index) => ({
    ...part, steps: runs[index].screens.map((cellScreen, step) => ({
        key: step ? Array.from(part.moves)[step - 1] : null,
        screen: cellScreen, cursor: runs[index].cursors[step], rng: runs[index].slices[step],
        animation_frames: runs[index].frames[step],
    })),
})) };
check('recipe assertions match actual ordinary JS output', () =>
    assert.deepEqual(branchAssertionErrors(recipe, recording), []));
if (args[1]) {
    const raw = JSON.parse(fs.readFileSync(args[1]));
    check('optional raw keeps c/v5 and every input field, presence and key', () => {
        assert.equal(raw.source, 'c');
        assert.equal(raw.version, 5);
        assert.equal(raw.segments.length, recipe.segments.length);
        for (const [index, part] of recipe.segments.entries()) {
            for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
                assert.equal(Object.hasOwn(raw.segments[index], field), Object.hasOwn(part, field));
                assert.deepEqual(raw.segments[index][field], part[field]);
            }
            assert.deepEqual(raw.segments[index].steps.map(step => step.key), [null, ...part.moves]);
        }
        assert.deepEqual(recordingIntegrityErrors(raw), []);
    });
    check('optional native visible branch witnesses', () => {
        assert.deepEqual(branchAssertionErrors(recipe, raw), []);
        for (const [index, step, text] of cases.visible)
            assert.ok(decodeScreen(raw.segments[index].steps[step].screen).join('\n').includes(text), text);
    });
}
console.log(JSON.stringify({ evidence: args[1] ? 'JS plus optional native visible witnesses'
    : 'ordinary JS input only; fresh C pending', checks, failures,
    observerNeutralAllFiveCollections: true,
    counts: runs.map(run => ({ boundaries: run.screens.length, calls: run.rng.length,
        frames: run.frames.reduce((sum, frames) => sum + frames.length, 0) })), hashes }, null, 4));
if (failures.length)
    process.exitCode = 1;
