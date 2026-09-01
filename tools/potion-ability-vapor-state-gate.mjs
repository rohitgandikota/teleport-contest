#!/usr/bin/env node

// State checks for restore-ability vapor. The C recording includes the
// attributes screen after each impact; these assertions pin the underlying
// base and maximum arrays as well as object disposal and implementation
// coverage.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { ONAMES } from '../js/objects_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/potion-ability-vapor.json', import.meta.url),
'utf8'));

const states = [];
for (const segment of recipe.segments) {
    await runSegment({ ...segment, onFrame: () => {} });
    states.push({
        base: [...game.u.acurr.a],
        max: [...game.u.amax.a],
        carriesTestPotion: (game.invent || []).some(obj =>
            obj.otyp === ONAMES.POT_SICKNESS
            || obj.otyp === ONAMES.POT_RESTORE_ABILITY),
        unported: [...(game.unported || [])],
    });
}

assert.deepEqual(states.map(state => state.base), [
    [12, 18, 8, 15, 11, 8],
    [11, 13, 4, 11, 17, 8],
], 'uncursed vapor restores one deficit and blessed vapor restores both');

assert.deepEqual(states.map(state => state.max), [
    [12, 18, 8, 15, 14, 8],
    [11, 18, 7, 11, 17, 8],
], 'restore-ability vapor does not alter attribute maxima');

for (const [index, state] of states.entries()) {
    assert.equal(state.carriesTestPotion, false,
                 `segment ${index} consumes every test potion`);
    assert.ok(!state.unported.some(path =>
        path.includes('vertical_throw')
        || path.includes('breakobj')
        || path.includes('potionbreathe')),
    `segment ${index} leaves no surface-break or potion vapor marker`);
}

console.log('restore-ability potion vapor state: PASS');
