// Pause the real billing message at its input boundary. No module mocks/loader.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mksobj, add_to_container, place_object } from '../js/mkobj.js';
import { addinv, freeinv } from '../js/invent.js';
import { addtobill } from '../js/shk.js';
import { pline } from '../js/display.js';
import { resetInputState, pushKeys } from '../js/input.js';
import { ONAMES } from '../js/objects_data.js';
import { OBJ_FREE, OBJ_CONTAINED, OBJ_DELETED, OBJ_ONBILL } from '../js/const.js';
const source = JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/shop-normal.json', import.meta.url))).segments[0];
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
for (const merge of [false, true]) {
    test(`pending billing preserves pre-link state and resolves to ${merge ? 'existing survivor' : 'input object'}`, async () => {
        await runSegment({ ...source, storage: new InMemoryStorage() });
        game._preNhgetchHook = null;
        resetInputState();
        pushKeys(' '.repeat(20));
        const shkp = game.level.monsters.find(m => m.isshk);
        assert.ok(shkp);
        game.u.ushops = String.fromCharCode(shkp.eshk.shoproom);
        const bag = mksobj(ONAMES.SACK, false, false);
        place_object(bag, game.u.ux, game.u.uy);
        const survivor = merge ? addinv(mksobj(ONAMES.WORM_TOOTH, false, false)) : null;
        if (survivor) {
            freeinv(survivor);
            add_to_container(bag, survivor);
        }
        const knife = addinv(mksobj(ONAMES.CRYSKNIFE, false, false));
        await addtobill(knife, false, false, true);
        assert.ok(knife.unpaid);
        const entry = shkp.eshk.bill_p.find(b => b.bo_id === knife.o_id);
        const price = entry.price;
        freeinv(knife);
        await pline('The previous message fills the line before the shopkeeper speaks.');
        resetInputState();
        const copiesBefore = [...(game.billobjs || [])], contentsBefore = [...(bag.cobj || [])];
        const reached = deferred(), release = deferred();
        game._preNhgetchHook = async () => { reached.resolve(); await release.promise; };
        const pending = add_to_container(bag, knife);
        let completed = false;
        if (pending instanceof Promise) pending.then(() => completed = true);
        let timeout;
        try {
            assert.ok(pending instanceof Promise, 'billing produces a completion Promise');
            await Promise.race([reached.promise, new Promise((_, reject) => {
                timeout = setTimeout(() => reject(new Error('billing input boundary not reached')), 2000);
            })]);
            assert.equal(completed, false);
            assert.equal(knife.where, OBJ_FREE);
            assert.equal(knife.otyp, ONAMES.CRYSKNIFE);
            assert.ok(knife.unpaid);
            assert.deepEqual(bag.cobj || [], contentsBefore);
            assert.deepEqual(game.billobjs || [], copiesBefore);
            assert.equal(entry.bo_id, knife.o_id);
        } finally {
            clearTimeout(timeout);
            game._preNhgetchHook = null;
            pushKeys(' '.repeat(10));
            release.resolve();
        }
        const result = await pending;
        assert.equal(result, survivor || knife);
        assert.equal(result.otyp, ONAMES.WORM_TOOTH);
        assert.equal(result.where, OBJ_CONTAINED);
        assert.equal(result.ocontainer, bag);
        assert.equal(knife.where, merge ? OBJ_DELETED : OBJ_CONTAINED);
        assert.equal(result.quan, merge ? 2 : 1);
        assert.equal(result.unpaid || 0, 0);
        const copy = game.billobjs.find(o => !copiesBefore.includes(o));
        assert.ok(copy);
        assert.equal(copy.otyp, ONAMES.CRYSKNIFE);
        assert.equal(copy.where, OBJ_ONBILL);
        const finalEntry = shkp.eshk.bill_p.find(b => b.bo_id === copy.o_id);
        assert.equal(finalEntry.price, price);
        assert.ok(finalEntry.useup);
    });
}
