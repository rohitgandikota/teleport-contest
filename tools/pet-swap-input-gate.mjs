// Read-only observers on existing input boundaries. All game actions are keys.
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
import { FOUNTAIN } from '../js/const.js';
import { PMNAMES } from '../js/monst_data.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import { branchAssertionErrors } from './gen-sessions/assertions.mjs';

const output=run=>({screens:run.getScreens(),cursors:run.getCursors(),
    rng:[...run.getRngLog()],slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hashes=value=>Object.fromEntries(Object.entries(value).map(([key,v])=>[key,digest(v)]));
function snapshot(g,step) {
    const fountains=[];
    for(let x=1;x<80;x++)for(let y=0;y<21;y++)
        if(g.level.at(x,y).typ===FOUNTAIN) fountains.push({xy:[x,y],warned:!!(g.level.at(x,y).looted&2)});
    return {step,turn:g.moves,xy:[g.u.ux,g.u.uy],oldxy:[g.u.ux0,g.u.uy0],
        top:g._toplines,pending:g._pending_message,rngCount:getRngLog().length,
        monMoving:g.context.mon_moving||0,sad:!!g.iflags.sad_feeling,
        killer:g.u.uconduct?.killer||0,xp:g.u.uexp||0,anger:g.u.ugangr||0,
        alignment:{...g.u.ualign},fountains,
        monsters:g.level.monsters.filter(m=>m.mtame||m.mnum===PMNAMES.PM_GREMLIN
            ||[PMNAMES.PM_WATCHMAN,PMNAMES.PM_WATCH_CAPTAIN].includes(m.mnum))
            .map(m=>({id:m.m_id,mnum:m.mnum,xy:[m.mx,m.my],
            hp:m.mhp,hpmax:m.mhpmax,tame:m.mtame,peace:!!m.mpeaceful,
            cloned:!!m.mcloned,trapped:!!m.mtrapped,flee:!!m.mflee,
            watch:[PMNAMES.PM_WATCHMAN,PMNAMES.PM_WATCH_CAPTAIN].includes(m.mnum)}))};
}
async function delayed(input,hold,pendingStates) {
    const run=new NethackGame({...input,storage:new InMemoryStorage()}),display=new GameDisplay(null);
    const end=new Error('Input queue empty: bounded pet swap gate');let used=0,done=false;
    display.onEmptyQueue=async()=>{
        await setImmediate();
        if(used===hold) {
            const before=snapshot(game,used),rng=[...getRngLog()];
            await setImmediate();assert.equal(done,false);
            assert.deepEqual(snapshot(game,used),before);assert.deepEqual(getRngLog(),rng);
            pendingStates.push(before);
        }
        if(used===input.moves.length) {
            const before=snapshot(game,used),rng=[...getRngLog()];
            await setImmediate();assert.equal(done,false);
            assert.deepEqual(snapshot(game,used),before);assert.deepEqual(getRngLog(),rng);
            throw end;
        }
        return input.moves.charCodeAt(used++);
    };
    run._pendingDisplay=display;
    try {await run.start();for(let i=0;i<1024&&!game.program_state?.gameover;i++)await moveloop_core();}
    catch(e){if(e!==end)throw e;}
    done=true;assert.equal(used,input.moves.length);return run;
}
async function runCase(part,mode,hold=-1) {
    const input=Object.fromEntries(['seed','datetime','nethackrc','moves'].map(k=>[k,part[k]]));
    const states=[],pendingStates=[];
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
    try {
        if(mode==='observer')globalThis.__step_snapshot={step:'*',cb(g,s){states.push(snapshot(g,s));}};
        run=(mode==='deferred'||mode==='pending')?await delayed(input,hold,pendingStates)
            :await runSegment({...input,storage:new InMemoryStorage()});
    } finally {
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    return {outputs:output(run),states,pendingStates};
}
function checkReach(name,states,candidate) {
    const before=states.find(s=>s.top.includes('appears next to you.'));
    assert.ok(before,'ordinary monster creation must be observed');
    const pet=before.monsters.find(m=>m.tame),after=states.at(-1);
    assert.ok(pet);
    const refused=name==='gridbug-diagonal-negative';
    const during=states.find(s=>s.top.includes(refused?"can't move diagonally":'You swap places'));
    assert.ok(during,'movement must reach the claimed owner outcome');
    const displaced=during.monsters.find(m=>m.id===pet.id);
    assert.ok(displaced);
    assert.deepEqual(during.xy,refused?before.xy:pet.xy);
    assert.deepEqual(displaced.xy,refused?pet.xy:before.xy);
    const watch=s=>s.monsters.filter(m=>m.watch).map(m=>[m.id,m.peace]).sort((a,b)=>a[0]-b[0]);
    assert.equal(watch(before).length,5);assert.ok(watch(before).every(m=>m[1]));
    assert.deepEqual(watch(after),watch(before));
    for(const s of [during,after]) {
        assert.equal(s.killer,before.killer);assert.equal(s.xp,before.xp);
        assert.equal(s.anger,before.anger);assert.deepEqual(s.alignment,before.alignment);
        assert.equal(s.monMoving,0);assert.equal(s.sad,false);
    }
    if(name==='gremlin-fountain-swap'&&candidate) {
        assert.ok(before.fountains.some(f=>f.warned&&f.xy.every((v,i)=>v===before.xy[i])));
        assert.equal(displaced.hp,Math.ceil(pet.hp/2));
        const clones=after.monsters.filter(m=>m.mnum===pet.mnum);
        assert.equal(clones.length,2);assert.equal(new Set(clones.map(m=>m.id)).size,2);
        assert.ok(clones.some(m=>m.cloned));assert.equal(clones.reduce((n,m)=>n+m.hp,0),pet.hp);
        assert.ok(!after.fountains.some(f=>f.xy.every((v,i)=>v===before.xy[i])));
    } else if(name==='gremlin-fountain-swap') {
        assert.equal(displaced.hp,pet.hp,'baseline omits immediate liquid processing');
    } else {
        assert.equal(displaced.hp,pet.hp);assert.deepEqual(after.fountains,before.fountains);
        assert.equal(after.monsters.filter(m=>m.mnum===pet.mnum).length,1);
    }
    return {before,during,after};
}
{
    const inputPath=process.argv[2],reportPath=process.argv[3];
    assert.ok(inputPath,'usage: node tools/pet-swap-input-gate.mjs INPUT [REPORT]');
    const input=JSON.parse(fs.readFileSync(inputPath)),reports=[],assertionSegments=[];
    const candidate=process.env.PET_SWAP_VARIANT!=='baseline';
    const recipe=JSON.parse(fs.readFileSync(new URL('./gen-sessions/recipes/pet-swap-completion.json',import.meta.url)));
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    assert.equal(input.version,5);assert.equal(input.source,'c');
    assert.deepEqual(input.segments.map(s=>Object.fromEntries(
        ['name','seed','datetime','nethackrc','moves'].map(k=>[k,s[k]]))),recipe.segments);
    for(const [index,part]of input.segments.entries()) {
        if(part.steps?.length)assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves]);
        const plain=await runCase(part,'plain'),seen=await runCase(part,'observer');
        const hold=seen.states.find(s=>s.pending?.includes('swap places'))?.step??-1;
        const late=await runCase(part,'deferred',hold);
        const v=plain.outputs,h=hashes(v);
        assert.deepEqual(hashes(seen.outputs),h,'observer changed game output');
        assert.deepEqual(hashes(late.outputs),h,'deferred input changed game output');
        assert.equal(v.screens.length,part.moves.length+1);assert.equal(v.cursors.length,v.screens.length);
        assert.equal(v.frames.length,v.screens.length);assert.deepEqual(v.slices.flat(),v.rng);
        const messages=v.screens.map(s=>decodeScreen(s).map(r=>r.map(c=>c.ch).join('')).join('\n'));
        assertionSegments.push({steps:messages.map((screen,i)=>({screen,rng:v.slices[i]}))});
        const reach=checkReach(part.name,seen.states,candidate);
        reports.push({name:part.name,boundaries:v.screens.length,rngCalls:v.rng.length,
            animationFrames:v.frames.reduce((n,a)=>n+a.length,0),hashes:h,
            reach,held:late.pendingStates,messages:[...new Set(messages.map(s=>s.split('\n')[0].trim()))]
                .filter(s=>/swap places|multiplies|diagonally|dries up|guilty|level [0-9]|trickle/.test(s))});
    }
    const assertionErrors=branchAssertionErrors(recipe,{segments:assertionSegments});
    if(candidate)assert.deepEqual(assertionErrors,[],'ordinary JS branch assertions');
    const result={status:'JS_REACH_AND_OUTPUT_NEUTRALITY_ONLY',variant:candidate?'candidate':'baseline',
        nativeRecorded:false,assertionErrors,reports};
    if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({status:result.status,cases:reports.length}));
}
