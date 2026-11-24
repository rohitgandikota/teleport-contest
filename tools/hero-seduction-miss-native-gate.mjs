// Immutable C inputs and complete rendered glyph/style, cursor, RNG and frames.
// Keep every blank-cell attribute. Only source-location RNG annotations differ.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {recordingIntegrityErrors, branchAssertionErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type: 'json'};

const raw = readFileSync(new URL('gen-sessions/generated/hero-polymorph-seduction-miss.session.json', import.meta.url));
const native = JSON.parse(raw);
const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/hero-polymorph-seduction-miss.json', import.meta.url)));
const counts = [[65,2674,0],[67,2674,0],[76,2674,16],[62,2828,0],[60,2266,0],[71,2271,16]];
const witnesses = [
    [[57,'You pretend to be friendly to the ogre.--More--'],[58,'You pretend to be friendly to the ogre.']],
    [[59,'You pretend to be friendly to the ogre.--More--'],[60,'You pretend to be friendly to the ogre.']],
    [[68,'You pretend to be friendly to it.  You pretend to be friendly to it.']],
    [[54,'You miss the ogre.'],[54,'The ogre wakes up!'],[55,'You hit the ogre.']],
    [[52,'You miss the ogre.'],[52,'The ogre wields a club!']],
    [[63,'You miss it.'],[63,'You return to human form!']],
];
const top = screen => decodeScreen(screen).slice(0,2).map(row=>row.map(renderCell).join('')).join('\n');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function calls(entries) {
    assert.ok(Array.isArray(entries));
    return entries.map(entry => {
        assert.equal(typeof entry, 'string');
        const match = entry.match(/^((?:rn2|rnd|rn1|rnl|rne|rnz|d)\([^)]*\)=-?\d+)(?: @ .*)?$/);
        assert.ok(match, 'every RNG entry must be retained and recognized');
        return match[1];
    });
}

function styles(screen) {
    return decodeScreen(screen).map(row => row.map(cell => [renderCell(cell), cell.color, cell.attr]));
}

test('native raw bytes, all five input fields and presence, every boundary key', () => {
    assert.equal(createHash('sha256').update(raw).digest('hex'),
        '3745b372d86077310ab7c22239a5c11a648d39dcad5e2eb17e145976122938e4');
    assert.equal(raw.length, 821132);
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(native.segments.length, 6);
    assert.equal(recipe.segments.length, 6);
    assert.deepEqual(recordingIntegrityErrors(native), []);
    for (const [index, part] of native.segments.entries()) {
        for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
            assert.equal(Object.hasOwn(part, key), true);
            assert.equal(Object.hasOwn(recipe.segments[index], key), true);
            assert.deepEqual(part[key], recipe.segments[index][key]);
        }
        assert.deepEqual(part.steps.map(step => step.key), [null, ...part.moves]);
        assert.equal(part.steps.length, counts[index][0]);
        assert.equal(calls(part.steps.flatMap(step => step.rng || [])).length, counts[index][1]);
        assert.equal(part.steps.reduce((n, step) => n + (step.animation_frames || []).length, 0), counts[index][2]);
    }
});

test('registered categories and unchanged source assertions hold in native C', () => {
    const known = new Set(tags.requirements.map(row => row.id));
    for (const category of recipe.coverage)
        assert.ok(known.has(category), category);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
});

for (const [index, part] of native.segments.entries()) test(`full rendered native parity: ${part.name}`, async t => {
    for (const [step, message] of witnesses[index])
        assert.ok(top(part.steps[step].screen).includes(message), `native witness ${index}:${step} ${message}`);
    const run = await runSegment({...part, storage: new InMemoryStorage()});
    const screens = run.getScreens(), cursors = run.getCursors(), slices = run.getRngSlices();
    const frames = run.getAnimationFramesByStep();
    const actualCalls = calls(run.getRngLog());
    const expectedCalls = calls(part.steps.flatMap(step => step.rng || []));
    assert.equal(screens.length, part.steps.length);
    assert.equal(cursors.length, part.steps.length);
    assert.equal(slices.length, part.steps.length);
    assert.equal(frames.length, part.steps.length);
    const differences = [];
    const storage = {segment:index,serializedScreensEqual:0,serializedFramesEqual:0,rawFrameArraysEqual:true};
    for (const [step, recorded] of part.steps.entries()) {
        storage.serializedScreensEqual += +(recorded.screen === screens[step]);
        if (!same(styles(recorded.screen), styles(screens[step])))
            differences.push({step, kind: 'styled-grid'});
        if (!same(recorded.cursor, cursors[step]))
            differences.push({step, kind: 'cursor'});
        if (!same(calls(recorded.rng || []), calls(slices[step])))
            differences.push({step, kind: 'RNG-slice'});
        const expectedFrames=recorded.animation_frames || [],actualFrames=frames[step];
        storage.rawFrameArraysEqual &&= same(expectedFrames,actualFrames);
        if (expectedFrames.length !== actualFrames.length)
            differences.push({step, kind: 'frame-count'});
        for (const [frame, expected] of expectedFrames.entries()) {
            const actual=actualFrames[frame];
            if (actual) {
                assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort(),'all frame fields retained');
                for (const field of Object.keys(expected))
                    if (field !== 'screen') assert.deepEqual(actual[field],expected[field],`frame metadata ${step}/${frame}/${field}`);
                storage.serializedFramesEqual += +(actual.screen === expected.screen);
            }
            if (!actual || !same(styles(expected.screen),styles(actual.screen)))
                differences.push({step,frame,kind:'styled-frame'});
            if (!actual || !same(expected.cursor,actual.cursor))
                differences.push({step,frame,kind:'frame-cursor'});
        }
    }
    assert.equal(actualCalls.length, expectedCalls.length);
    assert.deepEqual(actualCalls, expectedCalls);
    t.diagnostic('literal-storage '+JSON.stringify(storage));
    assert.deepEqual(differences, [], 'every rendered native boundary and frame must match');
});
