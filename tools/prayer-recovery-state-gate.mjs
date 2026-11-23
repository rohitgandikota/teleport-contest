#!/usr/bin/env node
// C pray.c repairs troubles in priority order. The prayer action controls
// whether it fixes one major trouble, all major troubles, or every trouble.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { dopray, in_trouble } from '../js/pray.js';
import { mksobj } from '../js/mkobj.js';
import { addinv, weight } from '../js/invent.js';
import { setworn } from '../js/worn.js';
import { make_stoned, make_slimed, make_confused } from '../js/potion.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { near_capacity } from '../js/attrib.js';
import { ONAMES } from '../js/objects_data.js';
import { ALTAR, AM_NEUTRAL, W_ARMH, HVY_ENCUMBER, ECMD_TIME } from '../js/const.js';

const segment = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/recorder-meta-keys.json', import.meta.url))).segments[0];

async function setup() {
    const replay = await runSegment({ ...segment, moves: ' ',
        storage: new InMemoryStorage() });
    let extraKeys = 0;
    replay._display.onEmptyQueue = () => {
        assert.ok(++extraKeys < 100, 'prayer must finish repairing its troubles');
        return 0x1b;
    };
    game.flags.paranoia_bits = 0;
    game.wizard = false;
    game.u.ublesscnt = 0;
    game.u.ualign.record = 4;
    game.u.uluck = 2;
    const square = game.level.at(game.u.ux, game.u.uy);
    square.typ = ALTAR;
    square.altarmask = AM_NEUTRAL;
    game._toplines = game._pending_message = '';
    game._msg_history = [];
    game._toplin = 0;
}

async function item(otyp, cursed = true, quan = 1) {
    const obj = mksobj(otyp, false, false);
    obj.cursed = cursed;
    obj.quan = quan;
    obj.owt = weight(obj);
    return await addinv(obj);
}

async function finishPrayer(seed) {
    assert.equal(await dopray(), ECMD_TIME);
    initRng(seed);
    enableRngLog();
    await game.afternmv();
    assert.ok(!game.u.uinvulnerable);
}

for (const [action, seed] of [[1, 1], [2, 3], [3, 14], [4, 2], [5, 5]]) {
    test(`prayer action ${action} repairs the required sequence of troubles`, async () => {
        await setup();
        await make_stoned(5, null, 0, null);
        await make_slimed(10, null);
        game.u.intrinsic.HStrangled = 6;
        await make_confused(20, false);
        assert.equal(in_trouble(), 14); // TROUBLE_STONED
        await finishPrayer(seed);
        assert.equal(getRngLog()[0], `rn2(5)=${action - 1}`);
        assert.ok(!game.u.uprops.STONED);
        assert.equal(!!game.u.uprops.SLIMED, action === 1);
        assert.equal(!!game.u.intrinsic.HStrangled, action === 1);
        assert.equal(!!game.u.intrinsic.HConfusion, action < 4);
    });
}

for (const otyp of [ONAMES.LOADSTONE, ONAMES.LUCKSTONE]) {
    test(`prayer recognizes an unworn cursed stone, type=${otyp}`, async () => {
        await setup();
        await item(ONAMES.DAGGER, false);
        await item(otyp);
        assert.equal(in_trouble(), -3); // TROUBLE_CURSED_ITEMS
    });
}

test('an ordinary unworn cursed object is not a prayer trouble', async () => {
    await setup();
    await item(ONAMES.DAGGER);
    assert.equal(in_trouble(), 0);
});

test('an uncursed luckstone is not a prayer trouble', async () => {
    await setup();
    await item(ONAMES.LUCKSTONE, false);
    assert.equal(in_trouble(), 0);
});

test('a heavy cursed loadstone takes priority over worn cursed armor', async () => {
    await setup();
    const helmet = await item(ONAMES.HELMET);
    setworn(helmet, W_ARMH);
    const stone = await item(ONAMES.LOADSTONE, true, 4);
    assert.ok(near_capacity() >= HVY_ENCUMBER);
    await finishPrayer(14); // action 3 fixes only the worst minor trouble
    assert.ok(!stone.cursed);
    assert.ok(helmet.cursed);
});

test('worn cursed armor takes priority over an unworn light loadstone', async () => {
    await setup();
    const stone = await item(ONAMES.LOADSTONE);
    const helmet = await item(ONAMES.HELMET);
    setworn(helmet, W_ARMH);
    assert.ok(near_capacity() < HVY_ENCUMBER);
    await finishPrayer(14);
    assert.ok(stone.cursed);
    assert.ok(!helmet.cursed);
});

test('the native multiple-curse input repairs all three cursed objects', async () => {
    const recipe = JSON.parse(readFileSync(new URL(
        'gen-sessions/recipes/prayer-multiple-curses.json', import.meta.url)));
    await runSegment({ ...recipe.segments[0], storage: new InMemoryStorage() });
    for (const otyp of [ONAMES.HELMET, ONAMES.T_SHIRT, ONAMES.LOADSTONE]) {
        const obj = game.invent.find(obj => obj.otyp === otyp);
        assert.ok(obj);
        assert.ok(!obj.cursed);
        assert.ok(obj.bknown);
    }
});
