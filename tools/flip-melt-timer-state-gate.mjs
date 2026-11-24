#!/usr/bin/env node
// C-derived state controls through normal imports. No native C execution.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { flip_level } from '../js/sp_lev.js';
import { get_level_extends } from '../js/mklev.js';
import { getRngLog } from '../js/rng.js';
import { mksobj } from '../js/mkobj.js';
import { ONAMES } from '../js/objects_data.js';
import { ICE, COLNO, ROWNO } from '../js/const.js';
import { start_timer, spot_time_expires, spot_time_left,
    TIMER_LEVEL, MELT_ICE_AWAY } from '../js/timeout.js';

const input = {
    seed: 9211,
    datetime: '20000110090000',
    nethackrc: 'OPTIONS=name:Timer,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist,!safe_wait,time\n'
        + 'OPTIONS=suppress_alert:3.4.3\nOPTIONS=symset:DECgraphics\n',
    moves: 'mO aqr\r\x1b\x1b\x17blessed scroll of genocide\rra  *\r\x1b\x1b'
        + '\x17blessed fireproof water walking boots\rWb\x17melting ice\r'
};

async function setup() {
    await runSegment({ ...input, storage: new InMemoryStorage() });
    assert.equal(game.timer_base.length, 1);
    assert.equal(game.timer_base[0].func_index, MELT_ICE_AWAY);
    assert.equal(game.level.at(game.u.ux, game.u.uy).typ, ICE);
    assert.equal(spot_time_left(game.u.ux, game.u.uy, MELT_ICE_AWAY), 333);
}

function bounds() {
    const area = get_level_extends();
    return {
        xmin: Math.max(1, area.xmin), xmax: Math.min(COLNO - 1, area.xmax),
        ymin: Math.max(0, area.ymin), ymax: Math.min(ROWNO - 1, area.ymax)
    };
}

// Independent arithmetic expectation from sp_lev.c FlipX/FlipY, not a helper
// used by the runtime under test.
function mirrored(arg, flp, area) {
    const x = (arg >> 16) & 0xffff;
    const y = arg & 0xffff;
    return {
        x: flp & 2 ? area.xmin + area.xmax - x : x,
        y: flp & 1 ? area.ymin + area.ymax - y : y
    };
}

for (const flp of [1, 2, 3]) {
    for (const extras of [false, true]) {
        test(`axis ${flp}, extras ${extras}: the live ice timer moves and returns`, async () => {
            await setup();
            const queue = game.timer_base;
            const timer = queue[0];
            const before = { ...timer };
            const original = { x: game.u.ux, y: game.u.uy };
            const target = mirrored(timer.arg, flp, bounds());
            const rng = [...getRngLog()];
            await flip_level(flp, extras);
            assert.strictEqual(game.timer_base, queue);
            assert.strictEqual(queue[0], timer);
            assert.equal(timer.arg, (target.x << 16) | target.y);
            assert.equal(game.level.at(target.x, target.y).typ, ICE);
            assert.equal(spot_time_expires(target.x, target.y, MELT_ICE_AWAY), before.timeout);
            assert.equal(spot_time_left(target.x, target.y, MELT_ICE_AWAY), 333);
            assert.equal(spot_time_expires(original.x, original.y, MELT_ICE_AWAY), 0);
            assert.deepEqual({ ...timer, arg: before.arg }, before);
            assert.deepEqual({ x: game.u.ux, y: game.u.uy }, extras ? target : original);
            assert.deepEqual(getRngLog(), rng);
            await flip_level(flp, extras);
            assert.deepEqual(timer, before);
            assert.equal(game.level.at(original.x, original.y).typ, ICE);
            assert.deepEqual(getRngLog(), rng);
        });
    }
}

for (const flp of [0, 4]) {
    test(`mask ${flp}: the early return preserves the live timer and map`, async () => {
        await setup();
        const queue = game.timer_base;
        const before = { ...queue[0] };
        const cell = game.level.at(game.u.ux, game.u.uy);
        const cellState = { ...cell };
        const rng = [...getRngLog()];
        await flip_level(flp, true);
        assert.strictEqual(game.timer_base, queue);
        assert.deepEqual(queue[0], before);
        assert.deepEqual(cell, cellState);
        assert.deepEqual(getRngLog(), rng);
    });
}

test('the entire mixed queue retains timer identity, tie order and object arguments', async () => {
    await setup();
    const corpse = mksobj(ONAMES.CORPSE, false, false);
    const corpseTimer = game.timer_base.find(timer => timer.arg === corpse);
    assert.ok(corpseTimer, 'real corpse creation schedules its object timer');
    for (const [x, y] of [[28, 8], [29, 9]]) {
        game.level.at(x, y).typ = ICE;
        assert.equal(start_timer(333, TIMER_LEVEL, MELT_ICE_AWAY, (x << 16) | y), true);
    }
    const queue = game.timer_base;
    const records = [...queue];
    const before = records.map(timer => ({ ...timer }));
    const area = bounds();
    const nextId = game.timer_id;
    const timed = corpse.timed;
    const rng = [...getRngLog()];
    await flip_level(3, true);
    assert.strictEqual(game.timer_base, queue);
    assert.deepEqual(queue.map(timer => timer.tid), before.map(timer => timer.tid));
    for (const [index, timer] of queue.entries()) {
        assert.strictEqual(timer, records[index]);
        const old = before[index];
        if (old.func_index === MELT_ICE_AWAY) {
            const target = mirrored(old.arg, 3, area);
            assert.equal(timer.arg, (target.x << 16) | target.y);
            assert.equal(spot_time_expires(target.x, target.y, MELT_ICE_AWAY), old.timeout);
        } else {
            assert.strictEqual(timer.arg, old.arg);
        }
        assert.deepEqual({ ...timer, arg: old.arg }, old);
    }
    assert.equal(corpse.timed, timed);
    assert.equal(game.timer_id, nextId);
    assert.deepEqual(getRngLog(), rng);
});

test('an empty timer queue stays empty and consumes no RNG', async () => {
    await setup();
    game.timer_base = [];
    const queue = game.timer_base;
    const rng = [...getRngLog()];
    await flip_level(3, true);
    assert.strictEqual(game.timer_base, queue);
    assert.equal(queue.length, 0);
    assert.deepEqual(getRngLog(), rng);
});
