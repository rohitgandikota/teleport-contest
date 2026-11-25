// Actual keys, normal imports, read-only observations and all-five output equality.
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
import { PMNAMES } from '../js/monst_data.js';
import { G_GENOD, I_SPECIAL, TIMEOUT, M_AP_OBJECT, W_ARMG, W_RINGL } from '../js/const.js';

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const recipePath = args[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/status-enlightenment-completion.json', import.meta.url));
const recipe = JSON.parse(fs.readFileSync(recipePath));
const cases = JSON.parse(fs.readFileSync(new URL('status-enlightenment-input-cases.json', import.meta.url)));
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
                trace.push({ step, form: game.u.umonnum, hp: game.u.uhp,
                    intrinsic: { ...game.u.intrinsic }, props: { ...game.u.uprops },
                    sicknessType: game.u.usick_type || 0, underwater: !!game.u.uinwater,
                    hidden: !!game.u.uundetected, appearance: game.youmonst.m_ap_type || 0,
                    humanGenocided: !!(game.mvitals[PMNAMES.PM_HUMAN].mvflags & G_GENOD),
                    steed: game.u.usteed?.m_id || null, woundedSide: game.u.EWounded_legs || 0,
                    tuxPenalty: !!game.iflags.tux_penalty,
                    weapon: game.u.uwep ? { id: game.u.uwep.o_id, type: game.u.uwep.otyp,
                        wetness: game.u.uwep.spe, globby: !!game.u.uwep.globby } : null,
                    worn: (game.invent || []).filter(obj => obj.owornmask).map(obj => ({
                        id: obj.o_id, type: obj.otyp, mask: obj.owornmask,
                    })) });
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
// The first execution has finished before this single unobserved worker starts.
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
const screen = (index, step) => decodeScreen(runs[index].screens[step]).join('\n');
const hashes = runs.map(run => Object.fromEntries(
    Object.entries(run).map(([key, value]) => [key, hash(value)])));
for (const [index, expected] of Object.entries(cases.negativeHashes)) {
    check(`case ${index} keeps all five original negative hashes`, () =>
        assert.deepEqual(hashes[index], expected));
}
for (const [index, step, text] of cases.visible) {
    check(`status witness case ${index}, step ${step}: ${text}`, () =>
        assert.ok(screen(index, step).includes(text), text));
}
check('simultaneous troubles come from the real wizard timer command', () => {
    const state = at(0, 80);
    for (const key of ['STONED', 'SLIMED', 'SICK', 'VOMITING'])
        assert.equal(state.props[key], 100, key);
    for (const key of ['HStrangled', 'HStun', 'HConfusion', 'HDeaf'])
        assert.equal(state.intrinsic[key], 100, key);
    assert.ok(state.sicknessType);
});
check('worn item causes, glib timer and side-free wizard injury are actual producers', () => {
    const state = at(1, 144);
    assert.ok(state.worn.some(obj => obj.type === ONAMES.GAUNTLETS_OF_FUMBLING && obj.mask === W_ARMG));
    assert.ok(state.worn.some(obj => obj.type === ONAMES.RIN_HUNGER && obj.mask === W_RINGL));
    assert.equal(state.intrinsic.HGlib, 30);
    assert.equal(state.intrinsic.HWounded_legs, 30);
    assert.equal(state.woundedSide, 0);
});
check('blessed potion sets actual at-will levitation bits', () => {
    const word = at(2, 72).intrinsic.HLevitation;
    assert.ok(word & I_SPECIAL);
    assert.ok(word & TIMEOUT);
});
check('real underwater entry and water-walking equipment have distinct states', () => {
    assert.equal(at(3, 80).form, PMNAMES.PM_WATER_ELEMENTAL);
    assert.equal(at(3, 80).underwater, true);
    assert.equal(at(4, 93).underwater, false);
    assert.ok(at(4, 93).props.WWALKING);
});
check('the two #monster commands retain mimic appearance and ceiling hiding', () => {
    assert.equal(at(5, 90).form, PMNAMES.PM_SMALL_MIMIC);
    assert.equal(at(5, 90).appearance, M_AP_OBJECT);
    assert.equal(at(5, 144).form, PMNAMES.PM_LURKER_ABOVE);
    assert.equal(at(5, 144).hidden, true);
});
check('actual self-genocide leaves the vampire form alive with a dead human base', () => {
    assert.equal(at(6, 130).humanGenocided, true);
    assert.equal(at(6, 130).form, PMNAMES.PM_VAMPIRE);
    assert.equal(at(6, 130).hp, -1);
});
check('the mounted timer injury remains owned by the real pony', () => {
    const state = at(7, 95);
    assert.ok(state.steed);
    assert.equal(state.intrinsic.HWounded_legs, 30);
    assert.equal(state.props.LEVITATION || state.intrinsic.HLevitation, 30);
    assert.equal(state.woundedSide, 0);
});
check('real Monk armor and weapon ownership reach their status branches', () => {
    assert.equal(at(8, 66).tuxPenalty, true);
    assert.equal(at(9, 73).weapon.type, ONAMES.SHIELD_OF_REFLECTION);
    assert.equal(at(9, 108).weapon.type, ONAMES.TOWEL);
    assert.ok(at(9, 108).weapon.wetness > 0);
    assert.equal(at(10, 61).weapon.globby, true);
});
const recording = { version: 5, source: 'js', segments: recipe.segments.map((part, index) => ({
    ...part, steps: runs[index].screens.map((cellScreen, step) => ({
        key: step ? Array.from(part.moves)[step - 1] : null,
        screen: cellScreen, cursor: runs[index].cursors[step], rng: runs[index].slices[step],
        animation_frames: runs[index].frames[step],
    })),
})) };
check('all recipe cell assertions match the actual status boundaries', () =>
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
    check('optional native status-page witnesses', () => {
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
