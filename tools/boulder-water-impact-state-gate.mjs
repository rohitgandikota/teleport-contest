#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { OBJ_FLOOR, POOL, ROOM } from '../js/const.js';
import { ONAMES } from '../js/objects_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/boulder-water-impact.json', import.meta.url),
'utf8'));

function hasBoulderAt(x, y) {
    return (game.level?.objects || []).some(obj =>
        obj.where === OBJ_FLOOR && obj.otyp === ONAMES.BOULDER
        && obj.ox === x && obj.oy === y);
}

function relevantUnported() {
    return [...(game.unported || [])].filter(path =>
        path.includes('boulder_hits_pool')
        || path.includes('moverock')
        || path.includes('melt_ice')
        || path.includes('zap_over_floor'));
}

const states = [];
for (const [index, segment] of recipe.segments.entries()) {
    await runSegment({ ...segment, onFrame: () => {} });
    if (index < 2) {
        states.push({
            hero: [game.u.ux, game.u.uy],
            targetTerrain: game.level.at(17, 15).typ,
            boulderAtSource: hasBoulderAt(16, 15),
            boulderAtTarget: hasBoulderAt(17, 15),
            relevantUnported: relevantUnported(),
        });
    } else {
        states.push({
            hero: [game.u.ux, game.u.uy],
            meltedTerrain: game.level.at(16, 15).typ,
            boulderOnMeltedSquare: hasBoulderAt(16, 15),
            relevantUnported: relevantUnported(),
        });
    }
}

assert.deepEqual(states[0], {
    hero: [16, 15],
    targetTerrain: ROOM,
    boulderAtSource: false,
    boulderAtTarget: false,
    relevantUnported: [],
}, 'successful fill removes the pushed boulder and restores room terrain');

assert.deepEqual(states[1], {
    hero: [16, 15],
    targetTerrain: POOL,
    boulderAtSource: false,
    boulderAtTarget: false,
    relevantUnported: [],
}, 'sink outcome removes the pushed boulder and preserves the pool');

assert.deepEqual(states[2], {
    hero: [15, 15],
    meltedTerrain: ROOM,
    boulderOnMeltedSquare: false,
    relevantUnported: [],
}, 'fire melts ice and its falling boulder fills the restored moat');

console.log('boulder water-impact state: PASS');
