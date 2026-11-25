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
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';
import { STONED } from '../js/const.js';


assert.ok(process.argv.length <= 3 && !process.argv[2]?.startsWith('--'),
    'Usage: node tools/death-cause-input-gate.mjs [compact-report.json]');
const deadline = setTimeout(() => { console.error('death cause input gate exceeded 55 seconds'); process.exit(1); }, 55000);
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
        hp:g.u.uhp, level:g.u.ulevel, amulet:g.u.uamul?.otyp??null, lifesaved:g.u.uprops?.LIFESAVED||0,
        causes, killer:{format:g.killer?.format, name:g.killer?.name},
        legacy:!!g.delayed_killer, top:g._toplines, pending:g._pending_message,
        rngCount:getRngLog().length};
}
async function deferred(input, hold, pendingStates) {
    const run = new NethackGame({...input, storage:new InMemoryStorage()});
    const display = new GameDisplay(null), end = new Error('Input queue empty: bounded death cause gate');
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
const recipe=JSON.parse(fs.readFileSync(new URL('./gen-sessions/recipes/immediate-death-cause-contract.json',import.meta.url)));
assert.equal(recipe.segments.length,8);assert.deepEqual(branchAssertionErrors(recipe),[]);
// The promoted native fixture is mandatory. It is never substituted by proposals.
const nativeBytes=fs.readFileSync(new URL('./gen-sessions/generated/immediate-death-cause-contract.session.json',import.meta.url));
const native=JSON.parse(nativeBytes),nativeSHA256=createHash('sha256').update(nativeBytes).digest('hex');
assert.equal(native.source,'c');assert.equal(native.version,5);assert.equal(native.segments.length,8);
const tuple=s=>['name','seed','datetime','nethackrc','moves'].map(k=>[k,Object.hasOwn(s,k),s[k]]);
assert.deepEqual(native.segments.map(tuple),recipe.segments.map(tuple));
for(const part of native.segments){
    assert.equal(part.steps.length,part.moves.length+1);
    for(const [i,step] of part.steps.entries()){
        assert.equal(step.key,i===0?null:part.moves[i-1]);
        assert.equal(typeof step.screen,'string');assert.ok(Array.isArray(step.rng));
        assert.ok(step.rng.every(s=>typeof s==='string'));
        if(step.animation_frames!==undefined)assert.ok(Array.isArray(step.animation_frames));
    }
}
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(recipe,native),[]);
assert.deepEqual({boundaries:native.segments.reduce((n,s)=>n+s.steps.length,0),
    rngCalls:native.segments.reduce((n,s)=>n+s.steps.reduce((m,t)=>m+t.rng.length,0),0),
    animationFrames:native.segments.reduce((n,s)=>n+s.steps.reduce((m,t)=>m+(t.animation_frames||[]).length,0),0)},
    {boundaries:533,rngCalls:18651,animationFrames:0});
assert.deepEqual(Object.keys(recipe.unchangedOutputHashes).sort(),[
    'hp-healthy-negative','hp-nonfatal-negative','xp-healthy-negative','xp-nonfatal-negative']);
const reports=[], assertionSegments=[];
const cause=s=>s.causes.find(k=>k.id===STONED)?.name??null;
for(const part of recipe.segments){
    const row={name:part.name,checks:[]};
    const check=(name,fn)=>{try{fn();row.checks.push({name,pass:true});}catch(e){row.checks.push({name,pass:false,error:e.message.slice(0,800)});}};
    try{
        const plain=await runCase(part,'plain'),seen=await runCase(part,'observer');
        const late=await runCase(part,'deferred',seen.states.find(s=>s.mortality===1)?.step??part.moves.length-1);
        const v=plain.outputs,h=hashes(v),states=seen.states,last=states.at(-1);
        check('plain observer and deferred complete equality',()=>{
            assert.deepEqual(hashes(seen.outputs),h);assert.deepEqual(hashes(late.outputs),h);
            for(const k of ['screens','cursors','frames','slices'])assert.equal(v[k].length,part.moves.length+1);
            assert.deepEqual(v.slices.flat(),v.rng);
        });
        assertionSegments.push({steps:v.screens.map((screen,i)=>({screen,rng:v.slices[i]}))});
        if(Object.hasOwn(recipe.unchangedOutputHashes,part.name))check('unaffected negative preserves all five sealed hashes',()=>{
            assert.deepEqual(h,recipe.unchangedOutputHashes[part.name]);
        });
        const witnesses=[];
        check('actual producer and life saving reach',()=>{
            if(part.name.includes('-egg-')){
                const before=states.find(s=>s.stoned>0&&s.mortality===0&&cause(s)==='cockatrice egg');
                const saved=states.find(s=>s.mortality===1&&s.hp>0&&!s.amulet&&!s.lifesaved&&s.stoned>0);
                assert.ok(before);assert.ok(saved);assert.equal(cause(saved),'cockatrice egg');
                assert.ok(states.some(s=>s.pending?.includes('medallion crumbles')));
                assert.ok(!states.some(s=>s.pending?.includes("don't die")));
                witnesses.push(before,saved);
                if(part.name.endsWith('-expiry')){
                    const expired=states.find(s=>s.mortality===2&&s.killer.name==='cockatrice egg');
                    assert.ok(expired);assert.equal(cause(expired),null);witnesses.push(expired);
                    assert.ok(v.screens.some(s=>s.includes('petrified by a')));
                    assert.ok(v.screens.at(-1).includes('cockatrice egg'));
                }else{
                    assert.equal(last.stoned,0);assert.equal(cause(last),null);assert.equal(last.mortality,1);assert.ok(last.hp>0);
                    assert.ok(states.some(s=>s.top.includes('limber')));
                }
            }else if(part.name.includes('-healthy-')){
                assert.ok(states.every(s=>!s.stoned&&!cause(s)));assert.equal(last.mortality,1);assert.ok(last.hp>0);
                assert.equal(last.amulet,null);assert.equal(last.lifesaved,0);
                assert.ok(states.some(s=>s.pending?.includes('medallion crumbles')));
                assert.ok(!states.some(s=>s.pending?.includes("don't die")));
            }else{
                assert.equal(last.mortality,0);assert.ok(last.hp>0);assert.ok(states.every(s=>!s.stoned&&!cause(s)));
                if(part.name.startsWith('xp'))assert.equal(last.level,1);
                else {assert.equal(last.level,30);assert.ok(states.some(s=>s.top.includes('You imitate a popsicle!')));}
            }
        });
        Object.assign(row,{hashes:h,boundaries:v.screens.length,rngCalls:v.rng.length,animationFrames:v.frames.flat().length,
            witnesses:[...witnesses,last],pending:late.pendingStates,top:last.top});
    }catch(e){row.checks.push({name:'execution',pass:false,error:e.message.slice(0,1000)});}
    row.pass=row.checks.every(s=>s.pass);reports.push(row);
}
clearTimeout(deadline);
const assertionErrors=branchAssertionErrors(recipe,{segments:assertionSegments});
const report={assertionErrors,total:reports.length,passed:reports.filter(s=>s.pass).length,nativeSHA256,nativeIntegrityChecked:true,nativeParityClaimed:false,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:reports.filter(s=>!s.pass).map(s=>({name:s.name,checks:s.checks.filter(c=>!c.pass)}))}));
if(report.passed!==report.total||assertionErrors.length)process.exitCode=1;
