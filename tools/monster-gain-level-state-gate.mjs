#!/usr/bin/env node

// State checks for the gain-level-potion branch of src/muse.c use_misc().
// The paired C recording pins the same visible growth, upward migration, and
// blocked-migration cases at every input boundary.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';

const recipePath = new URL('gen-sessions/recipes/monster-gain-level.json',
                           import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));

async function run(index) {
    await runSegment({ ...recipe.segments[index], onFrame: () => {} });
}

function activeGiants() {
    return (game.level.monsters || []).filter(mon =>
        mon.mnum === PMNAMES.PM_STONE_GIANT && (mon.mhp || 0) > 0);
}

function migratingGiants() {
    return (game.migrating_mons || []).filter(mon =>
        mon.mnum === PMNAMES.PM_STONE_GIANT && (mon.mhp || 0) > 0);
}

function hasGainLevelPotion(mon) {
    return (mon.minvent || []).some(obj =>
        obj.otyp === ONAMES.POT_GAIN_LEVEL);
}

function assertNoFormerMarker() {
    assert.ok(!(game.unported || new Set()).has(
        'use_misc:cursed_gain_level'),
    'gain-level cases leave no former cursed-branch marker');
}

await run(0);
let giant = activeGiants()[0];
assert.ok(giant, 'the uncursed case keeps the stone giant on the level');
assert.equal(giant.m_lev, 9,
             'the uncursed potion raises the C-recorded monster level');
assert.equal(giant.mhpmax, 35,
             'the uncursed potion applies the C-recorded maximum HP gain');
assert.equal(game.objects[ONAMES.POT_GAIN_LEVEL].oc_name_known, 1,
             'watching the uncursed potion identifies its type');
assert.ok(!hasGainLevelPotion(giant),
          'the uncursed potion is consumed from monster inventory');
assertNoFormerMarker();

await run(1);
assert.equal(activeGiants().length, 0,
             'the cursed rising case removes the giant from this level');
assert.equal(migratingGiants().length, 1,
             'the cursed rising case places the giant on the migration list');
giant = migratingGiants()[0];
assert.deepEqual({ dnum: giant.mux, dlevel: giant.muy },
                 { dnum: 0, dlevel: 1 },
                 'the cursed potion sends the giant one depth upward');
assert.deepEqual(giant.mtrack[1], { x: 14, y: 11 },
                 'migration preserves the giant\'s departure square');
assert.equal(game.level.monAt?.get('14,11'), undefined,
             'migration clears the old positional-map cell');
assert.ok(!hasGainLevelPotion(giant),
          'the cursed rising potion is consumed before migration');
assert.equal(game.objects[ONAMES.POT_GAIN_LEVEL].oc_name_known, 0,
             'canceling the appearance prompt leaves the cursed potion unknown');
assertNoFormerMarker();

await run(2);
assert.equal(migratingGiants().length, 0,
             'surface-level use does not migrate the giant');
giant = activeGiants()[0];
assert.ok(giant, 'the blocked cursed case leaves the giant on this level');
assert.equal(giant.m_lev, 5,
             'a blocked cursed potion does not raise the monster level');
assert.ok(!hasGainLevelPotion(giant),
          'the blocked cursed potion is still consumed');
assert.equal(game.objects[ONAMES.POT_GAIN_LEVEL].oc_name_known, 0,
             'the canceled blocked-case prompt leaves the potion unknown');
assertNoFormerMarker();

console.log('monster gain-level potion state: PASS');
