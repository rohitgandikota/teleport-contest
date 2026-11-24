import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {m_can_break_boulder} from '../js/monmove.js';

const input = JSON.parse(fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/monster-boulder-move.session.json', import.meta.url)));
assert.equal(input.source, 'c');
assert.equal(input.version, 5);
assert.equal(input.segments.length, 1);
const part = input.segments[0];
const key = '__step_snapshot', previous = Object.getOwnPropertyDescriptor(globalThis, key);
const states = [];
let run;
try {
    globalThis[key] = {step:'*', cb(g, step) {
        if (!g.level) return;
        states.push({step, text:g._toplines || '',
            riders:g.level.monsters.filter(m => m.mnum === PMNAMES.PM_DEATH)
                .map(m => ({id:m.m_id, x:m.mx, y:m.my, cooldown:m.mspec_used || 0,
                    canBreak:m_can_break_boulder(m), track:structuredClone(m.mtrack)})),
            objects:g.level.objects.filter(o => o.otyp === ONAMES.BOULDER || o.otyp === ONAMES.ROCK)
                .map(o => ({id:o.o_id, type:o.otyp, x:o.ox, y:o.oy, quantity:o.quan}))});
    }};
    run = await runSegment({...part, storage:new InMemoryStorage()});
} finally {
    if (previous) Object.defineProperty(globalThis, key, previous);
    else delete globalThis[key];
}
assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, key), previous);
const before = states.find(s => s.step === 66), after = states.find(s => s.step === 67);
const boulder = before.objects.find(o => o.x === 61 && o.y === 7);
const clean = call => call.replace(/\s*@.*$/, '').replace(/^\d+\s+/, '').trim();

test('unchanged native C records fracture at the selected movement boundary', () => {
    assert.match(part.steps[67].screen, /The boulder falls apart\./);
    assert.ok(part.steps[67].rng.includes('rn2(60)=5 @ fracture_rock(zap.c:5560)'));
});
test('ordinary earth-scroll and Rider inputs reach the same real obstruction', () => {
    assert.equal(boulder.type, ONAMES.BOULDER);
    assert.equal(boulder.quantity, 1);
    assert.deepEqual([before.riders[0].x, before.riders[0].y], [61, 8]);
    assert.equal(before.riders[0].canBreak, true);
});
test('fracturing preserves Rider location and object identity while creating twelve rocks', () => {
    assert.deepEqual(after.riders, before.riders);
    const rocks = after.objects.find(o => o.id === boulder.id);
    assert.deepEqual(rocks, {...boulder, type:ONAMES.ROCK, quantity:12});
    assert.match(after.text, /The boulder falls apart\./);
});
test('complete native RNG stream and every input slice remain exact', () => {
    assert.deepEqual(run.getRngLog().map(clean), part.steps.flatMap(s => s.rng).map(clean));
    assert.deepEqual(run.getRngSlices().map(s => s.map(clean)), part.steps.map(s => s.rng.map(clean)));
});
test('all native boundaries and zero-animation counts are preserved without observer leakage', () => {
    assert.equal(run.getScreens().length, 76);
    assert.equal(part.steps.length, 76);
    assert.equal(run.getRngLog().length, 2911);
    assert.equal(run.getAnimationFramesByStep().reduce((n, s) => n + s.length, 0), 0);
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, key), previous);
});
console.log(JSON.stringify({before, after, boundaries:run.getScreens().length,
    calls:run.getRngLog().length, hooksRestored:true}));
