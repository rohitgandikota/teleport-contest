// node --test tools/timer-constant-import-state-gate.mjs
// C mkmaze.c:104, trap.c:544, objnam.c:3891, apply.c:4056.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { set_levltyp } from '../js/mkmaze.js';
import { maketrap } from '../js/mklev.js';
import { readobjnam } from '../js/objnam.js';
import { doapply } from '../js/apply.js';
import { setABASE } from '../js/attrib.js';
import { addinv } from '../js/invent.js';
import { cmdq_add_key } from '../js/cmd.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { start_timer, obj_stop_timers, TIMER_LEVEL, TIMER_OBJECT, MELT_ICE_AWAY, ROT_CORPSE }
    from '../js/timeout.js';
import { ICE, ROOM, MOAT, PIT, BEAR_TRAP, DRAWBRIDGE_UP, DB_ICE, DB_FLOOR,
    DB_EAST, DB_UNDER, ICED_POOL, CQ_CANNED, A_STR, ECMD_TIME } from '../js/const.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';

const X = 30, Y = 10;
const packed = (x, y) => (x << 16) | y;

async function setup(remaining = 20) {
    const run = await runSegment({ seed: 99812, datetime: '20000110090000', moves: ' ',
        nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
    game._toplines = ''; game._toplin = 0; game._pending_message = '';
    game._win_stop = false;
    let prompts = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(++prompts < 30, 'bounded tty input');
        return 27;
    };
    game.timer_base = [];
    game.level.objects = []; game.level.objAt.clear();
    game.level.buriedobjs = []; game.level.monsters = []; game.level.monAt.clear();
    game.level.traps = [];
    game.level.flags.has_shop = false;
    game.moves = 100;
    Object.assign(game.u, { ux: X, uy: Y, uhp: 1000, uhpmax: 1000 });
    setABASE(A_STR, 18);
    for (let x = X - 2; x <= X + 2; x++) {
        for (let y = Y - 2; y <= Y + 2; y++)
            Object.assign(game.level.at(x, y), { typ: ROOM, roomno: 0, edge: 0, flags: 0 });
    }
    Object.assign(game.level.at(X, Y), { typ: ICE, icedpool: ICED_POOL });
    game.level.at(45, Y).typ = ICE;
    game.level.at(46, Y).typ = ROOM;

    // Real numeric producers, with a second square and an object as survivors.
    assert.equal(TIMER_LEVEL, 1); assert.equal(MELT_ICE_AWAY, 8);
    const body = mksobj(ONAMES.CORPSE, false, false);
    obj_stop_timers(body);
    Object.assign(body, { corpsenm: PMNAMES.PM_NEWT, age: 80 });
    await place_object(body, 46, Y);
    start_timer(100, TIMER_OBJECT, ROT_CORPSE, body);
    start_timer(50, TIMER_LEVEL, MELT_ICE_AWAY, packed(45, Y));
    start_timer(remaining, TIMER_LEVEL, MELT_ICE_AWAY, packed(X, Y));
    const target = game.timer_base.find(t => t.arg === packed(X, Y));
    const survivors = game.timer_base.filter(t => t !== target);
    const records = survivors.map(t => ({ ...t }));
    const nextId = game.timer_id;
    initRng(3); enableRngLog();
    return { run, body, target, targetRecord: { ...target },
        queue: game.timer_base, survivors, records, nextId };
}

function check(state, removed, rng = true) {
    assert.equal(game.timer_base.includes(state.target), !removed);
    assert.equal(game.timer_base, state.queue, 'cancellation keeps the queue object');
    if (!removed) assert.deepEqual(state.target, state.targetRecord);
    assert.deepEqual(game.timer_base.filter(t => t !== state.target), state.survivors);
    for (const [index, timer] of state.survivors.entries())
        assert.deepEqual(timer, state.records[index]);
    assert.equal(game.level.objectAt(46, Y), state.body);
    assert.deepEqual([state.body.ox, state.body.oy, state.body.age, state.body.timed],
        [46, Y, 80, 1]);
    assert.equal(game.timer_id, state.nextId);
    if (rng) assert.deepEqual(getRngLog(), []);
}

function trappedIceBridge() {
    // C trap.c:466 handles an existing trap before the pool rejection.
    // The separate fresh-bridge is_pool defect must not hide this timer call.
    game.level.at(X, Y).typ = ROOM;
    assert.equal(maketrap(X, Y, BEAR_TRAP)?.ttyp, BEAR_TRAP);
    Object.assign(game.level.at(X, Y), {
        typ: DRAWBRIDGE_UP, drawbridgemask: DB_EAST | DB_ICE,
    });
}

for (const remaining of [20, 0, -1]) {
    test(`set_levltyp cancels numeric melt timer with ${remaining} turns left`, async () => {
        const state = await setup(remaining);
        assert.equal(set_levltyp(X, Y, ROOM), true);
        assert.equal(game.level.at(X, Y).typ, ROOM);
        check(state, true);
    });
    test(`terrain wish cancels numeric melt timer with ${remaining} turns left`, async () => {
        const state = await setup(remaining);
        await readobjnam('floor', null);
        assert.equal(game.level.at(X, Y).typ, ROOM);
        check(state, true);
    });
    test(`existing raised bridge trap cancels numeric melt timer with ${remaining} turns left`, async () => {
        const state = await setup(remaining);
        trappedIceBridge();
        const trap = maketrap(X, Y, PIT);
        assert.equal(trap?.ttyp, PIT);
        assert.equal(game.level.at(X, Y).typ, DRAWBRIDGE_UP);
        assert.equal(game.level.at(X, Y).drawbridgemask, DB_EAST | DB_FLOOR);
        check(state, true);
    });
}

test('set_levltyp keeps an unchanged ice timer', async () => {
    const state = await setup();
    assert.equal(set_levltyp(X, Y, ICE), true);
    check(state, false);
});
test('ordinary ice wish keeps the existing ice timer', async () => {
    const state = await setup();
    await readobjnam('ice', null);
    assert.equal(game.level.at(X, Y).typ, ICE);
    check(state, false);
});
test('existing raised bridge bear trap keeps ice and its timer', async () => {
    const state = await setup();
    trappedIceBridge();
    assert.equal(maketrap(X, Y, BEAR_TRAP)?.ttyp, BEAR_TRAP);
    assert.equal(game.level.at(X, Y).drawbridgemask & DB_UNDER, DB_ICE);
    check(state, false);
});
test('ordinary ice pit reaches the general setter cancellation', async () => {
    const state = await setup();
    assert.equal(maketrap(X, Y, PIT)?.ttyp, PIT);
    assert.equal(game.level.at(X, Y).typ, ROOM);
    check(state, true);
});
test('digging wand liquid branch cancels independently of the general setter', async () => {
    const state = await setup();
    for (let x = X - 1; x <= X + 1; x++) {
        for (let y = Y - 1; y <= Y + 1; y++)
            if (x !== X || y !== Y) game.level.at(x, y).typ = MOAT;
    }
    game.u.uprops.LEVITATION = 1;
    game.flags.paranoia_bits = 0;
    const wand = mksobj(ONAMES.WAN_DIGGING, false, false);
    Object.assign(wand, { spe: 1, known: true, dknown: true });
    await addinv(wand);
    cmdq_add_key(CQ_CANNED, wand.invlet);
    let confirmations = 0, prompts = 0;
    state.run._display.onEmptyQueue = () => {
        assert.ok(++prompts < 30, 'bounded wand input');
        const text = state.run._display.terminal.serialize();
        if (text.includes('really sure you want to break')) {
            confirmations++;
            return 'y'.charCodeAt(0);
        }
        return 27;
    };
    initRng(3); enableRngLog();
    const result = await doapply();
    assert.equal(result, ECMD_TIME, JSON.stringify({ message: game._toplines,
        wand: wand.invlet, confirmations, prompts, history: game._msg_history }));
    assert.equal(confirmations, 1, 'confirmed real wand break');
    assert.equal(game.level.at(X, Y).typ, MOAT, 'require liquid branch, not dry pit');
    assert.equal(game.level.traps.some(t => t.tx === X && t.ty === Y), false);
    assert.equal(game.invent.includes(wand), false, 'wand actually broken');
    check(state, true, false);
    assert.ok(getRngLog().length > 0, 'real wand action consumes its normal RNG');
});
