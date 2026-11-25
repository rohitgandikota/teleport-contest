// Behavioral contracts from pinned src/do_wear.c Amulet_on(), with real producers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { setup, clearMessages, messages, seed, x, y } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { resetInputState } from '../js/input.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { oname } from '../js/do_name.js';
import { Amulet_on, Amulet_off, accessory_or_armor_on, find_ac } from '../js/do_wear.js';
import { setuwep, setuswapwep, setuqwep } from '../js/wield.js';
import { polymon, poly_gender } from '../js/polyself.js';
import { poly_obj } from '../js/zap.js';
import { make_slimed, incr_itimeout } from '../js/potion.js';
import { delayed_killer, find_delayed_killer } from '../js/end.js';
import { create_gas_cloud, region_danger } from '../js/region.js';
import { addtobill, onbill, costly_spot } from '../js/shk.js';
import { Flying, Breathless, Unchanging } from '../js/youprop.js';
import { pline } from '../js/display.js';
import { getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { ECMD_TIME, W_AMUL, FROMOUTSIDE, TIMEOUT, SLIMED, KILLED_BY_AN,
    OBJ_INVENT, OBJ_DELETED, OBJ_ONBILL } from '../js/const.js';

async function item(type, artifact = null) {
    let obj = mksobj(ONAMES[type], false, false);
    if (artifact)
        obj = await oname(obj, artifact, 0);
    return await addinv(obj);
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
    const stopped = await Promise.race([
        atInput.then(() => true), pending.then(() => false),
    ]);
    return { stopped, pending, resume(key = 32) {
        run._display.onEmptyQueue = () => 32;
        release?.(key);
    } };
}

for (const type of ['AMULET_OF_ESP', 'AMULET_OF_LIFE_SAVING',
    'AMULET_VERSUS_POISON', 'AMULET_OF_REFLECTION', 'FAKE_AMULET_OF_YENDOR',
    'AMULET_OF_YENDOR']) {
    test(`${type} keeps inventory ownership and gives one wearing line`, async () => {
        const run = await setup();
        const amul = await item(type);
        reset(run);
        assert.equal(await accessory_or_armor_on(amul), ECMD_TIME);
        assert.equal(game.u.uamul, amul);
        assert.equal(amul.where, OBJ_INVENT);
        assert.equal(amul.owornmask, W_AMUL);
        assert.equal((messages().match(/being worn/g) || []).length, 1);
        assert.deepEqual(getRngLog(), []);
    });
}

for (const [slot, producer] of [['uwep', setuwep], ['uswapwep', setuswapwep],
    ['uquiver', setuqwep]]) {
    test(`wearing releases the real ${slot} owner`, async () => {
        const run = await setup();
        const amul = await item('AMULET_OF_REFLECTION');
        await producer(amul);
        reset(run);
        await Amulet_on(amul);
        assert.equal(game.u[slot], null);
        assert.equal(game.u.uamul, amul);
        assert.equal(amul.owornmask, W_AMUL);
        assert.deepEqual(getRngLog(), []);
    });
}

test('the legitimate amulet artifact retains worn and carried properties', async () => {
    const run = await setup();
    const amul = await item('AMULET_OF_ESP', 'The Eye of the Aethiopica');
    assert.ok(amul.oartifact);
    await setuwep(amul);
    reset(run);
    await Amulet_on(amul);
    assert.equal(game.u.uwep, null);
    assert.equal(game.u.uamul, amul);
    assert.equal(amul.owornmask, W_AMUL);
    assert.equal(game.u.uprops.TELEPAT & W_AMUL, W_AMUL);
    assert.ok(game.u.uprops.HALF_SPDAM);
    assert.ok(game.u.uprops.ENERGY_REGENERATION);
    assert.deepEqual(getRngLog(), []);
});

for (const slimed of [false, true]) {
    test(`unchanging clears the actual sliming producer, slimed=${slimed}`, async () => {
        const run = await setup();
        const amul = await item('AMULET_OF_UNCHANGING');
        if (slimed) {
            await make_slimed(10, null);
            delayed_killer(SLIMED, KILLED_BY_AN, 'green slime');
            assert.ok(find_delayed_killer(SLIMED));
        }
        reset(run);
        await Amulet_on(amul);
        assert.equal(game.u.uprops.SLIMED || 0, 0);
        assert.equal(find_delayed_killer(SLIMED), null);
        assert.equal(Unchanging(), true);
        assert.doesNotMatch(messages(), /slim/);
        assert.deepEqual(getRngLog(), []);
    });
}

test('slime cure and equipment settle before the real More acknowledgement', async () => {
    const run = await setup();
    const amul = await item('AMULET_OF_UNCHANGING');
    await make_slimed(10, null);
    delayed_killer(SLIMED, KILLED_BY_AN, 'green slime');
    reset(run);
    await pline('This preceding message fills enough of the line to need acknowledgement.');
    const held = await pause(run, () => Amulet_on(amul));
    const during = { timer: game.u.uprops.SLIMED, killer: find_delayed_killer(SLIMED),
        amulet: game.u.uamul, where: amul.where };
    held.resume();
    await held.pending;
    assert.equal(held.stopped, true);
    assert.equal(during.timer, 0);
    assert.equal(during.killer, null);
    assert.equal(during.amulet, amul);
    assert.equal(during.where, OBJ_INVENT);
});

for (const protection of ['none', 'intrinsic breathing', 'poison resistance', 'golem']) {
    test(`real gas cloud breathing observation with ${protection}`, async () => {
        const run = await setup();
        if (protection === 'intrinsic breathing')
            incr_itimeout('HMagical_breathing', 100);
        if (protection === 'poison resistance')
            incr_itimeout('HPoison_resistance', 100);
        if (protection === 'golem')
            assert.equal(await polymon(PMNAMES.PM_IRON_GOLEM), 1);
        await create_gas_cloud(x, y, 1, 8);
        const danger = protection === 'none';
        assert.equal(region_danger(), danger);
        const amul = await item('AMULET_OF_MAGICAL_BREATHING');
        reset(run);
        await Amulet_on(amul);
        assert.equal(Breathless(), true);
        assert.equal(region_danger(), false);
        assert.equal(game.u.uprops.MAGICAL_BREATHING & W_AMUL, W_AMUL);
        assert.equal(!!game.objects[amul.otyp].oc_name_known, danger);
        assert.equal(messages().includes('no longer bothered by the poison gas'), danger);
        assert.equal((messages().match(/being worn/g) || []).length, 1);
        assert.deepEqual(getRngLog(), danger ? ['rn2(19)=4'] : []);
    });
}

test('breathing restores the source mask before pending on-message', async () => {
    const run = await setup();
    await create_gas_cloud(x, y, 1, 8);
    const amul = await item('AMULET_OF_MAGICAL_BREATHING');
    reset(run);
    await pline('This preceding message fills enough of the line to need acknowledgement.');
    const held = await pause(run, () => Amulet_on(amul));
    const during = { breathless: Breathless(), danger: region_danger(),
        worn: game.u.uprops.MAGICAL_BREATHING & W_AMUL };
    held.resume();
    await held.pending;
    assert.equal(held.stopped, true);
    assert.deepEqual(during, { breathless: true, danger: false, worn: W_AMUL });
});

for (const form of [null, 'PM_VAMPIRE', 'PM_IRON_GOLEM', 'PM_GELATINOUS_CUBE']) {
    test(`strangulation follows real form anatomy ${form || 'human'}`, async () => {
        const run = await setup();
        if (form)
            assert.equal(await polymon(PMNAMES[form]), 1);
        const amul = await item('AMULET_OF_STRANGULATION');
        reset(run);
        await Amulet_on(amul);
        const vulnerable = !form || form === 'PM_VAMPIRE';
        assert.equal(game.u.intrinsic.HStrangled || 0, vulnerable ? 6 : 0);
        assert.equal(messages().includes('It constricts your throat!'), vulnerable);
        assert.equal(!!game.objects[amul.otyp].oc_name_known, vulnerable);
        assert.deepEqual(getRngLog(), vulnerable ? ['rn2(19)=4'] : []);
    });
}

test('existing wizard strangulation is not reset or identified', async () => {
    const run = await setup();
    incr_itimeout('HStrangled', 3);
    const amul = await item('AMULET_OF_STRANGULATION');
    reset(run);
    await Amulet_on(amul);
    assert.equal(game.u.intrinsic.HStrangled, 3);
    assert.equal(!!game.objects[amul.otyp].oc_name_known, false);
    assert.doesNotMatch(messages(), /constrict/);
    assert.deepEqual(getRngLog(), []);
});

for (const [oldTimeout, expected] of [[0, 60], [1, 1], [60, 60], [100, 60]]) {
    test(`sleep timer keeps the earlier deadline and permanent source, old=${oldTimeout}`, async () => {
        const run = await setup();
        // C-derived source-state fixture for the FROMOUTSIDE bit from eating.
        game.u.intrinsic.HSleepy = FROMOUTSIDE;
        incr_itimeout('HSleepy', oldTimeout);
        const amul = await item('AMULET_OF_RESTFUL_SLEEP');
        reset(run);
        await Amulet_on(amul);
        const log = getRngLog();
        assert.deepEqual(log, ['rnd(98)=58']);
        assert.equal(game.u.intrinsic.HSleepy & TIMEOUT, expected);
        assert.equal(game.u.intrinsic.HSleepy & ~TIMEOUT, FROMOUTSIDE);
        assert.equal(!!game.objects[amul.otyp].oc_name_known, false);
        assert.equal(game.u.uprops.SLEEPY & W_AMUL, W_AMUL);
    });
}

for (const state of ['ground', 'already flying', 'levitating']) {
    test(`flight observation respects ${state}`, async () => {
        const run = await setup();
        if (state === 'already flying')
            assert.equal(await polymon(PMNAMES.PM_VAMPIRE_BAT), 1);
        if (state === 'levitating')
            incr_itimeout('HLevitation', 100);
        const amul = await item('AMULET_OF_FLYING');
        reset(run);
        await Amulet_on(amul);
        assert.equal(Flying(), state !== 'levitating');
        assert.equal(game.u.uprops.FLYING & W_AMUL, W_AMUL);
        assert.equal(messages().includes('now in flight'), state === 'ground');
        assert.equal(!!game.objects[amul.otyp].oc_name_known, state === 'ground');
        assert.deepEqual(getRngLog(), state === 'ground' ? ['rn2(19)=4'] : []);
    });
}

test('guarding immediately updates AC using the actual worn owner', async () => {
    const run = await setup();
    find_ac();
    const before = game.u.uac;
    const amul = await item('AMULET_OF_GUARDING');
    reset(run);
    await Amulet_on(amul);
    assert.equal(game.u.uac, before - 2);
    assert.equal(!!game.objects[amul.otyp].oc_name_known, true);
    assert.deepEqual(getRngLog(), ['rn2(19)=4']);
});

test('change identifies, changes sex, clears worn state and stages disposal', async () => {
    const run = await setup();
    const amul = await item('AMULET_OF_CHANGE');
    const before = game.flags.female;
    reset(run);
    await Amulet_on(amul);
    assert.equal(!!game.flags.female, !before);
    assert.equal(game.u.uamul, null);
    assert.equal(amul.owornmask, 0);
    assert.equal(game.invent.includes(amul), false);
    assert.equal(amul.where, OBJ_DELETED);
    assert.equal(game.objs_deleted.filter(obj => obj === amul).length, 1);
    assert.equal(!!game.objects[amul.otyp].oc_name_known, true);
    assert.match(messages(), /suddenly very feminine/);
    assert.match(messages(), /amulet disintegrates/);
    assert.deepEqual(getRngLog(), ['rn2(19)=4']);
});

test('sex change waits at More before consumption', async () => {
    const run = await setup();
    const amul = await item('AMULET_OF_CHANGE');
    reset(run);
    await pline('This preceding message fills enough of the line to need acknowledgement.');
    const held = await pause(run, () => Amulet_on(amul));
    const during = { female: !!game.flags.female, owner: game.u.uamul, where: amul.where };
    held.resume();
    await held.pending;
    assert.equal(held.stopped, true);
    assert.equal(during.female, true);
    assert.equal(during.owner, amul);
    assert.equal(during.where, OBJ_INVENT);
    assert.equal(amul.where, OBJ_DELETED);
});

for (const mode of ['fixed female form', 'wizard unchanging']) {
    test(`unobservable change waits for real naming before disposal, ${mode}`, async () => {
        const run = await setup();
        if (mode === 'fixed female form')
            assert.equal(await polymon(PMNAMES.PM_WOOD_NYMPH), 1);
        else
            incr_itimeout('HUnchanging', 100);
        const before = poly_gender();
        const amul = await item('AMULET_OF_CHANGE');
        reset(run);
        let naming, release;
        const atNaming = new Promise(resolve => { naming = resolve; });
        run._display.onEmptyQueue = () => {
            if (!game._toplines?.startsWith('Call '))
                return 32;
            naming();
            return new Promise(resolve => { release = resolve; });
        };
        const pending = Amulet_on(amul);
        const stopped = await Promise.race([atNaming.then(() => true), pending.then(() => false)]);
        const during = { where: amul.where, worn: game.u.uamul, sex: poly_gender() };
        run._display.onEmptyQueue = () => 32;
        release?.(27);
        await pending;
        assert.equal(stopped, true);
        assert.equal(during.where, OBJ_INVENT);
        assert.equal(during.worn, amul);
        assert.equal(during.sex, before);
        assert.equal(amul.where, OBJ_DELETED);
        assert.equal(game.u.uamul, null);
        assert.equal(!!game.objects[amul.otyp].oc_name_known, false);
        assert.doesNotMatch(messages(), /suddenly very/);
        assert.deepEqual(getRngLog(), []);
    });
}

test('real poly_obj caller consumes the replacement change amulet before returning', async () => {
    const run = await setup();
    const amul = await item('AMULET_OF_REFLECTION');
    await Amulet_on(amul);
    reset(run);
    assert.equal(await poly_obj(amul, ONAMES.AMULET_OF_CHANGE), null);
    assert.equal(game.u.uamul, null);
    assert.equal(game.invent.some(obj => obj.otyp === ONAMES.AMULET_OF_CHANGE), false);
    assert.match(messages(), /amulet disintegrates/);
});

test('ordinary strangulation removal cancels the actual countdown', async () => {
    const run = await setup();
    const amul = await item('AMULET_OF_STRANGULATION');
    await Amulet_on(amul);
    assert.equal(game.u.intrinsic.HStrangled, 6);
    reset(run);
    await Amulet_off();
    assert.equal(game.u.intrinsic.HStrangled, 0);
    assert.equal(game.u.uamul, null);
    assert.equal(amul.where, OBJ_INVENT);
    assert.match(messages(), /breathe more easily/);
});

test('an unpaid change amulet finishes into the real used-up bill owner', async () => {
    const recipe = JSON.parse(fs.readFileSync(new URL(
        'gen-sessions/recipes/shop-food-price-rounding.json', import.meta.url)));
    const original = recipe.segments[0];
    const run = await runSegment({ ...original,
        moves: original.moves.slice(0, original.moves.indexOf('\x17')),
        storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
    resetInputState();
    run._display.onEmptyQueue = () => 32;
    const keeper = game.level.monsters.find(mon => mon.isshk);
    assert.ok(keeper && costly_spot(game.u.ux, game.u.uy));
    const amul = await item('AMULET_OF_CHANGE');
    await addtobill(amul, false, false, true);
    const bill = onbill(amul, keeper, true);
    assert.ok(amul.unpaid && bill);
    reset(run);
    await Amulet_on(amul);
    assert.equal(game.u.uamul, null);
    assert.equal(game.invent.includes(amul), false);
    assert.equal(amul.where, OBJ_ONBILL);
    assert.equal(amul.unpaid, 0);
    assert.equal(bill.useup, true);
    assert.equal(bill.obj, amul);
    assert.ok(game.billobjs.includes(amul));
    assert.equal((game.objs_deleted || []).includes(amul), false);
});
