// Preserve the C recording and compare every output, including blank-cell style.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { decodeScreen, renderCell } from '../frozen/screen-decode.mjs';
import { recordingIntegrityErrors, branchAssertionErrors } from './gen-sessions/assertions.mjs';

const raw = readFileSync(new URL('gen-sessions/generated/polymorph-explosion-golem-feedback.session.json', import.meta.url));
const native = JSON.parse(raw);
const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/polymorph-explosion-golem-feedback.json', import.meta.url)));
const storage = new InMemoryStorage();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const styles = screen => decodeScreen(screen).map(row =>
    row.map(cell => [renderCell(cell), cell.color, cell.attr]));

function calls(entries) {
    return entries.map(entry => {
        const match = entry.match(/^((?:rn2|rnd|rn1|rnl|rne|rnz|d)\([^)]*\)=-?\d+)(?: @ .*)?$/);
        assert.ok(match, `unrecognized random call: ${entry}`);
        return match[1];
    });
}

test('native bytes, input fields, keys and branch witnesses are preserved', () => {
    assert.equal(createHash('sha256').update(raw).digest('hex'),
        'c22db4070ab91e7f103639e9d1b1469f1fc309735a502d58e365ac58d49b1de6');
    assert.equal(raw.length, 515154);
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(native.segments.length, 3);
    assert.equal(recipe.segments.length, 3);
    assert.deepEqual(recordingIntegrityErrors(native), []);
    const registry = JSON.parse(readFileSync(new URL('gen-sessions/branch-requirements.json', import.meta.url)));
    const coverage = JSON.parse(readFileSync(new URL('gen-sessions/coverage-requirements.json', import.meta.url)));
    assert.ok(recipe.branches.every(id => registry.requirements.some(row => row.id === id)));
    assert.ok(recipe.coverage.every(id => coverage.requirements.some(row => row.id === id)));
    assert.deepEqual(branchAssertionErrors(recipe), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    for (const [index, part] of native.segments.entries()) {
        for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
            assert.equal(Object.hasOwn(part, key), Object.hasOwn(recipe.segments[index], key));
            assert.deepEqual(part[key], recipe.segments[index][key]);
        }
        assert.deepEqual(part.steps.map(step => step.key), [null, ...part.moves]);
    }
});

for (const part of native.segments) test(`complete native output: ${part.name}`, async t => {
    const run = await runSegment({ ...part, storage });
    const screens = run.getScreens(), cursors = run.getCursors();
    const slices = run.getRngSlices(), frames = run.getAnimationFramesByStep();
    for (const collection of [screens, cursors, slices, frames])
        assert.equal(collection.length, part.steps.length);
    const differences = [];
    let literalScreens = 0, literalFrames = 0, frameCount = 0;
    for (const [step, expected] of part.steps.entries()) {
        literalScreens += +(expected.screen === screens[step]);
        if (!same(styles(expected.screen), styles(screens[step])))
            differences.push({ step, kind: 'styled-grid' });
        if (!same(expected.cursor, cursors[step]))
            differences.push({ step, kind: 'cursor' });
        if (!same(calls(expected.rng || []), calls(slices[step])))
            differences.push({ step, kind: 'random-call-slice' });
        const expectedFrames = expected.animation_frames || [];
        if (expectedFrames.length !== frames[step].length)
            differences.push({ step, kind: 'frame-count' });
        for (const [index, expectedFrame] of expectedFrames.entries()) {
            const actual = frames[step][index];
            frameCount++;
            literalFrames += +(actual?.screen === expectedFrame.screen);
            if (!actual || !same(styles(expectedFrame.screen), styles(actual.screen))) {
                differences.push({ step, index, kind: 'styled-frame' });
                continue;
            }
            assert.deepEqual(Object.keys(actual).sort(), Object.keys(expectedFrame).sort());
            for (const field of Object.keys(expectedFrame))
                if (field !== 'screen')
                    assert.deepEqual(actual[field], expectedFrame[field], `frame ${step}/${index}/${field}`);
        }
    }
    assert.deepEqual(calls(run.getRngLog()), calls(part.steps.flatMap(step => step.rng || [])));
    assert.deepEqual(differences, []);
    t.diagnostic(JSON.stringify({ literalScreens, screens: screens.length, literalFrames, frameCount }));
});
