// Source controls for the real attribute owner used by eaten accessories.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { setup, seed, clearMessages, messages } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { adjattrib, ABASE } from '../js/attrib.js';
import { addinv } from '../js/invent.js';
import { mksobj } from '../js/mkobj.js';
import { setworn } from '../js/worn.js';
import { Ring_on, Ring_off, set_wear } from '../js/do_wear.js';
import { Fixed_abil } from '../js/youprop.js';
import { pline } from '../js/display.js';
import { getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { A_STR, A_INT, A_WIS, A_CHA, W_RINGL, W_ARMH } from '../js/const.js';

async function equip(otyp, mask) {
    const obj = mksobj(otyp, false, false);
    await addinv(obj);
    await setworn(obj, mask);
    if (mask === W_RINGL)
        await Ring_on(obj);
    else
        await set_wear(obj);
    clearMessages();
    seed();
    return obj;
}

function attributes() {
    return { base: [...game.u.acurr.a], max: [...game.u.amax.a],
        exercise: [...game.u.aexe.a] };
}

for (const change of [1, -1]) {
    test(`a real sustain-ability ring blocks attribute change ${change}`, async () => {
        await setup();
        await equip(ONAMES.RIN_SUSTAIN_ABILITY, W_RINGL);
        assert.equal(Fixed_abil(), true);
        const before = attributes();
        assert.equal(await adjattrib(A_STR, change, -1), false);
        assert.deepEqual(attributes(), before);
        assert.equal(messages(), '');
        assert.deepEqual(getRngLog(), []);
    });
}

test('removing the real sustain-ability ring restores normal adjustment', async () => {
    await setup();
    const ring = await equip(ONAMES.RIN_SUSTAIN_ABILITY, W_RINGL);
    await Ring_off(ring);
    const before = ABASE(A_CHA);
    seed();
    assert.equal(await adjattrib(A_CHA, 1, -1), true);
    assert.equal(ABASE(A_CHA), before + 1);
    assert.match(messages(), /charismatic/);
    assert.deepEqual(getRngLog(), []);
});

for (const attr of [A_INT, A_WIS]) {
    for (const feedback of [-1, 0, 1]) {
        test(`dunce cap protects base and maximum attribute ${attr}, feedback ${feedback}`, async () => {
            await setup();
            await equip(ONAMES.DUNCE_CAP, W_ARMH);
            const before = attributes();
            assert.equal(await adjattrib(attr, -1, feedback), false);
            assert.deepEqual(attributes(), before);
            if (feedback === 0)
                assert.match(messages(), /cap constricts briefly, then relaxes again/);
            else
                assert.equal(messages(), '');
            assert.deepEqual(getRngLog(), []);
        });
    }
}

test('fixed ability exits before the dunce-cap speech', async () => {
    await setup();
    await equip(ONAMES.DUNCE_CAP, W_ARMH);
    await equip(ONAMES.RIN_SUSTAIN_ABILITY, W_RINGL);
    const before = attributes();
    assert.equal(await adjattrib(A_INT, -1, 0), false);
    assert.deepEqual(attributes(), before);
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), []);
});

test('dunce-cap feedback awaits real More without changing attributes', async () => {
    const run = await setup();
    await equip(ONAMES.DUNCE_CAP, W_ARMH);
    const before = attributes();
    await pline('An earlier message is still on the top line.');
    run._display.clearInputQueue();
    run._display.onEmptyQueue = null;
    let settled = false;
    const pending = adjattrib(A_INT, -1, 0).then(result => {
        settled = true;
        return result;
    });
    await setImmediate();
    const during = { settled, attributes: attributes() };
    run._display.pushKey(32);
    const result = await pending;
    assert.equal(during.settled, false);
    assert.deepEqual(during.attributes, before);
    assert.equal(result, false);
    assert.match(messages(), /cap constricts briefly, then relaxes again/);
    assert.deepEqual(getRngLog(), []);
});

test('zero change exits before the dunce-cap speech', async () => {
    await setup();
    await equip(ONAMES.DUNCE_CAP, W_ARMH);
    const before = attributes();
    assert.equal(await adjattrib(A_WIS, 0, 0), false);
    assert.deepEqual(attributes(), before);
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), []);
});
