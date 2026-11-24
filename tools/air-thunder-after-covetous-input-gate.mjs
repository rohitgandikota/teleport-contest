// Native-confirmed ordinary input. Observe through existing hooks without changing game state.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CLOUD, TIMEOUT} from '../js/const.js';
import {observeDuration} from './deaf-duration-observer.mjs';

const input = JSON.parse(fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/air-thunder-after-covetous.session.json', import.meta.url)));
const prefix = JSON.parse(fs.readFileSync(process.argv[3] || new URL(
    'gen-sessions/generated/covetous-goal-attack.session.json', import.meta.url))).segments[0];
assert.equal(input.source, 'c');
assert.equal(input.version, 5);
assert.equal(input.segments.length, 1);
const part = input.segments[0];
const {run, evidence} = await observeDuration(part);
const clean = call => call.replace(/\s*@.*$/, '').replace(/^\d+\s+/, '').trim();
const nativeStep = text => part.steps.findIndex(s => s.screen.includes(text));
const jsStep = text => run.getScreens().findIndex(s => s.includes(text));
const words = ['Kaboom!!!  Boom!!  Boom!!', 'You die...', "OK, so you don't die."];
const nativeOrder = words.map(nativeStep), jsOrder = words.map(jsStep);
const thunder = evidence.states.find(s => s.step === nativeOrder[0]);
const before = evidence.states.findLast(s => s.step < nativeOrder[0]);
const last = evidence.states.at(-1);
console.log(JSON.stringify({boundaries:evidence.boundaries, calls:evidence.calls,
    animations:evidence.animations, nativeOrder, jsOrder, before, thunder, final:last,
    hooksRestored:evidence.hooksRestored}));

test('the complete old native prefix keeps its original input and RNG slices', () => {
    for (const key of ['seed', 'datetime', 'nethackrc']) assert.equal(part[key], prefix[key]);
    assert.ok(part.moves.startsWith(prefix.moves));
    assert.deepEqual(part.steps.slice(0, prefix.steps.length), prefix.steps);
    assert.deepEqual(run.getRngSlices().slice(0, prefix.steps.length).map(s => s.map(clean)),
        prefix.steps.map(s => s.rng.map(clean)));
});
test('C thunder precedes the actual declined death and JS preserves that order', () => {
    assert.deepEqual(nativeOrder, [959, 960, 962]);
    assert.deepEqual(jsOrder, nativeOrder);
    assert.ok(part.steps[957].rng.includes('rn2(8)=0 @ do_storms(timeout.c:1855)'));
    assert.ok(part.steps[959].rng.includes('rn2(20)=0 @ do_storms(timeout.c:1882)'));
    assert.equal(part.steps.flatMap(s => s.rng)
        .filter(c => /do_storms\(timeout\.c:1882\)/.test(c)).length, 1);
});
test('ordinary input has the hero in cloud with an almost-capped raw timeout', () => {
    assert.equal(before.step, 958);
    assert.equal(before.stormy, true);
    assert.equal(before.terrain, CLOUD);
    assert.equal(before.hdeaf, TIMEOUT - 1);
    assert.equal(before.sourceBits, 0);
});
test('the real thirty-turn increment saturates without creating source bits', () => {
    assert.ok(run.getRngSlices()[thunder.step]
        .some(call => /^rn2\(20\)=0 @js\/timeout\.js:/.test(call)));
    assert.equal(thunder.hdeaf, TIMEOUT);
    assert.equal(thunder.sourceBits, 0);
    assert.equal(thunder.reason, 'hiding from thunderstorm');
    assert.equal(thunder.multi, -2);
});
test('the post-thunder native timer menu survives the declined death unchanged', () => {
    assert.ok(part.steps[984].screen.includes(`[${TIMEOUT - 1}]`));
    assert.ok(run.getScreens()[984].includes(`[${TIMEOUT - 1}]`));
    assert.equal(last.hdeaf, TIMEOUT - 1);
    assert.equal(last.sourceBits, 0);
    assert.equal(last.mortality, 1);
    assert.ok(last.hp > 0);
    assert.equal(last.multi, 0);
});
test('complete boundary, call and animation totals match and observer hooks are restored', () => {
    assert.equal(evidence.boundaries, 989);
    assert.equal(evidence.boundaries, part.steps.length);
    assert.equal(evidence.calls, 23646);
    assert.equal(evidence.calls, part.steps.reduce((n, s) => n + s.rng.length, 0));
    assert.equal(evidence.animations, 1);
    assert.equal(evidence.animations, part.steps.reduce((n, s) => n + (s.animation_frames || []).length, 0));
    assert.equal(evidence.hooksRestored, true);
});
