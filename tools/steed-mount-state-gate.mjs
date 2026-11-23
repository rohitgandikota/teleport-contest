#!/usr/bin/env node
// Constructed states for src/steed.c mount_steed(). Expectations follow the
// pinned C branches; native session replays separately cover integration.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { mount_steed } from '../js/steed.js';
import { remove_monster, place_monster } from '../js/makemon.js';
import { which_armor } from '../js/worn.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { ROOM, DOOR, D_ISOPEN, W_SADDLE, I_SPECIAL } from '../js/const.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/variant-steed.json', import.meta.url)));

async function setup() {
    const replay = await runSegment({ ...recipe.segments[0], moves: '  n',
        storage: new InMemoryStorage() });
    replay._display.onEmptyQueue = () => 0x20;
    const pony = game.level.monsters.find(m => m.mnum === PMNAMES.PM_PONY);
    assert.ok(pony, 'Knight setup has its starting pony');
    remove_monster(pony.mx, pony.my);
    game.u.ux = 30;
    game.u.uy = 10;
    game.u.dx = 1;
    game.u.dy = 0;
    for (let x = 29; x <= 32; x++) {
        for (let y = 9; y <= 12; y++) {
            game.level.at(x, y).typ = ROOM;
            game.level.at(x, y).doormask = 0;
        }
    }
    place_monster(pony, 31, 10);
    game.u.ulevel = 30;
    game.u.uhp = game.u.uhpmax = 200;
    game._toplines = '';
    game._msg_history = [];
    initRng(19);
    enableRngLog();
    return { pony, saddle: which_armor(pony, W_SADDLE) };
}

function messages() {
    return [...game._msg_history, game._toplines].join('\n');
}

test('non-Knight mounting reduces tameness even when the mount slips', async () => {
    const { pony, saddle } = await setup();
    game.urole = { ...game.urole, mnum: PMNAMES.PM_WIZARD };
    pony.mtame = 5;
    saddle.cursed = true;
    assert.equal(await mount_steed(pony, false), false);
    assert.equal(pony.mtame, 4);
    assert.ok(game.u.uhp < 200, 'the failed mount costs hit points');
});

test('loss of the last tameness point detaches the leash without rolling', async () => {
    const { pony } = await setup();
    game.urole = { ...game.urole, mnum: PMNAMES.PM_WIZARD };
    pony.mtame = 1;
    pony.mleashed = true;
    const leash = { otyp: ONAMES.LEASH, leashmon: pony.m_id };
    game.invent.push(leash);
    assert.equal(await mount_steed(pony, false), false);
    assert.equal(pony.mtame, 0);
    assert.equal(!!pony.mleashed, false);
    assert.equal(leash.leashmon, 0);
    assert.match(messages(), /resists and its leash comes off!/);
    assert.deepEqual(getRngLog(), []);
});

test('Knight and forced mounts preserve tameness', async () => {
    for (const force of [false, true]) {
        const { pony } = await setup();
        if (force) game.urole = { ...game.urole, mnum: PMNAMES.PM_WIZARD };
        pony.mtame = 1;
        assert.equal(await mount_steed(pony, force), true);
        assert.equal(pony.mtame, 1);
        assert.equal(game.u.usteed, pony);
    }
});

test('a diagonal doorway blocks even a forced mount', async () => {
    const { pony } = await setup();
    remove_monster(pony.mx, pony.my);
    place_monster(pony, 31, 11);
    game.u.dy = 1;
    game.level.at(31, 11).typ = DOOR;
    game.level.at(31, 11).doormask = D_ISOPEN;
    assert.equal(await mount_steed(pony, true), false);
    assert.equal(game.u.usteed || null, null);
    assert.match(messages(), /unable to swing your leg over/);
    assert.deepEqual(getRngLog(), []);
});

test('a long worm tail is rejected before movement and saddle checks', async () => {
    const { pony } = await setup();
    pony.mnum = PMNAMES.PM_LONG_WORM;
    pony.data = game.mons[pony.mnum];
    pony.mx = 32;
    assert.equal(await mount_steed(pony, true), false);
    assert.match(messages(), /let alone its tail/);
    assert.deepEqual(getRngLog(), []);
});

test('fumbling slips and damages the hero after the saddle checks', async () => {
    const { pony } = await setup();
    game.u.uprops.FUMBLING = 1;
    assert.equal(await mount_steed(pony, false), false);
    assert.match(messages(), /slip while trying to get on/);
    assert.ok(game.u.uhp < 200);
    assert.ok(getRngLog().some(r => r.startsWith('rn2(5)=')));
    assert.ok(!getRngLog().some(r => r.startsWith('rnd(20)=')));
});

test('intrinsic fumbling uses the same slip branch', async () => {
    const { pony } = await setup();
    game.u.intrinsic.HFumbling = 1;
    assert.equal(await mount_steed(pony, false), false);
    assert.match(messages(), /slip while trying to get on/);
});

test('half physical damage rounds mounting damage up', async () => {
    const damage = [];
    for (const half of [false, true]) {
        const { pony, saddle } = await setup();
        saddle.cursed = true;
        game.u.uprops.HALF_PHDAM = half ? 1 : 0;
        assert.equal(await mount_steed(pony, false), false);
        damage.push(200 - game.u.uhp);
    }
    assert.equal(damage[1], Math.ceil(damage[0] / 2));
});

test('underwater refusal follows tameness loss and names the liquid', async () => {
    const { pony } = await setup();
    game.urole = { ...game.urole, mnum: PMNAMES.PM_WIZARD };
    game.u.uinwater = true;
    const tame = pony.mtame;
    assert.equal(await mount_steed(pony, false), false);
    assert.equal(pony.mtame, tame - 1);
    assert.match(messages(), /can't ride that creature while under water/);
    assert.deepEqual(getRngLog(), []);
});

test('punishment blocks mounting through the canonical ball property', async () => {
    const { pony } = await setup();
    game.u.uball = { otyp: ONAMES.HEAVY_IRON_BALL };
    assert.equal(await mount_steed(pony, true), false);
    assert.match(messages(), /unable to swing your leg over/);
});

test('a levitating slip does not hurt the hero', async () => {
    const { pony, saddle } = await setup();
    saddle.cursed = true;
    game.u.intrinsic.HLevitation = I_SPECIAL | 100;
    assert.equal(await mount_steed(pony, false), false);
    assert.match(messages(), /slips away from you/);
    assert.equal(game.u.uhp, 200);
    assert.deepEqual(getRngLog(), []);
});

test('levitation at will floats a ground steed up before mounting', async () => {
    const { pony } = await setup();
    game.u.intrinsic.HLevitation = I_SPECIAL | 100;
    assert.equal(await mount_steed(pony, false), true);
    assert.match(messages(), /magically floats up!/);
});

test('intrinsic flight gives the joint takeoff message', async () => {
    const { pony } = await setup();
    game.u.intrinsic.HFlying = 1;
    assert.equal(await mount_steed(pony, false), true);
    assert.match(messages(), /take flight together/);
});

test('petrifying touch precedes refusal of an unsuitable mount', async () => {
    const { pony } = await setup();
    // A constructed saddled cockatrice isolates the touch guard. This is
    // not a claim that ordinary saddle application can create this state.
    pony.mnum = PMNAMES.PM_COCKATRICE;
    pony.data = game.mons[pony.mnum];
    game.wizard = false;
    await assert.rejects(mount_steed(pony, true), /nh_terminate/);
    assert.equal(game.killer.name, 'attempting to ride a cockatrice');
});

test('stone resistance skips petrification but still checks mount suitability', async () => {
    const { pony } = await setup();
    pony.mnum = PMNAMES.PM_COCKATRICE;
    pony.data = game.mons[pony.mnum];
    game.u.uprops.STONE_RES = 1;
    assert.equal(await mount_steed(pony, true), false);
    assert.match(messages(), /can't ride such a creature/);
    assert.equal(game.u.uhp, 200);
});
