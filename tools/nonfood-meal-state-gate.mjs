// Public doeat controls with real selection, forms, objects and disposal.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { setup, seed, clearMessages, messages, x, y } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { doeat, is_edible } from '../js/eat.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { addinv, weight } from '../js/invent.js';
import { polymon } from '../js/polyself.js';
import { setuwep, setuqwep, setuswapwep } from '../js/wield.js';
import { cmdq_add_key } from '../js/cmd.js';
import { set_itimeout } from '../js/potion.js';
import { punish } from '../js/read.js';
import { getRngLog, rnd, rn2 } from '../js/rng.js';
import { pline } from '../js/display.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { CQ_CANNED, ECMD_TIME, OBJ_INVENT, OBJ_FLOOR, OBJ_FREE, OBJ_DELETED,
    NOT_HUNGRY } from '../js/const.js';

async function fixture(typ, { form = PMNAMES.PM_XORN, floor = false,
    quantity = 1, slot = null } = {}) {
    const run = await setup();
    await polymon(form);
    game.u.uhunger = 500;
    game.u.uhs = NOT_HUNGRY;
    const obj = mksobj(typ, false, false);
    obj.quan = quantity;
    obj.owt = weight(obj);
    if (floor)
        await place_object(obj, x, y);
    else
        await addinv(obj);
    if (slot === 'weapon')
        await setuwep(obj);
    else if (slot === 'quiver')
        setuqwep(obj);
    else if (slot === 'swap')
        setuswapwep(obj);
    clearMessages();
    run._display.clearInputQueue();
    game.command_queue = [];
    if (floor)
        run._display.pushKey(121);
    else
        cmdq_add_key(CQ_CANNED, obj.invlet);
    seed(2);
    return { run, obj };
}

function consumed(obj) {
    assert.equal((game.invent || []).includes(obj), false);
    assert.equal(game.level.objects.includes(obj), false);
    assert.ok(obj.where === OBJ_FREE || obj.where === OBJ_DELETED);
    assert.equal(game.occupation, null);
    assert.deepEqual(game.context.victual, {});
}

for (const floor of [false, true]) {
    for (const quantity of [1, 3]) {
        test(`one-turn dagger meal retains stack owner, floor=${floor}, quantity=${quantity}`, async () => {
            const { obj } = await fixture(ONAMES.DAGGER, { floor, quantity });
            const id = obj.o_id;
            const oldSplit = { ...game.context.objsplit };
            assert.equal(await doeat(), ECMD_TIME);
            assert.equal(game.u.uhunger, 500 + game.objects[obj.otyp].oc_nutrition);
            assert.equal(game.u.uconduct.food, 1);
            assert.equal(game.u.uconduct.unvegan, 0);
            assert.equal(game.u.uconduct.unvegetarian, 0);
            assert.equal(obj.o_id, id);
            if (quantity === 1)
                consumed(obj);
            else {
                assert.equal(obj.quan, 2);
                assert.equal(obj.oeaten || 0, 0);
                assert.equal(obj.where, floor ? OBJ_FLOOR : OBJ_INVENT);
                if (floor) {
                    // C useupf splits the consumed child only after nutrition.
                    assert.deepEqual(game.context.objsplit, { parent_oid: 0, child_oid: 0 });
                    assert.deepEqual(getRngLog(), ['rnd(2)=2', 'rn2(100)=82']);
                } else {
                    assert.deepEqual(game.context.objsplit, oldSplit);
                    assert.deepEqual(getRngLog(), []);
                }
                assert.equal(game.occupation, null);
                assert.deepEqual(game.context.victual, {});
            }
            assert.match(messages(), /This dagger is delicious!/);
            assert.doesNotMatch(messages(), /finish eating|first bite|Rotten|Awful/);
        });
    }
}

for (const slot of ['weapon', 'quiver', 'swap']) {
    for (const quantity of [1, 2]) {
        test(`single meal preserves or clears ${slot} at quantity ${quantity}`, async () => {
            const { obj } = await fixture(ONAMES.DAGGER, { slot, quantity });
            const key = { weapon: 'uwep', quiver: 'uquiver', swap: 'uswapwep' }[slot];
            assert.equal(game.u[key], obj);
            assert.equal(await doeat(), ECMD_TIME);
            assert.equal(game.u[key], quantity === 1 ? null : obj);
            if (quantity === 1)
                consumed(obj);
            else
                assert.notEqual(obj.owornmask, 0);
            assert.deepEqual(getRngLog(), []);
        });
    }
}

for (const floor of [false, true]) {
    for (const quantity of [99, 101, 200001]) {
        test(`gold whole-stack nutrition and cap, floor=${floor}, quantity=${quantity}`, async () => {
            const { obj } = await fixture(ONAMES.GOLD_PIECE, { floor, quantity });
            // Start hungry enough to isolate the cap from the separate choke owner.
            game.u.uhunger = -1000;
            assert.equal(await doeat(), ECMD_TIME);
            assert.equal(game.u.uhunger, -1000 + (quantity > 200000 ? 2000 : Math.trunc(quantity / 100)));
            consumed(obj);
            assert.match(messages(), /This gold is delicious!/);
            assert.equal(game.u.uconduct.food, 1);
        });
    }
}

for (const target of ['uball', 'uchain']) {
    test(`eating attached ${target} uses live weight and canonical unpunishment`, async () => {
        const run = await setup();
        await polymon(PMNAMES.PM_XORN);
        await punish(null);
        const obj = game.u[target];
        const other = game.u[target === 'uball' ? 'uchain' : 'uball'];
        const nutrition = weight(obj);
        game.u.uhunger = 500;
        game.u.uhs = NOT_HUNGRY;
        clearMessages();
        run._display.clearInputQueue();
        for (let item = game.level.objectAt(x, y); item; item = item.nexthere) {
            if (!is_edible(item))
                continue;
            run._display.pushKey(item === obj ? 121 : 110);
            if (item === obj)
                break;
        }
        seed(2);
        rn2(100); // unpunish destroys the chain through delobj().
        if (target === 'uball')
            rn2(100); // useupf then destroys the detached ball.
        const rng = [...getRngLog()];
        seed(2);
        assert.equal(await doeat(), ECMD_TIME);
        assert.equal(game.u.uball, null);
        assert.equal(game.u.uchain, null);
        assert.equal(game.u.uhunger, 500 + nutrition);
        consumed(obj);
        if (target === 'uchain')
            assert.equal(other.where, OBJ_FLOOR);
        else
            assert.ok(other.where === OBJ_FREE || other.where === OBJ_DELETED);
        assert.deepEqual(getRngLog(), rng);
    });
}

for (const [typ, form, vegan, vegetarian] of [
    [ONAMES.LEATHER_ARMOR, PMNAMES.PM_GELATINOUS_CUBE, 1, 1],
    [ONAMES.WAX_CANDLE, PMNAMES.PM_GELATINOUS_CUBE, 1, 0],
    [ONAMES.QUARTERSTAFF, PMNAMES.PM_FIRE_ELEMENTAL, 0, 0],
]) {
    test(`legal material meal has independent conduct counters, type=${typ}`, async () => {
        const { obj } = await fixture(typ, { form });
        assert.equal(is_edible(obj), true);
        assert.equal(await doeat(), ECMD_TIME);
        consumed(obj);
        assert.equal(game.u.uconduct.food, 1);
        assert.equal(game.u.uconduct.unvegan, vegan);
        assert.equal(game.u.uconduct.unvegetarian, vegetarian);
        const log = game.gamelog.filter(entry => /first time/.test(entry.text));
        assert.equal(log.filter(entry => /ate for the first time/.test(entry.text)).length, 1);
    });
}

for (const blessed of [0, 1]) {
    test(`paper scare-scroll feedback preserves blessing ${blessed}`, async () => {
        const { obj } = await fixture(ONAMES.SCR_SCARE_MONSTER, { form: PMNAMES.PM_FIRE_ELEMENTAL });
        obj.blessed = blessed;
        assert.equal(await doeat(), ECMD_TIME);
        consumed(obj);
        assert.match(messages(), blessed ? /Yuck!/ : /Yuck\./);
        assert.doesNotMatch(messages(), /delicious/);
        assert.deepEqual(getRngLog(), []);
    });
}

test('mail is eaten with zero nutrition and its specific message', async () => {
    const { obj } = await fixture(ONAMES.SCR_MAIL, { form: PMNAMES.PM_FIRE_ELEMENTAL });
    assert.equal(await doeat(), ECMD_TIME);
    consumed(obj);
    assert.equal(game.u.uhunger, 500);
    assert.match(messages(), /This junk mail is less than satisfying/);
    assert.doesNotMatch(messages(), /delicious/);
    assert.deepEqual(getRngLog(), []);
});

for (const resistance of [false, true]) {
    test(`poisoned dagger preserves damage order and resistance=${resistance}`, async () => {
        const { obj } = await fixture(ONAMES.DAGGER);
        obj.opoisoned = 1;
        if (resistance)
            set_itimeout('HPoison_resistance', 50);
        game.u.mh = game.u.mhmax = 200;
        seed(2);
        const loss = rnd(4), damage = rnd(15);
        const rng = [...getRngLog()];
        seed(2);
        const before = game.u.acurr.a[0];
        assert.equal(await doeat(), ECMD_TIME);
        consumed(obj);
        assert.equal(game.u.mh, 200 - (resistance ? 0 : damage));
        assert.equal(game.u.acurr.a[0], before - (resistance ? 0 : loss));
        assert.deepEqual(getRngLog(), resistance ? [] : rng);
        assert.match(messages(), /must have been poisonous/);
        assert.doesNotMatch(messages(), /delicious/);
    });
}

test('delicious feedback holds victual and ownership before nutrition and disposal', async () => {
    const { run, obj } = await fixture(ONAMES.DAGGER, { quantity: 2 });
    await pline('A long earlier message still occupies the top line before this meal.');
    let arrived, release;
    const waiting = new Promise(resolve => { arrived = resolve; });
    run._display.onEmptyQueue = () => {
        arrived();
        return new Promise(resolve => { release = resolve; });
    };
    const operation = doeat();
    let timer;
    await Promise.race([waiting, operation, new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('meal feedback did not reach a boundary')), 2000);
    })]);
    clearTimeout(timer);
    await setImmediate();
    const during = { piece: game.context.victual?.piece, quantity: obj.quan,
        hunger: game.u.uhunger, conduct: game.u.uconduct.food,
        where: obj.where, rng: [...getRngLog()] };
    run._display.onEmptyQueue = () => 32;
    release?.(32);
    await operation;
    assert.deepEqual(during, { piece: obj, quantity: 2, hunger: 500,
        conduct: 1, where: OBJ_INVENT, rng: [] });
    assert.equal(obj.quan, 1);
    assert.deepEqual(game.context.victual, {});
});
