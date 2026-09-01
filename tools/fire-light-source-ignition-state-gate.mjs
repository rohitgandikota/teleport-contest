#!/usr/bin/env node

// The C recording pins every screen and RNG draw for external fire lighting.
// These assertions pin the object, timer, light radius, and identification
// state which is not fully visible in the terminal trace.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { ONAMES } from '../js/objects_data.js';
import { BURN_OBJECT, OBJ_FLOOR, OBJ_INVENT, OBJ_MINVENT } from '../js/const.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/fire-light-source-ignition.json', import.meta.url),
'utf8'));
const targetTypes = new Set([
    ONAMES.POT_OIL, ONAMES.OIL_LAMP, ONAMES.MAGIC_LAMP,
    ONAMES.BRASS_LANTERN, ONAMES.TALLOW_CANDLE, ONAMES.WAX_CANDLE,
    ONAMES.CANDELABRUM_OF_INVOCATION,
]);

function targetState() {
    const objects = [...(game.invent || []), ...(game.level?.objects || [])]
        .filter(obj => targetTypes.has(obj.otyp))
        .map(obj => {
            const light = (game.light_sources || []).find(source =>
                source.type === 1 && source.id === obj.o_id);
            const timer = (game.timer_base || []).find(entry =>
                entry.func_index === BURN_OBJECT && entry.arg === obj);
            return {
                type: obj.otyp,
                quantity: obj.quan | 0,
                where: obj.where,
                lit: !!obj.lamplit,
                cursed: !!obj.cursed,
                charges: obj.spe | 0,
                range: light?.range ?? null,
                burnTimer: !!timer,
                known: !!game.objects[obj.otyp]?.oc_name_known,
            };
        });
    objects.sort((a, b) => a.type - b.type);
    return objects;
}

function monsterTargetState() {
    return (game.level?.monsters || []).flatMap(mon =>
        (mon.minvent || []).filter(obj => targetTypes.has(obj.otyp)).map(obj => {
            const light = (game.light_sources || []).find(source =>
                source.type === 1 && source.id === obj.o_id);
            const timer = (game.timer_base || []).find(entry =>
                entry.func_index === BURN_OBJECT && entry.arg === obj);
            return {
                type: obj.otyp,
                quantity: obj.quan | 0,
                where: obj.where,
                lit: !!obj.lamplit,
                carrierPosition: [mon.mx, mon.my],
                carrierHp: mon.mhp | 0,
                range: light?.range ?? null,
                burnTimer: !!timer,
                hasCarrier: obj.ocarry === mon,
            };
        }));
}

const states = [];
for (const segment of recipe.segments) {
    await runSegment({ ...segment, onFrame: () => {} });
    states.push({
        objects: targetState(),
        monsterObjects: monsterTargetState(),
        relevantUnported: [...(game.unported || [])].filter(path =>
            path.includes('catch_lit') || path.includes('ignite_items')
            || path.includes('burn_floor_objects')),
    });
}

const litLamp = (cursed = false) => [{
    type: ONAMES.OIL_LAMP, quantity: 1, where: OBJ_INVENT,
    lit: true, cursed, charges: 1, range: 3, burnTimer: true, known: false,
}];

assert.deepEqual(states[0].objects, litLamp(),
                 'visible external fire lights and times a carried oil lamp');
assert.deepEqual(states[1].objects, [{
    type: ONAMES.POT_OIL, quantity: 2, where: OBJ_FLOOR,
    lit: true, cursed: false, charges: 0, range: 1,
    burnTimer: true, known: true,
}], 'a floor stack of oil catches light, starts one timer, and identifies oil');
assert.deepEqual(states[2].objects, litLamp(true),
                 'the successful cursed-lamp coin flip starts ordinary burning');
assert.deepEqual(states[3].objects, [{
    type: ONAMES.OIL_LAMP, quantity: 1, where: OBJ_INVENT,
    lit: false, cursed: true, charges: 1, range: null,
    burnTimer: false, known: false,
}], 'the failed cursed-lamp coin flip leaves no light or timer');
assert.deepEqual(states[4].objects, [
    {
        type: ONAMES.OIL_LAMP, quantity: 1, where: OBJ_INVENT,
        lit: true, cursed: false, charges: 1, range: 3,
        burnTimer: true, known: false,
    },
    {
        type: ONAMES.POT_OIL, quantity: 1, where: OBJ_INVENT,
        lit: true, cursed: false, charges: 0, range: 1,
        burnTimer: true, known: true,
    },
], 'blind external fire lights both sources and preserves their two radii');
assert.deepEqual(states[5].objects, [{
    type: ONAMES.WAX_CANDLE, quantity: 3, where: OBJ_INVENT,
    lit: true, cursed: false, charges: 1, range: 2,
    burnTimer: true, known: false,
}], 'a three-candle stack uses the C radius and burn timer');
assert.deepEqual(states[6].objects, [{
    type: ONAMES.MAGIC_LAMP, quantity: 1, where: OBJ_INVENT,
    lit: true, cursed: false, charges: 1, range: 3,
    burnTimer: false, known: false,
}], 'a charged magic lamp lights indefinitely without a burn timer');
assert.deepEqual(states[7].objects, [{
    type: ONAMES.BRASS_LANTERN, quantity: 1, where: OBJ_INVENT,
    lit: false, cursed: false, charges: 1, range: null,
    burnTimer: false, known: true,
}], 'external fire cannot light a brass lantern');
assert.deepEqual(states[8].objects, [{
    type: ONAMES.CANDELABRUM_OF_INVOCATION, quantity: 1,
    where: OBJ_INVENT, lit: false, cursed: false, charges: 0,
    range: null, burnTimer: false, known: false,
}], 'a Candelabrum with no attached candles cannot catch light');
assert.deepEqual(states[9].objects, litLamp(),
                 'a rebounding fire ray lights hero inventory through zhitu');
assert.deepEqual(states[10].monsterObjects, [{
    type: ONAMES.WAX_CANDLE, quantity: 1, where: OBJ_MINVENT,
    lit: true, carrierPosition: [51, 8], carrierHp: 4,
    range: 2, burnTimer: true, hasCarrier: true,
}], 'a surviving monster carries its newly lit candle and mobile light');

for (const [index, state] of states.entries())
    assert.deepEqual(state.relevantUnported, [],
                     `segment ${index} leaves no fire-ignition marker`);

console.log('fire light-source ignition state: PASS');
