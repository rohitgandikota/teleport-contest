// Private exports only; real objects/helpers. Unreachable material cases are
// explicitly owner-level source controls, not ordinary consumption claims.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup, seed, clearMessages, messages } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import * as eating from '../js/eat.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { getRngLog } from '../js/rng.js';
import { makeknown, objdescr_is } from '../js/o_init.js';
import { ONAMES, OCLASSES, MATERIALS } from '../js/objects_data.js';
import { NOT_HUNGRY, OBJ_DELETED, OBJ_FREE } from '../js/const.js';

const bounds = [
    [0, 0, 0, []],
    [30, 0, 30, []],
    [8, -5, 3, []],
    [-8, 5, -3, []],
    [8, 1, 9, []],
    [8, 5, 12, ['rnd(5)=4']],
    [-8, -5, -12, ['rnd(5)=4']],
    [1, 9, 10, ['rnd(9)=8']],
    [15, 6, 18, ['rn2(6)=1', 'rnd(5)=3']],
    [-15, -6, -18, ['rn2(6)=1', 'rnd(5)=3']],
    [25, 5, 26, ['rn2(5)=3']],
    [35, 5, 35, []],
    [-35, -5, -35, []],
];
for (const [old, inc, result, rng] of bounds) {
    test(`bounded increase preserves C threshold behavior at ${old}, ${inc}`, async () => {
        assert.equal(typeof eating.bounded_increase, 'function');
        await setup();
        seed(2);
        assert.equal(eating.bounded_increase(old, inc, ONAMES.RIN_INCREASE_ACCURACY), result);
        assert.deepEqual(getRngLog(), rng);
    });
}

test('every nonzero accessory property has an existing canonical H-word mapping', async () => {
    await setup();
    const { propertynames } = await import('../js/timeout.js');
    for (const obj of game.objects) {
        if ((obj.oc_class === OCLASSES.RING_CLASS || obj.oc_class === OCLASSES.AMULET_CLASS)
            && obj.oc_oprop) {
            const prop = propertynames.find(entry => entry.prop_num === obj.oc_oprop);
            assert.ok(prop);
            assert.match(prop.key, /^H/);
        }
    }
});

async function objectMeal(typ, quantity = 1) {
    assert.equal(typeof eating.doeat_nonfood, 'function');
    await setup();
    const obj = mksobj(typ, false, false);
    obj.quan = quantity;
    await addinv(obj);
    game.u.uhunger = 500;
    game.u.uhs = NOT_HUNGRY;
    clearMessages();
    seed(2);
    return obj;
}

for (const quantity of [1, 2]) {
    test(`source-only glass-potion meal preserves the increment/useup contract, quantity=${quantity}`, async () => {
        const obj = await objectMeal(ONAMES.POT_HEALING, quantity);
        assert.equal(eating.is_edible(obj), false);
        makeknown(obj.otyp);
        game.u.uhp = 5;
        game.u.uhpmax = 50;
        seed(2);
        await eating.doeat_nonfood(obj);
        assert.ok(game.u.uhp > 5);
        assert.equal(game.u.uconduct.food, 1);
        if (quantity === 1) {
            assert.equal(game.invent.includes(obj), false);
            assert.ok(obj.where === OBJ_FREE || obj.where === OBJ_DELETED);
        } else {
            assert.equal(game.invent.includes(obj), true);
            assert.equal(obj.quan, quantity - 1);
        }
        assert.deepEqual(game.context.victual, {});
        assert.match(messages(), /feel better/);
    });
}

for (const material of [MATERIALS.BONE, MATERIALS.DRAGON_HIDE]) {
    test(`source-only material ${material} preserves animal-product conduct`, async () => {
        assert.equal(typeof eating.doeat_nonfood, 'function');
        await setup();
        const typ = game.objects.findIndex(obj => obj.oc_material === material && !obj.oc_unique);
        const obj = mksobj(typ, false, false);
        await addinv(obj);
        assert.equal(eating.is_edible(obj), false);
        game.u.uhunger = 500;
        game.u.uhs = NOT_HUNGRY;
        seed(2);
        await eating.doeat_nonfood(obj);
        assert.equal(game.u.uconduct.food, 1);
        assert.equal(game.u.uconduct.unvegan, 1);
        assert.equal(game.u.uconduct.unvegetarian, 1);
    });
}

test('source-only flint branch uses its actual exercise helper and disposal', async () => {
    const obj = await objectMeal(ONAMES.FLINT);
    assert.equal(eating.is_edible(obj), false);
    await eating.doeat_nonfood(obj);
    assert.match(messages(), /Yabba-dabba delicious!/);
    assert.equal(game.invent.includes(obj), false);
    assert.deepEqual(getRngLog(), ['rn2(19)=4']);
});

for (const blessed of [0, 1]) {
    test(`actual shuffled YUM YUM paper description controls feedback, blessed=${blessed}`, async () => {
        assert.equal(typeof eating.doeat_nonfood, 'function');
        await setup();
        const typ = game.objects.findIndex((obj, index) => obj.oc_class === OCLASSES.SCROLL_CLASS
            && objdescr_is({ otyp: index }, 'YUM YUM'));
        assert.notEqual(typ, -1);
        const obj = mksobj(typ, false, false);
        obj.blessed = blessed;
        await addinv(obj);
        game.u.uhunger = 500;
        game.u.uhs = NOT_HUNGRY;
        clearMessages();
        seed(2);
        await eating.doeat_nonfood(obj);
        assert.match(messages(), blessed ? /Yum!/ : /Yum\./);
        assert.doesNotMatch(messages(), /delicious|Needs salt/);
        assert.deepEqual(getRngLog(), []);
    });
}
