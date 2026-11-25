// Ordinary keyboard reach and scheduling checks, no native comparison.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {runSegment,NethackGame} from '../js/jsmain.js';
import {GameDisplay} from '../js/game_display.js';
import {moveloop_core} from '../js/allmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {ONAMES as O} from '../js/objects_data.js';
import {MIGR_STAIRS_UP,OBJ_FLOOR} from '../js/const.js';
const root=new URL('../',import.meta.url);
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'),'optional compact output path only');
const sha=value=>createHash('sha256').update(value).digest('hex');
const {branchAssertionErrors,recordingIntegrityErrors}=await import(new URL('tools/gen-sessions/assertions.mjs',root));
const originalBytes=fs.readFileSync(new URL('tools/gen-sessions/evidence/deliver-object-owner/recording-recipe.json',root));
assert.equal(sha(originalBytes),'b0900fa34686550f62599a47c5c8d08851c14de2f07f07725530931ca80ce066');
const original=JSON.parse(originalBytes);
const lockBytes=fs.readFileSync(new URL('tools/gen-sessions/evidence/deliver-object-owner/input-lock.json',root));
assert.equal(sha(lockBytes),'c9fe2a161430e8b79e2de2ce7a7bc74811ca1b586f66a21367137522a3882b43');
const lock=JSON.parse(lockBytes);
const bytes=fs.readFileSync(new URL('tools/gen-sessions/recipes/deliver-object-owner.json',root));
assert.equal(sha(bytes),'2267069f9bbba2992c79cfb81736fe7eb99c0bcd5a7034a46ac33049dc7804f2');
const input=JSON.parse(bytes),fields=['name','seed','datetime','nethackrc','moves'];
for(const key of Object.keys(original))assert.deepEqual(input[key],original[key],`original recipe field ${key}`);
assert.equal(input.name,'deliver-object-owner');assert.deepEqual(input.coverage,[]);
assert.deepEqual(input.segments.map(s=>s.name),['stairs-dagger-arrival','stairs-stack-arrival','stairs-potion','dry-potion']);
assert.equal(input.requireBranchAssertions,true);assert.equal(input.branches.length,4);assert.equal(input.branchAssertions.length,4);
assert.deepEqual(input.branches,input.segments.map(s=>'deliver-object-owner.'+s.name));
assert.deepEqual(branchAssertionErrors(input),[]);
const tuples=input.segments.map(s=>fields.map(k=>{assert.ok(Object.hasOwn(s,k));return s[k];}));
assert.equal(sha(JSON.stringify(tuples)),'16d96f9ccc426fed46601076d2e4c6c3416b40ad283ad94e93659150f15ed976');
assert.equal(lock.tupleSHA256,sha(JSON.stringify(tuples)));assert.equal(lock.recipeSHA256,sha(originalBytes));
assert.deepEqual(input.negativeHashes,lock.negativeHashes);assert.equal(Object.keys(lock.negativeHashes).length,2);
// Mandatory C5 destination-regression lock, not species flag ordinary causality.
const nativeBytes=fs.readFileSync(new URL('tools/gen-sessions/generated/deliver-object-owner.session.json',root));
assert.equal(sha(nativeBytes),'1ba082a2d26b3b1460abd1e8150b2616ab51c5b9c31aafaf6e1b2e964aac7265','locked canonical C raw');
assert.equal(nativeBytes.length,910014);
const native=JSON.parse(nativeBytes);assert.equal(native.source,'c');assert.equal(native.version,5);
assert.equal(native.segments.length,4);assert.equal(input.segments.length,4);
assert.deepEqual(recordingIntegrityErrors(native),[]);assert.deepEqual(branchAssertionErrors(input,native),[]);
for(let i=0;i<4;i++){
    const actual=native.segments[i],expected=input.segments[i];
    for(const field of fields){
        assert.ok(Object.hasOwn(expected,field),`recipe input presence ${i} ${field}`);
        assert.equal(Object.hasOwn(actual,field),Object.hasOwn(expected,field),`C input presence ${i} ${field}`);
        assert.deepEqual(actual[field],expected[field],`C input value ${i} ${field}`);
    }
    assert.deepEqual(actual.steps.map(s=>s.key),[null,...expected.moves],`every supplied key ${i}`);
}
assert.equal(input.segments.reduce((n,s)=>n+s.moves.length,0),416);
assert.equal(native.segments.reduce((n,s)=>n+s.steps.length,0),420);
const collect=r=>({screens:r.getScreens(),cursors:r.getCursors(),rng:[...r.getRngLog()],slices:r.getRngSlices(),frames:r.getAnimationFramesByStep()});
const hashes=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,sha(JSON.stringify(v))]));
async function deferred(part){
    const r=new NethackGame({...part,storage:new InMemoryStorage()}),d=new GameDisplay(null),end=new Error('supplied keys ended');
    let used=0,signalEnd,release,timer,settled=false;
    const atEnd=new Promise(resolve=>{signalEnd=resolve;});
    d.onEmptyQueue=async()=>{await setImmediate();if(used===part.moves.length){signalEnd();return new Promise((_,reject)=>{release=()=>reject(end);});}return part.moves.charCodeAt(used++);};r._pendingDisplay=d;
    const work=(async()=>{try{await r.start();for(let i=0;i<2048&&!game.program_state?.gameover;i++)await moveloop_core();}catch(e){if(e!==end)throw e;}finally{settled=true;}})();
    try{await Promise.race([atEnd,work.then(()=>{throw Error('ended before final blocked read');}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('EOF timeout')),3000);})]);await setImmediate();assert.equal(settled,false);}
    finally{clearTimeout(timer);release?.();await work;}
    assert.equal(used,part.moves.length);return r;
}
const reports=[],deadline=setTimeout(()=>process.exit(2),30000);
for(const part of input.segments){
    const states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let out;
    const object=o=>({id:o.o_id,type:o.otyp,quantity:o.quan,x:o.ox,y:o.oy,where:o.where,mask:o.owornmask,from:[o.omigr_from_dnum??null,o.omigr_from_dlevel??null]});
    try{globalThis.__step_snapshot={step:'*',cb(g,step){states.push({step,x:g.u.ux,y:g.u.uy,level:{...g.u.uz},text:g._toplines||'',hp:g.u.uhp,
        inventory:g.invent.map(object),floor:g.level.objects.filter(o=>o.otyp===O.DAGGER||o.otyp===O.POT_WATER).map(object),
        migrating:(g.migrating_objs||[]).map(object),impossible:g.program_state.in_impossible||0,over:!!g.program_state.gameover});}};
        out=collect(await runSegment({...part,storage:new InMemoryStorage()}));
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const before=states.find(v=>v.migrating.some(o=>o.type===O.DAGGER));
    const r={name:part.name,keys:part.moves.length,boundaries:out.screens.length,hashes:hashes(out),plain:hashes(collect(await runSegment({...part,storage:new InMemoryStorage()}))),deferred:hashes(collect(await deferred(part))),before:before||null,last:states.at(-1),checks:[]};
    const check=(name,fn)=>{try{fn();r.checks.push({name,pass:true});}catch(e){r.checks.push({name,pass:false,error:e.message.slice(0,800)});process.exitCode=1;}};
    check('all five outputs agree through final blocked EOF',()=>{assert.deepEqual(r.hashes,r.plain);assert.deepEqual(r.hashes,r.deferred);for(const k of ['screens','cursors','slices','frames'])assert.equal(out[k].length,part.moves.length+1);assert.deepEqual(out.slices.flat(),out.rng);});
    check('actual shipping and arrival or retained negative',()=>{
        assert.ok(states.every(v=>!v.over&&v.hp>0&&!v.impossible));const s=r.last;assert.equal(s.inventory.length,0);
        if(part.name.endsWith('-arrival')){
            assert.ok(before,'normal command produced migration');const o=before.migrating.find(o=>o.type===O.DAGGER);
            assert.equal(o.mask,MIGR_STAIRS_UP);assert.deepEqual([o.x,o.y],[0,2]);assert.deepEqual(o.from,[0,1]);
            assert.ok(states.some(v=>/fall(?:s)? down the stairs/.test(v.text)));assert.deepEqual(s.level,{dnum:0,dlevel:2});
            const landed=s.floor.find(v=>v.id===o.id);assert.ok(landed,'same queued object arrived on destination floor');assert.equal(landed.where,OBJ_FLOOR);assert.equal(landed.mask,0);assert.deepEqual(landed.from,[0,0]);
            assert.deepEqual([landed.x,landed.y],[s.x,s.y]);assert.equal(landed.quantity,part.name==='stairs-stack-arrival'?3:1);assert.equal(s.migrating.length,0);
        }else{
            assert.equal(s.level.dlevel,1);assert.equal(s.migrating.length,0);assert.ok(s.floor.some(o=>o.type===O.POT_WATER&&o.x===s.x&&o.y===s.y));
            assert.deepEqual(r.hashes,lock.negativeHashes[part.name]);
        }
    });
    check('all supplied keys have consecutive boundaries',()=>{assert.equal(states.at(-1).step,part.moves.length);assert.deepEqual(states.map(s=>s.step),Array.from({length:part.moves.length+1},(_,i)=>i));});
    reports.push(r);
}
clearTimeout(deadline);
const report={evidence:'JS-only keyboard reach and scheduling equality; no native comparison',recipeSHA256:lock.recipeSHA256,passed:reports.flatMap(r=>r.checks).filter(c=>c.pass).length,total:12,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total,failures:reports.flatMap(r=>r.checks.filter(c=>!c.pass).map(c=>({case:r.name,...c})))}));
