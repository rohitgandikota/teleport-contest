// Immutable native input and branch witnesses only. Full JS parity is separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const path = process.argv[2] || fileURLToPath(new URL(
    'gen-sessions/generated/strangulation-form-transitions.session.json', import.meta.url));
const recipePath = process.argv[3] || fileURLToPath(new URL(
    'gen-sessions/recipes/strangulation-form-transitions.json', import.meta.url));
const bytes = fs.readFileSync(path);
const raw = JSON.parse(bytes);
const recipe = JSON.parse(fs.readFileSync(recipePath));
const checks = [];
function check(name, action) {
    action();
    checks.push(name);
}

check('original native bytes, source and version', () => {
    assert.equal(createHash('sha256').update(bytes).digest('hex'),
        '9fc813652b7f473ee32777911478c5357bacb21d4e41590388125960442163f5');
    assert.equal(raw.source, 'c');
    assert.equal(raw.version, 5);
});
check('all six original input tuples, presence, keys and recording integrity', () => {
    assert.equal(raw.segments.length, 6);
    assert.equal(recipe.segments.length, 6);
    for (const [index, part] of recipe.segments.entries()) {
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
            assert.equal(Object.hasOwn(raw.segments[index], field), Object.hasOwn(part, field));
            assert.deepEqual(raw.segments[index][field], part[field]);
        }
        assert.deepEqual(raw.segments[index].steps.map(step => step.key), [null, ...part.moves]);
    }
    assert.deepEqual(recordingIntegrityErrors(raw), []);
});
check('every original transition recipe assertion remains true', () => {
    assert.deepEqual(branchAssertionErrors(recipe, raw), []);
});
const steps = raw.segments[3].steps;
const screen = step => decodeScreen(steps[step].screen).join('\n');
check('actual breath rejection precedes the attributes command', () => {
    assert.ok(screen(86).includes("You can't breathe.  Sorry."));
    assert.equal(steps[95].key, '\x18');
});
check('native status page discloses the actual thirty-turn countdown', () => {
    assert.ok(screen(96).includes('You are being strangled (30).'));
    assert.deepEqual(steps[96].cursor, [9, 23, 1]);
    assert.ok(screen(97).includes('(3 of 3)'));
    assert.deepEqual(steps[97].cursor, [9, 5, 1]);
});
check('menu completion preserves status and needs no new random calls', () => {
    assert.ok(screen(98).includes('Strngl'));
    for (let step = 95; step <= 98; step++)
        assert.deepEqual(steps[step].rng, []);
});
console.log(JSON.stringify({ evidence: 'immutable C input and visible branch witnesses',
    checks, runtimeReplayPerformed: false }, null, 4));
