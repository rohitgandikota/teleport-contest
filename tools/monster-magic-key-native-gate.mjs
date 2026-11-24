// Immutable native oracle, anchored C branch witnesses, and in-memory negatives.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const path = process.argv[2] || new URL(
    'gen-sessions/generated/monster-magic-key-doors.session.json', import.meta.url);
const bytes = fs.readFileSync(path);
const native = JSON.parse(bytes);
const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/monster-magic-key-doors.json', import.meta.url)));
const message = step => decodeScreen(step.screen)[0].map(cell => cell.ch).join('').trimEnd();
const trapCall = 'rnd(15)=13 @ mb_trapped(monmove.c:65)';

function blessedBranch(session) {
    const step = session.segments[0].steps[112];
    assert.equal(message(step), 'The Master Assassin unlocks and opens a door.');
    assert.deepEqual(step.cursor, [50, 7, 1]);
    assert.equal(step.rng.length, 17);
    assert.equal(step.rng.some(call => /rnd\(15\)|mb_trapped/.test(call)), false);
}

function uncursedBranch(session) {
    const step = session.segments[1].steps[113];
    assert.equal(message(step), 'KABOOM!!  You see a door explode.');
    assert.deepEqual(step.cursor, [50, 7, 1]);
    assert.equal(step.rng.length, 18);
    assert.equal(step.rng[0], 'rn2(5)=0 @ distfleeck(monmove.c:538)');
    assert.equal(step.rng[1], trapCall);
    assert.equal(step.rng.filter(call => call.includes('mb_trapped')).length, 1);
}

test('native bytes, input tuples, integrity and paired recipe assertions are intact', () => {
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
        'e0c3f1eeda6467ac605c87c1ce36897af2512b9409f6c2791cffec3b041dda4c');
    assert.equal(native.version, 5);
    assert.equal(native.source, 'c');
    assert.equal(native.segments.length, 2);
    for (const [index, segment] of native.segments.entries()) {
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(segment[field], recipe.segments[index][field], field);
        assert.equal(segment.steps.length, [115, 116][index]);
        assert.equal(segment.steps.reduce((n, step) => n + step.rng.length, 0), [3008, 3009][index]);
        assert.equal(segment.steps.reduce((n, step) => n + (step.animation_frames || []).length, 0), 0);
    }
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
});

test('blessed native carrier opens the door without the trap call', () => blessedBranch(native));
test('uncursed native carrier explodes the door and calls the C trap owner', () => uncursedBranch(native));

test('negative control rejects explosion feedback substituted for disarming', () => {
    const altered = structuredClone(native);
    altered.segments[0].steps[112].screen = native.segments[1].steps[113].screen;
    assert.throws(() => blessedBranch(altered));
    assert.ok(branchAssertionErrors(recipe, altered).length);
});
test('negative control rejects an extra trap draw in the blessed slice', () => {
    const altered = structuredClone(native);
    altered.segments[0].steps[112].rng.splice(1, 0, trapCall);
    assert.throws(() => blessedBranch(altered));
});
test('negative control rejects the missing trap draw in the uncursed slice', () => {
    const altered = structuredClone(native);
    altered.segments[1].steps[113].rng.splice(1, 1);
    assert.throws(() => uncursedBranch(altered));
});
