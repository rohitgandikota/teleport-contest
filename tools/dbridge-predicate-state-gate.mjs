// node --test tools/dbridge-predicate-state-gate.mjs
// Complete predicate bodies: C dbridge.c:38-209. Literal C truth tables.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { is_pool, is_lava } from '../js/mon.js';
import { is_moat, is_ice, is_pool_or_lava, is_waterwall, db_under_typ,
    is_drawbridge_wall, is_db_wall, find_drawbridge } from '../js/dbridge.js';
import { maketrap } from '../js/mklev.js';
import { ROOM, STONE, POOL, MOAT, WATER, LAVAPOOL, LAVAWALL, ICE, PIT,
    DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, DB_MOAT, DB_LAVA, DB_ICE, DB_FLOOR,
    DB_NORTH, DB_SOUTH, DB_EAST, DB_WEST, DBWALL, DOOR } from '../js/const.js';
import { start_timer, TIMER_LEVEL, MELT_ICE_AWAY } from '../js/timeout.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';

const X = 30, Y = 10;
async function setup() {
    await runSegment({ seed: 99812, datetime: '20000110090000', moves: ' ',
        nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
    game.level.traps = []; game.timer_base = [];
    game.level.objects = []; game.level.objAt.clear();
    game.level.buriedobjs = [];
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.juiblex_level = { dnum: 2, dlevel: 6 };
    for (let x = X - 1; x <= X + 1; x++) {
        for (let y = Y - 1; y <= Y + 1; y++)
            Object.assign(game.level.at(x, y), { typ: ROOM, drawbridgemask: 0, roomno: 0 });
    }
    initRng(3); enableRngLog();
}

function predicates(x, y) {
    return [is_pool(x, y), is_lava(x, y), is_ice(x, y), is_moat(x, y),
        is_pool_or_lava(x, y), is_waterwall(x, y)];
}
function check(expected) {
    const terrain = { ...game.level.at(X, Y) };
    assert.deepEqual(predicates(X, Y), expected);
    assert.deepEqual(game.level.at(X, Y), terrain);
    assert.deepEqual(getRngLog(), []);
}

// pool, lava, ice, moat, pool-or-lava, waterwall. No production helper oracle.
for (const [name, typ, expected] of [
    ['room', ROOM, [false, false, false, false, false, false]],
    ['pool', POOL, [true, false, false, false, true, false]],
    ['moat', MOAT, [true, false, false, true, true, false]],
    ['water wall', WATER, [true, false, false, false, true, true]],
    ['lava pool', LAVAPOOL, [false, true, false, false, true, false]],
    ['lava wall', LAVAWALL, [false, true, false, false, true, false]],
    ['ice', ICE, [false, false, true, false, false, false]],
]) test(`ordinary terrain: ${name}`, async () => {
    await setup(); game.level.at(X, Y).typ = typ; check(expected);
});

const underlays = [
    ['moat', DB_MOAT, MOAT, [true, false, false, true, true, false]],
    ['lava', DB_LAVA, LAVAPOOL, [false, true, false, false, true, false]],
    ['ice', DB_ICE, ICE, [false, false, true, false, false, false]],
    ['floor', DB_FLOOR, STONE, [false, false, false, false, false, false]],
];
for (const [name, under, surface, expected] of underlays) {
    for (const dir of [DB_NORTH, DB_SOUTH, DB_EAST, DB_WEST]) {
        test(`raised bridge: ${name}, direction ${dir}`, async () => {
            await setup();
            Object.assign(game.level.at(X, Y), { typ: DRAWBRIDGE_UP, drawbridgemask: under | dir });
            check(expected);
            assert.equal(db_under_typ(under | dir), surface);
        });
    }
    test(`lowered bridge hides its ${name} underlay`, async () => {
        await setup();
        Object.assign(game.level.at(X, Y), { typ: DRAWBRIDGE_DOWN, drawbridgemask: under | DB_EAST });
        check([false, false, false, false, false, false]);
    });
}

test('Juiblex: explicit MOAT remains a pool but not a moat', async () => {
    await setup(); game.u.uz = { ...game.juiblex_level };
    game.level.at(X, Y).typ = MOAT;
    check([true, false, false, false, true, false]);
});
test('Juiblex: raised bridge over moat is neither pool nor moat', async () => {
    await setup(); game.u.uz = { ...game.juiblex_level };
    Object.assign(game.level.at(X, Y), { typ: DRAWBRIDGE_UP, drawbridgemask: DB_MOAT });
    check([false, false, false, false, false, false]);
});
test('Juiblex does not suppress lava or ice under a raised bridge', async () => {
    await setup(); game.u.uz = { ...game.juiblex_level };
    Object.assign(game.level.at(X, Y), { typ: DRAWBRIDGE_UP, drawbridgemask: DB_LAVA });
    check([false, true, false, false, true, false]);
    game.level.at(X, Y).drawbridgemask = DB_ICE;
    check([false, false, true, false, false, false]);
});
test('underlay ignores direction and unrelated bits; floor maps to STONE', async () => {
    await setup();
    for (const [, under, surface] of underlays)
        assert.equal(db_under_typ(under | DB_WEST | 64), surface);
    assert.deepEqual(getRngLog(), []);
});
test('all guarded predicates reject out-of-map coordinates', async () => {
    await setup();
    for (const typ of [POOL, LAVAPOOL, WATER]) {
        game.level.at(0, Y).typ = typ;
        for (const [x, y] of [[0,Y],[-1,Y],[80,Y],[X,-1],[X,21]])
            assert.deepEqual(predicates(x, y), [false,false,false,false,false,false]);
    }
    assert.deepEqual(getRngLog(), []);
});

// C chooses right, left, above, below, returning the bridge's direction.
for (const [dx, dy, dir] of [[1,0,DB_WEST],[-1,0,DB_EAST],[0,-1,DB_SOUTH],[0,1,DB_NORTH]]) {
    test(`wall lookup and coordinate conversion: direction ${dir}`, async () => {
        await setup();
        game.level.at(X, Y).typ = DBWALL;
        Object.assign(game.level.at(X + dx, Y + dy), { typ: DRAWBRIDGE_UP, drawbridgemask: dir });
        assert.equal(is_db_wall(X, Y), true);
        assert.equal(is_drawbridge_wall(X, Y), dir);
        const cc = { x: X, y: Y };
        assert.equal(find_drawbridge(cc), true);
        assert.deepEqual(cc, { x: X + dx, y: Y + dy });
        const span = { ...cc };
        assert.equal(find_drawbridge(span), true);
        assert.deepEqual(span, cc);
        game.level.at(X, Y).typ = DOOR;
        assert.equal(is_db_wall(X, Y), false);
        assert.equal(is_drawbridge_wall(X, Y), dir);
        assert.deepEqual(getRngLog(), []);
    });
}
test('wall lookup rejects ordinary terrain and the wrong bridge direction', async () => {
    await setup();
    Object.assign(game.level.at(X + 1, Y), { typ: DRAWBRIDGE_UP, drawbridgemask: DB_WEST });
    assert.equal(is_drawbridge_wall(X, Y), -1);
    game.level.at(X, Y).typ = DOOR;
    game.level.at(X + 1, Y).drawbridgemask = DB_EAST;
    assert.equal(is_drawbridge_wall(X, Y), -1);
    const cc = { x: X, y: Y };
    assert.equal(find_drawbridge(cc), false); assert.deepEqual(cc, { x: X, y: Y });
    assert.equal(is_drawbridge_wall(0, Y), -1);
    assert.deepEqual(getRngLog(), []);
});
test('lowered spans still identify their portcullis in every direction', async () => {
    for (const [dx, dy, dir] of [[1,0,DB_WEST],[-1,0,DB_EAST],[0,-1,DB_SOUTH],[0,1,DB_NORTH]]) {
        await setup();
        game.level.at(X, Y).typ = DOOR;
        Object.assign(game.level.at(X + dx, Y + dy), { typ: DRAWBRIDGE_DOWN, drawbridgemask: dir });
        assert.equal(is_drawbridge_wall(X, Y), dir);
        const cc = { x: X, y: Y };
        assert.equal(find_drawbridge(cc), true);
        assert.deepEqual(cc, { x: X + dx, y: Y + dy });
        assert.deepEqual(getRngLog(), []);
    }
});
test('ambiguous wall lookup preserves C right, left, above, below order', async () => {
    await setup(); game.level.at(X, Y).typ = DBWALL;
    const neighbors = [[1,0,DB_WEST],[-1,0,DB_EAST],[0,-1,DB_SOUTH],[0,1,DB_NORTH]];
    for (const [dx, dy, dir] of neighbors)
        Object.assign(game.level.at(X + dx, Y + dy), { typ: DRAWBRIDGE_UP, drawbridgemask: dir });
    for (const [dx, dy, dir] of neighbors) {
        assert.equal(is_drawbridge_wall(X, Y), dir);
        game.level.at(X + dx, Y + dy).typ = ROOM;
    }
    assert.equal(is_drawbridge_wall(X, Y), -1);
    assert.deepEqual(getRngLog(), []);
});
test('fresh ice bridge permits a pit and cancels its numeric timer', async () => {
    await setup();
    Object.assign(game.level.at(X, Y), { typ: DRAWBRIDGE_UP, drawbridgemask: DB_ICE | DB_EAST });
    start_timer(20, TIMER_LEVEL, MELT_ICE_AWAY, (X << 16) | Y);
    const trap = maketrap(X, Y, PIT);
    assert.equal(trap?.ttyp, PIT);
    assert.equal(game.level.at(X, Y).drawbridgemask, DB_FLOOR | DB_EAST);
    assert.deepEqual(game.timer_base, []);
    assert.deepEqual(getRngLog(), []);
});
