// Ordinary inputs and optional native witnesses, using normal runtime imports.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { mon_aligntyp } from '../js/priest.js';
import { getRngLog } from '../js/rng.js';
import { PMNAMES as P, MFLAGS, MSOUND } from '../js/monst_data.js';
import { A_LAWFUL, A_CHAOTIC } from '../js/const.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const recipePath = args[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/peaceful-minion-chat.json', import.meta.url));
const rawPath = args[1];
const plainMode = process.argv.includes('--plain');
const recipe = JSON.parse(fs.readFileSync(recipePath));
const species = [P.PM_ANGEL, P.PM_ARCHON, P.PM_IMP];
const good = '"It\'s not too late."';
const bad = '"We\'re all doomed."';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const runs = [];
const traces = [];
const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
try {
    const storage = new InMemoryStorage();
    for (const [segment, part] of recipe.segments.entries()) {
        const trace = [];
        if (!plainMode) {
            globalThis.__step_snapshot = { step: '*', cb(game, step) {
                const mon = game.level.monsters.find(mon => mon.mnum === species[segment]);
                if (!mon)
                    return;
                const count = getRngLog().length;
                const alignment = mon_aligntyp(mon);
                assert.equal(getRngLog().length, count);
                trace.push({ step, turn: game.moves, id: mon.m_id,
                    hero: [game.u.ux, game.u.uy], at: [mon.mx, mon.my],
                    peaceful: !!mon.mpeaceful, tame: mon.mtame || 0,
                    sleeping: !!mon.msleeping, sound: mon.data.msound,
                    speciesMinion: !!(mon.data.mflags2 & MFLAGS.M2_MINION),
                    isminion: !!mon.isminion, ispriest: !!mon.ispriest,
                    rawAlignment: mon.data.maligntyp, alignment });
            }};
        }
        const run = await runSegment({ ...part, storage });
        runs.push(structuredClone({ screens: run.getScreens(), cursors: run.getCursors(),
            rng: run.getRngLog(), slices: run.getRngSlices(),
            frames: run.getAnimationFramesByStep() }));
        traces.push(trace);
    }
} finally {
    if (previous)
        Object.defineProperty(globalThis, '__step_snapshot', previous);
    else
        delete globalThis.__step_snapshot;
}
if (plainMode) {
    fs.writeFileSync(1, JSON.stringify(runs));
    process.exit(0);
}
const plain = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args, '--plain'],
    { encoding: 'utf8', timeout: 20000, maxBuffer: 16 * 1024 * 1024 });
assert.equal(plain.status, 0, plain.stderr || String(plain.error));
assert.deepEqual(runs, JSON.parse(plain.stdout), 'the observer preserves all five full output collections');

const checks = [];
const failures = [];
function check(name, operation) {
    try {
        operation();
        checks.push(name);
    } catch (error) {
        failures.push({ name, error: error.message });
    }
}
for (const [segment, run] of runs.entries()) {
    const prompt = segment < 2 ? 24 : 21;
    check(`case ${segment}: real peaceful creation reaches the selected chat branch`, () => {
        const state = traces[segment].find(state => state.step === prompt);
        assert.ok(state?.peaceful && !state.tame && !state.sleeping);
        assert.equal(state.ispriest, false);
        assert.equal(state.isminion, false);
        assert.equal(state.sound, MSOUND.MS_CUSS);
        assert.equal(state.speciesMinion, segment < 2);
        assert.equal(state.rawAlignment, [12, 15, -7][segment]);
        assert.equal(state.alignment, segment < 2 ? A_LAWFUL : A_CHAOTIC);
        assert.deepEqual(state.at, [state.hero[0], state.hero[1] + 1]);
        assert.equal(recipe.segments[segment].moves[prompt], 'j');
    });
    check(`case ${segment}: actual chat produces its source-backed response`, () => {
        assert.equal(decodeScreen(run.screens[prompt + 1])[0].trimEnd(), segment < 2 ? good : bad);
    });
}
check('all proposed branch witnesses hold under actual input', () => {
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
        const step = index < 2 ? 25 : 22;
        assert.equal(decodeScreen(part.steps[step].screen)[0].trimEnd(), index < 2 ? good : bad);
    }
    assert.deepEqual(branchAssertionErrors(recipe, raw), []);
    native = { sha256: createHash('sha256').update(bytes).digest('hex'),
        scope: 'native input tuples and branch witnesses, strict full comparison is separate' };
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
