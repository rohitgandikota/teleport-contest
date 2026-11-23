// src/potion.c:618 dopotion and :1052 peffect_speed. No native coverage claim.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {game} from '../js/gstate.js';
import {peffects, dopotion} from '../js/potion.js';
import {set_wounded_legs} from '../js/do.js';
import {mksobj, curse} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {observe_object, makeknown} from '../js/o_init.js';
import {pline} from '../js/display.js';
import {Wounded_legs} from '../js/youprop.js';
import {getRngLog} from '../js/rng.js';
import {ONAMES} from '../js/objects_data.js';
import {LEFT_SIDE, TIMEOUT, FROMOUTSIDE, OBJ_DELETED, ECMD_TIME} from '../js/const.js';
import {setup, mount, seed, clearMessages, messages} from './status-followup-test-setup.mjs';

test('leg healing marks the potion effect unknown after the real injury producer', async () => {
    await setup(); await set_wounded_legs(LEFT_SIDE, 10);
    const obj = mksobj(ONAMES.POT_SPEED, false, false);
    game.potion_unkn = 0; clearMessages(); seed();
    assert.equal(await peffects(obj), -1);
    assert.equal(Wounded_legs(), false);
    assert.equal(game.potion_unkn, 1);
    assert.equal(game.u.intrinsic.HFast || 0, 0);
    assert.notEqual(obj.where, OBJ_DELETED, 'dopotion owns consumption');
    assert.match(messages(), /leg feels better/);
    assert.deepEqual(getRngLog(), []);
});

test('unknown observed potion heals, offers a name, and is consumed without identification RNG', async () => {
    const run = await setup(); await set_wounded_legs(LEFT_SIDE, 10);
    const obj = addinv(mksobj(ONAMES.POT_SPEED, false, false));
    observe_object(obj);
    assert.equal(!!game.objects[obj.otyp].oc_name_known, false);
    let prompts = 0;
    run._display.onEmptyQueue = () => {
        if (++prompts > 8) throw Error('unexpected repeated naming prompt');
        return 27;
    };
    clearMessages(); seed();
    assert.equal(await dopotion(obj), ECMD_TIME);
    assert.equal(Wounded_legs(), false);
    assert.equal(obj.where, OBJ_DELETED);
    assert.equal(!!game.objects[obj.otyp].oc_name_known, false);
    assert.ok(prompts > 0);
    assert.deepEqual(getRngLog(), []);
});

test('already known speed potion heals and consumes without requesting a name', async () => {
    await setup(); await set_wounded_legs(LEFT_SIDE, 10);
    const obj = addinv(mksobj(ONAMES.POT_SPEED, false, false));
    observe_object(obj); makeknown(obj.otyp); clearMessages(); seed();
    assert.equal(await dopotion(obj), ECMD_TIME);
    assert.equal(Wounded_legs(), false);
    assert.equal(obj.where, OBJ_DELETED);
    assert.equal(!!game.objects[obj.otyp].oc_name_known, true);
    assert.deepEqual(getRngLog(), []);
});

for (const kind of ['unwounded', 'cursed', 'haste spell', 'mounted']) {
    test(`${kind} retains speed gain and does not enter the healing arm`, async () => {
        await setup();
        if (kind === 'mounted') await mount();
        if (kind !== 'unwounded') await set_wounded_legs(LEFT_SIDE, 10);
        const obj = mksobj(kind === 'haste spell' ? ONAMES.SPE_HASTE_SELF : ONAMES.POT_SPEED,
            false, false);
        if (kind === 'cursed') await curse(obj);
        game.potion_unkn = 0; clearMessages(); seed();
        assert.equal(await peffects(obj), -1);
        assert.equal(Wounded_legs(), kind !== 'unwounded');
        assert.equal(game.potion_unkn, 0);
        const duration = game.u.intrinsic.HFast & TIMEOUT;
        const low = kind === 'cursed' ? 40 : 100;
        assert.ok(duration >= low && duration < low + 10);
        assert.equal(!!(game.u.intrinsic.HFast & FROMOUTSIDE),
            kind !== 'cursed' && kind !== 'haste spell');
        assert.match(getRngLog()[0], /^rn2\(10\)=/);
        assert.doesNotMatch(messages(), /leg.*better/);
    });
}

test('unknown counter update waits for healing feedback and preserves the async return', async () => {
    const run = await setup(); await set_wounded_legs(LEFT_SIDE, 10);
    const obj = mksobj(ONAMES.POT_SPEED, false, false);
    game.potion_unkn = 0; clearMessages();
    await pline('A pending message which must be acknowledged before the healing feedback.');
    let release, notify, held = false;
    const entered = new Promise(resolve => { notify = resolve; });
    run._display.onEmptyQueue = () => {
        if (held) return 32;
        held = true;
        return new Promise(resolve => { release = resolve; notify(); });
    };
    seed();
    const operation = peffects(obj);
    try {
        assert.equal(await Promise.race([entered.then(() => 'prompt'), operation.then(() => 'complete')]), 'prompt');
        assert.equal(game.potion_unkn, 0, 'counter increment follows awaited heal_legs');
        assert.notEqual(obj.where, OBJ_DELETED);
    } finally {
        if (release) release(32);
        assert.equal(await operation, -1);
    }
    assert.equal(game.potion_unkn, 1);
    assert.equal(Wounded_legs(), false);
    assert.deepEqual(getRngLog(), []);
});
