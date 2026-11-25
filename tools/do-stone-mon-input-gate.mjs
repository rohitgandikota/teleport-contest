// Ordinary keys, normal runtime imports, read-only observation. C parity is separate.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {observe, unobserved, hashes} from './do-stone-mon-observe.mjs';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {OBJ_FLOOR} from '../js/const.js';

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/do-stone-mon.json', import.meta.url)));
const tuple = part => ['name', 'seed', 'datetime', 'nethackrc', 'moves']
    .map(field => ({field, present:Object.hasOwn(part, field), value:part[field]}));
if (process.argv[2]) {
    const input = JSON.parse(readFileSync(process.argv[2]));
    assert.equal(input.source, 'c'); assert.equal(input.version, 5);
    assert.equal(input.segments.length, recipe.segments.length);
    for (const [i, part] of input.segments.entries()) {
        assert.deepEqual(tuple(part), tuple(recipe.segments[i]));
        if (part.steps.length) assert.deepEqual(part.steps.map(s => s.key), [null, ...part.moves]);
    }
}
const at = (states, step) => states.findLast(s => s.step <= step);
for (const [i, part] of recipe.segments.entries()) test(`${part.name}: actual branch and all-five observer neutrality`, async () => {
    const seen = await observe(part, true), plain = await unobserved(part);
    assert.deepEqual(seen.output, plain); assert.deepEqual(seen.hashes, hashes(plain));
    assert.equal(seen.boundaries, part.moves.length + 1);
    const type = i < 2 ? P.PM_ORC : i === 2 ? P.PM_STRAW_GOLEM : P.PM_LIZARD;
    const targetName = i < 2 ? 'orc' : i === 2 ? 'straw golem' : 'lizard';
    const touch = seen.lines.find(l => l.text.includes(`The cockatrice touches the ${targetName}.`));
    assert.ok(touch, 'actual active AD_STON attack, not passive contact with the bird');
    const before = at(seen.states, touch.step);
    const bird = before.monsters.find(m => m.type === P.PM_COCKATRICE);
    const target = before.monsters.find(m => m.type === type);
    assert.ok(bird && bird.tame > 0 && bird.hp > 0);
    assert.ok(target && !target.peaceful && target.hp > 0);
    assert.ok(Math.abs(bird.x - target.x) <= 1 && Math.abs(bird.y - target.y) <= 1);
    assert.equal(before.form, P.PM_STONE_GOLEM, 'hero protection came from ordinary polymorph input');
    const text = seen.lines.map(l => l.text).join('\n');
    if (i < 2) {
        const death = seen.lines.find(l => l.text.includes('The orc turns to stone!'));
        assert.ok(death && death.step > touch.step);
        assert.match(touch.text, /--More--/, 'actual pending message before the owner');
        const after = at(seen.states, death.step);
        assert.ok(!after.monsters.some(m => m.id === target.id));
        const statue = after.objects.find(o => o.type === O.STATUE && o.corpsenm === P.PM_ORC);
        assert.ok(statue); assert.equal(statue.where, OBJ_FLOOR);
        assert.deepEqual([statue.x, statue.y], [target.x, target.y]);
        if (i === 0) assert.ok(death.text.startsWith(`<${target.x},${target.y}>: `));
        else assert.doesNotMatch(text, /<\d+,\d+>: /);
        assert.ok(after.monsters.find(m => m.id === bird.id).hpmax >= bird.hpmax);
    } else if (i === 2) {
        const converted = seen.lines.find(l => l.step > touch.step && l.text.includes('The straw golem solidifies...'));
        assert.ok(converted); assert.match(converted.text, /Now it's a stone golem\./);
        const after = at(seen.states, converted.step), mon = after.monsters.find(m => m.id === target.id);
        assert.ok(mon && mon.type === P.PM_STONE_GOLEM && mon.hp > 0);
        assert.deepEqual([mon.x, mon.y], [target.x, target.y]);
        assert.doesNotMatch(text, /The straw golem turns to stone!/);
        assert.ok(!after.objects.some(o => o.type === O.STATUE && o.corpsenm === type));
    } else {
        const after = at(seen.states, touch.step + 1), mon = after.monsters.find(m => m.id === target.id);
        assert.ok(mon && mon.type === P.PM_LIZARD);
        assert.equal(mon.hp, target.hp, 'first actual touch is harmless; later bites can reduce HP');
        assert.doesNotMatch(text, /The lizard turns to stone|solidifies/);
        assert.ok(seen.states.at(-1).monsters.some(m => m.id === target.id && m.hp > 0));
    }
    if (i !== 0) assert.deepEqual(seen.hashes, recipe.negativeOutputHashes[i]);
    assert.ok(seen.states.at(-1).hp > 0);
    assert.doesNotMatch(text, /Die\?|Do you want your possessions identified/);
});
