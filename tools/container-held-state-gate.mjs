// Source-state controls only. No native coverage credit or runtime replacement.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { mksobj, add_to_container, place_object } from '../js/mkobj.js';
import { obj_no_longer_held } from '../js/do.js';
import { drop_upon_death } from '../js/bones.js';
import { addinv, freeinv, obj_extract_self } from '../js/invent.js';
import { makemon } from '../js/makemon.js';
import { mpickobj } from '../js/steal.js';
import { addtobill } from '../js/shk.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { OBJ_FREE, OBJ_INVENT, OBJ_MINVENT, OBJ_CONTAINED, OBJ_FLOOR,
    OBJ_DELETED, OBJ_ONBILL, MM_NOGRP, MM_NOMSG, NO_MINVENT } from '../js/const.js';
import { initRng, enableRngLog, getRngLog, rn2 } from '../js/rng.js';

// Exact setup descriptor from the audited held-placement segment 3.
const source = {
    "seed": 99812,
    "datetime": "20000110090000",
    "nethackrc": "OPTIONS=name:Desired,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\nOPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,!safe_wait,!debug_mongen,pauper,nudist\nOPTIONS=suppress_alert:3.4.3\nOPTIONS=symset:DECgraphics\n",
    "moves": " \u0017uncursed empty sack\r   \u0017uncursed crysknife\r   aasb  \u001b\u001b da  #loot\ryo  \u001b\u001b",
    "steps": []
};
async function setup() {
    await runSegment({ ...source, moves: ' ', storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
}
const object = type => mksobj(type, false, false);
function floorBag() {
    const bag = object(ONAMES.SACK);
    place_object(bag, game.u.ux, game.u.uy);
    return bag;
}
function seedFor(predicate) {
    for (let seed = 1; seed < 1000; seed++) {
        initRng(seed);
        const rolls = [rn2(10), rn2(10)];
        if (predicate(rolls)) return { seed, rolls };
    }
    throw new Error('no control seed found');
}
function resetDraws(seed = 1) { initRng(seed); enableRngLog(); }
function linked(bag, obj, result = obj) {
    assert.equal(result, obj, 'surviving object identity');
    assert.equal(obj.where, OBJ_CONTAINED);
    assert.equal(obj.ocontainer, bag);
    assert.ok(bag.cobj.includes(obj));
}

test('positive: the real held-object producer converts an ordinary free knife', async () => {
    await setup();
    const knife = object(ONAMES.CRYSKNIFE);
    resetDraws();
    await obj_no_longer_held(knife);
    assert.equal(knife.otyp, ONAMES.WORM_TOOTH);
    assert.equal(knife.where, OBJ_FREE);
    assert.deepEqual(getRngLog(), []);
});

for (const destination of ['free', 'floor']) {
    test(`${destination} destination converts ordinary knife before returning`, async () => {
        await setup();
        const bag = destination === 'floor' ? floorBag() : object(ONAMES.SACK);
        const knife = object(ONAMES.CRYSKNIFE), weightBefore = bag.owt;
        resetDraws();
        const result = add_to_container(bag, knife);
        assert.ok(!(result instanceof Promise), 'paid source path stays synchronous');
        linked(bag, knife, result);
        assert.equal(bag.owt, weightBefore, 'C leaves weight calculation to caller');
        assert.deepEqual(getRngLog(), []);
        assert.equal(knife.otyp, ONAMES.WORM_TOOTH);
        assert.equal(knife.oerodeproof, 0);
    });
}

for (const held of ['hero', 'monster']) {
    test(`negative: directly ${held}-held container skips ordinary and fixed knives`, async () => {
        await setup();
        const bag = object(ONAMES.SACK);
        if (held === 'hero') {
            assert.equal(addinv(bag), bag);
            assert.equal(bag.where, OBJ_INVENT);
        } else {
            const mon = await makemon(game.mons[PMNAMES.PM_SOLDIER], game.u.ux, game.u.uy,
                MM_NOGRP | MM_NOMSG | NO_MINVENT);
            assert.ok(mon);
            await mpickobj(mon, bag);
            assert.equal(bag.where, OBJ_MINVENT);
        }
        for (const fixed of [0, 1]) {
            const knife = object(ONAMES.CRYSKNIFE);
            knife.oerodeproof = fixed;
            resetDraws();
            const result = add_to_container(bag, knife);
            assert.ok(!(result instanceof Promise));
            linked(bag, knife, result);
            assert.equal(knife.otyp, ONAMES.CRYSKNIFE);
            assert.equal(knife.oerodeproof, fixed);
            assert.deepEqual(getRngLog(), []);
        }
    });
}

test('a nested destination still triggers the hook when its outer bag is held', async () => {
    await setup();
    const outer = addinv(object(ONAMES.SACK)), inner = object(ONAMES.SACK);
    add_to_container(outer, inner);
    const knife = object(ONAMES.CRYSKNIFE);
    resetDraws();
    const result = await add_to_container(inner, knife);
    linked(inner, knife, result);
    assert.equal(outer.where, OBJ_INVENT);
    assert.equal(inner.where, OBJ_CONTAINED);
    assert.equal(knife.otyp, ONAMES.WORM_TOOTH);
    assert.deepEqual(getRngLog(), []);
});

for (const survives of [true, false]) {
    test(`fixed knife ${survives ? 'survives' : 'reverts'} with exactly one rn2(10)`, async () => {
        await setup();
        const bag = floorBag(), knife = object(ONAMES.CRYSKNIFE);
        knife.oerodeproof = 1;
        const { seed, rolls } = seedFor(r => (r[0] !== 0) === survives);
        resetDraws(seed);
        const result = await add_to_container(bag, knife);
        linked(bag, knife, result);
        assert.equal(knife.otyp, survives ? ONAMES.CRYSKNIFE : ONAMES.WORM_TOOTH);
        assert.equal(knife.oerodeproof, survives ? 1 : 0);
        assert.deepEqual(getRngLog(), [`rn2(10)=${rolls[0]}`]);
    });
}

test('nested contents run in cobj order before insertion', async () => {
    await setup();
    const target = floorBag(), inner = addinv(object(ONAMES.SACK));
    const first = object(ONAMES.CRYSKNIFE), second = object(ONAMES.CRYSKNIFE);
    first.oerodeproof = second.oerodeproof = 1;
    first.nomerge = second.nomerge = 1;
    add_to_container(inner, second);
    add_to_container(inner, first);
    assert.deepEqual(inner.cobj, [first, second]);
    freeinv(inner);
    const { seed, rolls } = seedFor(r => r[0] === 0 && r[1] !== 0);
    resetDraws(seed);
    const result = await add_to_container(target, inner);
    linked(target, inner, result);
    assert.equal(first.otyp, ONAMES.WORM_TOOTH);
    assert.equal(second.otyp, ONAMES.CRYSKNIFE);
    assert.deepEqual(getRngLog(), rolls.map(r => `rn2(10)=${r}`));
});

test('conversion precedes merging and returns the existing surviving tooth', async () => {
    await setup();
    const bag = floorBag(), tooth = object(ONAMES.WORM_TOOTH), knife = object(ONAMES.CRYSKNIFE);
    add_to_container(bag, tooth);
    resetDraws();
    const result = await add_to_container(bag, knife);
    assert.equal(result, tooth);
    assert.deepEqual(bag.cobj, [tooth]);
    assert.equal(tooth.quan, 2);
    assert.equal(knife.where, OBJ_DELETED);
    assert.deepEqual(getRngLog(), []);
});

test('negative: ordinary non-knife insertion preserves sync identity, order, weight and RNG', async () => {
    await setup();
    const bag = floorBag(), rock = object(ONAMES.ROCK), dagger = object(ONAMES.DAGGER);
    const weightBefore = bag.owt;
    resetDraws();
    assert.equal(add_to_container(bag, rock), rock);
    assert.equal(add_to_container(bag, dagger), dagger);
    assert.deepEqual(bag.cobj, [dagger, rock]);
    assert.equal(bag.owt, weightBefore);
    assert.deepEqual(getRngLog(), []);
});

test('negative: existing identical non-knife stacks still merge synchronously', async () => {
    await setup();
    const bag = floorBag(), first = object(ONAMES.DAGGER), second = object(ONAMES.DAGGER);
    resetDraws();
    assert.equal(add_to_container(bag, first), first);
    assert.equal(add_to_container(bag, second), first);
    assert.equal(first.quan, 2);
    assert.equal(second.where, OBJ_DELETED);
    assert.deepEqual(getRngLog(), []);
});

test('non-free input must be rejected before mutating either owner', async () => {
    await setup();
    const bag = floorBag(), knife = addinv(object(ONAMES.CRYSKNIFE));
    const inventoryBefore = [...game.invent];
    await assert.rejects(async () => add_to_container(bag, knife), /add_to_container.*not free/);
    assert.deepEqual(game.invent, inventoryBefore);
    assert.equal(knife.where, OBJ_INVENT);
    assert.equal(bag.cobj?.length || 0, 0);
});

test('extracting a held knife first makes the floor insertion legal', async () => {
    await setup();
    const bag = floorBag(), knife = addinv(object(ONAMES.CRYSKNIFE));
    obj_extract_self(knife);
    assert.equal(knife.where, OBJ_FREE);
    const result = await add_to_container(bag, knife);
    linked(bag, knife, result);
    assert.equal(knife.otyp, ONAMES.WORM_TOOTH);
});

test('positive producer composition: conversion then merge returns the surviving tooth', async () => {
    await setup();
    const bag = floorBag(), tooth = object(ONAMES.WORM_TOOTH), knife = object(ONAMES.CRYSKNIFE);
    add_to_container(bag, tooth);
    resetDraws();
    await obj_no_longer_held(knife);
    assert.equal(add_to_container(bag, knife), tooth);
    assert.deepEqual(bag.cobj, [tooth]);
    assert.equal(tooth.quan, 2);
    assert.equal(knife.where, OBJ_DELETED);
    assert.deepEqual(getRngLog(), []);
});

test('positive producer composition: fixed nested knives use cobj order', async () => {
    await setup();
    const inner = addinv(object(ONAMES.SACK));
    const first = object(ONAMES.CRYSKNIFE), second = object(ONAMES.CRYSKNIFE);
    first.oerodeproof = second.oerodeproof = first.nomerge = second.nomerge = 1;
    add_to_container(inner, second);
    add_to_container(inner, first);
    freeinv(inner);
    const { seed, rolls } = seedFor(r => r[0] === 0 && r[1] !== 0);
    resetDraws(seed);
    await obj_no_longer_held(inner);
    assert.equal(first.otyp, ONAMES.WORM_TOOTH);
    assert.equal(second.otyp, ONAMES.CRYSKNIFE);
    assert.deepEqual(getRngLog(), rolls.map(r => `rn2(10)=${r}`));
});

async function billedKnife() {
    const shopSource = JSON.parse(fs.readFileSync(new URL(
        'gen-sessions/recipes/shop-normal.json', import.meta.url))).segments[0];
    await runSegment({ ...shopSource, storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
    resetInputState();
    pushKeys(' '.repeat(20));
    const shopkeeper = game.level.monsters.find(m => m.isshk);
    assert.ok(shopkeeper);
    game.u.ushops = String.fromCharCode(shopkeeper.eshk.shoproom);
    const knife = addinv(object(ONAMES.CRYSKNIFE));
    await addtobill(knife, false, false, true);
    assert.ok(knife.unpaid);
    const price = shopkeeper.eshk.bill_p.find(b => b.bo_id === knife.o_id).price;
    freeinv(knife);
    return { knife, shopkeeper, price };
}
for (const producerOnly of [true, false]) {
    test(`${producerOnly ? 'positive producer' : 'insertion'}: unpaid conversion preserves old-type bill copy before linking`, async () => {
        const { knife, shopkeeper, price } = await billedKnife();
        const bag = floorBag(), before = new Set(game.billobjs || []);
        if (producerOnly) await obj_no_longer_held(knife);
        const result = await add_to_container(bag, knife);
        linked(bag, knife, result);
        assert.equal(knife.otyp, ONAMES.WORM_TOOTH);
        assert.equal(knife.unpaid, 0);
        const copy = game.billobjs.find(o => !before.has(o));
        assert.ok(copy);
        assert.equal(copy.otyp, ONAMES.CRYSKNIFE);
        assert.equal(copy.where, OBJ_ONBILL);
        const entry = shopkeeper.eshk.bill_p.find(b => b.bo_id === copy.o_id);
        assert.ok(entry.useup);
        assert.equal(entry.price, price);
    });
}

test('positive: bones container insertion already performs exactly two fixed-knife checks', async () => {
    await setup();
    const bag = floorBag(), knife = addinv(object(ONAMES.CRYSKNIFE));
    knife.oerodeproof = 1;
    let seed = 1, rolls;
    for (; seed < 1000; seed++) {
        initRng(seed);
        rolls = [rn2(10), rn2(5), rn2(10)];
        if (rolls[0] && rolls[2]) break;
    }
    assert.ok(seed < 1000);
    resetDraws(seed);
    await drop_upon_death(null, bag, game.u.ux, game.u.uy);
    linked(bag, knife);
    assert.equal(knife.otyp, ONAMES.CRYSKNIFE);
    assert.deepEqual(getRngLog(), [`rn2(10)=${rolls[0]}`, `rn2(5)=${rolls[1]}`, `rn2(10)=${rolls[2]}`]);
});
