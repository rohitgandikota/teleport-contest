#!/usr/bin/env node

// State checks for src/uhitm.c passive(). The matching C recording pins the
// terminal output and RNG order for the same cases.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';

const recipePath = new URL('gen-sessions/recipes/passive-retaliation.json',
                           import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));

async function run(index) {
    const trace = [];
    globalThis.__step_snapshot = {
        step: '*',
        cb: (state, step) => trace.push({
            step,
            multi: state.multi | 0,
            reason: state.multi_reason || '',
            stun: state.u?.intrinsic?.HStun | 0,
        }),
    };
    try {
        await runSegment({ ...recipe.segments[index], onFrame: () => {} });
    } finally {
        delete globalThis.__step_snapshot;
    }
    return trace;
}

function liveMonsters(mnum) {
    return (game.level.monsters || []).filter(mon => mon.mnum === mnum
                                               && (mon.mhp || 0) > 0);
}

await run(0);
assert.equal(game.u.uwep.oeroded, 1,
             'rust monster rusts the primary katana');
assert.equal(game.u.uswapwep.oeroded, 1,
             'second passive rusts the off-hand wakizashi');

let trace = await run(1);
assert.ok(trace.some(state => state.multi < 0
                              && state.reason.includes('gaze')),
          'floating-eye gaze schedules helpless turns');
assert.equal(game.multi, 0, 'floating-eye paralysis eventually expires');

trace = await run(2);
assert.ok(trace.some(state => state.reason.includes('gelatinous cube')),
          'gelatinous cube schedules contact paralysis');
assert.equal(game.multi, 0, 'gelatinous-cube paralysis eventually expires');

await run(3);
const blueJellies = liveMonsters(PMNAMES.PM_BLUE_JELLY);
assert.equal(game.u.uhp, 34, 'blue-jelly cold passives damage the hero');
assert.equal(blueJellies.length, 2,
             'blue jelly splits after absorbing enough heat');
assert.equal(blueJellies.reduce((sum, mon) => sum + mon.mhpmax, 0), 66,
             'heat split preserves total maximum monster HP');

trace = await run(4);
assert.ok(trace.some(state => state.stun > 0),
          'yellow-mold passive sets a stun timeout');
assert.equal(game.u.intrinsic.HStun, 0,
             'yellow-mold stun expires after the recorded turns');

await run(5);
assert.equal(game.u.uhp, 78,
             'fire-elemental passive applies its C-recorded damage');

await run(6);
assert.equal(game.u.uhp, 81,
             'energy-vortex passive applies its C-recorded shock damage');

await run(7);
assert.equal(game.u.uhp, 184,
             'acid splash applies five points of C-recorded damage');
assert.equal(liveMonsters(PMNAMES.PM_ACID_BLOB).length, 0,
             'acid passive still fires after the blob dies');

await run(8);
assert.equal(game.u.uwep.oeroded2, 1,
             'black-pudding passive corrodes the katana');
assert.equal(liveMonsters(PMNAMES.PM_BLACK_PUDDING).length, 2,
             'iron-weapon hit also preserves black-pudding division');

await run(9);
assert.equal(game.u.uhp, 150,
             'Oracle passive magic missiles damage an unresistant hero');

await run(10);
assert.equal(game.u.uarmg.spe, 2,
             'disenchanter drains one enchantment from striking gloves');

await run(11);
assert.equal(game.u.umortality, 1,
             'barehanded cockatrice contact reaches the death path');
assert.ok(game.u.uhp > 0,
          'debug death refusal leaves the petrified hero alive');

console.log('passive retaliation state: PASS');
