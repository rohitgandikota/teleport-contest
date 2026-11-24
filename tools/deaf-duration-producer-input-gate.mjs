// Actual commands and producer-state assertions. This is not a native scorer.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {TIMEOUT} from '../js/const.js';
import {ONAMES} from '../js/objects_data.js';
import {observeDuration} from './deaf-duration-observer.mjs';

const file = process.argv[2] || new URL(
    'gen-sessions/generated/deaf-duration-producers.session.json', import.meta.url);
const input = JSON.parse(fs.readFileSync(file));
assert.equal(input.segments.length, 4);
const rows = [];
for (const [index, part] of input.segments.entries()) {
    const {run, evidence} = await observeDuration(part);
    rows.push({...evidence, index,
        cappedMenu:run.getScreens().some(s => s.includes(`[${TIMEOUT}]`)),
        recoveredCapMenu:run.getScreens().some(s => s.includes(`[${TIMEOUT - 3}]`)),
        ordinaryMenu:run.getScreens().some(s => s.includes('[30]'))});
    console.log(JSON.stringify({index, boundaries:evidence.boundaries, calls:evidence.calls,
        animations:evidence.animations, finalHDeaf:evidence.states.at(-1).hdeaf,
        hooksRestored:evidence.hooksRestored}));
}
if (process.env.DEAF_DURATION_EVIDENCE)
    fs.writeFileSync(process.env.DEAF_DURATION_EVIDENCE, JSON.stringify(rows, null, 2) + '\n');

test('valid C int addition crosses INT_MAX as a long and remains capped/deaf', () => {
    const r = rows[0];
    assert.ok(r.states.some(s => s.hdeaf === 1 && s.deaf));
    assert.equal(r.states.at(-1).hdeaf, TIMEOUT);
    assert.equal(r.states.at(-1).sourceBits, 0);
    assert.equal(r.states.at(-1).deaf, true);
    assert.equal(r.cappedMenu, true);
    assert.doesNotMatch(r.messages.map(m => m.text).join('\n'), /can hear again/);
});
test('INT_MAX from zero is the unchanged clamping control', () => {
    const r = rows[1];
    assert.equal(r.states.at(-1).hdeaf, TIMEOUT);
    assert.equal(r.states.at(-1).sourceBits, 0);
    assert.equal(r.cappedMenu, true);
    assert.equal(r.states.some(s => s.hdeaf === 1), false);
});
for (const index of [2, 3]) {
    test(`actual cursed-apple fainting preserves ${index === 2 ? 'capped' : 'ordinary'} deafness after recovery`, () => {
        const r = rows[index];
        const before = r.states.find(s => s.inventory.some(o => o.type === ONAMES.APPLE && o.cursed)
            && s.hdeaf === (index === 2 ? TIMEOUT : 30));
        assert.ok(before, 'the real wishes and wizard timeout reached the producer prerequisites');
        const text = r.messages.map(m => m.text).join('\n');
        assert.match(text, /Blecch!  Rotten food!/);
        assert.match(text, /The world spins and goes dark\./);
        assert.match(text, /You are conscious again\./);
        assert.equal(r.states.at(-1).hdeaf, index === 2 ? TIMEOUT - 3 : 30);
        assert.ok(r.states.every(s => s.sourceBits === 0), 'timed deafness never becomes intrinsic');
        assert.equal(r.states.at(-1).deaf, true);
        assert.equal(r.states.at(-1).mortality, 0);
        assert.equal(index === 2 ? r.recoveredCapMenu : r.ordinaryMenu, true);
    });
}
