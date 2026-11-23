#!/usr/bin/env node
// Ordinary-input reach and state checks. No runtime replacements or state injection.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { ONAMES } from '../js/objects_data.js';
import { OBJ_INVENT, OBJ_FLOOR, OBJ_CONTAINED, OBJ_ONBILL } from '../js/const.js';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

function snapshot(g) {
    const objects = [];
    function visit(obj, ancestors = []) {
        if ([ONAMES.CRYSKNIFE, ONAMES.WORM_TOOTH].includes(obj.otyp)) {
            objects.push({ id: obj.o_id, type: obj.otyp, where: obj.where,
                proof: obj.oerodeproof || 0, unpaid: !!obj.unpaid,
                noCharge: !!obj.no_charge, ancestors });
        }
        for (const child of obj.cobj || []) {
            visit(child, [...ancestors, { id: obj.o_id, type: obj.otyp, where: obj.where }]);
        }
    }
    for (const obj of g.invent || []) visit(obj);
    for (const obj of g.level?.objects || []) visit(obj);
    return { objects,
        copies: (g.billobjs || []).map(obj => ({ id: obj.o_id, type: obj.otyp, where: obj.where })),
        bills: (g.level?.monsters || []).filter(mon => mon.isshk)
            .flatMap(mon => (mon.eshk?.bill_p || []).map(entry => ({ ...entry }))) };
}

const carried = obj => obj.where === OBJ_INVENT && obj.ancestors.length === 0;
const onFloor = obj => obj.where === OBJ_FLOOR && obj.ancestors.length === 0;
const inFloorBag = obj => obj.where === OBJ_CONTAINED
    && obj.ancestors[0]?.where === OBJ_FLOOR;
const inHeldBag = obj => obj.where === OBJ_CONTAINED
    && obj.ancestors[0]?.where === OBJ_INVENT;
const knife = obj => obj.type === ONAMES.CRYSKNIFE;
const tooth = obj => obj.type === ONAMES.WORM_TOOTH;

let boundaries = 0, rngCalls = 0, cases = 0;
for (const name of ['held-object-placement', 'container-held-effects']) {
    const recipe = JSON.parse(readFileSync(new URL(
        `gen-sessions/recipes/${name}.json`, import.meta.url), 'utf8'));
    const native = JSON.parse(readFileSync(new URL(
        `gen-sessions/generated/${name}.session.json`, import.meta.url), 'utf8'));
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.equal(recipe.segments.length, native.segments.length);
    const storage = new InMemoryStorage();
    for (const [index, part] of recipe.segments.entries()) {
        for (const field of ['seed', 'datetime', 'nethackrc', 'moves']) {
            assert.equal(part[field], native.segments[index][field], part.name + ': ' + field);
        }
        const states = [];
        const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        let run;
        try {
            globalThis.__step_snapshot = { step: '*', cb: g => states.push(snapshot(g)) };
            run = await runSegment({ ...part, storage });
        } finally {
            if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
            else delete globalThis.__step_snapshot;
        }
        const final = snapshot(game);
        states.push(final);
        const seen = predicate => states.some(state => state.objects.some(predicate));
        assert.ok(seen(obj => knife(obj) && carried(obj)), part.name + ': actual carried crysknife');

        if (part.name === 'ordinary-drop') {
            assert.ok(final.objects.some(obj => tooth(obj) && onFloor(obj) && !obj.proof));
        } else if (['fixed-drop', 'fixed-throw'].includes(part.name)) {
            assert.ok(seen(obj => knife(obj) && carried(obj) && obj.proof === 1));
            assert.ok(final.objects.some(obj => knife(obj) && onFloor(obj) && obj.proof === 1));
        } else if (part.name === 'held-sack-drop') {
            assert.ok(seen(obj => knife(obj) && inHeldBag(obj)),
                'held-sack insertion skips release; conversion belongs to dropping the sack');
            assert.ok(final.objects.some(obj => tooth(obj) && inFloorBag(obj)));
        } else if (part.name === 'fixed-survives') {
            assert.ok(seen(obj => knife(obj) && carried(obj) && obj.proof === 1));
            assert.ok(final.objects.some(obj => knife(obj) && inFloorBag(obj) && obj.proof === 1));
        } else if (part.name === 'fixed-reverts') {
            assert.ok(seen(obj => knife(obj) && carried(obj) && obj.proof === 1));
            assert.ok(final.objects.some(obj => tooth(obj) && inFloorBag(obj) && !obj.proof));
        } else if (part.name === 'nested-insertion') {
            assert.ok(seen(obj => knife(obj) && inHeldBag(obj)));
            assert.ok(seen(obj => tooth(obj) && inFloorBag(obj)
                && obj.ancestors.length === 2));
            // The remaining inputs take the inner bag out to inspect it.
            assert.ok(final.objects.some(obj => tooth(obj) && inHeldBag(obj)));
        } else if (part.name === 'unpaid-insertion') {
            const before = states.findLast(state => state.objects.some(obj =>
                knife(obj) && carried(obj) && obj.unpaid));
            assert.ok(before, 'actual unpaid crysknife before floor-container insertion');
            const item = before.objects.find(obj => knife(obj) && carried(obj) && obj.unpaid);
            const oldBill = before.bills.find(entry => entry.bo_id === item.id);
            assert.ok(oldBill);
            // mkobj.c:736 bills while OBJ_FREE, so the object's no_charge stays 0.
            assert.ok(final.objects.some(obj => tooth(obj) && inFloorBag(obj)
                && !obj.unpaid && !obj.noCharge));
            const copy = final.copies.find(obj => obj.type === ONAMES.CRYSKNIFE
                && obj.where === OBJ_ONBILL);
            assert.ok(copy, 'old-type dummy bill survives conversion');
            const bill = final.bills.find(entry => entry.bo_id === copy.id);
            assert.ok(bill?.useup);
            assert.equal(bill.price, oldBill.price);
        } else {
            assert.equal(part.name, 'floor-insertion');
            assert.ok(final.objects.some(obj => tooth(obj) && inFloorBag(obj)));
        }
        assert.equal(run.getScreens().length, native.segments[index].steps.length);
        boundaries += run.getScreens().length;
        rngCalls += run.getRngLog().length;
        cases++;
        console.log(JSON.stringify({ name: part.name, boundaries: run.getScreens().length,
            rngCalls: run.getRngLog().length, sourceStateReached: true }));
    }
}
console.log(JSON.stringify({ cases, boundaries, rngCalls, runtimeOverrides: 0 }));
