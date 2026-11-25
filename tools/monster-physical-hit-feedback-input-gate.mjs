// Ordinary keys and read-only observations. Native parity is checked separately.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {observe, unobserved, hashes} from './monster-physical-feedback-observe.mjs';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {OBJ_MINVENT, W_WEP} from '../js/const.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/monster-physical-hit-feedback.json', import.meta.url)));
const tuple = part => ['name', 'seed', 'datetime', 'nethackrc', 'moves']
    .map(field => ({field, present:Object.hasOwn(part, field), value:part[field]}));
if (process.argv[2]) {
    const proposed = JSON.parse(readFileSync(process.argv[2]));
    assert.equal(proposed.version, 5);
    assert.equal(proposed.source, 'c');
    assert.equal(proposed.segments.length, recipe.segments.length);
    for (const [i, part] of proposed.segments.entries()) {
        assert.deepEqual(tuple(part), tuple(recipe.segments[i]));
        if (part.steps.length)
            assert.deepEqual(part.steps.map(step => step.key), [null, ...part.moves]);
    }
}

for (const [i, part] of recipe.segments.entries()) {
    test(`${part.name}: ordinary reach and all-five observer neutrality`, async () => {
        const seen = await observe(part, true);
        const plain = await unobserved(part);
        assert.deepEqual(seen.output, plain);
        assert.deepEqual(seen.hashes, hashes(plain));
        assert.equal(seen.boundaries, part.moves.length + 1);
        const located = i % 2 === 0;
        assert.ok(seen.states.every(state => !!state.accessible === located));
        assert.ok(seen.states.some(state => state.form === P.PM_STONE_GOLEM));
        const text = seen.lines.map(line => line.text).join('\n');
        assert.match(text, /--More--/);
        if (i < 2) {
            assert.match(text, located
                ? /<40,6>: The owlbear grabs you!/
                : /The owlbear grabs you!/);
            assert.ok(seen.states.some(state => state.monsters.some(mon =>
                mon.id === state.stuck && mon.type === P.PM_OWLBEAR)));
        } else {
            assert.match(text, /The skeleton picks up a cockatrice corpse\./);
            assert.match(text, /The skeleton wields a cockatrice corpse!/);
            assert.match(text, located
                ? /<40,6>: The skeleton hits you with the cockatrice corpse\./
                : /The skeleton hits you with the cockatrice corpse\./);
            const held = seen.states.flatMap(state => state.monsters)
                .filter(mon => mon.type === P.PM_SKELETON)
                .flatMap(mon => mon.inventory.filter(obj => obj.id === mon.weapon
                    && obj.type === O.CORPSE && obj.corpse === P.PM_COCKATRICE
                    && obj.carrier === mon.id && obj.where === OBJ_MINVENT
                    && (obj.worn & W_WEP)));
            assert.ok(held.length);
            const corpseIds = new Set(held.map(obj => obj.id));
            assert.ok(seen.states.some(state => state.floor.some(obj =>
                corpseIds.has(obj.id))), 'the same corpse passes from floor to wielded inventory');
            assert.ok(seen.states.every(state => !state.stoned));
            assert.equal(seen.states.at(-1).form, P.PM_STONE_GOLEM);
        }
        if (!located) {
            assert.doesNotMatch(text, /<\d+,\d+>: /);
            const expected = recipe.negativeOutputHashes[i];
            assert.deepEqual(seen.hashes, expected, 'original five negative output hashes');
        }
        assert.ok(seen.states.at(-1).hp > 0);
    });
}
