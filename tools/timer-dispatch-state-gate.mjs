// node --test tools/timer-dispatch-state-gate.mjs
// C timeout.c:2222 global-head contract and zap.c:5054 spot cancellation.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {mksobj, place_object} from '../js/mkobj.js';
import {melt_ice} from '../js/zap.js';
import {start_timer, obj_stop_timers, run_timers, TIMER_OBJECT, TIMER_LEVEL,
    ROT_CORPSE, MELT_ICE_AWAY, peek_timer} from '../js/timeout.js';
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {ICE, ROOM, POOL, ICED_POOL} from '../js/const.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';

async function setup() {
    const run = await runSegment({seed: 99812, datetime: '20000110090000', moves: ' ',
        nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage: new InMemoryStorage()});
    let prompts = 0;
    run._display.onEmptyQueue = () => {assert.ok(++prompts < 25); return 27;};
    game._preNhgetchHook = null;
    game.timer_base = []; game.level.objects = []; game.level.objAt.clear();
    game.level.buriedobjs = []; game.level.monsters = []; game.level.traps = [];
    game.level.flags.has_shop = false; game.moves = 100;
    Object.assign(game.level.at(30, 10), {typ: ICE, icedpool: ICED_POOL, roomno: 0, edge: 0});
    Object.assign(game.level.at(31, 10), {typ: ROOM, roomno: 0, edge: 0});
}
function corpse(when, x = 30) {
    const obj = mksobj(ONAMES.CORPSE, false, false);
    obj_stop_timers(obj); Object.assign(obj, {corpsenm: PMNAMES.PM_NEWT, age: 80});
    start_timer(when, TIMER_OBJECT, ROT_CORPSE, obj);
    place_object(obj, x, 10);
    return obj;
}
function seed() {initRng(3); enableRngLog();}
function noRng() {assert.deepEqual(getRngLog(), []);}

test('dispatch: melt cancels a due corpse timer before the next callback', async () => {
    await setup(); const obj = corpse(10);
    start_timer(20, TIMER_LEVEL, MELT_ICE_AWAY, (30 << 16) | 10);
    assert.deepEqual(game.timer_base.map(t => [t.func_index, t.timeout]),
        [[MELT_ICE_AWAY,120], [ROT_CORPSE,120]]);
    const nextId = game.timer_id; game.moves = 120; seed(); await run_timers();
    // C stop_timer returns zero at this exact deadline: remove, do not restart.
    assert.equal(game.level.objectAt(30,10), obj); assert.equal(obj.timed, 0);
    assert.equal(obj.on_ice, 1); assert.equal(obj.age, 60);
    assert.deepEqual(game.timer_base, []); assert.equal(game.timer_id, nextId);
    assert.equal(game.level.at(30,10).typ, POOL); noRng();
});
test('dispatch: rot first remains destructive in the no-restore control', async () => {
    await setup(); start_timer(20, TIMER_LEVEL, MELT_ICE_AWAY, (30 << 16) | 10);
    const obj = corpse(10);
    assert.deepEqual(game.timer_base.map(t => t.func_index), [ROT_CORPSE,MELT_ICE_AWAY]);
    game.moves = 120; seed(); await run_timers();
    assert.equal(game.level.objects.includes(obj), false); assert.equal(obj.timed, 0);
    assert.deepEqual(game.timer_base, []); noRng();
});
test('dispatch: all due objects expire while a future timer stays linked', async () => {
    await setup(); const first = corpse(10,31), second = corpse(10,31), later = corpse(30,31);
    const future = game.timer_base.find(t => t.arg === later);
    const nextId = game.timer_id; game.moves = 110; seed(); await run_timers();
    assert.equal(game.level.objects.includes(first), false);
    assert.equal(game.level.objects.includes(second), false);
    assert.equal(game.level.objects.includes(later), true);
    assert.deepEqual([first.timed, second.timed, later.timed], [0,0,1]);
    assert.deepEqual(game.timer_base, [future]); assert.equal(game.timer_id, nextId); noRng();
});
test('dispatch: thaw restarts a future corpse deadline without firing it early', async () => {
    await setup(); const obj = corpse(20);
    start_timer(20, TIMER_LEVEL, MELT_ICE_AWAY, (30 << 16) | 10);
    const nextId = game.timer_id; game.moves = 120; seed(); await run_timers();
    assert.equal(game.level.objectAt(30,10), obj);
    assert.equal(obj.timed, 1); assert.equal(obj.on_ice, 0); assert.equal(obj.age, 90);
    assert.equal(peek_timer(ROT_CORPSE,obj), 130);
    assert.equal(game.timer_base[0].tid, nextId); assert.equal(game.timer_id, nextId + 1); noRng();
});
test('melt: spot cancellation mutates the existing queue and preserves other records', async () => {
    await setup(); const obj = corpse(30,31);
    start_timer(10, TIMER_LEVEL, MELT_ICE_AWAY, (30 << 16) | 10);
    start_timer(10, TIMER_LEVEL, MELT_ICE_AWAY, (29 << 16) | 10);
    const queue = game.timer_base, nextId = game.timer_id;
    const survivors = [queue[0], queue[2]]; seed(); await melt_ice(30,10);
    assert.equal(game.timer_base, queue, 'C spot_stop_timers removes matching records in place');
    assert.deepEqual(game.timer_base, survivors);
    assert.equal(obj.timed, 1); assert.equal(game.timer_id, nextId);
    assert.equal(game.level.at(30,10).typ, POOL); noRng();
});
test('dispatch: empty queue neither draws nor changes IDs', async () => {
    await setup(); const nextId = game.timer_id; seed(); await run_timers();
    assert.deepEqual(game.timer_base, []); assert.equal(game.timer_id, nextId); noRng();
});
