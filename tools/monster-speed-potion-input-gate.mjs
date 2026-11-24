// Ordinary inputs with read-only observations. Native witnesses remain independent.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { Blind, Hallucination } from '../js/youprop.js';
import { canseemon } from '../js/display.js';
import { PMNAMES as P } from '../js/monst_data.js';
import { ONAMES as O } from '../js/objects_data.js';
import { MFAST, OBJ_FLOOR, OBJ_MINVENT, OBJ_DELETED } from '../js/const.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const paths = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const inputPath = paths[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/monster-speed-potion.json', import.meta.url));
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
            potion ||= game.invent.find(item => item.otyp === O.POT_SPEED);
            steps[step] = {
                hero: [game.u.ux, game.u.uy], blind: !!Blind(),
                hallucinating: !!Hallucination(),
                known: game.objects[O.POT_SPEED].oc_name_known,
                monster: mon ? {
                    xy: [mon.mx, mon.my], visible: !!canseemon(mon),
                    speed: [mon.permspeed, mon.mspeed],
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
assert.deepEqual(runs, JSON.parse(plain.stdout), 'observations preserve all five outputs');
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
check('ordinary drop and movement produce a real floor-to-monster pickup', () => {
    for (let i = 0; i < 4; i++) {
        const pickup = states[i].findIndex(state => state.monster?.carriesPotion);
        assert.ok(pickup > 0);
        assert.equal(states[i][pickup - 1].potion.where, OBJ_FLOOR);
        assert.equal(states[i][pickup].potion.where, OBJ_MINVENT);
        assert.deepEqual(states[i][pickup].monster.speed, [0, 0]);
        assert.deepEqual(states[i][pickup].monster.xy, [40, 5]);
        assert.deepEqual(states[i][pickup].hero, [40, 6]);
    }
});
check('visible drinking and its speed effect both identify the monster square', () => {
    assert.match(rows[0][57], /^<40,5>: The stone giant drinks a dark potion!/);
    assert.match(rows[0][58], /^<40,5>: The stone giant is suddenly moving faster\./);
});
check('plain feedback preserves both messages without a location prefix', () => {
    assert.match(rows[1][57], /^The stone giant drinks a dark potion!/);
    assert.match(rows[1][58], /^The stone giant is suddenly moving faster\./);
    assert.doesNotMatch(rows[1][57] + rows[1][58], /<40,5>:/);
});
check('effect continuation precedes learning and canonical potion disposal', () => {
    for (const [i, step] of [[0, 57], [1, 57], [3, 92]]) {
        const pending = states[i][step];
        assert.deepEqual(pending.monster.speed, [MFAST, MFAST]);
        assert.equal(pending.monster.carriesPotion, true);
        assert.equal(pending.potion.where, OBJ_MINVENT);
        assert.equal(pending.known, 0);
        const finished = states[i][step + 1];
        assert.deepEqual(finished.monster.speed, [MFAST, MFAST]);
        assert.equal(finished.monster.carriesPotion, false);
        assert.ok(finished.potion.where === OBJ_DELETED || finished.potion.keys === 0);
        assert.equal(finished.known, i === 3 ? 0 : 1);
    }
});
check('real blindness preserves the unlocated auditory speed-potion branch', () => {
    const final = states[2].at(-1);
    assert.equal(final.blind, true);
    assert.equal(final.monster.visible, false);
    assert.deepEqual(final.monster.speed, [MFAST, MFAST]);
    assert.equal(final.monster.carriesPotion, false);
    assert.equal(final.known, 0);
    assert.match(rows[2][74], /^You hear a chugging sound\./);
    assert.ok(!rows[2].some(screen => / drinks |moving faster|picks up/.test(screen)));
});
check('real hallucination preserves randomized names and suppresses discovery', () => {
    assert.equal(states[3][92].hallucinating, true);
    assert.equal(states[3][92].potion.dknown, 0);
    assert.match(rows[3][92], /^<40,5>: The arch-lich drinks a potion!/);
    assert.match(rows[3][93], /^<40,5>: The sea cucumber is suddenly moving faster\./);
    assert.equal(states[3][93].known, 0);
});
check('accessibility preserves every complete RNG call and per-input slice', () => {
    assert.deepEqual(runs[0].rng, runs[1].rng);
    assert.deepEqual(runs[0].slices, runs[1].slices);
});
check('recipe witnesses hold on ordinary JS replay', () => {
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
    for (const [i, part] of raw.segments.entries())
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
            assert.equal(Object.hasOwn(part, field), Object.hasOwn(input.segments[i], field));
            assert.deepEqual(part[field], input.segments[i][field], `${i}.${field}`);
        }
    assert.deepEqual(branchAssertionErrors(input, raw), []);
    native = { sha256: createHash('sha256').update(bytes).digest('hex'),
        evidence: 'native input and screen witnesses; full strict comparison is separate' };
}
console.log(JSON.stringify({
    evidence: native ? 'JS observations and native witnesses' : 'JS only; native pending',
    passed: checks.length, total: checks.length + failures.length, checks, failures,
    observationsNeutral: true, native,
    inputSha256: createHash('sha256').update(inputBytes).digest('hex'),
    segments: runs.map((run, i) => ({ name: input.segments[i].name,
        boundaries: run.screens.length, calls: run.rng.length,
        frames: run.frames.reduce((sum, group) => sum + group.length, 0),
        pending: states[i][[57, 57, 74, 92][i]], final: states[i].at(-1),
    })),
}, null, 4));
process.exitCode = failures.length ? 1 : 0;
