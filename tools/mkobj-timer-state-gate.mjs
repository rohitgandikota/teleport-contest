// Run: node --test tools/mkobj-timer-state-gate.mjs
// Source-derived mkobj.c ice-timer and restore.c binding controls. No mocks or test exports.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mksobj, place_object, remove_object, obj_ice_effects,
    peek_at_iced_corpse_age } from '../js/mkobj.js';
import { start_timer, peek_timer, obj_stop_timers, TIMER_OBJECT,
    ROT_CORPSE, REVIVE_MON, HATCH_EGG, save_timers, restore_timers, relink_timers,
    TIMER_LEVEL, MELT_ICE_AWAY } from '../js/timeout.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { ROOM, ICE, DRAWBRIDGE_UP, DB_ICE, OBJ_FREE, OBJ_FLOOR, OBJ_BURIED, OBJ_INVENT, OBJ_CONTAINED, OBJ_MIGRATING, RANGE_LEVEL } from '../js/const.js';

import { dosave0, dorecover, gamestate_encode, gamestate_decode } from '../js/save.js';
import { find_lev_obj } from '../js/restore.js';

const basic = { seed: 99812, datetime: '20000110090000', moves: ' ',
    nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n' };
async function setup() {
    const run = await runSegment({ ...basic, storage: new InMemoryStorage() });
    let prompts = 0;
    run._display.onEmptyQueue = () => { assert.ok(++prompts < 25); return 27; };
    game._preNhgetchHook = null;
    game.level.objects = []; game.level.objAt.clear();
    game.level.buriedobjs = []; game.timer_base = [];
    game.invent = [];
    Object.assign(game.level.at(30, 10), { typ: ICE, roomno: 0, edge: 0 });
    Object.assign(game.level.at(31, 10), { typ: ROOM, roomno: 0, edge: 0 });
    game.level.flags.has_shop = false;
    game.moves = 100;
}
function body(action = ROT_CORPSE, remaining = 11, type = ONAMES.CORPSE) {
    const obj = mksobj(type, false, false);
    obj_stop_timers(obj);
    Object.assign(obj, { age: 80, on_ice: 0 });
    start_timer(remaining, TIMER_OBJECT, action, obj);
    return obj;
}
function seed() { initRng(3); enableRngLog(); }
function noRng() { assert.deepEqual(getRngLog(), []); }
function linked(obj, x = 30, y = 10) {
    assert.equal(game.level.objectAt(x, y), obj);
    assert.equal(game.level.objects.filter(o => o === obj).length, 1);
    assert.equal(obj.where, OBJ_FLOOR);
}

for (const action of [ROT_CORPSE, REVIVE_MON])
test(`timer: placing corpse on ice rescales action ${action}`, async () => {
    await setup(); const obj = body(action); seed();
    place_object(obj, 30, 10);
    assert.equal(peek_timer(action, obj), 122);
    assert.equal(obj.age, 60); assert.equal(obj.on_ice, 1);
    assert.equal(obj.timed, 1); linked(obj); noRng();
});
test('timer: ordinary floor preserves corpse deadline and age', async () => {
    await setup(); const obj = body(); seed();
    place_object(obj, 31, 10);
    assert.equal(peek_timer(ROT_CORPSE, obj), 111);
    assert.equal(obj.age, 80); assert.equal(obj.on_ice, 0);
    linked(obj, 31, 10); noRng();
});
test('timer: removal restores rate with C integer truncation', async () => {
    await setup(); const obj = body(ROT_CORPSE, 22);
    place_object(obj, 31, 10); // establish floor membership without ice effects
    Object.assign(obj, { on_ice: 1, age: 60 });
    game.moves = 103; seed();
    remove_object(obj);
    assert.equal(obj.where, OBJ_FREE); assert.equal(obj.on_ice, 0);
    assert.equal(obj.age, 81); assert.equal(peek_timer(ROT_CORPSE, obj), 112);
    assert.equal(game.level.objectAt(31, 10), null);
    assert.equal(game.level.objects.includes(obj), false); noRng();
});
test('timer: same-turn remove and replace does not compound the ice rate', async () => {
    await setup(); const obj = body(); seed();
    place_object(obj, 30, 10); remove_object(obj); place_object(obj, 30, 10);
    assert.equal(peek_timer(ROT_CORPSE, obj), 122);
    assert.equal(obj.age, 60); assert.equal(obj.timed, 1); linked(obj); noRng();
});
test('timer: C repeats an explicit ice check even when already iced', async () => {
    await setup(); const obj = body(ROT_CORPSE, 22);
    place_object(obj, 31, 10);
    Object.assign(obj, { on_ice: 1, age: 60 });
    game.level.at(31, 10).typ = ICE; seed();
    obj_ice_effects(31, 10, false);
    assert.equal(peek_timer(ROT_CORPSE, obj), 144);
    assert.equal(obj.age, 20); assert.equal(obj.timed, 1); noRng();
});
test('timer: terrain thaw restores rate and peeked age', async () => {
    await setup(); const obj = body(REVIVE_MON, 22);
    place_object(obj, 31, 10); Object.assign(obj, { on_ice: 1, age: 60 });
    game.moves = 103; const expectedAge = peek_at_iced_corpse_age(obj); seed();
    obj_ice_effects(31, 10, false);
    assert.equal(obj.age, expectedAge); assert.equal(obj.age, 81);
    assert.equal(obj.on_ice, 0); assert.equal(peek_timer(REVIVE_MON, obj), 112); noRng();
});
test('timer: ice under raised drawbridge uses the same predicate', async () => {
    await setup(); const obj = body();
    Object.assign(game.level.at(30, 10), { typ: DRAWBRIDGE_UP, drawbridgemask: DB_ICE }); seed();
    place_object(obj, 30, 10);
    assert.equal(peek_timer(ROT_CORPSE, obj), 122); assert.equal(obj.on_ice, 1); noRng();
});
test('timer: buried corpse is visited only when requested', async () => {
    await setup(); const obj = body();
    Object.assign(obj, { where: OBJ_BURIED, ox: 30, oy: 10 }); game.level.buriedobjs.push(obj); seed();
    obj_ice_effects(30, 10, false); assert.equal(peek_timer(ROT_CORPSE, obj), 111);
    obj_ice_effects(30, 10, true); assert.equal(peek_timer(ROT_CORPSE, obj), 122);
    assert.equal(obj.age, 60); assert.equal(obj.where, OBJ_BURIED); noRng();
});
test('timer: rot takes priority without consuming a revival timer', async () => {
    await setup(); const obj = body(); start_timer(19, TIMER_OBJECT, REVIVE_MON, obj); seed();
    place_object(obj, 30, 10);
    assert.equal(peek_timer(ROT_CORPSE, obj), 122);
    assert.equal(peek_timer(REVIVE_MON, obj), 119); assert.equal(obj.timed, 2); noRng();
});
test('timer: a zero-remaining timer is removed without ice restart', async () => {
    await setup(); const obj = body(ROT_CORPSE, 0); seed();
    place_object(obj, 30, 10);
    assert.equal(peek_timer(ROT_CORPSE, obj), 0); assert.equal(obj.timed, 0);
    assert.equal(obj.age, 80); assert.equal(obj.on_ice, 0); noRng();
});
test('timer: egg hatching is unaffected by placement and extraction', async () => {
    await setup(); const obj = body(HATCH_EGG, 11, ONAMES.EGG); seed();
    place_object(obj, 30, 10); remove_object(obj);
    assert.equal(peek_timer(HATCH_EGG, obj), 111);
    assert.equal(obj.age, 80); assert.equal(obj.timed, 1); noRng();
});

test('timer: zero remaining rot timer falls through to revival', async () => {
    await setup(); const obj = body(ROT_CORPSE, 0);
    start_timer(19, TIMER_OBJECT, REVIVE_MON, obj); seed();
    place_object(obj, 30, 10);
    assert.equal(peek_timer(ROT_CORPSE, obj), 0);
    assert.equal(peek_timer(REVIVE_MON, obj), 138);
    assert.equal(obj.timed, 1); assert.equal(obj.age, 60); noRng();
});
test('timer: overdue timers retain negative remaining time', async () => {
    await setup(); const obj = body(ROT_CORPSE, -3); seed();
    place_object(obj, 30, 10);
    assert.equal(peek_timer(ROT_CORPSE, obj), 94);
    remove_object(obj);
    assert.equal(peek_timer(ROT_CORPSE, obj), 97);
    assert.equal(obj.age, 80); assert.equal(obj.on_ice, 0); noRng();
});

async function icedBeforeRestore() {
    await setup(); const obj = body(ROT_CORPSE, 22);
    // Equal preconditions under both implementations, without the missing hook.
    place_object(obj, 31, 10); game.level.at(31, 10).typ = ICE;
    Object.assign(obj, { age: 60, on_ice: 1 });
    return obj;
}
function unchanged(obj) {
    assert.equal(peek_timer(ROT_CORPSE, obj), 122, 'restore must not rescale the iced timer');
    assert.equal(obj.age, 60); assert.equal(obj.on_ice, 1); assert.equal(obj.timed, 1);
    linked(obj, 31, 10);
}
test('restore: unresolved timer IDs survive pile rebuilding before relinking', async () => {
    const obj = await icedBeforeRestore(), timerId = game.timer_id;
    const saved = save_timers(RANGE_LEVEL, true);
    assert.equal(obj.timed, 1);
    restore_timers(saved, RANGE_LEVEL);
    assert.equal(game.timer_base[0].arg, obj.o_id);
    assert.equal(game.timer_base[0].needs_fixup, 1); seed();
    find_lev_obj(); relink_timers(false);
    unchanged(obj); assert.equal(game.timer_id, timerId); noRng();
});
test('restore: JSON full restore preserves iced age and deadline', async () => {
    const obj = await icedBeforeRestore(), id = obj.o_id, timerId = game.timer_id;
    assert.equal(dosave0(), true); assert.equal(dorecover(), true);
    const restored = game.level.objects.find(item => item.o_id === id);
    assert.ok(restored); assert.notEqual(restored, obj);
    unchanged(restored); assert.equal(game.timer_id, timerId);
    assert.equal(game.timer_base[0].arg, restored);
    assert.equal(game.timer_base[0].needs_fixup, 0);
});
test('restore: extraction after JSON restore resumes ordinary corpse time', async () => {
    const obj = await icedBeforeRestore(), id = obj.o_id;
    assert.equal(dosave0(), true); assert.equal(dorecover(), true);
    const restored = game.level.objects.find(item => item.o_id === id); seed();
    remove_object(restored);
    assert.equal(restored.where, OBJ_FREE); assert.equal(restored.on_ice, 0);
    assert.equal(restored.age, 80); assert.equal(peek_timer(ROT_CORPSE, restored), 111);
    assert.equal(restored.timed, 1); noRng();
});

test('restore: rebinding preserves queue order, IDs and non-floor owners', async () => {
    const floor = await icedBeforeRestore();
    const held = body(HATCH_EGG, 22, ONAMES.EGG);
    held.where = OBJ_INVENT; game.invent.push(held);
    const sack = mksobj(ONAMES.SACK, false, false);
    sack.where = OBJ_INVENT; game.invent.push(sack);
    const contained = body();
    Object.assign(contained, { where: OBJ_CONTAINED, ocontainer: sack }); sack.cobj = [contained];
    const buried = body();
    Object.assign(buried, { where: OBJ_BURIED, ox: 30, oy: 10 }); game.level.buriedobjs.push(buried);
    const migrating = body(HATCH_EGG, 22, ONAMES.EGG);
    migrating.where = OBJ_MIGRATING; game.migrating_objs = [migrating];
    start_timer(22, TIMER_LEVEL, MELT_ICE_AWAY, (30 << 16) | 10);
    const queue = () => game.timer_base.map(timer => ({
        tid: timer.tid, timeout: timer.timeout, kind: timer.kind, action: timer.func_index,
        arg: timer.kind === TIMER_OBJECT ? timer.arg.o_id : timer.arg,
        fixup: timer.needs_fixup,
    }));
    const before = queue(), nextId = game.timer_id;
    const owners = [floor, held, contained, buried, migrating].map(obj => [obj.o_id, obj.timed, obj.age]);
    assert.equal(dosave0(), true); assert.equal(dorecover(), true);
    assert.deepEqual(queue(), before); assert.equal(game.timer_id, nextId);
    const restored = [game.level.objects[0], game.invent.find(obj => obj.o_id === held.o_id),
        game.invent.find(obj => obj.o_id === sack.o_id).cobj[0], game.level.buriedobjs[0], game.migrating_objs[0]];
    assert.deepEqual(restored.map(obj => [obj.o_id, obj.timed, obj.age]), owners);
    for (const timer of game.timer_base.filter(timer => timer.kind === TIMER_OBJECT))
        assert.ok(restored.includes(timer.arg), 'timer points to canonical restored owner');
});
test('restore: already serialized object timer IDs are not encoded twice', async () => {
    const obj = await icedBeforeRestore(); assert.equal(dosave0(), true);
    const key = `save:${game.plname || 'anonymous'}`;
    const snap = gamestate_decode(JSON.parse(game.storage.getItem(key)));
    for (const timer of snap.timer_base) {
        if (timer.kind === TIMER_OBJECT) {
            timer.arg = timer.arg.o_id; timer.needs_fixup = 1;
        }
    }
    game.storage.setItem(key, JSON.stringify(gamestate_encode(snap)));
    assert.equal(dorecover(), true);
    unchanged(game.level.objects.find(item => item.o_id === obj.o_id));
});

