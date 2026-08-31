#!/usr/bin/env node

// State checks for src/uhitm.c mhitm_ad_ench() and src/zap.c drain_item().
// The paired C recording pins the terminal output and RNG order.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { A_STR, A_INT, A_WIS, A_DEX, A_CON, A_CHA } from '../js/const.js';
import { ONAMES } from '../js/objects_data.js';

const recipePath = new URL('gen-sessions/recipes/disenchantment-controls.json',
                           import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));

async function run(index) {
    await runSegment({ ...recipe.segments[index], onFrame: () => {} });
}

function bonus(attribute) {
    return game.u.abon?.a?.[attribute] || 0;
}

await run(0);
assert.equal(game.u.uarmg?.otyp, ONAMES.GAUNTLETS_OF_DEXTERITY,
             'dexterity gauntlets remain worn');
assert.equal(game.u.uarmg.spe, 2,
             'disenchanter drains one gauntlet enchantment');
assert.equal(bonus(A_DEX), 2,
             'gauntlet drain lowers the active dexterity bonus');

await run(1);
assert.equal(game.u.uarmh?.otyp, ONAMES.HELM_OF_BRILLIANCE,
             'helm of brilliance remains worn');
assert.equal(game.u.uarmh.spe, 2,
             'disenchanter drains one helm enchantment');
assert.equal(bonus(A_INT), 2,
             'helm drain lowers the active intelligence bonus');
assert.equal(bonus(A_WIS), 2,
             'helm drain lowers the active wisdom bonus');

await run(2);
assert.equal(game.u.uright?.otyp, ONAMES.RIN_GAIN_STRENGTH,
             'gain-strength ring remains worn');
assert.equal(game.u.uright.spe, 2,
             'disenchanter drains one strength-ring enchantment');
assert.equal(bonus(A_STR), 2,
             'ring drain lowers the active strength bonus');

await run(3);
assert.equal(game.u.uright?.otyp, ONAMES.RIN_GAIN_CONSTITUTION,
             'gain-constitution ring remains worn');
assert.equal(game.u.uright.spe, 2,
             'disenchanter drains one constitution-ring enchantment');
assert.equal(bonus(A_CON), 2,
             'ring drain lowers the active constitution bonus');

await run(4);
assert.equal(game.u.uright?.otyp, ONAMES.RIN_ADORNMENT,
             'adornment ring remains worn');
assert.equal(game.u.uright.spe, 2,
             'disenchanter drains one adornment enchantment');
assert.equal(bonus(A_CHA), 2,
             'ring drain lowers the active charisma bonus');

await run(5);
assert.equal(game.u.uright?.otyp, ONAMES.RIN_INCREASE_ACCURACY,
             'accuracy ring remains worn');
assert.equal(game.u.uright.spe, 2,
             'disenchanter drains one accuracy enchantment');
assert.equal(game.u.uhitinc, 2,
             'accuracy drain lowers the active to-hit bonus');

await run(6);
assert.equal(game.u.uright?.otyp, ONAMES.RIN_INCREASE_DAMAGE,
             'damage ring remains worn');
assert.equal(game.u.uright.spe, 2,
             'disenchanter drains one damage enchantment');
assert.equal(game.u.udaminc, 2,
             'damage drain lowers the active damage bonus');

await run(7);
assert.equal(game.u.uright?.otyp, ONAMES.RIN_PROTECTION,
             'protection ring remains worn');
assert.equal(game.u.uright.spe, 2,
             'disenchanter drains one protection enchantment');
assert.equal(game.u.uac, 8,
             'next input boundary recalculates AC from drained protection');

console.log('disenchantment state: PASS');
