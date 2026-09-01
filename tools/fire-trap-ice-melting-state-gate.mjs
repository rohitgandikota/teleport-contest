#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import {
    FIRE_TRAP, MOAT, OBJ_FLOOR, POOL,
} from '../js/const.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/fire-trap-ice-melting.json', import.meta.url),
'utf8'));

function relevantUnported() {
    return [...(game.unported || [])].filter(path =>
        path.includes('dofiretrap')
        || path.includes('trapeffect_fire_trap')
        || path.includes('melt_ice')
        || path.includes('trap_ice_effects')
        || path.includes('obj_ice_effects')
        || path.includes('spoteffects')
        || path.includes('minliquid'));
}

const states = [];
for (const [index, segment] of recipe.segments.entries()) {
    await runSegment({ ...segment, onFrame: () => {} });

    if (index === 0) {
        const { ux, uy } = game.u;
        states.push({
            position: [ux, uy],
            terrain: game.level.at(ux, uy).typ,
            icedpool: game.level.at(ux, uy).icedpool | 0,
            fireTrap: (game.level?.traps || []).some(trap =>
                trap.ttyp === FIRE_TRAP
                && trap.tx === ux && trap.ty === uy),
            hp: [game.u.uhp | 0, game.u.uhpmax | 0],
            fireResistance: !!game.u.uprops?.FIRE_RES,
            waterWalking: !!game.u.uprops?.WWALKING,
            relevantUnported: relevantUnported(),
        });
        continue;
    }

    const poolX = 10, poolY = 6;
    states.push({
        terrain: game.level.at(poolX, poolY).typ,
        icedpool: game.level.at(poolX, poolY).icedpool | 0,
        fireTrap: (game.level?.traps || []).some(trap =>
            trap.ttyp === FIRE_TRAP
            && trap.tx === poolX && trap.ty === poolY),
        fireAnts: (game.level?.monsters || []).filter(mon =>
            mon.mnum === PMNAMES.PM_FIRE_ANT).length,
        boulders: (game.level?.objects || []).filter(obj =>
            obj.where === OBJ_FLOOR && obj.otyp === ONAMES.BOULDER
            && obj.ox === poolX && obj.oy === poolY - 1).length,
        heroHp: game.u.uhp | 0,
        relevantUnported: relevantUnported(),
    });
}

assert.deepEqual(states[0], {
    position: [25, 5],
    terrain: MOAT,
    icedpool: 0,
    fireTrap: false,
    hp: [12, 12],
    fireResistance: true,
    waterWalking: true,
    relevantUnported: [],
}, 'hero fire trap restores a moat and applies safe water-walking effects');

assert.deepEqual(states[1], {
    terrain: POOL,
    icedpool: 0,
    fireTrap: false,
    fireAnts: 0,
    boulders: 1,
    heroHp: 12,
    relevantUnported: [],
}, 'monster fire trap restores a pool, removes the trap, and drowns the ant');

console.log('fire-trap ice-melting state: PASS');
