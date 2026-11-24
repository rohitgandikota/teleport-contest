// Read-only ordinary input reach. The changed pm return is separately source-tested.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Upolyd} from '../js/const.js';
import {Hallucination} from '../js/youprop.js';
import {PMNAMES} from '../js/monst_data.js';
import {str2role, str2race} from '../js/role.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import coverage from './gen-sessions/coverage-requirements.json' with {type:'json'};

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/pager-gnome-wizard.json', import.meta.url)));
const nativeBytes = readFileSync(new URL('gen-sessions/generated/pager-gnome-wizard.session.json', import.meta.url));
const native = JSON.parse(nativeBytes);
const nativeRows = screen => decodeScreen(screen).map(row=>row.map(renderCell).join(''));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs = run => ({screens:run.getScreens(), cursors:run.getCursors(),
    calls:run.getRngLog(), slices:run.getRngSlices(), frames:run.getAnimationFramesByStep()});
const hashes = output => Object.fromEntries(Object.entries(output).map(([key,value])=>[key,hash(value)]));

test('four input tuples have a matching recipe name, assertions and registered tags', () => {
    assert.equal(recipe.name, 'pager-gnome-wizard');
    assert.equal(recipe.segments.length, 4);
    assert.equal(recipe.branchAssertions.length, 4);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    const registered = new Set(coverage.requirements.map(r=>r.id));
    assert.ok(recipe.coverage.every(tag=>registered.has(tag)));
    assert.ok(recipe.segments.every(s=>typeof s.moves === 'string' && !Object.hasOwn(s,'steps')));
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(native.segments.length, 4);
    assert.equal(nativeBytes.length, 518180);
    assert.equal(createHash('sha256').update(nativeBytes).digest('hex'),
        'cfa23743ee030042f25006279aeaec4fd899d35dadf09952800c2f4ed065bd0f');
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    for (const [index, part] of recipe.segments.entries()) {
        const recorded = native.segments[index];
        for (const key of ['name','seed','datetime','nethackrc','moves']) {
            assert.equal(Object.hasOwn(recorded,key), Object.hasOwn(part,key));
            assert.deepEqual(recorded[key], part[key]);
        }
        assert.equal(recorded.steps.length, part.moves.length + 1);
        assert.equal(recorded.steps[0].key, null);
        for (let step=1;step<recorded.steps.length;step++)
            assert.equal(recorded.steps[step].key, part.moves[step-1]);
    }
});

for (const [index, part] of recipe.segments.entries()) test(part.name, async () => {
    const expected = recipe.jsReach[index], states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g,step) {
            // Observe the real producer state only. Do not call the description
            // helper here, since inspection can consume display RNG elsewhere.
            states.push({step, text:g._toplines || '', x:g.u.ux, y:g.u.uy,
                role:g.urole.mnum, race:g.urace.mnum, initrole:g.flags.initrole,
                initrace:g.flags.initrace, female:!!g.flags.female,
                alignment:g.u.ualign.type, debug:!!g.wizard,
                umonnum:g.u.umonnum, umonster:g.u.umonster,
                polymorphed:Upolyd(g.u), hallucinating:Hallucination(),
                glyph:structuredClone(g.level.at(g.u.ux,g.u.uy).disp_glyph),
                hp:g.u.uhp, mortality:g.u.umortality || 0});
        }};
        run = await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    const output = outputs(run);
    const unobserved = outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    assert.deepEqual(hashes(output), hashes(unobserved));
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'), previous);
    const selected = states.find(s=>s.step === expected.selectedStep);
    assert.ok(selected && part.moves[selected.step - 1] === '.');
    assert.equal(output.screens.length, part.moves.length + 1);
    assert.equal(output.screens.length, expected.boundaries);
    assert.equal(output.calls.length, expected.calls);
    assert.equal(output.frames.flat().length, expected.frames);
    assert.deepEqual(output.slices.flat(), output.calls);
    assert.ok(states.every(s=>s.hp > 0 && s.mortality === 0));
    assert.equal(selected.text, expected.selectedText);
    assert.equal(selected.hp, expected.hp);
    assert.equal(selected.role, expected.role);
    assert.equal(selected.race, expected.race);
    assert.equal(selected.initrole, str2role(index === 2 ? 'Healer' : 'Wizard'));
    assert.equal(selected.initrace, str2race(index === 1 ? 'human' : 'gnome'));
    assert.equal(selected.female, false);
    assert.equal(selected.alignment, 0);
    assert.equal(selected.debug, expected.debug);
    assert.equal(selected.umonnum, expected.umonnum);
    assert.equal(selected.umonster, expected.umonster);
    assert.equal(selected.polymorphed, expected.polymorphed);
    assert.equal(selected.hallucinating, false);
    assert.equal(selected.glyph.kind, 'hero');
    assert.equal(selected.glyph.glyphnum, selected.umonnum);
    assert.deepEqual(output.cursors[selected.step - 1], [selected.x-1,selected.y+1,1]);
    assert.ok(states[0].text.includes('neutral male'));
    assert.equal(states[0].polymorphed, false);
    if (index === 3) {
        assert.equal(selected.umonnum, PMNAMES.PM_NEWT);
        assert.equal(selected.umonster, PMNAMES.PM_WIZARD);
        assert.ok(states.some(s=>s.text === 'You turn into a newt!'));
    }
    const recorded = native.segments[index];
    const greeting = nativeRows(recorded.steps[0].screen)[0].trimEnd();
    const race = index === 1 ? 'human' : 'gnomish';
    const role = index === 2 ? 'Healer' : 'Wizard';
    const name = index === 3 ? 'wizard' : 'Desired';
    assert.equal(greeting,
        `Hello ${name}, welcome to NetHack!  You are a neutral male ${race} ${role}.`);
    const selectedNativeText = nativeRows(recorded.steps[selected.step].screen)[0].trimEnd();
    assert.equal(selectedNativeText, expected.selectedText);
    assert.deepEqual(recorded.steps[selected.step-1].cursor, output.cursors[selected.step-1]);
    assert.equal(recorded.steps.length, expected.boundaries);
    assert.equal(recorded.steps.reduce((n,step)=>n + step.rng.length,0), expected.calls);
    assert.equal(recorded.steps.reduce((n,step)=>n + (step.animation_frames || []).length,0), expected.frames);
    if (index === 3)
        assert.ok(recorded.steps.some(step=>nativeRows(step.screen)[0].includes('You turn into a newt!')));
    const observed = {source:'js',version:5,segments:[{...part,
        steps:output.screens.map((screen,i)=>({screen,cursor:output.cursors[i],
            key:i ? part.moves[i-1] : null,rng:output.slices[i],animation_frames:output.frames[i]}))}]};
    assert.deepEqual(branchAssertionErrors({...recipe,branches:[recipe.branches[index]],
        branchAssertions:[{...recipe.branchAssertions[index],segment:0}]},observed),[]);
    console.log(JSON.stringify({name:part.name, selected, boundaries:output.screens.length,
        calls:output.calls.length,frames:output.frames.flat().length, hashes:hashes(output),
        observerAllFiveHashesUnchanged:true,
        nativeGreeting:greeting, nativeSelectedText:selectedNativeText,
        evidence:'Independent native branch witnesses and read-only JS state. Changed pm contract remains source-only, with no visible native improvement claimed.'}));
});
