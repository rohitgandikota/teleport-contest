#!/usr/bin/env node

// State checks for lit and unlit potion-of-oil impacts. The C recording pins
// every frame and RNG draw. These assertions pin explosion damage, resistance,
// monster anger, inventory damage, and light/timer cleanup.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { LOST_EXPLODING, LOST_THROWN, OBJ_DELETED } from '../js/const.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/potion-burning-oil-impact.json', import.meta.url),
'utf8'));
const impactSteps = [75, 83, 96, 111, 96, 94];

const quantity = (objects) => (objects || []).reduce(
    (total, obj) => total + (obj.quan | 0), 0);

function giantState(state) {
    const giant = (state.level?.monsters || []).find(mon =>
        mon.mnum === PMNAMES.PM_HILL_GIANT && (mon.mhp | 0) > 0);
    return giant ? {
        hp: giant.mhp | 0,
        hpmax: giant.mhpmax | 0,
        peaceful: !!giant.mpeaceful,
        inventoryCount: quantity(giant.minvent),
    } : null;
}

function stateSummary(state) {
    return {
        hp: state.u.uhp | 0,
        hpmax: state.u.uhpmax | 0,
        giant: giantState(state),
        cloakErosion: state.u.uarmc?.oeroded | 0,
        oilCount: quantity((state.invent || []).filter(obj =>
            obj.otyp === ONAMES.POT_OIL)),
        inventoryCount: quantity(state.invent),
        fireRing: [state.u.uleft, state.u.uright].some(obj =>
            obj?.otyp === ONAMES.RIN_FIRE_RESISTANCE),
        corridorMemory: state.level.at(state.u.ux - 2,
                                       state.u.uy)?.remembered_glyph?.ch
            ?? null,
    };
}

const cases = [];
for (let index = 0; index < recipe.segments.length; ++index) {
    let before = null;
    let oil = null;
    globalThis.__step_snapshot = {
        step: '*',
        cb: (state, step) => {
            if (step !== impactSteps[index] - 1)
                return;
            before = stateSummary(state);
            oil = (state.invent || []).find(obj =>
                obj.otyp === ONAMES.POT_OIL) || null;
        },
    };
    try {
        await runSegment({ ...recipe.segments[index], onFrame: () => {} });
    } finally {
        delete globalThis.__step_snapshot;
    }

    assert.ok(before && oil, `segment ${index} reaches its oil impact setup`);
    const oilId = oil.o_id;
    cases.push({
        before,
        after: stateSummary(game),
        consumedOil: {
            diluted: !!oil.odiluted,
            lit: !!oil.lamplit,
            where: oil.where,
            howLost: oil.how_lost,
        },
        oilLightRemains: (game.light_sources || []).some(source =>
            source.type === 1 && source.id === oilId),
        oilTimerRemains: (game.timer_base || []).some(timer =>
            timer.arg === oil || timer.arg?.o_id === oilId),
        relevantUnported: [...(game.unported || [])].filter(path =>
            path.includes('potionhit') || path.includes('breakobj')
            || path.includes('explode_oil')
            || path.startsWith('light:show_transient_light')),
    });
}

const [ordinary, diluted, floorBlast, resistant, directMonster, unlit] = cases;

assert.deepEqual([ordinary.before.hp, ordinary.after.hp], [134, 125],
                 'ordinary burning oil deals the C-recorded nine damage');
assert.deepEqual([diluted.before.hp, diluted.after.hp], [134, 128],
                 'diluted burning oil deals the C-recorded six damage');
assert.equal(ordinary.after.cloakErosion, 1,
             'ordinary burning oil scorches the hero cloak');
assert.equal(diluted.after.cloakErosion, 1,
             'diluted burning oil still scorches the hero cloak');
assert.equal(ordinary.consumedOil.diluted, false,
             'the ordinary-oil case is not diluted');
assert.equal(diluted.consumedOil.diluted, true,
             'the diluted-oil case retains its dilution flag through impact');

assert.deepEqual(floorBlast.before.giant, {
    hp: 65, hpmax: 65, peaceful: true, inventoryCount: 19,
}, 'the missed throw begins with a healthy peaceful hill giant');
assert.deepEqual(floorBlast.after.giant, {
    hp: 53, hpmax: 65, peaceful: false, inventoryCount: 19,
}, 'the floor blast damages and angers the nearby hill giant');
assert.deepEqual([floorBlast.before.hp, floorBlast.after.hp], [208, 194],
                 'the same floor blast deals fourteen damage to the hero');
assert.deepEqual([floorBlast.before.inventoryCount,
                  floorBlast.after.inventoryCount], [15, 12],
                 'the floor blast destroys the C-recorded hero inventory');
assert.equal(floorBlast.after.cloakErosion, 1,
             'the floor blast scorches the hero cloak');

assert.equal(resistant.before.fireRing, true,
             'the resistance case wears a ring of fire resistance');
assert.deepEqual([resistant.before.hp, resistant.after.hp], [208, 208],
                 'fire resistance prevents direct burning-oil damage');
assert.deepEqual([resistant.before.inventoryCount,
                  resistant.after.inventoryCount], [16, 15],
                 'the resistant blast consumes only its oil in this C trace');
assert.equal(resistant.after.cloakErosion, 0,
             'the resistant C trace leaves the cloak intact');

assert.deepEqual([directMonster.before.giant.hp,
                  directMonster.after.giant.hp], [49, 41],
                 'direct lit oil deals one impact and seven blast damage');
assert.equal(directMonster.after.giant.peaceful, false,
             'a surviving direct-hit monster becomes hostile');
assert.deepEqual([directMonster.before.hp, directMonster.after.hp], [109, 102],
                 'the adjacent hero takes the same seven-point blast');
assert.equal(directMonster.after.cloakErosion, 1,
             'the direct monster blast scorches the hero cloak');
assert.deepEqual([directMonster.before.corridorMemory,
                  directMonster.after.corridorMemory], [null, '#'],
                 'the moving lit potion reveals the dark corridor behind it');

assert.deepEqual([unlit.before.giant.hp, unlit.after.giant.hp], [38, 37],
                 'unlit oil deals only its one point of impact damage');
assert.equal(unlit.after.giant.peaceful, false,
             'an unlit direct hit still angers the monster');
assert.deepEqual([unlit.before.hp, unlit.after.hp], [109, 109],
                 'unlit oil does not explode onto the adjacent hero');
assert.equal(unlit.after.cloakErosion, 0,
             'unlit oil does not scorch the hero cloak');
assert.equal(unlit.after.corridorMemory, null,
             'unlit oil does not reveal the dark corridor');

for (const [index, state] of cases.entries()) {
    assert.equal(state.before.oilCount, 1,
                 `segment ${index} begins with one potion of oil`);
    assert.equal(state.after.oilCount, 0,
                 `segment ${index} consumes its potion of oil`);
    assert.equal(state.consumedOil.where, OBJ_DELETED,
                 `segment ${index} deletes the consumed potion`);
    assert.equal(state.consumedOil.howLost,
                 index === 5 ? LOST_THROWN : LOST_EXPLODING,
                 `segment ${index} records the correct loss reason`);
    assert.equal(state.consumedOil.lit, false,
                 `segment ${index} leaves no lit consumed potion`);
    assert.equal(state.oilLightRemains, false,
                 `segment ${index} removes the oil light source`);
    assert.equal(state.oilTimerRemains, false,
                 `segment ${index} removes the oil burn timer`);
    assert.deepEqual(state.relevantUnported, [],
                     `segment ${index} leaves no oil implementation marker`);
}

console.log('burning-oil potion impact state: PASS');
