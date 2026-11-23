#!/usr/bin/env node
// C invent.c:960-1005: invocation awards follow flags and precede prize release.
// Normal imports and state observations only. No loader or replaced helpers.
import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { addinv_core1, addinv, freeinv, obj_extract_self } from '../js/invent.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { ONAMES } from '../js/objects_data.js';
import { getRngLog } from '../js/rng.js';
import {
    ACH_AMUL, ACH_CNDL, ACH_BELL, ACH_BOOK, ACH_MINE_PRIZE, ACH_SOKO_PRIZE,
    LL_ACHIEVE, LL_SPOILER, OBJ_FREE, OBJ_FLOOR, OBJ_INVENT, ROOM
} from '../js/const.js';

// Event text and flags: pinned C insight.c:57-64.
const cases = [
    ['AMULET_OF_YENDOR', 'amulet', ACH_AMUL, 'acquired The Amulet of Yendor'],
    ['CANDELABRUM_OF_INVOCATION', 'menorah', ACH_CNDL, 'acquired the Candelabrum of Invocation'],
    ['BELL_OF_OPENING', 'bell', ACH_BELL, 'acquired the Bell of Opening'],
    ['SPE_BOOK_OF_THE_DEAD', 'book', ACH_BOOK, 'acquired the Book of the Dead']
];
const emptyFlags = { amulet: 0, menorah: 0, bell: 0, book: 0 };
const results = [];

async function setup() {
    const replay = await runSegment({
        seed: 31,
        datetime: '20000112093000',
        moves: ' ',
        storage: new InMemoryStorage(),
        nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!tutorial,!tips,pettype:none,pauper,nudist,!autoquiver\n'
            + 'OPTIONS=suppress_alert:3.4.3\nOPTIONS=symset:DECgraphics\n'
    });
    replay._display.onEmptyQueue = () => {
        throw new Error('Invocation acquisition must not prompt for input');
    };
    game.invent = [];
    game.u.uquiver = null;
    game.u.uhave = { ...emptyFlags };
    game.u.uachieved = [];
    game.gamelog = [];
    game.moves = 123;
    game.context.achieveo = {
        mines_prize_oid: 0,
        mines_prize_otyp: ONAMES.LUCKSTONE,
        soko_prize_oid: 0,
        soko_prize_otyp: ONAMES.BAG_OF_HOLDING
    };
}

async function test(name, check) {
    try {
        await setup();
        check();
        results.push({ name, passed: true });
    } catch (error) {
        results.push({ name, passed: false, error: error.stack });
    }
}

function create(type) {
    const obj = mksobj(ONAMES[type], false, false);
    obj.quan = 1;
    return obj;
}

function noRng(action) {
    const before = [...getRngLog()];
    const result = action();
    assert.deepEqual(getRngLog(), before, 'acquisition consumes no RNG');
    return result;
}

function logEntry(text, flags = LL_ACHIEVE, turn = 123) {
    return { flags, turn, text };
}

// Observe actual property writes and array insertion without replacing game helpers.
function observe(obj, flag, kind) {
    const events = [];
    const idKey = kind + '_prize_oid';
    const record = (event, value) => events.push({
        event, value,
        flag: game.u.uhave[flag],
        id: game.context.achieveo[idKey],
        nomerge: obj.nomerge,
        where: obj.where,
        carried: game.invent.includes(obj)
    });
    const property = (target, key, event) => {
        let current = target[key];
        Object.defineProperty(target, key, {
            configurable: true,
            enumerable: true,
            get: () => current,
            set(value) {
                current = value;
                record(event, value);
            }
        });
    };
    const push = (array, event, valueOf) => {
        Object.defineProperty(array, 'push', {
            value(...values) {
                record(event, valueOf(values[0]));
                return Array.prototype.push.apply(this, values);
            }
        });
    };
    property(game.u.uhave, flag, 'flag');
    property(game.context.achieveo, idKey, 'prize-id');
    property(obj, 'nomerge', 'nomerge');
    property(obj, 'where', 'where');
    push(game.u.uachieved, 'achievement', value => value);
    push(game.gamelog, 'log', value => value.text);
    push(game.invent, 'inventory', value => value.o_id);
    return events;
}

for (const [type, flag, achievement, message] of cases) {
    await test(`${type}: synchronous flag and specific event before insertion`, () => {
        const obj = create(type);
        assert.equal(noRng(() => addinv_core1(obj)), null);
        assert.deepEqual(game.u.uhave, { ...emptyFlags, [flag]: 1 });
        assert.deepEqual(game.u.uachieved, [achievement]);
        assert.deepEqual(game.gamelog, [logEntry(message)]);
        assert.equal(obj.where, OBJ_FREE);
        assert.deepEqual(game.invent, []);
    });

    await test(`${type}: prior achievement is not duplicated or restamped`, () => {
        const obj = create(type);
        game.u.uachieved = [achievement];
        game.gamelog = [logEntry(message, LL_ACHIEVE, 7)];
        assert.equal(noRng(() => addinv(obj)), obj);
        assert.deepEqual(game.u.uhave, { ...emptyFlags, [flag]: 1 });
        assert.deepEqual(game.u.uachieved, [achievement]);
        assert.deepEqual(game.gamelog, [logEntry(message, LL_ACHIEVE, 7)]);
        assert.deepEqual(game.invent, [obj]);
    });

    await test(`${type}: drop and reacquire preserve a single achievement and event`, () => {
        const obj = create(type);
        assert.equal(noRng(() => addinv(obj)), obj);
        for (let repetition = 0; repetition < 2; repetition++) {
            noRng(() => {
                freeinv(obj);
                assert.deepEqual(game.u.uhave, emptyFlags);
                assert.equal(obj.where, OBJ_FREE);
                assert.deepEqual(game.invent, []);
                game.level.at(10, 10).typ = ROOM;
                place_object(obj, 10, 10);
                assert.equal(obj.where, OBJ_FLOOR);
                obj_extract_self(obj);
                assert.equal(obj.where, OBJ_FREE);
                game.moves++;
                assert.equal(addinv(obj), obj);
            });
            assert.deepEqual(game.u.uhave, { ...emptyFlags, [flag]: 1 });
            assert.deepEqual(game.u.uachieved, [achievement]);
            assert.deepEqual(game.gamelog, [logEntry(message)]);
            assert.equal(obj.where, OBJ_INVENT);
            assert.deepEqual(game.invent, [obj]);
        }
    });

    for (const [kind, prizeAchievement, prizeMessage] of [
        ['mines', ACH_MINE_PRIZE, "acquired the Mines' End luckstone"],
        ['soko', ACH_SOKO_PRIZE, 'acquired the Sokoban bag of holding']
    ]) {
        await test(`${type}: flag, invocation event, ${kind} tail, then insertion`, () => {
            const obj = create(type);
            game.context.achieveo[kind + '_prize_oid'] = obj.o_id;
            obj.nomerge = 1;
            const events = observe(obj, flag, kind);
            assert.equal(noRng(() => addinv(obj)), obj);
            assert.deepEqual(events.map(({ event, value }) => [event, value]), [
                ['flag', 1],
                ['achievement', achievement],
                ['log', message],
                ['achievement', prizeAchievement],
                ['log', prizeMessage],
                ['prize-id', 0],
                ['nomerge', 0],
                ['where', OBJ_INVENT],
                ['inventory', obj.o_id]
            ]);
            assert.ok(events.every(event => event.flag === 1 && !event.carried));
            assert.ok(events.slice(0, 5).every(event => event.id === obj.o_id && event.nomerge === 1));
            assert.ok(events.slice(0, 7).every(event => event.where === OBJ_FREE));
            assert.deepEqual(game.u.uhave, { ...emptyFlags, [flag]: 1 });
            assert.deepEqual(game.u.uachieved, [achievement, prizeAchievement]);
            assert.deepEqual(game.gamelog, [
                logEntry(message), logEntry(prizeMessage, LL_ACHIEVE | LL_SPOILER)
            ]);
            assert.equal(game.context.achieveo[kind + '_prize_oid'], 0);
            assert.equal(obj.nomerge, 0);
            assert.deepEqual(game.invent, [obj]);
        });
    }
}

await test('fake Amulet: no carrying flag or achievement', () => {
    const obj = create('FAKE_AMULET_OF_YENDOR');
    assert.equal(noRng(() => addinv_core1(obj)), null);
    assert.equal(noRng(() => addinv(obj)), obj);
    assert.deepEqual(game.u.uhave, emptyFlags);
    assert.deepEqual(game.u.uachieved, []);
    assert.deepEqual(game.gamelog, []);
    assert.deepEqual(game.invent, [obj]);
});

for (const fakeFirst of [true, false]) {
    await test(`true and fake Amulets: ${fakeFirst ? 'fake' : 'true'} acquired first`, () => {
        const real = create('AMULET_OF_YENDOR');
        const fake = create('FAKE_AMULET_OF_YENDOR');
        noRng(() => {
            for (const obj of fakeFirst ? [fake, real] : [real, fake]) {
                assert.equal(addinv(obj), obj);
                assert.equal(game.u.uhave.amulet, Number(game.invent.includes(real)));
                assert.equal(game.u.uachieved.length, Number(game.invent.includes(real)));
            }
            freeinv(fake);
            assert.equal(game.u.uhave.amulet, 1, 'dropping the fake leaves the real carrying flag');
            assert.equal(addinv(fake), fake);
            freeinv(real);
            assert.equal(game.u.uhave.amulet, 0, 'the fake does not retain the real carrying flag');
        });
        assert.deepEqual(game.u.uachieved, [ACH_AMUL]);
        assert.deepEqual(game.gamelog, [logEntry('acquired The Amulet of Yendor')]);
    });
}

console.log(JSON.stringify({
    passed: results.filter(result => result.passed).length,
    total: results.length,
    results
}, null, 4));
if (results.some(result => !result.passed)) {
    process.exitCode = 1;
}
