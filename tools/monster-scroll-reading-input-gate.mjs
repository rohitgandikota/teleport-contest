// Ordinary inputs and read-only observations. No native recording is implied.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { Blind, Hallucination, Detect_monsters } from '../js/youprop.js';
import { canseemon, sensemon } from '../js/display.js';
import { PMNAMES as P } from '../js/monst_data.js';
import { ONAMES as O } from '../js/objects_data.js';
import { OBJ_FREE, OBJ_DELETED, OBJ_MINVENT } from '../js/const.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const paths = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const inputPath = paths[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/monster-scroll-reading.json', import.meta.url));
const inputBytes = fs.readFileSync(inputPath);
const input = JSON.parse(inputBytes);
assert.equal(input.segments.length, 4);
const outputs = run => structuredClone({
    screens: run.getScreens(),
    cursors: run.getCursors(),
    rng: run.getRngLog(),
    slices: run.getRngSlices(),
    frames: run.getAnimationFramesByStep(),
});
if (process.argv.includes('--plain')) {
    const runs = [];
    for (const part of input.segments)
        runs.push(outputs(await runSegment({ ...part, storage: new InMemoryStorage() })));
    fs.writeFileSync(1, JSON.stringify(runs));
    process.exit(0);
}

const runs = [], states = [];
const oldHook = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
try {
    for (const part of input.segments) {
        const steps = [];
        let reader, scroll;
        globalThis.__step_snapshot = { step: '*', cb(game, step) {
            reader ||= game.level?.monsters.find(mon => mon.mnum === P.PM_GOBLIN);
            scroll ||= reader?.minvent?.find(obj => obj.otyp === O.SCR_TELEPORTATION);
            steps[step] = {
                hero: [game.u.ux, game.u.uy],
                blind: !!Blind(),
                hallucinating: !!Hallucination(),
                detecting: !!Detect_monsters(),
                reader: reader ? {
                    xy: [reader.mx, reader.my],
                    hp: [reader.mhp, reader.mhpmax],
                    confused: !!reader.mconf,
                    visible: !!canseemon(reader),
                    sensed: !!sensemon(reader),
                    present: game.level.monsters.includes(reader),
                    migrating: (game.migrating_mons || []).includes(reader),
                    carriesScroll: (reader.minvent || []).includes(scroll),
                } : null,
                scroll: scroll ? { where: scroll.where ?? null,
                    keys: Object.keys(scroll).length } : null,
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
const checks = [], failures = [];
function check(name, operation) {
    try {
        operation();
        checks.push(name);
    } catch (error) {
        failures.push({ name, error: error.message });
    }
}

check('every input boundary is present in all output collections', () => {
    for (const [i, run] of runs.entries())
        for (const field of ['screens', 'cursors', 'slices', 'frames'])
            assert.equal(run[field].length, input.segments[i].moves.length + 1);
});
check('ordinary pickup and thrown confusion produce the wounded reader', () => {
    for (const steps of states) {
        assert.equal(steps[87].reader.carriesScroll, true);
        assert.equal(steps[87].scroll.where, OBJ_MINVENT);
        assert.deepEqual(steps[96].reader.hp, [2, 3]);
        assert.equal(steps[96].reader.confused, false);
        assert.equal(steps[97].reader.confused, true);
        assert.deepEqual(steps[97].reader.xy, [40, 6]);
        assert.deepEqual(steps[97].hero, [39, 6]);
    }
});
check('visible accessible reading identifies the actual monster square', () => {
    assert.match(rows[0][105], /<40,6>: The goblin reads a scroll labeled TEMOV!/);
    assert.match(rows[0][106], /Being confused, the goblin mispronounces the magic words/);
    assert.equal(states[0][105].reader.visible, true);
});
check('plain visible reading has no coordinate prefix', () => {
    assert.match(rows[1][105], /^The goblin reads a scroll labeled TEMOV!/);
    assert.doesNotMatch(rows[1][105], /<40,6>:/);
    assert.deepEqual(runs[0].rng, runs[1].rng);
});
check('blind detection retains a male pronoun without hallucination', () => {
    assert.equal(states[2][128].blind, true);
    assert.equal(states[2][128].detecting, true);
    assert.equal(states[2][128].hallucinating, false);
    assert.equal(states[2][128].reader.visible, false);
    assert.equal(states[2][128].reader.sensed, true);
    assert.match(rows[2][128], /You hear a goblin attempting to incant TEMOV/);
    assert.match(rows[2][129], /Being confused, he mispronounces the magic words/);
});
check('unseen hallucinated confusion uses the real pronoun RNG before level choice', () => {
    assert.equal(states[3][128].blind, true);
    assert.equal(states[3][128].hallucinating, true);
    assert.equal(states[3][128].reader.visible, false);
    assert.match(rows[3][128], /You hear something attempting to incant TEMOV/);
    // mhe runs before pline suspends on the previous visible message.
    const calls = [...runs[3].slices[128], ...runs[3].slices[129]];
    const pronoun = calls.findIndex(call => /^rn2\(4\)=/.test(call));
    const level = calls.findIndex(call => /^rn2\(5\)=/.test(call));
    assert.ok(pronoun >= 0 && level > pronoun, JSON.stringify(calls));
});
check('teleport reading suspends after extraction and before migration', () => {
    for (const [i, step] of [105, 105, 128, 128].entries()) {
        assert.equal(states[i][step].scroll.where, OBJ_FREE);
        assert.equal(states[i][step].reader.carriesScroll, false);
        assert.equal(states[i][step].reader.present, true);
        assert.equal(states[i][step].reader.migrating, false);
    }
});
check('all confused readers migrate and their consumed scrolls are disposed', () => {
    for (const [i, step] of [106, 106, 129, 129].entries()) {
        assert.equal(states[i][step].reader.present, false);
        assert.equal(states[i][step].reader.migrating, true);
        assert.equal(states[i].at(-1).reader.carriesScroll, false);
        assert.ok(states[i].at(-1).scroll.where === OBJ_DELETED
            || states[i].at(-1).scroll.keys === 0);
    }
});
check('recipe assertions are reached in actual JS input replay', () => {
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
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(part[field], input.segments[i][field], `${i}.${field}`);
    assert.deepEqual(branchAssertionErrors(input, raw), []);
    const heard = raw.segments[3].steps[128].rng;
    assert.ok(heard.some(call => /rn2\(4\)=/.test(call) && /pronoun_gender/.test(call)),
        'native context must identify the pronoun draw, not an unrelated rn2(4)');
    native = { sha256: createHash('sha256').update(bytes).digest('hex'),
        label: 'native input, screen and pronoun-call witnesses; strict replay is separate' };
}
console.log(JSON.stringify({
    evidence: native ? 'JS observations plus native witnesses' : 'JS only; native recording pending',
    passed: checks.length,
    total: checks.length + failures.length,
    checks, failures, observationsNeutral: true,
    inputSha256: createHash('sha256').update(inputBytes).digest('hex'),
    native,
    segments: runs.map((run, i) => ({ name: input.segments[i].name,
        boundaries: run.screens.length, calls: run.rng.length,
        frames: run.frames.reduce((sum, group) => sum + group.length, 0),
        reading: states[i][i < 2 ? 105 : 128],
        migration: states[i][i < 2 ? 106 : 129],
        readingContinuationCalls: run.slices[i < 2 ? 105 : 128],
        levelChoiceCalls: run.slices[i < 2 ? 106 : 129],
    })),
}, null, 4));
process.exitCode = failures.length ? 1 : 0;
