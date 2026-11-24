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

const raw = readFileSync(new URL('gen-sessions/generated/hero-polymorph-weapon-seduction.session.json', import.meta.url));
const native = JSON.parse(raw);
const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/hero-polymorph-weapon-seduction.json', import.meta.url)));
const counts = [[81,2528,0],[86,2545,0],[138,2534,0],[116,2507,0],[118,2507,0],[113,2513,0]];
const witnesses = [
    [[71,'You hit the ogre.'],[72,'The ogre is covered in frost!'],[72,'You kill the ogre!']],
    [[76,'You hit the ice troll.']],
    [[128,'You hit the ogre.'],[129,'The ogre becomes weaker!'],[130,'The ogre is covered in frost!']],
    [[106,'You smile at the ogre seductively.'],[106,'You steal:'],[107,'You smile at the ogre seductively.']],
    [[108,'You smile at the ogre engagingly.'],[108,'You steal:'],[109,'You smile at the ogre engagingly.']],
    [[103,'You bite the ogre.'],[104,'You steal:'],[104,'You hit the ogre.']],
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
        '3946d7139306dfd135637bb147a51ac4131409b8cf22135607da8a1f41660ea6');
    assert.equal(raw.length, 978065);
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

for (const [index, part] of native.segments.entries()) test(`full native parity: ${part.name}`, async () => {
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
    for (const [step, recorded] of part.steps.entries()) {
        if (!same(styles(recorded.screen), styles(screens[step])))
            differences.push({step, kind: 'styled-grid'});
        if (!same(recorded.cursor, cursors[step]))
            differences.push({step, kind: 'cursor'});
        if (!same(calls(recorded.rng || []), calls(slices[step])))
            differences.push({step, kind: 'RNG-slice'});
        if (!same(recorded.animation_frames || [], frames[step]))
            differences.push({step, kind: 'frame-array'});
    }
    assert.equal(actualCalls.length, expectedCalls.length);
    assert.deepEqual(actualCalls, expectedCalls);
    assert.deepEqual(differences, [], 'every native boundary must match');
});
