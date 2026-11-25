// Constructed states use actual form, armor and intrinsic producers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup, seed } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { Sick_resistance } from '../js/youprop.js';
import { polymon } from '../js/polyself.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { setworn } from '../js/worn.js';
import { Armor_on, Armor_off } from '../js/do_wear.js';
import { set_itimeout } from '../js/potion.js';
import { getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { W_ARM } from '../js/const.js';

for (const [form, expected] of [
    ['PM_GREEN_DRAGON', true], ['PM_BABY_GREEN_DRAGON', false],
    ['PM_RED_DRAGON', false], ['PM_GHOUL', true], ['PM_BROWN_MOLD', true],
]) {
    test(`sickness defense follows actual ${form} form`, async () => {
        await setup();
        assert.equal(await polymon(PMNAMES[form]), 1);
        seed();
        assert.equal(Sick_resistance(), expected);
        assert.deepEqual(getRngLog(), []);
    });
}
for (const [type, expected] of [
    ['GREEN_DRAGON_SCALES', true], ['GREEN_DRAGON_SCALE_MAIL', true],
    ['RED_DRAGON_SCALES', false], ['RED_DRAGON_SCALE_MAIL', false],
]) {
    test(`actual worn ${type} grants the C disease defense`, async () => {
        await setup();
        const obj = mksobj(ONAMES[type], false, false);
        await addinv(obj);
        assert.equal(Sick_resistance(), false);
        await setworn(obj, W_ARM);
        await Armor_on();
        seed();
        assert.equal(Sick_resistance(), expected);
        assert.deepEqual(getRngLog(), []);
        await Armor_off();
        assert.equal(game.u.uarm, null);
        assert.equal(Sick_resistance(), false);
    });
}
test('a real timed intrinsic retains the independent resistance alternative', async () => {
    await setup();
    set_itimeout('HSick_resistance', 15);
    seed();
    assert.equal(Sick_resistance(), true);
    assert.deepEqual(getRngLog(), []);
    set_itimeout('HSick_resistance', 0);
    assert.equal(Sick_resistance(), false);
});
