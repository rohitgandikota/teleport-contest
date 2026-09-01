#!/usr/bin/env node

// State checks for potions shattered against the ceiling and floor. The C
// recording pins messages and RNG order; these assertions pin damage, object
// disposal, stack splitting, and the absence of implementation markers.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { ONAMES } from '../js/objects_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/potion-surface-breakage.json', import.meta.url),
'utf8'));

const targetTypes = [
    ONAMES.POT_HALLUCINATION,
    ONAMES.POT_HALLUCINATION,
    ONAMES.POT_OIL,
    ONAMES.POT_GAIN_LEVEL,
    ONAMES.POT_WATER,
];

const states = [];
for (const [index, segment] of recipe.segments.entries()) {
    await runSegment({ ...segment, onFrame: () => {} });
    const targetType = targetTypes[index];
    states.push({
        hp: game.u.uhp | 0,
        maxHp: game.u.uhpmax | 0,
        carriedTargetQuantity: (game.invent || [])
            .filter(obj => obj.otyp === targetType)
            .reduce((sum, obj) => sum + (obj.quan | 0), 0),
        targetOnFloor: (game.level.objects || [])
            .some(obj => obj.otyp === targetType
                      && obj.ox === game.u.ux && obj.oy === game.u.uy),
        unported: [...(game.unported || [])],
    });
}

assert.deepEqual(states.map(({ hp, maxHp }) => [hp, maxHp]), [
    [128, 128],
    [118, 118],
    [118, 118],
    [118, 118],
    [118, 118],
], 'surface breakage exposes the hero to vapor without shard damage');

assert.deepEqual(states.slice(0, 4).map(s => s.carriedTargetQuantity),
                 [0, 0, 0, 0],
                 'each non-water test potion is fully consumed');
assert.equal(states[4].carriedTargetQuantity, 1,
             'throwing one potion from the two-water stack leaves one');

for (const [index, state] of states.entries()) {
    assert.equal(state.targetOnFloor, false,
                 `segment ${index} leaves no shattered potion on the floor`);
    assert.ok(!state.unported.some(path =>
        path.includes('vertical_throw')
        || path.includes('breakobj')
        || path.includes('potionbreathe')),
    `segment ${index} leaves no surface-break or potion vapor marker`);
}

console.log('vertical potion surface breakage state: PASS');
