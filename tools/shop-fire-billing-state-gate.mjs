#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { ONAMES } from '../js/objects_data.js';
import { BURN_OBJECT, OBJ_FLOOR, OBJ_INVENT, OBJ_ONBILL } from '../js/const.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/shop-fire-billing.json', import.meta.url), 'utf8'));

function shopkeeperState() {
    const shkp = (game.level?.monsters || []).find(mon => mon.isshk);
    const eshk = shkp?.eshk || shkp?.mextra?.eshk;
    return {
        debit: eshk?.debit | 0,
        bills: (eshk?.bill_p || []).map(bp => ({
            quantity: bp.bquan | 0,
            price: bp.price | 0,
            useup: !!bp.useup,
            type: bp.obj?.otyp ?? (game.billobjs || []).find(
                obj => obj.o_id === bp.bo_id)?.otyp ?? null,
            where: bp.obj?.where ?? (game.billobjs || []).find(
                obj => obj.o_id === bp.bo_id)?.where ?? null,
        })),
    };
}

function billObjectState() {
    return (game.billobjs || []).map(obj => ({
        type: obj.otyp,
        quantity: obj.quan | 0,
        where: obj.where,
        unpaid: !!obj.unpaid,
        lit: !!obj.lamplit,
    }));
}

const states = [];
for (const segment of recipe.segments) {
    await runSegment({ ...segment, onFrame: () => {} });
    const lamp = game.invent.find(obj => obj.otyp === ONAMES.OIL_LAMP);
    const scroll = (game.level?.objects || []).find(
        obj => obj.otyp === ONAMES.SCR_AMNESIA);
    states.push({
        shopkeeper: shopkeeperState(),
        billObjects: billObjectState(),
        lamp: lamp ? {
            quantity: lamp.quan | 0,
            where: lamp.where,
            unpaid: !!lamp.unpaid,
            noCharge: !!lamp.no_charge,
            lit: !!lamp.lamplit,
            light: (game.light_sources || []).some(source =>
                source.type === 1 && source.id === lamp.o_id),
            timer: (game.timer_base || []).some(timer =>
                timer.func_index === BURN_OBJECT && timer.arg === lamp),
        } : null,
        scroll: scroll ? {
            quantity: scroll.quan | 0,
            where: scroll.where,
            unpaid: !!scroll.unpaid,
            noCharge: !!scroll.no_charge,
        } : null,
        relevantUnported: [...(game.unported || [])].filter(path =>
            path.includes('catch_lit') || path.includes('useupf')
            || path.includes('shk_your') || path.includes('burn_floor_objects')),
    });
}

assert.deepEqual(states[0].lamp, {
    quantity: 1, where: OBJ_INVENT, unpaid: false, noCharge: false,
    lit: true, light: true, timer: true,
}, 'the externally lit lamp becomes player-owned while its original value stays billed');
assert.deepEqual(states[0].shopkeeper, {
    debit: 13,
    bills: [{
        quantity: 1, price: 13, useup: true,
        type: ONAMES.OIL_LAMP, where: OBJ_ONBILL,
    }],
}, 'lamp ignition charges a usage fee and preserves the item bill');
assert.deepEqual(states[0].billObjects, [{
    type: ONAMES.OIL_LAMP, quantity: 1, where: OBJ_ONBILL,
    unpaid: true, lit: false,
}], 'the unpaid lamp copy remains available for itemized payment');

assert.deepEqual(states[1].scroll, {
    quantity: 2, where: OBJ_FLOOR, unpaid: false, noCharge: false,
}, 'one of three sold scrolls burns and two remain as shop stock');
assert.deepEqual(states[1].shopkeeper, {
    debit: 0,
    bills: [{
        quantity: 1, price: 356, useup: true,
        type: ONAMES.SCR_AMNESIA, where: OBJ_ONBILL,
    }],
}, 'the destroyed scroll unit remains on the shop bill at its quoted price');
assert.deepEqual(states[1].billObjects, [{
    type: ONAMES.SCR_AMNESIA, quantity: 1, where: OBJ_ONBILL,
    unpaid: false, lit: false,
}], 'the destroyed floor unit moves to the used-up bill chain');

for (const [index, state] of states.entries())
    assert.deepEqual(state.relevantUnported, [],
                     `segment ${index + 1} leaves no fire or billing marker`);

console.log('shop fire billing state: PASS');
