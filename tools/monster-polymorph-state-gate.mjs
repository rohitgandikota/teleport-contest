#!/usr/bin/env node

// State checks for the polymorph-item and deliberate-trap arms of
// src/muse.c use_misc(). The paired C recording pins output and RNG order.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { POLY_TRAP, W_ARMH } from '../js/const.js';

const recipePath = new URL('gen-sessions/recipes/monster-polymorph-use.json',
                           import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));

async function run(index) {
    await runSegment({ ...recipe.segments[index], onFrame: () => {} });
}

function liveMonster(mnum, predicate = () => true) {
    return (game.level.monsters || []).find(mon =>
        mon.mnum === mnum && (mon.mhp || 0) > 0 && predicate(mon));
}

function carried(mon, otyp) {
    return (mon?.minvent || []).find(obj => obj.otyp === otyp);
}

function floorObject(otyp, x, y) {
    return (game.level.objects || []).find(obj =>
        obj.otyp === otyp && obj.ox === x && obj.oy === y);
}

function assertNoFormerMarkers() {
    const paths = [...(game.unported || [])];
    assert.ok(!paths.some(path =>
        path === 'use_misc:4' || path === 'use_misc:5'
        || path === 'use_misc:9'
        || path === 'possibly_unwield:drop'),
    'polymorph cases leave no former use or weapon-drop marker');
}

await run(0);
let mon = liveMonster(PMNAMES.PM_NEWT,
                      candidate => !!carried(candidate, ONAMES.WAN_POLYMORPH));
assert.ok(mon, 'the wand user becomes the C-recorded newt');
let wand = carried(mon, ONAMES.WAN_POLYMORPH);
assert.equal(wand.spe, 2, 'the wand remains carried after spending one charge');
assert.equal(game.objects[ONAMES.WAN_POLYMORPH].oc_name_known, 1,
             'seeing the self-zap identifies the polymorph wand');
assert.equal((mon.minvent || []).some(obj => obj.owornmask & W_ARMH), false,
             'the handless new form no longer wears the goblin helmet');
const helmet = floorObject(ONAMES.ORCISH_HELM, mon.mx, mon.my);
assert.ok(helmet, 'the unusable helmet lands at the polymorph square');
assert.equal(helmet.owornmask | 0, 0,
             'the dropped helmet has no worn-state bits');
// C allmain.c:195 clears beam bypasses before accepting another command.
assert.equal(helmet.bypass, 0,
             'the completed beam leaves no bypass on the dropped helmet');
assert.ok(!game.context.bypasses, 'completed command clears the bypass context');
assertNoFormerMarkers();

await run(1);
mon = liveMonster(PMNAMES.PM_GRID_BUG,
                  candidate => candidate.mx > 30);
assert.ok(mon, 'the potion user becomes the C-recorded grid bug');
assert.equal(carried(mon, ONAMES.POT_POLYMORPH), undefined,
             'the polymorph potion is consumed before shape change');
assert.equal(game.objects[ONAMES.POT_POLYMORPH].oc_name_known, 1,
             'seeing the mutation identifies the polymorph potion');
assertNoFormerMarkers();

await run(2);
mon = liveMonster(PMNAMES.PM_OWLBEAR,
                  candidate => candidate.mx === game.trapx
                               && candidate.my === game.trapy);
assert.ok(mon, 'the deliberate trap user becomes the C-recorded owlbear');
const trap = (game.level.traps || []).find(candidate =>
    candidate.tx === game.trapx && candidate.ty === game.trapy);
assert.ok(trap, 'the selected polymorph trap remains on the level');
assert.equal(trap.ttyp, POLY_TRAP, 'the selected trap is polymorph');
assert.equal(trap.tseen, 1, 'deliberate visible use reveals the trap');
assert.equal(game.level.monAt.get(`${game.trapx},${game.trapy}`), mon,
             'trap relocation updates the positional monster map');
assert.equal(game.level.monAt.get('40,5'), undefined,
             'trap relocation clears the monster\'s former square');
assertNoFormerMarkers();

console.log('monster polymorph item and trap state: PASS');
