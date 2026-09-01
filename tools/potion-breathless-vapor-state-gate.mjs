#!/usr/bin/env node

// State checks for cursed ability vapor on a breathless hero. The C trace
// pins the anatomy messages; these assertions pin the unchanged attributes,
// vampire form, wet-towel protection, disposal, and implementation coverage.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/potion-breathless-vapor.json', import.meta.url),
'utf8'));

const states = [];
for (const segment of recipe.segments) {
    await runSegment({ ...segment, onFrame: () => {} });
    states.push({
        form: game.u.umonnum,
        base: [...game.u.acurr.a],
        max: [...game.u.amax.a],
        towel: game.u.ublindf ? {
            otyp: game.u.ublindf.otyp,
            spe: game.u.ublindf.spe | 0,
        } : null,
        carriesCursedAbilityPotion: (game.invent || []).some(obj =>
            obj.cursed && (obj.otyp === ONAMES.POT_RESTORE_ABILITY
                           || obj.otyp === ONAMES.POT_GAIN_ABILITY)),
        unported: [...(game.unported || [])],
    });
}

for (const [index, state] of states.entries()) {
    assert.equal(state.form, PMNAMES.PM_VAMPIRE,
                 `segment ${index} remains in breathless vampire form`);
    assert.deepEqual(state.base, state.max,
                     `segment ${index} cursed vapor does not alter attributes`);
    assert.equal(state.carriesCursedAbilityPotion, false,
                 `segment ${index} consumes the cursed test potion`);
    assert.ok(!state.unported.some(path =>
        path.includes('vertical_throw')
        || path.includes('breakobj')
        || path.includes('potionbreathe')),
    `segment ${index} leaves no surface-break or potion vapor marker`);
}

assert.equal(states[0].towel, null,
             'uncovered breathless test has no face protection');
assert.deepEqual(states[1].towel, { otyp: ONAMES.TOWEL, spe: 3 },
                 'protected test keeps the C-recorded wet towel worn');

console.log('breathless potion vapor state: PASS');
