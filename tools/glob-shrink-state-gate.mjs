// Source-derived controls for mkobj.c:1441-1701. Normal imports, real producers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mksobj, place_object, add_to_container, add_to_minv, add_to_migration,
    container_weight, start_glob_timeout } from '../js/mkobj.js';
import { addinv, obj_extract_self, weight } from '../js/invent.js';
import { run_timers, obj_stop_timers, peek_timer, SHRINK_GLOB } from '../js/timeout.js';
import { setuwep, setuswapwep, setuqwep } from '../js/wield.js';
import { eatfood } from '../js/eat.js';
import { in_container, out_container } from '../js/pickup.js';
import { makemon, hideunder } from '../js/makemon.js';
import { seemimic } from '../js/mon.js';
import { addtobill } from '../js/shk.js';
import { near_capacity } from '../js/attrib.js';
import { savelev, dosave0, dorecover } from '../js/save.js';
import { getlev } from '../js/restore.js';
import { xname, doname } from '../js/objnam.js';
import { pline, TOPLINE_EMPTY } from '../js/display.js';
import { resetInputState, pushKeys } from '../js/input.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { IN_SIGHT, COULD_SEE, TEMP_LIT } from '../js/vision.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { ROOM, ICE, OBJ_FREE, OBJ_FLOOR, OBJ_INVENT, OBJ_CONTAINED,
    OBJ_BURIED, OBJ_ONBILL, OBJ_DELETED,
    W_WEP, NO_MINVENT, MM_NOGRP, MM_NOWAIT } from '../js/const.js';

const basic = {
    seed: 7341,
    datetime: '20000110090000',
    moves: ' ',
    nethackrc: 'OPTIONS=name:Glob,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
};

async function setup() {
    const replay = await runSegment({ ...basic, storage: new InMemoryStorage() });
    let prompts = 0;
    replay._display.onEmptyQueue = () => {
        assert.ok(++prompts < 30, 'bounded real message acknowledgments');
        return 27;
    };
    game._preNhgetchHook = null;
    resetInputState();
    game.level.objects = [];
    game.level.objAt.clear();
    game.level.buriedobjs = [];
    game.level.monsters = [];
    game.level.monAt = new Map();
    game.level.traps = [];
    game.invent = [];
    game.timer_base = [];
    game.migrating_objs = [];
    game.billobjs = [];
    game.u.ux = 30;
    game.u.uy = 10;
    game.moves = 100;
    game.vision_full_recalc = 0;
    for (let x = 28; x <= 37; x++) {
        for (let y = 8; y <= 12; y++) {
            Object.assign(game.level.at(x, y), { typ: ROOM, lit: 1, roomno: 0 });
            game.viz_array[y][x] = IN_SIGHT | COULD_SEE | TEMP_LIT;
        }
    }
    clearMessage();
    return replay;
}

function clearMessage() {
    game._toplin = TOPLINE_EMPTY;
    game._prevmsg = '';
    game.iflags.last_msg = 0;
}

function glob(owt = 20) {
    const obj = mksobj(ONAMES.GLOB_OF_GRAY_OOZE, true, false);
    assert.equal(obj.globby, 1);
    assert.equal(obj.quan, 1);
    assert.equal(obj.timed, 1, 'real producer starts its timer');
    obj_stop_timers(obj);
    obj.owt = owt; // Source-derived boundary weight, never a replacement producer.
    return obj;
}

function seed() {
    initRng(7341);
    enableRngLog();
}

async function fire(obj, now = 101) {
    start_glob_timeout(obj, 1);
    game.moves = now;
    seed();
    await run_timers();
}

function randomRestart(obj) {
    const log = getRngLog();
    assert.equal(log.length, 1);
    assert.match(log[0], /^rn2\(5\)=[0-4]$/);
    assert.equal(peek_timer(SHRINK_GLOB, obj), game.moves + 23 + Number(log[0].split('=')[1]));
    assert.equal(obj.timed, 1);
}

function disposed(obj) {
    assert.equal(obj.where, OBJ_DELETED);
    assert.equal(obj.timed, 0);
    assert.equal(peek_timer(SHRINK_GLOB, obj), 0);
}

for (const [late, lost, remaining] of [[1, 1, 24], [25, 1, 24],
    [26, 2, 23], [100, 4, 21], [625, 25, 25]]) {
    test(`overdue floor timer: ${late} elapsed turns uses C catch-up arithmetic`, async () => {
        await setup();
        const obj = glob(40);
        obj.oeaten = 13;
        obj.dknown = 0;
        await place_object(obj, 35, 10);
        await fire(obj, 101 + late);
        assert.equal(obj.owt, 40 - lost);
        assert.equal(obj.oeaten, 13, 'catch-up does not consume meal nutrition');
        assert.equal(obj.dknown, 0, 'catch-up does not format an observable name');
        assert.equal(peek_timer(SHRINK_GLOB, obj), game.moves + remaining);
        assert.equal(obj.timed, 1);
        assert.equal(game._prevmsg, '');
        assert.deepEqual(getRngLog(), []);
    });
}

test('overdue ice timer divides weight loss after computing the next interval', async () => {
    await setup();
    const obj = glob();
    game.level.at(35, 10).typ = ICE;
    await place_object(obj, 35, 10);
    await fire(obj, 201);
    assert.equal(obj.owt, 18);
    assert.equal(peek_timer(SHRINK_GLOB, obj), 222);
    assert.deepEqual(getRngLog(), []);
});

test('buried ice skips catch-up and retains an active randomized timer', async () => {
    await setup();
    const obj = glob();
    Object.assign(obj, { where: OBJ_BURIED, ox: 35, oy: 10 });
    game.level.buriedobjs.push(obj);
    game.level.at(35, 10).typ = ICE;
    await fire(obj, 801);
    assert.equal(obj.owt, 20);
    assert.equal(obj.where, OBJ_BURIED);
    randomRestart(obj);
});

for (const now of [100, 101, 102]) {
    test(`normal ice phase ${now % 3} follows the literal C guard`, async () => {
        await setup();
        const obj = glob();
        await place_object(obj, 35, 10);
        game.level.at(35, 10).typ = ICE;
        game.moves = now - 1;
        await fire(obj, now);
        assert.equal(obj.owt, now % 3 === 1 ? 20 : 19);
        randomRestart(obj);
    });
}

test('active eating defers an on-time callback without changing the meal', async () => {
    await setup();
    const obj = await addinv(glob());
    game.occupation = eatfood;
    game.context.victual = { piece: obj };
    await fire(obj);
    assert.equal(obj.owt, 20);
    assert.equal(game.context.victual.piece, obj);
    randomRestart(obj);
});

for (const oeaten of [0, 1, 9]) {
    test(`inventory threshold preserves partly-eaten naming and nutrition ${oeaten}`, async () => {
        await setup();
        const obj = await addinv(glob());
        obj.oeaten = oeaten;
        clearMessage();
        await fire(obj);
        assert.equal(obj.owt, 19);
        assert.equal(obj.oeaten, Math.max(oeaten ? 1 : 0, oeaten - 1));
        assert.equal(game._prevmsg,
            `Your ${oeaten ? 'partly eaten ' : ''}small glob of gray ooze shrinks.`);
        assert.equal(!!game.iflags.partly_eaten_hack, false);
        assert.doesNotMatch(xname(obj), /partly eaten/);
        assert.equal((doname(obj).match(/partly eaten/g) || []).length, oeaten ? 1 : 0);
        randomRestart(obj);
    });
}

for (const [slot, setter] of [['uwep', setuwep], ['uswapwep', setuswapwep], ['uquiver', setuqwep]]) {
    test(`worn glob exhaustion releases ${slot} and real object owners`, async () => {
        await setup();
        const obj = await addinv(glob(1));
        await setter(obj);
        assert.equal(game.u[slot], obj);
        game.context.victual = { piece: obj }; // Interrupted meal, not active eating.
        game.thrownobj = obj;
        game.kickedobj = obj;
        clearMessage();
        await fire(obj);
        assert.equal(game.u[slot], null);
        assert.equal(obj.owornmask || 0, 0);
        assert.equal(game.invent.includes(obj), false);
        assert.notEqual(game.context.victual.piece, obj);
        assert.equal(game.thrownobj, null);
        assert.equal(game.kickedobj, null);
        disposed(obj);
        assert.deepEqual(getRngLog(), []);
    });
}

for (const atHero of [false, true]) {
    test(`visible floor disappearance ${atHero ? 'under hero' : 'at distance'} uses C article`, async () => {
        await setup();
        const obj = glob(1);
        await place_object(obj, atHero ? 30 : 35, 10);
        await fire(obj);
        assert.equal(game._prevmsg,
            `${atHero ? 'The' : 'A'} small glob of gray ooze fades away.`);
        assert.equal(game.level.objects.includes(obj), false);
        assert.equal(game.level.objectAt(obj.ox, obj.oy), null);
        disposed(obj);
        assert.deepEqual(getRngLog(), []);
    });
}

test('unseen floor disappearance has no fade message', async () => {
    await setup();
    const obj = glob(1);
    await place_object(obj, 35, 10);
    game.viz_array[10][35] = 0;
    await fire(obj);
    assert.equal(game._prevmsg, '');
    disposed(obj);
});

for (const overdue of [false, true]) {
    for (const otherCover of [false, true]) {
        test(`floor concealment ${overdue ? 'catch-up' : 'on time'}, other cover ${otherCover}`, async () => {
            await setup();
            const obj = glob(1);
            await place_object(obj, 35, 10);
            const mon = await makemon(game.mons[PMNAMES.PM_GARTER_SNAKE], 35, 10,
                NO_MINVENT | MM_NOGRP | MM_NOWAIT);
            seemimic(mon);
            Object.assign(mon, { mtrapped: 0, mtame: 0, mpeaceful: 1 });
            await hideunder(mon);
            assert.equal(mon.mundetected, 1);
            if (otherCover)
                await place_object(mksobj(ONAMES.DAGGER, false, false), 35, 10);
            clearMessage();
            await fire(obj, overdue ? 126 : 101);
            assert.equal(mon.mundetected, otherCover ? 1 : 0);
            disposed(obj);
            if (overdue)
                assert.equal(game._prevmsg, '', 'catch-up does not emit normal disappearance text');
            assert.deepEqual(getRngLog(), []);
        });
    }
}

for (const kind of ['buried', 'migrating', 'monster weapon']) {
    test(`exhaustion disposes ${kind} through the original owner`, async () => {
        await setup();
        const obj = glob(1);
        let mon;
        if (kind === 'buried') {
            Object.assign(obj, { where: OBJ_BURIED, ox: 35, oy: 10 });
            game.level.buriedobjs.push(obj);
        } else if (kind === 'migrating') {
            add_to_migration(obj);
            obj.owornmask = 3; // C migration destination, not equipment.
        } else {
            mon = await makemon(game.mons[PMNAMES.PM_GOBLIN], 35, 10,
                NO_MINVENT | MM_NOGRP | MM_NOWAIT);
            add_to_minv(mon, obj);
            mon.mw = obj;
            obj.owornmask = W_WEP; // Defensive C branch, not an ordinary glob weapon producer.
        }
        clearMessage();
        await fire(obj);
        disposed(obj);
        assert.equal(obj.owornmask || 0, 0);
        assert.equal(game.level.buriedobjs.includes(obj), false);
        assert.equal(game.migrating_objs.includes(obj), false);
        if (mon) {
            assert.equal(mon.mw, null);
            assert.equal(mon.minvent.includes(obj), false);
        }
        assert.equal(game._prevmsg, '');
        assert.deepEqual(getRngLog(), []);
    });
}

async function nested(owt, outerType = ONAMES.SACK) {
    const outer = mksobj(outerType, false, false);
    const inner = mksobj(ONAMES.SACK, false, false);
    const obj = glob(owt);
    await place_object(outer, 35, 10);
    await add_to_container(outer, inner);
    await add_to_container(inner, obj);
    container_weight(inner);
    return { outer, inner, obj };
}

for (const owt of [1, 20]) {
    test(`nested catch-up ${owt === 1 ? 'disposal' : 'survival'} repairs every stored weight`, async () => {
        await setup();
        const { outer, inner, obj } = await nested(owt);
        const before = outer.owt;
        await fire(obj, 201);
        assert.equal(inner.owt, owt === 1 ? 15 : 31);
        assert.equal(outer.owt, owt === 1 ? 30 : 46);
        assert.equal(outer.owt, before - Math.min(4, owt));
        assert.equal(inner.owt, weight(inner));
        assert.equal(outer.owt, weight(outer));
        if (owt === 1) {
            assert.deepEqual(inner.cobj, []);
            disposed(obj);
        }
        assert.deepEqual(getRngLog(), []);
    });
}

test('contained extraction recursively repairs non-glob bag-of-holding ancestors', async () => {
    await setup();
    const outer = mksobj(ONAMES.BAG_OF_HOLDING, false, false);
    outer.blessed = 1;
    const inner = mksobj(ONAMES.SACK, false, false);
    const dagger = mksobj(ONAMES.DAGGER, false, false);
    await place_object(outer, 35, 10);
    await add_to_container(outer, inner);
    await add_to_container(inner, dagger);
    container_weight(inner);
    assert.equal(outer.owt, 22);
    seed();
    await obj_extract_self(dagger);
    assert.equal(dagger.where, OBJ_FREE);
    assert.equal(dagger.ocontainer, null);
    assert.equal(inner.owt, 15);
    assert.equal(outer.owt, 19);
    assert.deepEqual(getRngLog(), []);
});

for (const mode of ['sack threshold', 'holding rounding', 'holding empty glob']) {
    test(`carried container feedback: ${mode}`, async () => {
        await setup();
        const holding = mode !== 'sack threshold';
        const bag = await addinv(mksobj(holding ? ONAMES.BAG_OF_HOLDING : ONAMES.SACK, false, false));
        bag.blessed = holding ? 1 : 0;
        if (mode === 'holding empty glob')
            await add_to_container(bag, mksobj(ONAMES.DAGGER, false, false));
        const obj = glob(mode === 'holding empty glob' ? 1 : 20);
        await add_to_container(bag, obj);
        container_weight(bag);
        const oldWeight = bag.owt;
        game.oldcap = near_capacity();
        clearMessage();
        await fire(obj);
        assert.equal(bag.owt, weight(bag));
        if (mode === 'sack threshold') {
            assert.equal(bag.owt, oldWeight - 1);
            assert.equal(game._prevmsg, 'Your bag becomes slightly lighter.');
            randomRestart(obj);
        } else {
            assert.equal(bag.owt, oldWeight, 'holding rounds both weights to the same integer');
            if (mode === 'holding rounding') {
                assert.equal(game._prevmsg, '');
                randomRestart(obj);
            } else {
                assert.equal(game._prevmsg, 'Your bag seems lighter.');
                disposed(obj);
            }
        }
    });
}

test('temporary partly-eaten naming keeps the C fruit exception', async () => {
    await setup();
    const fruit = mksobj(ONAMES.SLIME_MOLD, true, false);
    fruit.oeaten = 5;
    const before = xname(fruit);
    game.iflags.partly_eaten_hack = true;
    try {
        assert.equal(xname(fruit), before);
    } finally {
        game.iflags.partly_eaten_hack = false;
    }
});

for (const worn of [false, true]) {
    test(`exhaustion ${worn ? 'stops' : 'preserves'} an unrelated occupation when worn=${worn}`, async () => {
        await setup();
        const obj = await addinv(glob(1));
        const meal = await addinv(mksobj(ONAMES.FOOD_RATION, true, false));
        if (worn)
            await setuwep(obj);
        game.context.victual = { piece: meal, usedtime: 1, reqtime: 5 };
        game.occupation = eatfood;
        game.occtxt = 'eating';
        clearMessage();
        await fire(obj);
        assert.equal(game.occupation, worn ? null : eatfood);
        assert.equal(game.context.victual.piece, meal);
        disposed(obj);
    });
}

test('real ice-box insertion stops the clock and extraction starts a new one', async () => {
    await setup();
    const box = await addinv(mksobj(ONAMES.ICE_BOX, false, false));
    const obj = await addinv(glob());
    start_glob_timeout(obj, 8);
    game.current_container = box;
    await in_container(obj);
    assert.equal(obj.where, OBJ_CONTAINED);
    assert.equal(obj.ocontainer, box);
    assert.equal(obj.timed, 0);
    game.moves += 200;
    await run_timers();
    assert.equal(obj.owt, 20);
    seed();
    await out_container(obj);
    assert.equal(obj.where, OBJ_INVENT);
    assert.equal(obj.owt, 20);
    randomRestart(obj);
});

test('saved dormant glob timer relinks a fresh owner and catches up without mutating the record', async () => {
    await setup();
    const obj = glob();
    await place_object(obj, 35, 10);
    start_glob_timeout(obj, 1);
    const record = savelev(1, true);
    const recordObj = record.objects.find(item => item.o_id === obj.o_id);
    const recordTimer = record._saved_timers.timers.find(timer => timer.func_index === SHRINK_GLOB);
    assert.equal(recordObj.owt, 20);
    assert.equal(recordTimer.timeout, 101);
    game.moves = 201;
    await getlev(record);
    const restored = game.level.objects.find(item => item.o_id === obj.o_id);
    assert.notEqual(restored, obj);
    assert.notEqual(restored, recordObj);
    assert.equal(game.timer_base.find(timer => timer.func_index === SHRINK_GLOB).arg, restored);
    seed();
    await run_timers();
    assert.equal(restored.owt, 16);
    assert.equal(peek_timer(SHRINK_GLOB, restored), 222);
    assert.equal(recordObj.owt, 20);
    assert.equal(recordTimer.timeout, 101);
    assert.deepEqual(getRngLog(), []);
});

for (const floor of [false, true]) {
    test(`full save restores ${floor ? 'level' : 'global'} glob owner and its next callback`, async () => {
        await setup();
        const obj = glob();
        if (floor)
            await place_object(obj, 35, 10);
        else
            await addinv(obj);
        start_glob_timeout(obj, 1);
        const id = obj.o_id;
        assert.equal(await dosave0(), true);
        assert.equal(await dorecover(), true);
        const restored = (floor ? game.level.objects : game.invent)
            .find(item => item.o_id === id);
        assert.ok(restored);
        assert.notEqual(restored, obj);
        assert.equal(restored.owt, 20);
        assert.equal(restored.timed, 1);
        assert.equal(peek_timer(SHRINK_GLOB, restored), 101);
        game.moves = 101;
        seed();
        await run_timers();
        assert.equal(restored.owt, 19);
        randomRestart(restored);
    });
}

test('unpaid glob exhaustion retains the real shop bill and charge', async () => {
    const recipe = JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/shop-normal.json', import.meta.url)));
    const replay = await runSegment({ ...recipe.segments[0], storage: new InMemoryStorage() });
    replay._display.onEmptyQueue = () => 27;
    game._preNhgetchHook = null;
    resetInputState();
    const shkp = game.level.monsters.find(mon => mon.isshk);
    assert.ok(shkp);
    game.u.ushops = String.fromCharCode(shkp.eshk.shoproom);
    const obj = await addinv(glob());
    await addtobill(obj, false, false, true);
    const entry = shkp.eshk.bill_p.find(bill => bill.bo_id === obj.o_id);
    assert.ok(entry);
    assert.ok(obj.unpaid);
    const price = entry.price;
    obj.owt = 1;
    await fire(obj, game.moves + 1);
    assert.equal(game.invent.includes(obj), false);
    assert.equal(obj.where, OBJ_ONBILL);
    assert.ok(game.billobjs.includes(obj));
    assert.equal(obj.unpaid, 0);
    // add_one_tobill currently omits C's OMID weight capture. That independent
    // producer gap is recorded separately; this control proves bill ownership.
    assert.equal(entry.price, price);
    assert.equal(entry.useup, true);
    assert.equal(obj.timed, 0);
});

test('inventory disappearance waits for real message input before releasing the owner', async () => {
    await setup();
    const obj = await addinv(glob(1));
    await setuwep(obj);
    await pline('The previous message fills the line before this glob can dissolve.');
    resetInputState();
    let reach, release;
    const reached = new Promise(resolve => reach = resolve);
    const barrier = new Promise(resolve => release = resolve);
    game._preNhgetchHook = async () => {
        reach();
        await barrier;
    };
    let timeout;
    const pending = fire(obj);
    try {
        await Promise.race([reached, new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error('real message boundary was not reached')), 2000);
        })]);
        assert.equal(obj.owt, 0, 'weight reduction precedes feedback');
        assert.equal(obj.where, OBJ_INVENT, 'inventory release follows feedback');
        assert.equal(game.u.uwep, obj);
        assert.equal(obj.timed, 0, 'dispatch already removed the expiring timer');
    } finally {
        clearTimeout(timeout);
        game._preNhgetchHook = null;
        pushKeys(' '.repeat(5));
        release();
        await pending;
    }
    assert.equal(game.u.uwep, null);
    disposed(obj);
});
