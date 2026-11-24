// Ordinary cuss positives and an unchanged shaman/Oracle combined negative.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { mon_aligntyp } from '../js/priest.js';
import { which_armor } from '../js/worn.js';
import { getRngLog } from '../js/rng.js';
import { PMNAMES as P, MFLAGS, MSOUND } from '../js/monst_data.js';
import { A_LAWFUL, W_ARMF } from '../js/const.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const recipePath = args[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/monster-cuss-alignment.json', import.meta.url));
const rawPath = args[1];
const negativePath = args[2];
const recipe = JSON.parse(fs.readFileSync(recipePath));
const negative = negativePath ? JSON.parse(fs.readFileSync(negativePath)) : null;
const groups = [recipe, ...(negative ? [negative] : [])];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs = run => structuredClone({ screens: run.getScreens(), cursors: run.getCursors(),
    rng: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep() });
const plainMode = process.argv.includes('--plain');
const oldHook = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
const runs = [];
const traces = [];
try {
    for (const [group, fixture] of groups.entries()) {
        const storage = new InMemoryStorage();
        for (const [segment, part] of fixture.segments.entries()) {
            const trace = [];
            if (!plainMode) {
                const species = group === 0 ? P.PM_ANGEL
                    : segment === 0 ? P.PM_KOBOLD_SHAMAN : P.PM_ORACLE;
                globalThis.__step_snapshot = { step: '*', cb(game, step) {
                    const mon = game.level.monsters.find(m => m.mnum === species);
                    if (!mon)
                        return;
                    const count = getRngLog().length;
                    const alignment = mon_aligntyp(mon);
                    const boots = which_armor(mon, W_ARMF);
                    assert.equal(getRngLog().length, count);
                    trace.push({ step, id: mon.m_id, alignment,
                        rawAlignment: mon.data.maligntyp,
                        speciesMinion: !!(mon.data.mflags2 & MFLAGS.M2_MINION),
                        isminion: !!mon.isminion, ispriest: !!mon.ispriest,
                        sound: mon.data.msound, hp: mon.mhp, maxhp: mon.mhpmax,
                        energyUsed: mon.mspec_used || 0,
                        boots: boots ? { type: boots.otyp, spe: boots.spe } : null });
                }};
            }
            runs.push(outputs(await runSegment({ ...part, storage })));
            traces.push({ group, segment, states: trace });
        }
    }
} finally {
    if (oldHook)
        Object.defineProperty(globalThis, '__step_snapshot', oldHook);
    else
        delete globalThis.__step_snapshot;
}
if (plainMode) {
    fs.writeFileSync(1, JSON.stringify(runs));
    process.exit(0);
}
const plain = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args, '--plain'],
    { encoding: 'utf8', timeout: 20000, maxBuffer: 24 * 1024 * 1024 });
assert.equal(plain.status, 0, plain.stderr || String(plain.error));
assert.deepEqual(runs, JSON.parse(plain.stdout), 'observations preserve all five output collections');

const checks = [];
const failures = [];
function check(name, fn) {
    try {
        fn();
        checks.push(name);
    } catch (error) {
        failures.push({ name, error: error.message });
    }
}
for (let segment = 0; segment < recipe.segments.length; segment++) {
    check(`case ${segment}: ordinary Angel is a species-aligned cuss positive`, () => {
        const step = segment === 2 ? 52 : 53;
        const state = traces[segment].states.find(state => state.step === step);
        assert.ok(state?.speciesMinion);
        assert.equal(state.isminion, false);
        assert.equal(state.ispriest, false);
        assert.equal(state.rawAlignment, 12);
        assert.equal(state.alignment, A_LAWFUL);
        assert.equal(state.boots, null, 'cuss precedes wearing the proposed shoes');
    });
    check(`case ${segment}: correct taunt table and exact first divergent calls`, () => {
        const step = segment === 2 ? 53 : 54;
        assert.ok(decodeScreen(runs[segment].screens[step])[0].includes(
            'Very soon, my child, thou shalt meet thy maker.'));
        assert.deepEqual(runs[segment].rng.slice(2782, 2785),
            ['rn2(3)=2', 'rn2(2)=1', 'rn2(14)=2']);
    });
}
check('new cuss recipe witnesses hold; original footwear recipe is kept separately', () => {
    assert.deepEqual(branchAssertionErrors(recipe, { segments: runs.slice(0, 3).map(run => ({
        steps: run.screens.map((screen, step) => ({ screen, rng: run.slices[step] })),
    })) }), []);
});

if (negative) {
    for (let segment = 0; segment < negative.segments.length; segment++) {
        check(`retained negative ${segment}: real target lacks both affected preconditions`, () => {
            const states = traces[3 + segment].states;
            assert.ok(states.length > 0);
            for (const state of states) {
                assert.equal(state.speciesMinion, false);
                assert.notEqual(state.sound, MSOUND.MS_CUSS);
                assert.notEqual(state.sound, MSOUND.MS_BRIBE);
                assert.equal(state.boots, null);
            }
            if (segment === 0)
                assert.ok(states.some(state => state.energyUsed > 0));
            else
                assert.ok(states.some(state => state.hp < state.maxhp));
            const nativeCalls = negative.segments[segment].steps.flatMap(step => step.rng || []);
            assert.ok(nativeCalls.some(call => call.includes('trapeffect_anti_magic')));
            assert.ok(!nativeCalls.some(call => /@ (cuss|com_pager_core)\(/.test(call)));
        });
    }
}

let native = null;
if (rawPath) {
    const bytes = fs.readFileSync(rawPath);
    const raw = JSON.parse(bytes);
    assert.equal(raw.source, 'c');
    assert.equal(raw.version, 5);
    assert.deepEqual(recordingIntegrityErrors(raw), []);
    assert.equal(raw.segments.length, recipe.segments.length);
    for (const [index, part] of raw.segments.entries()) {
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
            assert.equal(Object.hasOwn(part, field), Object.hasOwn(recipe.segments[index], field));
            assert.deepEqual(part[field], recipe.segments[index][field]);
        }
        for (let step = 1; step < part.steps.length; step++)
            assert.equal(part.steps[step].key, part.moves[step - 1]);
        const firstTauntStep = index === 2 ? 52 : 53;
        assert.ok(part.steps[firstTauntStep].rng.includes(
            'rn2(14)=2 @ com_pager_core(questpgr.c:566)'),
        'native-only caller context identifies the taunt table owner');
    }
    assert.deepEqual(branchAssertionErrors(recipe, raw), []);
    native = { sha256: createHash('sha256').update(bytes).digest('hex'),
        scope: 'native tuples and cuss witnesses; complete strict equality checked separately' };
}
console.log(JSON.stringify({ passed: checks.length, total: checks.length + failures.length,
    checks, failures, observationsNeutral: true, native,
    evidence: 'ordinary JS observations; optional immutable native witnesses',
    segments: runs.map((run, index) => ({ ...traces[index],
        hashes: Object.fromEntries(Object.entries(run).map(([key, value]) => [key, hash(value)])),
        boundaries: run.screens.length, calls: run.rng.length, frames: run.frames.flat().length,
    })),
}, null, 4));
process.exitCode = failures.length ? 1 : 0;
