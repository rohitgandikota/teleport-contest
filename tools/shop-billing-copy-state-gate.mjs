#!/usr/bin/env node

// C mkobj.c:712, mon.c:2597 and shk.c:4197. Recorded prices are independent;
// source controls below exercise copy fields which the terminal cannot show.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeScreen, renderCell } from '../frozen/screen-decode.mjs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { copy_oextra, bill_dummy_object, mksobj } from '../js/mkobj.js';
import { copy_mextra } from '../js/mon.js';
import { doinvbill, addtobill, oid_price_adjustment } from '../js/shk.js';
import { ONAMES } from '../js/objects_data.js';
import { OBJ_FREE, OBJ_ONBILL, BURN_OBJECT } from '../js/const.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const input = read('gen-sessions/recipes/shop-billing-copies.json');
const oracle = read('gen-sessions/generated/shop-billing-copies.session.json');
const rows = frame => decodeScreen(frame.screen).map(row => row.map(renderCell).join(''));
for (const [i, segment] of input.segments.entries()) {
    const frames = oracle.segments[i].steps;
    let original;
    globalThis.__step_snapshot = { step: '*', cb: state => {
        // Keep the latest untouched unpaid target, before the billing copy.
        const obj = state.invent?.find(o => o.invlet === 'o');
        if (!state.billobjs?.length && obj?.unpaid) {
            const keeper = state.level.monsters.find(m => m.isshk);
            original = { obj, o_id: obj.o_id, adjustment: oid_price_adjustment(obj, obj.o_id),
                variablePrice: !(obj.dknown && state.objects[obj.otyp].oc_name_known),
                price: keeper.eshk.bill_p.find(bp => bp.bo_id === obj.o_id).price };
        }
    } };
    try {
        await runSegment({ ...segment, storage: new InMemoryStorage() });
    } finally {
        delete globalThis.__step_snapshot;
    }
    assert.ok(original, segment.name + ': unpaid target was reached');
    const shkp = game.level.monsters.find(m => m.isshk), bill = shkp.eshk.bill_p;
    assert.equal(game.billobjs.length, 1);
    const copy = game.billobjs[0], entry = bill.find(bp => bp.bo_id === copy.o_id);
    assert.ok(entry.useup);
    assert.equal(copy.where, OBJ_ONBILL);
    assert.equal(copy.unpaid, 1);
    assert.notEqual(copy.o_id, original.o_id);
    assert.ok(!game.invent.includes(copy));
    assert.equal(copy.timed | 0, 0);
    assert.equal(copy.owornmask | 0, 0);
    assert.equal(!!copy.in_use, false);
    assert.equal(!!copy.bypass, false);
    assert.equal(entry.price, original.price);
    if (original.variablePrice)
        assert.equal(Number(copy.o_id % 4 === 0), original.adjustment,
            segment.name + ': C nextoid keeps the original price adjustment');
    const billFrame = frames[frames.findLastIndex(frame => frame.key === 'I') + 1];
    const quote = rows(billFrame).map(row => /x - .*? (\d+) zorkmids/.exec(row)).find(Boolean);
    assert.ok(quote);
    assert.equal(entry.price * entry.bquan, Number(quote[1]), segment.name + ': C used-up price');
    assert.equal(copy.quan, entry.bquan);
    const stack = segment.name.startsWith('stack-') || segment.name === 'wax-stack';
    assert.equal(copy.quan, stack && !['stack-neutralize', 'stack-oil'].includes(segment.name) ? 3 : 1);
    if (segment.name.startsWith('named-') || segment.name === 'wax-candle')
        assert.equal(copy.oname, 'Ledger');
    assert.equal(!!copy.lamplit, false);
    assert.ok(!game.timer_base.some(t => t.arg === copy));
    assert.ok(!game.light_sources.some(l => l.id === copy.o_id));
    for (const obj of game.invent.filter(o => o.lamplit)) {
        assert.ok(game.timer_base.some(t => t.func_index === BURN_OBJECT && t.arg === obj));
        assert.ok(game.light_sources.some(l => l.id === obj.o_id));
    }
    assert.equal(game.iflags.suppress_price | 0, 0);
    assert.equal(await doinvbill(0), 1 + Number(!!shkp.eshk.debit));
}

// Struct assignment copies embedded coordinates and arrays by value, while
// eshk.bill_p remains a pointer. Existing destination allocations survive.
const source = {
    mgivenname: 'Archive', m_id: 42, data: {}, minvent: [], mw: {},
    mtrack: [{ x: 1, y: 2 }], mgoal: { x: 3, y: 4 },
    mextra: {
        mcorpsenm: 7,
        egd: { fakecorr: [{ fx: 2 }], gdlevel: { dnum: 0, dlevel: 2 } },
        epri: { shrpos: { x: 4, y: 5 } },
        eshk: { bill: [{ price: 13 }], bill_p: [{ price: 27 }], shk: { x: 5, y: 6 } },
        emin: { min_align: -1 }, edog: { ogoal: { x: 7, y: 8 } },
        ebones: { oldalign: { type: 1, record: 2 } },
    },
};
const kept = {}, destination = { mextra: { edog: kept } };
copy_mextra(destination, source);
assert.equal(destination.edog, kept);
assert.equal(destination.mgivenname, 'Archive');
assert.equal(destination.mcorpsenm, 7);
for (const key of ['egd', 'epri', 'eshk', 'emin', 'edog', 'ebones']) {
    assert.notEqual(destination.mextra[key], source.mextra[key]);
    assert.deepEqual(destination.mextra[key], source.mextra[key]);
}
assert.equal(destination.eshk.bill_p, source.mextra.eshk.bill_p);
assert.notEqual(destination.eshk.bill, source.mextra.eshk.bill);
assert.notEqual(destination.edog.ogoal, source.mextra.edog.ogoal);
const oldSaved = {}, obj = mksobj(ONAMES.CORPSE, false, false);
obj.oname = 'Ledger';
obj.oextra = { omonst: source, omid: 42, omailcmd: 'reply' };
const clone = { ...obj, oname: undefined, oextra: { omonst: oldSaved } };
copy_oextra(clone, obj);
assert.equal(clone.oextra.omonst, oldSaved);
assert.equal(clone.oname, 'Ledger');
assert.equal(clone.oextra.omid, 42);
assert.equal(clone.oextra.omailcmd, 'reply');
assert.equal(clone.omonst.nmon, null);
assert.equal(clone.omonst.data, source.data);
assert.equal(clone.omonst.minvent, source.minvent);
assert.equal(clone.omonst.mw, source.mw);
assert.notEqual(clone.omonst.mtrack, source.mtrack);
assert.notEqual(clone.omonst.mtrack[0], source.mtrack[0]);
assert.notEqual(clone.omonst.mgoal, source.mgoal);
assert.notEqual(clone.omonst.mextra, source.mextra);

// Copying a corpse into the bill must discard the revival association while
// keeping an independent saved monster. These source controls earn no C coverage.
obj.where = OBJ_FREE;
await addtobill(obj, false, false, true);
const beforeCount = game.billobjs.length;
await bill_dummy_object(obj);
assert.equal(game.billobjs.length, beforeCount + 1);
const corpseCopy = game.billobjs[0];
assert.equal(corpseCopy.oextra.omid || 0, 0);
assert.equal(obj.oextra.omid, 42);
assert.equal(corpseCopy.oname, 'Ledger');
assert.notEqual(corpseCopy.omonst, source);
assert.equal(corpseCopy.omonst.m_id, 42);

// Unlike candles, an already lit lamp retains lamplit on its billing copy.
// Only the live lamp owns the existing burn timer and light source.
const lamp = game.invent.find(o => o.otyp === ONAMES.OIL_LAMP);
assert.ok(lamp.lamplit);
await addtobill(lamp, false, false, true);
await bill_dummy_object(lamp);
const lampCopy = game.billobjs[0];
assert.ok(lampCopy.lamplit);
assert.equal(lampCopy.timed, 0);
assert.ok(!game.timer_base.some(t => t.arg === lampCopy));
assert.ok(game.timer_base.some(t => t.arg === lamp));
assert.ok(!game.light_sources.some(l => l.id === lampCopy.o_id));
assert.ok(game.light_sources.some(l => l.id === lamp.o_id));

const itemization = read('gen-sessions/recipes/shop-usedup-inventory.json');
const itemizationOracle = read('gen-sessions/generated/shop-usedup-inventory.session.json');
for (const [i, segment] of itemization.segments.entries()) {
    const frames = itemizationOracle.segments[i].steps;
    let before;
    const quantities = state => [...(state.invent || []), ...(state.billobjs || [])]
        .map(o => [o.o_id, o.quan]).sort(([a], [b]) => a - b);
    globalThis.__step_snapshot = {
        step: frames.findLastIndex(frame => frame.key === 'I'),
        cb: state => { before = quantities(state); },
    };
    try {
        await runSegment({ ...segment, storage: new InMemoryStorage() });
    } finally {
        delete globalThis.__step_snapshot;
    }
    assert.deepEqual(quantities(game), before, segment.name + ': displaying a bill preserves quantities');
    const shkp = game.level.monsters.find(m => m.isshk), bill = shkp.eshk.bill_p;
    const copies = game.billobjs || [], many = segment.name.startsWith('bill-paging');
    assert.equal(bill.length, many ? 25 : 1);
    const remaining = { 'partially-drunk-once': 2, 'partially-drunk-twice': 1 }[segment.name];
    if (remaining) {
        assert.equal(game.invent.find(o => o.invlet === 'o').quan, remaining);
        assert.equal(bill[0].bquan, 3);
        assert.equal(!!bill[0].useup, false);
        assert.equal(copies.length, 0);
        const used = bill[0].price * (bill[0].bquan - remaining);
        assert.equal(used, remaining === 2 ? 27 : 54);
    } else if (segment.name === 'fully-drunk-stack') {
        assert.equal(bill[0].bquan, 3);
        assert.ok(bill[0].useup);
        assert.equal(copies[0].quan, 1, 'the final consumed unit retains its own quantity');
        assert.ok(!game.invent.some(o => o.invlet === 'o'));
    } else if (many) {
        assert.equal(copies.length, 25);
        assert.equal(bill.reduce((sum, bp) => sum + bp.bquan * bp.price, 0), 675);
        for (const copy of copies) {
            assert.equal(copy.quan, 1);
            assert.equal(copy.where, OBJ_ONBILL);
            assert.equal(!!copy.in_use, false);
        }
        assert.equal(new Set(copies.map(o => o.oname)).size, 25);
    } else {
        assert.equal(copies.length, 0);
        assert.equal(!!bill[0].useup, false);
        assert.equal(shkp.eshk.debit, segment.name === 'debt-only' ? 13 : 0);
    }
    assert.equal(await doinvbill(0), many ? 25 : segment.name === 'unused-stock' ? 0 : 1);
    assert.equal(game.iflags.suppress_price | 0, 0);
}
console.log('shop billing copy state: PASS (21 C scenarios plus saved-data controls)');
