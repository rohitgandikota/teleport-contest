// C shk.c:3148 source-derived prices through real producers and public callers.
// No private export, helper mock or replacement runtime module is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mksobj, add_to_container, place_object } from '../js/mkobj.js';
import { addinv, money_cnt } from '../js/invent.js';
import { readobjnam } from '../js/objnam.js';
import { contained_cost, sellobj, sellobj_state, costly_spot, costly_gold,
    money2u, addtobill, onbill, globby_bill_fixup, get_pricing_units } from '../js/shk.js';
import { setworn } from '../js/worn.js';
import { run_timers, peek_timer, SHRINK_GLOB } from '../js/timeout.js';
import { getRngLog } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { ONAMES } from '../js/objects_data.js';
import { W_ARM, W_ARMH, W_ARMU, W_ARMC, OBJ_FLOOR, OBJ_FREE, has_omid } from '../js/const.js';

const input = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/shop-food-price-rounding.json', import.meta.url))).segments[0];
const entry = { ...input, moves: input.moves.slice(0, input.moves.indexOf('\x17')) };

async function setup() {
    const run = await runSegment({ ...entry, storage: new InMemoryStorage() });
    let prompts = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(++prompts < 100, 'bounded acknowledgments of real messages');
        return 27;
    };
    game._preNhgetchHook = null;
    resetInputState();
    const shkp = game.level.monsters.find(mon => mon.isshk);
    assert.ok(shkp);
    assert.ok(game.u.ushops.length);
    assert.equal(costly_spot(game.u.ux, game.u.uy), true);
    assert.equal(shkp.mpeaceful, 1);
    return shkp;
}

async function bagged(obj) {
    const bag = mksobj(ONAMES.SACK, false, false);
    await add_to_container(bag, obj);
    return bag;
}

function quote(bag, shkp) {
    const rng = [...getRngLog()];
    const price = contained_cost(bag, shkp, 0, true, false);
    assert.equal(typeof price, 'number', 'pricing remains synchronous');
    assert.deepEqual(getRngLog(), rng, 'sale pricing draws no RNG');
    return price;
}

async function shrink(obj, count) {
    for (let i = 0; i < count; i++) {
        game.moves = peek_timer(SHRINK_GLOB, obj);
        await run_timers();
    }
}

async function sell(obj) {
    sellobj_state(0); // C SELL_NORMAL accepts an accidental drop automatically.
    await place_object(obj, game.u.ux, game.u.uy);
    const before = money_cnt(game.invent);
    await sellobj(obj, game.u.ux, game.u.uy);
    assert.equal(obj.where, OBJ_FLOOR);
    return money_cnt(game.invent) - before;
}

for (const type of [ONAMES.GLOB_OF_GRAY_OOZE, ONAMES.GLOB_OF_BROWN_PUDDING,
    ONAMES.GLOB_OF_GREEN_SLIME, ONAMES.GLOB_OF_BLACK_PUDDING]) {
    test(`fresh glob type ${type} still sells as one weight unit`, async () => {
        const shkp = await setup();
        const obj = mksobj(type, true, false);
        assert.equal(obj.globby, 1);
        assert.equal(obj.quan, 1);
        assert.equal(obj.owt, 20);
        assert.equal(game.objects[type].oc_cost, 6);
        assert.equal(quote(await bagged(obj), shkp), 3);
    });
}

for (const [size, weight, expected] of [
    ['medium', 120, 18], ['large', 320, 48], ['very large', 520, 78],
]) {
    test(`${size} real wish prices its weight, not quantity one`, async () => {
        const shkp = await setup();
        const obj = await readobjnam(`${size} glob of gray ooze`, null);
        assert.equal(obj.quan, 1);
        assert.equal(obj.owt, weight);
        assert.equal(quote(await bagged(obj), shkp), expected);
        assert.equal(obj.owt, weight);
        assert.equal(has_omid(obj), false, 'sale pricing does not produce billing metadata');
    });
}

for (const [count, weight, expected] of [[1, 119, 18], [19, 101, 18], [20, 100, 15]]) {
    test(`real shrink to ${weight} respects ceiling division by twenty`, async () => {
        const shkp = await setup();
        const obj = await readobjnam('medium glob of gray ooze', null);
        const bag = await bagged(obj);
        await shrink(obj, count);
        assert.equal(obj.owt, weight);
        assert.equal(quote(bag, shkp), expected);
    });
}

test('real worn dunce cap applies the existing third-price divisor to total glob value', async () => {
    const shkp = await setup();
    const cap = await addinv(mksobj(ONAMES.DUNCE_CAP, false, false));
    await setworn(cap, W_ARMH);
    const obj = await readobjnam('medium glob of gray ooze', null);
    assert.equal(game.u.uarmh, cap);
    assert.equal(quote(await bagged(obj), shkp), 12);
});

test('a real visible shirt uses the same third-price divisor', async () => {
    const shkp = await setup();
    const shirt = await addinv(mksobj(ONAMES.HAWAIIAN_SHIRT, false, false));
    await setworn(null, W_ARM);
    await setworn(null, W_ARMC);
    await setworn(shirt, W_ARMU);
    assert.equal(game.u.uarm, null);
    assert.equal(game.u.uarmc, null);
    const obj = await readobjnam('medium glob of gray ooze', null);
    assert.equal(quote(await bagged(obj), shkp), 12);
});

for (const [wish, expected] of [['3 uncursed +0 daggers', 6], ['3 apples', 11]]) {
    test(`${wish} retains quantity pricing and C rounding`, async () => {
        const shkp = await setup();
        const obj = await readobjnam(wish, null);
        assert.equal(obj.quan, 3);
        assert.ok(!obj.globby);
        assert.equal(quote(await bagged(obj), shkp), expected);
    });
}

test('partly eaten and unpaid globs remain excluded from contained sale offers', async () => {
    const shkp = await setup();
    const eaten = await readobjnam('partly eaten glob of gray ooze', null);
    assert.ok(eaten.oeaten);
    assert.equal(quote(await bagged(eaten), shkp), 0);
    const unpaid = await readobjnam('medium glob of gray ooze', null);
    await addtobill(unpaid, false, false, true);
    assert.ok(unpaid.unpaid);
    assert.equal(quote(await bagged(unpaid), shkp), 0);
});

test('nested container total and the actual container sale use weighted contents', async () => {
    const shkp = await setup();
    const obj = await readobjnam('medium glob of gray ooze', null);
    const inner = await bagged(obj);
    const outer = await bagged(inner);
    assert.equal(game.objects[ONAMES.SACK].oc_cost, 2);
    assert.equal(quote(outer, shkp), 19, 'inner sack plus medium glob');
    assert.equal(await sell(outer), 20, 'outer sack plus the same contents');
});

test('actual cash sale pays eighteen for a medium glob', async () => {
    await setup();
    const obj = await readobjnam('medium glob of gray ooze', null);
    assert.equal(await sell(obj), 18);
    assert.equal(has_omid(obj), false, 'the independent acquisition patch is not required');
});

test('actual sale without shop cash grants sixteen credit', async () => {
    const shkp = await setup();
    await money2u(shkp, money_cnt(shkp.minvent));
    assert.equal(money_cnt(shkp.minvent), 0);
    const obj = await readobjnam('medium glob of gray ooze', null);
    const credit = shkp.eshk.credit;
    assert.equal(await sell(obj), 0);
    assert.equal(shkp.eshk.credit - credit, 16);
});

test('actual sale still caps payment at available shop cash', async () => {
    const shkp = await setup();
    await money2u(shkp, money_cnt(shkp.minvent) - 10);
    const obj = await readobjnam('medium glob of gray ooze', null);
    assert.equal(await sell(obj), 10);
    assert.equal(money_cnt(shkp.minvent), 0);
});

for (const mode of ['credit', 'debt', 'billed absorber']) {
    test(`real globby_bill_fixup ${mode} retains C's second units multiplication`, async () => {
        const shkp = await setup();
        const absorber = mksobj(ONAMES.GLOB_OF_GRAY_OOZE, true, false);
        const absorbed = await readobjnam('medium glob of gray ooze', null);
        await place_object(absorber, game.u.ux, game.u.uy);
        let bill;
        let oldPrice;
        if (mode === 'debt') {
            await costly_gold(game.u.ux, game.u.uy, 150, true);
            assert.equal(shkp.eshk.debit, 150);
            assert.equal(shkp.eshk.loan, 150);
        } else if (mode === 'billed absorber') {
            await addtobill(absorber, false, false, true);
            bill = onbill(absorber, shkp, true);
            oldPrice = bill.price;
        }
        assert.equal(get_pricing_units(absorbed), 6);
        const rng = [...getRngLog()];
        await globby_bill_fixup(absorber, absorbed);
        assert.deepEqual(getRngLog(), rng);
        assert.equal(absorber.owt, 20);
        assert.equal(absorbed.owt, 120);
        assert.equal(absorbed.where, OBJ_FREE);
        if (mode === 'credit') {
            assert.equal(shkp.eshk.credit, 108, 'six units times the eighteen-coin set_cost');
        } else if (mode === 'debt') {
            assert.equal(shkp.eshk.debit, 42);
            assert.equal(shkp.eshk.loan, 42);
            assert.equal(shkp.eshk.credit, 0);
        } else {
            assert.equal(bill.price - oldPrice, 108);
        }
        // This tests the real pricing consumer, not absorption or deallocation.
        // Those owners and their completion remain a separate audit.
    });
}
