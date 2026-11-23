#!/usr/bin/env node
// Normal imports and actual commands; C-derived state/decision expectations.
// Run: node --test tools/hallucination-predicate-input-gate.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { observe } from './hallucination-predicate-observer.mjs';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { FROMFORM, SINK } from '../js/const.js';

const fixture = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/generated/hallucination-predicate-boundaries.session.json', import.meta.url)));
const labels = ['resisted-ice', 'resisted-safe-monster', 'resisted-confirmation',
    'intrinsic-cloud-and-exercise'];
assert.equal(fixture.segments.length, labels.length);
const sink = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/generated/hallucination-predicate-sink.session.json', import.meta.url)));
const adjacent = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/generated/confusion-stun-boundaries.session.json', import.meta.url)));
const adjacentLabels = ['timed-confusion', 'timed-stun', 'bat-safe-monster', 'bat-attack-confirmation'];
assert.equal(sink.segments.length, 1);
assert.equal(adjacent.segments.length, adjacentLabels.length);
const inputs = [
    ...fixture.segments.map((s, i) => ({name:labels[i], ...s})),
    {name:'resisted-sink-19', ...sink.segments[0]},
    ...adjacent.segments.map((s, i) => ({name:adjacentLabels[i], ...s})),
];
const results = [];
for (const input of inputs) {
    const {evidence} = await observe(input);
    const r = {name:input.name, ...evidence};
    results.push(r);
    console.log(JSON.stringify({name:r.name, boundaries:r.boundaries, rngCalls:r.rngCalls,
        hooksRestored:r.hooksRestored}));
}
const get = name => results.find(r => r.name === name);
const text = r => r.messages.map(m => m.text).join('\n');
const blobState = r => r.states.find(s => s.peaceful.some(m => m.mnum === PMNAMES.PM_ACID_BLOB));
const blob = s => s.peaceful.find(m => m.mnum === PMNAMES.PM_ACID_BLOB);
const resisted = s => {
    assert.equal(s.armorType, ONAMES.GOLD_DRAGON_SCALE_MAIL);
    assert.ok(s.timeout > 0 && s.extrinsicResistance && s.resistance && !s.hallucinating);
};

test('pager.c:565 names resisted ice as ice', () => {
    const r = get('resisted-ice'), s = r.states.at(-1);
    resisted(s);
    assert.equal(s.waterName, 'ice');
    assert.match(text(r), /There is solid ice here\./);
});
test('display.h:159 keeps a visible peaceful monster safe under hallucination resistance', () => {
    const s = blobState(get('resisted-safe-monster'));
    resisted(s);
    assert.ok(!s.confused && !s.stunned && s.safeDog);
    assert.ok(blob(s).visible && blob(s).expectedSafe);
    assert.equal(blob(s).actualSafe, true);
});
test('uhitm.c:309 confirms an unimpaired peaceful attack with safe_pet disabled', () => {
    const r = get('resisted-confirmation'), s = blobState(r);
    resisted(s);
    assert.ok(!s.safeDog && s.confirm && !s.forcefight && !s.confused && !s.stunned);
    assert.ok(blob(s).visible && blob(s).x === s.x + 1 && blob(s).y === s.y);
    assert.match(text(r), /Really attack the acid blob\?/);
});
test('read.c:3095 uses the rotten-eggs rejection under intrinsic hallucination resistance', () => {
    const r = get('intrinsic-cloud-and-exercise'), s = r.states.at(-1);
    assert.equal(s.formId, PMNAMES.PM_BLACK_LIGHT);
    assert.ok(s.timeout > 0 && s.intrinsicResistance && !s.extrinsicResistance && !s.hallucinating);
    assert.match(text(r), /The scroll crumbles with a whiff of rotten eggs\./);
    assert.doesNotMatch(text(r), /someone cut the cheese/);
});
test('attrib.c:579 skips hallucination WIS abuse for a resistant black light', () => {
    const r = get('intrinsic-cloud-and-exercise');
    const start = r.states.find(s => s.timeout > 0).step;
    const s = r.states.find(s => s.moves === 5);
    assert.equal(s.formId, PMNAMES.PM_BLACK_LIGHT);
    assert.ok(s.timeout > 0 && s.intrinsicResistance && !s.extrinsicResistance);
    assert.ok(!s.hallucinating && !s.confused && !s.stunned && !s.sick && !s.vomiting
        && !s.fumbling && !s.woundedLegs);
    assert.deepEqual(r.rng.filter(r => r.step >= start && /^rn2\(2\)=.* @js\/attrib\.js:/.test(r.call)), [],
        'even a zero-result abuse draw is an extra RNG call');
});
test('fountain.c:699-713 resisted outcome 19 falls through to the ordinary sip', () => {
    const r = get('resisted-sink-19');
    const draw = r.rng.find(r => /^rn2\(20\)=19 @js\/fountain\.js:/.test(r.call));
    assert.ok(draw, 'actual sink quaff reaches 19');
    const s = r.states.find(s => s.step === draw.step - 1);
    resisted(s);
    assert.equal(s.terrain, SINK);
    const calls = r.rng.filter(r => r.step === draw.step && r.call.includes('@js/fountain.js:'))
        .map(r => r.call.split(' @')[0]);
    assert.match(calls[1] || '', /^rn2\(3\)=/);
    assert.equal(calls.length, calls[1] === 'rn2(3)=0' ? 2 : 3);
    if (calls.length === 3) assert.match(calls[2], /^rn2\(2\)=/);
    assert.match(text(r), /You take a sip of (cold|warm|hot) water\./);
    assert.doesNotMatch(text(r), /From the murky drain, a hand reaches up/);
});
for (const [name, prop, alias] of [['timed-confusion','confusion','confusionAlias'],
    ['timed-stun','stun','stunAlias']]) {
    test('positive control: ' + name + ' mirrors its alias and excludes safe monsters', () => {
        const s = blobState(get(name));
        assert.equal(s[prop], 100);
        assert.equal(s[alias], 1);
        assert.ok(s.safeDog && !s.hallucinating && blob(s).visible);
        assert.equal(blob(s).expectedSafe, false);
        assert.equal(blob(s).actualSafe, false);
    });
}
test('display.h:159 excludes a real FROMFORM-stunned giant bat from safe monsters', () => {
    const s = blobState(get('bat-safe-monster'));
    assert.equal(s.formId, PMNAMES.PM_GIANT_BAT);
    assert.equal(s.stun, FROMFORM);
    assert.equal(s.stunAlias, 0);
    assert.ok(s.stunned && !s.confused && !s.hallucinating && s.safeDog && blob(s).visible);
    assert.equal(blob(s).expectedSafe, false);
    assert.equal(blob(s).actualSafe, false);
});
test('uhitm.c:309 skips confirmation for an ordinary FROMFORM-stunned bat attack', () => {
    const r = get('bat-attack-confirmation'), s = blobState(r);
    assert.equal(s.formId, PMNAMES.PM_GIANT_BAT);
    assert.equal(s.stun, FROMFORM);
    assert.equal(s.stunAlias, 0);
    assert.ok(s.stunned && !s.confused && !s.hallucinating && !s.safeDog && s.confirm && !s.forcefight);
    assert.ok(blob(s).visible && blob(s).x === s.x + 1 && blob(s).y === s.y);
    assert.doesNotMatch(text(r), /Really attack the acid blob\?/);
    assert.match(text(r), /You bite the acid blob\./);
});
