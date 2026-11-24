// Ordinary input witnesses and optional native recording, no runtime overrides.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { mon_aligntyp } from '../js/priest.js';
import { getRngLog } from '../js/rng.js';
import { PMNAMES as P } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { ART_VORPAL_BLADE } from '../js/artilist_data.js';
import { A_LAWFUL, A_NEUTRAL, OBJ_FLOOR, OBJ_MINVENT } from '../js/const.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const recipePath = args[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/artifact-touch-alignment.json', import.meta.url));
const rawPath = args[1];
const plain = process.argv.includes('--plain');
const recipe = JSON.parse(fs.readFileSync(recipePath));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const runs = [];
const traces = [];
const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
try {
    const storage = new InMemoryStorage();
    for (const [segment, part] of recipe.segments.entries()) {
        const trace = [];
        let objectId;
        if (!plain) {
            globalThis.__step_snapshot = { step: '*', cb(game, step) {
                const mon = game.level.monsters.find(mon => mon.mnum === P.PM_ALIGNED_CLERIC);
                const wished = (game.invent || []).find(obj => obj.invlet === 'o'
                    && obj.otyp === ONAMES.LONG_SWORD);
                if (wished)
                    objectId = wished.o_id;
                const obj = [...(game.invent || []), ...game.level.objects,
                    ...(mon?.minvent || [])].find(obj => obj.o_id === objectId);
                if (!mon || !obj)
                    return;
                const count = getRngLog().length;
                const alignment = mon_aligntyp(mon);
                assert.equal(getRngLog().length, count);
                trace.push({ step, turn: game.moves, id: mon.m_id,
                    hero: [game.u.ux, game.u.uy], at: [mon.mx, mon.my],
                    rawAlignment: mon.data.maligntyp, alignment,
                    isminion: !!mon.isminion, ispriest: !!mon.ispriest,
                    ownedAlignment: mon.emin?.min_align, peaceful: !!mon.mpeaceful,
                    objectId: obj.o_id, artifact: obj.oartifact || 0, where: obj.where,
                    onFloor: game.level.objects.includes(obj),
                    inMonster: (mon.minvent || []).includes(obj),
                    objectAt: [obj.ox, obj.oy] });
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
    { encoding: 'utf8', timeout: 20000, maxBuffer: 16 * 1024 * 1024 });
assert.equal(unobserved.status, 0, unobserved.stderr || String(unobserved.error));
assert.deepEqual(runs, JSON.parse(unobserved.stdout), 'read-only observation preserves all five collections');
const checks = [], failures = [];
function check(name, operation) {
    try {
        operation();
        checks.push(name);
    } catch (error) {
        failures.push({ name, error: error.message });
    }
}
for (const [segment, run] of runs.entries()) {
    const creation = segment === 0 ? 56 : 54;
    const pickup = segment === 0 ? 74 : 72;
    const look = segment === 0 ? 86 : 84;
    check(`case ${segment}: actual maker supplies lawful EMIN over neutral species`, () => {
        const state = traces[segment].find(state => state.step === creation);
        assert.ok(state?.isminion && !state.ispriest && !state.peaceful);
        assert.equal(state.rawAlignment, A_NEUTRAL);
        assert.equal(state.ownedAlignment, A_LAWFUL);
        assert.equal(state.alignment, A_LAWFUL);
        assert.equal(state.artifact, segment === 0 ? ART_VORPAL_BLADE : 0);
        assert.equal(state.onFloor, true);
        assert.equal(state.inMonster, false);
    });
    check(`case ${segment}: real pickup preserves the expected object owner`, () => {
        const state = traces[segment].find(state => state.step === pickup);
        assert.ok(state);
        assert.equal(state.where, segment === 0 ? OBJ_FLOOR : OBJ_MINVENT);
        assert.equal(state.onFloor, segment === 0);
        assert.equal(state.inMonster, segment !== 0);
        assert.equal(state.objectId, traces[segment][0].objectId);
    });
    check(`case ${segment}: far-look gives the actual final floor witness`, () => {
        assert.equal(decodeScreen(run.screens[look])[0].trimEnd(), segment === 0
            ? ')        a weapon (a long sword named Vorpal Blade)'
            : '<        a staircase up or a branch staircase up (branch staircase up)');
    });
}
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
        for (let step = 1; step < part.steps.length; step++)
            assert.equal(part.steps[step].key, part.moves[step - 1]);
        const look = index === 0 ? 86 : 84;
        assert.equal(decodeScreen(part.steps[look].screen)[0].trimEnd(), index === 0
            ? ')        a weapon (a long sword named Vorpal Blade)'
            : '<        a staircase up or a branch staircase up (branch staircase up)');
    }
    assert.deepEqual(branchAssertionErrors(recipe, raw), []);
    native = { sha256: createHash('sha256').update(bytes).digest('hex'),
        scope: 'native tuples, keys and branch witnesses; strict comparison remains separate' };
}
console.log(JSON.stringify({ evidence: 'JS ordinary input; optional native witnesses',
    passed: checks.length, total: checks.length + failures.length, checks, failures,
    observationsNeutral: true, native,
    segments: runs.map((run, segment) => ({ segment, observations: traces[segment],
        hashes: Object.fromEntries(Object.entries(run).map(([key, value]) => [key, hash(value)])),
        boundaries: run.screens.length, calls: run.rng.length, frames: run.frames.flat().length,
    })),
}, null, 4));
process.exitCode = failures.length ? 1 : 0;
