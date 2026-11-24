// C sp_lev.c:967-982: vertical draw, horizontal draw, then extras forwarding.
// Constructed state with real RNG, floor objects, timers and flip consumers.
import assert from 'node:assert/strict';
import {before, test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {GameMap} from '../js/game.js';
import {flip_level, flip_level_rnd} from '../js/sp_lev.js';
import {get_level_extends} from '../js/mklev.js';
import {mksobj, place_object} from '../js/mkobj.js';
import {ONAMES} from '../js/objects_data.js';
import {start_timer, TIMER_LEVEL, MELT_ICE_AWAY} from '../js/timeout.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {vision_reset} from '../js/vision.js';
import {ROOM, ICE, SV0, SV2, SV4, SV6} from '../js/const.js';

before(async () => {
    await runSegment({seed: 7101, datetime: '20000110090000', moves: ' ',
        storage: new InMemoryStorage(),
        nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'});
});

function arena(seed) {
    game.level = new GameMap();
    game.stairs = null; game.timer_base = []; game.regions = [];
    game.lregions = []; game.exclusion_zones = []; game.migrating_mons = [];
    game.occupants = null; game.in_mklev = false;
    Object.assign(game.u, {ux: 5, uy: 2, ux0: 3, uy0: 4, ustuck: null});
    game.iflags.travelcc = {x: 12, y: 4};
    game.context.digging = {pos: {x: 15, y: 7}};
    for (let x = 1; x < 80; x++) for (let y = 0; y < 21; y++)
        Object.assign(game.level.at(x, y), {typ: ROOM, lit: 1, waslit: 1});
    const area = get_level_extends();
    assert.deepEqual([Math.max(1, area.xmin), Math.min(79, area.xmax),
        Math.max(0, area.ymin), Math.min(20, area.ymax)], [1, 79, 0, 20]);
    const rock = mksobj(ONAMES.ROCK, false, false);
    place_object(rock, 20, 6);
    Object.assign(game.level.at(20, 6), {typ: ICE, seenv: SV0});
    assert.equal(start_timer(50, TIMER_LEVEL, MELT_ICE_AWAY, (20 << 16) | 6), true);
    const timer = game.timer_base[0], deadline = timer.timeout;
    vision_reset();
    initRng(seed); enableRngLog();
    return {rock, timer, deadline};
}

// Literal expected coordinates for the fixed C flip area, independent of JS helpers.
const expected = [
    {hero: [5, 2], object: [20, 6], travel: {x: 12, y: 4}, digging: {x: 15, y: 7}, seen: SV0},
    {hero: [5, 18], object: [20, 14], travel: {x: 12, y: 16}, digging: {x: 15, y: 13}, seen: SV6},
    {hero: [75, 2], object: [60, 6], travel: {x: 68, y: 4}, digging: {x: 65, y: 7}, seen: SV2},
    {hero: [75, 18], object: [60, 14], travel: {x: 68, y: 16}, digging: {x: 65, y: 13}, seen: SV4},
];
const rows = [
    [0, 6, [], 0], [4, 6, [], 0],
    [1, 1, ['rn2(2)=1'], 1], [1, 4, ['rn2(2)=0'], 0],
    [2, 1, ['rn2(2)=1'], 2], [2, 4, ['rn2(2)=0'], 0],
    [3, 1, ['rn2(2)=1', 'rn2(2)=0'], 1],
    [3, 4, ['rn2(2)=0', 'rn2(2)=1'], 2],
    [3, 5, ['rn2(2)=0', 'rn2(2)=0'], 0],
    [3, 6, ['rn2(2)=1', 'rn2(2)=1'], 3],
    [7, 6, ['rn2(2)=1', 'rn2(2)=1'], 3],
];

function check({rock, timer, deadline}, axis, extras) {
    const map = expected[axis], active = expected[extras ? axis : 0];
    assert.deepEqual([rock.ox, rock.oy], map.object);
    assert.equal(game.level.objAt.get(map.object.join(',')), rock);
    assert.equal(game.level.at(...map.object).typ, ICE);
    assert.equal(game.level.at(...map.object).seenv, extras ? map.seen : SV0);
    assert.deepEqual([game.u.ux, game.u.uy], active.hero);
    assert.deepEqual([game.u.ux0, game.u.uy0], extras && axis ? active.hero : [3, 4]);
    assert.deepEqual(game.iflags.travelcc, active.travel);
    assert.deepEqual(game.context.digging.pos, active.digging);
    assert.equal(game.timer_base.length, 1);
    assert.equal(game.timer_base[0], timer);
    assert.equal(timer.arg, (map.object[0] << 16) | map.object[1]);
    assert.equal(timer.timeout, deadline);
}

for (const [mask, seed, calls, axis] of rows) for (const extras of [false, true])
    test(`mask ${mask}, seed ${seed}, extras ${extras}: selected axis ${axis}`, async () => {
        const state = arena(seed);
        await flip_level_rnd(mask, extras);
        assert.deepEqual(getRngLog(), calls, 'exact draw count and vertical-before-horizontal order');
        check(state, axis, extras);
    });

for (const axis of [1, 2, 3]) for (const extras of [false, true])
    test(`direct flip axis ${axis}, extras ${extras} stays RNG-neutral`, async () => {
        const state = arena(6);
        await flip_level(axis, extras);
        assert.deepEqual(getRngLog(), []);
        check(state, axis, extras);
    });

test('zeroed active destinations remain unset', async () => {
    arena(6);
    game.iflags.travelcc = {x: 0, y: 0};
    game.context.digging.pos = {x: 0, y: 0};
    await flip_level_rnd(3, true);
    assert.deepEqual([game.u.ux, game.u.uy], [75, 18]);
    assert.deepEqual(game.iflags.travelcc, {x: 0, y: 0});
    assert.deepEqual(game.context.digging.pos, {x: 0, y: 0});
    assert.deepEqual(getRngLog(), ['rn2(2)=1', 'rn2(2)=1']);
});
