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

const raw = readFileSync(new URL('gen-sessions/generated/polymorph-pit-kicks.session.json', import.meta.url));
const native = JSON.parse(raw);
const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/polymorph-pit-kicks.json', import.meta.url)));
const counts = [[93,2480,0],[100,2481,0],[79,2482,0],[99,2486,0]];
const witnesses = [
    [[44,'You fall into a pit!'],[82,'The rust monster wakes up!  You bite the rust monster.'],[91,'There is a pit here.']],
    [[51,'You fall into a pit!'],[89,'The rust monster wakes up!  You bite the rust monster.'],[98,'There is a spiked pit here.']],
    [[68,'You miss the rust monster.'],[69,'You bite the rust monster.']],
    [[50,'A bear trap closes on your rear hoof!'],[88,'You miss the rust monster.'],[89,'You bite the rust monster.'],[97,'There is a bear trap here.']],
];
const attacks = [82,89,68,88];
const rolls = [[7],[2],[15,7],[15,2]];
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
        '2a77dc2bd974b857b31db595946808d24b06f3ada7202d2ef5f95af74a05790e');
    assert.equal(raw.length, 641058);
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(native.segments.length, 4);
    assert.equal(recipe.segments.length, 4);
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
    // Native call-site evidence proves which owner made these ordinary attempts.
    const nativeRolls = part.steps.slice(attacks[index]).flatMap(s=>s.rng||[])
        .filter(call=>/^rnd\(20\)=/.test(call));
    const owner = 'hmonas(uhitm.c:5571)';
    assert.deepEqual(nativeRolls, rolls[index].map(value=>`rnd(20)=${value} @ ${owner}`));
    const combatCalls = part.steps.slice(attacks[index]).flatMap(s=>s.rng||[]);
    assert.equal(combatCalls.filter(call=>/^d\(1,4\)=/.test(call)).length,1,'later bite still damages');
    assert.equal(combatCalls.filter(call=>/^d\(1,10\)=/.test(call)).length,0,'pit skips kick; negative kick misses');
    assert.equal(combatCalls.filter(call=>/ @ passive\(/.test(call)).length,rolls[index].length);
    const combatText=part.steps.slice(attacks[index]).map(s=>top(s.screen)).join('\n');
    assert.doesNotMatch(combatText,/You kick/);
    if(index<2)assert.doesNotMatch(combatText,/You miss/);
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
    assert.equal(storage.rawFrameArraysEqual, true, 'all native frame arrays are empty and exactly preserved');
    t.diagnostic('literal-storage '+JSON.stringify(storage));
    assert.deepEqual(differences, [], 'every rendered native boundary and frame must match');
});
