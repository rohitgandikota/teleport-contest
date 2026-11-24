// Independent native input integrity and read-only JS producer observations.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Hallucination, Blind} from '../js/youprop.js';
import {m_at} from '../js/mon.js';
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import coverage from './gen-sessions/coverage-requirements.json' with {type:'json'};

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/pager-lookat-swallow-statue.json', import.meta.url)));

const raw = readFileSync(new URL('gen-sessions/generated/pager-lookat-swallow-statue.session.json', import.meta.url));
const native = JSON.parse(raw);
const nativeSHA256 = 'ff1ca7b0841ae26deafb4343c6503fc87058f013875fb138f61a58e49678c15a';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs = run => ({screens:run.getScreens(), cursors:run.getCursors(),
    calls:run.getRngLog(), slices:run.getRngSlices(), frames:run.getAnimationFramesByStep()});
const hashes = output => Object.fromEntries(Object.entries(output).map(([k,v])=>[k,hash(v)]));

test('recipe has four asserted tuples, matching basename and registered tags', () => {
    assert.equal(recipe.name, 'pager-lookat-swallow-statue');
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(createHash('sha256').update(raw).digest('hex'), nativeSHA256);
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    assert.equal(native.segments.length, 4);
    for (const [i, recorded] of native.segments.entries()) {
        const part = recipe.segments[i];
        for (const field of ['name','seed','datetime','nethackrc','moves']) {
            assert.equal(Object.hasOwn(recorded,field), Object.hasOwn(part,field));
            assert.deepEqual(recorded[field], part[field]);
        }
        assert.equal(recorded.steps.length, part.moves.length + 1);
        assert.equal(recorded.steps[0].key, null);
        for (let step = 1; step < recorded.steps.length; step++)
            assert.equal(recorded.steps[step].key, part.moves[step - 1]);
        const expected = recipe.jsReach[i];
        assert.equal(recorded.steps.length, expected.boundaries);
        assert.equal(recorded.steps.reduce((n,s)=>n+s.rng.length,0), expected.calls);
        assert.equal(recorded.steps.reduce((n,s)=>n+(s.animation_frames || []).length,0), expected.frames);
    }
    // Native automatic cursor descriptions precede the final '.' selection.
    const row = (segment, step) => decodeScreen(native.segments[segment].steps[step].screen)[0]
        .map(renderCell).join('').trimEnd();
    assert.equal(row(0,267), 'interior of the fog cloud');
    assert.equal(row(2,66), 'orange dragon');
    assert.ok(row(2,67).includes('(arch-lich)'));
    assert.ok(row(1,268).includes('unreconnoitered'));
    assert.equal(recipe.segments.length, 4);
    assert.equal(recipe.branchAssertions.length, 4);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    const registered = new Set(coverage.requirements.map(r=>r.id));
    assert.ok(recipe.coverage.every(tag=>registered.has(tag)));
    assert.ok(recipe.segments.every(s=>typeof s.moves === 'string' && !Object.hasOwn(s,'steps')));
});

for (const [index, part] of recipe.segments.entries()) test(part.name, async () => {
    const expected = recipe.jsReach[index], states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g,step) {
            // C getpos: uppercase direction moves eight cells.
            const targetX = g.u.ux - (index === 1 ? 8 : 1), targetY = g.u.uy;
            states.push({step, text:g._toplines || '', x:g.u.ux, y:g.u.uy,
                hp:g.u.uhp, mortality:g.u.umortality || 0,
                swallowed:!!g.u.uswallow, swallower:g.u.ustuck?.mnum,
                swallowTime:g.u.uswldtim, hallucinating:Hallucination(), blind:Blind(),
                targetGlyph:structuredClone(g.level.at(targetX,targetY)?.disp_glyph),
                targetMonster:m_at(targetX,targetY)?.mnum ?? null,
                statues:g.level.objectsAt(targetX,targetY)
                    .filter(o=>o.otyp === ONAMES.STATUE)
                    .map(o=>({otyp:o.otyp,corpsenm:o.corpsenm,x:o.ox,y:o.oy}))});
        }};
        run = await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    const output = outputs(run);
    const unobserved = outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    assert.deepEqual(hashes(output), hashes(unobserved));
    const selected = states.find(s=>s.step === expected.selectedStep);
    assert.ok(selected && part.moves[expected.selectedStep - 1] === '.');
    console.log(JSON.stringify({name:part.name, selected,
        selectionCursor:output.cursors[expected.selectedStep - 1],
        boundaries:output.screens.length,calls:output.calls.length,
        frames:output.frames.flat().length,hashes:hashes(output),
        observerAllFiveHashesUnchanged:true,nativeSHA256, nativeParity:'verified separately by the strict native gate'}));
    assert.equal(output.screens.length, expected.boundaries);
    assert.equal(output.calls.length, expected.calls);
    assert.equal(output.frames.flat().length, expected.frames);
    assert.ok(states.every(s=>s.hp > 0 && s.mortality === 0));
    assert.equal(selected.hp, expected.hp);
    assert.equal(selected.swallowed, expected.swallowed);
    assert.equal(selected.hallucinating, expected.hallucinating);
    assert.equal(selected.blind, false);
    assert.deepEqual(output.cursors[expected.selectedStep - 1],
        [selected.x - (index === 1 ? 8 : 1) - 1, selected.y + 1, 1]);
    if (index < 2) {
        assert.equal(selected.swallower, PMNAMES.PM_FOG_CLOUD);
        assert.ok(selected.swallowTime > 0);
        assert.equal(selected.targetGlyph.kind, index === 0 ? 'swallow' : 'unexplored');
        assert.ok(states.some(s=>s.text.includes('fog cloud engulfs you')));
        assert.equal(selected.targetMonster, null);
        assert.deepEqual(selected.statues, []);
    } else {
        assert.equal(selected.targetMonster, null);
        assert.equal(selected.statues.length, 1);
        assert.equal(selected.statues[0].corpsenm, PMNAMES.PM_GRID_BUG);
        assert.equal(selected.targetGlyph.kind, index === 2 ? 'mon' : 'obj');
        if (index === 2) {
            assert.equal(selected.targetGlyph.hallucinated_statue, true);
            assert.ok(states.some(s=>s.text.includes('Everything looks so cosmic')));
        } else assert.equal(selected.targetGlyph.statue, true);
    }
    assert.equal(selected.text, expected.selectedText);
    const observed = {source:'js',version:5,segments:[{...part,
        steps:output.screens.map((screen,i)=>({screen,cursor:output.cursors[i],
            key:i ? part.moves[i-1] : null,rng:output.slices[i],animation_frames:output.frames[i]}))}]};
    assert.deepEqual(branchAssertionErrors({...recipe,branches:[recipe.branches[index]],
        branchAssertions:[{...recipe.branchAssertions[index],segment:0}]},observed),[]);
});
