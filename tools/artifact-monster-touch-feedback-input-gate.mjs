// Ordinary keyboard witnesses. Observation reads state and never replaces a helper.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { ART_MASTER_KEY_OF_THIEVERY } from '../js/artilist_data.js';
import { OBJ_INVENT, OBJ_MINVENT } from '../js/const.js';
import { is_door_mappear } from '../js/monst.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const recipePath = args[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/artifact-monster-touch-feedback.json', import.meta.url));
const rawPath = args[1];
const plain = process.argv.includes('--plain');
const recipe = JSON.parse(fs.readFileSync(recipePath));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const runs = [], traces = [];
const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
try {
    const storage = new InMemoryStorage();
    for (const part of recipe.segments) {
        const trace = [];
        let objectId;
        if (!plain) {
            globalThis.__step_snapshot = { step: '*', cb(game, step) {
                const carried = (game.invent || []).find(obj => obj.otyp === ONAMES.SKELETON_KEY);
                if (carried)
                    objectId = carried.o_id;
                const mon = game.level.monsters.find(mon => mon.mnum === PMNAMES.PM_SMALL_MIMIC);
                if (!mon || objectId === undefined)
                    return;
                const obj = [...(game.invent || []), ...(mon.minvent || [])]
                    .find(obj => obj.o_id === objectId);
                assert.ok(obj, 'the observed key retains a live owner');
                trace.push({ step, turn: game.moves, objectId, artifact: obj.oartifact || 0,
                    where: obj.where, letter: obj.invlet, inHero: (game.invent || []).includes(obj),
                    inMonster: (mon.minvent || []).includes(obj), monsterId: mon.m_id,
                    doorMimic: is_door_mappear(mon), sleeping: !!mon.msleeping,
                    peaceful: !!mon.mpeaceful, at: [mon.mx, mon.my] });
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
const unobserved = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args, '--plain'],
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
const wakeSteps = [531, 522, 517];
const resistance = ['rn2(100)=98', 'rn2(100)=76', 'rn2(100)=13'];
for (const [segment, run] of runs.entries()) {
    const first = traces[segment][0], last = traces[segment].at(-1);
    check(`case ${segment}: actual maker produces a peaceful sleeping door mimic`, () => {
        assert.ok(first.doorMimic && first.sleeping && first.peaceful);
        assert.equal(first.artifact, segment === 0 ? ART_MASTER_KEY_OF_THIEVERY : 0);
        assert.equal(first.inHero, true);
        assert.equal(first.letter, 'b');
    });
    check(`case ${segment}: real resistance follows discovery and wake feedback`, () => {
        assert.match(decodeScreen(run.screens[wakeSteps[segment] - 1])[0],
            /That closed door actually is a sleeping small mimic!/);
        assert.match(decodeScreen(run.screens[wakeSteps[segment]])[0], /small mimic wakes up/);
        assert.equal(run.slices[wakeSteps[segment]][0], resistance[segment]);
    });
    check(`case ${segment}: absorption or refusal preserves the correct owner`, () => {
        assert.equal(last.objectId, first.objectId);
        assert.equal(last.monsterId, first.monsterId);
        assert.equal(last.doorMimic, false);
        assert.equal(last.sleeping, false);
        assert.equal(last.inHero, segment !== 1);
        assert.equal(last.inMonster, segment === 1);
        assert.equal(last.where, segment === 1 ? OBJ_MINVENT : OBJ_INVENT);
    });
}
check('monster artifact refusal is silent and caller artifact speech completes', () => {
    const tops = runs[0].screens.map(screen => decodeScreen(screen)[0]).join('\n');
    assert.doesNotMatch(tops, /beyond your control|evades your grasp/);
    assert.match(tops, /The key named the Master Key of Thievery whispers:/);
    assert.match(tops, /The orc swings his orcish broadsword named Elfrist/);
});
check('all ordinary recipe assertions hold', () => {
    assert.deepEqual(branchAssertionErrors(recipe, { segments: runs.map(run => ({
        steps: run.screens.map((screen, step) => ({ screen, rng: run.slices[step] })),
    })) }), []);
});
let native = null;
if (rawPath) {
    const bytes = fs.readFileSync(rawPath);
    const raw = JSON.parse(bytes);
    assert.equal(raw.version, 5);
    assert.equal(raw.source, 'c');
    assert.deepEqual(recordingIntegrityErrors(raw), []);
    assert.equal(raw.segments.length, recipe.segments.length);
    for (const [index, part] of raw.segments.entries()) {
        for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
            assert.equal(Object.hasOwn(part, key), Object.hasOwn(recipe.segments[index], key));
            assert.deepEqual(part[key], recipe.segments[index][key]);
        }
        assert.equal(part.steps[0].key, null);
        for (let step = 1; step < part.steps.length; step++)
            assert.equal(part.steps[step].key, part.moves[step - 1]);
        assert.match(decodeScreen(part.steps[wakeSteps[index] - 1].screen)[0],
            /That closed door actually is a sleeping small mimic!/);
        assert.match(String(part.steps[wakeSteps[index]].rng[0]),
            new RegExp(resistance[index].replace(/[()]/g, '\\$&')));
    }
    assert.deepEqual(branchAssertionErrors(recipe, raw), []);
    native = { sha256: createHash('sha256').update(bytes).digest('hex'),
        scope: 'actual tuples, keys and visible branch witnesses; strict comparison is separate' };
}
console.log(JSON.stringify({ evidence: 'JS ordinary input; optional native witnesses',
    passed: checks.length, total: checks.length + failures.length, checks, failures,
    observationsNeutral: true, native,
    segments: runs.map((run, segment) => ({ segment,
        first: traces[segment][0], last: traces[segment].at(-1),
        hashes: Object.fromEntries(Object.entries(run).map(([key, value]) => [key, hash(value)])),
        boundaries: run.screens.length, calls: run.rng.length, frames: run.frames.flat().length,
    })),
}, null, 4));
process.exitCode = failures.length ? 1 : 0;
