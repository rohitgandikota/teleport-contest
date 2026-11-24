// C sp_lev.c:428-454,819-859; dbridge.c:211-281,775-1019.
// Constructed state, real creation and consumers. No private helper exports.
import assert from 'node:assert/strict';
import {before, test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {GameMap} from '../js/game.js';
import {flip_level} from '../js/sp_lev.js';
import {get_level_extends} from '../js/mklev.js';
import {create_drawbridge, get_wall_for_db, find_drawbridge, is_drawbridge_wall,
    open_drawbridge, close_drawbridge, destroy_drawbridge} from '../js/dbridge.js';
import {vision_reset} from '../js/vision.js';
import {resetInputState} from '../js/input.js';
import {TOPLINE_EMPTY} from '../js/display.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {COLNO, ROWNO, ROOM, MOAT, LAVAPOOL, ICE, VWALL, DOOR, DBWALL,
    DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, D_NODOOR, W_NONDIGGABLE, ICED_MOAT,
    DB_NORTH, DB_SOUTH, DB_EAST, DB_WEST, DB_DIR, DB_MOAT, DB_LAVA,
    DB_ICE, DB_FLOOR, DB_UNDER} from '../js/const.js';

before(async () => {
    await runSegment({seed: 7101, datetime: '20000110090000', moves: ' ',
        storage: new InMemoryStorage(),
        nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'});
});

function arena() {
    game._preNhgetchHook = null;
    resetInputState();
    let acknowledgments = 0;
    game.nhDisplay.onEmptyQueue = () => { assert.ok(++acknowledgments <= 16); return 32; };
    game._toplin = TOPLINE_EMPTY; game._toplines = ''; game._prevmsg = '';
    game._pending_message = '';
    game.level = new GameMap();
    game.stairs = null; game.timer_base = []; game.regions = [];
    game.lregions = []; game.exclusion_zones = []; game.migrating_mons = [];
    game.occupants = null; game.in_mklev = false;
    Object.assign(game.u, {ux: 5, uy: 2, ux0: 5, uy0: 2, ustuck: null});
    for (let x = 1; x < COLNO; x++) for (let y = 0; y < ROWNO; y++)
        Object.assign(game.level.at(x, y), {typ: ROOM, lit: 1, waslit: 1});
    const area = get_level_extends();
    assert.deepEqual([Math.max(1, area.xmin), Math.min(79, area.xmax),
        Math.max(0, area.ymin), Math.min(20, area.ymax)], [1, 79, 0, 20]);
    vision_reset();
    initRng(14); enableRngLog();
}

// Literal C direction table. Expected results never use the production helper.
const directions = [
    ['north', DB_NORTH, 0, -1], ['south', DB_SOUTH, 0, 1],
    ['east', DB_EAST, 1, 0], ['west', DB_WEST, -1, 0],
];
const expectedDirections = {
    1: [DB_SOUTH, DB_NORTH, DB_EAST, DB_WEST],
    2: [DB_NORTH, DB_SOUTH, DB_WEST, DB_EAST],
    3: [DB_SOUTH, DB_NORTH, DB_WEST, DB_EAST],
};
const underlays = [
    ['moat', DB_MOAT, MOAT], ['lava', DB_LAVA, LAVAPOOL],
    ['ice', DB_ICE, ICE], ['floor', DB_FLOOR, ROOM],
];
const mirror = ({x, y}, axis) => ({x: axis & 2 ? 80 - x : x, y: axis & 1 ? 20 - y : y});

function bridge(x, y, direction, open, under) {
    const [, dir, dx, dy] = direction;
    const wall = {x: x + dx, y: y + dy};
    game.level.at(wall.x, wall.y).typ = VWALL;
    game.level.at(x, y).typ = under === DB_LAVA ? LAVAPOOL : MOAT;
    assert.equal(create_drawbridge(x, y, dir, open), true);
    assert.equal(game.level.at(x, y).drawbridgemask,
        dir | (under === DB_LAVA ? DB_LAVA : DB_MOAT));
    // Ice/floor are explicit constructed underlay states after real creation.
    // Their native producers are outside this gate's coverage claim.
    game.level.at(x, y).drawbridgemask = dir | under;
    return wall;
}

function checkWall(span, wall, dir) {
    const actual = {...span};
    get_wall_for_db(actual);
    assert.deepEqual(actual, wall);
    assert.equal(is_drawbridge_wall(wall.x, wall.y), dir);
    const fromWall = {...wall};
    assert.equal(find_drawbridge(fromWall), true);
    assert.deepEqual(fromWall, span);
    const fromSpan = {...span};
    assert.equal(find_drawbridge(fromSpan), true);
    assert.deepEqual(fromSpan, span);
}

for (const direction of directions) for (const axis of [1, 2, 3])
    for (const extras of [false, true]) for (const open of [false, true]) {
        test(`${direction[0]}, axis ${axis}, extras ${extras}, initially open ${open}`, async () => {
            for (const [, under, destroyedType] of underlays) for (const [x, y] of [[20, 6], [60, 14]]) {
                arena();
                const originalWall = bridge(x, y, direction, open, under);
                const span = mirror({x, y}, axis), wall = mirror(originalWall, axis);
                const expectedDir = expectedDirections[axis][direction[1]];
                const spanOwner = game.level.at(span.x, span.y);
                const wallOwner = game.level.at(wall.x, wall.y);
                await flip_level(axis, extras);
                const cell = game.level.at(span.x, span.y);
                assert.equal(cell, spanOwner, 'the map address retains its cell owner');
                assert.equal(game.level.at(wall.x, wall.y), wallOwner);
                assert.equal(cell.typ, open ? DRAWBRIDGE_DOWN : DRAWBRIDGE_UP);
                assert.equal(cell.drawbridgemask, expectedDir | under);
                assert.equal(cell.drawbridgemask & DB_UNDER, under);
                assert.deepEqual([game.u.ux, game.u.uy], extras
                    ? Object.values(mirror({x: 5, y: 2}, axis)) : [5, 2]);
                assert.deepEqual(getRngLog(), [], 'reflection is RNG-neutral');
                checkWall(span, wall, expectedDir);

                if (open) await close_drawbridge(span.x, span.y);
                assert.equal(cell.typ, DRAWBRIDGE_UP);
                await open_drawbridge(span.x, span.y);
                assert.equal(cell.typ, DRAWBRIDGE_DOWN);
                assert.equal(wallOwner.typ, DOOR);
                assert.equal(wallOwner.doormask, D_NODOOR);
                checkWall(span, wall, expectedDir);
                await close_drawbridge(span.x, span.y);
                assert.equal(cell.typ, DRAWBRIDGE_UP);
                assert.equal(wallOwner.typ, DBWALL);
                assert.equal(wallOwner.horizontal, expectedDir === DB_NORTH || expectedDir === DB_SOUTH);
                assert.equal(wallOwner.wall_info, W_NONDIGGABLE);
                assert.equal(cell.drawbridgemask, expectedDir | under);
                assert.deepEqual(getRngLog(), [], 'empty bridge cycling has no random effect');

                // Real rn2(6) is zero for seed 14. The native gate covers debris.
                await destroy_drawbridge(span.x, span.y);
                assert.equal(cell.typ, destroyedType);
                assert.equal(wallOwner.typ, DOOR);
                assert.equal(wallOwner.doormask, D_NODOOR);
                if (under === DB_MOAT || under === DB_LAVA)
                    assert.equal(cell.drawbridgemask, 0);
                else assert.equal(cell.icedpool, under === DB_ICE ? ICED_MOAT : 0);
                assert.deepEqual(getRngLog(), ['rn2(6)=0']);
                assert.equal(game.level.objects.length, 0);
            }
        });
    }

for (const axis of [1, 2, 3]) test(`axis ${axis}: other terrain masks stay untouched`, async () => {
    arena();
    const cells = [ROOM, DOOR, DBWALL].map((typ, i) => ({x: 25 + i, y: 5, typ}));
    for (const {x, y, typ} of cells)
        Object.assign(game.level.at(x, y), {typ, drawbridgemask: DB_EAST | DB_ICE});
    await flip_level(axis, true);
    for (const cell of cells) {
        const at = mirror(cell, axis);
        assert.equal(game.level.at(at.x, at.y).drawbridgemask, DB_EAST | DB_ICE);
    }
    assert.deepEqual(getRngLog(), []);
});

for (const [axis, x, y, name] of [
    [2, 40, 6, 'east'], [2, 40, 6, 'west'],
    [1, 20, 10, 'north'], [1, 20, 10, 'south'],
    [3, 40, 10, 'east'], [3, 40, 10, 'north'],
]) test(`C skipped center: ${name} at ${x},${y}, axis ${axis}`, async () => {
    arena();
    const direction = directions.find(d => d[0] === name);
    const oldWall = bridge(x, y, direction, false, DB_MOAT);
    await flip_level(axis, false);
    const span = mirror({x, y}, axis), relocatedWall = mirror(oldWall, axis);
    assert.equal(game.level.at(span.x, span.y).drawbridgemask & DB_DIR, direction[1]);
    assert.equal(game.level.at(relocatedWall.x, relocatedWall.y).typ, DBWALL);
    const reportedWall = {...span};
    get_wall_for_db(reportedWall);
    assert.notDeepEqual(reportedWall, relocatedWall,
        'C excludes the center cell from the swap loop and does not correct its direction');
    assert.equal(is_drawbridge_wall(relocatedWall.x, relocatedWall.y), -1);
    assert.deepEqual(getRngLog(), []);
});

for (const extras of [false, true]) test(`zero-axis early return, extras ${extras}`, async () => {
    arena();
    const wall = bridge(20, 6, directions[2], false, DB_LAVA);
    const cell = game.level.at(20, 6), before = {...cell};
    await flip_level(0, extras);
    assert.deepEqual(cell, before);
    checkWall({x: 20, y: 6}, wall, DB_EAST);
    assert.deepEqual([game.u.ux, game.u.uy], [5, 2]);
    assert.deepEqual(getRngLog(), []);
});

test('creation refuses a non-wall portcullis location without a partial bridge', () => {
    arena();
    assert.equal(create_drawbridge(20, 6, DB_EAST, false), false);
    assert.equal(game.level.at(20, 6).typ, ROOM);
    assert.equal(game.level.at(21, 6).typ, ROOM);
    assert.deepEqual(getRngLog(), []);
});
