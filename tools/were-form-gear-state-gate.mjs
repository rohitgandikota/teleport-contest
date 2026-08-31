#!/usr/bin/env node

// State checks for src/were.c form changes, src/read.c taming, and the
// equipment shedding which follows a were creature's human-to-beast change.
// The paired C recording pins messages, paging, and random-call order.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { Protection_from_shape_changers } from '../js/youprop.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { W_ARMH, W_WEP } from '../js/const.js';

const recipePath = new URL('gen-sessions/recipes/were-form-gear.json',
                           import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));
const watchedSteps = new Set([298, 319, 322, 323, 326]);
const trace = new Map();

function liveWere(state) {
    return (state.level.monsters || []).find(mon =>
        (mon.mnum === PMNAMES.PM_HUMAN_WEREWOLF
         || mon.mnum === PMNAMES.PM_WEREWOLF)
        && (mon.mhp || 0) > 0);
}

function carried(mon, otyp) {
    return (mon?.minvent || []).find(obj => obj.otyp === otyp);
}

globalThis.__step_snapshot = {
    step: '*',
    cb: (state, step) => {
        if (!watchedSteps.has(step))
            return;
        const mon = liveWere(state);
        assert.ok(mon, `were creature exists at step ${step}`);
        trace.set(step, {
            mnum: mon.mnum,
            mx: mon.mx,
            my: mon.my,
            peaceful: !!mon.mpeaceful,
            tame: mon.mtame | 0,
            protected: Protection_from_shape_changers(),
            helmetMask: carried(mon, ONAMES.HELMET)?.owornmask | 0,
            swordMask: carried(mon, ONAMES.LONG_SWORD)?.owornmask | 0,
            hasHelmet: !!carried(mon, ONAMES.HELMET),
            hasSword: !!carried(mon, ONAMES.LONG_SWORD),
        });
    },
};
try {
    await runSegment({ ...recipe.segments[0], onFrame: () => {} });
} finally {
    delete globalThis.__step_snapshot;
}

const equipped = trace.get(298);
assert.equal(equipped.mnum, PMNAMES.PM_HUMAN_WEREWOLF,
             'shape protection keeps the peaceful werewolf human');
assert.equal(equipped.protected, true,
             'the shape-protection ring is active before removal');
assert.equal(equipped.peaceful, true,
             'the blessed taming scroll pacifies the human werewolf');
assert.equal(equipped.tame, 0,
             'the human werewolf is peaceful but remains untame');
assert.equal(equipped.helmetMask, W_ARMH,
             'the peaceful human form puts on its helmet');
assert.equal(equipped.swordMask, W_WEP,
             'the human form wields its long sword');

const unprotected = trace.get(319);
assert.equal(unprotected.mnum, PMNAMES.PM_HUMAN_WEREWOLF,
             'removing the ring does not transform the monster immediately');
assert.equal(unprotected.protected, false,
             'shape protection ends when the ring is removed');

const changed = trace.get(322);
assert.equal(changed.mnum, PMNAMES.PM_WEREWOLF,
             'the recorded full-moon roll changes the monster into a wolf');
assert.equal(changed.hasHelmet, true,
             'the form-change message precedes armor shedding');
assert.equal(changed.hasSword, true,
             'the form-change message also precedes weapon handling');

const armorDropped = trace.get(323);
assert.equal(armorDropped.hasHelmet, false,
             'the helmet is removed before the weapon is dropped');
assert.equal(armorDropped.hasSword, true,
             'the long sword remains through the helmet-drop message');
assert.equal(armorDropped.swordMask, 0,
             'weapon handling clears the wielded bit before dropping it');

const weaponDropped = trace.get(326);
assert.equal(weaponDropped.hasSword, false,
             'the long sword leaves monster inventory after its drop message');

const werewolf = liveWere(game);
assert.equal(werewolf.mnum, PMNAMES.PM_WEREWOLF,
             'the final monster remains in beast form');
for (const otyp of [ONAMES.SMALL_SHIELD, ONAMES.LEATHER_GLOVES,
                    ONAMES.LOW_BOOTS]) {
    assert.ok(carried(werewolf, otyp),
              `compatible object ${otyp} remains in monster inventory`);
}

const dropped = (game.level.objects || []).filter(obj =>
    obj.ox === changed.mx && obj.oy === changed.my);
assert.ok(dropped.some(obj => obj.otyp === ONAMES.HELMET
                              && !(obj.owornmask | 0)),
          'the unworn helmet lands on the transformation square');
assert.ok(dropped.some(obj => obj.otyp === ONAMES.LONG_SWORD
                              && !(obj.owornmask | 0)),
          'the unwielded sword lands on the transformation square');

assert.equal(game.were_changes, 1,
             'one completed form change is counted');
assert.equal(game.objects[ONAMES.SCR_TAMING].oc_name_known, 1,
             'a visible successful pacification identifies the scroll');
const ring = (game.invent || []).find(obj =>
    obj.otyp === ONAMES.RIN_PROTECTION_FROM_SHAPE_CHAN);
assert.ok(ring && !(ring.owornmask | 0),
          'the removed protection ring remains in inventory and unworn');

const paths = [...(game.unported || [])];
assert.ok(!paths.some(path =>
    path === 'mhitu:summonmu:were'
    || path === 'were:new_were:break_armor_unwield'
    || path === `read:seffects:otyp=${ONAMES.SCR_TAMING}`),
'were transformation and taming leave no former implementation marker');

console.log('were form, taming, and equipment state: PASS');
