// Ordinary keys and read-only state observations. Native parity is separate.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {observe, unobserved, hashes} from './u-slip-free-observe.mjs';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {OBJ_INVENT, W_ARMC, W_ARMH} from '../js/const.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/u-slip-free-feedback.json', import.meta.url)));
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
const at = (states, step) => states.findLast(state => state.step <= step);

for (const [i, part] of recipe.segments.entries()) {
    test(`${part.name}: ordinary producer reach and observer neutrality`, async () => {
        const seen = await observe(part, true);
        const plain = await unobserved(part);
        assert.deepEqual(seen.output, plain, 'all five output collections');
        assert.deepEqual(seen.hashes, hashes(plain));
        assert.equal(seen.boundaries, part.moves.length + 1);
        const located = i % 2 === 0;
        assert.ok(seen.states.every(state => !!state.accessible === located));
        const text = seen.lines.map(line => line.text).join('\n');
        const success = seen.lines.find(line => line.text.includes('cannot hold onto'));
        assert.ok(success, 'the attack reaches successful slippery protection');
        const state = at(seen.states, success.step);
        const monster = state.monsters.find(mon => mon.type ===
            (i < 2 ? P.PM_OWLBEAR : P.PM_MIND_FLAYER));
        assert.ok(monster && !monster.peaceful && monster.hp > 0);
        assert.ok(Math.abs(monster.x - state.hero[0]) <= 1
            && Math.abs(monster.y - state.hero[1]) <= 1);
        if (located) assert.ok(success.text.startsWith(`<${monster.x},${monster.y}>: `));
        else assert.doesNotMatch(text, /<\d+,\d+>: /);
        if (i < 2) {
            assert.equal(state.form, P.PM_MASTER_MIND_FLAYER);
            assert.match(text, /You are now wearing a slippery cloak\./);
            assert.match(success.text, /The owlbear grabs you, but cannot hold onto your slippery cloak!/);
            const cloak = state.inventory.find(obj => obj.id === state.cloak);
            assert.equal(cloak.type, O.OILSKIN_CLOAK);
            assert.equal(cloak.where, OBJ_INVENT);
            assert.ok(cloak.worn & W_ARMC);
            assert.equal(!!cloak.cursed, false);
            assert.equal(!!cloak.greased, false);
            assert.equal(!!cloak.typeKnown, false);
            assert.ok(!state.stuck);
            assert.ok(!seen.states.at(-1).stuck);
            assert.doesNotMatch(text, /slippery slippery|grease wears off|will not fit/);
        } else {
            assert.equal(state.form, P.PM_STONE_GOLEM);
            assert.match(text, /You cover your visored helmet with a thick layer of grease\./);
            assert.match(success.text, /The mind flayer grabs you, but cannot hold onto your greased visored[ \n]+helmet!/);
            const helmet = state.inventory.find(obj => obj.id === state.helmet);
            assert.equal(helmet.type, O.HELMET);
            assert.equal(helmet.where, OBJ_INVENT);
            assert.ok(helmet.worn & W_ARMH);
            assert.equal(helmet.greased, 1);
            const can = state.inventory.find(obj => obj.type === O.CAN_OF_GREASE);
            assert.equal(can.spe, 9);
            assert.ok(seen.states.some(s => s.inventory.some(obj => obj.id === can.id && obj.spe === 10)));
            const wearOff = seen.lines.find(line => line.text.includes('The grease wears off.'));
            assert.ok(wearOff && wearOff.step > success.step);
            const after = at(seen.states, wearOff.step);
            assert.equal(after.inventory.find(obj => obj.id === helmet.id).greased, 0);
            assert.equal(after.helmet, helmet.id);
            assert.equal(after.intelligence, state.intelligence);
            assert.match(success.text, /--More--/);
            assert.match(wearOff.text, /--More--/);
        }
        if (!located) assert.deepEqual(seen.hashes, recipe.negativeOutputHashes[i],
            'original five negative hashes');
        assert.ok(seen.states.at(-1).hp > 0 && seen.states.at(-1).mh > 0);
        assert.doesNotMatch(text, /Die\?|Do you want your possessions identified/);
    });
}
