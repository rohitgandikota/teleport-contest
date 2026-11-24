// C-derived ownership controls using real producers and public shop commands.
// Payment questions use the normal input transport; no helper is replaced.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mksobj, splitobj, bill_dummy_object, dobjsfree,
    add_to_container, place_object } from '../js/mkobj.js';
import { addinv, useup, useupall, money_cnt, freeinv } from '../js/invent.js';
import { addtobill, onbill, setpaid, subfrombill, dopay, make_angry_shk,
    costly_spot, find_oid, shkgone } from '../js/shk.js';
import { readobjnam } from '../js/objnam.js';
import { oname } from '../js/do_name.js';
import { savelev, dosave0, dorecover } from '../js/save.js';
import { ledger_no } from '../js/dungeon.js';
import { peek_timer, SHRINK_GLOB } from '../js/timeout.js';
import { getRngLog } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { TOPLINE_SPECIAL_PROMPT } from '../js/display.js';
import { ONAMES } from '../js/objects_data.js';
import { OBJ_INVENT, OBJ_FLOOR, OBJ_CONTAINED, OBJ_ONBILL, OBJ_DELETED,
    MENU_TRADITIONAL, ECMD_TIME } from '../js/const.js';

const source = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/shop-food-price-rounding.json', import.meta.url))).segments[0];
const entry = { ...source, moves: source.moves.slice(0, source.moves.indexOf('\x17')) };

async function setup() {
    const run = await runSegment({ ...entry, storage: new InMemoryStorage() });
    let reads = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(++reads < 100, 'bounded real input requests');
        return 27;
    };
    game._preNhgetchHook = null;
    resetInputState();
    const shkp = game.level.monsters.find(mon => mon.isshk);
    assert.ok(shkp && game.u.ushops);
    assert.equal(costly_spot(game.u.ux, game.u.uy), true);
    assert.equal(shkp.eshk.billct, 0);
    assert.equal(game.billobjs.length, 0);
    dobjsfree();
    return { run, shkp };
}

async function billed(shkp, wish = '1 potion of fruit juice') {
    const obj = await addinv(await readobjnam(wish, null));
    await addtobill(obj, false, false, true);
    const bp = onbill(obj, shkp, true);
    assert.ok(bp && obj.unpaid);
    return { obj, bp };
}

async function consumed(shkp, wish) {
    const result = await billed(shkp, wish);
    await useupall(result.obj);
    assert.equal(result.obj.where, OBJ_ONBILL);
    assert.equal(result.bp.useup, true);
    assert.ok(game.billobjs.includes(result.obj));
    assert.ok(!deleted().includes(result.obj));
    return result;
}

function deleted() {
    return game.objs_deleted || [];
}

function staged(obj) {
    assert.equal(obj.where, OBJ_DELETED);
    assert.equal(deleted().filter(item => item === obj).length, 1);
    assert.ok(!game.billobjs.includes(obj));
}

async function pay(ctx, answer = () => 'y') {
    game.flags.menu_style = MENU_TRADITIONAL;
    let reads = 0;
    ctx.run._display.onEmptyQueue = () => {
        assert.ok(++reads < 100, 'bounded payment questions and acknowledgments');
        return game._toplin === TOPLINE_SPECIAL_PROMPT
            ? answer(game._pending_message).charCodeAt(0) : 27;
    };
    return dopay();
}

async function wallet() {
    await addinv(await readobjnam('1000 gold pieces', null));
}

test('empty setpaid stays synchronous and preserves inventory, money and RNG', async () => {
    const { shkp } = await setup();
    const inventory = [...game.invent], rng = [...getRngLog()];
    assert.equal(setpaid(shkp), undefined);
    assert.deepEqual(game.invent, inventory);
    assert.deepEqual(deleted(), []);
    assert.deepEqual(getRngLog(), rng);
    assert.deepEqual([shkp.eshk.billct, shkp.eshk.credit,
        shkp.eshk.debit, shkp.eshk.loan], [0, 0, 0, 0]);
});

test('setpaid unlinks a consumed record, stages it once and releases extras at drain', async () => {
    const { shkp } = await setup();
    const { obj } = await billed(shkp);
    await oname(obj, 'Receipt', 0);
    const extra = obj.oextra, id = obj.o_id;
    await useupall(obj);
    const chain = game.billobjs, rng = [...getRngLog()];
    assert.equal(setpaid(shkp), undefined);
    assert.equal(game.billobjs, chain, 'extract the existing owner chain');
    assert.deepEqual(chain, []);
    staged(obj);
    assert.equal(obj.o_id, id);
    assert.equal(obj.oextra, extra, 'record remains readable until dobjsfree');
    assert.equal(shkp.eshk.billct, 0);
    assert.deepEqual(getRngLog(), rng);
    dobjsfree();
    assert.deepEqual(obj, {});
    assert.deepEqual(deleted(), []);
});

test('all three real bill-object producers drain in C chain order', async () => {
    const { shkp } = await setup();
    const first = (await consumed(shkp)).obj;
    const { obj: original } = await billed(shkp, '1 uncursed +0 dagger');
    await bill_dummy_object(original);
    const dummy = game.billobjs[0];
    assert.notEqual(dummy, original);
    const { obj: stack } = await billed(shkp, '3 apples');
    await useup(stack);
    subfrombill(stack, shkp);
    const remainder = game.billobjs[0];
    assert.equal(remainder.quan, 1);
    assert.notEqual(remainder, stack);
    assert.deepEqual(game.billobjs, [remainder, dummy, first]);
    setpaid(shkp);
    assert.deepEqual(game.billobjs, []);
    assert.deepEqual(deleted(), [first, dummy, remainder]);
    assert.equal(original.where, OBJ_INVENT);
    assert.equal(stack.where, OBJ_INVENT);
    dobjsfree();
    for (const obj of [first, dummy, remainder])
        assert.deepEqual(obj, {});
});

test('setpaid preserves live inventory, contained and floor objects', async () => {
    const { shkp } = await setup();
    const { obj: carried } = await billed(shkp, '1 uncursed +0 dagger');
    const bag = await addinv(mksobj(ONAMES.SACK, false, false));
    const { obj: inside } = await billed(shkp, '1 apple');
    await freeinv(inside);
    await add_to_container(bag, inside);
    const { obj: floor } = await billed(shkp);
    await freeinv(floor);
    await place_object(floor, game.u.ux, game.u.uy);
    setpaid(shkp);
    assert.deepEqual([carried.where, inside.where, floor.where],
        [OBJ_INVENT, OBJ_CONTAINED, OBJ_FLOOR]);
    assert.deepEqual([carried.unpaid, inside.unpaid, floor.unpaid], [0, 0, 0]);
    assert.equal(inside.ocontainer, bag);
    assert.ok(game.level.objects.includes(floor));
    assert.deepEqual(deleted(), []);
});

test('setpaid(null) disposes global bill objects without changing a keeper account', async () => {
    const { shkp } = await setup();
    const { obj } = await consumed(shkp);
    const before = { ...shkp.eshk };
    assert.equal(setpaid(null), undefined);
    staged(obj);
    assert.deepEqual(shkp.eshk, before);
});

test('a repeated setpaid does not enqueue the same record twice', async () => {
    const { shkp } = await setup();
    const { obj } = await consumed(shkp);
    setpaid(shkp);
    setpaid(shkp);
    staged(obj);
    dobjsfree();
    setpaid(shkp);
    assert.deepEqual(deleted(), []);
});

test('real timed glob enters the bill with its timer stopped before disposal', async () => {
    const { shkp } = await setup();
    const { obj } = await billed(shkp, 'medium glob of gray ooze');
    assert.ok(peek_timer(SHRINK_GLOB, obj));
    await useupall(obj);
    assert.equal(obj.timed, 0);
    assert.equal(peek_timer(SHRINK_GLOB, obj), 0);
    const timers = [...game.timer_base], rng = [...getRngLog()];
    setpaid(shkp);
    staged(obj);
    assert.deepEqual(game.timer_base, timers);
    assert.deepEqual(getRngLog(), rng);
});

test('real split child retained by billing loses the old unsplit association on disposal', async () => {
    const { shkp } = await setup();
    const { obj: parent } = await billed(shkp, '3 apples');
    const child = splitobj(parent, 1);
    assert.equal(game.context.objsplit.child_oid, child.o_id);
    await useupall(child);
    assert.equal(child.where, OBJ_ONBILL);
    assert.equal(game.context.objsplit.child_oid, child.o_id);
    setpaid(shkp);
    staged(child);
    assert.deepEqual([game.context.objsplit.parent_oid,
        game.context.objsplit.child_oid], [0, 0]);
    assert.equal(parent.where, OBJ_INVENT);
    assert.equal(parent.quan, 2);
});

test('freeingdata uses canonical immediate release rather than deletion staging', async () => {
    const { shkp } = await setup();
    const { obj } = await consumed(shkp);
    game.program_state.freeingdata = 1;
    try {
        setpaid(shkp);
        assert.deepEqual(game.billobjs, []);
        assert.deepEqual(obj, {});
        assert.deepEqual(deleted(), []);
    } finally {
        game.program_state.freeingdata = 0;
    }
});

test('level saving cannot retain a cancelled bill-object owner', async () => {
    const { shkp } = await setup();
    const { obj } = await consumed(shkp);
    setpaid(shkp);
    const saved = savelev(ledger_no(game.u.uz));
    assert.deepEqual(saved._saved_billobjs, []);
    assert.deepEqual(obj, {}, 'savelev drains canonical staged deletions');
});

for (const cancel of [false, true]) {
    test(`full restore ${cancel ? 'omits cancelled' : 'preserves outstanding'} bill ownership`, async () => {
        const { shkp } = await setup();
        const { obj } = await consumed(shkp);
        const id = obj.o_id;
        if (cancel)
            setpaid(shkp);
        assert.equal(await dosave0(), true);
        assert.equal(await dorecover(), true);
        const restored = game.billobjs.find(item => item.o_id === id);
        assert.equal(!!restored, !cancel);
        if (restored) {
            assert.equal(restored.where, OBJ_ONBILL);
            assert.equal(find_oid(id), null, 'bill-only record stays outside live object lookup');
        }
    });
}

for (const action of ['anger', 'shopkeeper removal']) {
    test(`${action} reaches setpaid disposal through the existing public owner`, async () => {
        const { shkp } = await setup();
        const { obj, bp } = await consumed(shkp);
        const cost = bp.price * bp.bquan;
        if (action === 'anger') {
            await make_angry_shk(shkp, shkp.mx, shkp.my);
            assert.equal(shkp.eshk.robbed, cost);
        } else {
            shkgone(shkp);
            assert.equal(game.u.ushops, '');
        }
        staged(obj);
        assert.equal(shkp.eshk.billct, 0);
    });
}

test('public payment releases a used-up record after real money transfer', async () => {
    const ctx = await setup();
    const { obj, bp } = await consumed(ctx.shkp);
    await wallet();
    const cost = bp.price * bp.bquan, gold = money_cnt(game.invent);
    const rng = [...getRngLog()];
    assert.equal(await pay(ctx), ECMD_TIME);
    assert.equal(money_cnt(game.invent), gold - cost);
    assert.equal(ctx.shkp.eshk.billct, 0);
    staged(obj);
    assert.deepEqual(getRngLog().slice(0, rng.length), rng);
    assert.equal(getRngLog().length, rng.length + 1);
    assert.match(getRngLog()[rng.length], /^rnd\(2\)=[12]$/,
        'money2mon splits gold through nextoid; disposal adds no draw');
    dobjsfree();
    assert.deepEqual(obj, {});
});

test('declined used-up payment preserves bill ownership, quantity and money', async () => {
    const ctx = await setup();
    const { obj, bp } = await consumed(ctx.shkp);
    await wallet();
    const gold = money_cnt(game.invent), quantity = obj.quan;
    await pay(ctx, () => 'n');
    assert.equal(obj.where, OBJ_ONBILL);
    assert.equal(obj.quan, quantity);
    assert.ok(ctx.shkp.eshk.bill_p.includes(bp));
    assert.equal(money_cnt(game.invent), gold);
    assert.deepEqual(deleted(), []);
});

test('no funds leaves the used-up record retained and unqueued', async () => {
    const ctx = await setup();
    const { obj, bp } = await consumed(ctx.shkp);
    assert.equal(money_cnt(game.invent), 0);
    await pay(ctx);
    assert.equal(obj.where, OBJ_ONBILL);
    assert.ok(ctx.shkp.eshk.bill_p.includes(bp));
    assert.deepEqual(deleted(), []);
});

test('buying only the used portion retains the real unpaid remainder', async () => {
    const ctx = await setup();
    const { obj, bp } = await billed(ctx.shkp, '3 apples');
    await useup(obj);
    await wallet();
    const gold = money_cnt(game.invent), price = bp.price;
    await pay(ctx, prompt => prompt.includes('2 apples') ? 'n' : 'y');
    assert.equal(money_cnt(game.invent), gold - price);
    assert.equal(obj.where, OBJ_INVENT);
    assert.equal(obj.quan, 2);
    assert.equal(obj.unpaid, 1);
    assert.equal(bp.bquan, 2);
    assert.ok(ctx.shkp.eshk.bill_p.includes(bp));
    assert.equal(deleted().length, 1, 'payment merges a split coin stack');
    assert.equal(deleted()[0].otyp, ONAMES.GOLD_PIECE);
    assert.equal(deleted()[0].where, OBJ_DELETED);
});

test('mixed consumed and intact entries preserve bill-index remapping during payment', async () => {
    const ctx = await setup();
    const dead = [];
    let cost = 0;
    for (const wish of ['1 potion of fruit juice', '2 apples']) {
        const { obj, bp } = await consumed(ctx.shkp, wish);
        dead.push(obj);
        cost += bp.price * bp.bquan;
    }
    const { obj: intact, bp } = await billed(ctx.shkp, '1 uncursed +0 dagger');
    cost += bp.price * bp.bquan;
    await wallet();
    const gold = money_cnt(game.invent);
    await pay(ctx);
    assert.equal(money_cnt(game.invent), gold - cost);
    assert.equal(ctx.shkp.eshk.billct, 0);
    assert.equal(intact.where, OBJ_INVENT);
    assert.equal(intact.unpaid, 0);
    for (const obj of dead)
        staged(obj);
    assert.equal(deleted().filter(obj => obj.otyp !== ONAMES.GOLD_PIECE).length, 2);
});

test('container payment retains the real container and purchased contents', async () => {
    const ctx = await setup();
    const { obj } = await billed(ctx.shkp, '1 apple');
    const bag = await addinv(mksobj(ONAMES.SACK, false, false));
    await freeinv(obj);
    await add_to_container(bag, obj);
    await wallet();
    await pay(ctx);
    assert.equal(ctx.shkp.eshk.billct, 0);
    assert.equal(obj.unpaid, 0);
    assert.equal(obj.where, OBJ_CONTAINED);
    assert.equal(obj.ocontainer, bag);
    assert.deepEqual(bag.cobj, [obj]);
    assert.equal(deleted().length, 1, 'payment merges a split coin stack');
    assert.equal(deleted()[0].otyp, ONAMES.GOLD_PIECE);
    assert.equal(deleted()[0].where, OBJ_DELETED);
});
