#!/usr/bin/env node

// C shk.c:955 same_price(), :1187 obfree(), and :2864 oid_price_adjustment().
// The C fixtures pin bill totals; these source-derived checks inspect the bill
// records, discarded objects and pointer ownership that screens cannot expose.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { ONAMES } from '../js/objects_data.js';
import { OBJ_DELETED } from '../js/const.js';
import { merged, weight } from '../js/invent.js';
import { mksobj, place_object, splitobj } from '../js/mkobj.js';
import { get_cost } from '../js/shk.js';
import { begin_burn, BURN_OBJECT } from '../js/timeout.js';
import { LS_OBJECT } from '../js/light.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/inventory-unpaid-merging.json', import.meta.url), 'utf8'));
for (const [i, segment] of recipe.segments.entries()) {
    await runSegment({ ...segment, storage: new InMemoryStorage() });
    const apples = game.invent.filter(o => o.otyp === ONAMES.APPLE);
    const shkp = game.level.monsters.find(m => m.isshk);
    const bill = shkp.eshk.bill_p;
    const paid = segment.name.endsWith('-pay');
    const expected = i === 6 ? [[6, 9]] : i === 7 ? [[3, 9], [3, 5]] : [[3, 9]];
    assert.deepEqual(apples.map(o => o.quan), expected.map(([quan]) => quan), segment.name);
    assert.equal(shkp.eshk.billct, paid ? 0 : apples.length);
    assert.equal(bill.length, paid ? 0 : apples.length);
    for (const [j, obj] of apples.entries()) {
        assert.equal(!!obj.unpaid, !paid);
        const bp = bill.find(b => b.bo_id === obj.o_id);
        assert.deepEqual(bp ? [bp.bquan, bp.price, !!bp.useup] : null,
                         paid ? null : [...expected[j], false]);
    }
    assert.equal((game.billobjs || []).length, 0, 'a merger is not a used-up purchase');
    assert.deepEqual(game.context.objsplit, { parent_oid: 0, child_oid: 0 });

    // Exercise a legal split/rejoin directly so the removed object is retained
    // by this test and its deallocation can be checked after merged returns.
    const obj = apples[0], quantity = obj.quan;
    const child = splitobj(obj, 1);
    assert.equal(await merged({ o: obj }, { o: child }), 1);
    assert.equal(obj.quan, quantity);
    assert.equal(child.where, OBJ_DELETED, 'the discarded stack is deallocated');
    assert.ok(!game.invent.includes(child));
    assert.deepEqual(game.context.objsplit, { parent_oid: 0, child_oid: 0 });
    if (!paid)
        assert.equal(bill.find(b => b.bo_id === obj.o_id).bquan, quantity);
}

// Construct unobserved floor candles, a valid C object state, with different
// id-based prices. C changes o_id but its light and timer still point at the
// same surviving object. Check both merge directions and the quoted price.
for (const reverse of [false, true]) {
    const pool = Array.from({ length: 16 }, () => mksobj(ONAMES.WAX_CANDLE, false, false));
    const dear = pool.find(o => o.o_id % 4 === 0);
    const cheap = pool.find(o => o.o_id % 4 !== 0);
    assert.ok(dear && cheap);
    const [dest, src] = reverse ? [dear, cheap] : [cheap, dear];
    for (const obj of [dest, src]) {
        obj.age = 400;
        obj.quan = 5;
        obj.owt = weight(obj);
        place_object(obj, game.u.ux, game.u.uy);
        await begin_burn(obj, false);
    }
    const shkp = game.level.monsters.find(m => m.isshk);
    const price = Math.max(get_cost(dest, shkp), get_cost(src, shkp));
    const id = dear.o_id;
    assert.equal(await merged({ o: dest }, { o: src }), 1);
    assert.equal(dest.o_id, id, 'unidentified mergers retain the higher price identity');
    assert.equal(get_cost(dest, shkp), price, 'the surviving stack retains the higher quote');
    assert.equal(src.where, OBJ_DELETED);
    const light = game.light_sources.filter(s => s.type === LS_OBJECT && s.id === dest.o_id);
    assert.equal(light.length, 1, 'C light pointers survive an object id change');
    assert.equal(light[0].range, 4);
    const timers = game.timer_base.filter(t => t.func_index === BURN_OBJECT && t.arg === dest);
    assert.equal(timers.length, 1);
    assert.ok(!game.timer_base.some(t => t.arg === src));
}
console.log('inventory merger state: PASS (eight C scenarios and two source-state price controls)');
