#!/usr/bin/env node

// State checks for C's monster-versus-monster poison, physical blindness,
// and acid-engulf paths. The paired fixture pins every screen, cursor, and RNG
// call; this gate also checks the transient blindness state and final roster.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/monster-special-melee.json', import.meta.url),
'utf8'));
const cTrace = JSON.parse(await readFile(new URL(
    'gen-sessions/generated/monster-special-melee.session.json',
    import.meta.url), 'utf8'));

function liveMonsters(mnum) {
    return (game.level?.monsters || []).filter(mon =>
        mon.mnum === mnum && (mon.mhp | 0) > 0);
}

function specialRolls(index) {
    return cTrace.segments[index].steps.flatMap(step => step.rng || [])
        .filter(call => /mdamagem|mhitm_ad_(drst|blnd|acid)|mhitm_really_poison/
            .test(call));
}

const poisonRolls = specialRolls(0);
assert.ok(poisonRolls.some(call =>
    call.includes('rn2(8)=0 @ mhitm_ad_drst')),
'C trace reaches the one-in-eight poison application');
assert.ok(poisonRolls.some(call =>
    call.includes('rn2(10)=1 @ mhitm_really_poison')),
'C trace applies extra poison damage to a monster');

const blindRolls = specialRolls(1);
assert.deepEqual(blindRolls.filter(call =>
    call.includes('@ mhitm_ad_blnd')).map(call => call.split(' @ ')[0]),
['d(1,6)=3', 'd(1,6)=6'],
'C trace spends two independent blindness-duration rolls');

const blindSegment = recipe.segments[1];
const blindPrefix = 117;
await runSegment({
    ...blindSegment,
    moves: blindSegment.moves.slice(0, blindPrefix),
    onFrame: () => {},
});
assert.deepEqual(liveMonsters(PMNAMES.PM_SOLDIER_ANT).map(mon => ({
    hp: mon.mhp | 0,
    blind: mon.mblinded | 0,
    canSee: mon.mcansee | 0,
})), [{ hp: 5, blind: 8, canSee: 0 }],
'raven claws leave the surviving soldier ant blind at the C boundary');

const acidRolls = specialRolls(2);
assert.ok(acidRolls.some(call => call.includes('d(3,6)=12 @ mdamagem')),
          'C trace reaches active ochre-jelly engulf damage');
assert.ok(acidRolls.some(call =>
    call.includes('rn2(30)=17 @ mhitm_ad_acid')),
'C trace spends the acid armor-erosion gate');
assert.ok(acidRolls.some(call =>
    call.includes('rn2(6)=2 @ mhitm_ad_acid')),
'C trace spends the acid wielded-item gate');

const states = [];
for (const [index, segment] of recipe.segments.entries()) {
    const replay = await runSegment({ ...segment, onFrame: () => {} });
    states.push({
        rng: replay.getRngLog().length,
        cRng: cTrace.segments[index].steps
            .reduce((total, step) => total + (step.rng || []).length, 0),
        unported: [...(game.unported || [])],
        queenBees: liveMonsters(PMNAMES.PM_QUEEN_BEE).length,
        hillGiants: liveMonsters(PMNAMES.PM_HILL_GIANT).map(mon =>
            [mon.mhp | 0, mon.mhpmax | 0]),
        ravens: liveMonsters(PMNAMES.PM_RAVEN).length,
        soldierAnts: liveMonsters(PMNAMES.PM_SOLDIER_ANT).length,
        ochreJellies: liveMonsters(PMNAMES.PM_OCHRE_JELLY).map(mon =>
            [mon.mhp | 0, mon.mx | 0, mon.my | 0]),
        lichens: liveMonsters(PMNAMES.PM_LICHEN).length,
    });
}

assert.deepEqual(states, [
    {
        rng: 7710,
        cRng: 7710,
        unported: [],
        queenBees: 4,
        hillGiants: [[13, 37]],
        ravens: 0,
        soldierAnts: 0,
        ochreJellies: [],
        lichens: 0,
    },
    {
        rng: 7930,
        cRng: 7930,
        unported: [],
        queenBees: 0,
        hillGiants: [],
        ravens: 2,
        soldierAnts: 0,
        ochreJellies: [],
        lichens: 0,
    },
    {
        rng: 3196,
        cRng: 3196,
        unported: [],
        queenBees: 0,
        hillGiants: [],
        ravens: 0,
        soldierAnts: 0,
        ochreJellies: [[24, 21, 16], [27, 23, 17]],
        lichens: 0,
    },
], 'special melee preserves the C final monster rosters and state');

console.log('monster special melee state: PASS');
