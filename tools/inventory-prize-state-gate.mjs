#!/usr/bin/env node
// C invent.c:960-1005 addinv_core1: carrying effects, then prize release.
// Normal imports only. No loader, private exports or replacement helpers.
import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { addinv_core1, addinv, freeinv, obj_extract_self } from '../js/invent.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { is_mines_prize, is_soko_prize } from '../js/obj.js';
import { ONAMES } from '../js/objects_data.js';
import { ART_ORB_OF_DETECTION, ART_EYE_OF_THE_AETHIOPICA, artifact_otyps } from '../js/artilist_data.js';
import { ACH_MINE_PRIZE, ACH_SOKO_PRIZE, OBJ_INVENT, OBJ_FREE, ROOM, W_ART } from '../js/const.js';
import { getRngLog } from '../js/rng.js';

const results = [];
let display;
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
    display = replay._display;
    display.onEmptyQueue = () => 32;
    game.invent = [];
    game.u.uquiver = null;
    game.u.uhave = {};
    game.u.uachieved = [];
    game.gamelog = [];
    game.quest_status = {};
    game.context.achieveo = {
        mines_prize_oid: 0,
        mines_prize_otyp: ONAMES.LUCKSTONE,
        soko_prize_oid: 0,
        soko_prize_otyp: ONAMES.BAG_OF_HOLDING
    };
}

async function test(name, fn) {
    try {
        await setup();
        await fn();
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

function mark(obj, kind = 'mines', type = obj.otyp) {
    game.context.achieveo[kind + '_prize_oid'] = obj.o_id;
    game.context.achieveo[kind + '_prize_otyp'] = type;
    obj.nomerge = 1;
    return obj;
}

function released(obj, kind = 'mines') {
    assert.equal(game.context.achieveo[kind + '_prize_oid'], 0);
    assert.equal(obj.nomerge, 0);
    assert.ok(game.u.uachieved.includes(kind === 'mines' ? ACH_MINE_PRIZE : ACH_SOKO_PRIZE));
    assert.equal(kind === 'mines' ? is_mines_prize(obj) : is_soko_prize(obj), false);
}

function observe(obj, kind = 'mines') {
    const events = [];
    const record = (event, value) => events.push({
        event, value,
        id: game.context.achieveo[kind + '_prize_oid'],
        nomerge: obj.nomerge,
        questart: game.u.uhave.questart || 0,
        touched: !!game.quest_status.touched_artifact,
        antimagic: !!((game.u.uprops?.ANTIMAGIC || 0) & W_ART),
        halfSpellDamage: !!((game.u.uprops?.HALF_SPDAM || 0) & W_ART),
        carried: game.invent.includes(obj)
    });
    const achievements = game.u.uachieved;
    Object.defineProperty(achievements, 'push', {
        value(...values) {
            record('achievement', values[0]);
            return Array.prototype.push.apply(this, values);
        }
    });
    const log = game.gamelog;
    Object.defineProperty(log, 'push', {
        value(...values) {
            record('log', values[0].text);
            return Array.prototype.push.apply(this, values);
        }
    });
    let id = game.context.achieveo[kind + '_prize_oid'];
    Object.defineProperty(game.context.achieveo, kind + '_prize_oid', {
        configurable: true,
        enumerable: true,
        get: () => id,
        set(value) {
            record('id', value);
            id = value;
        }
    });
    let nomerge = obj.nomerge;
    Object.defineProperty(obj, 'nomerge', {
        configurable: true,
        enumerable: true,
        get: () => nomerge,
        set(value) {
            record('nomerge', value);
            nomerge = value;
        }
    });
    return events;
}

await test('ordinary acquisition stays synchronous and does not fabricate prize state', () => {
    const obj = create('LUCKSTONE');
    delete game.context.achieveo;
    const rng = [...getRngLog()];
    assert.equal(addinv_core1(obj), null);
    assert.equal(game.context.achieveo, undefined);
    assert.deepEqual(game.u.uachieved, []);
    assert.deepEqual(getRngLog(), rng);
});

for (const [kind, type, message] of [
    ['mines', 'LUCKSTONE', "acquired the Mines' End luckstone"],
    ['soko', 'BAG_OF_HOLDING', 'acquired the Sokoban bag of holding'],
    ['soko', 'AMULET_OF_REFLECTION', 'acquired the Sokoban amulet of reflection']
]) {
    await test(`${kind}/${type}: synchronous release and chronicle`, () => {
        const obj = mark(create(type), kind);
        const rng = [...getRngLog()];
        assert.equal(addinv_core1(obj), null);
        released(obj, kind);
        assert.equal(game.context.achieveo[kind + '_prize_otyp'], ONAMES[type]);
        assert.deepEqual(game.gamelog.map(entry => entry.text), [message]);
        assert.equal(obj.where, OBJ_FREE, 'core1 precedes inventory insertion');
        assert.deepEqual(getRngLog(), rng, 'the prize tail consumes no RNG');
    });
}

for (const [kind, type] of [['mines', 'LUCKSTONE'], ['soko', 'BAG_OF_HOLDING']]) {
    await test(`${kind}: a lookalike with another ID keeps its own merge flag`, () => {
        const prize = mark(create(type), kind);
        const lookalike = create(type);
        lookalike.nomerge = 1;
        assert.equal(addinv_core1(lookalike), null);
        assert.equal(game.context.achieveo[kind + '_prize_oid'], prize.o_id);
        assert.equal(lookalike.nomerge, 1);
        assert.equal(prize.nomerge, 1);
        assert.deepEqual(game.u.uachieved, []);
        assert.deepEqual(game.gamelog, []);
    });
}

await test('achievement and chronicle precede ID clear, which precedes nomerge clear', () => {
    const obj = mark(create('LUCKSTONE'));
    const events = observe(obj);
    assert.equal(addinv_core1(obj), null);
    assert.deepEqual(events.map(e => e.event), ['achievement', 'log', 'id', 'nomerge']);
    assert.deepEqual(events.map(e => e.id), [obj.o_id, obj.o_id, obj.o_id, 0]);
    assert.deepEqual(events.map(e => e.nomerge), [1, 1, 1, 1]);
    assert.equal(events[0].value, ACH_MINE_PRIZE);
    assert.equal(events[2].value, 0);
    assert.equal(events[3].value, 0);
    assert.ok(events.every(e => !e.carried));
    released(obj);
});

await test('identity is authoritative and chronicle uses the stored prize type', () => {
    const obj = mark(create('ROCK'), 'mines', ONAMES.LUCKSTONE);
    assert.equal(addinv_core1(obj), null);
    released(obj);
    assert.equal(game.gamelog[0].text, "acquired the Mines' End luckstone");
});

await test('Mines wins if both IDs match; a second call can release Sokoban', () => {
    const obj = mark(create('LUCKSTONE'));
    mark(obj, 'soko', ONAMES.BAG_OF_HOLDING);
    assert.equal(addinv_core1(obj), null);
    assert.deepEqual(game.u.uachieved, [ACH_MINE_PRIZE]);
    assert.equal(game.context.achieveo.soko_prize_oid, obj.o_id);
    assert.equal(addinv_core1(obj), null);
    assert.deepEqual(game.u.uachieved, [ACH_MINE_PRIZE, ACH_SOKO_PRIZE]);
    assert.equal(game.context.achieveo.soko_prize_oid, 0);
});

await test('an already recorded achievement still releases ID and merge protection', () => {
    const obj = mark(create('LUCKSTONE'));
    game.u.uachieved = [ACH_MINE_PRIZE];
    assert.equal(addinv_core1(obj), null);
    released(obj);
    assert.deepEqual(game.u.uachieved, [ACH_MINE_PRIZE]);
    assert.deepEqual(game.gamelog, []);
});

await test('gameover suppresses the chronicle but still records and releases the prize', () => {
    const obj = mark(create('BAG_OF_HOLDING'), 'soko');
    game.program_state_gameover = true;
    assert.equal(addinv_core1(obj), null);
    released(obj, 'soko');
    assert.deepEqual(game.gamelog, []);
});

for (const [type, flag] of [
    ['GOLD_PIECE', null],
    ['AMULET_OF_YENDOR', 'amulet'],
    ['CANDELABRUM_OF_INVOCATION', 'menorah'],
    ['BELL_OF_OPENING', 'bell'],
    ['SPE_BOOK_OF_THE_DEAD', 'book']
]) {
    for (const tagged of [false, true]) {
        await test(`${type}: ${tagged ? 'shared prize tail' : 'existing synchronous carrying effect'}`, () => {
            const obj = create(type);
            if (tagged) {
                mark(obj, 'mines', ONAMES.LUCKSTONE);
            }
            game.disp.botl = false;
            assert.equal(addinv_core1(obj), null);
            if (flag) {
                assert.equal(game.u.uhave[flag], 1);
            } else {
                assert.equal(game.disp.botl, true);
            }
            if (tagged) {
                released(obj);
            }
            // Invocation-object achievement calls are a separate source gap.
            // These controls preserve carrying flags without encoding that gap.
        });
    }
}

for (const quivered of [false, true]) {
    await test(`incoming prize clears protection before ${quivered ? 'quiver' : 'inventory'} merge`, () => {
        const ordinary = create('LUCKSTONE');
        assert.equal(addinv(ordinary), ordinary);
        if (quivered) {
            game.u.uquiver = ordinary;
        }
        const prize = mark(create('LUCKSTONE'));
        const result = addinv(prize);
        assert.equal(result, ordinary, 'addinv keeps its synchronous merge result');
        assert.equal(ordinary.quan, 2);
        assert.equal(game.invent.length, 1);
        assert.equal(game.context.achieveo.mines_prize_oid, 0);
        assert.equal(prize.nomerge, 0);
        assert.ok(game.u.uachieved.includes(ACH_MINE_PRIZE));
    });
}

await test('a later ordinary luckstone merges into the already acquired prize', () => {
    const prize = mark(create('LUCKSTONE'));
    assert.equal(addinv(prize), prize);
    const ordinary = create('LUCKSTONE');
    assert.equal(addinv(ordinary), prize);
    assert.equal(prize.quan, 2);
    assert.deepEqual(game.invent, [prize]);
    released(prize);
});

await test('drop and reacquire do not restore prize identity or duplicate its event', () => {
    const prize = mark(create('LUCKSTONE'));
    assert.equal(addinv(prize), prize);
    freeinv(prize);
    game.level.at(10, 10).typ = ROOM;
    place_object(prize, 10, 10);
    assert.equal(is_mines_prize(prize), false, 'monster prize predicates no longer protect it');
    obj_extract_self(prize);
    assert.equal(addinv(prize), prize);
    assert.deepEqual(game.u.uachieved, [ACH_MINE_PRIZE]);
    assert.equal(game.gamelog.length, 1);
});

await test('non-quest artifact keeps its promise and releases only after carry intrinsics', async () => {
    const obj = mark(create(artifact_otyps[ART_ORB_OF_DETECTION]));
    obj.oartifact = ART_ORB_OF_DETECTION;
    const events = observe(obj);
    const pending = addinv_core1(obj);
    assert.ok(pending instanceof Promise);
    assert.equal(obj.nomerge, 1);
    assert.equal(game.context.achieveo.mines_prize_oid, obj.o_id);
    assert.equal(await pending, undefined, 'artifact promise resolution is unchanged');
    released(obj);
    assert.equal(events[0].antimagic, true);
    assert.equal(game.u.uhave.questart, undefined);
});

for (const insertion of [false, true]) {
    await test(`quest artifact ${insertion ? 'addinv' : 'core1'} awaits text before prize release`, async () => {
        const obj = mark(create(artifact_otyps[ART_EYE_OF_THE_AETHIOPICA]), 'soko', ONAMES.AMULET_OF_REFLECTION);
        obj.oartifact = ART_EYE_OF_THE_AETHIOPICA;
        assert.equal(game.urole.questarti, obj.oartifact);
        const events = observe(obj, 'soko');
        const prompts = [];
        display.onEmptyQueue = () => {
            prompts.push({ id: game.context.achieveo.soko_prize_oid, nomerge: obj.nomerge,
                awarded: game.u.uachieved.includes(ACH_SOKO_PRIZE), carried: game.invent.includes(obj) });
            return 32;
        };
        const pending = insertion ? addinv(obj) : addinv_core1(obj);
        assert.ok(pending instanceof Promise);
        assert.equal(obj.nomerge, 1);
        assert.equal(game.context.achieveo.soko_prize_oid, obj.o_id);
        assert.equal(await pending, insertion ? obj : undefined);
        assert.ok(prompts.length > 0, 'actual quest pager requested input');
        assert.ok(prompts.every(p => p.id === obj.o_id && p.nomerge === 1 && !p.awarded && !p.carried));
        released(obj, 'soko');
        assert.equal(events[0].questart, 1);
        assert.equal(events[0].touched, true);
        assert.equal(events[0].halfSpellDamage, true);
        assert.equal(events[0].carried, false);
        assert.equal(obj.where, insertion ? OBJ_INVENT : OBJ_FREE);
    });
}

await test('quest pager rejection leaves prize release pending', async () => {
    const obj = mark(create(artifact_otyps[ART_EYE_OF_THE_AETHIOPICA]));
    obj.oartifact = ART_EYE_OF_THE_AETHIOPICA;
    const stop = new Error('state gate stops at actual quest input');
    display.onEmptyQueue = () => { throw stop; };
    await assert.rejects(addinv_core1(obj), error => error === stop);
    assert.equal(game.context.achieveo.mines_prize_oid, obj.o_id);
    assert.equal(obj.nomerge, 1);
    assert.equal(game.u.uachieved.includes(ACH_MINE_PRIZE), false);
});

console.log(JSON.stringify({
    passed: results.filter(result => result.passed).length,
    total: results.length,
    results
}, null, 4));
if (results.some(result => !result.passed)) {
    process.exitCode = 1;
}
