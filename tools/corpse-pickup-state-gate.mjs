#!/usr/bin/env node

// State checks for the corpse safety paths in src/pickup.c. The matching C
// recipe pins every visible frame and random draw for the same cases.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { W_ARMG } from '../js/const.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { worn } from '../js/do_wear.js';
import { Stone_resistance } from '../js/youprop.js';

const recipePath = new URL('gen-sessions/recipes/corpse-pickup-safety.json',
                           import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));

async function run(index) {
    await runSegment({ ...recipe.segments[index], onFrame: () => {} });
}

function hasCorpse(chain, mnum) {
    return (chain || []).some(obj => obj.otyp === ONAMES.CORPSE
                                  && obj.corpsenm === mnum);
}

function hasInventoryCorpse(mnum) {
    return hasCorpse(game.invent, mnum);
}

function hasFloorCorpse(mnum) {
    return hasCorpse(game.level.objects, mnum);
}

function liveMonster(mnum) {
    return (game.level.monsters || []).find(mon => mon.mnum === mnum
                                             && (mon.mhp || 0) > 0);
}

await run(0);
assert.equal(worn(W_ARMG), null, 'fatal-contact hero has no gloves');
assert.equal(Stone_resistance(), false,
             'fatal-contact hero has no stone resistance');
assert.ok(game.u.uhp > 0, 'debug death refusal leaves the hero alive');
assert.equal(hasInventoryCorpse(PMNAMES.PM_COCKATRICE), false,
             'fatal contact does not add the corpse to inventory');
assert.equal(hasFloorCorpse(PMNAMES.PM_COCKATRICE), true,
             'fatal contact leaves the corpse on the floor');

await run(1);
assert.ok(worn(W_ARMG), 'glove-safe hero is wearing gloves');
assert.equal(hasInventoryCorpse(PMNAMES.PM_COCKATRICE), true,
             'gloves permit cockatrice corpse pickup');
assert.equal(hasFloorCorpse(PMNAMES.PM_COCKATRICE), false,
             'glove-safe pickup removes the corpse from the floor');

await run(2);
assert.equal(worn(W_ARMG), null,
             'resistance case does not gain safety from gloves');
assert.equal(Stone_resistance(), true,
             'yellow dragon scale mail supplies stone resistance');
assert.equal(hasInventoryCorpse(PMNAMES.PM_COCKATRICE), true,
             'stone resistance permits cockatrice corpse pickup');

await run(3);
assert.equal(hasInventoryCorpse(PMNAMES.PM_NEWT), true,
             'ordinary corpse is picked up without special protection');
assert.equal(hasFloorCorpse(PMNAMES.PM_NEWT), false,
             'ordinary corpse leaves the floor after pickup');

await run(4);
assert.equal(game.u.umonnum, PMNAMES.PM_STONE_GOLEM,
             'flesh golem becomes a stone golem on contact');
assert.equal(game.u.mh, 100, 'stone golem receives fixed current hit points');
assert.equal(game.u.mhmax, 100,
             'stone golem receives fixed maximum hit points');
assert.equal(hasInventoryCorpse(PMNAMES.PM_COCKATRICE), true,
             'converted stone golem completes the corpse pickup');

await run(5);
let death = liveMonster(PMNAMES.PM_DEATH);
assert.ok(death, 'direct contact revives Death');
assert.equal(death.cham, PMNAMES.PM_DOPPELGANGER,
             'revived unique corpse retains its doppelganger base form');
assert.equal(death.mrevived, 1, 'directly revived Rider is marked revived');
assert.equal(hasInventoryCorpse(PMNAMES.PM_DEATH), false,
             'direct Rider revival does not add the corpse to inventory');
assert.equal(hasFloorCorpse(PMNAMES.PM_DEATH), false,
             'direct Rider revival consumes the corpse');

await run(6);
assert.equal(worn(W_ARMG), null,
             'remote cockatrice case does not gain safety from gloves');
assert.equal(Stone_resistance(), false,
             'remote cockatrice case has no stone resistance');
assert.equal(game.u.umonnum, PMNAMES.PM_ARCHEOLOGIST,
             'remote pickup does not petrify or polymorph the hero');
assert.equal(hasInventoryCorpse(PMNAMES.PM_COCKATRICE), true,
             'successful bullwhip acquisition adds the corpse to inventory');
assert.equal(hasFloorCorpse(PMNAMES.PM_COCKATRICE), false,
             'successful remote acquisition removes the corpse from the floor');

await run(7);
death = liveMonster(PMNAMES.PM_DEATH);
assert.ok(death, 'remote acquisition attempt revives Death');
assert.equal(death.cham, PMNAMES.PM_DOPPELGANGER,
             'remotely revived unique corpse keeps its shapechanger base');
assert.equal(death.mrevived, 1, 'remotely revived Rider is marked revived');
assert.equal(hasInventoryCorpse(PMNAMES.PM_DEATH), false,
             'remote Rider revival does not add the corpse to inventory');
assert.equal(hasFloorCorpse(PMNAMES.PM_DEATH), false,
             'remote Rider revival consumes the corpse');

console.log('corpse pickup state: PASS');
