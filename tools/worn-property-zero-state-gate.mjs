#!/usr/bin/env node
// worn.c stores every worn-slot mask, including u.uprops[0].extrinsic.
// do_wear.c relies on that entry when removing a ring with no property.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { setworn, setnotworn } from '../js/worn.js';
import { Ring_on, Ring_off, Ring_gone } from '../js/do_wear.js';
import { ONAMES } from '../js/objects_data.js';
import { A_STR, A_CON, W_RINGL, W_RINGR, W_WEP, W_SWAPWEP, W_QUIVER }
    from '../js/const.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/noun-inflection-inventory.json', import.meta.url)));

async function setup() {
    const replay = await runSegment({ ...recipe.segments[0], moves: ' ',
        storage: new InMemoryStorage() });
    replay._display.onEmptyQueue = () => 0x1b;
}

async function item(name) {
    const obj = mksobj(ONAMES[name], false, false);
    obj.spe = 2;
    obj.dknown = obj.known = true;
    return addinv(obj);
}

for (const [name, bonus] of [
    ['RIN_GAIN_STRENGTH', () => game.u.abon?.a?.[A_STR] || 0],
    ['RIN_GAIN_CONSTITUTION', () => game.u.abon?.a?.[A_CON] || 0],
    ['RIN_INCREASE_ACCURACY', () => game.u.uhitinc || 0],
    ['RIN_INCREASE_DAMAGE', () => game.u.udaminc || 0],
    ['MEAT_RING', null],
]) {
    for (const [action, remove] of [['remove', Ring_off], ['lose', Ring_gone]]) {
        test(`${action} ${name} preserves property-zero bookkeeping`, async () => {
            await setup();
            const ring = await item(name);
            const before = bonus?.();
            assert.equal(game.objects[ring.otyp].oc_oprop, 0);
            setworn(ring, W_RINGL);
            await Ring_on(ring);
            assert.equal(game.u.uprops[0] & W_RINGL, W_RINGL);
            if (bonus)
                assert.equal(bonus(), before + 2);
            await remove(ring);
            assert.equal(game.u.uleft, null);
            assert.equal(ring.owornmask, 0);
            assert.equal(game.u.uprops[0] || 0, 0);
            if (bonus)
                assert.equal(bonus(), before);
            assert.deepEqual(game.impossible_log || [], []);
        });
    }
}

test('removing one ring preserves the other property-zero slot', async () => {
    await setup();
    const left = await item('RIN_GAIN_STRENGTH');
    const right = await item('RIN_GAIN_CONSTITUTION');
    setworn(left, W_RINGL);
    setworn(right, W_RINGR);
    assert.equal(game.u.uprops[0], W_RINGL | W_RINGR);
    setworn(null, W_RINGL);
    assert.equal(game.u.uprops[0], W_RINGR);
    assert.equal(game.u.uright, right);
    setnotworn(right);
    assert.equal(game.u.uprops[0] || 0, 0);
});

test('replacing a ring changes only that slot in the old property', async () => {
    await setup();
    const left = await item('RIN_GAIN_STRENGTH');
    const right = await item('RIN_GAIN_CONSTITUTION');
    const replacement = await item('RIN_FIRE_RESISTANCE');
    setworn(left, W_RINGL);
    setworn(right, W_RINGR);
    setworn(replacement, W_RINGL);
    assert.equal(game.u.uprops[0], W_RINGR);
    assert.equal(game.u.uprops.FIRE_RES, W_RINGL);
    assert.equal(left.owornmask, 0);
});

for (const [name, mask, grants] of [
    ['DAGGER', W_WEP, true], ['PICK_AXE', W_WEP, true],
    ['DAGGER', W_SWAPWEP, false], ['DAGGER', W_QUIVER, false],
    ['POT_WATER', W_WEP, false],
]) {
    test(`${name} in slot ${mask} follows C's property grant guard`, async () => {
        await setup();
        const obj = await item(name);
        setworn(obj, mask);
        assert.equal(game.u.uprops[0] || 0, grants ? mask : 0);
        setnotworn(obj);
        assert.equal(game.u.uprops[0] || 0, 0);
    });
}
