// Ordinary input reach and observer neutrality. Native parity is checked separately.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {observe, unobserved, hashes} from './m-slips-free-observe.mjs';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {OBJ_FLOOR, OBJ_MINVENT, W_ARMH, W_ARMC} from '../js/const.js';

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/m-slips-free.json', import.meta.url)));
const tuple = part => ['name','seed','datetime','nethackrc','moves']
    .map(field => ({field, present:Object.hasOwn(part, field), value:part[field]}));
if (process.argv[2]) {
    const input = JSON.parse(readFileSync(process.argv[2]));
    assert.equal(input.source, 'c'); assert.equal(input.version, 5);
    assert.equal(input.segments.length, recipe.segments.length);
    for (const [i, part] of input.segments.entries()) {
        assert.deepEqual(tuple(part), tuple(recipe.segments[i]));
        if (part.steps.length) assert.deepEqual(part.steps.map(s => s.key), [null,...part.moves]);
    }
}
const at = (states, step) => states.findLast(s => s.step <= step);
for (const [i, part] of recipe.segments.entries()) test(`${part.name}: ordinary branch, ownership and all-five observer neutrality`, async () => {
    const seen = await observe(part, true), plain = await unobserved(part);
    assert.deepEqual(seen.output, plain);
    assert.deepEqual(seen.hashes, hashes(plain));
    assert.equal(seen.boundaries, part.moves.length + 1);
    const type = i === 3 ? O.OILSKIN_CLOAK : O.DWARVISH_IRON_HELM;
    const mask = i === 3 ? W_ARMC : W_ARMH;
    const owned = seen.states.find(s => s.inventory.some(o => o.type === type));
    assert.ok(owned, 'ordinary wish put the equipment in hero inventory');
    const obj = owned.inventory.find(o => o.type === type);
    assert.equal(!!obj.greased, i !== 1);
    assert.ok(seen.states.some(s => s.objects.some(o => o.id === obj.id && o.where === OBJ_FLOOR)));
    const picked = seen.states.find(s => s.monsters.some(m => m.type === P.PM_ORC
        && m.inventory.some(o => o.id === obj.id && o.where === OBJ_MINVENT && !o.worn)));
    assert.ok(picked, 'same ordinary dropped object was picked up unworn');
    const equipped = seen.states.find(s => s.monsters.some(m => m.type === P.PM_ORC
        && m.tame > 0 && m.inventory.some(o => o.id === obj.id && o.worn === mask)));
    assert.ok(equipped && equipped.step > picked.step, 'taming permits real m_dowear before combat');
    assert.ok(seen.lines.some(l => /orc.*puts on/.test(l.text)));
    const touch = seen.lines.find(l => /Your tentacles suck the orc/.test(l.text));
    assert.ok(touch && touch.step > equipped.step);
    assert.match(touch.text, /--More--/);
    const before = at(seen.states, touch.step);
    const mon = before.monsters.find(m => m.type === P.PM_ORC);
    assert.ok(mon && mon.hp > 0);
    assert.equal(before.form, P.PM_MIND_FLAYER);
    assert.ok(Math.abs(before.hero[0]-mon.x) <= 1 && Math.abs(before.hero[1]-mon.y) <= 1);
    const armor = mon.inventory.find(o => o.id === obj.id);
    assert.equal(armor.worn, mask); assert.equal(!!armor.cursed, i === 2);
    assert.equal(!!armor.greased, i !== 1);
    const text = seen.lines.filter(l => l.step >= touch.step).map(l => l.text).join('\n');
    const attackCalls = seen.output.slices[touch.step];
    if (i === 0) {
        const slip = seen.lines.find(l => l.step > touch.step && /cannot hold onto/.test(l.text));
        assert.ok(slip); assert.match(slip.text, /orc's greased hard hat!/);
        assert.match(slip.text, /--More--/);
        const atSlip = at(seen.states, slip.step).monsters.find(m => m.id === mon.id);
        assert.equal(atSlip.hp, mon.hp);
        assert.equal(atSlip.inventory.find(o => o.id === obj.id).greased, 1);
        assert.equal(attackCalls.at(-1), 'd(2,1)=2');
        assert.deepEqual(seen.output.slices[slip.step], ['rn2(2)=0']);
        assert.match(text, /The grease wears off\./);
        assert.doesNotMatch(text, /helm blocks|eat .*brain/);
    } else {
        assert.match(text, /helm blocks your attack/);
        assert.doesNotMatch(text, /cannot hold|grease wears|eat .*brain/);
        const offset = attackCalls.lastIndexOf('d(2,1)=2');
        assert.ok(offset >= 0);
        assert.deepEqual(attackCalls.slice(offset + 1), i === 2
            ? ['rn2(3)=0','rn2(8)=6'] : ['rn2(8)=4']);
    }
    const death = seen.lines.find(l => l.step > touch.step && /kill the poor orc/.test(l.text));
    assert.ok(death, 'ordinary 2-point tentacle damage remains after the slip or helmet block');
    const after = at(seen.states, death.step);
    assert.equal(mon.hp, 2);
    assert.ok(!after.monsters.some(m => m.id === mon.id));
    const dropped = after.objects.find(o => o.id === obj.id);
    assert.ok(dropped && dropped.where === OBJ_FLOOR);
    assert.equal(!!dropped.greased, i === 2 || i === 3);
    assert.deepEqual([dropped.x,dropped.y], [mon.x,mon.y]);
    if (i === 1 || i === 3) assert.deepEqual(seen.hashes, recipe.negativeOutputHashes[i]);
    assert.ok(seen.states.at(-1).hp > 0 && seen.states.at(-1).mh > 0);
    assert.doesNotMatch(text, /Die\?|Do you want your possessions identified/);
});
