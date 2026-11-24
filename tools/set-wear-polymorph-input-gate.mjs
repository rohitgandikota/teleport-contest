// Read-only actual-input reach. Native output parity is checked separately.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import tags from './gen-sessions/coverage-requirements.json' with {type: 'json'};
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Stealth, Invisible, Blind} from '../js/youprop.js';
import {Fast, Very_fast} from '../js/attrib.js';
import {ONAMES} from '../js/objects_data.js';
import {W_ARMF, W_ARMC} from '../js/const.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/worn-object-polymorph-callbacks.json', import.meta.url)));
const raw = readFileSync(new URL('gen-sessions/generated/worn-object-polymorph-callbacks.session.json', import.meta.url));
const native = JSON.parse(raw);
assert.equal(recipe.name, 'worn-object-polymorph-callbacks');
assert.deepEqual(branchAssertionErrors(recipe), []);
const validTags = new Set(tags.requirements.map(r => r.id));
for (const tag of recipe.coverage) assert.ok(validTags.has(tag), tag);

test('unchanged C fixture, exact input tuples and three asserted branches', () => {
    assert.equal(native.version, 5);
    assert.equal(native.source, 'c');
    assert.equal(createHash('sha256').update(raw).digest('hex'),
        'ec0947076ed9c59898b93fc7b02bd000d7a31b0f4f15cf6208d659c4c45220f8');
    assert.equal(native.segments.length, 3);
    assert.equal(recipe.segments.length, 3);
    for (const [index, part] of recipe.segments.entries())
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(part[field], native.segments[index][field]);
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
});

const cases = [
    {old: ONAMES.SPEED_BOOTS, target: ONAMES.ELVEN_BOOTS, slot: W_ARMF, worn: W_ARMF,
        message: 'You walk very quietly.'},
    {old: ONAMES.CLOAK_OF_PROTECTION, target: ONAMES.CLOAK_OF_INVISIBILITY, slot: W_ARMC, worn: W_ARMC,
        message: 'Suddenly you cannot see yourself.'},
    {old: ONAMES.SPEED_BOOTS, target: ONAMES.ELVEN_CLOAK, slot: W_ARMF, worn: 0},
];

for (const [index, part] of recipe.segments.entries()) test(part.name, async () => {
    const spec = cases[index], states = [];
    const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            states.push({step, hp: g.u.uhp, mortality: g.u.umortality || 0,
                intrinsicStealth: g.u.intrinsic?.HStealth || 0,
                intrinsicInvisibility: g.u.intrinsic?.HInvis || 0,
                stealth: Stealth(), invisible: Invisible(),
                blind: Blind(), fast: Fast(), veryFast: Very_fast(),
                initialDon: !!g.initial_don, dressing: !!g.afternmv,
                cancelledDon: !!g.context_takeoff?.cancelled_don,
                blockedStealth: g.u.blocked?.STEALTH || 0,
                stealthSources: g.u.uprops?.STEALTH || 0,
                invisibilitySources: g.u.uprops?.INVIS || 0,
                polypiles: g.u.uconduct?.polypiles || 0,
                inventory: (g.invent || []).map(o => ({id: o.o_id, type: o.otyp,
                    letter: o.invlet, worn: o.owornmask || 0, known: o.known || 0,
                    typeKnown: !!g.objects[o.otyp].oc_name_known})),
                text: g.nhDisplay.grid.map(row => row.map(c => c.ch).join('').trimEnd()).join('\n')});
        }};
        await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
        else delete globalThis.__step_snapshot;
    }
    const before = states.find(s => !s.polypiles
        && s.inventory.some(o => o.type === spec.old && o.worn === spec.slot));
    assert.ok(before, 'real W command dressed the original object');
    const old = before.inventory.find(o => o.type === spec.old);
    const last = states.at(-1), obj = last.inventory.find(o => o.letter === old.letter);
    const feedback = states.find(s => spec.message && s.text.includes(spec.message));
    const ready = states.findLast(s => !s.polypiles && !s.dressing
        && s.inventory.some(o => o.id === old.id && o.worn === spec.slot && o.known));
    assert.ok(ready, 'old item finished dressing before the ordinary dip');
    assert.equal(ready.initialDon, false);
    assert.equal(ready.cancelledDon, false);
    assert.ok(states.every(s => s.hp > 0 && s.mortality === 0));
    assert.ok(states.every(s => !s.intrinsicStealth && !s.intrinsicInvisibility));
    assert.equal(last.polypiles, 1, 'actual successful polymorph dip');
    assert.equal(obj.type, spec.target);
    assert.notEqual(obj.id, old.id);
    assert.equal(obj.worn, spec.worn);
    assert.equal(last.inventory.some(o => o.type === ONAMES.POT_POLYMORPH), false);
    assert.equal(last.inventory.some(o => o.id === old.id), false);
    assert.equal(obj.typeKnown, !!spec.worn, 'same-slot callback discovers the replacement');
    assert.equal(obj.known, +!!spec.worn, 'same-slot callback reveals enchantment');
    assert.equal(last.stealth, index === 0);
    assert.equal(last.invisible, index === 1);
    if (spec.message) {
        assert.ok(feedback, 'C callback feedback reached through normal dip');
        assert.equal(feedback.initialDon, false, 'selected callback, not initial don');
        if (index === 0) {
            assert.equal(feedback.blockedStealth, 0);
            assert.equal(feedback.stealthSources & ~W_ARMF, 0);
        } else {
            assert.equal(feedback.blind, false);
            assert.equal(feedback.invisibilitySources & ~W_ARMC, 0);
        }
    } else {
        assert.ok(states.every(s => !s.text.includes('very quietly.')));
    }
    if (index !== 1) {
        assert.ok(states.some(s => s.text.includes('You feel yourself slow down a bit.')));
        assert.equal(last.fast, true, 'role intrinsic Fast remains after losing the boots');
        assert.equal(last.veryFast, false);
    }
});
