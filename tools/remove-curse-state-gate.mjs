#!/usr/bin/env node
// Source-derived controls for read.c seffect_remove_curse() and its billing
// and equipment effects. These are not native branch-coverage claims.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mksobj, blessorcurse } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { addtobill } from '../js/shk.js';
import { seffects, punish } from '../js/read.js';
import { setuwep, setuswapwep } from '../js/wield.js';
import { ONAMES } from '../js/objects_data.js';
import { OBJ_FLOOR, OBJ_DELETED, OBJ_ONBILL, FROMOUTSIDE } from '../js/const.js';
import { initRng } from '../js/rng.js';

const segment = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/shop-normal.json', import.meta.url))).segments[0];

async function setup() {
    const replay = await runSegment({ ...segment, storage: new InMemoryStorage() });
    replay._display.onEmptyQueue = () => 0x1b;
    const shkp = game.level.monsters.find(m => m.isshk);
    assert.ok(shkp);
    game.u.ushops = String.fromCharCode(shkp.eshk.shoproom);
    // Other carried items do not draw from blessorcurse in confused cases.
    for (const obj of game.invent) {
        obj.blessed = 1;
        obj.cursed = 0;
    }
    game._toplines = '';
    game._msg_history = [];
    return shkp;
}

function scroll(blessed = true, cursed = false) {
    const obj = mksobj(ONAMES.SCR_REMOVE_CURSE, false, false);
    obj.blessed = blessed;
    obj.cursed = cursed;
    return obj;
}

function messages() {
    return [...game._msg_history, game._toplines].join('\n');
}

async function water(shkp, cursed) {
    const obj = mksobj(ONAMES.POT_WATER, false, false);
    obj.cursed = cursed;
    obj.bknown = 0;
    await addinv(obj);
    await addtobill(obj, false, false, true);
    assert.ok(obj.unpaid);
    const bill = shkp.eshk.bill_p.find(bp => bp.bo_id === obj.o_id);
    assert.ok(bill);
    return { obj, bill };
}

test('uncursing unpaid water preserves its old value on a used-up bill', async () => {
    const shkp = await setup();
    const { obj, bill } = await water(shkp, true);
    const price = bill.price;
    game.objects[ONAMES.SCR_REMOVE_CURSE].oc_name_known = false;
    await seffects(scroll());
    assert.equal(!!obj.cursed, false);
    assert.equal(!!obj.unpaid, false);
    assert.equal(!!obj.bknown, true);
    const copy = game.billobjs.find(o => o.otyp === ONAMES.POT_WATER);
    assert.ok(copy);
    assert.equal(copy.where, OBJ_ONBILL);
    assert.equal(!!copy.cursed, true);
    const entry = shkp.eshk.bill_p.find(bp => bp.bo_id === copy.o_id);
    assert.equal(entry.price, price);
    assert.equal(!!entry.useup, true);
    assert.ok(game.objects[ONAMES.SCR_REMOVE_CURSE].oc_name_known);
    assert.match(messages(), /You uncurse .*you pay for/);
});

for (const [seed, state] of [[1, 'cursed'], [7, 'blessed']]) {
    test(`confused remove curse reprices newly ${state} unpaid water`, async () => {
        const shkp = await setup();
        const { obj, bill } = await water(shkp, false);
        const price = bill.price;
        game.u.intrinsic.HConfusion = 10;
        const source = scroll();
        initRng(seed);
        await seffects(source);
        assert.ok(obj[state]);
        assert.equal(obj.bknown, 0);
        assert.ok(obj.unpaid);
        assert.ok(bill.price > price);
        assert.equal(!!bill.useup, false);
    });
}

test('an uncursed scroll leaves unworn unpaid water alone', async () => {
    const shkp = await setup();
    const { obj, bill } = await water(shkp, true);
    const price = bill.price;
    await seffects(scroll(false));
    assert.ok(obj.cursed);
    assert.ok(obj.unpaid);
    assert.equal(bill.price, price);
    assert.equal(obj.bknown, 0);
});

for (const cursed of [false, true]) {
    test(`remove curse frees a punished hero even when the scroll is cursed=${cursed}`, async () => {
        await setup();
        await punish(null);
        const ball = game.u.uball, chain = game.u.uchain;
        assert.ok(ball && chain);
        assert.equal(game.uball, undefined);
        await seffects(scroll(false, cursed));
        assert.equal(game.u.uball, null);
        assert.equal(game.u.uchain, null);
        assert.equal(chain.where, OBJ_DELETED);
        assert.equal(ball.where, OBJ_FLOOR);
    });
}

test('confusion leaves the punishment intact', async () => {
    await setup();
    await punish(null);
    const ball = game.u.uball, chain = game.u.uchain;
    game.u.intrinsic.HConfusion = 10;
    await seffects(scroll(false, true));
    assert.equal(game.u.uball, ball);
    assert.equal(game.u.uchain, chain);
});

test('intrinsic hallucination resistance selects the ordinary help message', async () => {
    await setup();
    game.u.uprops.HALLUC = 100;
    game.u.intrinsic.HHalluc_resistance = FROMOUTSIDE;
    await seffects(scroll(false, true));
    assert.match(messages(), /like someone is helping you/);
    assert.doesNotMatch(messages(), /Universal Oneness/);
});

test('blessorcurse waits until a newly cursed secondary weapon is dropped', async () => {
    await setup();
    const main = await addinv(mksobj(ONAMES.LONG_SWORD, false, false));
    const secondary = await addinv(mksobj(ONAMES.DAGGER, false, false));
    setuwep(main);
    setuswapwep(secondary);
    game.u.twoweap = true;
    initRng(1);
    await blessorcurse(secondary, 1);
    assert.ok(secondary.cursed);
    assert.equal(secondary.where, OBJ_FLOOR);
    assert.ok(!game.invent.includes(secondary));
    assert.equal(game.u.uswapwep, null);
});
