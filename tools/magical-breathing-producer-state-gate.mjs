#!/usr/bin/env node
// Source-derived controls, not a new native oracle or full-game coverage claim.
import { register } from 'node:module';
register('./magical-breathing-state-loader.mjs', import.meta.url);
// Real wizard menu, intrinsic storage and nh_timeout controls. No mocks.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
const { runSegment } = await import('../js/jsmain.js');
const { InMemoryStorage } = await import('../js/storage.js');
import { game } from '../js/gstate.js';
const { wiz_intrinsic, wiz_intrinsic_timeout } = await import('../js/wizcmds.js');
const { nh_timeout } = await import('../js/timeout.js');
const { set_itimeout } = await import('../js/potion.js');
const { Breathless } = await import('../js/youprop.js');
const { Amulet_on, Amulet_off } = await import('../js/do_wear.js');
const { mksobj } = await import('../js/mkobj.js');
const { addinv } = await import('../js/invent.js');
const { create_gas_cloud } = await import('../js/region.js');
const { pushKeys, resetInputState } = await import('../js/input.js');
const { initRng, enableRngLog, getRngLog } = await import('../js/rng.js');
const { ONAMES } = await import('../js/objects_data.js');
const { PMNAMES } = await import('../js/monst_data.js');
const { FROMOUTSIDE, TIMEOUT, W_AMUL, ROOM } = await import('../js/const.js');

const segment = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/command-result-flags.json', import.meta.url))).segments[0];

async function setup(equipment = 'none') {
    const run = await runSegment({ ...segment, moves: ' ', storage: new InMemoryStorage() });
    let dismissals = 0;
    run._display.onEmptyQueue = () => {
        if (++dismissals > 30) throw Error('unexpected repeated prompt');
        return 0x1b;
    };
    game._preNhgetchHook = null;
    game.u.intrinsic = {}; game.u.uprops = {}; game.u.blocked = {};
    game.u.wiz_intrinsic_timeouts = {}; game.u.wiz_intrinsic_base_props = {};
    game.u.uinwater = false; game.u.uinvulnerable = false;
    game.u.ux = 30; game.u.uy = 10;
    game.u.uhp = game.u.uhpmax = 200;
    game.u.mtimedone = 0; game.u.usptime = 0;
    game.moves = 1; game.regions = []; game.timer_base = [];
    game.level.monsters = []; game.level.monAt.clear();
    for (let x = 28; x <= 32; x++) for (let y = 8; y <= 12; y++)
        game.level.at(x, y).typ = ROOM;
    let amulet;
    if (equipment !== 'none') {
        amulet = mksobj(ONAMES.AMULET_OF_MAGICAL_BREATHING, false, false);
        addinv(amulet);
        if (equipment === 'worn') await Amulet_on(amulet);
    }
    clearMessages();
    return amulet;
}
function clearMessages() {
    game._toplines = ''; game._msg_history = []; game._toplin = 0;
    game._pending_message = ''; game._win_stop = false;
}
function messages() { return [...game._msg_history, game._toplines].join('\n'); }
function intrinsic() { return game.u.intrinsic.HMagical_breathing || 0; }
function extrinsic() { return game.u.uprops.MAGICAL_BREATHING || 0; }
function seed() { initRng(3); enableRngLog(); }
function noFallback() {
    assert.equal(game.u.wiz_intrinsic_timeouts?.MAGICAL_BREATHING, undefined);
    assert.equal(game.u.wiz_intrinsic_base_props?.MAGICAL_BREATHING, undefined);
}
async function addTimeout(amount) {
    clearMessages(); resetInputState();
    pushKeys(`>${amount}g\r`);
    await wiz_intrinsic();
    resetInputState();
}

for (const equipment of ['none', 'carried', 'worn']) {
    test(`already canonical intrinsic counts down with ${equipment} equipment`, async () => {
        await setup(equipment);
        game.u.intrinsic.HMagical_breathing = 3;
        seed();
        for (const remaining of [2, 1, 0]) {
            await nh_timeout();
            assert.equal(intrinsic(), remaining);
            assert.equal(extrinsic(), equipment === 'worn' ? W_AMUL : 0);
            assert.equal(Breathless(), remaining > 0 || equipment === 'worn');
        }
        noFallback();
        assert.deepEqual(getRngLog(), []);
    });
    test(`wizard apply/countdown/expiry preserves ${equipment} equipment`, async () => {
        await setup(equipment);
        const mask = equipment === 'worn' ? W_AMUL : 0;
        seed(); await addTimeout(3);
        assert.equal(intrinsic(), 3);
        assert.equal(extrinsic(), mask);
        assert.equal(wiz_intrinsic_timeout('MAGICAL_BREATHING'), 3);
        assert.match(messages(), /Timeout for magical breathing set to 3\./);
        noFallback();
        for (const remaining of [2, 1, 0]) {
            await nh_timeout();
            assert.equal(intrinsic(), remaining);
            assert.equal(extrinsic(), mask);
            assert.equal(Breathless(), remaining > 0 || !!mask);
            assert.equal(wiz_intrinsic_timeout('MAGICAL_BREATHING'), remaining);
            noFallback();
        }
        assert.deepEqual(getRngLog(), []);
    });
    test(`wizard extends an existing intrinsic with ${equipment} equipment`, async () => {
        await setup(equipment);
        game.u.intrinsic.HMagical_breathing = FROMOUTSIDE | 7;
        seed();
        assert.equal(wiz_intrinsic_timeout('MAGICAL_BREATHING'), 7);
        await addTimeout(5);
        assert.equal(intrinsic(), FROMOUTSIDE | 12);
        assert.equal(extrinsic(), equipment === 'worn' ? W_AMUL : 0);
        assert.match(messages(), /Timeout for magical breathing increased by 5\./);
        noFallback();
        assert.deepEqual(getRngLog(), []);
    });
    test(`zeroing a canonical timeout preserves ${equipment} equipment`, async () => {
        await setup(equipment);
        seed(); await addTimeout(5);
        assert.equal(intrinsic(), 5);
        set_itimeout('HMagical_breathing', 0);
        await nh_timeout();
        assert.equal(intrinsic(), 0);
        assert.equal(extrinsic(), equipment === 'worn' ? W_AMUL : 0);
        assert.equal(Breathless(), equipment === 'worn');
        assert.equal(wiz_intrinsic_timeout('MAGICAL_BREATHING'), 0);
        noFallback();
        assert.deepEqual(getRngLog(), []);
    });
}
test('canonical timeout plus permanent source retains the source bit at expiry', async () => {
    await setup('worn');
    game.u.intrinsic.HMagical_breathing = FROMOUTSIDE | 1;
    seed(); await nh_timeout();
    assert.equal(intrinsic(), FROMOUTSIDE);
    assert.equal(extrinsic(), W_AMUL);
    assert.equal(wiz_intrinsic_timeout('MAGICAL_BREATHING'), 0);
    assert.equal(Breathless(), true);
    assert.deepEqual(getRngLog(), []);
});
test('zeroing preserves permanent intrinsic bits as well as the amulet mask', async () => {
    await setup('worn');
    game.u.intrinsic.HMagical_breathing = FROMOUTSIDE | 12;
    seed(); set_itimeout('HMagical_breathing', 0); await nh_timeout();
    assert.equal(intrinsic(), FROMOUTSIDE);
    assert.equal(extrinsic(), W_AMUL);
    assert.deepEqual(getRngLog(), []);
});
test('wizard increment clamps at TIMEOUT and preserves permanent bits and mask', async () => {
    await setup('worn');
    game.u.intrinsic.HMagical_breathing = FROMOUTSIDE | (TIMEOUT - 2);
    seed(); await addTimeout(5);
    assert.equal(intrinsic(), FROMOUTSIDE | TIMEOUT);
    assert.equal(extrinsic(), W_AMUL);
    noFallback();
    assert.deepEqual(getRngLog(), []);
});
test('putting on an amulet during a wizard timeout survives countdown and expiry', async () => {
    const amulet = await setup('carried');
    await addTimeout(2);
    await Amulet_on(amulet);
    seed(); await nh_timeout();
    assert.equal(intrinsic(), 1); assert.equal(extrinsic(), W_AMUL);
    await nh_timeout();
    assert.equal(intrinsic(), 0); assert.equal(extrinsic(), W_AMUL);
    assert.equal(game.u.uamul, amulet);
    assert.equal(Breathless(), true);
    noFallback();
    assert.deepEqual(getRngLog(), []);
});
test('removing an amulet during a wizard timeout never resurrects its old mask', async () => {
    await setup('worn');
    await addTimeout(2);
    await Amulet_off();
    seed(); await nh_timeout();
    assert.equal(intrinsic(), 1); assert.equal(extrinsic(), 0);
    await nh_timeout();
    assert.equal(intrinsic(), 0); assert.equal(extrinsic(), 0);
    assert.equal(game.u.uamul, null);
    assert.equal(Breathless(), false);
    noFallback();
    assert.deepEqual(getRngLog(), []);
});
test('prayer invulnerability freezes the intrinsic without changing equipment', async () => {
    await setup('worn'); await addTimeout(3);
    game.u.uinvulnerable = true;
    seed(); await nh_timeout();
    assert.equal(intrinsic(), 3); assert.equal(extrinsic(), W_AMUL);
    assert.deepEqual(getRngLog(), []);
});
for (const protection of ['none', 'worn', 'permanent', 'vampire']) {
    test(`wizard timeout gas warning and expiry with ${protection} protection`, async () => {
        await setup(protection === 'worn' ? 'worn' : 'carried');
        await create_gas_cloud(game.u.ux, game.u.uy, 1, 8);
        if (protection === 'permanent') game.u.intrinsic.HMagical_breathing = FROMOUTSIDE;
        if (protection === 'vampire') {
            game.u.umonnum = PMNAMES.PM_VAMPIRE;
            game.youmonst.data = game.mons[PMNAMES.PM_VAMPIRE];
        }
        await addTimeout(3);
        clearMessages(); seed();
        await nh_timeout();
        if (protection === 'none') assert.match(messages(), /The air here seems foul\./);
        else assert.equal(messages().trim(), '');
        await nh_timeout(); await nh_timeout();
        assert.equal(intrinsic(), protection === 'permanent' ? FROMOUTSIDE : 0);
        assert.equal(extrinsic(), protection === 'worn' ? W_AMUL : 0);
        if (protection === 'none') assert.match(messages(), /You cough and spit blood!/);
        else assert.doesNotMatch(messages(), /cough|spit blood/);
        assert.deepEqual(getRngLog(), []);
    });
}
