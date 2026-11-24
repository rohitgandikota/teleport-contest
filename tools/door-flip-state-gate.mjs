#!/usr/bin/env node
// Constructed C ownership/geometry controls through normal runtime imports.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { GameMap } from '../js/game.js';
import { stock_room } from '../js/shknam.js';
import { add_door, get_level_extends } from '../js/mklev.js';
import { add_damage, restshk } from '../js/shk.js';
import { savebones, getbones_load } from '../js/bones.js';
import { savelev } from '../js/save.js';
import { getlev } from '../js/restore.js';
import { flip_level } from '../js/sp_lev.js';
import { getRngLog } from '../js/rng.js';
import { ROOM, DOOR, D_ISOPEN, SHOPBASE, ROOMOFFSET, LEAVESTATUE, DIED } from '../js/const.js';

const input = { seed: 99812, datetime: '20000110090000', moves: ' ',
    nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n' };
const keeper = () => game.level.monsters.find(mon => mon.isshk);

async function setup(emptyLast = false) {
    const storage = new InMemoryStorage();
    const replay = await runSegment({ ...input, storage });
    replay._display.onEmptyQueue = () => 27;
    game._win_stop = false;
    game.level = new GameMap();
    game.timer_base = [];
    game.light_sources = [];
    game.regions = [];
    game.stairs = null;
    game.billobjs = [];
    const room = { lx: 20, hx: 24, ly: 8, hy: 12, rtype: SHOPBASE, rlit: 1,
        doorct: 0, fdoor: 0, nsubrooms: 0, sbrooms: [], resident: null, roomnoidx: 0 };
    game.level.rooms = [room, { hx: -1 }];
    game.level.nroom = 1;
    if (emptyLast) {
        game.level.rooms.splice(1, 0, { lx: 30, hx: 32, ly: 8, hy: 10,
            rtype: 0, rlit: 1, doorct: 0, fdoor: 0, nsubrooms: 0, sbrooms: [] });
        game.level.nroom = 2;
    }
    for (let x = 20; x <= 24; x++) {
        for (let y = 8; y <= 12; y++)
            Object.assign(game.level.at(x, y), { typ: ROOM, lit: true, roomno: ROOMOFFSET });
    }
    Object.assign(game.level.at(19, 10), { typ: DOOR, lit: true, doormask: D_ISOPEN,
        roomno: ROOMOFFSET, edge: true });
    game.level.flags.has_shop = 1;
    Object.assign(game.u, { ux: 23, uy: 10, ushops: String.fromCharCode(ROOMOFFSET),
        ushops0: '', urooms: String.fromCharCode(ROOMOFFSET), urooms0: '' });
    add_door(19, 10, room);
    await stock_room(0, room);
    assert.ok(keeper());
    return { storage, room };
}

async function loadBones() {
    game.u.ugrave_arise = LEAVESTATUE;
    await savebones(DIED, null, 947494800);
    game.level = new GameMap();
    game.wizard = false;
    assert.equal(await getbones_load(), true);
}

async function flip() {
    const rng = [...getRngLog()];
    const ext = get_level_extends();
    await flip_level(2, true);
    assert.deepEqual(getRngLog(), rng, 'unpunished flip consumes no RNG');
    return { x: ext.xmin + ext.xmax - 19, y: 10 };
}

function damageAt(point) {
    game.level.damagelist = [];
    const rng = [...getRngLog()];
    add_damage(point.x, point.y, 100);
    assert.deepEqual(getRngLog(), rng, 'damage registration consumes no RNG');
    return game.level.damagelist;
}

test('stock_room gives the shopkeeper a C value-copy door coordinate', async () => {
    await setup();
    assert.deepEqual(keeper().eshk.shd, game.level.doors[0]);
    assert.notStrictEqual(keeper().eshk.shd, game.level.doors[0]);
});

test('fresh active door and independent shop coordinate flip once and return', async () => {
    await setup();
    const expected = await flip();
    assert.deepEqual(game.level.doors[0], expected);
    assert.deepEqual(keeper().eshk.shd, expected);
    assert.equal(damageAt(expected).length, 1);
    await flip_level(2, true);
    assert.deepEqual(game.level.doors[0], { x: 19, y: 10 });
    assert.deepEqual(keeper().eshk.shd, { x: 19, y: 10 });
});

test('real bones load and flip retain damage scheduling for the entrance', async () => {
    await setup();
    await loadBones();
    assert.notStrictEqual(keeper().eshk.shd, game.level.doors[0]);
    assert.equal(damageAt({ x: 19, y: 10 }).length, 1);
    const expected = await flip();
    assert.equal(damageAt(expected).length, 1);
    assert.deepEqual(keeper().eshk.shd, expected);
});

test('inactive door tail stays fixed while its shopkeeper coordinate flips', async () => {
    await setup(true);
    await getlev(savelev(1));
    assert.equal(game.level.doorindex, 0);
    const original = { ...game.level.doors[0] };
    const expected = await flip();
    assert.deepEqual(game.level.doors[0], original);
    assert.deepEqual(keeper().eshk.shd, expected);
    assert.equal(damageAt(expected).length, 1);
});

test('bones inactive tail and value-copy entrance remain separate', async () => {
    await setup(true);
    await loadBones();
    assert.equal(game.level.doorindex, 0);
    const expected = await flip();
    assert.deepEqual(game.level.doors[0], { x: 19, y: 10 });
    assert.deepEqual(keeper().eshk.shd, expected);
    assert.equal(damageAt(expected).length, 1);
});

test('legacy JSON alias is detached by actual getlev without changing the record', async () => {
    await setup();
    const record = savelev(1);
    const savedKeeper = record.monsters.find(mon => mon.isshk);
    // Shape emitted by old shkinit: the graph codec retained this alias.
    savedKeeper.eshk.shd = record.doors[0];
    await getlev(record);
    assert.strictEqual(savedKeeper.eshk.shd, record.doors[0]);
    assert.notStrictEqual(keeper().eshk.shd, game.level.doors[0]);
    const expected = await flip();
    assert.deepEqual(keeper().eshk.shd, expected);
    assert.equal(damageAt(expected).length, 1);
});

test('restshk owns decoded coordinates even before a level number is installed', async () => {
    await setup();
    const shk = keeper();
    const eshk = shk.eshk;
    const bill = eshk.bill_p;
    const home = eshk.shoplevel;
    eshk.shd = game.level.doors[0];
    game.u.uz.dlevel = 0;
    const rng = [...getRngLog()];
    assert.equal(restshk(shk, false), undefined, 'restore helper remains synchronous');
    assert.notStrictEqual(eshk.shd, game.level.doors[0]);
    assert.deepEqual(eshk.shd, game.level.doors[0]);
    assert.strictEqual(eshk.bill_p, bill);
    assert.strictEqual(eshk.shoplevel, home);
    assert.deepEqual(getRngLog(), rng);
});

test('Flip_coord preserves zero markers and coordinates outside the flip area', async () => {
    await setup();
    game.level.doors.push({ x: 0, y: 0 }, { x: 70, y: 19 });
    game.level.doorindex += 2;
    await flip();
    assert.deepEqual(game.level.doors.slice(1), [{ x: 0, y: 0 }, { x: 70, y: 19 }]);
});

test('allocated tail capacity is not transformed', async () => {
    await setup();
    while (game.level.doors.length < 20)
        game.level.doors.push({ x: 0, y: 0 });
    const tail = structuredClone(game.level.doors.slice(1));
    await flip();
    assert.equal(game.level.doorindex, 1);
    assert.deepEqual(game.level.doors.slice(1), tail);
});

test('migrating shopkeeper follows the separate current-level C flip arm', async () => {
    await setup();
    const shk = keeper();
    // A detached migrating monster is not on fmon or the map grid.
    game.level.monsters = game.level.monsters.filter(mon => mon !== shk);
    game.level.monAt.delete(`${shk.mx},${shk.my}`);
    game.migrating_mons = [shk];
    const expected = await flip();
    assert.deepEqual(shk.eshk.shd, expected);
    assert.deepEqual(game.level.doors[0], expected);
});
