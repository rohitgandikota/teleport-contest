#!/usr/bin/env node

// State checks for src/potion.c:potionhit() when an upward-thrown
// polymorph potion falls back onto the hero. The C recording pins every
// frame and RNG draw; these assertions pin both guarded and unguarded forms.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/potion-hero-polymorph-impact.json', import.meta.url),
'utf8'));

const states = [];
for (const segment of recipe.segments) {
    await runSegment({ ...segment, onFrame: () => {} });
    states.push({
        umonster: game.u.umonster,
        umonnum: game.u.umonnum,
        hp: game.u.uhp | 0,
        maxHp: game.u.uhpmax | 0,
        monsterHp: game.u.mh | 0,
        monsterMaxHp: game.u.mhmax | 0,
        monsterTimer: game.u.mtimedone | 0,
        cloak: game.u.uarmc?.otyp ?? null,
        amulet: game.u.uamul?.otyp ?? null,
        weapon: game.u.uwep?.otyp ?? null,
        blind: !!game.u.ublind,
        potionCount: (game.invent || []).filter(obj =>
            obj.otyp === ONAMES.POT_POLYMORPH)
            .reduce((total, obj) => total + (obj.quan | 0), 0),
        unported: [...(game.unported || [])],
    });
}

const antimagic = states[0];
assert.equal(antimagic.umonnum, antimagic.umonster,
             'the worn magic-resistance cloak blocks polymorph');
assert.equal(antimagic.cloak, ONAMES.CLOAK_OF_MAGIC_RESISTANCE,
             'the Antimagic guard remains worn after the impact');
assert.deepEqual([antimagic.hp, antimagic.maxHp], [11, 12],
                 'the guarded hero takes only the C-recorded shard damage');

const unchanging = states[1];
assert.equal(unchanging.umonnum, unchanging.umonster,
             'the amulet of unchanging blocks polymorph');
assert.equal(unchanging.amulet, ONAMES.AMULET_OF_UNCHANGING,
             'the Unchanging guard remains worn after the impact');
assert.equal(unchanging.cloak, null,
             'the Unchanging case has no Antimagic cloak equipped');

const transformed = states[2];
assert.equal(transformed.umonnum, PMNAMES.PM_GELATINOUS_CUBE,
             'unguarded polymorph chooses the C-recorded gelatinous cube');
assert.deepEqual([transformed.monsterHp, transformed.monsterMaxHp], [35, 35],
                 'the gelatinous cube receives the C-recorded hit points');
assert.equal(transformed.monsterTimer, 707,
             'the new form receives the C-recorded polymorph timeout');
assert.equal(transformed.cloak, null,
             'the cube cannot keep wearing the removed cloak');
assert.equal(transformed.weapon, null,
             'the cube drops the incompatible quarterstaff');
assert.equal(transformed.blind, true,
             'the eyeless gelatinous cube is blind');

for (const [index, state] of states.entries()) {
    assert.equal(state.potionCount, 0,
                 `segment ${index} consumes the polymorph potion`);
    assert.ok(!state.unported.some(path =>
        path.includes('potionhit') || path.includes('polyself')),
    `segment ${index} leaves no potionhit or polyself implementation marker`);
}

console.log('hero polymorph potion impact state: PASS');
