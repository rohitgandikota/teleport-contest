// Normal imports. Each run is isolated because baseline dipfountain can
// mutate the process-global hands object. Child workers run serially.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { NethackGame, runSegment } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { moveloop_core } from '../js/allmain.js';
import { Blind, Hallucination } from '../js/youprop.js';
import { hands_obj } from '../js/invent.js';
import { getRngLog } from '../js/rng.js';
import { branchAssertionErrors } from './gen-sessions/assertions.mjs';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import { CQ_CANNED, CQ_REPEAT, FOUNTAIN, ROOM } from '../js/const.js';
import { PMNAMES } from '../js/monst_data.js';

const recipePath=new URL('gen-sessions/recipes/dipfountain-owner.json',import.meta.url);
const recipe=JSON.parse(fs.readFileSync(recipePath));
const hashes=v=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,createHash('sha256').update(JSON.stringify(x)).digest('hex')]));
const collect=run=>({screens:run.getScreens(),cursors:run.getCursors(),rng:[...run.getRngLog()],slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
function snapshot(g,step){return {step,turn:g.moves,top:g._toplines,pending:g._pending_message,blind:Blind(),hallu:Hallucination(),form:g.u.umonnum,
    terrain:g.level.at(g.u.ux,g.u.uy).typ,handsCursed:!!hands_obj.cursed,rngCount:getRngLog().length,
    inventory:(g.invent||[]).map(o=>({type:o.otyp,cursed:!!o.cursed,id:o.o_id})),
    queues:[CQ_CANNED,CQ_REPEAT].map(q=>(g.command_queue?.[q]||[]).map(e=>({typ:e.typ,key:e.key,command:e.ec_entry?.ef_txt})))};}
async function delayed(part){
    const run=new NethackGame({...part,storage:new InMemoryStorage()}),display=new GameDisplay(null);
    const end=new Error('Input queue empty: bounded dipfountain audit');let used=0;
    display.onEmptyQueue=async()=>{await setImmediate();if(used===part.moves.length)throw end;return part.moves.charCodeAt(used++);};
    run._pendingDisplay=display;
    try{await run.start();for(let i=0;i<1024&&!game.program_state?.gameover;i++)await moveloop_core();}
    catch(e){if(e!==end)throw e;}
    assert.equal(used,part.moves.length);return run;
}
if(process.argv[2]==='--worker'){
    const part=JSON.parse(fs.readFileSync(process.argv[3])).segments[Number(process.argv[4])],mode=process.argv[5],states=[];
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
    try{
        if(mode==='observer')globalThis.__step_snapshot={step:'*',cb(g,step){states.push(snapshot(g,step));}};
        run=mode==='deferred'?await delayed(part):await runSegment({...part,storage:new InMemoryStorage()});
    }finally{if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);else delete globalThis.__step_snapshot;}
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    console.log('__DIP_OUTPUT__'+JSON.stringify({outputs:collect(run),states}));
}else{
    const inputPath=process.argv[2]||recipePath,bytes=fs.readFileSync(inputPath),input=JSON.parse(bytes),output=process.argv[3];
    const actualPath=inputPath instanceof URL?inputPath.pathname:inputPath;
    const reports=[],values=[],recorded=[];assert.equal(input.segments.length,recipe.segments.length);
    function worker(index,mode){
        const child=spawnSync(process.execPath,[process.argv[1],'--worker',actualPath,String(index),mode],{encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024});
        assert.equal(child.status,0,child.stderr||child.error?.message||child.stdout);
        const marker=child.stdout.lastIndexOf('__DIP_OUTPUT__');assert.ok(marker>=0);return JSON.parse(child.stdout.slice(marker+14));
    }
    for(const [index,part]of input.segments.entries()){
        for(const field of ['name','seed','datetime','nethackrc','moves']){
            assert.equal(Object.hasOwn(part,field),Object.hasOwn(recipe.segments[index],field));assert.deepEqual(part[field],recipe.segments[index][field]);
        }
        if(part.steps?.length){assert.equal(input.version,5);assert.equal(input.source,'c');assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves]);}
        const seen=worker(index,'observer'),plain=worker(index,'plain'),late=worker(index,'deferred');
        const v=plain.outputs,states=seen.states,final=states.at(-1),text=v.screens.map(s=>decodeScreen(s).map(r=>r.map(c=>c.ch).join('')).join('\n'));
        assert.deepEqual(hashes(seen.outputs),hashes(v),'observer neutrality');assert.deepEqual(hashes(late.outputs),hashes(v),'deferred neutrality');
        assert.deepEqual(v.slices.flat(),v.rng);assert.equal(v.screens.length,part.moves.length+1);
        assert.equal(v.cursors.length,v.screens.length);assert.equal(v.frames.length,v.screens.length);
        reports.push({index,name:part.name,boundaries:v.screens.length,calls:v.rng.length,frames:v.frames.flat().length,hashes:hashes(v),observerHashes:hashes(seen.outputs),deferredHashes:hashes(late.outputs),states});values.push(v);
        recorded.push({steps:v.screens.map((screen,i)=>({screen,rng:v.slices[i]}))});
        const has=s=>text.some(t=>t.includes(s));
        await test(part.name+': actual input branch and final state',()=>{
            const dipBoundary=part.moves.indexOf('#dip\n')+5+2;
            const ownerCalls=v.slices.slice(dipBoundary).flat();
            if(index===0||index===5){assert.equal(final.hallu,index===0);assert.ok(states.some(s=>s.inventory.some(o=>o.cursed)));assert.ok(final.inventory.every(o=>!o.cursed));assert.ok(ownerCalls.includes('rnd(30)=19'));assert.ok(has(index===0?'The ink glows for a moment.':'The water glows for a moment.'));}
            else if(index===1){assert.equal(final.form,PMNAMES.PM_DOG);assert.ok(ownerCalls.includes('rnd(30)=26'));assert.ok(has('your foreleg.'));}
            else if(index===2){assert.ok(final.blind);assert.equal(final.terrain,ROOM);assert.ok(has('Dry up fountain?'));assert.ok(!has('The fountain dries up!'));}
            else if(index===3){assert.ok(ownerCalls.includes('rnd(30)=16'));assert.equal(final.handsCursed,false);assert.equal(final.terrain,FOUNTAIN);}
            else if(index===4){assert.ok(part.moves.endsWith('\x01'));assert.equal(final.turn,3);assert.equal(text.filter(t=>t.startsWith('Dip a')).length,1);assert.equal(final.queues[CQ_REPEAT].at(-1)?.key,'n');}
            else if(index===6){assert.ok(ownerCalls.includes('rnd(30)=26'));assert.ok(has('your arm.'));}
            else if(index===7){assert.ok(ownerCalls.includes('rnd(30)=18'));assert.equal(final.handsCursed,false);assert.ok(has('A feeling of loss'));}
            else if(index===8){assert.equal(final.terrain,ROOM);assert.ok(!final.blind);assert.ok(has('The fountain dries up!'));}
            else{assert.ok(has('Never mind.'));assert.equal(final.turn,1);assert.equal(final.terrain,FOUNTAIN);assert.ok(final.inventory[0].cursed);}
        });
    }
    const errors=branchAssertionErrors(recipe,{segments:recorded});const native=input.segments.every(p=>p.steps?.length);
    const nativeErrors=native?branchAssertionErrors(recipe,input):null;
    await test('all canonical recipe branch assertions',()=>{assert.deepEqual(errors,[]);if(native)assert.deepEqual(nativeErrors,[]);});
    const report={evidence:'JS keys, source state, observer/deferred comparisons. This gate does not claim full native parity.',inputSHA256:createHash('sha256').update(bytes).digest('hex'),reports,boundaries:reports.reduce((s,r)=>s+r.boundaries,0),calls:reports.reduce((s,r)=>s+r.calls,0),frames:reports.reduce((s,r)=>s+r.frames,0),observerPairs:reports.length*5,deferredPairs:reports.length*5,recipeAssertions:{count:recipe.branchAssertions.length,jsErrors:errors,nativeChecked:native,nativeErrors}};
    if(output){fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');fs.writeFileSync(output.replace(/\.json$/,'.outputs.json'),JSON.stringify(values)+'\n');}
    console.log(`Verified ${report.boundaries} boundaries, ${report.calls} calls, ${report.frames} frames; ${report.observerPairs} observer and deferred hashes each.`);
}
