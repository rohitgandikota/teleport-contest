// Source controls for mkobj.c:2745-2844, :3702-3754 and shk.c:1187-1274.
// Real object, timer, light, inventory and shop owners. No native oracle claim.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import * as mkobj from '../js/mkobj.js';
import { obfree, hands_obj, addinv, freeinv, useupall, obj_extract_self } from '../js/invent.js';
import { begin_burn, start_timer, peek_timer, obj_stop_timers,
    TIMER_OBJECT, SHRINK_GLOB, ROT_CORPSE, BURN_OBJECT } from '../js/timeout.js';
import { LS_OBJECT, obj_sheds_light } from '../js/light.js';
import { flooreffects } from '../js/do.js';
import { moveloop_core } from '../js/allmain.js';
import { savelev } from '../js/save.js';
import { ledger_no } from '../js/dungeon.js';
import { addtobill } from '../js/shk.js';
import { setuwep } from '../js/wield.js';
import { oname } from '../js/do_name.js';
import { pline, TOPLINE_EMPTY } from '../js/display.js';
import { resetInputState, pushKeys } from '../js/input.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { OBJ_FREE, OBJ_FLOOR, OBJ_INVENT, OBJ_CONTAINED, OBJ_MINVENT,
    OBJ_MIGRATING, OBJ_BURIED, OBJ_ONBILL, OBJ_LUAFREE, OBJ_DELETED,
    ROOM, ONAME_NO_FLAGS } from '../js/const.js';
import { IN_SIGHT, COULD_SEE, TEMP_LIT } from '../js/vision.js';

const basic = { seed: 7341, datetime: '20000110090000', moves: ' ',
    nethackrc: 'OPTIONS=name:Dealloc,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n' };

async function setup(input = basic) {
    const replay = await runSegment({ ...input, storage: new InMemoryStorage() });
    let acknowledgments = 0;
    replay._display.onEmptyQueue = () => {
        assert.ok(++acknowledgments <= 30, 'bounded real message acknowledgments');
        return 32;
    };
    game._preNhgetchHook = null;
    resetInputState();
    if (input === basic) {
        game.level.objects = []; game.level.objAt.clear();
        game.level.monsters = []; game.level.monAt = new Map();
        game.level.buriedobjs = []; game.level.traps = [];
        game.invent = []; game.timer_base = []; game.light_sources = [];
        game.billobjs = []; game.migrating_objs = [];
        game.u.ux = 30; game.u.uy = 10; game.u.ushops = '';
        game.moves = 100;
        for (let x = 28; x <= 35; x++) for (let y = 8; y <= 12; y++) {
            Object.assign(game.level.at(x, y), { typ: ROOM, lit: 1, roomno: 0 });
            game.viz_array[y][x] = IN_SIGHT | COULD_SEE | TEMP_LIT;
        }
    }
    // Startup's deleted temporary objects have no role in these owner controls.
    mkobj.dobjsfree();
    game._toplin = TOPLINE_EMPTY; game._prevmsg = '';
    return replay;
}
const object = (type = ONAMES.DAGGER) => mkobj.mksobj(type, false, false);
function seed() { initRng(19); enableRngLog(); }
function dealloc(obj) {
    assert.equal(typeof mkobj.dealloc_obj, 'function', 'canonical C helper exists');
    return mkobj.dealloc_obj(obj);
}
function staged(obj) {
    assert.equal(obj.where, OBJ_DELETED);
    assert.equal(game.objs_deleted?.filter(o => o === obj).length, 1);
}
function glob(weight = 20, delay = 25) {
    const obj = mkobj.mksobj(ONAMES.GLOB_OF_GRAY_OOZE, true, false);
    obj_stop_timers(obj);
    obj.owt = weight;
    mkobj.start_glob_timeout(obj, delay);
    return obj;
}

test('ordinary obfree is synchronous and stages a complete record until the drain', async () => {
    await setup(); const obj = object(); const id = obj.o_id;
    seed(); assert.equal(obfree(obj), undefined); staged(obj);
    assert.equal(obj.o_id, id); assert.equal(obj.otyp, ONAMES.DAGGER);
    mkobj.dobjsfree(); assert.deepEqual(obj, {}); assert.deepEqual(game.objs_deleted, []);
    assert.deepEqual(getRngLog(), []);
});

test('obj_absorb cleans only absorbed transient references after C timer averaging', async () => {
    await setup(); const survivor = glob(40, 40), removed = glob(20, 10), other = glob(20, 70);
    survivor.age = 40; removed.age = 70;
    game.thrownobj = removed; game.kickedobj = removed;
    game.context.tin = { tin: removed, o_id: removed.o_id };
    game.context.objsplit = { parent_oid: removed.o_id, child_oid: other.o_id };
    const removedId = removed.o_id, wrapper = { v: removed };
    seed(); assert.equal(await mkobj.obj_absorb({ v: survivor }, wrapper), survivor);
    assert.equal(wrapper.v, null); staged(removed);
    assert.equal(survivor.owt, 60); assert.equal(survivor.age, 50);
    assert.equal(peek_timer(SHRINK_GLOB, survivor), 125);
    assert.equal(peek_timer(SHRINK_GLOB, removed), 0); assert.equal(removed.timed, 0);
    assert.equal(peek_timer(SHRINK_GLOB, other), 170); assert.equal(other.timed, 1);
    assert.equal(removed.o_id, removedId);
    assert.equal(game.thrownobj, null); assert.equal(game.kickedobj, null);
    assert.deepEqual(game.context.tin, { tin: null, o_id: 0 });
    assert.deepEqual(game.context.objsplit, { parent_oid: 0, child_oid: 0 });
    assert.deepEqual(getRngLog(), []);
});

test('actual flooreffects gives the floor glob precedence over a heavier free glob', async () => {
    await setup(); const floor = glob(20, 20), dropped = glob(80, 40);
    await mkobj.place_object(floor, 31, 10);
    game.thrownobj = dropped;
    assert.equal(await flooreffects(dropped, 31, 10, 'fall'), true);
    staged(dropped); assert.equal(game.thrownobj, null);
    assert.equal(floor.owt, 100); assert.equal(peek_timer(SHRINK_GLOB, floor), 130);
    assert.deepEqual(game.level.objectsAt(31, 10), [floor]);
});

test('opposite floor melding branch extracts the lighter first object', async () => {
    await setup(); const small = glob(20, 10), large = glob(40, 30);
    await mkobj.place_object(small, 31, 10); await mkobj.place_object(large, 32, 10);
    game.kickedobj = small;
    const a = { v: small }, b = { v: large };
    seed(); assert.equal(await mkobj.obj_meld(a, b), large);
    assert.equal(a.v, null); assert.equal(b.v, large); staged(small);
    assert.equal(game.kickedobj, null); assert.equal(game.level.objectsAt(31, 10).length, 0);
    assert.equal(large.owt, 60); assert.equal(peek_timer(SHRINK_GLOB, large), 120);
    assert.deepEqual(getRngLog(), []);
});

test('deallocation matches transient pointers, while split cleanup matches IDs', async () => {
    await setup(); const obj = object(), other = object(); other.o_id = obj.o_id;
    game.thrownobj = other; game.kickedobj = other;
    game.context.tin = { tin: other, o_id: other.o_id };
    game.context.objsplit = { parent_oid: 0, child_oid: obj.o_id };
    seed(); assert.equal(dealloc(obj), undefined); staged(obj);
    assert.equal(game.thrownobj, other); assert.equal(game.kickedobj, other);
    assert.equal(game.context.tin.tin, other); assert.equal(game.context.tin.o_id, other.o_id);
    assert.deepEqual(game.context.objsplit, { parent_oid: 0, child_oid: 0 });
    assert.deepEqual(getRngLog(), []);
});

test('unrelated split and occupation owners remain unchanged in canonical dealloc', async () => {
    await setup(); const obj = object(ONAMES.FOOD_RATION), other = object();
    const split = { parent_oid: other.o_id, child_oid: other.o_id + 100 };
    game.context.objsplit = { ...split };
    game.context.victual = { piece: obj }; game.context.spbook = { book: obj, o_id: obj.o_id };
    dealloc(obj); staged(obj);
    assert.deepEqual(game.context.objsplit, split);
    assert.equal(game.context.victual.piece, obj); assert.equal(game.context.spbook.book, obj);
});

for (const type of [ONAMES.OIL_LAMP, ONAMES.MAGIC_LAMP]) {
    test(`real burning ${type === ONAMES.OIL_LAMP ? 'timed oil' : 'untimed magic'} lamp releases light and requests vision`, async () => {
        await setup(); const lamp = mkobj.mksobj(type, true, false); lamp.age = 500;
        await mkobj.place_object(lamp, 31, 10); await begin_burn(lamp, false);
        assert.ok(obj_sheds_light(lamp));
        assert.equal(!!lamp.timed, type === ONAMES.OIL_LAMP);
        const second = mkobj.mksobj(ONAMES.MAGIC_LAMP, true, false);
        await mkobj.place_object(second, 32, 10); await begin_burn(second, false);
        obj_extract_self(lamp); game.vision_full_recalc = 0;
        seed(); assert.equal(obfree(lamp), undefined); staged(lamp);
        assert.equal(lamp.lamplit, 0); assert.equal(lamp.timed || 0, 0);
        assert.equal(game.vision_full_recalc, 1);
        assert.equal(peek_timer(BURN_OBJECT, lamp), 0);
        if (type === ONAMES.OIL_LAMP) assert.equal(lamp.age, 500);
        assert.deepEqual(game.light_sources.map(l => [l.type, l.id]), [[LS_OBJECT, second.o_id]]);
        assert.equal(second.lamplit, 1); assert.deepEqual(getRngLog(), []);
    });
}

test("literal obj_sheds_light guard keeps a non-light object's lamplit bit until physical release", async () => {
    await setup(); const obj = object(); obj.lamplit = 1;
    assert.equal(obj_sheds_light(obj), false);
    game.vision_full_recalc = 0; obfree(obj); staged(obj);
    assert.equal(obj.lamplit, 1); assert.equal(game.vision_full_recalc, 0);
});

test('all attached object timers stop, unrelated timers retain identity and order', async () => {
    await setup(); const obj = object(ONAMES.CORPSE), other = object(ONAMES.CORPSE);
    start_timer(8, TIMER_OBJECT, ROT_CORPSE, obj);
    const retained = game.timer_base.filter(t => t.arg === other);
    assert.ok(obj.timed > 0); seed(); dealloc(obj); staged(obj);
    assert.equal(obj.timed, 0); assert.deepEqual(game.timer_base, retained);
    assert.deepEqual(getRngLog(), []);
});

for (const where of [OBJ_FLOOR, OBJ_INVENT, OBJ_CONTAINED, OBJ_MINVENT,
    OBJ_MIGRATING, OBJ_BURIED, OBJ_ONBILL]) {
    test(`C rejects still-owned object where=${where} before timer/transient cleanup`, async () => {
        await setup(); const obj = object(); obj.where = where;
        start_timer(8, TIMER_OBJECT, ROT_CORPSE, obj); game.thrownobj = obj;
        const timers = [...game.timer_base];
        assert.throws(() => dealloc(obj), /dealloc_obj: obj not free/);
        assert.deepEqual(game.timer_base, timers); assert.equal(game.thrownobj, obj);
        assert.equal(game.objs_deleted?.includes(obj) || false, false);
    });
}

test('boulder link reset precedes even the ownership panic', async () => {
    await setup(); const obj = object(ONAMES.BOULDER);
    obj.next_boulder = object(ONAMES.BOULDER); obj.where = OBJ_FLOOR;
    assert.throws(() => dealloc(obj), /obj not free/); assert.equal(obj.next_boulder, 0);
});

test('C nobj and contents guards precede all resource cleanup', async () => {
    await setup(); const obj = object(ONAMES.CHEST), child = object();
    mkobj.add_to_container(obj, child); obj.nobj = child;
    assert.throws(() => dealloc(obj), /dealloc_obj with nobj/);
    obj.nobj = null;
    assert.throws(() => dealloc(obj), /dealloc_obj with cobj/);
    assert.deepEqual(obj.cobj, [child]); assert.equal(child.ocontainer, obj);
});

test('empty JS contents array represents the C null contents chain', async () => {
    await setup(); const obj = object(ONAMES.CHEST); obj.cobj = [];
    assert.equal(dealloc(obj), undefined); staged(obj);
});

test('hands sentinel is C-zero initialized and retained by the awaited diagnostic', async () => {
    await setup(); assert.equal(hands_obj.where, OBJ_FREE);
    const before = { ...hands_obj };
    await dealloc(hands_obj);
    assert.deepEqual(hands_obj, before);
    assert.equal(game.impossible_log.at(-1), 'dealloc_obj with hands_obj');
    assert.equal(game.objs_deleted?.includes(hands_obj) || false, false);
});

test('double disposal awaits its diagnostic without enqueueing twice', async () => {
    await setup(); const obj = object(); dealloc(obj);
    const pending = dealloc(obj); assert.equal(typeof pending?.then, 'function');
    await pending; staged(obj);
    assert.equal(game.impossible_log.at(-1), `dealloc_obj: obj already deleted (type=${obj.otyp})`);
});

for (const freeingdata of [0, 1]) {
    test(`Lua reference retention precedes freeingdata=${freeingdata} and follows cleanup`, async () => {
        await setup(); const obj = object(ONAMES.CORPSE); obj.lua_ref_cnt = 2;
        game.program_state.freeingdata = freeingdata; game.thrownobj = obj;
        assert.equal(dealloc(obj), undefined);
        assert.equal(obj.where, OBJ_LUAFREE); assert.equal(obj.lua_ref_cnt, 2);
        assert.equal(obj.timed, 0); assert.equal(game.thrownobj, null);
        assert.equal(game.objs_deleted?.includes(obj) || false, false);
        // Explicit state of C's final Lua reference release. No JS userdata/GC claim.
        obj.lua_ref_cnt = 0; dealloc(obj);
        if (freeingdata) assert.deepEqual(obj, {}); else staged(obj);
    });
}

test('staging retains extra data until the LIFO drain releases all JS references', async () => {
    await setup(); const a = object(), b = object();
    a.oextra = { oname: 'a', omonst: { m_id: 111 } }; a.oname = 'a';
    b.oextra = { oname: 'b', omailcmd: 'mail' };
    const firstId = a.o_id, secondId = b.o_id;
    dealloc(a); dealloc(b);
    assert.deepEqual(game.objs_deleted.map(o => o.o_id), [secondId, firstId]);
    assert.equal(a.oextra.omonst.m_id, 111); assert.equal(b.oextra.omailcmd, 'mail');
    mkobj.dobjsfree(); assert.deepEqual(a, {}); assert.deepEqual(b, {});
    assert.deepEqual(game.objs_deleted, []);
});

test('direct freeingdata release does not disturb the existing deferred queue', async () => {
    await setup(); const stagedObj = object(), immediate = object();
    dealloc(stagedObj); game.program_state.freeingdata = 1; dealloc(immediate);
    assert.deepEqual(immediate, {}); assert.deepEqual(game.objs_deleted, [stagedObj]);
});

test('drain diagnoses corrupt ownership after removing the head', async () => {
    await setup(); const obj = object(); dealloc(obj); obj.where = OBJ_FREE;
    assert.throws(() => mkobj.dobjsfree(), /dobjsfree: obj where=0, not OBJ_DELETED/);
    assert.deepEqual(game.objs_deleted, []); assert.equal(obj.otyp, ONAMES.DAGGER);
});

test('obfree retains food/book/contents responsibilities outside canonical deallocation', async () => {
    await setup(); const box = object(ONAMES.CHEST), food = object(ONAMES.FOOD_RATION), book = object(ONAMES.SPE_FORCE_BOLT);
    mkobj.add_to_container(box, food); mkobj.add_to_container(box, book);
    game.context.victual = { piece: food }; game.context.spbook = { book, o_id: book.o_id };
    assert.equal(obfree(box), undefined);
    for (const obj of [box, food, book]) staged(obj);
    assert.deepEqual(game.context.victual, {});
    assert.deepEqual(game.context.spbook, { book: null, o_id: 0 });
    assert.deepEqual(box.cobj, []);
});

test('unpaid obfree retains the actual shop bill instead of canonical disposal', async () => {
    const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/shop-normal.json', import.meta.url)));
    await setup(recipe.segments[0]);
    const shkp = game.level.monsters.find(m => m.isshk); assert.ok(shkp);
    game.u.ushops = String.fromCharCode(shkp.eshk.shoproom);
    const obj = await addinv(object(ONAMES.FOOD_RATION));
    await addtobill(obj, false, false, true);
    const entry = shkp.eshk.bill_p.find(b => b.bo_id === obj.o_id); assert.ok(entry);
    const price = entry.price; await freeinv(obj);
    game.thrownobj = obj;
    assert.equal(obfree(obj), undefined);
    assert.equal(obj.where, OBJ_ONBILL); assert.ok(game.billobjs.includes(obj));
    assert.equal(entry.useup, true); assert.equal(entry.price, price);
    assert.equal(game.objs_deleted?.includes(obj) || false, false);
    assert.equal(game.thrownobj, obj, 'C billing early return precedes dealloc cleanup');
});

test('main loop drains staged records before the next command', async () => {
    await setup(); const obj = object(); obfree(obj); staged(obj);
    game.context.move = false; pushKeys(['.']);
    await moveloop_core();
    assert.deepEqual(obj, {}); assert.deepEqual(game.objs_deleted, []);
});

test('savelev drains deferred objects before serializing the level', async () => {
    await setup(); const obj = object(); obfree(obj); staged(obj);
    savelev(ledger_no(game.u.uz), false);
    assert.deepEqual(obj, {}); assert.deepEqual(game.objs_deleted, []);
});

test('new replay resets the previous process deletion queue through live game binding', async () => {
    await setup(); const obj = object(); obfree(obj); staged(obj);
    const previous = game;
    await setup(); assert.notEqual(game, previous);
    assert.equal(game.objs_deleted?.includes(obj) || false, false);
});

// Delay only the input transport, leaving every gameplay and display helper real.
async function pausedMessage(replay, invoke, during) {
    await pline('An earlier message fills the line before the next message must wait.');
    let release, reached, done = false;
    const entered = new Promise(resolve => { reached = resolve; });
    const pause = new Promise(resolve => { release = resolve; });
    let reads = 0;
    replay._display.onEmptyQueue = async () => {
        assert.ok(++reads < 10, 'bounded diagnostic/property message reads');
        reached(); await pause; return 32;
    };
    const pending = invoke();
    assert.equal(typeof pending?.then, 'function');
    const operation = pending.then(() => { done = true; });
    let timeout;
    try {
        await Promise.race([entered, new Promise((_resolve, reject) => {
            timeout = setTimeout(() => reject(new Error('message did not request input')), 2000);
        })]);
        assert.equal(done, false);
        during();
    } finally {
        clearTimeout(timeout); release(); await operation;
    }
    assert.equal(done, true); assert.ok(reads > 0);
}

test('double-delete diagnostic waits for real delayed message input', async () => {
    const replay = await setup(); const obj = object(); dealloc(obj);
    await pausedMessage(replay, () => dealloc(obj), () => staged(obj));
    staged(obj); assert.equal(game.program_state.in_impossible, 0);
});

test('useupall waits for real worn artifact feedback before canonical disposal', async () => {
    const replay = await setup();
    const obj = object(ONAMES.SILVER_SABER);
    await oname(obj, 'Grayswandir', ONAME_NO_FLAGS);
    await addinv(obj); game.u.intrinsic.HHallucination = 50;
    await setuwep(obj);
    assert.ok(obj.oartifact); assert.equal(game.u.uwep, obj);
    await pausedMessage(replay, () => useupall(obj), () => {
        assert.notEqual(obj.where, OBJ_DELETED);
        assert.ok(game.invent.includes(obj));
        assert.equal(game.objs_deleted?.includes(obj) || false, false);
    });
    staged(obj); assert.equal(game.invent.includes(obj), false);
    assert.equal(game.u.uwep, null);
});
