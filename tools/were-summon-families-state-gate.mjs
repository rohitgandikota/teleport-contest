#!/usr/bin/env node

// State checks for the hero were-form summon ability and the rat and jackal
// helper weights. The paired C recordings pin the messages and random order.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';

const playerRecipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/were-player-summons.json', import.meta.url),
'utf8'));
const jackalRecipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/were-summon-jackal.json', import.meta.url),
'utf8'));

function living(mnum) {
    return (game.level.monsters || []).filter(mon =>
        mon.mnum === mnum && (mon.mhp | 0) > 0);
}

function tame(mnum) {
    return living(mnum).filter(mon => (mon.mtame | 0) > 0);
}

async function runPlayer(index) {
    await runSegment({ ...playerRecipe.segments[index], onFrame: () => {} });
    assert.equal(game.u.umonnum, PMNAMES.PM_WERERAT,
                 'cursed water leaves the infected hero in wererat form');
    assert.equal(game.u.uen, 326,
                 'two calls for help spend exactly twenty energy');
    const helpers = [
        ...tame(PMNAMES.PM_SEWER_RAT),
        ...tame(PMNAMES.PM_GIANT_RAT),
        ...tame(PMNAMES.PM_RABID_RAT),
    ];
    assert.ok(helpers.every(mon => mon.mpeaceful && (mon.mtame | 0) === 5),
              'every helper summoned by the hero is peaceful and tame');
    assert.ok(living(PMNAMES.PM_WERERAT).some(mon => mon.mpeaceful),
              'the source wererat remains peaceful after the taming scroll');
}

await runPlayer(0);
assert.equal(tame(PMNAMES.PM_SEWER_RAT).length, 5,
             'the first seed creates five tame sewer rats');
assert.equal(tame(PMNAMES.PM_RABID_RAT).length, 1,
             'the first seed reaches the rabid-rat weight branch');
assert.equal(tame(PMNAMES.PM_GIANT_RAT).length, 0,
             'the first seed does not create a giant rat');

await runPlayer(1);
assert.equal(tame(PMNAMES.PM_SEWER_RAT).length, 2,
             'the second seed creates two tame sewer rats');
assert.equal(tame(PMNAMES.PM_GIANT_RAT).length, 3,
             'the second seed reaches the giant-rat weight branch');
assert.equal(tame(PMNAMES.PM_RABID_RAT).length, 0,
             'the second seed does not create a rabid rat');

const trace = new Map();
const watchedSteps = new Set([81, 158, 162]);
globalThis.__step_snapshot = {
    step: '*',
    cb: (_state, step) => {
        if (!watchedSteps.has(step))
            return;
        trace.set(step, {
            jackals: living(PMNAMES.PM_JACKAL).length,
            coyotes: living(PMNAMES.PM_COYOTE).length,
            foxes: living(PMNAMES.PM_FOX).length,
        });
    },
};
try {
    await runSegment({ ...jackalRecipe.segments[0], onFrame: () => {} });
} finally {
    delete globalThis.__step_snapshot;
}

assert.equal(trace.get(81).jackals, 5,
             'the first hostile summon reaches the common jackal branch');
assert.equal(trace.get(158).coyotes, 1,
             'a later hostile summon reaches the coyote branch');
assert.equal(trace.get(158).foxes, 0,
             'the fox has not appeared before its recorded branch');
assert.equal(trace.get(162).coyotes, 1,
             'the coyote remains alive when the fox is created');
assert.equal(trace.get(162).foxes, 1,
             'the final recorded choice reaches the fox branch');
for (const mon of [
    ...living(PMNAMES.PM_JACKAL),
    ...living(PMNAMES.PM_COYOTE),
    ...living(PMNAMES.PM_FOX),
]) {
    assert.equal(mon.mtame | 0, 0,
                 'hostile werejackal helpers are not tame');
    assert.equal(!!mon.mpeaceful, false,
                 'hostile werejackal helpers are not peaceful');
}

console.log('were summon helper families and tame ownership: PASS');
