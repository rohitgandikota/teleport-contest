// Two unchanged native inputs with C-derived state and branch assertions.
// Default: node --test tools/stun-chest-attack-input-gate.mjs
// Alternate fixture: node tools/stun-chest-attack-input-gate.mjs /absolute/path/session.json
import fs from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {FROMFORM, TIMEOUT} from '../js/const.js';
import {PMNAMES} from '../js/monst_data.js';
import {observe} from './stun-form-duration-observer.mjs';
const fixture = process.argv[2] ? pathToFileURL(resolve(process.argv[2]))
    : new URL('gen-sessions/generated/stun-chest-attack-boundaries.session.json', import.meta.url);
const input = JSON.parse(fs.readFileSync(fixture));
assert.equal(input.segments.length, 2);
const labels = ['stalker-chest-gas', 'stalker-abbot-stun'];
const rows = [];
for (const [i, segment] of input.segments.entries()) {
    const {run, evidence:r} = await observe({name:labels[i], ...segment});
    assert.ok(Array.isArray(segment.steps) && segment.steps.length, 'native steps required');
    const expectedAnimations = segment.steps.map(s => (s.animation_frames || []).length);
    const actualAnimations = run.getAnimationFramesByStep().map(frames => frames.length);
    assert.deepEqual(actualAnimations, expectedAnimations, labels[i] + ': per-boundary animation counts');
    assert.equal(r.boundaries, segment.steps.length);
    rows.push(r);
    console.log(JSON.stringify({name:r.name, boundaries:r.boundaries, calls:r.calls,
        expectedAnimations:expectedAnimations.reduce((a,b) => a+b, 0),
        actualAnimations:actualAnimations.reduce((a,b) => a+b, 0)}));
}
if (process.env.STUN_EXTRA_EVIDENCE)
    fs.writeFileSync(process.env.STUN_EXTRA_EVIDENCE, JSON.stringify(rows, null, 2) + '\n');
const text = r => r.messages.map(m => m.text).join('\n');

test('trap.c:6477,6486 real trapped chest suppresses FROMFORM feedback and adds only timed stun', () => {
    const r = rows.find(r => r.name === 'stalker-chest-gas');
    const before = r.states.find(s => s.step === 59);
    const after = r.states.find(s => s.step === 60);
    assert.equal(before.form, PMNAMES.PM_STALKER);
    assert.equal(before.stun, FROMFORM);
    assert.ok(r.states.some(s => s.objects.some(o => o.trapped && !o.locked)));
    assert.doesNotMatch(text(r), /stagger|groovy feeling|vision blurs|get dizzy/);
    assert.equal(after.form, PMNAMES.PM_STALKER);
    assert.equal(after.stun & ~TIMEOUT, FROMFORM);
    const calls = r.rng.filter(e => e.step === after.step && e.call.includes('@js/trap.js:'));
    assert.deepEqual(calls.map(e => e.call.split(' @')[0]),
        ['rn2(13)=7', 'rn2(20)=9', 'rn2(13)=0', 'rn2(7)=3', 'rn2(5)=1']);
    assert.equal(after.stunTimer, 16 + 3 - 1, 'rn1(7,16), then same-turn timeout decrement');
    assert.match(text(r), /A cloud of black gas billows from the chest\./);
    assert.equal(r.hooksRestored, true);
});
test('uhitm.c:4407 real abbot kick adds damage without treating FROMFORM as a duration', () => {
    const r = rows.find(r => r.name === 'stalker-abbot-stun');
    const before = r.states.find(s => s.step === 52);
    const after = r.states.find(s => s.step === 53);
    assert.equal(before.form, PMNAMES.PM_STALKER);
    assert.equal(before.stun, FROMFORM);
    assert.equal(after.form, PMNAMES.PM_STALKER);
    assert.equal(after.stun, FROMFORM | 6);
    assert.ok(after.hp > 0);
    const calls = r.rng.filter(e => e.step === after.step).map(e => e.call);
    assert.ok(calls.includes('d(3,2)=6'));
    assert.ok(calls.some(c => /^rn2\(4\)=0 @js\/mhitu\.js:/.test(c)));
    assert.match(r.messages.find(m => m.step === after.step).text, /The abbot kicks!/);
    assert.equal(r.states.find(s => s.step === 54).stunTimer, 5);
    assert.equal(r.hooksRestored, true);
});
