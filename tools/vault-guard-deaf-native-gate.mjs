// Independent native witnesses. Negative controls change only in-memory facts.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {recordingIntegrityErrors, branchAssertionErrors} from './gen-sessions/assertions.mjs';

const bytes = fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/vault-guard-deaf-feedback.session.json', import.meta.url));
const native = JSON.parse(bytes);
const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-guard-deaf-feedback.json', import.meta.url)));
const requirements = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/coverage-requirements.json', import.meta.url)));
function fact(segment, step) {
    const frame = native.segments[segment].steps[step], grid = decodeScreen(frame.screen);
    return {message: grid[0].map(c => c.ch).join('').trimEnd(),
        status: grid[23].map(c => c.ch).join('').trimEnd(), cursor: frame.cursor,
        origin: grid[6][22], guard: grid[7][22], rng: frame.rng};
}
const deafThird = fact(1, 165), deafSeventh = fact(1, 172);
function assertSilentThird(w) {
    assert.equal(w.message, '');
    assert.match(w.status, / Deaf$/);
    assert.deepEqual(w.cursor, [22, 6, 1]);
    assert.equal(w.rng.length, 32);
}
function assertSilentSeventh(w) {
    assert.equal(w.message, 'You see here 365 gold pieces.');
    assert.match(w.status, / Deaf$/);
    assert.deepEqual(w.cursor, [23, 7, 1]);
    assert.deepEqual(w.origin, {ch: '$', color: 11, attr: 0, decgfx: 0});
    assert.deepEqual(w.guard, {ch: '@', color: 4, attr: 0, decgfx: 0});
    assert.equal(w.rng.length, 214);
    assert.deepEqual(w.rng.filter(s => s.includes('collect_coords')).slice(0, 7), [
        'rn2(8)=4 @ collect_coords(teleport.c:700)',
        'rn2(7)=3 @ collect_coords(teleport.c:700)',
        'rn2(6)=1 @ collect_coords(teleport.c:700)',
        'rn2(5)=4 @ collect_coords(teleport.c:700)',
        'rn2(4)=1 @ collect_coords(teleport.c:700)',
        'rn2(3)=2 @ collect_coords(teleport.c:700)',
        'rn2(2)=0 @ collect_coords(teleport.c:700)',
    ]);
}
test('native bytes, input tuples, integrity, counts and recipe groups remain exact', () => {
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
        '730005734d00f945e8f7c3005e2636ae2df4c3ef989330c23f73ac85024dfdf1');
    assert.equal(native.version, 5);
    assert.equal(native.source, 'c');
    assert.equal(native.segments.length, 3);
    for (const [index, segment] of native.segments.entries()) {
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(segment[field], recipe.segments[index][field], field);
        assert.equal(segment.steps.length, [171, 175, 173][index]);
        assert.equal(segment.steps.length, segment.moves.length + 1);
        assert.equal(segment.steps.reduce((n, s) => n + s.rng.length, 0), [6398, 6357, 6362][index]);
        assert.equal(segment.steps.reduce((n, s) => n + (s.animation_frames || []).length, 0), 0);
    }
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    const tags = new Set(requirements.requirements.map(r => r.id));
    assert.ok(recipe.coverage.every(tag => tags.has(tag)));
});
test('hearing native warnings retain their message and More boundary', () => {
    assert.equal(fact(0, 161).message, '"I repeat, drop that gold and follow me!"');
    const seventh = fact(0, 168);
    assert.equal(seventh.message, 'You see here 365 gold pieces.  "You\'ve been warned, knave!"--More--');
    assert.deepEqual(seventh.cursor, [67, 0, 1]);
    assert.equal(seventh.rng.length, 53);
    assert.equal(fact(0, 169).message, 'The guard hits!');
    assert.equal(fact(0, 169).rng.length, 129);
});
test('deaf native warnings are silent while relocation and its RNG still occur', () => {
    assert.equal(fact(1, 153).message, 'You are unable to hear anything.--More--');
    assertSilentThird(deafThird);
    assertSilentSeventh(deafSeventh);
});
test('native recovery precedes restored warning-three and warning-seven speech', () => {
    assert.match(fact(2, 151).status, / Deaf$/);
    assert.equal(fact(2, 159).message, 'You can hear again.');
    assert.doesNotMatch(fact(2, 159).status, / Deaf/);
    assert.equal(fact(2, 163).message, '"I repeat, drop that gold and follow me!"');
    assert.equal(fact(2, 170).message, 'You see here 365 gold pieces.  "You\'ve been warned, knave!"');
    assert.doesNotMatch(fact(2, 170).status, / Deaf/);
});
test('negative control rejects an audible warning-three message while deaf', () => {
    assert.throws(() => assertSilentThird({...deafThird,
        message: '"I repeat, drop that gold and follow me!"'}));
});
test('negative control rejects an audible warning-seven message while deaf', () => {
    assert.throws(() => assertSilentSeventh({...deafSeventh,
        message: 'You see here 365 gold pieces.  "You\'ve been warned, knave!"'}));
});
test('negative control rejects a missing relocation call', () => {
    const rng = [...deafSeventh.rng];
    rng.splice(rng.findIndex(s => s.includes('collect_coords')), 1);
    assert.throws(() => assertSilentSeventh({...deafSeventh, rng}));
});
test('negative control rejects silence achieved by skipping guard relocation', () => {
    assert.throws(() => assertSilentSeventh({...deafSeventh, guard: deafSeventh.origin}));
});
