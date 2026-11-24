#!/usr/bin/env node
// Constructed source-contract controls through real save/load/detection helpers.
// These are normal JS imports, not native recordings or replacement functions.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { GameMap } from '../js/game.js';
import { savelev, dosave0 } from '../js/save.js';
import { getlev } from '../js/restore.js';
import { savebones, getbones_load } from '../js/bones.js';
import { add_door } from '../js/mklev.js';
import { trap_detect } from '../js/detect.js';
import { vision_reset } from '../js/vision.js';
import { getRngLog } from '../js/rng.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { ROOM, DOOR, SDOOR, D_CLOSED, D_TRAPPED, LEAVESTATUE, DIED } from '../js/const.js';

const input = {
    seed: 99812,
    datetime: '20000110090000',
    moves: ' ',
    nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
};

function room() {
    return { lx: 20, hx: 40, ly: 5, hy: 15, rtype: 0, rlit: 1,
        doorct: 0, fdoor: 0, nsubrooms: 0, sbrooms: [], resident: null };
}

async function setup() {
    const storage = new InMemoryStorage();
    const replay = await runSegment({ ...input, storage });
    const screens = [];
    replay._display.onEmptyQueue = () => {
        screens.push(decodeScreen(replay._display.terminal.serialize()));
        return 27;
    };
    game._win_stop = false;
    game.program_state_gameover = false;
    game.level = new GameMap();
    for (let x = 20; x <= 40; x++) {
        for (let y = 5; y <= 15; y++)
            Object.assign(game.level.at(x, y), { typ: ROOM, lit: true });
    }
    Object.assign(game.u, { ux: 30, uy: 10, dx: 0, dy: 0,
        urooms: '', urooms0: '', ushops: '', ushops0: '' });
    game.level.rooms = [room(), { hx: -1 }];
    game.level.nroom = 1;
    game.level.subrooms = [];
    game.level.nsubroom = 0;
    game.invent = [];
    game.timer_base = [];
    game.light_sources = [];
    game.regions = [];
    game.max_regions = 0;
    game.billobjs = [];
    game.stairs = null;
    game.saved_levels = new Map();
    vision_reset();
    return { storage, screens };
}

function door(owner, x, trapped = false, type = DOOR) {
    Object.assign(game.level.at(x, 8), {
        typ: type, doormask: D_CLOSED | (trapped ? D_TRAPPED : 0)
    });
    add_door(x, 8, owner);
}

function subroomTail(trapTail = true) {
    const main = game.level.rooms[0];
    door(main, 22);
    const sub = room();
    sub.fdoor = game.level.doorindex;
    main.sbrooms.push(sub);
    main.nsubrooms = 1;
    game.level.subrooms.push(sub);
    game.level.nsubroom = 1;
    door(sub, 25, trapTail);
    assert.equal(game.level.doorindex, 2);
    assert.equal(main.fdoor + main.doorct, 1);
}

async function detect() {
    const before = [...getRngLog()];
    const result = await trap_detect(null);
    assert.deepEqual(getRngLog(), before, 'ordinary unconfused detection consumes no RNG');
    return result;
}

async function reload() {
    const saved = savelev(1);
    const before = JSON.stringify(saved);
    await getlev(saved);
    assert.equal(JSON.stringify(saved), before, 'getlev retains the original record');
    return saved;
}

test('ordinary load derives active count from the last main room, not subroom tail', async () => {
    await setup();
    subroomTail();
    const saved = await reload();
    assert.equal(saved.doorindex, 2, 'real add_door produced both entries');
    assert.equal(game.level.doors.length, 2);
    assert.equal(game.level.doorindex, 1);
});

test('ordinary load excludes a trapped subroom tail from real trap detection', async () => {
    await setup();
    subroomTail();
    await reload();
    assert.equal(await detect(), 1);
});

test('ordinary load retains an active trapped main-room door in the detection map', async () => {
    const { screens } = await setup();
    door(game.level.rooms[0], 22, true);
    await reload();
    assert.equal(await detect(), 0);
    assert.ok(screens.some(rows => rows[9][21] === '^'));
});

test('saved array capacity is preserved without becoming the active count', async () => {
    await setup();
    door(game.level.rooms[0], 22);
    // C alloc_doors grows capacity in blocks of DOORINC=20 and zero-fills it.
    while (game.level.doors.length < 20)
        game.level.doors.push({ x: 0, y: 0 });
    await reload();
    assert.equal(game.level.doors.length, 20);
    assert.equal(game.level.doorindex, 1);
    assert.equal(await detect(), 1);
});

test('last empty main room follows its own endpoint rather than the maximum', async () => {
    await setup();
    const empty = room();
    game.level.rooms.splice(1, 0, empty);
    game.level.nroom = 2;
    door(game.level.rooms[0], 22, true);
    assert.equal(empty.fdoor + empty.doorct, 0);
    await reload();
    assert.equal(game.level.doorindex, 0);
    assert.equal(await detect(), 1);
});

test('no-room load uses zero even when serialized JSON contains a stale count', async () => {
    await setup();
    game.level.rooms = [{ hx: -1 }];
    game.level.nroom = 0;
    game.level.doorindex = 17;
    await reload();
    assert.equal(game.level.doorindex, 0);
});

test('secret door flags are excluded by the actual trap consumer', async () => {
    await setup();
    door(game.level.rooms[0], 22, true, SDOOR);
    await reload();
    assert.equal(game.level.doorindex, 1);
    assert.equal(await detect(), 1);
});

test('full save and fresh-process resume rebuild the same main-room endpoint', async () => {
    const { storage } = await setup();
    subroomTail();
    assert.equal(await dosave0(), true);
    const replay = await runSegment({ ...input, seed: 7, moves: ' n\u001b\u001b', storage });
    replay._display.onEmptyQueue = () => 27;
    assert.equal(game.program_state.restoring, 0);
    assert.equal(game.level.doorindex, 1);
    assert.equal(game.level.doors.length, 2);
    assert.equal(await detect(), 1);
});

test('real bones save/load rebuilds the active owner and detects the trapped door', async () => {
    const { storage, screens } = await setup();
    door(game.level.rooms[0], 22, true);
    game.u.ugrave_arise = LEAVESTATUE;
    await savebones(DIED, null, 947494800);
    const key = `bones:${game.u.uz.dnum}.${game.u.uz.dlevel}`;
    const bytes = storage.getItem(key);
    const snapshot = JSON.parse(bytes);
    assert.equal(Object.hasOwn(snapshot, 'doorindex'), false);
    game.level = new GameMap();
    game.u.ux = 30;
    game.u.uy = 10;
    game.wizard = false;
    assert.equal(await getbones_load(), true);
    assert.equal(await detect(), 0);
    assert.ok(screens.some(rows => rows[9][21] === '^'));
    assert.equal(game.level.doorindex, 1);
});
