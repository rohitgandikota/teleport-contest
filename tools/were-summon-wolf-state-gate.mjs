#!/usr/bin/env node

// State checks for a real werewolf attack-time form change, bite infection,
// helper summoning, and the message paging caused by visible arrivals.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';
import { FROMFORM, NON_PM } from '../js/const.js';

const recipePath = new URL('gen-sessions/recipes/were-summon-wolf.json',
                           import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));
const watchedSteps = new Set([70, 72, 73, 74, 92, 93, 94, 95]);
const trace = new Map();

function living(state, mnum) {
    return (state.level.monsters || []).filter(mon =>
        mon.mnum === mnum && (mon.mhp || 0) > 0);
}

globalThis.__step_snapshot = {
    step: '*',
    cb: (state, step) => {
        if (!watchedSteps.has(step))
            return;
        trace.set(step, {
            human: living(state, PMNAMES.PM_HUMAN_WEREWOLF).length,
            werewolf: living(state, PMNAMES.PM_WEREWOLF).length,
            winterWolves: living(state, PMNAMES.PM_WINTER_WOLF).length,
            wolves: living(state, PMNAMES.PM_WOLF).length,
            ulycn: state.u.ulycn,
            umonnum: state.u.umonnum,
            drainResistance: state.u.intrinsic?.HDrain_resistance || 0,
            hp: state.u.uhp,
            message: state._pending_message || '',
        });
    },
};
try {
    await runSegment({ ...recipe.segments[0], onFrame: () => {} });
} finally {
    delete globalThis.__step_snapshot;
}

assert.equal(trace.get(70).human, 1,
             'the debug-created attacker begins in human form');
assert.equal(trace.get(70).ulycn, NON_PM,
             'the hero begins without lycanthropy');

const changed = trace.get(72);
assert.equal(changed.human, 0,
             'the attack-time form roll removes the human form');
assert.equal(changed.werewolf, 1,
             'the attacker changes into its werewolf form');
assert.equal(changed.message,
             'The werewolf hits!  The werewolf changes into a wolf.',
             'the physical hit is reported before the visible form change');

assert.equal(trace.get(73).ulycn, NON_PM,
             'a failed bite roll leaves the hero uninfected');
const infected = trace.get(74);
assert.equal(infected.ulycn, PMNAMES.PM_WEREWOLF,
             'the successful bite records werewolf lycanthropy');
assert.ok(infected.drainResistance & FROMFORM,
          'infection immediately grants form-sourced drain resistance');
assert.equal(infected.message,
             'The werewolf bites!  You feel feverish.',
             'the infection message follows the bite message');

const summonStart = trace.get(92);
assert.equal(summonStart.winterWolves, 1,
             'the first helper exists while the summon line is paged');
assert.equal(summonStart.wolves, 0,
             'later helper attempts wait behind the first paging boundary');
assert.equal(summonStart.message, 'The werewolf summons help!',
             'the visible summoner reports its attempt first');

const firstArrival = trace.get(93);
assert.equal(firstArrival.winterWolves, 2,
             'two winter wolves are created by the recorded weighted choices');
assert.equal(firstArrival.wolves, 1,
             'the first ordinary wolf is created before the next page');
assert.equal(firstArrival.message,
             'A winter wolf suddenly appears next to you!',
             'the first distinct helper arrival gets its own page');

const allArrived = trace.get(94);
assert.equal(allArrived.winterWolves, 2,
             'the summon keeps both winter wolves');
assert.equal(allArrived.wolves, 3,
             'the five attempts produce three ordinary wolves');
assert.equal(allArrived.message,
             'A wolf suddenly appears next to you!  The werewolf bites!',
             'the distinct wolf arrival precedes the continuing attack');
assert.equal(trace.get(95).hp, 5,
             'the fight continues after helper creation and paging');

const helpers = [
    ...living(game, PMNAMES.PM_WINTER_WOLF),
    ...living(game, PMNAMES.PM_WOLF),
];
assert.equal(helpers.length, 5,
             'the successful one-to-five roll creates all five helpers');
assert.ok(helpers.every(mon => !mon.mpeaceful && !(mon.mtame | 0)),
          'hostile werewolf helpers remain hostile and untame');
assert.equal(game.u.ulycn, PMNAMES.PM_WEREWOLF,
             'lycanthropy persists after the encounter');
assert.notEqual(game.u.umonnum, game.u.ulycn,
                'failed night rolls leave the hero in base form');

const paths = [...(game.unported || [])];
assert.ok(!paths.some(path =>
    path === 'mhitu:summonmu:were'
    || path === 'mhitm_ad_were:retouch_equipment'
    || path === 'were:were_summon:arrival'),
'were attacks, infection, and visible helper arrivals leave no old marker');

console.log('werewolf summon and infection state: PASS');
