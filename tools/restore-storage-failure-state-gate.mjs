#!/usr/bin/env node
// Regression derived from the parent's verified v3 normal-import witness.
// Storage is an injected API dependency. Runtime helpers are not replaced.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { dosave0, gamestate_encode } from '../js/save.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { ONAMES } from '../js/objects_data.js';
import { getRngLog } from '../js/rng.js';

test('failed save storage preserves the live game and previous stored bytes', async () => {
    const storage = new InMemoryStorage();
    const write = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
        if (key.startsWith('save:')) {
            const error = new Error('quota exhausted');
            error.name = 'QuotaExceededError';
            throw error;
        }
        write(key, value);
    };
    await runSegment({
        seed: 99812,
        datetime: '20000110090000',
        moves: ' ',
        storage,
        nethackrc: 'OPTIONS=name:Desired,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
    });
    const held = mksobj(ONAMES.DAGGER, false, false);
    await addinv(held);
    const floor = mksobj(ONAMES.ROCK, false, false);
    await place_object(floor, game.u.ux, game.u.uy);
    const level = game.level;
    const inventory = game.invent;
    const before = [held, floor].map(object => ({ object,
        where: object.where, timed: object.timed, mask: object.owornmask,
        next: object.nexthere
    }));
    const key = `save:${game.plname}`;
    const previousSave = JSON.stringify(gamestate_encode(game));
    write(key, previousSave);
    const rng = [...getRngLog()];
    let result;
    let error;
    try {
        result = await dosave0();
    } catch (caught) {
        error = caught;
    }
    const unchangedItems = before.every(item => item.object.where === item.where
        && item.object.timed === item.timed && item.object.owornmask === item.mask
        && item.object.nexthere === item.next);
    console.log(JSON.stringify({ result, error: error?.message,
        levelSame: game.level === level, inventorySame: game.invent === inventory,
        inventoryBefore: 1, inventoryAfter: game.invent.length, unchangedItems,
        oldSaveUnchanged: storage.getItem(key) === previousSave }));
    assert.equal(error, undefined);
    assert.equal(result, false);
    assert.equal(game.level, level);
    assert.equal(game.invent, inventory);
    assert.ok(unchangedItems);
    assert.equal(game.level.objectAt(floor.ox, floor.oy), floor);
    assert.equal(storage.getItem(key), previousSave);
    assert.deepEqual(getRngLog(), rng);
});
