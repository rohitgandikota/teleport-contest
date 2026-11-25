// Ordinary-key reach and observer neutrality. No native parity claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {observe, unobserved} from './muse-defensive-observe.mjs';
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {W_WEP, W_ARMG} from '../js/const.js';

const input = JSON.parse(fs.readFileSync(process.argv[2]
    || new URL('gen-sessions/recipes/monster-defensive-tin-opening.json', import.meta.url)));
const results = [];
const orcStates = r => r.states.flatMap(s => s.monsters
    .filter(m => m.type === P.PM_ORC).map(mon => ({...s, mon})));
const text = r => r.lines.map(l => l.text).join('\n');

function equippedOrc(r, cursed, species) {
    const states = orcStates(r);
    const equipped = states.find(({mon}) => mon.inventory.some(o => o.id === mon.weapon
        && o.type === O.CORPSE && o.corpse === P.PM_COCKATRICE
        && !!o.cursed === cursed && (o.worn & W_WEP))
        && mon.inventory.some(o => o.type === O.LEATHER_GLOVES && (o.worn & W_ARMG))
        && mon.inventory.some(o => o.type === O.DAGGER)
        && mon.inventory.some(o => o.type === O.TIN && o.corpse === species));
    assert.ok(equipped, 'floor acquisition and actual wielding reach the complete setup');
    assert.ok(states.some(s => s.mon.conf), 'thrown potion actually confuses the orc');
    return {states, equipped};
}

for (const [index, part] of input.segments.entries()) {
    test(part.name, async () => {
        const r = await observe(part, true);
        results.push({part, r});
        assert.equal(r.boundaries, part.moves.length + 1);
        assert.ok(!text(r).includes('You die'), 'setup needs no debug death rescue');
        if (index < 2) {
            const {states, equipped} = equippedOrc(r, index === 0, P.PM_LIZARD);
            const tin = equipped.mon.inventory.find(o => o.type === O.TIN);
            const consumed = states.find(s => s.step > equipped.step && s.selected === 19
                && s.mon.conf === 0 && !s.mon.inventory.some(o => o.id === tin.id));
            assert.ok(consumed, 'defensive lizard-tin action consumes and cures');
            assert.equal(consumed.mon.weapon, equipped.mon.weapon);
            assert.match(text(r), /The orc opens and eats the contents of a tin\./);
            assert.match(text(r), /The orc seems steadier now\./);
        } else if (index === 2) {
            const {states, equipped} = equippedOrc(r, true, P.PM_NEWT);
            const tin = equipped.mon.inventory.find(o => o.type === O.TIN);
            assert.ok(states.at(-1).mon.inventory.some(o => o.id === tin.id));
            assert.equal(states.at(-1).mon.conf, 1);
            assert.doesNotMatch(text(r), /opens and eats the contents|seems steadier/);
        } else {
            assert.equal(index, 3, 'bounded four-case recipe');
            const states = r.states.flatMap(s => s.monsters.filter(m => m.type === P.PM_WHITE_UNICORN)
                .map(mon => ({...s, mon})));
            assert.ok(states.some(s => s.mon.conf));
            assert.ok(states.some(s => s.selected === 17 && s.mon.conf === 0
                && s.mon.inventory.length === 0 && s.item === undefined));
            assert.match(text(r), /The tip of the white unicorn's horn glows!/);
            assert.match(text(r), /The white unicorn seems steadier now\./);
        }
    });
}
test('read-only observer preserves all five complete output collections', async () => {
    assert.equal(results.length, 4);
    for (const {part, r} of results) {
        const plain = await unobserved(part);
        for (const key of ['screens', 'cursors', 'calls', 'slices', 'frames'])
            assert.deepEqual(r.output[key], plain[key], `${part.name}: ${key}`);
    }
});
