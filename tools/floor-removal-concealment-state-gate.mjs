// C invent.c:1430-1461, mon.c:4698-4801, shk.c:1187-1270.
// Constructed states use real placement, hiding, billing and inventory helpers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {GameMap} from '../js/game.js';
import {makemon, hideunder} from '../js/makemon.js';
import {delobj, delobj_core, m_at} from '../js/mon.js';
import {set_mon_data} from '../js/mondata.js';
import {mksobj, place_object, add_to_container, add_to_minv} from '../js/mkobj.js';
import {addinv, obj_extract_self} from '../js/invent.js';
import {addtobill, costly_spot} from '../js/shk.js';
import {ART_ORB_OF_DETECTION} from '../js/artilist_data.js';
import {vision_reset, vision_recalc} from '../js/vision.js';
import {resetInputState} from '../js/input.js';
import {TOPLINE_EMPTY, pline} from '../js/display.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {ROOM, STONE, COLNO, ROWNO, NO_MINVENT, MM_NOGRP, MM_NOMSG,
    OBJ_FREE, OBJ_FLOOR, OBJ_INVENT, OBJ_CONTAINED, OBJ_MINVENT,
    OBJ_ONBILL, OBJ_DELETED, W_ARTI} from '../js/const.js';

const x = 35, y = 10;
async function setup(actor = 'monster') {
    const run = await runSegment({seed: 7401, datetime: '20000112121000', moves: ' ',
        storage: new InMemoryStorage(),
        nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'});
    feedback(run);
    game.level = new GameMap();
    game.worms = {wheads: {}, wtails: {}, wgrowtime: {}};
    game.regions = []; game.timer_base = []; game.in_mklev = false;
    game.u.ux = actor === 'hero' ? x : 30; game.u.uy = y;
    for (let xx = 1; xx < COLNO; xx++) for (let yy = 0; yy < ROWNO; yy++)
        Object.assign(game.level.at(xx, yy), {
            typ: xx >= 28 && xx <= 38 && yy >= 8 && yy <= 12 ? ROOM : STONE,
            lit: 1, waslit: 1, seenv: 255, roomno: 0});
    vision_reset(); vision_recalc(0);
    let mon = game.youmonst;
    if (actor === 'hero') {
        set_mon_data(mon, game.mons[P.PM_PIT_VIPER]);
        game.u.umonnum = P.PM_PIT_VIPER; game.u.mh = game.u.mhmax = 60;
    } else {
        mon = await makemon(game.mons[P.PM_PIT_VIPER], x, y, NO_MINVENT | MM_NOGRP | MM_NOMSG);
        assert.equal(m_at(x, y), mon);
    }
    return {run, mon};
}
function feedback(run) {
    game._preNhgetchHook = null; resetInputState();
    let keys = 0;
    run._display.onEmptyQueue = () => { assert.ok(++keys <= 32); return 32; };
}
async function cover(type = O.DAGGER, quantity = 1, xx = x, yy = y) {
    const obj = mksobj(type, false, false); obj.quan = quantity;
    await place_object(obj, xx, yy);
    assert.equal(obj.where, OBJ_FLOOR);
    assert.ok(game.level.objectsAt(xx, yy).includes(obj));
    return obj;
}
function reset() {
    game._toplin = TOPLINE_EMPTY; game._toplines = ''; game._prevmsg = '';
    game._pending_message = ''; game.iflags.last_msg = 0;
    (game.gl ||= {}).last_hider = -1;
    initRng(14); enableRngLog();
}
function hidden(mon) { return mon === game.youmonst ? game.u.uundetected : mon.mundetected; }
function removed(obj, where = OBJ_DELETED) {
    assert.equal(obj.where, where);
    assert.ok(!game.level.objects.includes(obj));
    assert.ok(!game.level.objectsAt(obj.ox, obj.oy).includes(obj));
}
function noFeedback() {
    assert.equal(game._prevmsg, ''); assert.equal(game.iflags.last_msg, 0);
    assert.equal(game.gl.last_hider, -1);
}

for (const actor of ['monster', 'hero']) for (const mode of ['last', 'head', 'tail', 'nine coins', 'ten coins'])
    test(`${actor}: remove ${mode} cover synchronously`, async () => {
        const {mon} = await setup(actor);
        let other;
        if (mode === 'head') other = await cover(O.ROCK);
        if (mode.includes('coins')) other = await cover(O.GOLD_PIECE, mode === 'nine coins' ? 9 : 10);
        const obj = await cover();
        if (mode === 'tail') other = await cover(O.ROCK);
        assert.equal(await hideunder(mon), true);
        reset();
        assert.equal(delobj(obj), undefined, 'floor cleanup is complete at scalar return');
        removed(obj);
        assert.equal(hidden(mon), +(mode === 'head' || mode === 'tail' || mode === 'ten coins'));
        if (other) assert.equal(game.level.objectAt(x, y), other);
        assert.deepEqual(getRngLog(), ['rn2(100)=92']);
        noFeedback();
        if (actor === 'monster' && !hidden(mon))
            assert.equal(game.gbuf[y][x].disp_ch, 'S', 'newsym buffers the revealed monster before return');
    });

const protectedTypes = [
    ['Amulet', O.AMULET_OF_YENDOR], ['Book', O.SPE_BOOK_OF_THE_DEAD],
    ['Candelabrum', O.CANDELABRUM_OF_INVOCATION], ['Bell', O.BELL_OF_OPENING],
    ['Rider corpse', O.CORPSE],
];
for (const [name, type] of protectedTypes) for (const force of [false, true])
    test(`${name}: ${force ? 'force bypasses' : 'guard preserves'} cover without RNG`, async () => {
        const {mon} = await setup();
        const obj = await cover(type);
        if (type === O.CORPSE) obj.corpsenm = P.PM_DEATH;
        obj.in_use = 1;
        assert.equal(await hideunder(mon), true);
        reset();
        assert.equal(delobj_core(obj, force), undefined);
        assert.deepEqual(getRngLog(), []);
        if (force) { removed(obj); assert.equal(hidden(mon), 0); }
        else {
            assert.equal(obj.where, OBJ_FLOOR); assert.equal(obj.in_use, 0);
            assert.equal(game.level.objectAt(x, y), obj); assert.equal(hidden(mon), 1);
        }
        noFeedback();
    });

test('forced ordinary removal skips its normal resistance draw', async () => {
    const {mon} = await setup(); const obj = await cover();
    assert.equal(await hideunder(mon), true); reset();
    assert.equal(delobj_core(obj, true), undefined);
    removed(obj); assert.equal(hidden(mon), 0); assert.deepEqual(getRngLog(), []);
});

for (const owner of ['free', 'inventory', 'container', 'monster'])
    test(`nonfloor ${owner} removal does not clean stale floor concealment`, async () => {
        const {mon} = await setup(); const obj = await cover();
        assert.equal(await hideunder(mon), true);
        assert.equal(obj_extract_self(obj), undefined);
        // Extraction alone has no concealment contract. Leave the C owner state
        // pending, so an incorrect unconditional cleanup is observable here.
        let container;
        if (owner === 'inventory') await addinv(obj);
        if (owner === 'container') {
            container = mksobj(O.SACK, false, false); await add_to_container(container, obj);
        }
        if (owner === 'monster') await add_to_minv(mon, obj);
        assert.equal(obj.where, {free: OBJ_FREE, inventory: OBJ_INVENT,
            container: OBJ_CONTAINED, monster: OBJ_MINVENT}[owner]);
        assert.equal(hidden(mon), 1); reset();
        assert.equal(delobj(obj), undefined);
        assert.equal(obj.where, OBJ_DELETED); assert.equal(hidden(mon), 1);
        assert.ok(!(game.invent || []).includes(obj)); assert.ok(!(mon.minvent || []).includes(obj));
        assert.ok(!(container?.cobj || []).includes(obj));
        assert.deepEqual(getRngLog(), ['rn2(100)=92']); noFeedback();
    });

test('unpaid floor cover is revealed before the object remains on its real bill', async () => {
    const input = JSON.parse(readFileSync(new URL('gen-sessions/recipes/shop-normal.json', import.meta.url))).segments[0];
    const run = await runSegment({...input, storage: new InMemoryStorage()}); feedback(run);
    const keeper = game.level.monsters.find(m => m.isshk && m.mhp > 0);
    assert.ok(keeper);
    let pos;
    for (let xx = 1; xx < COLNO && !pos; xx++) for (let yy = 0; yy < ROWNO; yy++)
        if (game.level.at(xx, yy).typ === ROOM && costly_spot(xx, yy) && !m_at(xx, yy)) {pos = [xx, yy]; break;}
    assert.ok(pos); [game.u.ux, game.u.uy] = pos;
    game.u.ushops = String.fromCharCode(keeper.eshk.shoproom);
    set_mon_data(game.youmonst, game.mons[P.PM_PIT_VIPER]);
    game.u.umonnum = P.PM_PIT_VIPER; game.u.mh = game.u.mhmax = 60;
    const obj = await cover(O.DAGGER, 1, ...pos);
    await addtobill(obj, false, false, true);
    const bill = keeper.eshk.bill_p.find(b => b.bo_id === obj.o_id);
    assert.ok(bill); assert.equal(obj.unpaid, 1);
    assert.equal(hideunder(game.youmonst), true); reset();
    assert.equal(delobj(obj), undefined);
    removed(obj, OBJ_ONBILL); assert.equal(game.u.uundetected, 0);
    assert.equal(obj.unpaid, 0); assert.equal(bill.useup, true);
    assert.ok(game.billobjs.includes(obj)); assert.equal(bill.obj, obj);
    assert.deepEqual(getRngLog(), ['rn2(100)=92']); noFeedback();
});

test('inventory deletion waits for real invoked-loss feedback before freeing', async () => {
    const {run} = await setup('hero');
    const obj = mksobj(O.CRYSTAL_BALL, false, false);
    obj.oartifact = ART_ORB_OF_DETECTION; obj.age = 0;
    await addinv(obj);
    // Supply the C active-invocation precondition. Removal executes the real
    // private invocation owner and waits on its real terminal message.
    game.u.uprops.INVIS = W_ARTI;
    assert.ok(game.u.uprops.INVIS & W_ARTI);
    reset(); await pline('This occupied message line leaves no room for the next artifact message.');
    let release, finished = false;
    run._display.onEmptyQueue = () => new Promise(resolve => { release = resolve; });
    const pending = delobj(obj);
    assert.equal(typeof pending?.then, 'function'); pending.then(() => {finished = true;});
    try {
        for (let i = 0; i < 20 && !release; i++) await new Promise(resolve => setImmediate(resolve));
        assert.equal(typeof release, 'function', 'real message input is pending');
        assert.equal(finished, false); assert.equal(obj.where, OBJ_FREE);
        assert.ok(!(game.invent || []).includes(obj));
    } finally {
        feedback(run); if (release) release(32); await pending;
    }
    assert.equal(finished, true); assert.equal(obj.where, OBJ_DELETED);
    assert.equal(game.u.uprops.INVIS || 0, 0); assert.ok(obj.age > game.moves);
    assert.match([...game._msg_history, game._toplines].join('\n'), /unfade/);
    assert.match(getRngLog()[0], /^rn2\(100\)=/);
});
