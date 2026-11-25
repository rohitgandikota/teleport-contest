// Only private exports use the loader; every producer and consumer is real.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup, seed, clearMessages, messages } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { foodword, rottenfood } from '../js/eat.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { oname } from '../js/do_name.js';
import { setworn } from '../js/worn.js';
import { Blindf_on } from '../js/do_wear.js';
import { make_blinded, set_itimeout } from '../js/potion.js';
import { polymon } from '../js/polyself.js';
import { Blind, Levitation } from '../js/youprop.js';
import { getRngLog, rn2, d } from '../js/rng.js';
import { ONAMES, MATERIALS, OCLASSES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAME_WISH, W_TOOL, TIMEOUT } from '../js/const.js';

for (const dknown of [0, 1]) {
    test(`glass foodword identifies only known appearance, dknown=${dknown}`, async () => {
        await setup();
        const typ = game.objects.findIndex(item => item.oc_class === OCLASSES.GEM_CLASS
            && item.oc_material === MATERIALS.GLASS);
        const obj = mksobj(typ, false, false);
        obj.dknown = dknown;
        assert.equal(game.objects[typ].oc_name_known, 0);
        seed();
        assert.equal(foodword(obj), 'glass');
        assert.equal(game.objects[typ].oc_name_known, dknown);
        assert.equal(game.objects[typ].oc_encountered || 0, dknown);
        const once = [...getRngLog()];
        assert.equal(foodword(obj), 'glass');
        assert.deepEqual(getRngLog(), once);
    });
}

for (const type of [ONAMES.APPLE, ONAMES.DAGGER]) {
    test(`foodword keeps ordinary material without identifying type ${type}`, async () => {
        await setup();
        const obj = mksobj(type, false, false);
        const before = game.objects[type].oc_name_known;
        seed();
        assert.equal(foodword(obj), type === ONAMES.APPLE ? 'food' : 'metal');
        assert.equal(game.objects[type].oc_name_known, before);
        assert.deepEqual(getRngLog(), []);
    });
}

for (const eyes of [false, true]) {
    test(`rotten blindness uses the shared producer, Eyes of the Overworld=${eyes}`, async () => {
        await setup();
        if (eyes) {
            const lenses = mksobj(ONAMES.LENSES, false, false);
            await oname(lenses, 'The Eyes of the Overworld', ONAME_WISH);
            await addinv(lenses);
            await setworn(lenses, W_TOOL);
            await Blindf_on(lenses);
            await make_blinded(7, false);
            assert.equal(Blind(), false);
            assert.equal(game.u.intrinsic.HBlinded & TIMEOUT, 7);
        }
        const obj = mksobj(ONAMES.DAGGER, false, false);
        seed(7);
        assert.notEqual(rn2(4), 0);
        assert.equal(rn2(4), 0);
        const duration = d(2, 10);
        const rng = [...getRngLog()];
        clearMessages();
        seed(7);
        assert.equal(await rottenfood(obj), 0);
        assert.equal(game.u.intrinsic.HBlinded & TIMEOUT, duration + (eyes ? 7 : 0));
        assert.equal(Blind(), !eyes);
        assert.equal(!!game.u.ublind, !eyes);
        if (eyes)
            assert.match(messages(), /vision quickly clears/);
        else
            assert.doesNotMatch(messages(), /vision quickly clears/);
        assert.deepEqual(getRngLog(), rng);
    });
}

test('eyeless form skips blindness even when the historical alias is clear', async () => {
    await setup();
    await polymon(PMNAMES.PM_GELATINOUS_CUBE);
    assert.equal(Blind(), true);
    const obj = mksobj(ONAMES.DAGGER, false, false);
    const before = game.u.intrinsic.HBlinded || 0;
    clearMessages();
    seed(11);
    assert.equal(await rottenfood(obj), 0);
    assert.equal(game.u.intrinsic.HBlinded || 0, before);
    assert.deepEqual(getRngLog(), ['rn2(4)=2', 'rn2(4)=0', 'rn2(3)=1']);
    assert.doesNotMatch(messages(), /suddenly goes dark/);
});

test('rotten fainting reads canonical intrinsic levitation', async () => {
    await setup();
    await make_blinded(20, false);
    set_itimeout('HLevitation', 30);
    assert.equal(!!Levitation(), true);
    assert.equal(game.u.uprops?.LEVITATION || 0, 0);
    const obj = mksobj(ONAMES.DAGGER, false, false);
    clearMessages();
    seed(1);
    assert.equal(await rottenfood(obj), 1);
    assert.match(messages(), /you lose control of yourself/);
    assert.doesNotMatch(messages(), /slap against/);
    assert.equal(game.multi_reason, 'unconscious from rotten food');
    assert.equal(game.nomovemsg, 'You are conscious again.');
    assert.equal(typeof game.afternmv, 'function');
});
