#!/usr/bin/env node
// decl.c:458/1096 and decl.h:536: lastinvnr is process state.
// Normal runtime imports; legacy JSON fields below exist only in memory.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { game, resetGame } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { mksobj } from '../js/mkobj.js';
import { addinv, useupall } from '../js/invent.js';
import { dosave0, gamestate_decode } from '../js/save.js';
import { getRngLog } from '../js/rng.js';
import { ONAMES as N } from '../js/objects_data.js';

const input = {
    seed: 99812,
    datetime: '20000110090000',
    moves: ' ',
    nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
};

async function setup() {
    const storage = new InMemoryStorage();
    const replay = await runSegment({ ...input, storage });
    replay._display.onEmptyQueue = () => 27;
    game._win_stop = false;
    assert.equal((game.invent || []).length, 0);
    return storage;
}

async function acquire(type = N.DAGGER) {
    const obj = mksobj(type, false, false);
    obj.nomerge = 1;
    const log = [...getRngLog()];
    assert.equal(await addinv(obj), obj);
    assert.deepEqual(getRngLog(), log, 'ordinary inventory assignment consumes no RNG');
    return obj;
}

async function save(storage, legacyCounter) {
    assert.equal(await dosave0(), true);
    const encoded = JSON.parse(storage.getItem('save:wizard'));
    if (legacyCounter !== undefined) {
        // This models old JSON saves which incorrectly included the process
        // counter. No recorded input, native output or frozen save is edited.
        encoded.$o.lastinvnr = legacyCounter;
        storage.setItem('save:wizard', JSON.stringify(encoded));
        assert.equal(gamestate_decode(encoded).lastinvnr, legacyCounter);
    }
    return encoded;
}

async function resume(storage) {
    const replay = await runSegment({ ...input, seed: 7, moves: ' n\u001b\u001b', storage });
    replay._display.onEmptyQueue = () => 27;
    assert.equal(game.program_state.restoring, 0);
    return replay;
}

test('process reset installs C initial counter 51 and discards the old process record', () => {
    const old = resetGame();
    assert.equal(old.lastinvnr, 51);
    old.lastinvnr = 12;
    const fresh = resetGame();
    assert.notEqual(fresh, old);
    assert.equal(fresh, game);
    assert.equal(fresh.lastinvnr, 51);
});

test('ordinary removal retains the rolling counter within the same process', async () => {
    await setup();
    const first = await acquire();
    const second = await acquire(N.APPLE);
    assert.deepEqual([first.invlet, second.invlet], ['a', 'b']);
    await useupall(first);
    const third = await acquire(N.ROCK);
    assert.equal(third.invlet, 'c');
});

test('new save omits a counter left by a consumed item', async () => {
    const storage = await setup();
    const obj = await acquire();
    await useupall(obj);
    assert.equal(game.lastinvnr, 0);
    const encoded = await save(storage);
    assert.equal(Object.hasOwn(encoded.$o, 'lastinvnr'), false);
    assert.equal(Object.hasOwn(gamestate_decode(encoded), 'lastinvnr'), false);
});

test('fresh resume with empty inventory gives the next item slot a', async () => {
    const storage = await setup();
    const obj = await acquire();
    await useupall(obj);
    await save(storage);
    await resume(storage);
    assert.deepEqual(game.invent, []);
    assert.equal(game.lastinvnr, 51);
    assert.equal((await acquire(N.POT_OBJECT_DETECTION)).invlet, 'a');
});

test('fresh resume preserves saved a/c slots and assigns a new item the free b slot', async () => {
    const storage = await setup();
    const first = await acquire();
    const removed = await acquire(N.APPLE);
    const third = await acquire(N.ROCK);
    await useupall(removed);
    const expected = game.invent.map(obj => [obj.o_id, obj.invlet]);
    assert.deepEqual(expected, [[first.o_id, 'a'], [third.o_id, 'c']]);
    await save(storage);
    await resume(storage);
    assert.deepEqual(game.invent.map(obj => [obj.o_id, obj.invlet]), expected);
    assert.equal((await acquire(N.PEAR)).invlet, 'b');
});

for (const counter of [0, 25, 51]) {
    test(`legacy saved counter ${counter} is ignored at fresh process restore`, async () => {
        const storage = await setup();
        await save(storage, counter);
        await resume(storage);
        assert.equal(game.lastinvnr, 51);
        assert.equal((await acquire()).invlet, 'a');
    });
}

test('fresh resume of a full inventory terminates and assigns the overflow marker', async () => {
    const storage = await setup();
    for (let i = 0; i < 52; i++)
        await acquire();
    assert.equal(game.lastinvnr, 51);
    const slots = game.invent.map(obj => obj.invlet);
    assert.equal(new Set(slots).size, 52);
    await save(storage);
    await resume(storage);
    assert.equal(game.lastinvnr, 51, 'full-inventory traversal starts from a valid C index');
    assert.deepEqual(game.invent.map(obj => obj.invlet), slots);
    assert.equal((await acquire()).invlet, '#');
});

test('storage refusal preserves the current process counter and next allocation', async () => {
    const storage = await setup();
    const first = await acquire();
    await useupall(first);
    const inventory = game.invent;
    const write = storage.setItem.bind(storage);
    write('save:wizard', 'prior save');
    storage.setItem = (key, value) => {
        if (key.startsWith('save:'))
            throw new Error('storage refused');
        return write(key, value);
    };
    const log = [...getRngLog()];
    assert.equal(await dosave0(), false);
    assert.equal(game.lastinvnr, 0);
    assert.equal(game.invent, inventory);
    assert.equal(storage.getItem('save:wizard'), 'prior save');
    assert.deepEqual(getRngLog(), log);
    assert.equal((await acquire()).invlet, 'b');
});
