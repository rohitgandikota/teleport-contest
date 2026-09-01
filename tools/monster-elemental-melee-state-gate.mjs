#!/usr/bin/env node

// State checks for the monster-versus-monster branches of src/uhitm.c
// mhitm_ad_fire(), mhitm_ad_cold(), and mhitm_ad_elec(). The paired C trace
// also pins every screen and RNG call for these deterministic encounters.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/monster-elemental-melee.json', import.meta.url),
'utf8'));
const cTrace = JSON.parse(await readFile(new URL(
    'gen-sessions/generated/monster-elemental-melee.session.json',
    import.meta.url), 'utf8'));

function liveMonsters(mnum) {
    return (game.level?.monsters || []).filter(mon =>
        mon.mnum === mnum && (mon.mhp | 0) > 0);
}

function relevantUnported() {
    return [...(game.unported || [])].filter(path =>
        /mattackm|mdamagem|mhitm_ad_(fire|cold|elec)|destroy_items|ignite_items|golem/
            .test(path));
}

function cElementalRolls(index) {
    return cTrace.segments[index].steps.flatMap(step => step.rng || [])
        .filter(call => /mdamagem|mhitm_mgc_atk_negated|destroy_items/.test(call));
}

const states = [];
for (const [index, segment] of recipe.segments.entries()) {
    const replay = await runSegment({ ...segment, onFrame: () => {} });
    states.push({
        rng: replay.getRngLog().length,
        cRng: cTrace.segments[index].steps
            .reduce((total, step) => total + (step.rng || []).length, 0),
        relevantUnported: relevantUnported(),
        fireAnts: liveMonsters(PMNAMES.PM_FIRE_ANT).map(mon =>
            [mon.mhp | 0, mon.mhpmax | 0, mon.mtame | 0]),
        jackals: liveMonsters(PMNAMES.PM_JACKAL).length,
        iceTrolls: liveMonsters(PMNAMES.PM_ICE_TROLL).map(mon =>
            [mon.mhp | 0, mon.mhpmax | 0, mon.mtame | 0]),
        soldiers: liveMonsters(PMNAMES.PM_SOLDIER).length,
        gridBugs: liveMonsters(PMNAMES.PM_GRID_BUG).map(mon =>
            [mon.mhp | 0, mon.mhpmax | 0, mon.mtame | 0]),
        lichens: liveMonsters(PMNAMES.PM_LICHEN).map(mon =>
            [mon.mhp | 0, mon.mhpmax | 0]),
    });
}

const fireRolls = cElementalRolls(0);
assert.ok(fireRolls.some(call => call.includes('d(2,4)=3 @ mdamagem')),
          'C trace reaches the fire ant elemental damage roll');
assert.ok(fireRolls.some(call => call.includes('mhitm_mgc_atk_negated')),
          'C fire branch spends its magical-cancellation roll');
assert.ok(fireRolls.some(call => call.includes('destroy_items')),
          'C fire branch spends its inventory-destruction roll');
assert.deepEqual(states[0], {
    rng: 3435,
    cRng: 3435,
    relevantUnported: [],
    fireAnts: [[10, 11, 6]],
    jackals: 0,
    iceTrolls: [],
    soldiers: 0,
    gridBugs: [],
    lichens: [[3, 3]],
}, 'fire melee kills the jackal and grows the surviving fire ant');

const coldRolls = cElementalRolls(1);
assert.ok(coldRolls.some(call => call.includes('d(2,6)=6 @ mdamagem')),
          'C trace reaches the ice troll cold-claw damage roll');
assert.ok(coldRolls.some(call => call.includes('mhitm_mgc_atk_negated')),
          'C cold branch spends its magical-cancellation roll');
assert.ok(coldRolls.some(call => call.includes('destroy_items')),
          'C cold branch spends its inventory-destruction roll');
assert.deepEqual(states[1], {
    rng: 3985,
    cRng: 3985,
    relevantUnported: [],
    fireAnts: [],
    jackals: 2,
    iceTrolls: [[36, 36, 5]],
    soldiers: 0,
    gridBugs: [],
    lichens: [],
}, 'cold melee kills the soldier and grows the surviving ice troll');

const electricRolls = cElementalRolls(2);
assert.equal(electricRolls.filter(call =>
    call.includes('d(1,1)=1 @ mdamagem')).length, 2,
             'C trace reaches two grid-bug electrical damage rolls');
assert.equal(electricRolls.filter(call =>
    call.includes('mhitm_mgc_atk_negated')).length, 2,
             'both C electrical bites spend magical-cancellation rolls');
assert.equal(electricRolls.filter(call =>
    call.includes('destroy_items')).length, 2,
             'both C electrical bites spend inventory-destruction rolls');
assert.deepEqual(states[2], {
    rng: 2742,
    cRng: 2742,
    relevantUnported: [],
    fireAnts: [],
    jackals: 0,
    iceTrolls: [],
    soldiers: 0,
    gridBugs: [[4, 4, 5], [3, 4, 5], [2, 2, 5], [4, 4, 5]],
    lichens: [[4, 4]],
}, 'two electrical bites remove the created lichen and preserve the pet pack');

console.log('monster elemental melee state: PASS');
