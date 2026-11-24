// Actual input reach, with read-only observations and an unobserved replay.
// Independent C branch witnesses complement the read-only JS producer state.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {howmonseen} from '../js/vision.js';
import {Detect_monsters} from '../js/youprop.js';
import {ONAMES} from '../js/objects_data.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import coverage from './gen-sessions/coverage-requirements.json' with {type:'json'};

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/pager-monster-description.json', import.meta.url)));
const nativeBytes = readFileSync(new URL('gen-sessions/generated/pager-monster-description.session.json', import.meta.url));
const native = JSON.parse(nativeBytes);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const output = run => ({screens:run.getScreens(),cursors:run.getCursors(),
    calls:run.getRngLog(),slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
const hashes = out => Object.fromEntries(Object.entries(out).map(([key,value])=>[key,hash(value)]));

test('recipe name, four input tuples and all coverage tags are registered', () => {
    assert.equal(recipe.name, 'pager-monster-description');
    assert.equal(createHash('sha256').update(nativeBytes).digest('hex'), recipe.native.sha256);
    assert.equal(nativeBytes.length, recipe.native.bytes);
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(native.segments.length, 4);
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    assert.equal(native.segments.reduce((n,s)=>n+s.steps.length,0), recipe.native.boundaries);
    assert.equal(native.segments.flatMap(s=>s.steps).reduce((n,s)=>n+s.rng.length,0), recipe.native.completeCalls);
    assert.equal(native.segments.flatMap(s=>s.steps).reduce((n,s)=>n+(s.animation_frames||[]).length,0), recipe.native.frames);
    assert.equal(recipe.segments.length, 4);
    assert.equal(recipe.branchAssertions.length, 4);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    const registered = new Set(coverage.requirements.map(r=>r.id));
    assert.ok(recipe.coverage.every(tag=>registered.has(tag)));
    assert.ok(recipe.segments.every(s=>typeof s.moves === 'string' && !Object.hasOwn(s,'steps')));
});
for (const [index, part] of recipe.segments.entries()) test(part.name, async () => {
    const expected = recipe.jsReach[index], states = [];
    const recorded = native.segments[index];
    for (const field of ['name','seed','datetime','nethackrc','moves']) {
        assert.equal(Object.hasOwn(recorded,field),Object.hasOwn(part,field));
        assert.deepEqual(recorded[field],part[field]);
    }
    assert.deepEqual(recorded.steps.map(s=>s.key),[null,...part.moves]);
    assert.equal(recorded.steps.length,expected.boundaries);
    assert.equal(recorded.steps.reduce((n,s)=>n+s.rng.length,0),expected.calls);
    assert.equal(recorded.steps.reduce((n,s)=>n+(s.animation_frames||[]).length,0),expected.frames);
    const nativeRows = decodeScreen(recorded.steps[expected.selectedStep].screen)
        .map(row=>row.map(renderCell).join('').trimEnd());
    const nativeScreen = nativeRows.join('\n');
    for (const fragment of recipe.branchAssertions[index].screenIncludes)
        assert.ok(nativeScreen.includes(fragment),fragment);
    assert.equal(nativeScreen.includes('--More--'),expected.pendingMore);
    assert.equal(nativeScreen.includes('[seen:'),index === 0 || index === 2);
    if (index === 2) {
        const earlier = decodeScreen(recorded.steps[expected.selectedStep-1].screen)
            .map(row=>row.map(renderCell).join('')).join('\n');
        assert.ok(earlier.includes('peaceful rock piercer, asleep, hiding on the ceiling'));
        assert.equal(recorded.steps[expected.selectedStep-1].key,'m');
    }
    const previous = Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step:'*',cb(g,step) {
            const mon = g.level.monsters.find(m=>m.mnum === expected.target.id);
            states.push({step, text:g._toplines || '', hp:g.u.uhp,
                mortality:g.u.umortality || 0, detect:Detect_monsters(),
                timeout:g.u.intrinsic?.HDetect_monsters || 0,
                potion:(g.invent || []).filter(o=>o.otyp === ONAMES.POT_MONSTER_DETECTION)
                    .map(o=>({blessed:!!o.blessed,invlet:o.invlet,quan:o.quan})),
                mon:mon ? {id:mon.mnum,x:mon.mx,y:mon.my,hidden:!!mon.mundetected,
                    sleeping:!!mon.msleeping,peaceful:!!mon.mpeaceful,mask:howmonseen(mon),
                    glyph:g.level.at(mon.mx,mon.my).disp_glyph?.kind} : null});
        }};
        run = await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    const out = output(run);
    assert.deepEqual(hashes(out), hashes(output(await runSegment({...part,storage:new InMemoryStorage()}))));
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    assert.equal(out.screens.length, part.moves.length + 1);
    assert.equal(out.screens.length, expected.boundaries);
    assert.equal(out.calls.length, expected.calls);
    assert.equal(out.frames.flat().length, expected.frames);
    assert.deepEqual(out.slices.flat(),out.calls);
    assert.ok(states.every(s=>s.hp > 0 && s.mortality === 0));
    const selected = states.find(s=>s.step === expected.selectedStep);
    assert.ok(selected?.mon);
    assert.equal(part.moves[selected.step-1], expected.list ? 'm' : '.');
    assert.equal(selected.hp,expected.hp);
    assert.equal(selected.mon.id,expected.target.id);
    assert.equal(selected.mon.x,expected.target.x);
    assert.equal(selected.mon.y,expected.target.y);
    assert.equal(selected.mon.sleeping,true);
    assert.equal(selected.mon.peaceful,true);
    assert.equal(selected.mon.hidden,index === 2);
    assert.equal(selected.mon.mask,expected.target.mask);
    assert.equal(selected.mon.glyph,'mon');
    assert.equal(selected.detect,index !== 1);
    assert.equal(selected.timeout,expected.detect);
    if (index !== 1) {
        assert.ok(states.some(s=>s.potion.some(o=>o.blessed && o.invlet === 'a')));
        assert.ok(states.some(s=>s.timeout === 0));
        assert.equal(selected.potion.length,0, 'ordinary quaff consumed the blessed potion');
    } else {
        assert.ok(states.every(s=>s.timeout === 0 && s.potion.length === 0));
    }
    const rows = decodeScreen(out.screens[expected.selectedStep]).map(row=>row.map(renderCell).join('').trimEnd());
    const screen = rows.join('\n');
    for (const fragment of recipe.branchAssertions[index].screenIncludes)
        assert.ok(screen.includes(fragment),fragment);
    assert.equal(screen.includes('--More--'), expected.pendingMore);
    assert.equal(screen.includes('[seen:'),index === 0 || index === 2);
    if (!expected.list) assert.equal(selected.text,expected.selectedText);
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
