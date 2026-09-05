#!/usr/bin/env node

// Persistent state behind the C type-naming, pauper and gem-price recordings.
// The final constructed controls exercise source states, not new C coverage.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { ONAMES as O, OCLASSES, SKILLS } from '../js/objects_data.js';
import { PMNAMES as P } from '../js/monst_data.js';
import { ONAME, OBJ_FLOOR, OBJ_BURIED, M_AP_F_DKNOWN, NON_PM } from '../js/const.js';
import { undiscover_object, observe_object } from '../js/o_init.js';
import { find_oid, gem_learned } from '../js/shk.js';
import { object_from_map } from '../js/pager.js';
import { num_spells } from '../js/spell.js';

const recipe = name => JSON.parse(readFileSync(new URL(
    `gen-sessions/recipes/${name}.json`, import.meta.url), 'utf8'));
const replay = segment => runSegment({ ...segment, storage: new InMemoryStorage() });
const editing = recipe('object-type-naming');
const names = ['Spark', 'Bright Spark', '', 'Spark', 'Spark', 'Q'.repeat(62),
    'Spark', 'Spark', '', 'Nova', '', ''];
for (const [i, segment] of editing.segments.entries()) {
    await replay(segment);
    const type = game.objects[O.POT_GAIN_ENERGY];
    assert.equal(type.oc_uname || '', names[i], segment.name);
    if (i < 10) {
        assert.equal(type.oc_encountered, 1, segment.name + ': encountered type');
        assert.ok(game.disco.includes(O.POT_GAIN_ENERGY),
            'clearing a name preserves an encountered discovery');
        const obj = game.invent.find(o => o.otyp === O.POT_GAIN_ENERGY);
        assert.equal(obj.quan, i === 6 ? 2 : 3, 'type prompt preserves quantity');
        assert.equal(ONAME(obj) || '', i === 6 ? 'Pebble' : '', 'instance name survives');
        assert.equal(!!obj.odiluted, i === 6, 'prompt does not remove actual dilution');
    } else {
        assert.equal((game.invent || []).length, 0, 'discovery dummy is not inventory');
        assert.equal(game.objects[O.SPE_FORCE_BOLT].oc_uname || '', i === 10 ? 'Nova' : '');
    }
}

const preknown = [O.TOUCHSTONE, null, O.FLINT, O.SPE_HEALING,
    O.SPE_PROTECTION, O.SPE_PROTECTION, O.SPE_PROTECTION, null,
    O.SACK, O.FOOD_RATION, O.SACK, null, O.SPE_FORCE_BOLT];
for (const [i, segment] of recipe('pauper-role-discoveries').segments.entries()) {
    await replay(segment);
    assert.equal(game.u.weapon_slots, 2, segment.name + ': two skill credits');
    for (const skill of game.u.weapon_skills) {
        assert.ok(skill.skill <= SKILLS.P_UNSKILLED, segment.name + ': reset skills');
        if (skill.skill === SKILLS.P_UNSKILLED)
            assert.equal(skill.advance, 0, 'unskilled practice starts at zero');
    }
    assert.equal(num_spells(), 0, 'recognizing a book does not teach its spell');
    assert.equal((game.invent || []).length, 0, 'pauper owns no starting items');
    if (preknown[i]) {
        assert.equal(game.objects[preknown[i]].oc_name_known, 1, segment.name);
        assert.ok(game.disco.includes(preknown[i]), segment.name + ': starting discovery');
    }
    if (i === 6)
        assert.equal(game.objects[O.POT_WATER].oc_name_known, 1, 'Cleric water overrides pauper');
}

for (const [i, segment] of recipe('shop-gem-identification').segments.entries()) {
    const prices = new Set();
    globalThis.__step_snapshot = { step: '*', cb: state => {
        for (const mon of state.level.monsters)
            for (const bill of mon.eshk?.bill_p || [])
                prices.add(bill.price);
    } };
    try { await replay(segment); }
    finally { delete globalThis.__step_snapshot; }
    const gem = game.invent.find(o => o.unpaid);
    assert.equal(gem.otyp, i ? O.WORTHLESS_WHITE_GLASS : O.DIAMOND);
    assert.equal(gem.quan, 2);
    assert.equal(gem.known, 1);
    assert.equal(find_oid(gem.o_id), gem, 'bill lookup retains the live object');
    const shop = game.level.monsters.find(m => m.eshk?.billct);
    const bill = shop.eshk.bill_p[0];
    assert.equal(bill.bo_id, gem.o_id);
    assert.equal(bill.bquan, 2);
    assert.equal(bill.price, i ? 7 : 5333, 'stored C price per gem');
    assert.ok(prices.has(i ? 1067 : 5333), 'C price before identification');
    assert.ok(prices.has(i ? 7 : 5333), 'C price after identification');
    // C's STRANGE_OBJECT request reprices every gem type on active bills.
    bill.price = -1;
    gem_learned(O.STRANGE_OBJECT);
    assert.equal(bill.price, i ? 7 : 5333);
}

const guards = recipe('object-type-guards');
for (const [i, segment] of guards.segments.entries()) {
    await replay(segment);
    assert.equal(game.objects[O.POT_GAIN_ENERGY].oc_uname || '',
        i === 0 || i === 6 ? 'Spark' : '', segment.name);
    if (i === 4 || i === 5) {
        const objs = i === 4 ? game.level.objects : game.invent;
        assert.equal(!!objs.find(o => o.otyp === O.POT_GAIN_ENERGY).dknown, false);
        assert.equal(game.objects[O.POT_GAIN_ENERGY].oc_encountered, 0);
    }
    if (i === 10) {
        const mimic = game.level.monsters.find(m => m.mappearance === O.TRIPE_RATION);
        assert.ok(mimic.m_ap_type & M_AP_F_DKNOWN, 'looking learns the mimic appearance');
        assert.ok(!game.level.objects.some(o => o.ox === mimic.mx && o.oy === mimic.my),
            'fake mimic object is not inserted on the floor');
        assert.equal(game.timer_base.length, 0, 'temporary objects retain no timers');
        assert.equal(game.light_sources.length, 0, 'temporary objects retain no lights');
    }
}

// C undiscover_object shifts only its class and retains known/encountered types.
const base = game.bases[OCLASSES.POTION_CLASS];
const types = [O.POT_HEALING, O.POT_GAIN_ENERGY, O.POT_SPEED];
game.disco = [];
types.forEach((t, i) => {
    game.disco[base + i] = t;
    game.objects[t].oc_name_known = game.objects[t].oc_encountered = 0;
});
await undiscover_object(types[1]);
assert.deepEqual(game.disco.slice(base, base + 3), [types[0], types[2], 0]);
game.objects[types[0]].oc_name_known = 1;
game.objects[types[2]].oc_encountered = 1;
await undiscover_object(types[0]);
await undiscover_object(types[2]);
assert.deepEqual(game.disco.slice(base, base + 3), [types[0], types[2], 0]);
const generic = { otyp: OCLASSES.POTION_CLASS, dknown: 0 };
observe_object(generic);
assert.equal(generic.dknown, 0, 'generic class glyphs do not become discoveries');

// C manufactures a corpse for stale map memory, then stops its rot timer.
const x = game.u.ux + 1, y = game.u.uy;
const timers = [...game.timer_base], lights = [...game.light_sources];
const fake = object_from_map({ kind: 'obj', otyp: O.CORPSE, body: true,
    corpsenm: P.PM_NEWT }, x, y);
assert.equal(fake.fake, true);
assert.equal(fake.otmp.corpsenm, P.PM_NEWT);
assert.equal(fake.otmp.timed, 0);
assert.deepEqual(game.timer_base, timers);
assert.deepEqual(game.light_sources, lights);
assert.equal(find_oid(fake.otmp.o_id), null, 'temporary corpse has no game owner');
const buried = { o_id: 1000001, otyp: O.CORPSE, oclass: OCLASSES.FOOD_CLASS,
    where: OBJ_BURIED, ox: x, oy: y, dknown: 0, corpsenm: NON_PM };
game.level.buriedobjs = [buried];
assert.equal(object_from_map({ kind: 'obj', otyp: O.CORPSE }, x, y).otmp, buried);
assert.equal(buried.dknown, 0, 'buried object is not observed as surface loot');
assert.equal(find_oid(buried.o_id), buried);
const chest = { o_id: 1000002, otyp: O.CHEST, oclass: OCLASSES.TOOL_CLASS,
    where: OBJ_FLOOR, ox: x, oy: y, cobj: [buried] };
game.level.objects.unshift(chest);
assert.equal(object_from_map({ kind: 'cmap' }, x, y).otmp, chest,
    'detected container trap prefers the chest at its location');
game.level.buriedobjs = [];
assert.equal(find_oid(buried.o_id), buried, 'object lookup descends into containers');
game.level.objects.shift();
for (const field of ['migrating_mons', 'mydogs']) {
    game[field] = [{ minvent: [chest] }];
    assert.equal(find_oid(buried.o_id), buried, field + ': nested inventory lookup');
    game[field] = [];
}
game.migrating_objs = [chest];
assert.equal(find_oid(buried.o_id), buried, 'migrating objects retain nested identity');
game.migrating_objs = [];
game.billobjs = [buried];
assert.equal(find_oid(buried.o_id), null, 'bill-only objects are excluded');

console.log('object type state: PASS (38 C scenarios plus source controls)');
