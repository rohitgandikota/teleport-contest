#!/usr/bin/env node

// State checks for src/muse.c mloot_container(). The paired C recording pins
// output, random-call order, and the selected objects.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { weight } from '../js/invent.js';
import { mloot_container } from '../js/muse.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { OBJ_CONTAINED, OBJ_MINVENT } from '../js/const.js';

const recipePath = new URL('gen-sessions/recipes/monster-container-loot.json',
                           import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));

await runSegment({ ...recipe.segments[0], onFrame: () => {} });

const goblin = (game.level.monsters || []).find(mon =>
    mon.mnum === PMNAMES.PM_GOBLIN && (mon.mhp || 0) > 0);
assert.ok(goblin, 'the container user remains alive');

const sack = (goblin.minvent || []).find(obj => obj.otyp === ONAMES.SACK);
assert.ok(sack, 'the monster keeps carrying the rummaged sack');
assert.equal(sack.where, OBJ_MINVENT,
             'the sack remains in monster inventory');
assert.equal(sack.ocarry, goblin,
             'the sack carrier pointer remains the goblin');
assert.equal(sack.cknown, 0,
             'observed removal clears knowledge of remaining contents');
assert.equal(sack.owt, weight(sack),
             'the sack weight tracks its remaining contents');

assert.equal(sack.cobj.length, 1,
             'one of four gems remains after the C-recorded removals');
const remaining = sack.cobj[0];
assert.equal(remaining.otyp, ONAMES.EMERALD,
             'the same randomly selected gem remains as in C');
assert.equal(remaining.where, OBJ_CONTAINED,
             'the remaining gem stays linked as container contents');
assert.equal(remaining.ocontainer, sack,
             'the remaining gem points back to its sack');

const extractedTypes = new Set((goblin.minvent || [])
    .filter(obj => obj.where === OBJ_MINVENT && obj.ocarry === goblin)
    .map(obj => obj.otyp));
for (const otyp of [ONAMES.DIAMOND, ONAMES.RUBY, ONAMES.SAPPHIRE]) {
    assert.ok(extractedTypes.has(otyp),
              `the C-selected gem ${otyp} moves to monster inventory`);
}

assert.ok(!(game.unported || new Set()).has('use_misc:10'),
          'container use leaves no former MUSE_BAG marker');

const saved = {
    otyp: sack.otyp,
    cursed: sack.cursed,
    olocked: sack.olocked,
    spe: sack.spe,
    cobj: sack.cobj,
};
const remainingCount = sack.cobj.length;

sack.olocked = 1;
assert.equal(await mloot_container(goblin, sack, true), 0,
             'a locked container cannot be rummaged');
assert.equal(sack.cobj.length, remainingCount,
             'a locked-container attempt moves no contents');
sack.olocked = 0;

sack.otyp = ONAMES.BAG_OF_HOLDING;
sack.cursed = 1;
assert.equal(await mloot_container(goblin, sack, true), 0,
             'a cursed magical bag is rejected before random removal');
assert.equal(sack.cobj.length, remainingCount,
             'a cursed magical bag keeps all contents');
sack.cursed = 0;

sack.otyp = ONAMES.LARGE_BOX;
sack.spe = 1;
assert.equal(await mloot_container(goblin, sack, true), 0,
             'Schroedinger\'s box is not opened by a monster');
assert.equal(sack.cobj.length, remainingCount,
             'Schroedinger\'s box keeps its contents');

sack.otyp = saved.otyp;
sack.spe = saved.spe;
sack.cobj = [];
assert.equal(await mloot_container(goblin, sack, true), 0,
             'an empty container produces no action');
sack.cobj = saved.cobj;
sack.cursed = saved.cursed;
sack.olocked = saved.olocked;

console.log('monster container rummaging state: PASS');
