// Read-only actual-input reach and immutable C provenance. Native parity is checked separately.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Flying, Levitation, Sleepy} from '../js/youprop.js';
import {ONAMES} from '../js/objects_data.js';
import {W_AMUL} from '../js/const.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type: 'json'};

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/worn-amulet-polymorph-removal.json', import.meta.url)));
const raw = readFileSync(new URL('gen-sessions/generated/worn-amulet-polymorph-removal.session.json', import.meta.url));
const native = JSON.parse(raw);
const specs = [
    {old:ONAMES.AMULET_OF_ESP, target:ONAMES.AMULET_OF_LIFE_SAVING,
        worn:true, feedback:'You were wearing a triangular amulet.'},
    {old:ONAMES.AMULET_OF_RESTFUL_SLEEP, target:ONAMES.AMULET_OF_LIFE_SAVING,
        worn:true, feedback:'You were wearing an oval amulet.'},
    {old:ONAMES.AMULET_OF_FLYING, target:ONAMES.AMULET_OF_LIFE_SAVING,
        worn:true, feedback:'You were wearing an amulet of flying.'},
    {old:ONAMES.AMULET_OF_FLYING, target:ONAMES.AMULET_VERSUS_POISON,
        worn:false},
];

test('unchanged C fixture, exact input tuples and four asserted branches', () => {
    assert.equal(native.version, 5);
    assert.equal(native.source, 'c');
    assert.equal(createHash('sha256').update(raw).digest('hex'),
        '638bb7cfbc8b755ac3d144ad6c958de8e2e7de3d2c37a06c0acc62431fa92fd6');
    assert.equal(recipe.name, 'worn-amulet-polymorph-removal');
    assert.equal(native.segments.length, 4);
    assert.equal(recipe.segments.length, 4);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    const validTags = new Set(tags.requirements.map(t => t.id));
    for (const tag of recipe.coverage) assert.ok(validTags.has(tag), tag);
    for (const [i, part] of native.segments.entries()) {
        assert.ok(part.steps.length > 0);
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(part[field], recipe.segments[i][field]);
    }
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
});

for (const [index, part] of recipe.segments.entries()) test(part.name, async () => {
    const spec = specs[index], states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            states.push({step, hp:g.u.uhp, mortality:g.u.umortality || 0,
                sleepy:g.u.intrinsic?.HSleepy || 0, sleepyNow:Sleepy(),
                intrinsicFlight:g.u.intrinsic?.HFlying || 0,
                intrinsicLevitation:g.u.intrinsic?.HLevitation || 0,
                flying:Flying(), levitation:Levitation(),
                sleepMask:g.u.uprops?.SLEEPY || 0, flightMask:g.u.uprops?.FLYING || 0,
                espMask:g.u.uprops?.TELEPAT || 0, amulet:g.u.uamul?.o_id ?? null,
                initialDon:!!g.initial_don, dressing:!!g.afternmv,
                polypiles:g.u.uconduct?.polypiles || 0,
                inventory:(g.invent || []).map(o => ({id:o.o_id, type:o.otyp,
                    letter:o.invlet, worn:o.owornmask || 0})),
                text:g.nhDisplay.grid.map(row => row.map(c => c.ch).join('').trimEnd()).join('\n')});
        }};
        await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    const ready = states.findLast(s => !s.polypiles);
    const old = ready.inventory.find(o => o.letter === 'a');
    assert.ok(old);
    assert.equal(old.type, spec.old);
    assert.equal(old.worn, spec.worn ? W_AMUL : 0);
    assert.equal(ready.amulet, spec.worn ? old.id : null);
    assert.equal(ready.initialDon, false);
    assert.equal(ready.dressing, false);
    assert.equal(ready.flying, index === 2);
    assert.equal(ready.flightMask, index === 2 ? W_AMUL : 0);
    assert.equal(ready.espMask, index === 0 ? W_AMUL : 0);
    assert.equal(ready.sleepMask, index === 1 ? W_AMUL : 0);
    assert.equal(ready.sleepy > 0, index === 1, 'real Amulet_on created the sleep countdown');
    assert.ok(states.every(s => s.hp > 0 && !s.mortality));
    assert.ok(states.every(s => !s.intrinsicFlight && !s.intrinsicLevitation && !s.levitation));

    const last = states.at(-1), replacement = last.inventory.find(o => o.letter === old.letter);
    assert.equal(last.polypiles, 1);
    assert.equal(replacement.type, spec.target);
    assert.notEqual(replacement.id, old.id);
    assert.equal(replacement.worn, spec.worn ? W_AMUL : 0);
    assert.equal(last.amulet, spec.worn ? replacement.id : null);
    assert.ok(!last.inventory.some(o => o.id === old.id || o.type === ONAMES.POT_POLYMORPH));
    assert.equal(last.sleepy, 0);
    assert.equal(last.sleepyNow, false);
    assert.equal(last.sleepMask, 0);
    assert.equal(last.espMask, 0);
    assert.equal(last.flightMask, 0);
    assert.equal(last.flying, false);
    const text = states.map(s => s.text).join('\n');
    if (spec.feedback) assert.ok(text.includes(spec.feedback));
    assert.equal(text.includes('You land.'), index === 2);
    if (!spec.worn) assert.ok(!text.includes('You were wearing'));
    const observed = {segments:recipe.segments.map((_, i) =>
        ({steps:i === index ? states.map(s => ({screen:s.text})) : []}))};
    const one = {...recipe, branches:[recipe.branches[index]],
        branchAssertions:[recipe.branchAssertions[index]]};
    assert.deepEqual(branchAssertionErrors(one, observed), []);
});
