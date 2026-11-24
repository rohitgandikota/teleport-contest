// Actual C branch witnesses plus ordinary-key JS producer observations.
// The observer only reads state; an unobserved replay must match all five hashes.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Hallucination} from '../js/youprop.js';
import {mon_warning} from '../js/display.js';
import {ONAMES} from '../js/objects_data.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import coverage from './gen-sessions/coverage-requirements.json' with {type:'json'};

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/pager-look-all.json', import.meta.url)));
const nativeBytes = readFileSync(new URL('gen-sessions/generated/pager-look-all.session.json', import.meta.url));
const native = JSON.parse(nativeBytes);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const output = run => ({screens:run.getScreens(), cursors:run.getCursors(),
    calls:run.getRngLog(), slices:run.getRngSlices(), frames:run.getAnimationFramesByStep()});
const hashes = out => Object.fromEntries(Object.entries(out).map(([key,value])=>[key,hash(value)]));

test('recipe name and coverage tags are registered; five real key sequences have assertions', () => {
    assert.equal(recipe.name, 'pager-look-all');
    assert.equal(recipe.segments.length, 5);
    assert.equal(recipe.branchAssertions.length, 5);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    const registered = new Set(coverage.requirements.map(r=>r.id));
    assert.ok(recipe.coverage.every(tag=>registered.has(tag)));
    assert.ok(recipe.segments.every(s=>typeof s.moves === 'string' && !Object.hasOwn(s,'steps')));
    assert.equal(createHash('sha256').update(nativeBytes).digest('hex'), recipe.native.sha256);
    assert.equal(nativeBytes.length, recipe.native.bytes);
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(native.segments.length, 5);
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
});
for (const [index, part] of recipe.segments.entries()) test(part.name, async () => {
    const expected = recipe.jsReach[index], states = [];
    const recorded = native.segments[index];
    for (const field of ['name','seed','datetime','nethackrc','moves']) {
        assert.equal(Object.hasOwn(recorded,field), Object.hasOwn(part,field));
        assert.deepEqual(recorded[field], part[field]);
    }
    assert.deepEqual(recorded.steps.map(s=>s.key), [null,...part.moves]);
    assert.equal(recorded.steps.length, expected.boundaries);
    assert.equal(recorded.steps.reduce((n,s)=>n+s.rng.length,0), expected.calls);
    assert.equal(recorded.steps.reduce((n,s)=>n+(s.animation_frames || []).length,0), expected.frames);
    const nativeScreen = decodeScreen(recorded.steps[expected.selectedStep].screen)
        .map(row=>row.map(renderCell).join('').trimEnd()).join('\n');
    for (const fragment of recipe.branchAssertions[index].screenIncludes)
        assert.ok(nativeScreen.includes(fragment), fragment);
    for (const fragment of recipe.branchAssertions[index].screenExcludes)
        assert.ok(!nativeScreen.includes(fragment), fragment);
    assert.equal(nativeScreen.includes('--More--'), expected.pendingMore);
    const previous = Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step:'*',cb(g,step) {
            const mon = expected.target ? g.level.monsters.find(m=>m.mnum === expected.target.id) : null;
            states.push({step, hp:g.u.uhp, mortality:g.u.umortality || 0,
                mode:g.iflags.getpos_coords, hallu:Hallucination(),
                timeout:g.u.intrinsic.HHallucination || 0, warning:g.u.uprops.WARNING || 0,
                inventory:(g.invent || []).map(o=>({type:o.otyp,slot:o.invlet,worn:o.owornmask || 0})),
                rocks:g.level.objects.filter(o=>o.otyp === ONAMES.ROCK)
                    .map(o=>({x:o.ox,y:o.oy,quan:o.quan,kind:g.level.at(o.ox,o.oy).disp_glyph?.kind})),
                mon:mon ? {id:mon.mnum,x:mon.mx,y:mon.my,sleeping:!!mon.msleeping,
                    invisible:!!mon.minvis,peaceful:!!mon.mpeaceful,warning:mon_warning(mon),
                    kind:g.level.at(mon.mx,mon.my).disp_glyph?.kind,
                    wl:g.level.at(mon.mx,mon.my).disp_glyph?.wl} : null});
        }};
        run = await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    const out = output(run);
    assert.deepEqual(hashes(out),hashes(output(await runSegment({...part,storage:new InMemoryStorage()}))));
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    assert.equal(out.screens.length,part.moves.length + 1);
    assert.equal(out.screens.length,expected.boundaries);
    assert.equal(out.calls.length,expected.calls);
    assert.equal(out.frames.flat().length,expected.frames);
    assert.deepEqual(out.slices.flat(),out.calls);
    assert.ok(states.every(s=>s.hp > 0 && s.mortality === 0));
    const selected = states.find(s=>s.step === expected.selectedStep);
    assert.ok(selected); assert.equal(selected.hp,expected.hp);
    assert.equal(selected.mode,expected.mode);
    assert.equal(part.moves[selected.step-1],['m','M','O','m','/'][index]);
    assert.equal(selected.hallu,index === 4);
    if (expected.target) {
        assert.ok(selected.mon);
        for (const field of ['id','x','y','sleeping','invisible','peaceful'])
            assert.equal(selected.mon[field],expected.target[field]);
        assert.equal(selected.mon.kind,expected.target.glyph.kind);
    }
    if (index === 0) {
        assert.ok(states.some(s=>s.warning === 0));
        assert.ok(selected.warning && selected.mon.warning);
        assert.equal(selected.mon.wl,3);
        assert.ok(selected.inventory.some(o=>o.type === ONAMES.RIN_WARNING && o.worn));
    } else if (index === 1) {
        assert.ok(selected.inventory.some(o=>o.type === ONAMES.STETHOSCOPE && o.slot === 'a'));
        assert.ok(states.some(s=>s.mon?.kind === 'cmap' && s.mon?.invisible));
        assert.equal(selected.mon.kind,'invis');
    } else if (index === 2) {
        assert.ok(states.some(s=>s.inventory.some(o=>o.type === ONAMES.ROCK)));
        assert.ok(!selected.inventory.some(o=>o.type === ONAMES.ROCK));
        assert.ok(selected.rocks.some(o=>o.x === 59 && o.y === 6 && o.quan > 0 && o.kind === 'obj'));
    } else if (index === 3) {
        assert.ok(states.every(s=>!s.warning && !s.hallu));
        assert.equal(selected.mon.kind,'mon');
    } else {
        assert.ok(states.some(s=>s.inventory.some(o=>o.type === ONAMES.POT_HALLUCINATION)));
        assert.ok(!selected.inventory.some(o=>o.type === ONAMES.POT_HALLUCINATION));
        assert.ok(states.some(s=>s.timeout === 0)); assert.ok(selected.timeout > 0);
    }
    const screen = decodeScreen(out.screens[expected.selectedStep])
        .map(row=>row.map(renderCell).join('').trimEnd()).join('\n');
    for (const fragment of recipe.branchAssertions[index].screenIncludes)
        assert.ok(screen.includes(fragment),fragment);
    for (const fragment of recipe.branchAssertions[index].screenExcludes)
        assert.ok(!screen.includes(fragment),fragment);
    assert.equal(screen.includes('--More--'),expected.pendingMore);
    const observed = {source:'js',version:5,segments:[{...part,
        steps:out.screens.map((screen,i)=>({screen,cursor:out.cursors[i],
            key:i ? part.moves[i-1] : null,rng:out.slices[i],animation_frames:out.frames[i]}))}]};
    assert.deepEqual(branchAssertionErrors({...recipe,branches:[recipe.branches[index]],
        branchAssertions:[{...recipe.branchAssertions[index],segment:0}]},observed),[]);
    console.log(JSON.stringify({name:part.name,boundaries:out.screens.length,calls:out.calls.length,
        frames:out.frames.flat().length,selected,hashes:hashes(out),observerAllFiveHashesUnchanged:true,
        nativeSelectedStep:expected.selectedStep, nativeBranchVerified:true,
        evidence:'Independent C branch text and unchanged input tuple; read-only JS producer state'}));
});
