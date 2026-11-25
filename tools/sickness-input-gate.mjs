// Ordinary keys only. Read-only input-boundary observations never change state.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { NethackGame, runSegment } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { moveloop_core } from '../js/allmain.js';
import { getRngLog } from '../js/rng.js';
import { Sick_resistance } from '../js/youprop.js';
import { SICK, STONED, TIMEOUT, W_ARM } from '../js/const.js';
import { ONAMES } from '../js/objects_data.js';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length <= 3 && !process.argv[2]?.startsWith('--'),
    'Usage: node tools/sickness-input-gate.mjs [compact-report.json]');
const deadline = setTimeout(() => { console.error('sickness input gate exceeded 55 seconds'); process.exit(1); }, 55000);
deadline.unref();
const output = run => ({screens:run.getScreens(), cursors:run.getCursors(),
    rng:[...run.getRngLog()], slices:run.getRngSlices(), frames:run.getAnimationFramesByStep()});
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hashes = value => Object.fromEntries(Object.entries(value).map(([key,v])=>[key,digest(v)]));
function snapshot(g, step) {
    const causes = [];
    for (let k = g.killer?.next; k; k = k.next) {
        assert.ok(causes.length < 16, 'delayed killer list must terminate');
        causes.push({id:k.id, format:k.format, name:k.name});
    }
    return {step, turn:g.moves, sick:g.u.uprops?.SICK||0, type:g.u.usick_type||0,
        stoned:g.u.uprops?.STONED||0, vomiting:g.u.uprops?.VOMITING||0,
        hallu:g.u.intrinsic?.HHallucination||0, blinded:g.u.intrinsic?.HBlinded||0,
        sickRes:Sick_resistance(), intrinsicRes:g.u.intrinsic?.HSick_resistance||0,
        extrinsicRes:g.u.uprops?.SICK_RES||0, armor:g.u.uarm?.otyp??null,
        food:g.u.uconduct?.food||0, mortality:g.u.umortality||0,
        causes, killer:{format:g.killer?.format, name:g.killer?.name},
        legacy:!!g.delayed_killer, top:g._toplines, pending:g._pending_message,
        rngCount:getRngLog().length};
}
async function deferred(input, hold, pendingStates) {
    const run = new NethackGame({...input, storage:new InMemoryStorage()});
    const display = new GameDisplay(null), end = new Error('Input queue empty: bounded sickness gate');
    let used = 0, complete = false;
    display.onEmptyQueue = async () => {
        await setImmediate();
        if (used === hold || used === input.moves.length) {
            const before = snapshot(game, used), rng = [...getRngLog()];
            await setImmediate(); assert.equal(complete, false);
            assert.deepEqual(snapshot(game, used), before); assert.deepEqual(getRngLog(), rng);
            pendingStates.push(before);
        }
        if (used === input.moves.length) throw end;
        return input.moves.charCodeAt(used++);
    };
    run._pendingDisplay = display;
    try {
        await run.start();
        for (let i = 0; i < 2048 && !game.program_state?.gameover; i++) await moveloop_core();
    } catch (e) { if (e !== end) throw e; }
    complete = true; assert.equal(used, input.moves.length);
    assert.ok(pendingStates.some(s=>s.step===input.moves.length), 'exhausted input must stay pending');
    return run;
}
async function runCase(part, mode, hold = -1) {
    const input = Object.fromEntries(['seed','datetime','nethackrc','moves'].map(k=>[k,part[k]]));
    const states = [], pendingStates = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        if (mode === 'observer') globalThis.__step_snapshot = {step:'*',cb(g,s){states.push(snapshot(g,s));}};
        run = mode === 'deferred' ? await deferred(input, hold, pendingStates)
            : await runSegment({...input,storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    return {outputs:output(run),states,pendingStates};
}
const cause = s => s.causes.find(k=>k.id===SICK)?.name ?? null;
function reach(name, states, outputs) {
    const first = states.find(s=>(s.sick & TIMEOUT)>0), after = states.at(-1);
    const witnesses = [first,after];
    assert.ok(states.every(s=>!s.legacy));
    const sickNames = ['tainted-food-leaf-cure','tainted-food-recovery','horn-final-death',
        'mixed-illness-partial-vomit','food-poisoning-full-vomit','mixed-illness-hallucinated-expiry',
        'illness-full-cure','illness-unrelated-stone-cure','monster-illness-survival'];
    if (sickNames.includes(name)) {
        assert.ok(first, `${name}: actual illness must be reached`);
        assert.equal(cause(first), (name.startsWith('tainted')
            || name==='food-poisoning-full-vomit' ? 'rotted newt corpse'
            : name==='monster-illness-survival' ? 'Pestilence' : 'unicorn horn'));
    }
    if (['tainted-food-leaf-cure','illness-full-cure','food-poisoning-full-vomit'].includes(name)) {
        const cured = states.find(s=>s.top.includes('cured.  What a relief!') && !s.sick);
        assert.ok(cured); assert.equal(cured.type,0); assert.equal(cause(cured),null);
        assert.ok(cured.food>0); assert.equal(after.sick,0); witnesses.push(cured);
    } else if (name==='tainted-food-recovery') {
        const recovered = states.find(s=>s.top.includes('recovered from your illness'));
        assert.ok(recovered); assert.equal(after.sick,0); assert.equal(after.type,1);
        assert.equal(after.mortality,0); assert.equal(cause(after),null); witnesses.push(recovered);
    } else if (name==='mixed-illness-partial-vomit') {
        const mixed = states.find(s=>s.type===3);
        const cured = states.find(s=>s.step>mixed?.step && s.type===2 && s.top.includes('somewhat better.'));
        assert.ok(mixed); assert.ok(cured); assert.ok(cured.sick>mixed.sick);
        assert.equal(cause(mixed),'rotted newt corpse');
        assert.equal(cause(cured),cause(mixed)); assert.equal(cause(after),cause(mixed));
        assert.ok(after.sick>0); assert.equal(after.type,2); assert.equal(after.vomiting,0);
        witnesses.push(mixed,cured);
    } else if (name==='horn-final-death' || name==='mixed-illness-hallucinated-expiry') {
        const died = states.find(s=>s.mortality && s.top.includes('die from your illness.'));
        assert.ok(died); assert.equal(cause(died),null);
        assert.equal(died.killer.name,name==='horn-final-death'?'unicorn horn':'rotted newt corpse');
        if (name==='mixed-illness-hallucinated-expiry') {
            assert.ok(states.some(s=>s.type===3 && s.hallu>0));
            assert.equal(states.some(s=>s.top.includes('inviting you in.')),true);
        }
        witnesses.push(died);
    } else if (name==='green-armor-blocks-horn') {
        assert.ok(outputs.rng.includes('rn2(13)=0'));
        assert.equal(after.armor,ONAMES.GREEN_DRAGON_SCALE_MAIL); assert.equal(after.sickRes,true);
        assert.equal(after.intrinsicRes,0); assert.equal(after.extrinsicRes,W_ARM);
        assert.ok(states.every(s=>!s.sick));
    } else if (name==='illness-unrelated-stone-cure') {
        const both = states.find(s=>s.stoned && s.sick);
        const cured = states.find(s=>s.stoned && !s.sick && s.top.includes('cured.'));
        assert.ok(both); assert.ok(cured); assert.equal(cause(cured),null);
        assert.deepEqual(cured.causes.find(k=>k.id===STONED),both.causes.find(k=>k.id===STONED));
        assert.ok(cured.causes.find(k=>k.id===STONED)); assert.equal(after.stoned,0);
        witnesses.push(both,cured);
    } else if (name==='monster-illness-survival') {
        const survived = states.find(s=>s.mortality && s.top.includes("OK, so you don't die."));
        assert.ok(survived); assert.ok(survived.sick>0);
        assert.equal(cause(survived),'Pestilence');
        assert.equal(after.type,2); assert.equal(after.mortality,1); witnesses.push(survived);
    } else if (name.endsWith('-negative')) {
        assert.ok(states.every(s=>!s.sick && cause(s)===null));
        if(name==='armor-other-ailment-negative') {
            assert.ok(outputs.rng.includes('rn2(13)=3')); assert.ok(after.blinded>0);
            assert.equal(after.armor,ONAMES.GREEN_DRAGON_SCALE_MAIL);
        } else assert.ok(after.food>0);
    }
    return [...new Map(witnesses.filter(Boolean).map(s=>[s.step,s])).values()].sort((a,b)=>a.step-b.step);
}

// Require the canonical recording and its exact input fields.
const recipeBytes = fs.readFileSync(new URL('./gen-sessions/recipes/sickness-owner-contract.json',import.meta.url));
const recipe = JSON.parse(recipeBytes);
const negatives = recipe.unchangedOutputHashes;
assert.equal(recipe.segments.length,13); assert.deepEqual(branchAssertionErrors(recipe),[]);
const nativePath = new URL('./gen-sessions/generated/sickness-owner-contract.session.json',import.meta.url);
const bytes = fs.readFileSync(nativePath), native = JSON.parse(bytes);
const nativeSHA256 = createHash('sha256').update(bytes).digest('hex');
assert.equal(nativeSHA256,'2d0aab32d90c0b5366dbe31a023211d4aa3b67abe68a5c4c4c46b848ea0b00b6');
assert.equal(native.source,'c'); assert.equal(native.version,5);
assert.equal(native.segments.length,13);
const tuple = s => ['name','seed','datetime','nethackrc','moves'].map(k=>[k,Object.hasOwn(s,k),s[k]]);
assert.deepEqual(native.segments.map(tuple),recipe.segments.map(tuple));
for (const part of native.segments) {
    assert.equal(part.steps.length,part.moves.length+1);
    for (const [i,step] of part.steps.entries()) {
        assert.equal(step.key,i===0?null:part.moves[i-1]);
        assert.equal(typeof step.screen,'string'); assert.ok(Array.isArray(step.rng));
        assert.ok(step.rng.every(v=>typeof v==='string'));
        if (step.animation_frames !== undefined) assert.ok(Array.isArray(step.animation_frames));
    }
}
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(recipe,native),[]);
assert.deepEqual({boundaries:native.segments.reduce((n,s)=>n+s.steps.length,0),
    rngCalls:native.segments.reduce((n,s)=>n+s.steps.reduce((m,t)=>m+t.rng.length,0),0),
    animationFrames:native.segments.reduce((n,s)=>n+s.steps.reduce((m,t)=>m+(t.animation_frames||[]).length,0),0)},
    {boundaries:1042,rngCalls:41015,animationFrames:93});
const reports = [], assertionSegments = [];
for (const part of recipe.segments) {
    const row = {name:part.name, checks:[]};
    const check = (name, fn) => {
        try { fn(); row.checks.push({name,pass:true}); }
        catch (error) { row.checks.push({name,pass:false,error:error.message.slice(0,1000)}); }
    };
    try {
        const plain = await runCase(part,'plain'), seen = await runCase(part,'observer');
        const hold = seen.states.find(s=>s.pending?.includes('deathly sick') || s.pending?.includes('tainted'))?.step ?? part.moves.length-1;
        const late = await runCase(part,'deferred',hold), v = plain.outputs, h = hashes(v);
        check('complete observer and deferred neutrality, stable exhausted input',()=>{
            assert.deepEqual(hashes(seen.outputs),h,'observer changed output');
            assert.deepEqual(hashes(late.outputs),h,'deferred input changed output');
            for (const key of ['screens','cursors','slices','frames']) assert.equal(v[key].length,part.moves.length+1);
            assert.deepEqual(v.slices.flat(),v.rng);
        });
        check('real producer, cure, expiry and shared-cause witnesses',()=>{
            row.witnesses = reach(part.name,seen.states,v);
        });
        if (Object.hasOwn(negatives,part.name)) check('unaffected negative retains all five sealed output hashes',()=>{
            assert.deepEqual(h,negatives[part.name]);
        });
        assertionSegments.push({steps:v.screens.map((screen,i)=>({screen,rng:v.slices[i]}))});
        Object.assign(row,{inputSha256:digest(part),hashes:h,boundaries:v.screens.length,
            rngCalls:v.rng.length,animationFrames:v.frames.flat().length,pending:late.pendingStates});
    } catch (error) {
        row.checks.push({name:'ordinary execution',pass:false,error:error.message.slice(0,1000)});
        assertionSegments.push({steps:[]});
    }
    row.pass = row.checks.every(c=>c.pass); reports.push(row);
}
const assertionErrors = branchAssertionErrors(recipe,{segments:assertionSegments});
const report = {kind:'ordinary JS witnesses and complete output neutrality',
    nativeSHA256,nativeIntegrityChecked:nativeSHA256!==null,nativeParityClaimed:false,
    total:reports.length,passed:reports.filter(r=>r.pass).length,assertionErrors,reports};
clearTimeout(deadline);
if (process.argv[2]) fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,nativeSHA256,assertionErrors}));
if (report.passed!==13 || assertionErrors.length) process.exitCode = 1;
