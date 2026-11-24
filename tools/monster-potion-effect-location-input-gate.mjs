// Ordinary input with read-only observations. No game helpers are replaced.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { PMNAMES as P } from '../js/monst_data.js';
import { ONAMES as O } from '../js/objects_data.js';
import { canseemon } from '../js/display.js';
import { OBJ_DELETED, OBJ_MINVENT } from '../js/const.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const paths = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const inputPath = paths[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/monster-potion-effect-location.json', import.meta.url));
const inputBytes = fs.readFileSync(inputPath);
const input = JSON.parse(inputBytes);
assert.equal(input.segments.length, 6);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs = run => structuredClone({
    screens: run.getScreens(), cursors: run.getCursors(), rng: run.getRngLog(),
    slices: run.getRngSlices(), frames: run.getAnimationFramesByStep(),
});
const potionType = index => index === 3 || index === 5 ? O.POT_POLYMORPH : O.POT_GAIN_LEVEL;
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
    for (const [index, part] of input.segments.entries()) {
        let mon, potion;
        const trace = [];
        globalThis.__step_snapshot = { step: '*', cb(game, step) {
            mon ||= game.level.monsters.find(item =>
                item.mnum === P.PM_STONE_GIANT || item.mnum === P.PM_GOBLIN);
            potion ||= mon?.minvent.find(item => item.otyp === potionType(index));
            trace[step] = {
                hero: [game.u.ux, game.u.uy], depth: { ...game.u.uz },
                known: game.objects[potionType(index)].oc_name_known,
                potion: potion ? {
                    where: potion.where ?? null, keys: Object.keys(potion).length,
                    cursed: potion.cursed ?? null,
                } : null,
                monster: mon ? {
                    id: mon.m_id, xy: [mon.mx, mon.my], type: mon.mnum,
                    hp: [mon.mhp, mon.mhpmax], level: mon.m_lev, visible: !!canseemon(mon),
                    liveLevel: game.level.monsters.includes(mon),
                    migrating: (game.migrating_mons || []).includes(mon),
                    carriesPotion: (mon.minvent || []).includes(potion),
                } : null,
            };
        }};
        runs.push(outputs(await runSegment({ ...part, storage: new InMemoryStorage() })));
        states.push(trace);
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
        failures.push({ name, error: error.message.split('\n')[0] });
    }
}
check('every input boundary is retained in all four indexed collections', () => {
    for (const [index, run] of runs.entries())
        for (const field of ['screens', 'cursors', 'slices', 'frames'])
            assert.equal(run[field].length, input.segments[index].moves.length + 1);
});
for (let index = 0; index < 6; index++) {
    check(`${input.segments[index].name}: actual inventory, consumption and final effect`, () => {
        const carried = states[index].find(state => state.monster?.carriesPotion);
        assert.ok(carried, 'ordinary input supplies a real carried potion');
        assert.equal(carried.potion.where, OBJ_MINVENT);
        const final = states[index].at(-1);
        assert.equal(final.monster.id, carried.monster.id);
        assert.equal(final.monster.carriesPotion, false);
        assert.ok(final.potion.where === OBJ_DELETED || final.potion.keys === 0,
            'canonical disposal marks the object, then a later moveloop purges its fields');
        if (index === 1) {
            assert.equal(carried.potion.cursed, 1);
            assert.equal(final.monster.migrating, true);
            assert.equal(final.monster.liveLevel, false);
            assert.deepEqual(final.monster.xy, [0, 0]);
        } else {
            assert.equal(final.monster.liveLevel, true);
            assert.equal(final.monster.migrating, false);
            if (index === 0 || index === 4) {
                assert.equal(final.monster.level, carried.monster.level + 1);
                assert.ok(final.monster.hp[1] > carried.monster.hp[1]);
                assert.equal(final.known, 1);
            } else if (index === 2) {
                assert.equal(carried.potion.cursed, 1);
                assert.equal(final.monster.level, carried.monster.level);
            } else {
                assert.equal(carried.monster.type, P.PM_GOBLIN);
                assert.notEqual(final.monster.type, P.PM_GOBLIN);
                assert.equal(final.known, 1);
            }
        }
    });
}
const effects = [
    [0, 94, '<57,5>: The stone giant seems more experienced.'],
    [1, 30, '<14,11>: The stone giant rises up, through the ceiling!'],
    [2, 61, '<40,5>: The stone giant looks uneasy.'],
    [3, 63, '<40,5>: The goblin suddenly mutates!'],
];
for (const [index, step, text] of effects) {
    check(`${input.segments[index].name}: effect identifies the pre-mutation square`, () => {
        assert.ok(rows[index][step].startsWith(text), rows[index][step].split('\n')[0]);
        assert.equal(states[index][step].monster.visible, true);
        if (index === 1) {
            assert.equal(states[index][step].monster.liveLevel, true);
            assert.equal(states[index][step].monster.carriesPotion, true);
        }
        if (index === 3) {
            assert.equal(states[index][step - 1].monster.type, P.PM_GOBLIN);
            assert.equal(states[index][step - 1].monster.carriesPotion, false);
            assert.equal(states[index][step - 1].known, 0);
            assert.equal(states[index][step].known, 0);
        }
    });
}
check('plain controls retain unlocated growth and mutation messages', () => {
    assert.match(rows[4][94], /^The stone giant seems more experienced\./);
    assert.match(rows[5][62], /The goblin suddenly mutates!/);
    assert.doesNotMatch(rows[4].join('\n') + rows[5].join('\n'), /<\d+,\d+>:/);
});
check('located and plain effects retain identical complete RNG calls', () => {
    assert.deepEqual(runs[0].rng, runs[4].rng);
    assert.deepEqual(runs[0].slices, runs[4].slices);
    assert.deepEqual(runs[3].rng, runs[5].rng);
    // Polymorph has an extra ordinary Space for the located More boundary.
    // Its per-input slice equality is checked against C only after recording.
});
check('recipe screen witnesses hold on ordinary JS replay', () => {
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
    for (const [index, part] of raw.segments.entries())
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
            assert.equal(Object.hasOwn(part, field), Object.hasOwn(input.segments[index], field));
            assert.deepEqual(part[field], input.segments[index][field], `${index}.${field}`);
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
    segments: runs.map((run, index) => ({ name: input.segments[index].name,
        boundaries: run.screens.length, calls: run.rng.length, frames: run.frames.flat().length,
        hashes: Object.fromEntries(Object.entries(run).map(([field, value]) => [field, hash(value)])),
        effect: states[index][[94, 30, 61, 63, 94, 62][index]], final: states[index].at(-1),
    })),
}, null, 4));
process.exitCode = failures.length ? 1 : 0;
