// Immutable C provenance and ordinary branch evidence, independent of JS state.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodeScreen } from '../frozen/screen-decode.mjs';
const bytes = readFileSync(new URL('gen-sessions/generated/monster-growth-callback.session.json', import.meta.url));
const native = JSON.parse(bytes);
const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/monster-growth-callback.json', import.meta.url)));
const fields = ['name', 'seed', 'datetime', 'nethackrc', 'moves'];
const key = value => value === '\\r' ? '\r'
    : /^\\x[0-9a-f]{2}$/i.test(value) ? String.fromCharCode(parseInt(value.slice(2), 16)) : value;
test('unchanged C raw retains all five inputs and every key', () => {
    assert.equal(bytes.length, 350920);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),
        '9d7885fabf56c6a4ce8f71d28687cac13c89b0245aa3bce9bd58b5ad6a231243');
    assert.equal(native.source, 'c'); assert.equal(native.version, 5);
    assert.equal(native.segments.length, 2);
    for (const [index, segment] of native.segments.entries()) {
        for (const field of fields) {
            assert.ok(Object.hasOwn(segment, field));
            assert.equal(segment[field], recipe.segments[index][field]);
        }
        assert.equal(segment.steps.length, segment.moves.length + 1);
        assert.equal(segment.steps[0].key, null);
        assert.equal(segment.steps.slice(1).map(step => key(step.key)).join(''), segment.moves);
    }
});
for (const [index, segment] of native.segments.entries()) {
    test(`${segment.name}: pinned C reaches the meal and correct growth result`, () => {
        const text = segment.steps.map(step => decodeScreen(step.screen)
            .map(row => row.map(cell => cell.ch).join('')).join('\n')).join('\n');
        for (const value of recipe.branchAssertions[index].screenIncludes) assert.ok(text.includes(value), value);
        for (const value of recipe.branchAssertions[index].screenExcludes) assert.ok(!text.includes(value), value);
        assert.equal(segment.steps.length, index === 0 ? 113 : 108);
        const calls = segment.steps.flatMap(step => step.rng || [])
            .filter(call => /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(call));
        assert.equal(calls.length, 2994);
        assert.equal(segment.steps.reduce((n, step) => n + (step.animation_frames || []).length, 0), 0);
    });
}
