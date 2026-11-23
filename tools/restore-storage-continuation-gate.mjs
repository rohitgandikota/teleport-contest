#!/usr/bin/env node
// JSON adapter failure controls. All gameplay functions use normal imports.
// The only injected failure is the supplied Storage API's atomic final write.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { dosave0, gamestate_encode, gamestate_decode } from '../js/save.js';
import { moveloop_core } from '../js/allmain.js';
import { goto_level } from '../js/do.js';
import { mksobj, place_object, add_to_container, add_to_minv } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { setuwep } from '../js/wield.js';
import { makemon } from '../js/makemon.js';
import { make_engr_at } from '../js/engrave.js';
import { new_light_source, LS_OBJECT } from '../js/light.js';
import { start_timer, TIMER_OBJECT, HATCH_EGG } from '../js/timeout.js';
import { ONAMES as N } from '../js/objects_data.js';
import { PMNAMES as PM } from '../js/monst_data.js';
import { DUST, Is_airlevel, CLOUD, COLNO, ROWNO } from '../js/const.js';
import { getRngLog, rn2_on_display_rng } from '../js/rng.js';
import { __debug_arrays, vision_reset } from '../js/vision.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';

const input = {
    seed: 99812,
    datetime: '20000110090000',
    moves: ' ',
    nethackrc: 'OPTIONS=name:Desired,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
};
const hash = value => createHash('sha256').update(value).digest('hex');
const encoded = value => JSON.stringify(gamestate_encode(value));
const fixture = stem => JSON.parse(readFileSync(new URL(
    `./gen-sessions/generated/${stem}.session.json`, import.meta.url)));

function refusingStorage(name = 'QuotaExceededError') {
    const storage = new InMemoryStorage();
    const write = storage.setItem.bind(storage);
    const attempts = [];
    storage.setItem = (key, bytes) => {
        if (!key.startsWith('save:'))
            return write(key, bytes);
        attempts.push({ key, bytes, rng: [...getRngLog()] });
        const error = new Error('save storage refused');
        error.name = name;
        throw error;
    };
    return { storage, write, attempts };
}

function remember(records) {
    const copies = new Map(records.filter(Boolean).map(record => [record,
        Array.isArray(record) ? record.slice() : { ...record }]));
    return () => {
        for (const [record, before] of copies) {
            assert.deepEqual(Object.keys(record), Object.keys(before));
            for (const key of Object.keys(before))
                assert.equal(record[key], before[key], `original property ${key}`);
            if (Array.isArray(record))
                assert.equal(record.length, before.length);
        }
    };
}

function rngCheckpoint() {
    const contexts = [game.coreCtx, game.dispCtx];
    const arrays = contexts.map(context => context && [context.r, context.m]);
    const values = structuredClone(contexts);
    const log = getRngLog();
    const calls = [...log];
    return () => {
        assert.equal(game.coreCtx, contexts[0]);
        assert.equal(game.dispCtx, contexts[1]);
        for (const [index, context] of contexts.entries()) {
            if (!context)
                continue;
            assert.equal(context.r, arrays[index][0]);
            assert.equal(context.m, arrays[index][1]);
            assert.deepEqual(context, values[index]);
        }
        assert.equal(getRngLog(), log);
        assert.deepEqual(log, calls);
    };
}

function visionCheckpoint() {
    const arrays = __debug_arrays();
    const rows = Object.values(arrays).flat();
    const values = rows.map(row => row.slice());
    return () => {
        const after = Object.values(__debug_arrays()).flat();
        for (const [index, row] of rows.entries()) {
            assert.equal(after[index], row);
            assert.deepEqual(row, values[index]);
        }
    };
}

async function continueGame(replay, keys) {
    const boundary = replay.getScreens().length;
    const rngStart = getRngLog().length;
    for (const key of keys)
        replay._display.pushKey(key.charCodeAt(0));
    let exhausted = false;
    for (let turn = 0; turn < 512; turn++) {
        try {
            await moveloop_core();
        } catch (error) {
            if (!String(error?.message).includes('Input queue empty'))
                throw error;
            exhausted = true;
            break;
        }
    }
    assert.ok(exhausted, 'bounded ordinary continuation reached its final input boundary');
    assert.ok(!game.program_state_gameover && !game.program_state.gameover);
    return {
        screens: replay.getScreens().slice(boundary),
        cursors: replay.getCursors().slice(boundary),
        animations: replay.getAnimationFramesByStep().slice(boundary),
        calls: getRngLog().slice(rngStart),
        moves: game.moves,
        level: encoded(game.level),
        inventory: encoded(game.invent)
    };
}

function report(name, value, extra = {}) {
    console.log(JSON.stringify({ name, boundaries: value.screens.length,
        rngCalls: value.calls.length, continuationSha256: hash(JSON.stringify(value)),
        ...extra }));
}

async function currentOwners(refuse) {
    const fault = refusingStorage();
    const replay = await runSegment({ ...input, storage: fault.storage });
    const weapon = mksobj(N.DAGGER, false, false);
    await addinv(weapon);
    setuwep(weapon);
    const bag = mksobj(N.SACK, false, false);
    await addinv(bag);
    const food = mksobj(N.FOOD_RATION, false, false);
    await add_to_container(bag, food);
    const rock = mksobj(N.ROCK, false, false);
    await place_object(rock, game.u.ux, game.u.uy);
    const egg = mksobj(N.EGG, false, false);
    await place_object(egg, game.u.ux, game.u.uy);
    start_timer(100, TIMER_OBJECT, HATCH_EGG, egg);
    const lamp = mksobj(N.OIL_LAMP, false, false);
    await addinv(lamp);
    lamp.lamplit = 1;
    new_light_source(game.u.ux, game.u.uy, 2, LS_OBJECT, lamp.o_id);
    // A flash is removed by save_light_sources even when freeing nothing.
    new_light_source(game.u.ux, game.u.uy, 0, LS_OBJECT, 0);
    const monster = makemon(game.mons[PM.PM_GRID_BUG], 0, 0, 0);
    assert.ok(monster);
    const carried = mksobj(N.ROCK, false, false);
    await add_to_minv(monster, carried);
    monster.mtemplit = 1;
    const dead = makemon(game.mons[PM.PM_GRID_BUG], 0, 0, 0);
    assert.ok(dead);
    dead.mhp = 0;
    game.iflags.purge_monsters = 1;
    make_engr_at(game.u.ux, game.u.uy, 'Elbereth', 'Elbereth', game.moves, DUST);
    const engraving = game.level.lev_engr[0];
    engraving.engr_txt_offset = 2;
    engraving.engr_remembered_offset = 1;
    Object.assign(game.context.victual ||= {}, { piece: food, o_id: 0 });
    Object.assign(game.context.polearm ||= {}, { hitmon: monster, m_id: 0 });
    Object.assign(game.context.objsplit ||= {}, { parent_oid: rock.o_id, child_oid: egg.o_id });
    rn2_on_display_rng(2); // Both real context identities must survive.
    const level = game.level, inventory = game.invent, uz = game.u.uz;
    const timers = game.timer_base, lights = game.light_sources;
    const roots = [game.level, game.u, game.context, game.iflags,
        game.context.victual, game.context.polearm, game.context.objsplit,
        inventory, level.objects, level.monsters, timers, lights, engraving,
        weapon, bag, food, rock, egg, lamp, monster, carried, dead];
    const unchanged = remember(roots);
    const sameRng = rngCheckpoint();
    const sameVision = visionCheckpoint();
    if (refuse) {
        assert.equal(await dosave0(), false);
        assert.equal(fault.attempts.length, 1);
        assert.equal(game.level, level);
        assert.equal(game.invent, inventory);
        assert.equal(game.u.uz, uz);
        assert.equal(game.timer_base, timers);
        assert.equal(game.light_sources, lights);
        unchanged();
        sameRng();
        sameVision();
    }
    return continueGame(replay, ':i\u001b3.\u001b');
}

test('refused save keeps current owner identities and exact ordinary continuation', async () => {
    const control = await currentOwners(false);
    const failed = await currentOwners(true);
    assert.deepEqual(failed, control);
    report('current-owners', failed);
});

async function dormantKnife(refuse) {
    const part = fixture('restore-dormant-floor').segments[0];
    assert.ok(part.moves.endsWith('Sy'));
    const fault = refusingStorage();
    const replay = await runSegment({ ...part, moves: part.moves.slice(0, -2),
        storage: fault.storage });
    assert.deepEqual(game.u.uz, { dnum: 0, dlevel: 2 });
    const records = game.saved_levels;
    const dormant = records.get('0:1');
    const knife = dormant.objects.find(object => object.otyp === N.CRYSKNIFE);
    assert.ok(knife?.oerodeproof);
    const original = encoded(dormant);
    const sameRng = rngCheckpoint();
    const sameVision = visionCheckpoint();
    if (refuse) {
        const rngStart = getRngLog().length;
        assert.equal(await dosave0(), false);
        assert.equal(fault.attempts.length, 1);
        const attempt = fault.attempts[0];
        const rewritten = gamestate_decode(JSON.parse(attempt.bytes));
        const attemptedKnife = rewritten.saved_levels.get('0:1').objects
            .find(object => object.o_id === knife.o_id);
        assert.equal(attemptedKnife.otyp, N.WORM_TOOTH,
            'the refused write was reached after real dormant release processing');
        assert.deepEqual(attempt.rng.slice(rngStart), ['rn2(10)=0']);
        assert.equal(game.saved_levels, records);
        assert.equal(records.get('0:1'), dormant);
        assert.ok(dormant.objects.includes(knife));
        assert.equal(encoded(dormant), original);
        sameRng();
        sameVision();
    }
    return continueGame(replay, '\u00161\r\u001b\u001b:3.\u001b');
}

test('refused dormant rewrite restores RNG and the original knife before return', async () => {
    const control = await dormantKnife(false);
    const failed = await dormantKnife(true);
    assert.deepEqual(failed, control);
    report('dormant-knife', failed);
});

function cloudCells() {
    const cells = [];
    for (let y = 0; y < ROWNO; y++)
        for (let x = 1; x < COLNO; x++)
            if (game.level.at(x, y).typ === CLOUD)
                cells.push([x, y]);
    return cells;
}

async function airClouds(refuse) {
    const part = fixture('restore-air-clouds').segments[0];
    assert.ok(part.moves.endsWith('Sy'));
    const fault = refusingStorage();
    const replay = await runSegment({ ...part, moves: part.moves.slice(0, -2),
        storage: fault.storage });
    assert.ok(Is_airlevel(game.u.uz));
    const level = game.level, before = cloudCells();
    assert.ok(before.length > 0);
    const sameRng = rngCheckpoint();
    const sameVision = visionCheckpoint();
    if (refuse) {
        assert.equal(await dosave0(), false);
        assert.equal(fault.attempts.length, 1);
        const attempt = gamestate_decode(JSON.parse(fault.attempts[0].bytes));
        assert.ok(attempt.level._waterlevel.bubbles.length > 0);
        assert.equal(game.level, level);
        assert.deepEqual(cloudCells(), before);
        sameRng();
        sameVision();
    }
    const result = await continueGame(replay, '\u001b\u001b10.\u001b\u001b:');
    const after = cloudCells();
    assert.notDeepEqual(after, before, 'original clouds continue moving after refused save');
    return { ...result, clouds: after };
}

test('refused Air save keeps moving original clouds and exact continued play', async () => {
    const control = await airClouds(false);
    const failed = await airClouds(true);
    assert.deepEqual(failed, control);
    report('air-clouds', failed, { cloudCells: failed.clouds.length });
});

test('quota and disabled-storage refusals preserve a real prior save and allow retry', async () => {
    for (const name of ['QuotaExceededError', 'SecurityError']) {
        const source = new InMemoryStorage();
        await runSegment({ ...input, moves: ' Sy', storage: source });
        const key = `save:${game.plname}`;
        const prior = source.getItem(key);
        assert.ok(gamestate_decode(JSON.parse(prior))._save_version);
        const fault = refusingStorage(name);
        // Start the live game before installing the prior bytes, as a refused
        // final overwrite must not implicitly recover or delete that old save.
        const replay = await runSegment({ ...input, storage: fault.storage });
        fault.write(key, prior);
        fault.write('other:key', 'retained');
        const level = game.level, inventory = game.invent;
        assert.equal(await dosave0(), false);
        assert.equal(game.level, level);
        assert.equal(game.invent, inventory);
        assert.equal(fault.storage.getItem(key), prior);
        assert.equal(fault.storage.getItem('other:key'), 'retained');
        assert.equal(fault.attempts.length, 1);
        const continued = await continueGame(replay, ':i\u001b');
        fault.storage.setItem = fault.write;
        assert.equal(await dosave0(), true);
        assert.ok(gamestate_decode(JSON.parse(fault.storage.getItem(key)))._save_version);
        report('prior-save', continued, { error: name, previousSha256: hash(prior) });
    }
});

test('dormant boulder writes to private vision geometry are undone in place', async () => {
    const fault = refusingStorage();
    const replay = await runSegment({ ...input, storage: fault.storage });
    for (let key = 0; key < 4; key++)
        replay._display.pushKey(27); // Acknowledge any travel feedback.
    const x = game.u.ux, y = game.u.uy;
    await goto_level({ dnum: 0, dlevel: 2 }, false, false, false);
    const boulder = mksobj(N.BOULDER, false, false);
    await place_object(boulder, x, y);
    await goto_level({ dnum: 0, dlevel: 1 }, false, false, false);
    const current = game.level;
    vision_reset();
    const sameVision = visionCheckpoint();
    const clear = __debug_arrays().viz_clear;
    assert.equal(clear[y][x], 1);
    let blockedAtWrite = false;
    const refuse = fault.storage.setItem;
    fault.storage.setItem = (key, bytes) => {
        if (key.startsWith('save:'))
            blockedAtWrite = clear[y][x] === 0;
        return refuse(key, bytes);
    };
    assert.equal(await dosave0(), false);
    assert.ok(blockedAtWrite, 'real dormant placement changed the private live geometry');
    assert.equal(game.level, current);
    sameVision();
});

test('the ordinary save command reports refusal and continues the live game', async () => {
    const fault = refusingStorage();
    const replay = await runSegment({ ...input, storage: fault.storage });
    const dagger = mksobj(N.DAGGER, false, false);
    await addinv(dagger);
    const level = game.level, inventory = game.invent;
    const result = await continueGame(replay, 'Sy\u001b\u001b:i\u001b');
    assert.equal(fault.attempts.length, 1);
    assert.ok(result.screens.some(screen => decodeScreen(screen)[0]
        .includes('Cannot open save file.')));
    assert.equal(game.level, level);
    assert.equal(game.invent, inventory);
    assert.ok(game.invent.includes(dagger));
    assert.equal(game.program_state.saving, 0);
    report('save-command-refusal', result);
});

test('an encoding error is not caught as a storage refusal', async () => {
    const fault = refusingStorage();
    await runSegment({ ...input, storage: fault.storage });
    game.unencodableTestValue = 1n;
    await assert.rejects(dosave0(), TypeError);
    assert.equal(fault.attempts.length, 0, 'encoding failed before the Storage API was called');
    assert.equal(game.program_state.saving, 0);
});
