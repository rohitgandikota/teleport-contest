#!/usr/bin/env node
// Constructed source controls through normal imports, not native coverage.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { GameMap } from '../js/game.js';
import { InMemoryStorage } from '../js/storage.js';
import { flip_level } from '../js/sp_lev.js';
import { get_level_extends } from '../js/mklev.js';
import { create_region, add_region, inside_region, create_gas_cloud,
    visible_region_at, save_regions, rest_regions, run_regions,
    mon_in_region, m_in_out_region } from '../js/region.js';
import { getRngLog } from '../js/rng.js';
import { does_block, __debug_arrays } from '../js/vision.js';
import { makemon } from '../js/makemon.js';
import { PMNAMES } from '../js/monst_data.js';
import { ROOM, MM_NOGRP, MM_NOMSG, NO_MINVENT } from '../js/const.js';

async function setup() {
    await runSegment({
        seed: 9211, datetime: '20000110090000', moves: '',
        nethackrc: 'OPTIONS=name:Region,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage: new InMemoryStorage(),
    });
    // A constructed map gives fixed, independently checked reflection bounds.
    game.level = new GameMap();
    game.level.monAt = new Map();
    for (let x = 10; x <= 30; x++)
        for (let y = 4; y <= 12; y++)
            game.level.at(x, y).typ = ROOM;
    game.u.ux = 22;
    game.u.uy = 10;
    game.u.ux0 = 22;
    game.u.uy0 = 10;
    game.stairs = null;
    game.lregions = [];
    game.regions = [];
    game.max_regions = 0;
    game.exclusion_zones = [];
    game.timer_base = [];
    game.iflags.debug_mongen = false;
    for (let i = 0; i < 20; i++) game.nhDisplay.pushKey(27);
    assert.deepEqual(get_level_extends(), { xmin: 9, xmax: 31, ymin: 3, ymax: 13 });
}

function region() {
    const reg = create_region([
        { lx: 12, ly: 5, hx: 14, hy: 7 },
        { lx: 16, ly: 8, hx: 18, hy: 9 },
    ], 2);
    reg.ttl = 7;
    reg.arg = 11;
    add_region(reg);
    return reg;
}

function metadata(reg) {
    const { bounding_box, rects, ...rest } = reg;
    return structuredClone(rest);
}

function points(reg) {
    const result = [];
    for (let x = 1; x < 80; x++)
        for (let y = 0; y < 21; y++)
            if (inside_region(reg, x, y)) result.push([x, y]);
    return result;
}

function reflected(pointsBefore, mask) {
    return pointsBefore.map(([x, y]) => [mask & 2 ? 40 - x : x, mask & 1 ? 16 - y : y])
        .sort(([ax, ay], [bx, by]) => ax - bx || ay - by);
}

for (const mask of [1, 2, 3]) {
    for (const extras of [false, true]) {
        test(`mask ${mask}, extras ${extras}: reflect the union in place with no turn or RNG`, async () => {
            await setup();
            const reg = region();
            const owners = { list: game.regions, box: reg.bounding_box,
                rects: reg.rects, first: reg.rects[0], second: reg.rects[1], monsters: reg.monsters };
            const before = structuredClone(reg);
            const beforePoints = points(reg);
            const rng = [...getRngLog()];
            const moves = game.moves;
            await flip_level(mask, extras);
            assert.strictEqual(game.regions, owners.list);
            assert.strictEqual(game.regions[0], reg);
            assert.strictEqual(reg.bounding_box, owners.box);
            assert.strictEqual(reg.rects, owners.rects);
            assert.strictEqual(reg.rects[0], owners.first);
            assert.strictEqual(reg.rects[1], owners.second);
            assert.strictEqual(reg.monsters, owners.monsters);
            assert.deepEqual(metadata(reg), metadata(before));
            const expected = reflected(beforePoints, mask);
            assert.deepEqual(points(reg), expected, 'every member cell and gap is mirrored');
            assert.deepEqual(reg.bounding_box, {
                lx: Math.min(...expected.map(point => point[0])),
                ly: Math.min(...expected.map(point => point[1])),
                hx: Math.max(...expected.map(point => point[0])),
                hy: Math.max(...expected.map(point => point[1])),
            });
            assert.equal(game.moves, moves);
            assert.deepEqual(getRngLog(), rng);
            await flip_level(mask, extras);
            assert.deepEqual(reg, before, 'two reflections restore the original value');
            assert.deepEqual(getRngLog(), rng);
        });
    }
}

test('masks without an axis leave geometry and owners unchanged', async () => {
    await setup();
    const reg = region();
    const before = structuredClone(reg);
    const owner = game.regions;
    const rng = [...getRngLog()];
    for (const mask of [0, 4]) {
        await flip_level(mask, true);
        assert.strictEqual(game.regions, owner);
        assert.deepEqual(reg, before);
        assert.deepEqual(getRngLog(), rng);
    }
});

test('regions outside the map extent and attached/invisible regions still transform', async () => {
    await setup();
    const reg = create_region([{ lx: 1, ly: 1, hx: 2, hy: 2 }], 1);
    reg.attach_2_u = true;
    reg.attach_2_m = 123;
    reg.ttl = 0;
    add_region(reg);
    const meta = metadata(reg);
    await flip_level(3, false);
    assert.deepEqual(reg.bounding_box, { lx: 38, ly: 14, hx: 39, hy: 15 });
    assert.deepEqual(reg.rects[0], reg.bounding_box);
    assert.deepEqual(metadata(reg), meta);
});

test('only the first nrects entries move; spare array capacity is unchanged', async () => {
    await setup();
    const reg = region();
    const spare = { lx: 70, ly: 17, hx: 75, hy: 20 };
    reg.rects.push(spare);
    await flip_level(2, true);
    assert.equal(reg.nrects, 2);
    assert.deepEqual(reg.rects[0], { lx: 26, ly: 5, hx: 28, hy: 7 });
    assert.strictEqual(reg.rects[2], spare);
    assert.deepEqual(spare, { lx: 70, ly: 17, hx: 75, hy: 20 });
});

test('an empty region transforms its existing bounding box without rebuilding rectangles', async () => {
    await setup();
    const reg = create_region(null, 0);
    add_region(reg);
    const box = reg.bounding_box;
    const rects = reg.rects;
    await flip_level(3, false);
    assert.strictEqual(reg.bounding_box, box);
    assert.strictEqual(reg.rects, rects);
    assert.deepEqual(box, { lx: -40, ly: -5, hx: 40, hy: 16 });
    assert.equal(reg.nrects, 0);
    assert.equal(reg.ttl, -1);
    assert.deepEqual(points(reg), []);
});

test('missing region owners remain absent', async () => {
    await setup();
    delete game.regions;
    await flip_level(2, false);
    assert.equal(Object.hasOwn(game, 'regions'), false);
});

test('real cloud geometry reaches visibility and the final vision reset', async () => {
    await setup();
    const cloud = await create_gas_cloud(14, 6, 4, 0);
    const meta = metadata(cloud);
    const rng = [...getRngLog()];
    await flip_level(2, true);
    assert.strictEqual(visible_region_at(26, 6), cloud);
    assert.equal(visible_region_at(14, 6), null);
    assert.equal(does_block(26, 6, game.level.at(26, 6)), 2);
    assert.equal(does_block(14, 6, game.level.at(14, 6)), 0);
    assert.equal(__debug_arrays().viz_clear[6][26], 0);
    assert.equal(__debug_arrays().viz_clear[6][14], 1);
    assert.deepEqual(metadata(cloud), meta);
    assert.deepEqual(getRngLog(), rng);
});

test('a real monster keeps membership through the flip and leaves through the real consumer', async () => {
    await setup();
    const mon = await makemon(game.mons[PMNAMES.PM_GRID_BUG], 14, 6,
        MM_NOGRP | MM_NOMSG | NO_MINVENT);
    assert.ok(mon);
    const cloud = await create_gas_cloud(14, 6, 1, 0);
    assert.equal(mon_in_region(cloud, mon), true);
    const members = cloud.monsters;
    const before = [...members];
    await flip_level(2, true);
    assert.deepEqual([mon.mx, mon.my], [26, 6]);
    assert.equal(inside_region(cloud, mon.mx, mon.my), true);
    assert.strictEqual(cloud.monsters, members);
    assert.deepEqual(members, before);
    await m_in_out_region(mon, 27, 6);
    assert.equal(mon_in_region(cloud, mon), false);
    assert.equal(cloud.n_monst, 0);
});

test('overlapping clouds preserve list order and visible-region priority', async () => {
    await setup();
    const first = await create_gas_cloud(14, 6, 1, 0);
    const second = await create_gas_cloud(14, 6, 1, 0);
    const list = game.regions;
    await flip_level(2, true);
    assert.strictEqual(game.regions, list);
    assert.strictEqual(list[0], first);
    assert.strictEqual(list[1], second);
    assert.strictEqual(visible_region_at(26, 6), first);
});

test('serialization retains transformed geometry and ordinary elapsed-time aging', async () => {
    await setup();
    const reg = region();
    const original = save_regions();
    const originalValue = structuredClone(original);
    await flip_level(2, true);
    assert.deepEqual(original, originalValue, 'a prior saved owner is independent');
    const saved = save_regions();
    assert.deepEqual(saved.regions[0].bounding_box, { lx: 22, ly: 5, hx: 28, hy: 9 });
    const savedValue = structuredClone(saved);
    game.moves += 2;
    rest_regions(saved, false);
    assert.notStrictEqual(game.regions[0], reg);
    assert.notStrictEqual(game.regions[0], saved.regions[0]);
    assert.deepEqual(game.regions[0].bounding_box, saved.regions[0].bounding_box);
    assert.deepEqual(game.regions[0].rects, saved.regions[0].rects);
    assert.equal(game.regions[0].ttl, 5);
    assert.equal(inside_region(game.regions[0], 27, 6), true);
    assert.deepEqual(saved, savedValue);
});

test('flip does not age a due cloud; real expiry callbacks retain their phase order', async () => {
    await setup();
    const cloud = await create_gas_cloud(14, 6, 1, 8);
    const lifetime = cloud.ttl;
    for (let turn = 0; turn < lifetime; turn++) await run_regions();
    assert.equal(cloud.ttl, 0);
    const rng = [...getRngLog()];
    await flip_level(2, true);
    assert.equal(visible_region_at(26, 6), cloud);
    assert.equal(cloud.ttl, 0);
    assert.equal(cloud.arg, 8);
    assert.deepEqual(getRngLog(), rng);
    await run_regions();
    assert.equal(cloud.arg, 4);
    assert.equal(cloud.ttl, 1, 'expiry resets to two before normal aging');
    await run_regions();
    assert.equal(cloud.ttl, 0);
    await run_regions();
    assert.equal(game.regions.includes(cloud), false);
    assert.equal(cloud.ttl, -2);
    assert.equal(visible_region_at(26, 6), null);
    assert.equal(__debug_arrays().viz_clear[6][26], 1);
});
