import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PMNAMES} from '../js/monst_data.js';
import {PIT, POLY_TRAP} from '../js/const.js';
import {observeTrapping} from './m-move-trapping-observer.mjs';
const {PM_KITTEN, PM_LARGE_CAT, PM_ROCK_MOLE} = PMNAMES;

const input = JSON.parse(fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/m-move-trapping-controls.session.json', import.meta.url)));
assert.equal(input.version, 5);
assert.equal(input.segments.length, 3);
const evidence = [];
for (const part of input.segments) evidence.push(await observeTrapping(part));
const [poly, fatal, caught] = evidence;
const at = (run, step) => run.states.find(s => s.step === step);
const monster = (run, step, id = 63) => at(run, step).monsters.find(m => m.id === id);

test('ordinary polymorph changes the same kitten on the arrival square', () => {
    assert.equal(monster(poly, 36).type, PM_KITTEN);
    assert.equal(monster(poly, 36).trapped, false);
    const after = monster(poly, 37);
    assert.equal(after.type, PM_ROCK_MOLE);
    assert.equal(after.dataIndex, PM_ROCK_MOLE);
    assert.equal(after.trap, POLY_TRAP);
    assert.equal(after.trapped, false);
    assert.match(at(poly, 37).text, /kitten turns into a rock mole/);
});
test('that polymorph uses postmov, not the initial caught-monster call', () => {
    assert.equal(poly.trapCalls.length, 3);
    assert.ok(poly.trapCalls.every(c => c.arrival && !c.initial));
    assert.ok(poly.trapCalls.some(c => /trapeffect_poly_trap/.test(c.stack)));
    assert.equal(poly.trapCalls[0].monsters.find(m => m.id === 63).trapped, false);
});
test('a fresh pit kills a low-HP kitten rather than reaching an initial recheck', () => {
    assert.equal(monster(fatal, 30).type, PM_KITTEN);
    assert.equal(monster(fatal, 30).hp, 2);
    assert.equal(monster(fatal, 30).trapped, false);
    assert.equal(monster(fatal, 31), undefined);
    assert.match(at(fatal, 31).text, /falls into a pit!.*kitten is killed!/);
    assert.ok(fatal.trapCalls.length > 0);
    assert.ok(fatal.trapCalls.every(c => c.arrival && !c.initial));
});
test('a surviving large cat is really trapped, then reaches the initial recheck', () => {
    const cat = monster(caught, 34);
    assert.equal(cat.type, PM_LARGE_CAT);
    assert.equal(cat.trapped, true);
    assert.equal(cat.trap, PIT);
    assert.equal(cat.hp, 4);
    assert.deepEqual(caught.trapCalls.map(c => c.call.split(' @')[0]),
        ['rn2(40)=6', 'rn2(40)=12', 'rn2(40)=0']);
    assert.ok(caught.trapCalls.every(c => c.initial && !c.arrival));
    assert.ok(caught.trapCalls.every(c => c.monsters.find(m => m.id === cat.id).trapped));
});
test('failed escape keeps the form and square; successful escape resumes movement', () => {
    for (const step of [35, 37]) {
        const cat = monster(caught, step);
        assert.deepEqual([cat.type, cat.x, cat.y, cat.trapped], [PM_LARGE_CAT, 39, 5, true]);
    }
    const cat = monster(caught, 39);
    assert.deepEqual([cat.type, cat.x, cat.y, cat.trapped], [PM_LARGE_CAT, 38, 5, false]);
    assert.match(at(caught, 39).text, /large cat climbs out of the pit/);
});
test('all input is consumed as boundaries with no hook leakage or animations', () => {
    evidence.forEach((e, i) => {
        assert.equal(e.boundaries, input.segments[i].moves.length + 1);
        assert.equal(e.hooksRestored, true);
        assert.equal(e.animations, 0);
    });
});
console.log(JSON.stringify(evidence.map(({states, trapCalls, ...e}) => ({...e,
    trapCalls:trapCalls.map(({stack, monsters, ...c}) => c)}))));
