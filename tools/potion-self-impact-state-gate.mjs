#!/usr/bin/env node

// State checks for upward-thrown potions which fall back onto the hero.
// The C recording pins every visible frame and RNG draw; these assertions
// pin hit points, timed speed, object disposal, and implementation coverage.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { ONAMES } from '../js/objects_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/potion-self-impact.json', import.meta.url),
'utf8'));

const potionTypes = [
    ONAMES.POT_ACID,
    ONAMES.POT_HALLUCINATION,
    ONAMES.POT_SICKNESS,
    ONAMES.POT_SPEED,
    ONAMES.POT_RESTORE_ABILITY,
];

const states = [];
for (const [index, segment] of recipe.segments.entries()) {
    await runSegment({ ...segment, onFrame: () => {} });
    states.push({
        hp: game.u.uhp | 0,
        maxHp: game.u.uhpmax | 0,
        fastTimeout: (game.u.intrinsic?.HFast | 0),
        constitutionExercise: game.u.aexe?.a?.[4] | 0,
        wishedPotionStillCarried: (game.invent || []).some(
            obj => obj.otyp === potionTypes[index]),
        unported: [...(game.unported || [])],
    });
}

assert.deepEqual(states.map(({ hp, maxHp }) => [hp, maxHp]), [
    [110, 118],
    [102, 102],
    [135, 141],
    [117, 118],
    [116, 118],
], 'impact and potion-specific damage match the five C recordings');

assert.equal(states[0].constitutionExercise, -1,
             'acid vapor exercises constitution downward');
assert.equal(states[2].constitutionExercise, -1,
             'sickness vapor exercises constitution downward');
assert.equal(states[3].fastTimeout, 4,
             'speed vapor preserves the C-recorded four-turn timeout');

for (const [index, state] of states.entries()) {
    assert.equal(state.wishedPotionStillCarried, false,
                 `segment ${index} consumes the thrown potion`);
    assert.ok(!state.unported.some(path =>
        path.includes('vertical_throw')
        || path.includes('potionbreathe')
        || path.includes('potionhit')),
    `segment ${index} leaves no vertical-throw or potion implementation marker`);
}

console.log('upward-thrown potion self-impact state: PASS');
