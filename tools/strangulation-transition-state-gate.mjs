// C polyself.c check_strangling and its private Strangled consumer contract.
// Real equipment, form, timeout and input producers; no helper substitutions.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup, clearMessages, messages, seed } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { setworn } from '../js/worn.js';
import { Amulet_on, Amulet_off } from '../js/do_wear.js';
import { polymon, rehumanize, check_strangling, dobreathe } from '../js/polyself.js';
import { can_be_strangled } from '../js/mondata.js';
import { set_itimeout, incr_itimeout } from '../js/potion.js';
import { nh_timeout } from '../js/timeout.js';
import { pline } from '../js/display.js';
import { getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { W_AMUL, OBJ_INVENT, ECMD_OK, ECMD_CANCEL } from '../js/const.js';

async function amulet(type = 'AMULET_OF_STRANGULATION') {
    const obj = await addinv(mksobj(ONAMES[type], false, false));
    await Amulet_on(obj);
    return obj;
}

function reset(run) {
    clearMessages();
    run._display.clearInputQueue();
    game.command_queue = [];
    seed();
}

async function pause(run, action) {
    let arrived, release;
    const atInput = new Promise(resolve => { arrived = resolve; });
    run._display.onEmptyQueue = () => {
        arrived();
        return new Promise(resolve => { release = resolve; });
    };
    const pending = action();
    const stopped = await Promise.race([atInput.then(() => true), pending.then(() => false)]);
    return { stopped, pending, resume(key = 32) {
        run._display.onEmptyQueue = () => 32;
        release?.(key);
    } };
}

for (const species of ['PM_IRON_GOLEM', 'PM_GELATINOUS_CUBE']) {
    test(`real polymorph to ${species} cancels the countdown and keeps the equipment mask`, async () => {
        const run = await setup();
        const obj = await amulet();
        assert.equal(game.u.intrinsic.HStrangled, 6);
        reset(run);
        assert.equal(await polymon(PMNAMES[species]), 1);
        assert.equal(can_be_strangled(game.youmonst), false);
        assert.equal(game.u.intrinsic.HStrangled, 0);
        assert.equal(game.u.uprops.STRANGLED, W_AMUL);
        assert.equal(game.u.uamul, obj);
        assert.equal(obj.owornmask, W_AMUL);
        assert.equal(obj.where, OBJ_INVENT);
        assert.match(messages(), /no longer being strangled/);
        reset(run);
        await nh_timeout();
        assert.equal(game.u.intrinsic.HStrangled, 0);
        assert.doesNotMatch(messages(), /constrict|blood|suffocat|gasp/);
        assert.deepEqual(getRngLog(), []);
    });
}

test('a vulnerable-to-vulnerable transition resets the actual remaining deadline', async () => {
    const run = await setup();
    const obj = await amulet();
    await nh_timeout();
    await nh_timeout();
    assert.equal(game.u.intrinsic.HStrangled, 4);
    reset(run);
    assert.equal(await polymon(PMNAMES.PM_VAMPIRE), 1);
    assert.equal(can_be_strangled(game.youmonst), true);
    assert.equal(game.u.intrinsic.HStrangled, 6);
    assert.equal(game.u.uprops.STRANGLED, W_AMUL);
    assert.equal(game.u.uamul, obj);
    assert.match(messages(), /still constricts your neck/);
    assert.doesNotMatch(messages(), /no longer being strangled/);
});

test('real rehumanization starts a previously immune worn amulet and says begins', async () => {
    const run = await setup();
    assert.equal(await polymon(PMNAMES.PM_IRON_GOLEM), 1);
    const obj = await amulet();
    assert.equal(game.u.intrinsic.HStrangled || 0, 0);
    assert.equal(!!game.objects[obj.otyp].oc_name_known, false);
    reset(run);
    await rehumanize();
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.intrinsic.HStrangled, 6);
    assert.equal(game.u.uprops.STRANGLED, W_AMUL);
    assert.equal(game.u.uamul, obj);
    assert.match(messages(), /begins constricting your neck/);
    assert.equal(!!game.objects[obj.otyp].oc_name_known, true);
});

for (const action of [false, true]) {
    test(`an already immune wearer stays silent, check on=${action}`, async () => {
        const run = await setup();
        assert.equal(await polymon(PMNAMES.PM_IRON_GOLEM), 1);
        const obj = await amulet();
        reset(run);
        await check_strangling(action);
        assert.equal(game.u.intrinsic.HStrangled || 0, 0);
        assert.equal(game.u.uprops.STRANGLED, W_AMUL);
        assert.equal(game.u.uamul, obj);
        assert.equal(!!game.objects[obj.otyp].oc_name_known, false);
        assert.equal(messages(), '');
        assert.deepEqual(getRngLog(), []);
    });
}

for (const type of [null, 'AMULET_OF_REFLECTION']) {
    test(`resume without a strangulation amulet retains a wizard timer, ${type}`, async () => {
        const run = await setup();
        if (type)
            await amulet(type);
        incr_itimeout('HStrangled', 3);
        reset(run);
        await check_strangling(true);
        assert.equal(game.u.intrinsic.HStrangled, 3);
        assert.equal(messages(), '');
        assert.deepEqual(getRngLog(), []);
    });
}

test('cancellation applies to a real wizard timer even without an amulet', async () => {
    const run = await setup();
    assert.equal(await polymon(PMNAMES.PM_IRON_GOLEM), 1);
    incr_itimeout('HStrangled', 3);
    reset(run);
    await check_strangling(false);
    assert.equal(game.u.intrinsic.HStrangled, 0);
    assert.equal(game.u.uamul || null, null);
    assert.match(messages(), /no longer being strangled/);
    assert.deepEqual(getRngLog(), []);
});

test('cancellation leaves a vulnerable wizard timer and all source masks intact', async () => {
    const run = await setup();
    incr_itimeout('HStrangled', 3);
    reset(run);
    await check_strangling(false);
    assert.equal(game.u.intrinsic.HStrangled, 3);
    assert.equal(game.u.uprops.STRANGLED || 0, 0);
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), []);
});

test('repeated cancellation is silent and consumes no further RNG', async () => {
    const run = await setup();
    await amulet();
    await polymon(PMNAMES.PM_IRON_GOLEM);
    reset(run);
    await check_strangling(false);
    await check_strangling(false);
    assert.equal(game.u.intrinsic.HStrangled, 0);
    assert.equal(game.u.uprops.STRANGLED, W_AMUL);
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), []);
});

test('normal removal followed by resume does not recreate a timeout', async () => {
    const run = await setup();
    const obj = await amulet();
    await Amulet_off();
    reset(run);
    await check_strangling(true);
    assert.equal(game.u.intrinsic.HStrangled, 0);
    assert.equal(game.u.uprops.STRANGLED || 0, 0);
    assert.equal(obj.owornmask, 0);
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), []);
});

test('cancellation clears the real timeout before a pending More message', async () => {
    const run = await setup();
    await polymon(PMNAMES.PM_IRON_GOLEM);
    incr_itimeout('HStrangled', 3);
    reset(run);
    await pline('This preceding message fills enough of the line to need acknowledgement.');
    const held = await pause(run, () => check_strangling(false));
    const timer = game.u.intrinsic.HStrangled;
    held.resume();
    await held.pending;
    assert.equal(held.stopped, true);
    assert.equal(timer, 0);
    assert.deepEqual(getRngLog(), []);
});

test('resume sets the countdown before More and discovers the amulet afterward', async () => {
    const run = await setup();
    const obj = await addinv(mksobj(ONAMES.AMULET_OF_STRANGULATION, false, false));
    // Real equipment producer makes the intermediate state used by a form change.
    await setworn(obj, W_AMUL);
    reset(run);
    await pline('This preceding message fills enough of the line to need acknowledgement.');
    const held = await pause(run, () => check_strangling(true));
    const during = { timer: game.u.intrinsic.HStrangled || 0,
        mask: game.u.uprops.STRANGLED, known: !!game.objects[obj.otyp].oc_name_known };
    held.resume();
    await held.pending;
    assert.equal(held.stopped, true);
    assert.deepEqual(during, { timer: 6, mask: W_AMUL, known: false });
    assert.equal(!!game.objects[obj.otyp].oc_name_known, true);
    assert.match(messages(), /begins constricting your neck/);
    assert.deepEqual(getRngLog(), ['rn2(19)=4']);
});

test('resuming an already active countdown keeps the still-constricts wording', async () => {
    const run = await setup();
    await amulet();
    set_itimeout('HStrangled', 2);
    reset(run);
    await check_strangling(true);
    assert.equal(game.u.intrinsic.HStrangled, 6);
    assert.equal(game.u.uprops.STRANGLED, W_AMUL);
    assert.match(messages(), /still constricts your neck/);
    assert.deepEqual(getRngLog(), []);
});

test('breath command rejects a real intrinsic timer before energy or direction input', async () => {
    const run = await setup();
    await polymon(PMNAMES.PM_RED_DRAGON);
    incr_itimeout('HStrangled', 3);
    game.u.uen = 30; // Constructed resource fixture, not an ordinary-input claim.
    reset(run);
    let reads = 0;
    run._display.onEmptyQueue = () => { reads++; return 27; };
    assert.equal(await dobreathe(), ECMD_OK);
    assert.equal(reads, 0);
    assert.equal(game.u.uen, 30);
    assert.equal(game.u.intrinsic.HStrangled, 3);
    assert.match(messages(), /can't breathe\.  Sorry/);
    assert.deepEqual(getRngLog(), []);
});

test('immune amulet wearer reaches real breath direction input without losing the source mask', async () => {
    const run = await setup();
    await polymon(PMNAMES.PM_IRON_GOLEM);
    const obj = await amulet();
    game.u.uen = 30;
    reset(run);
    const held = await pause(run, () => dobreathe());
    const energy = game.u.uen;
    held.resume(27);
    assert.equal(await held.pending, ECMD_CANCEL);
    assert.equal(held.stopped, true);
    assert.equal(energy, 15);
    assert.equal(game.u.uamul, obj);
    assert.equal(game.u.uprops.STRANGLED, W_AMUL);
    assert.equal(game.u.intrinsic.HStrangled || 0, 0);
    assert.deepEqual(getRngLog(), []);
});

test('a healthy breath user with low energy keeps the original refusal', async () => {
    const run = await setup();
    await polymon(PMNAMES.PM_RED_DRAGON);
    game.u.uen = 0;
    reset(run);
    assert.equal(await dobreathe(), ECMD_OK);
    assert.equal(game.u.uen, 0);
    assert.match(messages(), /don't have enough energy/);
    assert.deepEqual(getRngLog(), []);
});

test('a healthy breath user can cancel direction after paying the original energy cost', async () => {
    const run = await setup();
    await polymon(PMNAMES.PM_RED_DRAGON);
    game.u.uen = 30;
    reset(run);
    run._display.pushKey(27);
    assert.equal(await dobreathe(), ECMD_CANCEL);
    assert.equal(game.u.uen, 15);
    assert.deepEqual(getRngLog(), []);
});
