// Source-derived controls. Normal imports, real object and shop producers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mksobj, add_to_container, bill_dummy_object, obj_attach_mid } from '../js/mkobj.js';
import { addinv, obj_extract_self, obfree } from '../js/invent.js';
import { addtobill, subfrombill, onbill, doinvbill } from '../js/shk.js';
import { readobjnam, xname } from '../js/objnam.js';
import { oname } from '../js/do_name.js';
import { dosave0, dorecover } from '../js/save.js';
import { run_timers, peek_timer, SHRINK_GLOB } from '../js/timeout.js';
import { getRngLog } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { ONAMES } from '../js/objects_data.js';
import { OMID, has_omid, OBJ_FREE, OBJ_INVENT, OBJ_ONBILL, OBJ_DELETED } from '../js/const.js';

const shop = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/shop-normal.json', import.meta.url)));

async function setup() {
    const run = await runSegment({ ...shop.segments[0], storage: new InMemoryStorage() });
    let prompts = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(++prompts < 100, 'bounded acknowledgments of real messages');
        return 27;
    };
    game._preNhgetchHook = null;
    resetInputState();
    const shkp = game.level.monsters.find(mon => mon.isshk);
    assert.ok(shkp, 'the existing ordinary shop recipe creates the shopkeeper');
    // Construct the addtobill caller's shop context, as in pick_obj.
    game.u.ushops = String.fromCharCode(shkp.eshk.shoproom);
    return shkp;
}

function glob(type = ONAMES.GLOB_OF_GRAY_OOZE) {
    const obj = mksobj(type, true, false);
    assert.equal(obj.globby, 1);
    assert.equal(obj.quan, 1);
    assert.equal(obj.owt, 20);
    assert.equal(obj.timed, 1);
    assert.equal(has_omid(obj), false);
    return obj;
}

async function tick(obj) {
    const deadline = peek_timer(SHRINK_GLOB, obj);
    assert.ok(deadline > game.moves);
    game.moves = deadline;
    await run_timers();
}

async function exhaust(obj) {
    const originalWeight = obj.owt;
    let callbacks = 0;
    while (obj.where !== OBJ_ONBILL && obj.where !== OBJ_DELETED) {
        assert.ok(callbacks++ < originalWeight, 'one real timer callback per weight unit');
        await tick(obj);
    }
    assert.equal(callbacks, originalWeight);
}

for (const type of [ONAMES.GLOB_OF_GRAY_OOZE, ONAMES.GLOB_OF_BROWN_PUDDING,
    ONAMES.GLOB_OF_GREEN_SLIME, ONAMES.GLOB_OF_BLACK_PUDDING]) {
    test(`billing initialized glob type ${type} captures its current weight`, async () => {
        const shkp = await setup();
        const obj = await addinv(glob(type));
        const prior = [...getRngLog()];
        await addtobill(obj, false, false, true);
        const bp = onbill(obj, shkp, true);
        assert.ok(bp);
        assert.equal(bp.bo_id, obj.o_id);
        assert.equal(bp.bquan, 1);
        assert.equal(bp.useup, false);
        assert.equal(obj.unpaid, 1);
        assert.equal(obj.where, OBJ_INVENT);
        assert.equal(obj.owt, 20);
        assert.deepEqual(getRngLog(), prior, 'silent billing draws no RNG');
        assert.equal(has_omid(obj), true);
        assert.equal(OMID(obj), 20);
    });
}

test('billing after a real shrink records 19, not the type base weight', async () => {
    await setup();
    const obj = await addinv(glob());
    await tick(obj);
    assert.equal(obj.owt, 19);
    await addtobill(obj, false, false, true);
    assert.equal(OMID(obj), 19);
});

test('already-unpaid acquisition preserves the original record after shrinking', async () => {
    const shkp = await setup();
    const obj = await addinv(glob());
    await addtobill(obj, false, false, true);
    const bp = onbill(obj, shkp, true);
    const savedBill = { ...bp };
    const extra = obj.oextra;
    await tick(obj);
    await addtobill(obj, false, false, true);
    assert.equal(obj.owt, 19);
    assert.equal(obj.oextra, extra);
    assert.equal(onbill(obj, shkp, true), bp);
    assert.deepEqual(bp, savedBill);
    assert.equal(OMID(obj), 20);
});

test('return and rebill overwrite the old capture while preserving the extra owner and name', async () => {
    const shkp = await setup();
    const obj = await addinv(glob());
    await oname(obj, 'Ledger', 0);
    await addtobill(obj, false, false, true);
    const extra = obj.oextra;
    await tick(obj);
    subfrombill(obj, shkp);
    assert.equal(obj.unpaid, 0);
    assert.equal(onbill(obj, shkp, true), null);
    assert.equal(OMID(obj), 20, 'removing a bill does not clear this object metadata');
    await addtobill(obj, false, false, true);
    assert.equal(obj.oextra, extra);
    assert.equal(OMID(obj), 19, 'new billing captures the new current weight');
    assert.ok(xname(obj).includes('Ledger'));
});

test('a free dummy glob is retained with captured weight and stopped timer', async () => {
    const shkp = await setup();
    const obj = glob();
    assert.equal(obj.where, OBJ_FREE);
    await addtobill(obj, false, true, true);
    assert.equal(obj.where, OBJ_ONBILL);
    assert.ok(game.billobjs.includes(obj));
    assert.equal(obj.timed, 0);
    assert.equal(onbill(obj, shkp, true).useup, true);
    assert.equal(OMID(obj), 20);
});

test('bill_dummy_object replaces its copied association with the dummy current weight', async () => {
    const shkp = await setup();
    const obj = await addinv(glob());
    await addtobill(obj, false, false, true);
    const price = onbill(obj, shkp, true).price;
    await tick(obj);
    await bill_dummy_object(obj);
    const dummy = game.billobjs.find(item => item.globby);
    assert.ok(dummy);
    assert.notEqual(dummy, obj);
    assert.notEqual(dummy.oextra, obj.oextra);
    assert.equal(dummy.owt, 19);
    assert.equal(dummy.timed, 0);
    assert.equal(OMID(dummy), 19);
    assert.equal(OMID(obj), 20);
    assert.equal(obj.unpaid, 0);
    assert.equal(onbill(dummy, shkp, true).price, price);
});

test('recursive container billing reaches the same private weight producer', async () => {
    const shkp = await setup();
    const outer = mksobj(ONAMES.SACK, false, false);
    const inner = mksobj(ONAMES.SACK, false, false);
    const obj = glob();
    await add_to_container(inner, obj);
    await add_to_container(outer, inner);
    await addinv(outer);
    await addtobill(outer, false, false, true);
    assert.ok(onbill(obj, shkp, true));
    assert.equal(obj.ocontainer, inner);
    assert.equal(inner.ocontainer, outer);
    assert.equal(OMID(obj), 20);
    assert.equal(has_omid(inner), false);
    assert.equal(has_omid(outer), false);
});

for (const size of ['small', 'medium']) {
    test(`${size} glob expiry restores its real billed weight and display size`, async () => {
        const shkp = await setup();
        const obj = await addinv(await readobjnam(`${size} glob of gray ooze`, null));
        const originalWeight = size === 'medium' ? 120 : 20;
        assert.equal(obj.owt, originalWeight, 'real wish producer sets the size');
        await addtobill(obj, false, false, true);
        const bp = onbill(obj, shkp, true);
        const price = bp.price;
        await exhaust(obj);
        assert.equal(obj.where, OBJ_ONBILL);
        assert.ok(game.billobjs.includes(obj));
        assert.equal(game.invent.includes(obj), false);
        assert.equal(obj.unpaid, 0);
        assert.equal(obj.timed, 0);
        assert.equal(peek_timer(SHRINK_GLOB, obj), 0);
        assert.equal(bp.useup, true);
        assert.equal(bp.price, price);
        assert.equal(await doinvbill(0), 1);
        assert.equal(obj.owt, originalWeight);
        assert.equal(OMID(obj), originalWeight);
        assert.ok(xname(obj).startsWith(`${size} glob of gray ooze`));
    });
}

test('positive residual weight is not replaced by the original weight in obfree', async () => {
    const shkp = await setup();
    const obj = await addinv(glob());
    await addtobill(obj, false, false, true);
    await tick(obj);
    obj_extract_self(obj);
    await obfree(obj);
    assert.equal(obj.where, OBJ_ONBILL);
    assert.equal(obj.owt, 19);
    assert.equal(onbill(obj, shkp, true).useup, true);
});

test('unbilled expiry deletes the glob without creating a bill or saved weight', async () => {
    await setup();
    const obj = await addinv(glob());
    await exhaust(obj);
    assert.equal(obj.where, OBJ_DELETED);
    assert.equal(obj.owt, 0);
    assert.equal(has_omid(obj), false);
    assert.ok(!game.billobjs.includes(obj));
});

for (const reason of ['outside shop', 'no charge', 'partly eaten']) {
    test(`rejected ${reason} glob gets no billing metadata`, async () => {
        const shkp = await setup();
        const obj = reason === 'partly eaten'
            ? await readobjnam('partly eaten glob of gray ooze', null) : glob();
        if (reason === 'outside shop')
            game.u.ushops = '';
        if (reason === 'no charge')
            obj.no_charge = 1;
        await addtobill(obj, false, false, true);
        assert.equal(has_omid(obj), false);
        assert.ok(!obj.unpaid);
        assert.equal(onbill(obj, shkp, true), null);
    });
}

test('non-glob billing leaves an existing corpse monster association untouched', async () => {
    const shkp = await setup();
    const obj = mksobj(ONAMES.CORPSE, true, false);
    obj_attach_mid(obj, shkp.m_id);
    const extra = obj.oextra;
    await addtobill(obj, false, false, true);
    assert.ok(onbill(obj, shkp, true));
    assert.equal(obj.oextra, extra);
    assert.equal(OMID(obj), shkp.m_id);
});

for (const usedup of [false, true]) {
    test(`full save preserves the ${usedup ? 'bill-list' : 'inventory'} glob capture`, async () => {
        await setup();
        const obj = await addinv(glob());
        await addtobill(obj, false, false, true);
        if (usedup)
            await exhaust(obj);
        else
            await tick(obj);
        const id = obj.o_id;
        const weight = obj.owt;
        assert.equal(await dosave0(), true);
        assert.equal(await dorecover(), true);
        const restored = (usedup ? game.billobjs : game.invent)
            .find(item => item.o_id === id);
        assert.ok(restored);
        assert.notEqual(restored, obj);
        assert.notEqual(restored.oextra, obj.oextra);
        assert.equal(restored.owt, weight);
        assert.equal(OMID(restored), 20);
    });
}
