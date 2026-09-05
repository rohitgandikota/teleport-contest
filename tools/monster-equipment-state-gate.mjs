#!/usr/bin/env node

// State checks for src/worn.c m_dowear_type(). The paired C recording pins
// the visible replacement, autocurse, and visibility messages while this
// gate checks the worn masks and properties those messages describe.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { W_ARMC, W_ARMH } from '../js/const.js';

const recipePath = new URL(
    'gen-sessions/recipes/monster-equipment-branches.json', import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));

async function run(index) {
    await runSegment({ ...recipe.segments[index], onFrame: () => {} });
}

function liveMonster(mnum) {
    return (game.level.monsters || []).find(mon =>
        mon.mnum === mnum && (mon.mhp | 0) > 0);
}

function carried(mon, otyp) {
    return (mon?.minvent || []).filter(obj => obj.otyp === otyp);
}

await run(0);
let mon = liveMonster(PMNAMES.PM_BUGBEAR);
assert.ok(mon, 'the upgrade fixture keeps its bugbear alive');
let helmets = carried(mon, ONAMES.HELMET);
assert.equal(helmets.length, 2,
             'the bugbear retains both identical-looking helmets');
let worn = helmets.find(obj => obj.owornmask & W_ARMH);
let old = helmets.find(obj => !(obj.owornmask & W_ARMH));
assert.ok(worn && old, 'exactly one of the two helmets remains worn');
assert.equal(worn.spe, 5, 'the better +5 helmet replaces the original');
assert.equal(old.spe, 0, 'the original +0 helmet is left unworn');
assert.ok(mon.misc_worn_check & W_ARMH,
          'the monster head slot remains marked occupied');

await run(1);
mon = liveMonster(PMNAMES.PM_BUGBEAR);
assert.ok(mon, 'the autocurse fixture keeps its bugbear alive');
const cap = carried(mon, ONAMES.DUNCE_CAP)[0];
assert.ok(cap, 'the bugbear retains the dunce cap');
assert.equal(cap.owornmask & W_ARMH, W_ARMH,
             'the dunce cap occupies the monster head slot');
assert.equal(cap.cursed, 1,
             'putting on a dunce cap automatically curses it');
assert.ok(mon.misc_worn_check & W_ARMH,
          'autocursing does not clear the occupied head slot');

await run(2);
mon = liveMonster(PMNAMES.PM_GNOME_LEADER);
assert.ok(mon, 'the visibility fixture keeps its gnome lord alive');
const cloak = carried(mon, ONAMES.CLOAK_OF_INVISIBILITY)[0];
assert.ok(cloak, 'the gnome lord retains the invisibility cloak');
assert.equal(cloak.owornmask & W_ARMC, W_ARMC,
             'the invisibility cloak occupies the monster cloak slot');
assert.ok(mon.misc_worn_check & W_ARMC,
          'the monster cloak slot remains marked occupied');
assert.equal(mon.perminvis | 0, 0,
             'the cloak does not grant permanent innate invisibility');
assert.equal(mon.minvis | 0, 1,
             'the worn cloak makes the monster currently invisible');
assert.equal(game.objects[ONAMES.CLOAK_OF_INVISIBILITY].oc_name_known, 1,
             'seeing the monster disappear identifies the cloak type');

const formerMarkers = new Set([
    'm_dowear_type:autocurse-message',
    'm_dowear_type:visibility-change',
]);
assert.ok(![...(game.unported || [])].some(path => formerMarkers.has(path)),
          'monster equipment cases leave no former implementation marker');

console.log('monster equipment replacement and visibility state: PASS');
