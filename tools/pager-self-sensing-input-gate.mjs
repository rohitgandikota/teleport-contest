// Ordinary input reach plus independent recorded branch assertions.
// Complete styled-cell and RNG parity is checked by the companion native gate.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Invisible, Invis, See_invisible, Blind, Unblind_telepat,
    Detect_monsters, Infravision} from '../js/youprop.js';
import {ONAMES} from '../js/objects_data.js';
import {W_AMUL, W_RINGL, W_TOOL} from '../js/const.js';
import {branchAssertionErrors} from './gen-sessions/assertions.mjs';
import coverage from './gen-sessions/coverage-requirements.json' with {type: 'json'};
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/pager-self-sensing.json', import.meta.url)));
const raw = readFileSync(new URL('gen-sessions/generated/pager-self-sensing.session.json', import.meta.url));
const native = JSON.parse(raw);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs = run => ({screens: run.getScreens(), cursors: run.getCursors(),
    calls: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep()});
const hashes = output => Object.fromEntries(Object.entries(output).map(([key, value]) => [key, hash(value)]));

test('recipe names, registered tags and four asserted input tuples', () => {
    assert.equal(createHash('sha256').update(raw).digest('hex'),
        '49782400bfb8d95fdb012d5afad400e354bf4c850054869861dc49a71d914ee3');
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(native.segments.length, 4);
    assert.equal(recipe.name, 'pager-self-sensing');
    assert.equal(recipe.segments.length, 4);
    assert.equal(recipe.branchAssertions.length, 4);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    for (const [index, part] of recipe.segments.entries()) {
        const recorded = native.segments[index];
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves', 'initial']) {
            assert.equal(Object.hasOwn(recorded, field), Object.hasOwn(part, field));
            assert.deepEqual(recorded[field], part[field]);
        }
        assert.equal(recorded.steps.length, part.moves.length + 1);
        assert.equal(recorded.steps[0].key, null);
        for (let step = 1; step < recorded.steps.length; step++)
            assert.equal(recorded.steps[step].key, part.moves[step - 1]);
    }
    assert.ok(recipe.segments.every(s => typeof s.moves === 'string' && !Object.hasOwn(s, 'steps')));
    const registered = new Set(coverage.requirements.map(r => r.id));
    assert.ok(recipe.coverage.every(tag => registered.has(tag)));
});

for (const [index, part] of recipe.segments.entries())
test(part.name, async () => {
    const expected = recipe.jsReach[index], states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            states.push({step, text: g._toplines || '', hp: g.u.uhp,
                mortality: g.u.umortality || 0, x: g.u.ux, y: g.u.uy,
                Invisible: Invisible(), Invis: Invis(), See_invisible: See_invisible(),
                Blind: Blind(), telepathy: Unblind_telepat(), detect: Detect_monsters(),
                infra: Infravision(), hidden: !!g.u.uundetected, swallowed: !!g.u.uswallow,
                amulet: g.u.uamul?.otyp, amuletMask: g.u.uamul?.owornmask,
                ring: g.u.uleft?.otyp, ringMask: g.u.uleft?.owornmask,
                facewear: g.u.ublindf?.otyp, facewearMask: g.u.ublindf?.owornmask,
                carriedInvisibilityRing: (g.invent || []).some(o => o.otyp === ONAMES.RIN_INVISIBILITY),
                glyphKind: g.level.at(g.u.ux, g.u.uy).disp_glyph?.kind});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    const output = outputs(run);
    const unobserved = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
    assert.deepEqual(hashes(output), hashes(unobserved));
    const witness = states.find(s => s.step >= part.moves.indexOf(';') && s.text.includes('called '));
    assert.ok(witness, 'selected self description reached through ; and .');
    console.log(JSON.stringify({name: part.name, witness, boundaries: output.screens.length,
        calls: output.calls.length, frames: output.frames.flat().length, hashes: hashes(output),
        observationAllFiveHashesUnchanged: true, nativeBranchEvidence: 'independent unchanged C; full parity checked separately'}));
    assert.equal(output.screens.length, expected.boundaries);
    assert.equal(output.calls.length, expected.calls);
    assert.equal(output.frames.flat().length, expected.frames);
    assert.ok(states.every(s => s.hp > 0 && s.mortality === 0));
    for (const [key, value] of Object.entries(expected.senses)) assert.equal(witness[key], value, key);
    assert.equal(witness.hidden, false);
    assert.equal(witness.swallowed, false);
    assert.equal(witness.amulet, ONAMES.AMULET_OF_ESP);
    assert.equal(witness.amuletMask & W_AMUL, W_AMUL);
    assert.equal(witness.carriedInvisibilityRing, true);
    assert.equal(witness.glyphKind, 'hero');
    if (index === 1) assert.equal(witness.ring, undefined);
    else {
        assert.equal(witness.ring, ONAMES.RIN_INVISIBILITY);
        assert.equal(witness.ringMask & W_RINGL, W_RINGL);
    }
    if (index === 3) {
        assert.equal(witness.facewear, ONAMES.BLINDFOLD);
        assert.equal(witness.facewearMask & W_TOOL, W_TOOL);
    }
    const nativeStep = native.segments[index].steps[expected.lookStep];
    const nativeRows = decodeScreen(nativeStep.screen).map(row => row.map(renderCell).join(''));
    assert.ok(nativeRows[0].includes('called wizard'));
    if (expected.suffix) {
        assert.ok(nativeRows[0].includes('[seen:'));
        assert.ok(nativeRows[1].startsWith(expected.suffix + '])--More--'));
    } else {
        assert.ok(!nativeRows.slice(0, 3).join('\n').includes('[seen:'));
        assert.ok(nativeRows[0].includes('called wizard)'));
    }
    const text = witness.text.replace(/\n/g, ' ');
    if (expected.suffix) assert.ok(text.includes(`[seen: ${expected.suffix}]`));
    else assert.ok(!text.includes('[seen:'));
    const observed = {source: 'js', version: 5, segments: [{...part,
        steps: output.screens.map((screen, i) => ({screen, cursor: output.cursors[i],
            key: i ? part.moves[i - 1] : null, rng: output.slices[i],
            animation_frames: output.frames[i]}))}]};
    assert.deepEqual(branchAssertionErrors({...recipe, branches: [recipe.branches[index]],
        branchAssertions: [{...recipe.branchAssertions[index], segment: 0}]}, observed), []);
});
