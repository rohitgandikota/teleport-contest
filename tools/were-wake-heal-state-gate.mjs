#!/usr/bin/env node

// State checks for src/were.c:new_were() waking a temporarily sleeping
// monster and healing one quarter of its missing hit points. The paired C
// recording pins the damage, sleep duration, transformation roll, and frames.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/were-wake-heal.json', import.meta.url), 'utf8'));
const watchedSteps = new Set([122, 125, 128, 130, 131]);
const trace = new Map();

globalThis.__step_snapshot = {
    step: '*',
    cb: (state, step) => {
        if (!watchedSteps.has(step))
            return;
        const mon = (state.level.monsters || []).find(candidate =>
            (candidate.mnum === PMNAMES.PM_HUMAN_WEREWOLF
             || candidate.mnum === PMNAMES.PM_WEREWOLF)
            && (candidate.mhp | 0) > 0);
        assert.ok(mon, `were creature exists at step ${step}`);
        trace.set(step, {
            mnum: mon.mnum,
            hp: mon.mhp | 0,
            maxHp: mon.mhpmax | 0,
            peaceful: !!mon.mpeaceful,
            sleeping: mon.msleeping | 0,
            frozen: mon.mfrozen | 0,
            canMove: mon.mcanmove !== 0,
        });
    },
};
try {
    await runSegment({ ...recipe.segments[0], onFrame: () => {} });
} finally {
    delete globalThis.__step_snapshot;
}

assert.deepEqual(trace.get(122), {
    mnum: PMNAMES.PM_HUMAN_WEREWOLF,
    hp: 32,
    maxHp: 32,
    peaceful: true,
    sleeping: 0,
    frozen: 0,
    canMove: true,
}, 'the created human werewolf starts healthy, peaceful, and mobile');
assert.equal(trace.get(125)?.hp, 15,
             'the striking wand leaves seventeen hit points missing');
assert.equal(trace.get(125)?.peaceful, false,
             'the damaging wand makes the werewolf hostile');

const sleeping = trace.get(128);
assert.equal(sleeping?.mnum, PMNAMES.PM_HUMAN_WEREWOLF,
             'the sleep ray lands before the form change');
assert.equal(sleeping?.hp, 16,
             'ordinary regeneration restores one hit point before sleep');
assert.ok(sleeping?.frozen > 0,
          'the sleep ray gives the monster a temporary sleep counter');
assert.equal(sleeping?.canMove, false,
             'the temporarily sleeping monster cannot move');

const beforeChange = trace.get(130);
assert.deepEqual({
    hp: beforeChange?.hp,
    maxHp: beforeChange?.maxHp,
    frozen: beforeChange?.frozen,
    canMove: beforeChange?.canMove,
}, {
    hp: 20,
    maxHp: 32,
    frozen: 110,
    canMove: false,
}, 'the isolated final wait starts with twelve hit points missing');

const changed = trace.get(131);
assert.equal(changed?.mnum, PMNAMES.PM_WEREWOLF,
             'the recorded full-moon roll changes the monster into a wolf');
assert.equal(changed?.frozen, 0,
             'the transformation clears temporary sleep');
assert.equal(changed?.sleeping, 0,
             'the transformation also clears indefinite sleep');
assert.equal(changed?.canMove, true,
             'the transformed monster becomes mobile');
const hpBeforeNewWere = beforeChange.hp + 1;
assert.equal(changed?.hp,
             hpBeforeNewWere
             + Math.trunc((beforeChange.maxHp - hpBeforeNewWere) / 4),
             'new_were heals exactly one quarter of the remaining deficit');

const paths = [...(game.unported || [])];
assert.ok(!paths.some(path => path.startsWith('were:')),
          'wake and heal leave no were implementation marker');

console.log('were wake and quarter-heal state: PASS');
