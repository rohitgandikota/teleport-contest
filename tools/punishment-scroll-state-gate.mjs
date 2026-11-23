#!/usr/bin/env node
// C read.c delegates punishment scrolls to punish(). The same ball pointer
// drives insight.c status and zap.c polymorph immunity.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { seffects, punish, unpunish } from '../js/read.js';
import { enlightenment } from '../js/insight.js';
import { obj_unpolyable } from '../js/zap.js';
import { mksobj } from '../js/mkobj.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { OBJ_FREE, OBJ_FLOOR, WT_IRON_BALL_INCR } from '../js/const.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';

const segment = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/recorder-meta-keys.json', import.meta.url))).segments[0];

async function setup() {
    const replay = await runSegment({ ...segment, moves: ' ',
        storage: new InMemoryStorage() });
    replay._display.onEmptyQueue = () => 0x1b;
    game._toplines = '';
    game._msg_history = [];
}

function scroll(blessed = false, cursed = false) {
    const obj = mksobj(ONAMES.SCR_PUNISHMENT, false, false);
    obj.blessed = blessed;
    obj.cursed = cursed;
    return obj;
}

for (const name of ['PM_ACID_BLOB', 'PM_AIR_ELEMENTAL', 'PM_WRAITH']) {
    test(`punishment falls away from ${name}`, async () => {
        await setup();
        game.u.umonnum = PMNAMES[name];
        game.youmonst.data = game.mons[PMNAMES[name]];
        await seffects(scroll());
        assert.ok(!game.u.uball && !game.u.uchain);
        const dropped = game.level.objects.filter(obj =>
            obj.otyp === ONAMES.HEAVY_IRON_BALL && obj.ox === game.u.ux
            && obj.oy === game.u.uy);
        assert.equal(dropped.length, 1);
        assert.equal(dropped[0].where, OBJ_FLOOR);
        assert.match([...game._msg_history, game._toplines].join('\n'),
            /A ball and chain appears, then falls away/);
    });
}

test('swallowed heroes receive unplaced ball and chain objects', async () => {
    await setup();
    game.u.uswallow = true;
    await seffects(scroll());
    assert.ok(game.u.uball && game.u.uchain);
    assert.equal(game.u.uball.where, OBJ_FREE);
    assert.equal(game.u.uchain.where, OBJ_FREE);
    assert.ok(!game.level.objects.includes(game.u.uball));
    assert.ok(!game.level.objects.includes(game.u.uchain));
});

for (const confused of [false, true]) {
    test(`blessing or confusion prevents punishment, confused=${confused}`, async () => {
        await setup();
        game.u.intrinsic.HConfusion = confused ? 10 : 0;
        await seffects(scroll(!confused));
        assert.ok(game.known);
        assert.ok(!game.u.uball && !game.u.uchain);
        assert.equal(game._toplines.trim(), 'You feel guilty.');
    });
}

for (const cursed of [false, true]) {
    test(`repeated punishment makes the existing ball heavier, cursed=${cursed}`, async () => {
        await setup();
        await punish(null);
        const ball = game.u.uball, weight = ball.owt;
        await seffects(scroll(false, cursed));
        assert.equal(game.u.uball, ball);
        assert.equal(ball.owt, weight + WT_IRON_BALL_INCR * (1 + Number(cursed)));
    });
}

test('enlightenment reports punishment created outside the scroll handler', async () => {
    await setup();
    await punish(null);
    assert.match(enlightenment().join('\n'), /chained to a heavy iron ball/);
    unpunish();
    assert.doesNotMatch(enlightenment().join('\n'), /chained to/);
});

for (const slot of ['uball', 'uskin']) {
    test(`${slot} resists polymorph without spending a resistance draw`, async () => {
        await setup();
        let obj;
        if (slot === 'uball') {
            await punish(null);
            obj = game.u.uball;
        } else {
            obj = mksobj(ONAMES.GRAY_DRAGON_SCALE_MAIL, false, false);
            game.u.uskin = obj;
        }
        initRng(2);
        enableRngLog();
        assert.equal(obj_unpolyable(obj), true);
        assert.deepEqual(getRngLog(), []);
        if (slot === 'uball') unpunish();
        else game.u.uskin = null;
        enableRngLog();
        obj_unpolyable(obj);
        assert.equal(getRngLog().length, 1);
    });
}
