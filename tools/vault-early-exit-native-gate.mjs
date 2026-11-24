// Pinned C witnesses, independent of the JS replay and state observers.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const bytes = fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/vault-early-exit-boundaries.session.json', import.meta.url));
const native = JSON.parse(bytes);
const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-early-exit-boundaries.json', import.meta.url)));
const requirements = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/coverage-requirements.json', import.meta.url)));
const boundaries = [164, 187, 131, 154, 127, 150, 120, 143, 132, 155, 86, 109, 99];
const calls = [6235, 6193, 6725, 6581, 6634, 6481, 6022, 6035, 6018, 5861, 6335, 6061, 6464];
const departures = [139, 156, 123, 145, 118, 141, 111, 134, 116, 139, 78, 101, 90];
const cleanupRolls = [
    [48, 5, 39, 17, 70], [27, 54, 68, 58], [39, 93, 63, 8, 87, 24, 67],
    [50, 84, 85, 67, 67, 30], [5, 39, 38, 98, 97, 41], [44, 6, 98, 52, 10, 35],
    [71, 21, 98, 90, 20, 20], [48, 5, 39, 17, 70, 47], [1, 6, 57, 75, 25],
    [52, 45, 84, 23, 26, 82], [68, 84, 6, 85, 34, 58], [34, 52, 37, 18, 51, 52],
    [75, 14, 12, 55, 12],
];
const turnRolls = [26, 61, 2, 26, 56, 7, 53, 40, 9, 39, 57, 16, 27];
const farewell = '"I\'ll be back when you\'re ready to speak to me!"';
const huff = 'The guard huffs and turns to leave.';
const puzzled = 'Puzzled, it turns around and leaves.';
const messages = [
    '"What\'s going on here?"  The other presence vanishes.',
    'Someone else has entered the Vault.  The other presence vanishes.',
    puzzled, puzzled, puzzled, puzzled, farewell, huff, farewell, huff,
    farewell + '  You can move again.', huff + '  You can move again.',
    'Puzzled, he turns around and leaves.--More--',
];

function fact(segment, step) {
    const value = native.segments[segment].steps[step], grid = decodeScreen(value.screen);
    return {message: grid[0].map(c => c.ch).join('').trimEnd(),
        status: grid[23].map(c => c.ch).join('').trimEnd(),
        cursor: value.cursor, hero: grid[6][22], entry: grid[6][24], rng: value.rng,
        frames: (value.animation_frames || []).map(frame => ({
            message: decodeScreen(frame.screen)[0].map(c => c.ch).join('').trimEnd(),
            cursor: frame.cursor}))};
}
function assertDeparture(index, witness) {
    assert.equal(witness.message, messages[index]);
    assert.deepEqual(witness.cursor, index === 12 ? [44, 0, 1] : [22, 6, 1]);
    assert.equal(witness.status.includes(' Deaf'), index % 2 === 1);
    assert.equal(witness.status.includes(' Blind'), index >= 2 && index <= 7);
    assert.equal(witness.status.includes(' Strngl'), index === 8 || index === 9);
    assert.deepEqual(witness.entry, index < 8
        ? {ch: 'I', color: 8, attr: 0, decgfx: 0}
        : {ch: 'x', color: 8, attr: 0, decgfx: 1});
    const cleanup = cleanupRolls[index].map(n => `rn2(100)=${n} @ obj_resists(zap.c:1469)`);
    const firstTurn = `rn2(67)=${turnRolls[index]} @ moveloop_core(allmain.c:360)`;
    // mongone's inventory disposal finishes before the caller resumes its turn.
    assert.deepEqual(witness.rng.slice(0, cleanup.length + 1), [...cleanup, firstTurn]);
    if (index < 10) assert.equal(witness.rng.length, cleanup.length + 1);
    if (index >= 10) {
        assert.deepEqual(witness.frames, [{
            message: index === 10 ? farewell : index === 11 ? huff : 'Puzzled, he turns around and leaves.',
            cursor: [22, 6, 1],
        }]);
    }
    if (index === 12)
        assert.deepEqual(witness.hero, {ch: '$', color: 11, attr: 0, decgfx: 0});
}

test('native bytes, schema, all five input fields, every key and 13 recipe groups', () => {
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
        'f5cc4528fe564e7634adb01706339c0ace03875e19e9b7765b4d22d3d43cac9b');
    assert.equal(native.version, 5);
    assert.equal(native.source, 'c');
    assert.equal(native.segments.length, 13);
    assert.equal(recipe.branchAssertions.length, 13);
    for (const [index, part] of native.segments.entries()) {
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(part[field], recipe.segments[index][field], field);
        assert.deepEqual(part.steps.map(s => s.key), [null, ...part.moves]);
        assert.equal(part.steps.length, boundaries[index]);
        assert.equal(part.steps.length, part.moves.length + 1);
        assert.equal(part.steps.reduce((n, s) => n + s.rng.length, 0), calls[index]);
        assert.equal(part.steps.reduce((n, s) => n + (s.animation_frames || []).length, 0),
            index === 12 ? 3 : index >= 10 ? 5 : 0);
        assert.ok(part.steps.every(s => s.rng.every(call => !call.includes('@ Hear_again('))),
            'these inputs do not claim hunger-faint recovery');
    }
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    const tags = new Set(requirements.requirements.map(r => r.id));
    assert.ok(recipe.coverage.every(tag => tags.has(tag)));
});
for (const [index, part] of native.segments.entries()) {
    test(`${part.name}: native departure, status, map, cursor and cleanup order`, () => {
        assertDeparture(index, fact(index, departures[index]));
        if (index === 2) {
            const remark = fact(index, 122);
            assert.equal(remark.message, '"Hey!  Who left that whatcha-may-callit in here?"--More--');
            assert.deepEqual(remark.cursor, [57, 0, 1]);
            assert.deepEqual(remark.rng, []);
        }
        if (index === 8 || index === 9) {
            const removed = fact(index, index === 8 ? 121 : 144);
            assert.equal(removed.message, 'You can breathe more easily!');
            assert.equal(removed.status.includes(' Strngl'), false);
        }
        if (index === 12) {
            const recovered = fact(index, 91);
            assert.equal(recovered.message, 'You now prefer mimicking a human again.');
            assert.deepEqual(recovered.hero, {ch: '@', color: 15, attr: 0, decgfx: 0});
            assert.deepEqual(recovered.rng, []);
        }
    });
}
test('negative: deaf dismissal cannot use the hearing speech', () => {
    const changed = structuredClone(fact(7, departures[7]));
    changed.message = farewell;
    assert.throws(() => assertDeparture(7, changed), assert.AssertionError);
});
test('negative: unseen dismissal must retain the actual native invisible marker', () => {
    const changed = structuredClone(fact(0, departures[0]));
    changed.entry = {ch: 'x', color: 8, attr: 0, decgfx: 1};
    assert.throws(() => assertDeparture(0, changed), assert.AssertionError);
});
test('negative: a missing cleanup call cannot be replaced by a turn call', () => {
    const changed = structuredClone(fact(1, departures[1]));
    changed.rng.splice(1, 1);
    assert.throws(() => assertDeparture(1, changed), assert.AssertionError);
});
test('negative: gold disguise takes the object branch before immobilization', () => {
    const changed = structuredClone(fact(12, departures[12]));
    changed.message = farewell;
    assert.throws(() => assertDeparture(12, changed), assert.AssertionError);
});
test('negative: paralysis recovery cannot precede the departure animation', () => {
    const changed = structuredClone(fact(10, departures[10]));
    changed.frames[0].message = 'You can move again.';
    assert.throws(() => assertDeparture(10, changed), assert.AssertionError);
});
test('negative: name-prompt cursor cannot stand in for a completed return', () => {
    const changed = structuredClone(fact(8, departures[8]));
    changed.cursor = [33, 0, 1];
    assert.throws(() => assertDeparture(8, changed), assert.AssertionError);
});
