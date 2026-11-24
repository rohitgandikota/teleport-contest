// Source controls for src/do_wear.c:1539 and zap.c:1908-1951.
// Constructed states exercise real public producers, not native-input evidence.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, seed, clearMessages, messages} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {set_wear, accessory_or_armor_on} from '../js/do_wear.js';
import {unmul} from '../js/hack.js';
import {setworn} from '../js/worn.js';
import {addinv, weight} from '../js/invent.js';
import {mksobj} from '../js/mkobj.js';
import {poly_obj} from '../js/zap.js';
import {pline} from '../js/display.js';
import {Stealth, Blind} from '../js/youprop.js';
import {ONAMES} from '../js/objects_data.js';
import {getRngLog, rn2, rnd} from '../js/rng.js';
import {W_ARMU, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS,
    W_TOOL, W_RINGR, W_RINGL, W_AMUL, A_DEX, A_INT, A_WIS,
    FROMOUTSIDE, TIMEOUT, OBJ_INVENT} from '../js/const.js';

async function item(type, mask = 0, fields = {}) {
    const obj = await addinv(mksobj(type, false, false));
    Object.assign(obj, fields);
    if (mask) await setworn(obj, mask);
    game.objects[type].oc_name_known = 0;
    return obj;
}

// Expected draws come from C: discover_object/exercise uses rn2(19),
// Fumbling uses rnd(20), next_ident uses rnd(2), delobj uses rn2(100).
// Compute their values using the seeded RNG, then reset before the action.
function oracle(draws, value = 701) {
    seed(value);
    const values = draws.map(([kind, n]) => kind === 'rnd' ? rnd(n) : rn2(n));
    const log = [...getRngLog()];
    seed(value);
    return {values, log};
}

const armor = [
    ['shirt', ONAMES.T_SHIRT, W_ARMU, []],
    ['suit', ONAMES.LEATHER_ARMOR, W_ARM, []],
    ['cloak', ONAMES.ELVEN_CLOAK, W_ARMC, [['rn2', 19]]],
    ['boots', ONAMES.ELVEN_BOOTS, W_ARMF, [['rn2', 19]]],
    ['gloves', ONAMES.GAUNTLETS_OF_DEXTERITY, W_ARMG, [['rn2', 19]]],
    ['helmet', ONAMES.HELM_OF_BRILLIANCE, W_ARMH, [['rn2', 19]]],
    ['shield', ONAMES.SMALL_SHIELD, W_ARMS, []],
];

for (const [name, type, mask, draws] of armor) {
    test(`selected ${name}: callback effects and draw order`, async () => {
        await setup();
        const obj = await item(type, mask, {spe: 2, known: 0});
        clearMessages();
        const expected = oracle(draws);
        assert.equal(await set_wear(obj), undefined);
        assert.equal(obj.known, 1, 'status-line AC reveals enchantment');
        assert.equal(obj.owornmask, mask);
        assert.equal(game.initial_don, false);
        assert.deepEqual(getRngLog(), expected.log);
        if (mask === W_ARMC || mask === W_ARMF) {
            assert.equal(Stealth(), true);
            assert.equal(game.objects[type].oc_name_known, 1);
            assert.ok(messages().includes(mask === W_ARMF
                ? 'You walk very quietly.' : 'You move very quietly.'));
        }
        if (mask === W_ARMG) assert.equal(game.u.abon.a[A_DEX], 2);
        if (mask === W_ARMH) {
            assert.equal(game.u.abon.a[A_INT], 2);
            assert.equal(game.u.abon.a[A_WIS], 2);
        }
    });
}

test('selected eyewear still completes Blindf_on and synchronizes blindness', async () => {
    await setup();
    const obj = await item(ONAMES.BLINDFOLD, W_TOOL);
    game.u.ublind = 0;
    clearMessages(); seed();
    await set_wear(obj);
    assert.equal(Blind(), true);
    assert.equal(game.u.ublind, 1);
    assert.equal(game.u.ublindf, obj);
    assert.ok(messages().includes('blindfold'));
    assert.deepEqual(getRngLog(), []);
});

for (const [name, type, mask, field] of [
    ['right', ONAMES.RIN_INCREASE_ACCURACY, W_RINGR, 'uhitinc'],
    ['left', ONAMES.RIN_INCREASE_DAMAGE, W_RINGL, 'udaminc'],
]) test(`selected ${name} ring preserves its callback`, async () => {
    await setup();
    const obj = await item(type, mask, {spe: 3});
    const before = game.u[field] || 0;
    seed();
    await set_wear(obj);
    assert.equal(game.u[field], before + 3);
    assert.equal(obj.owornmask, mask);
    assert.deepEqual(getRngLog(), []);
});

test('selected amulet preserves countdown and callback completion', async () => {
    await setup();
    const obj = await item(ONAMES.AMULET_OF_RESTFUL_SLEEP, W_AMUL);
    const expected = oracle([['rnd', 98]]);
    await set_wear(obj);
    assert.equal(game.u.intrinsic.HSleepy & TIMEOUT, expected.values[0] + 2);
    assert.equal(game.u.uamul, obj);
    assert.deepEqual(getRngLog(), expected.log);
});

test('null dispatch follows cloak, boots, gloves, helmet draw order and reveals all armor', async () => {
    await setup();
    const specs = [
        [ONAMES.T_SHIRT, W_ARMU], [ONAMES.LEATHER_ARMOR, W_ARM],
        [ONAMES.CLOAK_OF_PROTECTION, W_ARMC], [ONAMES.FUMBLE_BOOTS, W_ARMF],
        [ONAMES.GAUNTLETS_OF_DEXTERITY, W_ARMG], [ONAMES.HELM_OF_BRILLIANCE, W_ARMH],
        [ONAMES.SMALL_SHIELD, W_ARMS],
    ];
    const worn = [];
    for (const [type, mask] of specs) worn.push(await item(type, mask, {known: 0, spe: 2}));
    clearMessages();
    const expected = oracle([['rn2', 19], ['rnd', 20], ['rn2', 19], ['rn2', 19]]);
    await set_wear(null);
    assert.deepEqual(worn.map(o => o.known), Array(7).fill(1));
    assert.deepEqual(worn.map(o => o.owornmask), specs.map(s => s[1]));
    assert.equal(game.u.intrinsic.HFumbling & TIMEOUT, expected.values[1]);
    for (const attr of [A_DEX, A_INT, A_WIS]) assert.equal(game.u.abon.a[attr], 2);
    assert.deepEqual(getRngLog(), expected.log);
    assert.equal(messages(), '');
    assert.equal(game.initial_don, false);
});

for (const [type, mask] of [[ONAMES.ELVEN_BOOTS, W_ARMF], [ONAMES.ELVEN_CLOAK, W_ARMC]]) {
    test(`initial don suppresses stealth discovery but reveals armor ${type}`, async () => {
        await setup();
        const obj = await item(type, mask, {known: 0});
        clearMessages(); seed();
        await set_wear(null);
        assert.equal(obj.known, 1);
        assert.equal(game.objects[type].oc_name_known, 0);
        assert.equal(Stealth(), true);
        assert.equal(messages(), '');
        assert.deepEqual(getRngLog(), []);
        assert.equal(game.initial_don, false);
    });
}

test('selected identity ignores a carried twin and all other worn objects', async () => {
    await setup();
    const worn = await item(ONAMES.ELVEN_BOOTS, W_ARMF, {known: 0});
    const twin = await item(ONAMES.ELVEN_BOOTS, 0, {known: 0});
    const cloak = await item(ONAMES.CLOAK_OF_PROTECTION, W_ARMC, {known: 0});
    clearMessages(); seed();
    await set_wear(twin);
    assert.deepEqual([worn.known, twin.known, cloak.known], [0, 0, 0]);
    assert.equal(game.objects[worn.otyp].oc_name_known, 0);
    assert.equal(game.objects[cloak.otyp].oc_name_known, 0);
    assert.deepEqual(getRngLog(), []);
    assert.equal(messages(), '');
    assert.equal(game.initial_don, false);
});

test('empty startup completes and resets initial_don without draws', async () => {
    await setup(); seed();
    await set_wear(null);
    assert.equal(game.initial_don, false);
    assert.deepEqual(getRngLog(), []);
});

test('existing fedora luck callback is retained and now reveals enchantment', async () => {
    await setup();
    game.urole = {...game.urole, name: {...game.urole.name, m: 'Archeologist'}};
    const obj = await item(ONAMES.FEDORA, W_ARMH, {known: 0});
    const luck = game.u.uluck;
    seed();
    await set_wear(obj);
    assert.equal(game.u.uluck, luck + 1);
    assert.equal(obj.known, 1);
    assert.deepEqual(getRngLog(), []);
});

for (const permanent of [false, true]) test(`Fumbling callback respects intrinsic source ${permanent}`, async () => {
    await setup();
    const obj = await item(ONAMES.FUMBLE_BOOTS, W_ARMF, {known: 0});
    game.u.intrinsic.HFumbling = 5 | (permanent ? FROMOUTSIDE : 0);
    const expected = oracle(permanent ? [] : [['rnd', 20]]);
    await set_wear(obj);
    assert.equal(game.u.intrinsic.HFumbling, permanent ? FROMOUTSIDE | 5 : 5 + expected.values[0]);
    assert.equal(obj.known, 1);
    assert.deepEqual(getRngLog(), expected.log);
});

for (const [name, original, target, mask, worn] of [
    ['boots same slot', ONAMES.LOW_BOOTS, ONAMES.ELVEN_BOOTS, W_ARMF, true],
    ['cloak same slot', ONAMES.LEATHER_CLOAK, ONAMES.ELVEN_CLOAK, W_ARMC, true],
    ['carried boots', ONAMES.LOW_BOOTS, ONAMES.ELVEN_BOOTS, W_ARMF, false],
    ['boots to incompatible cloak', ONAMES.LOW_BOOTS, ONAMES.ELVEN_CLOAK, W_ARMF, true],
]) test(`poly_obj ${name}: ownership, slot and callback effects`, async () => {
    await setup();
    const old = await item(original, 0, {spe: 2, blessed: 1, cursed: 0});
    if (worn) {
        await accessory_or_armor_on(old);
        if (game.afternmv) await unmul('');
        assert.equal(old.owornmask, mask);
        assert.equal(old.known, 1);
    }
    const letter = old.invlet;
    game.objects[target].oc_name_known = 0;
    clearMessages();
    const sameSlot = worn && ((target === ONAMES.ELVEN_BOOTS) === (mask === W_ARMF));
    const draws = [['rnd', 2], ...(sameSlot ? [['rn2', 19]] : []), ['rn2', 100]];
    const expected = oracle(draws);
    const obj = await poly_obj(old, target);
    assert.notEqual(obj, old);
    assert.equal(obj.otyp, target);
    assert.equal(obj.where, OBJ_INVENT);
    assert.equal(obj.invlet, letter);
    assert.equal(obj.quan, old.quan);
    assert.equal(obj.spe, 2);
    assert.equal(obj.blessed, 1);
    assert.equal(obj.cursed, 0);
    assert.equal(obj.owt, weight(obj));
    assert.equal(game.invent.includes(old), false);
    assert.equal(game.invent.includes(obj), true);
    assert.equal(old.owornmask | 0, 0);
    assert.equal(obj.owornmask | 0, sameSlot ? mask : 0);
    assert.equal(Stealth(), sameSlot);
    assert.equal(game.objects[target].oc_name_known, +sameSlot);
    assert.equal(obj.known || 0, +sameSlot);
    assert.equal(messages().includes('very quietly.'), sameSlot);
    assert.deepEqual(getRngLog(), expected.log);
    assert.equal(game.initial_don, false);
});

for (const route of ['selected', 'startup', 'poly_obj']) {
    test(`${route} waits for the real message prompt before later effects`, async () => {
        const run = await setup();
        const startup = route === 'startup';
        const obj = await item(startup ? ONAMES.OILSKIN_CLOAK
            : route === 'poly_obj' ? ONAMES.LOW_BOOTS : ONAMES.ELVEN_BOOTS,
            startup ? W_ARMC : W_ARMF, {known: 0});
        const gloves = startup
            ? await item(ONAMES.GAUNTLETS_OF_DEXTERITY, W_ARMG, {known: 0, spe: 2}) : null;
        await pline('A previous message fills this line before the next equipment effect.');
        let release, reachedPrompt, settled = false;
        const waiting = new Promise(resolve => { reachedPrompt = resolve; });
        run._display.onEmptyQueue = () => {
            reachedPrompt();
            return new Promise(resolve => { release = resolve; });
        };
        const expected = oracle(startup ? [['rn2', 19]]
            : route === 'poly_obj' ? [['rnd', 2], ['rn2', 19], ['rn2', 100]]
                : [['rn2', 19]]);
        const pending = (route === 'poly_obj' ? poly_obj(obj, ONAMES.ELVEN_BOOTS)
            : set_wear(startup ? null : obj)).then(value => { settled = true; return value; });
        try {
            await Promise.race([waiting, pending]);
            assert.equal(settled, false, 'caller must wait for its callback message');
            assert.equal(game.initial_don, startup);
            if (startup) {
                assert.equal(gloves.known, 0, 'later slot must not run during cloak prompt');
                assert.equal(game.u.abon?.a?.[A_DEX] || 0, 0);
                assert.deepEqual(getRngLog(), []);
            } else {
                assert.equal(game.u.uarmf.known, 0, 'reveal tail follows message acknowledgement');
                assert.equal(game.objects[ONAMES.ELVEN_BOOTS].oc_name_known, 1);
                assert.deepEqual(getRngLog(), route === 'poly_obj' ? expected.log.slice(0, 2) : expected.log);
            }
        } finally {
            run._display.onEmptyQueue = () => 32;
            if (release) release(32);
            await pending;
        }
        assert.equal(game.initial_don, false);
        assert.equal(startup ? gloves.known : game.u.uarmf.known, 1);
        if (startup) assert.equal(game.u.abon.a[A_DEX], 2);
        assert.deepEqual(getRngLog(), expected.log);
    });
}

test('poly_obj rereads a slot emptied by Amulet_on before returning', async () => {
    await setup();
    const old = await item(ONAMES.AMULET_OF_ESP, W_AMUL);
    game.objects[ONAMES.AMULET_OF_CHANGE].oc_name_known = 0;
    const female = game.flags.female;
    clearMessages();
    const expected = oracle([['rnd', 2], ['rn2', 19], ['rn2', 100]]);
    const result = await poly_obj(old, ONAMES.AMULET_OF_CHANGE);
    assert.equal(result, null);
    assert.equal(game.u.uamul, null);
    assert.equal(game.invent.includes(old), false);
    assert.equal(game.invent.some(o => o.otyp === ONAMES.AMULET_OF_CHANGE), false);
    assert.notEqual(game.flags.female, female);
    assert.equal(game.objects[ONAMES.AMULET_OF_CHANGE].oc_name_known, 1);
    assert.ok(messages().includes('The amulet disintegrates!'));
    assert.deepEqual(getRngLog(), expected.log);
    assert.equal(game.initial_don, false);
});
