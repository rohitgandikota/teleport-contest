// node --test tools/timer-restore-order-state-gate.mjs
// Fixed source-state fixtures. Expected IDs are independent of transfer helpers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {GameMap} from '../js/game.js';
import {mksobj, place_object} from '../js/mkobj.js';
import {dosave0, dorecover, gamestate_decode, gamestate_encode} from '../js/save.js';
import {save_timers, restore_timers, relink_timers, obj_stop_timers,
    TIMER_OBJECT, TIMER_LEVEL, ROT_CORPSE, HATCH_EGG, MELT_ICE_AWAY} from '../js/timeout.js';
import {find_oid} from '../js/shk.js';
import {ONAMES} from '../js/objects_data.js';
import {OBJ_INVENT, OBJ_FLOOR, OBJ_CONTAINED, OBJ_BURIED, OBJ_MIGRATING, OBJ_MINVENT,
    ROOM, ICE, RANGE_LEVEL, RANGE_GLOBAL} from '../js/const.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';

// At turn 100, [40] expires at 150, the middle group at 200, [90] at 250.
// IDs deliberately do not encode insertion order. All are below timer_id=1000.
const fixture = [
    [40, 150, 'early'], [73, 200, 'level'], [21, 200, 'migrating-monster'],
    [64, 200, 'resident-monster'], [17, 200, 'migrating-object'],
    [51, 200, 'buried'], [32, 200, 'nested-floor'], [99, 200, 'nested-held'],
    [8, 200, 'held'], [88, 200, 'floor'], [90, 250, 'late'],
];
// C writes local/global subsequences in queue order. After its first load,
// temporary-local write/free, and ORIGINAL current-level reload, ties are:
// local [88,32,51,64,73], global [8,99,17,21]. No helper computes this oracle.
const expectedMixed = [40, 88, 32, 51, 64, 73, 8, 99, 17, 21, 90];

async function setup(rows = fixture) {
    await runSegment({seed: 99812, datetime: '20000110090000', moves: ' ',
        nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage: new InMemoryStorage()});
    game.timer_base = []; game.timer_id = 1000; game.moves = 100;
    game.invent = []; game.migrating_objs = []; game.level.buriedobjs = [];
    game.level.objects = []; game.level.objAt.clear(); game.level.flags.has_shop = false;
    Object.assign(game.level.at(30, 10), {typ: ICE, roomno: 0, edge: 0});
    Object.assign(game.level.at(31, 10), {typ: ROOM, roomno: 0, edge: 0});
    const [resident, migrant] = game.level.monsters;
    assert.ok(resident && migrant);
    game.level.monsters = game.level.monsters.filter(m => m !== migrant);
    game.migrating_mons = [migrant]; game.mydogs = [];
    const heldSack = mksobj(ONAMES.SACK, false, false);
    heldSack.where = OBJ_INVENT; game.invent.push(heldSack);
    const floorSack = mksobj(ONAMES.SACK, false, false);
    place_object(floorSack, 31, 10);
    const owners = {};
    for (const name of new Set(rows.map(row => row[2]))) {
        if (name === 'level') continue;
        const obj = mksobj(name === 'floor' ? ONAMES.CORPSE : ONAMES.EGG, false, false);
        obj_stop_timers(obj);
        Object.assign(obj, {age: 60, timed: 0, on_ice: 0});
        if (name === 'floor') {
            place_object(obj, 30, 10); obj.on_ice = 1;
        } else if (name.startsWith('nested-')) {
            const outer = name === 'nested-floor' ? floorSack : heldSack;
            const inner = mksobj(ONAMES.SACK, false, false);
            Object.assign(inner, {where: OBJ_CONTAINED, ocontainer: outer, cobj: [obj]});
            (outer.cobj ||= []).push(inner);
            Object.assign(obj, {where: OBJ_CONTAINED, ocontainer: inner});
        } else if (name === 'buried') {
            Object.assign(obj, {where: OBJ_BURIED, ox: 30, oy: 10}); game.level.buriedobjs.push(obj);
        } else if (name === 'migrating-object') {
            obj.where = OBJ_MIGRATING; game.migrating_objs.push(obj);
        } else if (name.endsWith('-monster')) {
            const mon = name === 'resident-monster' ? resident : migrant;
            Object.assign(obj, {where: OBJ_MINVENT, ocarry: mon}); (mon.minvent ||= []).push(obj);
        } else {
            obj.where = OBJ_INVENT; game.invent.push(obj);
        }
        owners[name] = obj;
    }
    game.timer_id = 1000;
    game.timer_base = rows.map(([tid, timeout, name]) => {
        const obj = owners[name];
        if (obj) obj.timed++;
        return {tid, timeout, kind: obj ? TIMER_OBJECT : TIMER_LEVEL, needs_fixup: 0,
            func_index: !obj ? MELT_ICE_AWAY : name === 'floor' ? ROT_CORPSE : HATCH_EGG,
            arg: obj || ((30 << 16) | 10)};
    });
    return owners;
}
const ids = () => game.timer_base.map(t => t.tid);
const records = () => game.timer_base.map(t => ({...t,
    arg: t.kind === TIMER_OBJECT ? t.arg.o_id : t.arg})).sort((a,b) => a.tid - b.tid);
function ownerState(owners) {
    return Object.values(owners).map(o => ({id: o.o_id, timed: o.timed,
        age: o.age, on_ice: o.on_ice, where: o.where}));
}
async function recover(expected, owners, encodedIds = false) {
    const beforeRecords = records(), beforeOwners = ownerState(owners);
    assert.equal(dosave0(), true);
    if (encodedIds) {
        const key = `save:${game.plname}`;
        const snap = gamestate_decode(JSON.parse(game.storage.getItem(key)));
        for (const t of snap.timer_base) if (t.kind === TIMER_OBJECT) {
            t.arg = t.arg.o_id; t.needs_fixup = 1;
        }
        game.storage.setItem(key, JSON.stringify(gamestate_encode(snap)));
    }
    // This Wizard's role_init draws one nemesis gender; queue work consumes none.
    initRng(3); enableRngLog();
    assert.equal(await dorecover(), true);
    assert.deepEqual(getRngLog().map(s => s.replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim()),
        ['rn2(100)=31']);
    assert.deepEqual(ids(), expected);
    assert.deepEqual(records(), beforeRecords);
    assert.equal(game.timer_id, 1000);
    assert.deepEqual(beforeOwners.map(o => {
        const restored = find_oid(o.id);
        assert.ok(restored); assert.notEqual(restored, Object.values(owners).find(x => x.o_id === o.id));
        return {id: restored.o_id, timed: restored.timed, age: restored.age,
            on_ice: restored.on_ice, where: restored.where};
    }), beforeOwners);
    for (const t of game.timer_base) if (t.kind === TIMER_OBJECT) {
        assert.equal(t.arg, find_oid(t.arg.o_id)); assert.equal(t.needs_fixup, 0);
    }
}

test('C full recovery gives local ties priority and reverses both ranges', async () => {
    const owners = await setup();
    await recover(expectedMixed, owners);
    assert.equal(game.level.objectAt(30, 10), find_oid(owners.floor.o_id));
});
test('C global-only ties include nested and migrating owners', async () => {
    const owners = await setup(fixture.filter(r => [21,17,99,8].includes(r[0])));
    await recover([8,99,17,21], owners);
});
test('C local-only ties include floor, buried, nested and resident owners', async () => {
    const owners = await setup(fixture.filter(r => [73,64,51,32,88].includes(r[0])));
    await recover([88,32,51,64,73], owners);
});
test('different deadlines remain ascending across ranges', async () => {
    const owners = await setup([[73,150,'level'], [8,175,'held'], [88,200,'floor'], [17,225,'migrating-object']]);
    await recover([73,8,88,17], owners);
});
test('separate tie groups never cross deadlines', async () => {
    const owners = await setup([[8,150,'held'], [73,150,'level'],
        [17,200,'migrating-object'], [88,200,'floor'], [51,200,'buried']]);
    await recover([73,8,51,88,17], owners);
});
test('already serialized owner IDs retain the unresolved floor phase and C order', async () => {
    const owners = await setup();
    await recover(expectedMixed, owners, true);
});
test('each new full save applies C order once', async () => {
    let owners = await setup();
    await recover(expectedMixed, owners);
    owners = Object.fromEntries(Object.entries(owners).map(([name, obj]) => [name, find_oid(obj.o_id)]));
    await recover([40,73,64,51,32,88,21,17,99,8,90], owners);
});
test('dormant queues and active-level aliases are not restored as extra timers', async () => {
    const owners = await setup();
    const dormant = new GameMap();
    dormant.objects = [mksobj(ONAMES.EGG,false,false), mksobj(ONAMES.EGG,false,false)];
    for (const [i,obj] of dormant.objects.entries()) {
        Object.assign(obj, {where:OBJ_FLOOR, ox:30+i, oy:10, timed:1, nexthere:null});
        dormant.objAt.set(`${30+i},10`, obj);
    }
    dormant._saved_timers = {timers: dormant.objects.map((obj,i) => ({tid:701+i,
        timeout:200, kind:TIMER_OBJECT, func_index:HATCH_EGG, arg:obj.o_id, needs_fixup:1}))};
    game.level._saved_timers = {timers: [{tid: 703, timeout: 200, kind: TIMER_LEVEL,
        func_index: MELT_ICE_AWAY, arg: (31 << 16) | 10, needs_fixup: 0}]};
    const original = structuredClone(dormant._saved_timers);
    const dormantOwners = dormant.objects.map(o => [o.o_id,o.timed,o.age]);
    const stale = structuredClone(game.level._saved_timers);
    const currentKey = `${game.u.uz.dnum}:${game.u.uz.dlevel}`;
    game.saved_levels = new Map([[currentKey, game.level], ['1:99', dormant]]);
    await recover(expectedMixed, owners);
    assert.equal(game.saved_levels.get(currentKey), game.level);
    assert.deepEqual(game.saved_levels.get('1:99')._saved_timers, original);
    assert.deepEqual(game.saved_levels.get('1:99').objects.map(o => [o.o_id,o.timed,o.age]), dormantOwners);
    assert.deepEqual(game.level._saved_timers, stale);
});
test('empty active queue remains empty with the next ID unchanged', async () => {
    const owners = await setup([]); await recover([], owners);
});
test('C full transfer sequence independently matches the fixed mixed fixture', async () => {
    await setup(); initRng(3); enableRngLog();
    const local = save_timers(RANGE_LEVEL, true), global = save_timers(RANGE_GLOBAL, true);
    restore_timers(local, RANGE_LEVEL); restore_timers(global, RANGE_GLOBAL); relink_timers(false);
    assert.deepEqual(ids(), [40,8,99,17,21,88,32,51,64,73,90]);
    save_timers(RANGE_LEVEL, true);
    restore_timers(local, RANGE_LEVEL); relink_timers(false);
    assert.deepEqual(ids(), expectedMixed); assert.deepEqual(getRngLog(), []);
});
