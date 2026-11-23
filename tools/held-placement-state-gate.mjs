#!/usr/bin/env node
// Source-derived do.c:893 and mkobj.c:2305 controls, with normal runtime imports.
// Shop cases use the real billing, display and input chain. No module overrides.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import {
    mksobj, mksobj_at, place_object, recreate_pile_at, costly_alteration
} from '../js/mkobj.js';
import { obj_no_longer_held } from '../js/do.js';
import { obj_extract_self } from '../js/invent.js';
import { maketrap, mktrap, add_to_buried } from '../js/mklev.js';
import { unearth_objs } from '../js/dig.js';
import { movobj } from '../js/hack.js';
import { find_lev_obj } from '../js/restore.js';
import { addtobill, costly_spot, inside_shop, onbill } from '../js/shk.js';
import { pline } from '../js/display.js';
import { make_engr_at, engr_at } from '../js/engrave.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { isaac64_init, isaac64_next_uint64 } from '../js/isaac64.js';
import { ONAMES as N } from '../js/objects_data.js';
import {
    ROOM, OBJ_FREE, OBJ_FLOOR, OBJ_BURIED, OBJ_CONTAINED, OBJ_INVENT,
    PIT, MKTRAP_SEEN, MKTRAP_NOVICTIM, DUST, COST_DEGRD
} from '../js/const.js';

const shopInput = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/shop-normal.json', import.meta.url))).segments[0];
const plainInput = {
    seed: 99812,
    datetime: '20000110090000',
    moves: ' ',
    nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
};

function draws(seed, count = 4) {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setBigUint64(0, BigInt(seed), true);
    const ctx = isaac64_init(bytes);
    return Array.from({ length: count }, () => Number(isaac64_next_uint64(ctx) % 10n));
}

let reverts, survivesThenReverts;
for (let value = 1; value < 200 && (!reverts || !survivesThenReverts); value++) {
    const [first, second] = draws(value);
    if (!first && !reverts) reverts = value;
    if (first && !second && !survivesThenReverts) survivesThenReverts = value;
}
assert.ok(reverts && survivesThenReverts);

function seed(value = reverts) {
    initRng(value);
    enableRngLog();
}

function expected(value, count) {
    return draws(value, count).map(result => `rn2(10)=${result}`);
}

// mkobj.c:521/536: creation and dummy billing each allocate one ID with rnd(2).
function allocationDraw(value = reverts, after = 0) {
    return `rnd(2)=${draws(value, after + 1)[after] % 2 + 1}`;
}

async function setup(shop = false) {
    const replay = await runSegment({
        ...(shop ? shopInput : plainInput), storage: new InMemoryStorage()
    });
    replay._display.onEmptyQueue = () => 32;
    game.context.mon_moving = false;
    game.program_state_gameover = false;
    game._win_stop = false;
    if (!shop) {
        game.level.objects = [];
        game.level.objAt.clear();
        game.level.buriedobjs = [];
        game.level.traps = [];
        game.level.flags.has_shop = false;
        game.level.at(30, 10).typ = ROOM;
        game.level.at(31, 10).typ = ROOM;
    }
    return replay;
}

function knife(fixed = false) {
    const obj = mksobj(N.CRYSKNIFE, false, false);
    obj.oerodeproof = fixed ? 1 : 0;
    return obj;
}

function contain(container, contents) {
    container.cobj = contents;
    for (const obj of contents) {
        obj.where = OBJ_CONTAINED;
        obj.ocontainer = container;
    }
}

function linked(obj, x = 30, y = 10) {
    assert.equal(obj.where, OBJ_FLOOR);
    assert.deepEqual([obj.ox, obj.oy], [x, y]);
    assert.equal(game.level.objects.filter(item => item === obj).length, 1);
    assert.equal(game.level.objectsAt(x, y).filter(item => item === obj).length, 1);
}

async function billedKnife() {
    const replay = await setup(true);
    const keeper = game.level.monsters.find(mon => mon.isshk && mon.mhp > 0);
    assert.ok(keeper);
    let position;
    for (let x = 1; x < 79 && !position; x++) {
        for (let y = 0; y < 21; y++) {
            if (costly_spot(x, y)) {
                position = { x, y };
                break;
            }
        }
    }
    assert.ok(position);
    game.u.ux = position.x;
    game.u.uy = position.y;
    game.u.ushops = String.fromCharCode(inside_shop(position.x, position.y));
    const obj = knife();
    obj.ox = 7;
    obj.oy = 8;
    await addtobill(obj, false, false, true);
    assert.equal(obj.where, OBJ_FREE);
    assert.equal(obj.unpaid, 1);
    const bill = onbill(obj, keeper, false);
    assert.ok(bill);
    return { replay, keeper, obj, bill: { ...bill } };
}

async function messageBarrier(replay) {
    await pline('A message that needs acknowledgement before the shopkeeper can speak.');
    let release;
    let entered = false;
    replay._display.onEmptyQueue = () => {
        entered = true;
        return new Promise(resolve => { release = resolve; });
    };
    return {
        async inspect() {
            await new Promise(resolve => setImmediate(resolve));
            assert.ok(entered, 'real display reached its pending input callback');
        },
        release() {
            replay._display.onEmptyQueue = () => 32;
            release?.(32);
        }
    };
}

test('ordinary helper completes inline, with no RNG', async () => {
    await setup();
    const obj = knife();
    seed();
    assert.equal(obj_no_longer_held(obj), undefined);
    assert.equal(obj.otyp, N.WORM_TOOTH);
    assert.equal(obj.oerodeproof, 0);
    assert.deepEqual(getRngLog(), []);
});

test('nonknife, null and paid billing guards complete inline', async () => {
    await setup();
    const obj = mksobj(N.DAGGER, false, false);
    seed();
    assert.equal(obj_no_longer_held(null), undefined);
    assert.equal(obj_no_longer_held(obj), undefined);
    assert.equal(costly_alteration(obj, COST_DEGRD), undefined);
    assert.equal(place_object(obj, 30, 10), undefined);
    linked(obj);
    assert.deepEqual(getRngLog(), []);
});

test('invalid alteration diagnostic precedes the paid early return', async () => {
    await setup();
    const obj = mksobj(N.DAGGER, false, false);
    const pending = costly_alteration(obj, -1);
    assert.ok(pending?.then);
    await pending;
    assert.ok(game.impossible_log.includes('invalid alteration type (-1)'));
    assert.equal(obj.otyp, N.DAGGER);
});

for (const [label, value, type] of [
    ['survives', survivesThenReverts, N.CRYSKNIFE],
    ['reverts', reverts, N.WORM_TOOTH]
]) {
    test(`fixed stack ${label} after exactly one inline placement roll`, async () => {
        await setup();
        const obj = knife(true);
        obj.quan = 5;
        seed(value);
        assert.equal(place_object(obj, 30, 10), undefined);
        assert.equal(obj.otyp, type);
        assert.equal(obj.quan, 5);
        linked(obj);
        assert.deepEqual(getRngLog(), expected(value, 1));
    });
}

test('fresh explicit knife factory returns an already converted object', async () => {
    await setup();
    seed();
    const obj = mksobj_at(N.CRYSKNIFE, 30, 10, false, false);
    assert.equal(obj?.then, undefined);
    assert.equal(obj.otyp, N.WORM_TOOTH);
    linked(obj);
    assert.deepEqual(getRngLog(), [allocationDraw()]);
});

test('boulder movement and fresh trap generation keep synchronous returns', async () => {
    await setup();
    const boulder = mksobj_at(N.BOULDER, 30, 10, false, false);
    seed();
    assert.equal(movobj(boulder, 31, 10), undefined);
    linked(boulder, 31, 10);
    assert.equal(unearth_objs(30, 10), undefined);
    const trap = maketrap(30, 10, PIT);
    assert.equal(trap.ttyp, PIT);
    assert.equal(trap?.then, undefined);
    assert.equal(mktrap(PIT, MKTRAP_NOVICTIM, null, { x: 30, y: 10 }), undefined);
    assert.deepEqual(getRngLog(), []);
});

test('nested contents complete depth first before their parent type is examined', async () => {
    await setup();
    const root = mksobj(N.SACK, false, false);
    const inner = mksobj(N.SACK, false, false);
    const a = knife(), b = knife(), c = knife();
    contain(inner, [a, b]);
    contain(root, [inner, c]);
    const order = [];
    for (const [name, obj] of [['a', a], ['b', b], ['c', c]]) {
        let type = obj.otyp;
        Object.defineProperty(obj, 'otyp', {
            configurable: true,
            get: () => type,
            set(value) { type = value; order.push(name); }
        });
    }
    for (const [name, obj] of [['inner', inner], ['root', root]]) {
        const type = obj.otyp;
        Object.defineProperty(obj, 'otyp', {
            configurable: true,
            get() { order.push(name); return type; }
        });
    }
    seed();
    assert.equal(obj_no_longer_held(root), undefined);
    assert.deepEqual(order, ['a', 'b', 'inner', 'c', 'root']);
    assert.deepEqual(getRngLog(), []);
});

test('nested fixed knives consume RNG in cobj order, not global floor order', async () => {
    await setup();
    const root = mksobj(N.SACK, false, false);
    const inner = mksobj(N.SACK, false, false);
    const leaves = Array.from({ length: 4 }, () => knife(true));
    contain(inner, leaves.slice(1, 3));
    contain(root, [leaves[0], inner, leaves[3]]);
    seed(survivesThenReverts);
    assert.equal(place_object(root, 30, 10), undefined);
    assert.deepEqual(leaves.map(obj => obj.otyp), draws(survivesThenReverts)
        .map(value => value ? N.CRYSKNIFE : N.WORM_TOOTH));
    assert.deepEqual(getRngLog(), expected(survivesThenReverts, 4));
    linked(root);
});

test('genuine explicit release and subsequent placement retain both fixed rolls', async () => {
    await setup();
    const obj = knife(true);
    seed(survivesThenReverts);
    await obj_no_longer_held(obj);
    assert.equal(obj.otyp, N.CRYSKNIFE);
    await place_object(obj, 30, 10);
    assert.equal(obj.otyp, N.WORM_TOOTH);
    assert.deepEqual(getRngLog(), expected(survivesThenReverts, 2));
});

for (const guard of ['mon_moving', 'gameover']) {
    test(`${guard} skips actual unpaid billing but still converts inline`, async () => {
        const { obj, keeper, bill } = await billedKnife();
        if (guard === 'mon_moving') game.context.mon_moving = true;
        else game.program_state_gameover = true;
        seed();
        assert.equal(place_object(obj, 30, 10), undefined);
        assert.equal(obj.otyp, N.WORM_TOOTH);
        assert.equal(obj.unpaid, 1);
        assert.deepEqual(onbill(obj, keeper, false), bill);
        assert.deepEqual(getRngLog(), []);
    });
}

test('unpaid FREE placement waits for the real message and bill before chains and coordinates', async () => {
    const { replay, keeper, obj, bill } = await billedKnife();
    const bottom = mksobj_at(N.DAGGER, 30, 10, false, false);
    const global = [...game.level.objects];
    const barrier = await messageBarrier(replay);
    seed();
    const pending = place_object(obj, 30, 10);
    try {
        assert.ok(pending?.then);
        await barrier.inspect();
        assert.equal(obj.otyp, N.CRYSKNIFE);
        assert.equal(obj.where, OBJ_FREE);
        assert.deepEqual([obj.ox, obj.oy], [7, 8]);
        assert.equal(game.level.objectAt(30, 10), bottom);
        assert.deepEqual(game.level.objects, global);
        assert.equal(obj.unpaid, 1);
        assert.deepEqual(onbill(obj, keeper, false), bill);
    } finally {
        barrier.release();
        await pending;
    }
    assert.equal(obj.otyp, N.WORM_TOOTH);
    assert.equal(obj.unpaid, 0);
    assert.equal(onbill(obj, keeper, false), null);
    const dummy = game.billobjs.find(item => item.otyp === N.CRYSKNIFE);
    assert.ok(dummy);
    const dummyBill = onbill(dummy, keeper, false);
    assert.equal(dummyBill.useup, true);
    assert.equal(dummyBill.price, bill.price);
    assert.equal(obj.nexthere, bottom);
    linked(obj);
    assert.deepEqual(getRngLog(), [allocationDraw()]);
});

for (const operation of ['maketrap', 'mktrap']) {
    test(`buried unpaid knife propagates pending billing through ${operation}`, async () => {
        const { replay, obj } = await billedKnife();
        game.level.at(30, 10).typ = ROOM;
        game.level.traps = game.level.traps.filter(t => t.tx !== 30 || t.ty !== 10);
        const later = mksobj(N.DAGGER, false, false);
        Object.assign(later, { ox: 30, oy: 10 });
        add_to_buried(later);
        Object.assign(obj, { ox: 30, oy: 10 });
        add_to_buried(obj);
        make_engr_at(30, 10, 'Buried marker', null, game.moves, DUST);
        const barrier = await messageBarrier(replay);
        seed();
        const pending = operation === 'maketrap'
            ? maketrap(30, 10, PIT)
            : mktrap(PIT, MKTRAP_SEEN | MKTRAP_NOVICTIM, null, { x: 30, y: 10 });
        let result;
        try {
            assert.ok(pending?.then);
            await barrier.inspect();
            assert.equal(obj.where, OBJ_FREE);
            assert.equal(obj.otyp, N.CRYSKNIFE);
            assert.equal(later.where, OBJ_BURIED);
            assert.ok(game.level.buriedobjs.includes(later));
            assert.equal(game.level.objects.includes(obj), false);
            assert.equal(game.level.traps.some(t => t.tx === 30 && t.ty === 10), false);
            assert.equal(engr_at(30, 10).engr_txt, 'Buried marker');
        } finally {
            barrier.release();
            result = await pending;
        }
        const trap = game.level.traps.find(t => t.tx === 30 && t.ty === 10);
        assert.ok(trap);
        if (operation === 'maketrap') assert.equal(result, trap);
        else assert.equal(trap.tseen, true);
        assert.equal(engr_at(30, 10), null);
        assert.equal(obj.otyp, N.WORM_TOOTH);
        assert.equal(obj.unpaid, 0);
        linked(obj);
        linked(later);
        assert.equal(later.nexthere, obj);
        assert.deepEqual(getRngLog(), [allocationDraw()]);
    });
}

for (const operation of ['recreate', 'restore']) {
    test(`${operation} waits in reversed chain order for real unpaid billing`, async () => {
        const { replay, obj } = await billedKnife();
        // C can retain an unpaid fixed knife on the floor after a nonzero roll.
        obj.oerodeproof = 1;
        seed(survivesThenReverts);
        await place_object(obj, 30, 10);
        assert.equal(obj.otyp, N.CRYSKNIFE);
        const later = mksobj_at(N.DAGGER, 30, 10, false, false);
        const before = [...game.level.objects];
        const barrier = await messageBarrier(replay);
        seed(reverts);
        const pending = operation === 'restore' ? find_lev_obj() : recreate_pile_at(30, 10);
        try {
            assert.ok(pending?.then);
            await barrier.inspect();
            assert.equal(obj.where, OBJ_FREE);
            assert.equal(later.where, OBJ_FREE);
            assert.equal(obj.otyp, N.CRYSKNIFE);
            assert.equal(game.level.objectAt(30, 10), null);
        } finally {
            barrier.release();
            await pending;
        }
        assert.equal(obj.otyp, N.WORM_TOOTH);
        assert.equal(obj.unpaid, 0);
        linked(obj);
        linked(later);
        if (operation === 'restore') assert.deepEqual(game.level.objects, before);
        assert.deepEqual(game.level.objectsAt(30, 10), [later, obj]);
        assert.deepEqual(getRngLog(), [...expected(reverts, 1), allocationDraw(reverts, 1)]);
    });
}

test('unpaid contained knife preserves its billing guards and has no free/floor charge arm', async () => {
    const { keeper, obj, bill } = await billedKnife();
    const sack = mksobj(N.SACK, false, false);
    sack.where = OBJ_INVENT;
    game.invent.push(sack);
    contain(sack, [obj]);
    seed();
    assert.equal(costly_alteration(obj, COST_DEGRD), undefined);
    assert.deepEqual(onbill(obj, keeper, false), bill);
    assert.equal(obj_no_longer_held(sack), undefined);
    assert.equal(obj.otyp, N.WORM_TOOTH);
    assert.equal(obj.unpaid, 1);
    obj_extract_self(sack);
    assert.equal(place_object(sack, 30, 10), undefined);
    linked(sack);
    assert.deepEqual(getRngLog(), []);
});
