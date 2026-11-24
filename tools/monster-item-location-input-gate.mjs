// Ordinary inputs with read-only observations. Native output is optional and independent.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { Blind } from '../js/youprop.js';
import { canseemon } from '../js/display.js';
import { PMNAMES as P } from '../js/monst_data.js';
import { ONAMES as O } from '../js/objects_data.js';
import { OBJ_FLOOR, OBJ_MINVENT, OBJ_DELETED } from '../js/const.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const paths = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const inputPath = paths[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/monster-item-location-feedback.json', import.meta.url));
const inputBytes = fs.readFileSync(inputPath);
const input = JSON.parse(inputBytes);
assert.equal(input.segments.length, 4);
const outputs = run => structuredClone({
    screens: run.getScreens(), cursors: run.getCursors(),
    rng: run.getRngLog(), slices: run.getRngSlices(),
    frames: run.getAnimationFramesByStep(),
});
if (process.argv.includes('--plain')) {
    const runs = [];
    for (const part of input.segments)
        runs.push(outputs(await runSegment({ ...part, storage: new InMemoryStorage() })));
    fs.writeFileSync(1, JSON.stringify(runs));
    process.exit(0);
}

const runs = [];
const states = [];
const oldHook = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
try {
    for (const part of input.segments) {
        const steps = [];
        let mon, potion;
        globalThis.__step_snapshot = { step: '*', cb(game, step) {
            mon ||= game.level?.monsters.find(item => item.mnum === P.PM_STONE_GIANT);
            potion ||= game.invent.find(item => item.otyp === O.POT_INVISIBILITY);
            steps[step] = {
                hero: [game.u.ux, game.u.uy], blind: !!Blind(),
                monster: mon ? {
                    xy: [mon.mx, mon.my], visible: !!canseemon(mon),
                    invisible: !!mon.minvis, permanentInvisible: !!mon.perminvis,
                    carriesPotion: (mon.minvent || []).includes(potion),
                } : null,
                potion: potion ? {
                    where: potion.where ?? null, keys: Object.keys(potion).length,
                    dknown: potion.dknown ?? null,
                } : null,
            };
        }};
        runs.push(outputs(await runSegment({ ...part, storage: new InMemoryStorage() })));
        states.push(steps);
    }
} finally {
    if (oldHook)
        Object.defineProperty(globalThis, '__step_snapshot', oldHook);
    else
        delete globalThis.__step_snapshot;
}
const plain = spawnSync(process.execPath,
    [fileURLToPath(import.meta.url), inputPath, '--plain'],
    { encoding: 'utf8', timeout: 20000, maxBuffer: 16 * 1024 * 1024 });
assert.equal(plain.status, 0, plain.stderr || String(plain.error));
assert.deepEqual(runs, JSON.parse(plain.stdout), 'observations preserve every output');
assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), oldHook);
const rows = runs.map(run => run.screens.map(screen => decodeScreen(screen).join('\n')));
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
check('all input boundaries are retained in every output collection', () => {
    for (const [i, run] of runs.entries())
        for (const field of ['screens', 'cursors', 'slices', 'frames'])
            assert.equal(run[field].length, input.segments[i].moves.length + 1);
});
check('ordinary drop and monster movement produce a real floor-to-inventory pickup', () => {
    for (let i = 0; i < 3; i++) {
        assert.equal(states[i][59].potion.where, OBJ_FLOOR);
        assert.equal(states[i][60].potion.where, OBJ_MINVENT);
        assert.equal(states[i][60].monster.carriesPotion, true);
        assert.deepEqual(states[i][60].monster.xy, [40, 5]);
        assert.deepEqual(states[i][60].hero, [40, 6]);
    }
});
check('visible pickup and drinking identify the monster square', () => {
    assert.match(rows[0][60], /^<40,5>: The stone giant picks up a pink potion\./);
    assert.match(rows[0][64], /^<40,5>: The stone giant drinks a pink potion!/);
});
check('plain messages omit both coordinate prefixes', () => {
    assert.match(rows[1][60], /^The stone giant picks up a pink potion\./);
    assert.match(rows[1][64], /^The stone giant drinks a pink potion!/);
    assert.doesNotMatch(rows[1][60] + rows[1][64], /<40,5>:/);
});
check('quiet pickup retains its ownership effects and the later drinking message', () => {
    assert.ok(!rows[2].some(screen => screen.includes('picks up')));
    assert.equal(states[2][60].potion.where, OBJ_MINVENT);
    assert.match(rows[2][64], /^<40,5>: The stone giant drinks a pink potion!/);
});
check('drinking text precedes the invisibility continuation and potion disposal', () => {
    for (let i = 0; i < 3; i++) {
        // This More belongs to the following disappearance message.
        // mquaffmsg completed, but m_useup has not yet run.
        assert.equal(states[i][64].monster.visible, false);
        assert.equal(states[i][64].monster.invisible, true);
        assert.equal(states[i][64].monster.carriesPotion, true);
        assert.equal(states[i][64].potion.where, OBJ_MINVENT);
        assert.equal(states[i][64].potion.dknown, 1);
        assert.equal(states[i][65].monster.invisible, true);
        assert.equal(states[i][65].monster.permanentInvisible, true);
        assert.equal(states[i][65].monster.carriesPotion, false);
        assert.ok(states[i][65].potion.where === OBJ_DELETED
            || states[i][65].potion.keys === 0);
    }
});
check('unseen drinking is auditory and unlocated after a real blind pickup', () => {
    assert.ok(states[3].some(state => state.monster?.carriesPotion
        && state.potion.where === OBJ_MINVENT));
    assert.equal(states[3][81].blind, true);
    assert.equal(states[3][81].monster.visible, false);
    assert.equal(states[3][81].monster.invisible, true);
    assert.equal(states[3][81].monster.carriesPotion, false);
    assert.match(rows[3][81], /^You hear a chugging sound\./);
    assert.ok(!rows[3].some(screen => /picks up| drinks a pink potion/.test(screen)));
});
check('accessibility and quiet pickup preserve all ordinary RNG calls', () => {
    assert.deepEqual(runs[0].rng, runs[1].rng);
    assert.deepEqual(runs[0].rng, runs[2].rng);
});
check('recipe witnesses hold on the ordinary JS replay', () => {
    assert.deepEqual(branchAssertionErrors(input, {
        segments: runs.map(run => ({ steps: run.screens.map((screen, step) => ({
            screen, rng: run.slices[step],
        })) })),
    }), []);
});

let native = null;
if (paths[1]) {
    const bytes = fs.readFileSync(paths[1]);
    const raw = JSON.parse(bytes);
    assert.equal(raw.version, 5);
    assert.equal(raw.source, 'c');
    assert.equal(raw.segments.length, input.segments.length);
    assert.deepEqual(recordingIntegrityErrors(raw), []);
    for (const [i, part] of raw.segments.entries()) {
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
            assert.equal(Object.hasOwn(part, field), Object.hasOwn(input.segments[i], field));
            assert.deepEqual(part[field], input.segments[i][field], `${i}.${field}`);
        }
    }
    assert.deepEqual(branchAssertionErrors(input, raw), []);
    const nativeRows = raw.segments.map(part => part.steps.map(step =>
        decodeScreen(step.screen).join('\n')));
    assert.match(nativeRows[0][60], /^<40,5>: The stone giant picks up a pink potion\./);
    assert.match(nativeRows[0][64], /^<40,5>: The stone giant drinks a pink potion!/);
    assert.match(nativeRows[2][64], /^<40,5>: The stone giant drinks a pink potion!/);
    assert.match(nativeRows[3][81], /^You hear a chugging sound\./);
    native = { sha256: createHash('sha256').update(bytes).digest('hex'),
        evidence: 'native input and screen witnesses; complete strict replay is separate' };
}
console.log(JSON.stringify({
    evidence: native ? 'JS observations and native witnesses' : 'JS only; native recording pending',
    passed: checks.length, total: checks.length + failures.length, checks, failures,
    observationsNeutral: true, native,
    inputSha256: createHash('sha256').update(inputBytes).digest('hex'),
    segments: runs.map((run, i) => ({ name: input.segments[i].name,
        boundaries: run.screens.length, calls: run.rng.length,
        frames: run.frames.reduce((sum, group) => sum + group.length, 0),
        pickup: states[i].find(state => state.monster?.carriesPotion),
        drinking: states[i][i < 3 ? 64 : 81],
        final: states[i].at(-1),
    })),
}, null, 4));
process.exitCode = failures.length ? 1 : 0;
