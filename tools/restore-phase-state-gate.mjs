#!/usr/bin/env node
// Source-derived save.c/restore.c ownership controls, with normal imports.
// These constructed states are not native recordings or replacement helpers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { GameMap } from '../js/game.js';
import * as save from '../js/save.js';
import * as restore from '../js/restore.js';
import { mksobj } from '../js/mkobj.js';
import { ONAMES as N } from '../js/objects_data.js';
import { PMNAMES as PM } from '../js/monst_data.js';
import { newsym, suppress_map_output } from '../js/display.js';
import { new_light_source, LS_OBJECT, LS_MONSTER } from '../js/light.js';
import { start_timer, HATCH_EGG, TIMER_OBJECT, TIMER_LEVEL, MELT_ICE_AWAY } from '../js/timeout.js';
import { find_oid } from '../js/shk.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { ROOM, OBJ_FREE, OBJ_FLOOR, OBJ_INVENT, OBJ_BURIED, OBJ_CONTAINED,
    OBJ_MINVENT, OBJ_MIGRATING, W_WEP, W_BALL, W_CHAIN, REST_GSTATE,
    REST_LEVELS, REST_CURRENT_LEVEL, MAGIC_PORTAL } from '../js/const.js';

const input = {
    seed: 99812,
    datetime: '20000110090000',
    moves: ' ',
    nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
};
const clone = value => save.gamestate_decode(save.gamestate_encode(value));
const calls = () => getRngLog().map(call => call.replace(/\s*@.*$/, '').trim());
function seed(value = 7) {
    initRng(value);
    enableRngLog();
}
function emptyLevel() {
    const level = new GameMap();
    for (let x = 20; x <= 40; x++)
        for (let y = 5; y <= 15; y++)
            Object.assign(level.at(x, y), { typ: ROOM, lit: true });
    return level;
}
async function setup() {
    const replay = await runSegment({ ...input, storage: new InMemoryStorage() });
    replay._display.onEmptyQueue = () => 27;
    game.program_state_gameover = false;
    game._win_stop = false;
    game.level = emptyLevel();
    game.u.ux = 30;
    game.u.uy = 10;
    game.u.urooms = game.u.urooms0 = game.u.ushops = '';
    game.invent = [];
    game.migrating_objs = [];
    game.migrating_mons = [];
    game.mydogs = [];
    game.timer_base = [];
    game.light_sources = [];
    game.billobjs = [];
    game.saved_levels = new Map();
    game.worms = { wheads: {}, wtails: {}, wgrowtime: {} };
    game.stairs = null;
    game.regions = [];
    game.exclusion_zones = [];
    game.moves = 100;
    return replay;
}
function object(typ = N.DAGGER, where = OBJ_FREE) {
    const obj = mksobj(typ, false, false);
    obj.where = where;
    return obj;
}
// A valid retained C floor state. A fixed knife can survive its prior placement.
function floor(obj, x = 30, y = 10) {
    Object.assign(obj, { where: OBJ_FLOOR, ox: x, oy: y,
        nexthere: game.level.objAt.get(`${x},${y}`) || null });
    game.level.objects.unshift(obj);
    game.level.objAt.set(`${x},${y}`, obj);
    return obj;
}
function fixedKnife() {
    const obj = object(N.CRYSKNIFE);
    obj.oerodeproof = 1;
    return obj;
}
function stored() {
    return save.gamestate_decode(JSON.parse(game.storage.getItem(`save:${game.plname}`)));
}
function mon(id, x = 31, y = 10) {
    return { m_id: id, mnum: PM.PM_LONG_WORM, data: game.mons[PM.PM_LONG_WORM],
        mx: x, my: y, mhp: 20, mhpmax: 20, mcanmove: 1, mpeaceful: 1,
        minvent: [], wormno: 0, mlstmv: game.moves };
}

for (const [value, temporary, final, expected] of [
    [7, N.CRYSKNIFE, N.WORM_TOOTH,
        ['rn2(10)=5', 'rn2(100)=24', 'rn2(3)=0', 'rn2(2)=1', 'rn2(10)=0']],
    [11, N.WORM_TOOTH, N.CRYSKNIFE,
        ['rn2(10)=0', 'rn2(100)=96', 'rn2(3)=1', 'rn2(2)=1', 'rn2(10)=7']]
]) {
    test(`full recovery seed ${value}: independent first and original final copies`, async () => {
        await setup();
        const obj = floor(fixedKnife());
        assert.equal(await save.dosave0(), true);
        const bytes = game.storage.getItem(`save:${game.plname}`);
        const original = stored();
        game.luacore = false; // A fresh process, as in the native pairs.
        seed(value);
        assert.equal(await save.dorecover(), true);
        const first = game.saved_levels.get('0:1');
        const live = game.level;
        assert.notEqual(first, live);
        assert.equal(first.objects[0].otyp, temporary);
        assert.equal(live.objects[0].otyp, final);
        assert.notEqual(first.objects[0], live.objects[0]);
        assert.equal(live.objects[0].o_id, obj.o_id);
        assert.equal(original.level.objects[0].otyp, N.CRYSKNIFE);
        assert.equal(game.storage.getItem(`save:${game.plname}`), bytes);
        assert.deepEqual(calls(), expected);
        assert.equal(game.program_state.restoring, 0);
        assert.equal(game.program_state.in_getlev, false);
        assert.equal(game.program_state.beyond_savefile_load, 1);
    });
}

test('savelev owns a fresh record and releases floor/context references without held effects', async () => {
    await setup();
    const obj = floor(fixedKnife());
    game.context.victual = { piece: obj, o_id: 0 };
    game.context.objsplit = { parent_oid: obj.o_id, child_oid: 999 };
    game.thrownobj = obj;
    const live = game.level;
    seed();
    const record = save.savelev(1, true);
    assert.notEqual(record, live);
    assert.notEqual(record.objects[0], obj);
    assert.equal(record.objects[0].otyp, N.CRYSKNIFE);
    assert.equal(record.objects[0].where, OBJ_FLOOR);
    assert.equal(obj.where, OBJ_FREE);
    assert.equal(game.context.victual.piece, null);
    assert.equal(game.context.victual.o_id, obj.o_id);
    assert.deepEqual(game.context.objsplit, { parent_oid: 0, child_oid: 0 });
    assert.equal(game.thrownobj, null);
    assert.equal(game.level.objects.length, 0);
    assert.deepEqual(calls(), []);
});

test('writing without freeing retains live ownership and serializes embedded relative pet times', async () => {
    await setup();
    const corpse = floor(object(N.CORPSE));
    const pet = mon(501);
    pet.edog = { droptime: 80, hungrytime: 130, apport: 0 };
    corpse.oextra = { omonst: pet };
    const record = save.savelev(1);
    assert.equal(corpse.where, OBJ_FLOOR);
    assert.equal(corpse.oextra.omonst.edog.droptime, 80);
    assert.equal(record.objects[0].oextra.omonst.edog.droptime, -20);
    game.moves = 200;
    game.program_state.restoring = REST_LEVELS;
    await restore.getlev(record);
    assert.deepEqual(game.level.objects[0].oextra.omonst.edog,
        { droptime: 180, hungrytime: 230, apport: 1 });
});

test('full save loads dormant levels in numeric ledger order and excludes the active alias', async () => {
    await setup();
    const active = game.level;
    const make = () => {
        game.level = emptyLevel();
        const knife = floor(fixedKnife());
        return [game.level, knife.o_id];
    };
    const [level2, id2] = make();
    const [level3, id3] = make();
    game.level = active;
    game.saved_levels = new Map([['0:3', level3], ['0:1', active], ['0:2', level2]]);
    seed(11); // First placement reverts; the next actual ISAAC draw survives.
    assert.equal(await save.dosave0(), true);
    const data = stored();
    assert.equal(data.saved_levels.get('0:1'), data.level);
    assert.equal(data.saved_levels.get('0:2').objects[0].o_id, id2);
    assert.equal(data.saved_levels.get('0:2').objects[0].otyp, N.WORM_TOOTH);
    assert.equal(data.saved_levels.get('0:3').objects[0].o_id, id3);
    assert.equal(data.saved_levels.get('0:3').objects[0].otyp, N.CRYSKNIFE);
    assert.deepEqual(calls(), ['rn2(10)=0', 'rn2(10)=6']);
    assert.ok(game.visited_ledgers.has('0:2'));
    assert.ok(game.visited_ledgers.has('0:3'));
    assert.equal(game.visited_ledgers.has('0:0'), false);
});

test('dormant recovery performs its own load and retains the original encoded save', async () => {
    await setup();
    const active = game.level;
    game.level = emptyLevel();
    floor(fixedKnife());
    const other = save.savelev(2, true);
    game.level = active;
    game.saved_levels = new Map([['0:2', other]]);
    seed(7);
    await save.dosave0();
    const data = stored();
    assert.equal(data.saved_levels.get('0:2').objects[0].otyp, N.CRYSKNIFE);
    const bytes = game.storage.getItem(`save:${game.plname}`);
    // Same-process C restore retains an existing Lua core. role_init consumes
    // the first value; this seed's second value reverts the dormant knife.
    seed(5);
    await save.dorecover();
    assert.equal(game.saved_levels.get('0:2').objects[0].otyp, N.WORM_TOOTH);
    assert.deepEqual(calls(), ['rn2(100)=44', 'rn2(10)=0']);
    assert.equal(game.storage.getItem(`save:${game.plname}`), bytes);
});

test('floor recursion runs while buried and inventory knives remain held', async () => {
    await setup();
    const sack = floor(object(N.SACK));
    const nested = object(N.CRYSKNIFE, OBJ_CONTAINED);
    nested.ocontainer = sack;
    sack.cobj = [nested];
    const carried = object(N.CRYSKNIFE, OBJ_INVENT);
    const buried = object(N.CRYSKNIFE, OBJ_BURIED);
    game.invent = [carried];
    game.level.buriedobjs = [buried];
    await save.dosave0();
    seed();
    await save.dorecover();
    assert.equal(find_oid(nested.o_id).otyp, N.WORM_TOOTH);
    assert.equal(game.invent[0].otyp, N.CRYSKNIFE);
    assert.equal(game.level.buriedobjs[0].otyp, N.CRYSKNIFE);
    assert.deepEqual(calls(), ['rn2(100)=25']);
});

test('local and global owner IDs relink to their final objects with no duplicate timer counts', async () => {
    await setup();
    const local = floor(object(N.EGG));
    const global = object(N.EGG, OBJ_INVENT);
    game.invent = [global];
    start_timer(100, TIMER_OBJECT, HATCH_EGG, local);
    start_timer(100, TIMER_OBJECT, HATCH_EGG, global);
    new_light_source(30, 10, 1, LS_OBJECT, local.o_id);
    new_light_source(30, 10, 1, LS_OBJECT, global.o_id);
    const nextId = game.timer_id;
    await save.dosave0();
    const data = stored();
    assert.equal(data.timer_base.length, 1);
    assert.equal(data.level._saved_timers.timers.length, 1);
    assert.equal(data.timer_base[0].arg, global.o_id);
    assert.equal(data.level._saved_timers.timers[0].arg, local.o_id);
    await save.dorecover();
    assert.deepEqual(game.timer_base.map(timer => timer.arg.o_id), [local.o_id, global.o_id]);
    assert.equal(game.timer_id, nextId);
    for (const timer of game.timer_base) {
        assert.equal(timer.arg, find_oid(timer.arg.o_id));
        assert.equal(timer.arg.timed, 1);
        assert.equal(timer.needs_fixup, 0);
    }
    assert.deepEqual(game.light_sources.map(light => light.id), [local.o_id, global.o_id]);
    assert.ok(game.light_sources.every(light => !(light.flags & 2)));
});

test('inventory context, worn weapon, monster owner and polearm references bind by IDs', async () => {
    await setup();
    const weapon = object(N.DAGGER, OBJ_INVENT);
    weapon.owornmask = W_WEP;
    game.u.uwep = weapon;
    game.invent = [weapon];
    game.context.tin = { tin: weapon, o_id: 0 };
    game.context.spbook = { book: weapon, o_id: 0 };
    const resident = mon(531);
    const held = object(N.ROCK, OBJ_MINVENT);
    held.ocarry = resident;
    resident.minvent = [held];
    game.level.monsters = [resident];
    game.context.polearm = { hitmon: resident, m_id: 0 };
    await save.dosave0();
    await save.dorecover();
    assert.equal(game.u.uwep, game.invent[0]);
    assert.equal(game.context.tin.tin, game.invent[0]);
    assert.equal(game.context.spbook.book, game.invent[0]);
    const restored = game.level.monsters[0];
    assert.equal(restored.minvent[0].ocarry, restored);
    assert.equal(game.context.polearm.hitmon, restored);
    assert.equal(restored.data, game.mons[restored.mnum]);
});

for (const slot of ['ustuck', 'usteed']) {
    test(`current-level ${slot} follows the final monster copy`, async () => {
        await setup();
        const resident = mon(551);
        game.level.monsters = [resident];
        game.u[slot] = resident;
        await save.dosave0();
        await save.dorecover();
        assert.equal(game.u[slot], game.level.monsters[0]);
        assert.notEqual(game.u[slot], game.saved_levels.get('0:1').monsters[0]);
        assert.equal(game.u[`${slot}_mid`], 0);
    });
}

for (const location of ['floor', 'loose']) {
    test(`${location} ball and chain retain their final worn owners`, async () => {
        await setup();
        const ball = object(N.HEAVY_IRON_BALL);
        const chain = object(N.IRON_CHAIN);
        ball.owornmask = W_BALL;
        chain.owornmask = W_CHAIN;
        game.u.uball = ball;
        game.u.uchain = chain;
        if (location === 'floor') {
            floor(ball);
            floor(chain);
        } else {
            game.u.uswallow = 1;
        }
        await save.dosave0();
        await save.dorecover();
        assert.equal(game.u.uball.o_id, ball.o_id);
        assert.equal(game.u.uchain.o_id, chain.o_id);
        assert.notEqual(game.u.uball, ball);
        assert.notEqual(game.u.uchain, chain);
        if (location === 'floor') {
            assert.equal(game.u.uball, find_oid(ball.o_id));
            assert.equal(game.u.uchain, find_oid(chain.o_id));
        }
    });
}

test('owned worm tables preserve head/tail aliases across fresh level loads', async () => {
    await setup();
    const resident = mon(571);
    resident.wormno = 1;
    game.level.monsters = [resident];
    const head = { wx: 31, wy: 10, nseg: null };
    const tail = { wx: 30, wy: 10, nseg: head };
    game.worms = { wheads: { 1: head }, wtails: { 1: tail }, wgrowtime: { 1: 180 } };
    const record = save.savelev(1, true);
    assert.equal(record._saved_worms.wtails[1].nseg, record._saved_worms.wheads[1]);
    assert.deepEqual(game.worms.wheads, {});
    game.program_state.restoring = REST_LEVELS;
    await restore.getlev(record);
    assert.equal(game.worms.wtails[1].nseg, game.worms.wheads[1]);
    assert.notEqual(game.worms.wtails[1], record._saved_worms.wtails[1]);
    assert.equal(game.level.monAt.get('30,10'), game.level.monsters[0]);
    assert.equal(game.level.monAt.get('31,10'), game.level.monsters[0]);
    assert.equal(game.worms.wgrowtime[1], 180);
});

test('level records retain relative destinations, timestamps, traps and prepend order', async () => {
    await setup();
    game.stairs = { sx: 29, sy: 10, up: false, isladder: false, u_traversed: true,
        tolev: { dnum: 0, dlevel: 2 }, next: null };
    game.level.traps = [{ tx: 30, ty: 10, ttyp: MAGIC_PORTAL, dst: { dnum: 0, dlevel: 3 } },
        { tx: 31, ty: 10, ttyp: MAGIC_PORTAL, dst: { dnum: 1, dlevel: 2 } }];
    game.level.flags.stasis_until = 180;
    game.exclusion_zones = [{ type: 1 }, { type: 2 }];
    const record = save.savelev(1, true);
    assert.equal(record._saved_stairs.tolev.dlevel, 1);
    assert.equal(record.traps[0].dst.dlevel, 2);
    assert.equal(record.flags.stasis_until, 80);
    game.program_state.restoring = REST_CURRENT_LEVEL;
    game.moves = 200;
    await restore.getlev(record);
    assert.equal(game.stairs.tolev.dlevel, 2);
    assert.equal(game.level.traps[1].dst.dlevel, 3);
    assert.equal(game.level.traps[0].dst.dnum, 1);
    assert.equal(game.level.flags.stasis_until, 280);
    assert.deepEqual(game.exclusion_zones, [{ type: 2 }, { type: 1 }]);
});

test('regions age on each load and expired entries are removed without RNG', async () => {
    await setup();
    game.regions = [
        { ttl: 20, n_monst: 0, monsters: [], rects: [], player_flags: 0 },
        { ttl: 5, n_monst: 0, monsters: [], rects: [], player_flags: 0 }
    ];
    const record = save.savelev(1, true);
    game.moves = 110;
    game.program_state.restoring = REST_LEVELS;
    seed();
    await restore.getlev(record);
    assert.equal(game.regions.length, 1);
    assert.equal(game.regions[0].ttl, 10);
    assert.deepEqual(calls(), []);
    assert.equal(record._saved_regions[0].ttl, 20);
});

test('REST_GSTATE suppresses newsym before remembered map changes', async () => {
    await setup();
    const cell = game.level.at(game.u.ux, game.u.uy);
    cell.waslit = 0;
    game.program_state.restoring = REST_GSTATE;
    assert.equal(suppress_map_output(), true);
    const before = JSON.stringify(cell);
    newsym(game.u.ux, game.u.uy);
    assert.equal(JSON.stringify(cell), before);
});

test('legacy root graph restores stored owners without inventing missing worm or cloud data', async () => {
    await setup();
    const floorObj = floor(object(N.EGG));
    const held = object(N.EGG, OBJ_INVENT);
    game.invent = [held];
    start_timer(100, TIMER_OBJECT, HATCH_EGG, floorObj);
    start_timer(100, TIMER_OBJECT, HATCH_EGG, held);
    new_light_source(30, 10, 1, LS_OBJECT, floorObj.o_id);
    new_light_source(30, 10, 1, LS_OBJECT, held.o_id);
    const old = clone(game); // Exact old codec shape, without new savelev fields.
    assert.equal(old._save_version, undefined);
    assert.equal(old.level._saved_format, undefined);
    game.storage.setItem(`save:${game.plname}`, JSON.stringify(save.gamestate_encode(old)));
    await save.dorecover();
    assert.equal(game.timer_base.length, 2);
    assert.equal(game.timer_base[0].arg, find_oid(floorObj.o_id));
    assert.equal(game.timer_base[1].arg, find_oid(held.o_id));
    assert.equal(game.level._waterlevel, undefined);
    assert.deepEqual(game.worms.wheads, {});
    assert.equal(game.light_sources.length, 2);
});

test('legacy dormant absolute pet times remain absolute until rewritten in the new format', async () => {
    await setup();
    const dormant = emptyLevel();
    const pet = mon(591);
    pet.edog = { droptime: 80, hungrytime: 130, apport: 5 };
    dormant.monsters = [pet];
    dormant._saved_omoves = 100;
    game.saved_levels = new Map([['0:2', dormant]]);
    const old = clone(game);
    game.storage.setItem(`save:${game.plname}`, JSON.stringify(save.gamestate_encode(old)));
    await save.dorecover();
    const rewritten = game.saved_levels.get('0:2');
    assert.equal(rewritten._saved_format, 1);
    assert.equal(rewritten.monsters[0].edog.droptime, -20);
    assert.equal(rewritten.monsters[0].edog.hungrytime, 30);
    assert.equal(rewritten._waterlevel, undefined);
    assert.deepEqual(rewritten._saved_worms.wheads, {});
});

test('missing or malformed saves return false without RNG or losing the live map', async () => {
    await setup();
    const level = game.level;
    seed();
    assert.equal(await save.dorecover(), false);
    game.storage.setItem(`save:${game.plname}`, '{broken');
    assert.equal(await save.dorecover(), false);
    assert.equal(game.level, level);
    assert.deepEqual(calls(), []);
});

test('unhealthy restore clears transient state and retains process option objects', async () => {
    await setup();
    await save.dosave0();
    const data = stored();
    data.u.uhp = 0;
    game.storage.setItem(`save:${game.plname}`, JSON.stringify(save.gamestate_encode(data)));
    const flags = game.flags;
    const iflags = game.iflags;
    assert.equal(await save.dorecover(), false);
    assert.equal(game.flags, flags);
    assert.equal(game.iflags, iflags);
    assert.equal(game.program_state.restoring, 0);
    assert.equal(game.u.uz.dlevel, 1);
    assert.equal(game.u.usteed_mid, 0);
    assert.equal(game.u.ustuck_mid, 0);
    assert.equal(game.storage.getItem(`save:${game.plname}`), null);
    assert.equal(game.level.objects.length, 0);
});


test('embedded traits in held, migrating and monster-owned objects use one timestamp conversion', async () => {
    await setup();
    const resident = mon(601);
    const migrant = mon(602, 0, 0);
    game.level.monsters = [resident];
    game.migrating_mons = [migrant];
    const held = object(N.CORPSE, OBJ_INVENT);
    const migrating = object(N.CORPSE, OBJ_MIGRATING);
    const minvent = object(N.CORPSE, OBJ_MINVENT);
    minvent.ocarry = resident;
    resident.minvent = [minvent];
    game.invent = [held];
    game.migrating_objs = [migrating];
    for (const obj of [held, migrating, minvent]) {
        const traits = mon(700 + obj.o_id);
        traits.edog = { droptime: 90, hungrytime: 140, apport: 3 };
        obj.oextra = { omonst: traits };
    }
    migrant.edog = { droptime: 90, hungrytime: 140, apport: 3 };
    await save.dosave0();
    const data = stored();
    for (const obj of [data.invent[0], data.migrating_objs[0], data.level.monsters[0].minvent[0]])
        assert.deepEqual(obj.oextra.omonst.edog, { droptime: -10, hungrytime: 40, apport: 3 });
    await save.dorecover();
    for (const obj of [game.invent[0], game.migrating_objs[0], game.level.monsters[0].minvent[0]])
        assert.deepEqual(obj.oextra.omonst.edog, { droptime: 90, hungrytime: 140, apport: 3 });
    assert.deepEqual(game.migrating_mons[0].edog, { droptime: 90, hungrytime: 140, apport: 3 });
});
