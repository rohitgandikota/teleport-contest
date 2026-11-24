// Independent native witnesses. Negative controls mutate only in-memory facts.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const bytes = fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/vault-interrogation-feedback.session.json', import.meta.url));
const native = JSON.parse(bytes);
const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-interrogation-feedback.json', import.meta.url)));
const requirements = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/coverage-requirements.json', import.meta.url)));
const boundaries = [93, 116, 123, 146, 120, 120, 124, 115, 119];
const calls = [5908, 5863, 5936, 5871, 5814, 5863, 5814, 5870, 5870];
const prompts = [79, 102, 109, 132, 106, 106, 110, 102, 106];
const results = [90, 112, 120, 143, 116, 115, 119, 110, 114];
const messages = [
    '"Please drop that gold and follow me."',
    'The guard holds out his palm and beckons with his other hand.',
    '"Please drop that gold and follow me."',
    'The guard holds out his palm and beckons with his other hand.',
    'The guard stomps and beckons.',
    "The guard doesn't recognize you.",
    "The guard doesn't recognize you.  The guard stomps.",
    'The guard waves goodbye.',
    '',
];
const endingRolls = [35, 16, 47, 10, 46, 16, 46, 18, 18];
const inventoryChecks = [57, 56, 0, 42, 50, 10, 71]
    .map(n => `rn2(100)=${n} @ obj_resists(zap.c:1469)`);

function fact(segment, step) {
    const frame = native.segments[segment].steps[step];
    const grid = decodeScreen(frame.screen);
    return {message: grid[0].map(c => c.ch).join('').trimEnd(),
        status: grid[23].map(c => c.ch).join('').trimEnd(),
        cursor: frame.cursor, entry: grid[6][24], rng: frame.rng};
}
function assertPrompt(index, witness) {
    const hearing = index === 0 || index === 2;
    const blind = index === 5 || index === 6 || index === 8;
    assert.equal(witness.message, hearing ? '"Hello stranger, who are you?" -'
        : 'You are required to supply your name. -');
    assert.deepEqual(witness.cursor, [hearing ? 33 : 40, 0, 1]);
    assert.equal(witness.status.includes(' Deaf'), !hearing);
    assert.equal(witness.status.includes(' Blind'), blind);
    assert.deepEqual(witness.entry, blind
        ? {ch: 'I', color: 8, attr: 0, decgfx: 0}
        : {ch: '@', color: 4, attr: 0, decgfx: 0});
    assert.deepEqual(witness.rng, []);
}
function assertResult(index, witness) {
    assert.equal(witness.message, messages[index]);
    assert.deepEqual(witness.cursor, [22, 6, 1]);
    const end = `rn2(67)=${endingRolls[index]} @ moveloop_core(allmain.c:360)`;
    assert.deepEqual(witness.rng, index >= 7 ? [...inventoryChecks, end] : [end]);
    if (index === 7)
        assert.deepEqual(witness.entry, {ch: 'x', color: 8, attr: 0, decgfx: 1});
    if (index === 5 || index === 6 || index === 8)
        assert.deepEqual(witness.entry, {ch: 'I', color: 8, attr: 0, decgfx: 0});
}

test('native bytes, five input fields, schema, counts and nine recipe groups', () => {
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
        '4f8fe4a7f7346db9cc8cd6d8bdca102a9e7be788b5fa992e9cbc955b94efbedf');
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(native.segments.length, 9);
    assert.equal(recipe.branchAssertions.length, 9);
    for (const [index, part] of native.segments.entries()) {
        for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(part[key], recipe.segments[index][key], key);
        assert.equal(part.steps.length, boundaries[index]);
        assert.equal(part.steps.length, part.moves.length + 1);
        assert.equal(part.steps.reduce((n, s) => n + s.rng.length, 0), calls[index]);
        assert.equal(part.steps.reduce((n, s) => n + (s.animation_frames || []).length, 0), 0);
    }
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    const tags = new Set(requirements.requirements.map(r => r.id));
    assert.ok(recipe.coverage.every(tag => tags.has(tag)));
});
for (const [index, part] of native.segments.entries()) {
    test(`${part.name}: native prompt, result, cursor and following-call order`, () => {
        assertPrompt(index, fact(index, prompts[index]));
        assertResult(index, fact(index, results[index]));
        if (index === 1 || index === 3 || index === 4) {
            const recognition = fact(index, prompts[index] + 9);
            assert.equal(recognition.message, "The guard doesn't appear to recognize you.--More--");
            assert.deepEqual(recognition.cursor, [50, 0, 1]);
            assert.deepEqual(recognition.rng, []);
        }
        if (index === 2) {
            const hidden = fact(index, 118);
            assert.equal(hidden.message, '"I don\'t know you."  "You have hidden gold."--More--');
            assert.deepEqual(hidden.cursor, [52, 0, 1]);
            assert.deepEqual(hidden.rng, []);
        }
        if (index === 3) {
            const glare = fact(index, 142);
            assert.equal(glare.message, 'The guard glares at your stuff.--More--');
            assert.deepEqual(glare.cursor, [39, 0, 1]);
            assert.deepEqual(glare.rng, []);
        }
    });
}
test('negative: hearing prompt cannot stand in for deaf interrogation', () => {
    const changed = structuredClone(fact(1, prompts[1]));
    changed.message = '"Hello stranger, who are you?" -';
    assert.throws(() => assertPrompt(1, changed), assert.AssertionError);
});
test('negative: unseen arrival requires the native invisible marker', () => {
    const changed = structuredClone(fact(5, prompts[5]));
    changed.entry = {ch: 'x', color: 8, attr: 0, decgfx: 1};
    assert.throws(() => assertPrompt(5, changed), assert.AssertionError);
});
test('negative: blind goodbye gesture and hearing cursor are rejected', () => {
    const gesture = structuredClone(fact(8, results[8]));
    gesture.message = 'The guard waves goodbye.';
    assert.throws(() => assertResult(8, gesture), assert.AssertionError);
    const cursor = structuredClone(fact(1, prompts[1]));
    cursor.cursor = [33, 0, 1];
    assert.throws(() => assertPrompt(1, cursor), assert.AssertionError);
});
test('negative: silent dismissal still requires the complete cleanup call packet', () => {
    const changed = structuredClone(fact(8, results[8]));
    changed.rng.splice(2, 1);
    assert.throws(() => assertResult(8, changed), assert.AssertionError);
});
