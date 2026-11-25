// Constructed canonical-interface controls. No ordinary gameplay claim.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setup,seed,x,y} from './status-followup-test-setup.mjs';
import {game as g} from '../js/gstate.js';
import * as C from '../js/const.js';
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as P,MFLAGS} from '../js/monst_data.js';
import {makemon,deliver_obj_to_mon,DF_NONE,DF_RANDOM,DF_ALL} from '../js/makemon.js';
import {mksobj,add_to_migration} from '../js/mkobj.js';
import {rnd,getRngLog} from '../js/rng.js';

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
const results=[],deadline=setTimeout(()=>process.exit(2),30000);
async function check(name,fn){const r={name};try{await setup();g.migrating_objs=[];await fn(r);r.pass=true;}
    catch(e){r.pass=false;r.error=e.message.slice(0,700);}results.push(r);}
function monster(inventory=false){const m=makemon(g.mons[P.PM_ORC],x+2,y,
    C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG|(inventory?0:C.NO_MINVENT));assert.ok(m);return m;}
function queue(type,species=MFLAGS.M2_ORC,mode=C.MIGR_TO_SPECIES){const o=mksobj(type,false,false);
    add_to_migration(o);o.owornmask=mode;o.migr_species=species;return o;}
function queueSet(){
    const a=queue(O.DAGGER),foreign=queue(O.DAGGER,MFLAGS.M2_HUMAN),b=queue(O.SKELETON_KEY),
        ordinary=queue(O.DAGGER,MFLAGS.M2_ORC,C.MIGR_STAIRS_UP),c=queue(O.TALLOW_CANDLE),
        untargeted=queue(O.DAGGER,C.NON_PM),d=queue(O.FOOD_RATION);
    return {targets:[d,c,b,a],pending:[...g.migrating_objs],skipped:[foreign,ordinary,untargeted]};
}
function verify(r,m,items,count){const delivered=items.targets.slice(0,count),remaining=items.pending.filter(o=>!delivered.includes(o));
    r.outcome={delivered:m.minvent.map(o=>o.o_id),remaining:g.migrating_objs.map(o=>o.o_id),rng:[...getRngLog()]};
    assert.equal(m.minvent.length,count);assert.deepEqual(new Set(m.minvent),new Set(delivered));assert.deepEqual(g.migrating_objs,remaining);
    for(const o of delivered){assert.equal(o.where,C.OBJ_MINVENT);assert.equal(o.ocarry,m);assert.equal(o.owornmask,0);
        assert.equal(o.migr_species,C.NON_PM);assert.deepEqual([o.ox,o.oy,o.omigr_from_dnum,o.omigr_from_dlevel],[0,0,0,0]);}
    for(const o of remaining)assert.equal(o.where,C.OBJ_MIGRATING);
}
await check('canonical definitions and compatibility exports agree',async r=>{r.values={canonical:[C.DF_NONE,C.DF_RANDOM,C.DF_ALL],exports:[DF_NONE,DF_RANDOM,DF_ALL]};
    assert.deepEqual(r.values.canonical,[0,1,4]);assert.deepEqual(r.values.exports,[0,1,4]);});

// C dokick.c1860-1866: RANDOM for cnt>1 precedes ALL, then default one.
// Bit2 has no C meaning. The explicit table avoids deriving expectations
// from the JS consumer's own exported values or its selection expression.
const requested=[0,1,4];
const counts={0:[1,1,1],1:[1,1,'random'],2:[1,1,1],3:[1,1,'random'],
    4:[4,4,4],5:[4,4,'random'],6:[4,4,4],7:[4,4,'random']};
for(const flag of [0,1,2,3,4,5,6,7])for(let i=0;i<requested.length;i++)
    await check(`canonical flags ${flag} requested ${requested[i]}`,async r=>{
        const m=monster(),items=queueSet();let count=counts[flag][i],expectedRng=[];
        if(count==='random'){
            for(let s=1;s<=128;s++){seed(s);const value=rnd(4);if(value===2){r.seed=s;count=value;expectedRng=[...getRngLog()];break;}}
            assert.equal(count,2,'bounded actual RNG witness for partial delivery');seed(r.seed);
        }else seed(2);
        r.expectedCount=count;deliver_obj_to_mon(m,requested[i],flag);verify(r,m,items,count);
        assert.deepEqual(getRngLog(),expectedRng);
    });
await check('omitted flag keeps the existing default one-item contract',async r=>{const m=monster(),items=queueSet();seed(2);
    deliver_obj_to_mon(m,4);verify(r,m,items,1);assert.deepEqual(getRngLog(),[]);});
await check('actual mon_arrive import still delivers all',async r=>{const m=monster(),items=queueSet();seed(2);
    r.importedFlag=DF_ALL;deliver_obj_to_mon(m,0,DF_ALL);verify(r,m,items,4);assert.deepEqual(getRngLog(),[]);});
await check('actual makemon caller still delivers exactly one',async r=>{const items=queueSet();seed(2);const m=monster(true);
    const received=items.targets.filter(o=>o.ocarry===m);r.outcome={received:received.map(o=>o.o_id),remaining:g.migrating_objs.map(o=>o.o_id),rng:[...getRngLog()]};
    assert.deepEqual(received,[items.targets[0]]);assert.deepEqual(g.migrating_objs,items.pending.filter(o=>o!==received[0]));});
await check('empty all-delivery queue consumes no RNG',async r=>{const m=monster();seed(2);deliver_obj_to_mon(m,0,4);
    r.outcome={inventory:(m.minvent||[]).length,rng:[...getRngLog()]};assert.equal((m.minvent||[]).length,0);assert.deepEqual(getRngLog(),[]);});
await check('empty random queue still spends its selection draw',async r=>{const m=monster();seed(2);rnd(4);const expected=[...getRngLog()];seed(2);
    deliver_obj_to_mon(m,4,5);r.outcome={inventory:(m.minvent||[]).length,rng:[...getRngLog()]};assert.equal((m.minvent||[]).length,0);assert.deepEqual(getRngLog(),expected);});
await check('all-delivery leaves mismatching species queued',async r=>{const m=monster(),o=queue(O.DAGGER,MFLAGS.M2_HUMAN);seed(2);deliver_obj_to_mon(m,0,4);
    r.outcome={inventory:(m.minvent||[]).length,remaining:g.migrating_objs.map(v=>v.o_id),rng:[...getRngLog()]};assert.equal((m.minvent||[]).length,0);assert.deepEqual(g.migrating_objs,[o]);assert.deepEqual(getRngLog(),[]);});
clearTimeout(deadline);
const report={evidence:'Constructed canonical-interface parity; no ordinary gameplay improvement claimed',passed:results.filter(r=>r.pass).length,total:results.length,results};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total,failures:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error}))}));
if(report.passed!==report.total)process.exitCode=1;
