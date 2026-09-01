#!/usr/bin/env node

// State checks for src/were.c turn-boundary form rolls and the nearby wake
// caused by an unseen wolf howl. The paired C recording pins every frame and
// random call for the same full-moon day, ordinary night, and ordinary day.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/were-form-branches.json', import.meta.url),
'utf8'));

function liveMonster(state, forms) {
    return (state.level.monsters || []).find(mon =>
        forms.includes(mon.mnum) && (mon.mhp | 0) > 0);
}

async function traceSegment(index, watched, forms) {
    const trace = new Map();
    globalThis.__step_snapshot = {
        step: '*',
        cb: (state, step) => {
            if (!watched.has(step))
                return;
            const mon = liveMonster(state, forms);
            const lichen = liveMonster(state, [PMNAMES.PM_LICHEN]);
            trace.set(step, {
                mnum: mon?.mnum,
                sleeping: mon?.msleeping | 0,
                frozen: mon?.mfrozen | 0,
                canMove: mon?.mcanmove !== 0,
                lichenSleeping: lichen?.msleeping | 0,
            });
        },
    };
    try {
        await runSegment({ ...recipe.segments[index], onFrame: () => {} });
    } finally {
        delete globalThis.__step_snapshot;
    }
    return trace;
}

const P = PMNAMES;
const wolfTrace = await traceSegment(
    0, new Set([97, 122, 132]), [P.PM_HUMAN_WEREWOLF, P.PM_WEREWOLF]);
assert.equal(wolfTrace.get(97)?.mnum, P.PM_HUMAN_WEREWOLF,
             'the full-moon daytime case starts in human form');
assert.equal(wolfTrace.get(97)?.lichenSleeping, 1,
             'the nearby lichen starts asleep');
assert.equal(wolfTrace.get(122)?.mnum, P.PM_WEREWOLF,
             'the one-in-ten full-moon daytime roll changes into a wolf');
assert.equal(wolfTrace.get(122)?.lichenSleeping, 0,
             'the unseen wolf howl wakes the nearby lichen');
assert.equal(wolfTrace.get(132)?.mnum, P.PM_HUMAN_WEREWOLF,
             'the later one-in-thirty roll returns the wolf to human form');

const jackalTrace = await traceSegment(
    1, new Set([109, 123]), [P.PM_HUMAN_WEREJACKAL, P.PM_WEREJACKAL]);
assert.equal(jackalTrace.get(109)?.mnum, P.PM_WEREJACKAL,
             'the one-in-thirty ordinary-night roll changes into a jackal');
assert.equal(jackalTrace.get(123)?.mnum, P.PM_HUMAN_WEREJACKAL,
             'the later one-in-thirty roll returns the jackal to human form');

const ratTrace = await traceSegment(
    2, new Set([74, 82]), [P.PM_HUMAN_WERERAT, P.PM_WERERAT]);
assert.equal(ratTrace.get(74)?.mnum, P.PM_WERERAT,
             'the one-in-fifty ordinary-day roll changes into a rat');
assert.equal(ratTrace.get(82)?.mnum, P.PM_HUMAN_WERERAT,
             'the isolated one-in-thirty roll returns the rat to human form');

for (const state of [wolfTrace.get(122), jackalTrace.get(109),
                     ratTrace.get(74)]) {
    assert.equal(state?.sleeping, 0,
                 'a changed were creature is awake');
    assert.equal(state?.frozen, 0,
                 'a changed were creature is not frozen');
    assert.equal(state?.canMove, true,
                 'a changed were creature can move');
}

const paths = [...(game.unported || [])];
assert.ok(!paths.some(path => path.startsWith('were:')),
          'form-rate cases leave no were implementation marker');

console.log('were form rates, reversion, and howl wake state: PASS');
