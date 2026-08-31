#!/usr/bin/env node

// State checks for the invisibility-item branch of src/muse.c use_misc().
// The paired C recording pins visible, seen-invisible, hallucinating, cursed,
// blind, and wand output at every input boundary.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';

const recipePath = new URL('gen-sessions/recipes/monster-invisibility-use.json',
                           import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));

async function run(index) {
    await runSegment({ ...recipe.segments[index], onFrame: () => {} });
}

function stoneGiant() {
    return (game.level.monsters || []).find(mon =>
        mon.mnum === PMNAMES.PM_STONE_GIANT && (mon.mhp || 0) > 0);
}

function carried(mon, otyp) {
    return (mon?.minvent || []).find(obj => obj.otyp === otyp);
}

function rememberedKind(mon) {
    return game.level.at(mon.mx, mon.my)?.remembered_glyph?.glyph?.kind;
}

function assertInvisible(mon, label) {
    assert.equal(mon.perminvis, 1, `${label} grants permanent invisibility`);
    assert.equal(mon.minvis, 1, `${label} makes the monster invisible now`);
}

function assertNoFormerMarker() {
    assert.ok(!(game.unported || new Set()).has('use_misc:you_aggravate'),
              'invisibility cases leave no former aggravation marker');
}

await run(0);
let giant = stoneGiant();
assertInvisible(giant, 'ordinary potion');
assert.equal(carried(giant, ONAMES.POT_INVISIBILITY), undefined,
             'the ordinary potion is consumed');
assert.equal(game.objects[ONAMES.POT_INVISIBILITY].oc_name_known, 1,
             'watching the ordinary potion identify its type');
assert.equal(rememberedKind(giant), 'invis',
             'losing sight of the monster leaves an invisible-map marker');
assertNoFormerMarker();

await run(1);
giant = stoneGiant();
assertInvisible(giant, 'see-invisible potion');
assert.equal(game.objects[ONAMES.POT_INVISIBILITY].oc_name_known, 1,
             'seeing through invisibility still identifies the potion');
assert.notEqual(rememberedKind(giant), 'invis',
                'a monster still in sight does not leave an invisible marker');
assertNoFormerMarker();

await run(2);
giant = stoneGiant();
assertInvisible(giant, 'hallucinating potion');
assert.equal(game.objects[ONAMES.POT_INVISIBILITY].oc_name_known, 1,
             'the hallucinating visible case identifies the potion');
assertNoFormerMarker();

await run(3);
giant = stoneGiant();
assert.equal(giant.perminvis | 0, 0,
             'a cursed potion grants no permanent invisibility');
assert.equal(giant.minvis | 0, 0,
             'a cursed potion leaves the monster visible');
assert.equal(carried(giant, ONAMES.POT_INVISIBILITY), undefined,
             'the cursed potion is consumed after aggravating the hero');
assert.equal(game.objects[ONAMES.POT_INVISIBILITY].oc_name_known, 0,
             'a visibly failed cursed potion remains unidentified');
assert.notEqual(rememberedKind(giant), 'invis',
                'the aggravation redraw leaves no stale invisible marker');
assertNoFormerMarker();

await run(4);
giant = stoneGiant();
assertInvisible(giant, 'unseen potion');
assert.equal(game.objects[ONAMES.POT_INVISIBILITY].oc_name_known, 0,
             'hearing a potion does not identify its type');
assertNoFormerMarker();

await run(5);
giant = stoneGiant();
assertInvisible(giant, 'self-zapped wand');
const wand = carried(giant, ONAMES.WAN_MAKE_INVISIBLE);
assert.ok(wand, 'the wand remains in monster inventory');
assert.equal(wand.spe, 2, 'self-zapping spends exactly one wand charge');
assert.equal(game.objects[ONAMES.WAN_MAKE_INVISIBLE].oc_name_known, 1,
             'seeing the wand effect identifies its type');
assertNoFormerMarker();

console.log('monster invisibility item state: PASS');
