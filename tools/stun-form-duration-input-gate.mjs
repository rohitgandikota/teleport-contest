// Ordinary recorded inputs with C-derived state and decision assertions.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import {observe} from './stun-form-duration-observer.mjs';
const fixture = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/generated/stun-form-duration-boundaries.session.json', import.meta.url)));
const labels = ['bat-restore-ability', 'bat-vomiting', 'bat-water-wall',
    'bat-known-terrain', 'bat-full-terrain', 'confused-known-terrain', 'expired-bat-stun-to-ant'];
assert.equal(fixture.segments.length, labels.length);
const evidence = [];
for (const [i, input] of fixture.segments.entries()) {
    const {evidence:r} = await observe({name:labels[i], ...input});
    evidence.push(r);
    console.log(JSON.stringify({name:r.name, boundaries:r.boundaries, calls:r.calls,
        hooksRestored:r.hooksRestored}));
}
import { FROMFORM, TIMEOUT, WATER } from '../js/const.js';
import { PMNAMES } from '../js/monst_data.js';
const get = name => evidence.find(r=>r.name===name);
const text = r => r.messages.map(m=>m.text).join('\n');
const formStun = s => {
    assert.equal(s.form, PMNAMES.PM_GIANT_BAT);
    assert.equal(s.stun, FROMFORM);
    assert.equal(s.stunAlias, 1);
    assert.ok(s.stunned && !s.confused && !s.hallucinating);
};
test('apply.c:4458 counts FROMFORM stun as an unfixable trouble', () => {
    const s=get('bat-restore-ability').states.find(s=>s.stunned);
    formStun(s);
    assert.equal(s.unfixable, 1);
});
test('potion.c:660 blessed restore ability feels better with FROMFORM stun', () => {
    const r=get('bat-restore-ability');
    formStun(r.states.find(s=>s.stunned));
    assert.match(text(r), /Wow!  This makes you feel better!/);
    assert.doesNotMatch(text(r), /Wow!  This makes you feel great!/);
});
test('timeout.c:227 vomiting sees FROMFORM stun before it adds a timed stun', () => {
    const r=get('bat-vomiting');
    const s=r.states.find(s=>s.vomiting===9);
    formStun(s);
    assert.match(text(r), /You can't think straight\./);
    assert.doesNotMatch(text(r), /You can't seem to think straight\./);
});
test('timeout.c:215 adds only the existing stun timeout to 2d4', () => {
    const r=get('bat-vomiting');
    formStun(r.states.find(s=>s.vomiting===7));
    const s=r.states.find(s=>s.vomiting===6);
    assert.equal(s.stun & ~TIMEOUT, FROMFORM);
    assert.equal(s.stunAlias, 1);
    const draw = r.rng.find(e => e.step === s.step && /^d\(2,4\)=/.test(e.call));
    assert.ok(draw);
    assert.equal(s.stunTimer, Number(draw.call.split('=')[1]) - 1);
    assert.ok(s.stunTimer >= 1 && s.stunTimer <= 7,
        '2d4 followed by the same-turn decrement must leave 1..7 turns, not ' + s.stunTimer);
});
test('hack.c:1894 FROMFORM stun bypasses known liquid-wall avoidance', () => {
    const r=get('bat-water-wall');
    const s=r.states.find(s=>s.stunned);
    formStun(s);
    assert.ok(s.flying && s.nearby.some(n=>n.typ===WATER && n.seenv));
    assert.doesNotMatch(text(r), /You avoid flying into the wall of water\./);
});
test('detect.c:2362 rejects known terrain while FROMFORM-stunned', () => {
    const r=get('bat-known-terrain'), s=r.states.at(-1);
    formStun(s);
    assert.equal(s.pluralIntrinsicsPresent, false);
    assert.match(text(r), /You are too disoriented for this\./);
    assert.doesNotMatch(text(r), /Showing known terrain only/);
});
test('positive control: detect.c:2362 full map bypasses impairment', () => {
    const r=get('bat-full-terrain');
    formStun(r.states.at(-1));
    assert.match(text(r), /Showing underlying terrain only/);
    assert.doesNotMatch(text(r), /too disoriented/);
});
test('positive control: real timed confusion still rejects known terrain through its alias', () => {
    const r=get('confused-known-terrain'), s=r.states.at(-1);
    assert.equal(s.confusion, 100);
    assert.equal(s.confusionAlias, 1);
    assert.ok(s.confused && !s.stunned);
    assert.equal(s.pluralIntrinsicsPresent, false);
    assert.match(text(r), /You are too disoriented for this\./);
    assert.doesNotMatch(text(r), /Showing known terrain only/);
});
test('polyself.c:87 clearing FROMFORM after expiry must clear effective Stunned', () => {
    const r=get('expired-bat-stun-to-ant'), s=r.states.at(-1);
    assert.ok(r.states.some(s=>s.form===PMNAMES.PM_GIANT_BAT && s.stun===FROMFORM && s.stunAlias===1));
    assert.equal(s.form, PMNAMES.PM_GIANT_ANT);
    assert.equal(s.stun, 0);
    assert.equal(s.stunTimer, 0);
    assert.equal(s.stunned, false, 'a stale flat alias must not outlive the last real stun source');
    assert.match(text(r), /Showing known terrain only/);
});
