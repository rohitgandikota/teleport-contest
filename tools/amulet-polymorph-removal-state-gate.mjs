// Constructed source controls, not native recordings. No production hooks.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, seed, clearMessages, messages, form, x, y}
    from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {Amulet_off, accessory_or_armor_on, armor_or_accessory_off,
    find_ac} from '../js/do_wear.js';
import {setworn} from '../js/worn.js';
import {addinv} from '../js/invent.js';
import {mksobj, replace_object} from '../js/mkobj.js';
import {poly_obj, obj_unpolyable} from '../js/zap.js';
import {create_gas_cloud, region_danger} from '../js/region.js';
import {pline} from '../js/display.js';
import {Flying, Levitation, Swimming, Breathless}
    from '../js/youprop.js';
import {float_vs_flight} from '../js/polyself.js';
import {getRngLog, rn2, rnd} from '../js/rng.js';
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {ART_EYE_OF_THE_AETHIOPICA} from '../js/artilist_data.js';
import {W_AMUL, W_RINGL, FROMOUTSIDE, OBJ_FREE, OBJ_INVENT}
    from '../js/const.js';

async function wear(type) {
    const obj = await addinv(mksobj(type, false, false));
    await accessory_or_armor_on(obj);
    assert.equal(game.u.uamul, obj);
    assert.equal(obj.owornmask, W_AMUL);
    return obj;
}

function replace(old) {
    const replacement = mksobj(ONAMES.AMULET_OF_LIFE_SAVING, false, false);
    replace_object(old, replacement); // C poly_obj replaces inventory before removal.
    assert.equal(game.u.uamul, old);
    assert.equal(old.where, OBJ_FREE);
    assert.equal(replacement.where, OBJ_INVENT);
    assert.ok(!game.invent.includes(old) && game.invent.includes(replacement));
    return replacement;
}

function resetRemoval(old, discover = false) {
    clearMessages();
    (game.context_takeoff ||= {}).mask = W_AMUL | W_RINGL;
    game.objects[old.otyp].oc_name_known = discover ? 0 : 1;
    seed(711);
    if (discover) rn2(19); // makeknown -> discover_object -> exercise(WIS).
    const expected = [...getRngLog()];
    seed(711);
    return expected;
}

function removed(old, expected, takeoffMask = W_RINGL) {
    assert.equal(game.u.uamul, null);
    assert.equal(old.owornmask | 0, 0);
    assert.equal(game.context_takeoff.mask, takeoffMask);
    assert.ok(messages().includes('You were wearing '));
    assert.ok(!messages().includes('(being worn)'));
    assert.deepEqual(getRngLog(), expected);
}

for (const retained of [false, true]) {
    test(`ESP removal, retained old slot ${retained}`, async () => {
        await setup();
        const old = await wear(ONAMES.AMULET_OF_ESP);
        assert.equal(game.u.uprops.TELEPAT, W_AMUL);
        if (retained) replace(old);
        const expected = resetRemoval(old);
        await Amulet_off();
        removed(old, expected);
        assert.equal(game.u.uprops.TELEPAT || 0, 0);
        assert.equal(game.u.unblind_telepat_range, -1);
    });

    test(`sleep timeout removal, retained old slot ${retained}`, async () => {
        await setup();
        const old = await wear(ONAMES.AMULET_OF_RESTFUL_SLEEP);
        assert.ok(game.u.intrinsic.HSleepy > 0);
        assert.equal(game.u.uprops.SLEEPY, W_AMUL);
        if (retained) replace(old);
        const expected = resetRemoval(old);
        await Amulet_off();
        removed(old, expected);
        assert.equal(game.u.intrinsic.HSleepy, 0);
        assert.equal(game.u.uprops.SLEEPY || 0, 0);
    });

    test(`flight removal lands on room, retained old slot ${retained}`, async () => {
        await setup();
        const old = await wear(ONAMES.AMULET_OF_FLYING);
        assert.equal(Flying(), true);
        if (retained) replace(old);
        const expected = resetRemoval(old, true);
        await Amulet_off();
        removed(old, expected);
        assert.equal(Flying(), false);
        assert.equal(game.u.uprops.FLYING || 0, 0);
        assert.ok(messages().includes('You land.'));
        assert.equal(game.objects[old.otyp].oc_name_known, 1);
    });

    test(`guarding recalculates before clearing old slot ${retained}`, async () => {
        await setup();
        const old = await wear(ONAMES.AMULET_OF_GUARDING);
        const guardedAC = game.mons[game.u.umonnum].ac - 2;
        assert.equal(game.u.uac, guardedAC);
        if (retained) replace(old);
        game.u.uac = 99;
        const expected = resetRemoval(old);
        await Amulet_off();
        removed(old, expected);
        assert.equal(game.u.uac, guardedAC, 'C find_ac sees uamul until the final setworn');
        find_ac();
        assert.equal(game.u.uac, guardedAC + 2, 'next normal recalculation sees the empty slot');
    });
}

// Raw slot setup isolates the C removal switch. Unchanging and the real
// Amulet normally resist the ordinary polymorph route; no reach claim here.
for (const name of ['AMULET_OF_LIFE_SAVING', 'AMULET_VERSUS_POISON',
    'AMULET_OF_REFLECTION', 'AMULET_OF_CHANGE', 'AMULET_OF_UNCHANGING',
    'FAKE_AMULET_OF_YENDOR', 'AMULET_OF_YENDOR']) {
    test(`pass-through ${name} clears the retained slot`, async () => {
        await setup();
        const old = await addinv(mksobj(ONAMES[name], false, false));
        assert.equal(setworn(old, W_AMUL), undefined);
        replace(old);
        const expected = resetRemoval(old);
        await Amulet_off();
        removed(old, expected);
    });
}

for (const [name, intrinsic, extrinsic] of [
    ['permanent plus timeout', FROMOUTSIDE | 41, 0],
    ['permanent only', FROMOUTSIDE, 0],
    ['another extrinsic mask (source-only guard)', 41, W_RINGL],
]) test(`sleep retains ${name}`, async () => {
    await setup();
    const old = await wear(ONAMES.AMULET_OF_RESTFUL_SLEEP);
    game.u.intrinsic.HSleepy = intrinsic;
    game.u.uprops.SLEEPY |= extrinsic;
    replace(old);
    const expected = resetRemoval(old);
    await Amulet_off();
    removed(old, expected);
    assert.equal(game.u.intrinsic.HSleepy, intrinsic);
    assert.equal(game.u.uprops.SLEEPY || 0, extrinsic);
});

for (const [name, active, breathless] of [
    ['active breathing', true, false], ['active breathless', true, true],
    ['already absent', false, false],
]) test(`strangulation ${name}`, async () => {
    await setup();
    const old = await wear(ONAMES.AMULET_OF_STRANGULATION);
    assert.equal(game.u.intrinsic.HStrangled, 6);
    if (!active) game.u.intrinsic.HStrangled = 0;
    if (breathless) game.u.intrinsic.HMagical_breathing = FROMOUTSIDE;
    replace(old);
    const expected = resetRemoval(old, active);
    await Amulet_off();
    removed(old, expected);
    assert.equal(game.u.intrinsic.HStrangled, 0);
    assert.equal(messages().includes('You can breathe more easily!'), active && !breathless);
    assert.equal(messages().includes('Your neck is no longer constricted!'), active && breathless);
});

for (const mode of ['dry', 'underwater swimming', 'underwater natural swimmer',
    'gas', 'gas poison resistance', 'gas intrinsic breathing']) {
    test(`magical breathing ${mode}`, async () => {
        await setup();
        const old = await wear(ONAMES.AMULET_OF_MAGICAL_BREATHING);
        assert.equal(Breathless(), true);
        if (mode.startsWith('underwater')) game.u.uinwater = true;
        if (mode === 'underwater swimming') game.u.intrinsic.HSwimming = FROMOUTSIDE;
        if (mode === 'underwater natural swimmer') form(PMNAMES.PM_GIANT_EEL);
        if (mode === 'gas poison resistance') game.u.intrinsic.HPoison_resistance = FROMOUTSIDE;
        if (mode === 'gas intrinsic breathing') game.u.intrinsic.HMagical_breathing = FROMOUTSIDE;
        if (mode.startsWith('gas')) await create_gas_cloud(x, y, 1, 8);
        assert.equal(region_danger(), false, 'worn amulet prevents danger before removal');
        replace(old);
        const danger = mode === 'gas', hp = game.u.uhp, mortality = game.u.umortality || 0;
        const expected = resetRemoval(old, danger);
        await Amulet_off();
        removed(old, expected);
        assert.equal(region_danger(), danger);
        assert.equal(messages().includes('You are breathing poison gas!'), danger);
        assert.ok(!messages().includes('suddenly inhale'));
        assert.equal(game.u.uprops.MAGICAL_BREATHING || 0, 0);
        assert.equal(game.u.uhp, hp);
        assert.equal(game.u.umortality || 0, mortality);
        if (mode.startsWith('underwater')) assert.equal(Swimming(), true);
    });
}

for (const mode of ['intrinsic flight', 'levitation']) test(`no landing with ${mode}`, async () => {
    await setup();
    const old = await wear(ONAMES.AMULET_OF_FLYING);
    if (mode === 'intrinsic flight') game.u.intrinsic.HFlying = FROMOUTSIDE;
    else game.u.intrinsic.HLevitation = FROMOUTSIDE;
    float_vs_flight();
    replace(old);
    const expected = resetRemoval(old);
    await Amulet_off();
    removed(old, expected);
    assert.equal(Flying(), mode === 'intrinsic flight');
    assert.equal(Levitation(), mode === 'levitation');
    assert.ok(!messages().includes('You land.') && !messages().includes('stop flying'));
});

test('verbose suppression still clears the old sleep timer', async () => {
    await setup();
    const old = await wear(ONAMES.AMULET_OF_RESTFUL_SLEEP);
    replace(old);
    game.flags.verbose = false;
    const expected = resetRemoval(old);
    await Amulet_off();
    assert.equal(game.u.uamul, null);
    assert.equal(old.owornmask | 0, 0);
    assert.equal(game.u.intrinsic.HSleepy, 0);
    assert.equal(game.context_takeoff.mask, W_RINGL);
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), expected);
});

test('ordinary removal awaits feedback and restores in_use', async () => {
    await setup();
    const old = await wear(ONAMES.AMULET_OF_ESP), inUse = old.in_use;
    const expected = resetRemoval(old);
    assert.equal(await armor_or_accessory_off(old), 1);
    removed(old, expected, 0);
    assert.ok(game.invent.includes(old));
    assert.equal(old.in_use, inUse);
});

test('no-worn-item guard preserves unrelated takeoff state', async () => {
    await setup();
    (game.context_takeoff ||= {}).mask = W_RINGL;
    seed();
    assert.equal(await Amulet_off(), undefined);
    assert.equal(game.context_takeoff.mask, W_RINGL);
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), []);
});

test('the only amulet artifact has synchronous worn-property completion', async () => {
    await setup();
    const old = await addinv(mksobj(ONAMES.AMULET_OF_ESP, false, false));
    old.oartifact = ART_EYE_OF_THE_AETHIOPICA;
    assert.equal(setworn(old, W_AMUL), undefined);
    assert.equal(game.u.uprops.ANTIMAGIC, W_AMUL);
    assert.equal(setworn(null, W_AMUL), undefined);
    assert.equal(game.u.uprops.ANTIMAGIC || 0, 0);
});

test('ordinary polymorph refuses the amulet of unchanging without a draw', async () => {
    await setup();
    const old = await wear(ONAMES.AMULET_OF_UNCHANGING);
    seed();
    assert.equal(obj_unpolyable(old), true);
    assert.deepEqual(getRngLog(), []);
});

test('public poly_obj removes sleep before the new amulet callback', async () => {
    await setup();
    const old = await wear(ONAMES.AMULET_OF_RESTFUL_SLEEP), inUse = old.in_use;
    clearMessages();
    seed(711);
    rnd(2); // mksobj -> next_ident.
    rn2(100); // delobj_core -> obj_resists on the old amulet.
    const expected = [...getRngLog()];
    seed(711);
    const replacement = await poly_obj(old, ONAMES.AMULET_OF_LIFE_SAVING);
    assert.equal(game.u.uamul, replacement);
    assert.equal(replacement.owornmask, W_AMUL);
    assert.equal(replacement.invlet, old.invlet);
    assert.equal(old.owornmask | 0, 0);
    assert.equal(old.in_use, inUse);
    assert.ok(!game.invent.includes(old) && game.invent.includes(replacement));
    assert.equal(game.u.intrinsic.HSleepy, 0);
    assert.deepEqual(getRngLog(), expected);
});

test('old ESP removal completes before poly_obj installs the new amulet', async () => {
    const run = await setup();
    const old = await wear(ONAMES.AMULET_OF_ESP), inUse = old.in_use;
    clearMessages();
    await pline('A previous message fills this line before the next equipment effect.');
    let release, reached, settled = false;
    const waiting = new Promise(resolve => { reached = resolve; });
    run._display.onEmptyQueue = () => {
        reached();
        return new Promise(resolve => { release = resolve; });
    };
    seed(711); rnd(2); const beforePrompt = [...getRngLog()]; seed(711);
    const pending = poly_obj(old, ONAMES.AMULET_OF_LIFE_SAVING)
        .then(obj => { settled = true; return obj; });
    try {
        await Promise.race([waiting, pending]);
        assert.equal(settled, false);
        assert.equal(game.u.uamul, null);
        assert.equal(game.u.uprops.TELEPAT || 0, 0);
        assert.equal(old.in_use, 1);
        assert.equal(game.invent.some(obj => obj.owornmask & W_AMUL), false);
        assert.deepEqual(getRngLog(), beforePrompt);
    } finally {
        run._display.onEmptyQueue = () => 32;
        if (release) release(32);
        await pending;
    }
    assert.equal(game.u.uamul.otyp, ONAMES.AMULET_OF_LIFE_SAVING);
    assert.equal(old.in_use, inUse);
});
