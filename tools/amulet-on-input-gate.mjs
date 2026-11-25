// Normal imports and real keyboard commands. Observations only read live state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';
import { ONAMES } from '../js/objects_data.js';
import { W_AMUL } from '../js/const.js';

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const recipePath = args[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/amulet-on-owner.json', import.meta.url));
const recipe = JSON.parse(fs.readFileSync(recipePath));
const cases = JSON.parse(fs.readFileSync(new URL('amulet-on-input-cases.json', import.meta.url)));
const plain = process.argv.includes('--plain');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const runs = [], traces = [];
const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
try {
    const storage = new InMemoryStorage();
    for (const part of recipe.segments) {
        const trace = [];
        if (!plain) {
            globalThis.__step_snapshot = { step: '*', cb(game, step) {
                trace.push({ step, slimed: game.u.uprops.SLIMED || 0,
                    sleepy: game.u.intrinsic.HSleepy || 0,
                    female: !!game.flags.female, baseFemale: !!game.u.mfemale,
                    amulet: game.u.uamul?.o_id || null,
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
// Runs sequentially after observed execution, never two game workers together.
const unobserved = spawnSync(process.execPath, [fileURLToPath(import.meta.url), recipePath, '--plain'],
    { encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
assert.equal(unobserved.status, 0, unobserved.stderr || String(unobserved.error));
assert.deepEqual(runs, JSON.parse(unobserved.stdout), 'all five outputs are observer-neutral');

const checks = [];
function check(name, operation) {
    operation();
    checks.push(name);
}
const at = (index, step) => traces[index].find(state => state.step === step);
const last = index => traces[index].at(-1);
const screen = (index, step) => decodeScreen(runs[index].screens[step]).join('\n');
const hashes = runs.map(run => Object.fromEntries(
    Object.entries(run).map(([key, value]) => [key, hash(value)])));
for (const [index, expected] of Object.entries(cases.unchangedBaselineHashes)) {
    check(`case ${index} retains all five baseline hashes`, () =>
        assert.deepEqual(hashes[index], expected));
}
for (const [index, step, text] of cases.visible) {
    check(`ordinary visible case ${index}, step ${step}`, () =>
        assert.ok(screen(index, step).includes(text), text));
}
check('real sliming exists before wearing and disappears at the wearing boundary', () => {
    assert.equal(at(0, 60).slimed, 30);
    assert.equal(at(0, 60).amulet, null);
    assert.equal(at(0, 66).slimed, 0);
    assert.equal(at(0, 66).inventory[0].type, ONAMES.AMULET_OF_UNCHANGING);
    assert.equal(at(0, 66).inventory[0].worn, W_AMUL);
    assert.ok(screen(0, 57).includes('Slime'));
    assert.ok(!screen(0, 66).includes('Slime'));
});
check('healthy unchanging and reflection controls keep actual object identity', () => {
    assert.equal(last(1).slimed, 0);
    assert.equal(last(1).inventory[0].worn, W_AMUL);
    assert.equal(at(5, 41).amulet, last(5).inventory[0].id);
    assert.equal(last(5).inventory[0].type, ONAMES.AMULET_OF_REFLECTION);
    assert.equal(last(5).inventory[0].worn, 0);
});
check('both change paths consume only after real messages and naming input', () => {
    assert.equal(at(2, 37).female, true);
    assert.ok(at(2, 37).amulet);
    assert.equal(last(2).inventory.length, 0);
    assert.ok(at(3, 67).amulet);
    assert.equal(at(3, 67).female, true);
    assert.equal(at(3, 67).baseFemale, true);
    assert.equal(last(3).inventory.length, 0);
    assert.equal(last(3).amulet, null);
});
check('fresh sleep timeout is active while worn and removed with its only source', () => {
    assert.equal(at(4, 43).sleepy, 0);
    assert.equal(at(4, 44).sleepy, 45);
    assert.equal(at(4, 44).inventory[0].type, ONAMES.AMULET_OF_RESTFUL_SLEEP);
    assert.equal(last(4).sleepy, 0);
    assert.equal(last(4).amulet, null);
});
const recording = { source: 'js', version: 5, segments: recipe.segments.map((part, index) => ({
    ...part, steps: runs[index].screens.map((cellScreen, step) => ({
        key: step ? Array.from(part.moves)[step - 1] : null,
        screen: cellScreen, cursor: runs[index].cursors[step], rng: runs[index].slices[step],
        animation_frames: runs[index].frames[step],
    })),
})) };
check('recipe assertions match ordinary JS output', () =>
    assert.deepEqual(branchAssertionErrors(recipe, recording), []));
if (args[1]) {
    const raw = JSON.parse(fs.readFileSync(args[1]));
    check('optional raw is c/v5 with identical input fields, presence and keys', () => {
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
    check('optional native visible witnesses, without any private-state native claim', () => {
        assert.deepEqual(branchAssertionErrors(recipe, raw), []);
        for (const [index, step, text] of cases.visible)
            assert.ok(decodeScreen(raw.segments[index].steps[step].screen).join('\n').includes(text), text);
        assert.ok(decodeScreen(raw.segments[0].steps[57].screen).join('\n').includes('Slime'));
        assert.ok(!decodeScreen(raw.segments[0].steps[66].screen).join('\n').includes('Slime'));
    });
}
console.log(JSON.stringify({ evidence: args[1] ? 'JS plus optional C visible assertions'
    : 'ordinary JS only; fresh C pending', checks, observerNeutralAllFive: true,
    counts: runs.map(run => ({ boundaries: run.screens.length, calls: run.rng.length,
        frames: run.frames.reduce((sum, frames) => sum + frames.length, 0) })), hashes }, null, 4));
