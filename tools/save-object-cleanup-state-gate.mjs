#!/usr/bin/env node
// Source-derived end.c:852/save.c:98 controls, using normal runtime imports.
// Constructed state is explicitly separate from ordinary-input/native evidence.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { GameMap } from '../js/game.js';
import * as end from '../js/end.js';
import * as restore from '../js/restore.js';
import { dosave0, dorecover, savelev, gamestate_encode, gamestate_decode } from '../js/save.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { addinv, obj_extract_self } from '../js/invent.js';
import { setuwep } from '../js/wield.js';
import { placebc, lift_covet_and_placebc, unplacebc_and_covet_placebc } from '../js/ball.js';
import { moveloop_core } from '../js/allmain.js';
import { wc_supported } from '../js/options.js';
import { addtobill, costly_spot, inside_shop, onbill } from '../js/shk.js';
import { pline } from '../js/display.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { start_timer, TIMER_OBJECT, HATCH_EGG } from '../js/timeout.js';
import { new_light_source, LS_OBJECT } from '../js/light.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { ONAMES as N } from '../js/objects_data.js';
import { ROOM, STONE, POOL, OBJ_FREE, OBJ_FLOOR, OBJ_INVENT, OBJ_DELETED,
    W_BALL, W_CHAIN, override_restriction } from '../js/const.js';

const input = {
    seed: 99812,
    datetime: '20000110090000',
    moves: ' ',
    nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
};
const encode = value => JSON.stringify(gamestate_encode(value));
const calls = () => getRngLog().map(call => call.replace(/\s*@.*$/, '').trim());

async function setup(storage = new InMemoryStorage(), constructed = true) {
    const replay = await runSegment({ ...input, storage });
    replay._display.onEmptyQueue = () => 27;
    game.program_state_gameover = false;
    game._win_stop = false;
    if (constructed) {
        game.level = new GameMap();
        for (let x = 20; x <= 40; x++) {
            for (let y = 5; y <= 15; y++)
                Object.assign(game.level.at(x, y), { typ: ROOM, lit: true });
        }
        Object.assign(game.u, { ux: 30, uy: 10, dx: 1, dy: 0,
            urooms: '', urooms0: '', ushops: '' });
        game.invent = [];
        game.saved_levels = new Map();
        game.timer_base = [];
        game.light_sources = [];
        game.stairs = null;
        game.regions = [];
        game.exclusion_zones = [];
        game.worms = { wheads: {}, wtails: {}, wgrowtime: {} };
    }
    return replay;
}

function seed(value = 7) {
    initRng(value);
    enableRngLog();
}

function object(type) {
    return mksobj(type, false, false);
}

function attached() {
    const ball = object(N.HEAVY_IRON_BALL);
    const chain = object(N.IRON_CHAIN);
    ball.owornmask = W_BALL;
    chain.owornmask = W_CHAIN;
    game.u.uball = ball;
    game.u.uchain = chain;
    return { ball, chain };
}

function floorOnce(obj, x = game.u.ux, y = game.u.uy) {
    assert.equal(obj.where, OBJ_FLOOR);
    assert.deepEqual([obj.ox, obj.oy], [x, y]);
    assert.equal(game.level.objects.filter(item => item === obj).length, 1);
    assert.equal(game.level.objectsAt(x, y).filter(item => item === obj).length, 1);
}

function saved() {
    return gamestate_decode(JSON.parse(game.storage.getItem(`save:${game.plname}`)));
}

async function cleanup() {
    assert.equal(typeof end.done_object_cleanup, 'function', 'shared C cleanup is exported');
    await end.done_object_cleanup();
}

for (const carried of [false, true]) {
    test(`ordinary save settles swallowed ${carried ? 'carried' : 'free'} ball and free chain`, async () => {
        await setup();
        const { ball, chain } = attached();
        if (carried)
            await addinv(ball);
        game.u.uswallow = 1;
        seed();
        assert.equal(await dosave0(), true);
        const record = saved();
        const floor = record.level.objects;
        assert.equal(floor.filter(obj => obj.o_id === chain.o_id).length, 1);
        assert.equal(floor.filter(obj => obj.o_id === ball.o_id).length, carried ? 0 : 1);
        assert.equal(record.u.uswallow, 1);
        assert.equal(record.invent.filter(obj => obj.o_id === ball.o_id).length, carried ? 1 : 0);
        assert.deepEqual(calls(), []);
        await dorecover();
        assert.equal(game.u.uball.o_id, ball.o_id);
        assert.equal(game.u.uchain.o_id, chain.o_id);
        floorOnce(game.u.uchain);
        if (carried) {
            assert.equal(game.u.uball.where, OBJ_INVENT);
            assert.ok(game.invent.includes(game.u.uball));
        } else {
            floorOnce(game.u.uball);
            assert.deepEqual(game.level.objectsAt(game.u.ux, game.u.uy),
                [game.u.uchain, game.u.uball]);
        }
    });
}

test('save consumes in-use items quietly before encoding the inventory', async () => {
    const replay = await setup();
    const consumed = object(N.SCR_IDENTIFY);
    const stack = object(N.APPLE);
    stack.quan = 3;
    const retained = object(N.DAGGER);
    for (const obj of [consumed, stack, retained])
        await addinv(obj);
    consumed.in_use = stack.in_use = true;
    const before = replay.getScreens().length;
    seed();
    assert.equal(await dosave0(), true);
    const inventory = saved().invent;
    assert.equal(inventory.some(obj => obj.o_id === consumed.o_id), false);
    assert.equal(inventory.find(obj => obj.o_id === stack.o_id).quan, 2);
    assert.equal(inventory.find(obj => obj.o_id === stack.o_id).in_use, false);
    assert.ok(inventory.some(obj => obj.o_id === retained.o_id));
    assert.equal(consumed.where, OBJ_DELETED);
    assert.doesNotMatch(replay.getScreens().slice(before).flatMap(decodeScreen).join('\n'),
        /Finishing off/);
    assert.deepEqual(calls(), []);
});

test('quiet cleanup removes worn, timer, light and consumption-context owners', async () => {
    await setup();
    const egg = object(N.EGG);
    await addinv(egg);
    setuwep(egg);
    egg.in_use = true;
    start_timer(100, TIMER_OBJECT, HATCH_EGG, egg);
    egg.lamplit = 1;
    new_light_source(game.u.ux, game.u.uy, 2, LS_OBJECT, egg.o_id);
    game.context.victual = { piece: egg, o_id: egg.o_id };
    game.context.tin = { tin: egg, o_id: egg.o_id };
    await cleanup();
    assert.equal(egg.where, OBJ_DELETED);
    assert.equal(game.u.uwep, null);
    assert.equal(game.context.victual.piece, undefined, 'food_disappears clears the victual record');
    assert.equal(game.context.tin.tin, null);
    assert.equal(game.timer_base.some(timer => timer.arg === egg), false);
    assert.equal(game.light_sources.some(light => light.id === egg.o_id), false);
});

test('restore cleanup keeps its audible default and processes each original inventory entry', async () => {
    await setup();
    const apple = object(N.APPLE);
    const pear = object(N.PEAR);
    apple.quan = 2;
    for (const obj of [apple, pear]) {
        await addinv(obj);
        obj.in_use = true;
    }
    assert.equal(typeof restore.inven_inuse, 'function');
    const original = game.invent.slice();
    await restore.inven_inuse();
    assert.equal(apple.quan, 1);
    assert.equal(apple.in_use, false);
    assert.equal(pear.where, OBJ_DELETED);
    const messages = [...(game._msg_history || []), game._toplines || ''].join('\n');
    assert.match(messages, /Finishing off apples/);
    assert.match(messages, /Finishing off pear/);
    assert.ok(messages.indexOf('Finishing off apples') < messages.indexOf('Finishing off pear'));
    assert.deepEqual(original.map(obj => obj.o_id), [apple.o_id, pear.o_id]);
});

test('free chain uses the override to lift an existing ball-placement restriction', async () => {
    await setup();
    const { ball, chain } = attached();
    await placebc();
    seed();
    const restriction = unplacebc_and_covet_placebc();
    assert.ok(restriction > 0);
    assert.equal(ball.where, OBJ_FREE);
    assert.equal(chain.where, OBJ_FREE);
    await placebc();
    assert.equal(chain.where, OBJ_FREE, 'ordinary placement is still restricted');
    const before = calls();
    game.u.uswallow = 1;
    try {
        await cleanup();
        floorOnce(ball);
        floorOnce(chain);
        assert.deepEqual(calls(), before, 'override placement needs no replacement restriction draw');
        game.u.uswallow = 0;
        obj_extract_self(ball);
        obj_extract_self(chain);
        await placebc();
        floorOnce(chain);
    } finally {
        // The unchanged before module lacks override cleanup. Release its
        // real private restriction so one expected failure cannot leak to the next test.
        if (chain.where === OBJ_FREE)
            await lift_covet_and_placebc(override_restriction);
        game.u.uswallow = 0;
    }
});

test('already-placed ball and chain retain both list orders without duplicate insertion', async () => {
    await setup();
    const { ball, chain } = attached();
    await placebc();
    const global = game.level.objects.slice();
    const local = game.level.objectsAt(game.u.ux, game.u.uy);
    seed();
    await cleanup();
    assert.deepEqual(game.level.objects, global);
    assert.deepEqual(game.level.objectsAt(game.u.ux, game.u.uy), local);
    floorOnce(ball);
    floorOnce(chain);
    assert.deepEqual(calls(), []);
});

for (const target of ['accessible', 'blocked', 'outside']) {
    test(`free projectile settlement uses C's ${target} target rule`, async () => {
        await setup();
        if (target === 'blocked')
            game.level.at(31, 10).typ = STONE;
        if (target === 'outside')
            Object.assign(game.u, { ux: 1, dx: -1 });
        const thrown = object(N.DAGGER);
        const kicked = object(N.ROCK);
        game.thrownobj = thrown;
        game.kickedobj = kicked;
        seed();
        await cleanup();
        const x = target === 'accessible' ? 31 : game.u.ux;
        floorOnce(thrown, x, game.u.uy);
        floorOnce(kicked, x, game.u.uy);
        assert.deepEqual(game.level.objectsAt(x, game.u.uy), [kicked, thrown]);
        assert.equal(game.thrownobj, null);
        assert.equal(game.kickedobj, null);
        assert.deepEqual(calls(), []);
    });
}

test('settlement stacks compatible thrown and kicked objects in C sequence', async () => {
    await setup();
    const bottom = object(N.ROCK);
    await place_object(bottom, 31, 10);
    const thrown = object(N.ROCK);
    const kicked = object(N.ROCK);
    game.thrownobj = thrown;
    game.kickedobj = kicked;
    await cleanup();
    // stackobj calls merged(&obj, &otmp): the incoming object survives.
    assert.equal(kicked.quan, 3);
    assert.deepEqual(game.level.objectsAt(31, 10), [kicked]);
    assert.equal(bottom.where, OBJ_DELETED);
    assert.equal(thrown.where, OBJ_DELETED);
    assert.equal(game.thrownobj, null);
    assert.equal(game.kickedobj, null);
});

test('non-free projectile owners are not extracted or cleared by cleanup', async () => {
    await setup();
    const thrown = object(N.DAGGER);
    const kicked = object(N.ROCK);
    await addinv(thrown);
    await place_object(kicked, 31, 10);
    game.thrownobj = thrown;
    game.kickedobj = kicked;
    await cleanup();
    assert.equal(game.thrownobj, thrown);
    assert.equal(game.kickedobj, kicked);
    assert.equal(thrown.where, OBJ_INVENT);
    floorOnce(kicked, 31, 10);
});

test('projectile cleanup bypasses floor damage but retains real held-object conversion', async () => {
    await setup();
    game.level.at(30, 10).typ = POOL;
    game.level.at(31, 10).typ = POOL;
    const paper = object(N.SCR_IDENTIFY);
    const knife = object(N.CRYSKNIFE);
    game.thrownobj = paper;
    game.kickedobj = knife;
    seed();
    await cleanup();
    floorOnce(paper, 30, 10);
    floorOnce(knife, 30, 10);
    assert.equal(paper.otyp, N.SCR_IDENTIFY);
    assert.equal(knife.otyp, N.WORM_TOOTH);
    assert.deepEqual(calls(), []);
});

test('unsupported persistent-inventory flag is cleared without inventing a window', async () => {
    await setup();
    assert.equal(wc_supported('perm_invent'), false);
    game.iflags.perm_invent = true;
    await cleanup();
    assert.equal(game.iflags.perm_invent, false);
});

function refusingStorage() {
    const storage = new InMemoryStorage();
    const write = storage.setItem.bind(storage);
    let attempts = 0;
    let attemptedBytes;
    storage.setItem = (key, value) => {
        if (!key.startsWith('save:'))
            return write(key, value);
        attempts++;
        attemptedBytes = value;
        throw new Error('test storage refusal');
    };
    return { storage, write, attempts: () => attempts, bytes: () => attemptedBytes };
}

async function continueGame(replay) {
    replay._display.onEmptyQueue = () => {
        throw new Error('Input queue empty - cleanup continuation complete');
    };
    const boundary = replay.getScreens().length;
    const start = getRngLog().length;
    for (const key of ':i\u001b3.\u001b')
        replay._display.pushKey(key.charCodeAt(0));
    let exhausted = false;
    for (let turn = 0; turn < 128; turn++) {
        try {
            await moveloop_core();
        } catch (error) {
            if (!String(error.message).includes('Input queue empty'))
                throw error;
            exhausted = true;
            break;
        }
    }
    assert.ok(exhausted);
    return { screens: replay.getScreens().slice(boundary),
        cursors: replay.getCursors().slice(boundary),
        calls: getRngLog().slice(start),
        level: encode(game.level), inventory: encode(game.invent), moves: game.moves };
}

async function failedCleanupContinuation(refuse) {
    const fault = refusingStorage();
    const replay = await setup(fault.storage, false);
    const { ball, chain } = attached();
    const level = game.level;
    const inventory = game.invent;
    const objects = level.objects;
    const key = `save:${game.plname}`;
    fault.write(key, 'original save bytes');
    const contexts = [game.coreCtx, game.dispCtx];
    const log = getRngLog();
    const before = calls();
    if (refuse) {
        assert.equal(await dosave0(), false);
        assert.equal(fault.attempts(), 1);
    } else {
        // Independent direct C cleanup branch; no call to the candidate helper.
        game.program_state.saving = (game.program_state.saving || 0) + 1;
        await lift_covet_and_placebc(override_restriction);
        game.program_state.saving--;
    }
    assert.equal(game.level, level);
    assert.equal(game.invent, inventory);
    assert.equal(game.level.objects, objects);
    assert.equal(game.u.uball, ball);
    assert.equal(game.u.uchain, chain);
    floorOnce(ball);
    floorOnce(chain);
    assert.equal(game.storage.getItem(key), 'original save bytes');
    assert.equal(game.coreCtx, contexts[0]);
    assert.equal(game.dispCtx, contexts[1]);
    assert.equal(getRngLog(), log);
    assert.deepEqual(calls(), before);
    assert.equal(game.program_state.saving, 0);
    return continueGame(replay);
}

test('refused save retains cleaned owners, prior save and exact no-save continuation', async () => {
    const expected = await failedCleanupContinuation(false);
    const actual = await failedCleanupContinuation(true);
    assert.deepEqual(actual, expected);
    console.log(JSON.stringify({ control: 'cleaned-live-continuation',
        boundaries: actual.screens.length, rngCalls: actual.calls.length }));
});

test('failed write preserves one completed in-use consumption and permits a retry', async () => {
    const fault = refusingStorage();
    await setup(fault.storage);
    const stack = object(N.APPLE);
    stack.quan = 3;
    await addinv(stack);
    stack.in_use = true;
    const inventory = game.invent;
    assert.equal(await dosave0(), false);
    assert.equal(game.invent, inventory);
    assert.equal(game.invent[0], stack);
    assert.equal(stack.quan, 2);
    assert.equal(stack.in_use, false);
    game.storage.setItem = fault.write;
    assert.equal(await dosave0(), true);
    assert.equal(saved().invent[0].quan, 2, 'retry must not consume another item');
});

test('refused save retains real cleanup RNG and rolls back later dormant-level RNG', async () => {
    const fault = refusingStorage();
    await setup(fault.storage);
    const current = game.level;
    game.level = new GameMap();
    const dormantKnife = object(N.CRYSKNIFE);
    dormantKnife.oerodeproof = 1;
    seed(7);
    await place_object(dormantKnife, 30, 10);
    assert.equal(dormantKnife.otyp, N.CRYSKNIFE);
    const dormant = savelev(2);
    game.level = current;
    game.saved_levels.set('0:2', dormant);
    const original = encode(dormant);
    const thrown = object(N.CRYSKNIFE);
    thrown.oerodeproof = 1;
    game.thrownobj = thrown;
    seed(5);
    assert.equal(await dosave0(), false);
    floorOnce(thrown, 31, 10);
    assert.equal(thrown.otyp, N.CRYSKNIFE);
    assert.equal(game.thrownobj, null);
    assert.deepEqual(calls(), ['rn2(10)=4']);
    assert.equal(game.saved_levels.get('0:2'), dormant);
    assert.equal(encode(dormant), original);
    const attempted = gamestate_decode(JSON.parse(fault.bytes()));
    assert.equal(attempted.saved_levels.get('0:2').objects[0].otyp, N.WORM_TOOTH,
        'the later real placement ran before storage refused');
});

test('save waits for actual unpaid projectile feedback before cleanup and encoding', async () => {
    const shop = JSON.parse(readFileSync(new URL(
        './gen-sessions/recipes/shop-normal.json', import.meta.url))).segments[0];
    const storage = new InMemoryStorage();
    const replay = await runSegment({ ...shop, storage });
    replay._display.onEmptyQueue = () => 32;
    game.program_state_gameover = false;
    game._win_stop = false;
    const keeper = game.level.monsters.find(mon => mon.isshk && mon.mhp > 0);
    assert.ok(keeper);
    let position;
    for (let x = 1; x < 79 && !position; x++) {
        for (let y = 0; y < 21; y++) {
            if (costly_spot(x, y)) {
                position = { x, y };
                break;
            }
        }
    }
    assert.ok(position);
    Object.assign(game.u, { ux: position.x, uy: position.y, dx: 0, dy: 0,
        ushops: String.fromCharCode(inside_shop(position.x, position.y)) });
    const knife = object(N.CRYSKNIFE);
    Object.assign(knife, { ox: 7, oy: 8 });
    await addtobill(knife, false, false, true);
    assert.equal(knife.unpaid, 1);
    game.thrownobj = knife;
    const bill = { ...onbill(knife, keeper, false) };
    await pline('A message that needs acknowledgement before the shopkeeper can speak.');
    let entered = false;
    let release;
    replay._display.onEmptyQueue = () => {
        entered = true;
        return new Promise(resolve => { release = resolve; });
    };
    const key = `save:${game.plname}`;
    const pending = dosave0();
    try {
        await new Promise(resolve => setImmediate(resolve));
        assert.ok(entered, 'real TTY input is pending');
        assert.equal(knife.where, OBJ_FREE);
        assert.equal(knife.otyp, N.CRYSKNIFE);
        assert.deepEqual([knife.ox, knife.oy], [7, 8]);
        assert.equal(game.thrownobj, knife);
        assert.deepEqual(onbill(knife, keeper, false), bill);
        assert.equal(storage.getItem(key), null);
    } finally {
        replay._display.onEmptyQueue = () => 32;
        release?.(32);
        await pending;
    }
    const record = saved();
    const settled = record.level.objects.find(obj => obj.o_id === knife.o_id);
    assert.ok(settled);
    assert.equal(settled.otyp, N.WORM_TOOTH);
    assert.equal(settled.unpaid, 0);
    assert.deepEqual([settled.ox, settled.oy], [position.x, position.y]);
    assert.ok(record.level._saved_billobjs.some(obj => obj.otyp === N.CRYSKNIFE));
});
