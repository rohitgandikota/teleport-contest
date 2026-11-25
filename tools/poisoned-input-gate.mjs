// Ordinary keys only; observations copy state and never alter runtime behavior.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {NethackGame,runSegment} from '../js/jsmain.js';
import {GameDisplay} from '../js/game_display.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {moveloop_core} from '../js/allmain.js';
import {getRngLog} from '../js/rng.js';
import {Half_gas_damage,Poison_resistance} from '../js/youprop.js';
import {STONED,W_AMUL} from '../js/const.js';
import {ONAMES as O} from '../js/objects_data.js';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const deadline=setTimeout(()=>{console.error('55 second poisoned input limit');process.exit(1);},55000);deadline.unref();
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const hashes=v=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,digest(x)]));
const output=r=>({screens:r.getScreens(),cursors:r.getCursors(),rng:[...r.getRngLog()],slices:r.getRngSlices(),frames:r.getAnimationFramesByStep()});
function snapshot(g,step){const causes=[];for(let k=g.killer?.next;k;k=k.next){assert.ok(causes.length<16);causes.push({id:k.id,name:k.name,format:k.format});}
 return {step,turn:g.moves,hp:g.u.uhp,hpmax:g.u.uhpmax,mh:g.u.mh,mhmax:g.u.mhmax,attrs:g.u.acurr?.a?.slice(),poly:g.u.umonnum!==g.u.umonster,
 mort:g.u.umortality||0,stone:g.u.uprops?.STONED||0,causes,killer:{format:g.killer?.format,name:g.killer?.name},
 food:g.u.uconduct?.food||0,luck:g.u.uluck,moreluck:g.u.moreluck,halfGas:Half_gas_damage(),res:Poison_resistance(),
 intrinsicRes:g.u.intrinsic?.HPoison_resistance||0,extrinsicRes:g.u.uprops?.POISON_RES||0,amul:g.u.uamul?.otyp??null,lifesaved:g.u.uprops?.LIFESAVED||0,
 towels:(g.invent||[]).filter(o=>o.otyp===O.TOWEL).map(o=>({spe:o.spe,worn:o.owornmask||0})),
 rngCount:getRngLog().length,top:g._toplines,pending:g._pending_message};}
async function deferred(input,hold,pending){const run=new NethackGame({...input,storage:new InMemoryStorage()}),display=new GameDisplay(null),end=new Error('Input queue empty: bounded poisoned gate');
 let used=0,complete=false;display.onEmptyQueue=async()=>{await setImmediate();if(used===hold||used===input.moves.length){
 const before=snapshot(game,used),rng=[...getRngLog()];await setImmediate();assert.equal(complete,false);assert.deepEqual(snapshot(game,used),before);assert.deepEqual(getRngLog(),rng);pending.push(before);}
 if(used===input.moves.length)throw end;return input.moves.charCodeAt(used++);};run._pendingDisplay=display;
 try{await run.start();for(let i=0;i<2048&&!game.program_state?.gameover;i++)await moveloop_core();}catch(e){if(e!==end)throw e;}
 complete=true;assert.equal(used,input.moves.length);assert.ok(pending.some(s=>s.step===input.moves.length),'exhausted input must stay pending');return run;}
async function runCase(part,mode,hold=-1){const input=Object.fromEntries(['seed','datetime','nethackrc','moves'].map(k=>[k,part[k]]));const states=[],pending=[];
 const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
 try{if(mode==='observer')globalThis.__step_snapshot={step:'*',cb(g,s){states.push(snapshot(g,s));}};
 run=mode==='deferred'?await deferred(input,hold,pending):await runSegment({...input,storage:new InMemoryStorage()});
 }finally{if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);else delete globalThis.__step_snapshot;}
 assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);return {outputs:output(run),states,pending};}
const recipeBytes=fs.readFileSync(new URL('./gen-sessions/recipes/poisoned-owner-contract.json',import.meta.url));
const recipe=JSON.parse(recipeBytes);
assert.equal(recipe.segments.length,10);assert.deepEqual(branchAssertionErrors(recipe),[]);
assert.deepEqual(Object.keys(recipe.unchangedOutputHashes).sort(),[
 'amulet-resistance-negative','carried-gas-attribute-negative','natural-bite-negative',
 'needle-attribute-negative','needle-hp-negative']);

// Require the unchanged C recording before running any ordinary input.
assert.equal(createHash('sha256').update(recipeBytes).digest('hex'),
 '3cf351cfd1c0f14cb1dab57b622848518aa12045223e00a659b1bb165ce7c93c', 'sealed recipe SHA256');
const nativeBytes=fs.readFileSync(new URL('./gen-sessions/generated/poisoned-owner-contract.session.json',import.meta.url));
const nativeSHA256=createHash('sha256').update(nativeBytes).digest('hex');
assert.equal(nativeSHA256,'88d199c4dfe6dd82c286d64d4b52a4450a219ce75608528e4c89a424ff2eebf2', 'canonical native SHA256');
const native=JSON.parse(nativeBytes);
assert.equal(native.source,'c');
assert.equal(native.version,5);
assert.ok(Array.isArray(native.segments));
assert.equal(native.segments.length,10);
assert.equal(recipe.requireBranchAssertions,true);
assert.equal(recipe.branchAssertions.length,10);
assert.deepEqual(recipe.branchAssertions.map(a=>a.branch),recipe.branches);
const nativeCounts={boundaries:0,rngCalls:0,animationFrames:0};
for(const [index,part] of native.segments.entries()){
 const expected=recipe.segments[index];
 for(const field of ['name','seed','datetime','nethackrc','moves']){
  assert.ok(Object.hasOwn(expected,field),`recipe segment ${index} missing ${field}`);
  assert.ok(Object.hasOwn(part,field),`native segment ${index} missing ${field}`);
  assert.deepEqual(part[field],expected[field],`native segment ${index} ${field}`);
 }
 assert.ok(Array.isArray(part.steps));
 assert.equal(part.steps.length,part.moves.length+1,`${part.name}: all key boundaries`);
 for(const [index,step] of part.steps.entries()){
  assert.ok(Object.hasOwn(step,'key'),`${part.name} step ${index}: missing key`);
  assert.equal(step.key,index===0?null:part.moves[index-1],`${part.name} step ${index}: key`);
  assert.equal(typeof step.screen,'string');
  assert.ok(Array.isArray(step.rng)&&step.rng.every(call=>typeof call==='string'));
  if(Object.hasOwn(step,'animation_frames'))assert.ok(Array.isArray(step.animation_frames));
  nativeCounts.boundaries++;
  nativeCounts.rngCalls+=step.rng.length;
  nativeCounts.animationFrames+=(step.animation_frames||[]).length;
 }
}
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(recipe,native),[]);
assert.deepEqual(nativeCounts,{boundaries:2116,rngCalls:25166,animationFrames:0});

const reports=[],assertionSegments=[];const cause=s=>s.causes.find(k=>k.id===STONED)?.name??null;
for(const part of recipe.segments){const row={name:part.name,checks:[]};const check=(name,fn)=>{try{fn();row.checks.push({name,pass:true});}catch(e){row.checks.push({name,pass:false,error:e.message.slice(0,900)});}};
 try{const plain=await runCase(part,'plain'),seen=await runCase(part,'observer');
 const witness=seen.states.find(s=>s.pending?.includes('was poisoned!'));
 const late=await runCase(part,'deferred',witness?.step??part.moves.length-1),v=plain.outputs,h=hashes(v),states=seen.states,last=states.at(-1);
 check('complete plain observer and deferred equality',()=>{assert.deepEqual(hashes(seen.outputs),h);assert.deepEqual(hashes(late.outputs),h);
  for(const k of ['screens','cursors','slices','frames'])assert.equal(v[k].length,part.moves.length+1);assert.deepEqual(v.slices.flat(),v.rng);});
 assertionSegments.push({steps:v.screens.map((screen,i)=>({screen,rng:v.slices[i]}))});
 const witnesses=[];
 check('actual producer and consequence',()=>{
  assert.ok(witness,'actual poison announcement');
  if(part.name!=='natural-bite-negative')assert.ok(states.some(s=>s.luck===-6&&s.moreluck===-3),'actual mirrors and cursed luckstone');
  if(part.name.startsWith('gas-wet-')){
   const before=states.find(s=>s.pending==='A cloud of noxious gas billows from the chest.');assert.ok(before);assert.ok(before.halfGas);assert.ok(!before.res);
   assert.equal(last.hp,part.name==='gas-wet-13'?167:95);assert.equal(last.hpmax,before.hpmax);assert.deepEqual(last.attrs,before.attrs);assert.equal(last.mort,0);
   witnesses.push(before,last);
  }else if(part.name==='poly-severe-needle'){
   const before=states.find(s=>s.poly&&s.hp===117&&s.hpmax===117&&s.mh===29&&s.mhmax===29);assert.ok(before);
   assert.ok(last.poly);assert.deepEqual([last.hp,last.hpmax,last.mh,last.mhmax],[106,106,28,29]);assert.equal(last.attrs[4],before.attrs[4]-3);
   assert.ok(v.rng.some((s,i)=>s==='rn2(10)=0'&&v.rng[i+1]==='d(4,6)=17'));assert.equal(last.mort,0);witnesses.push(before,last);
  }else if(part.name.startsWith('poison-egg-')){
   const before=states.find(s=>s.mort===0&&s.stone===4&&cause(s)==='cockatrice egg');assert.ok(before);assert.ok(before.food>0);
   assert.ok(states.some(s=>s.pending?.includes('The poison was deadly...')));
   const saved=states.find(s=>s.mort===1&&s.hp>0&&s.amul===null&&!s.lifesaved&&s.stone>0&&s.stone<10);assert.ok(saved);assert.equal(cause(saved),'cockatrice egg');
   assert.ok(states.some(s=>s.pending?.includes('medallion crumbles')));assert.ok(!states.some(s=>s.pending?.includes("don't die")));witnesses.push(before,saved);
   if(part.name.endsWith('expiry')){const expired=states.find(s=>s.mort===2&&s.killer.name==='cockatrice egg');assert.ok(expired);assert.equal(cause(expired),null);assert.equal(last.mort,2);
    assert.ok(v.screens.at(-1).includes('cockatrice egg'));witnesses.push(expired);
   }else{assert.equal(last.mort,1);assert.equal(last.stone,0);assert.equal(cause(last),null);assert.ok(last.hp>0);assert.ok(states.some(s=>s.top?.includes('limber')));}
  }else if(part.name==='needle-hp-negative'){
   assert.ok(last.halfGas);assert.deepEqual([last.hp,last.hpmax],[103,109]);assert.ok(v.rng.some((s,i)=>s==='rn2(10)=8'&&v.rng[i+1]==='rn2(10)=0'));assert.equal(last.mort,0);
  }else if(part.name==='needle-attribute-negative'){
   assert.ok(last.halfGas);assert.deepEqual([last.hp,last.hpmax,last.attrs[4]],[194,194,15]);assert.ok(v.rng.some((s,i)=>s==='rn2(10)=5'&&v.rng[i+1]==='d(2,2)=3'));assert.equal(last.mort,0);
  }else if(part.name==='amulet-resistance-negative'){
   assert.equal(last.amul,O.AMULET_VERSUS_POISON);assert.ok(last.res);assert.equal(last.intrinsicRes,0);assert.equal(last.extrinsicRes,W_AMUL);
   assert.equal(last.hp,last.hpmax);assert.equal(last.mort,0);assert.ok(states.some(s=>s.pending?.includes("poison doesn't seem to affect you")));
  }else if(part.name==='natural-bite-negative'){
   assert.ok(states.some(s=>s.pending?.includes("giant spider's bite was poisoned!")));assert.equal(last.mort,0);assert.ok(last.hp>0&&last.hp<last.hpmax);
  }else if(part.name==='carried-gas-attribute-negative'){
   assert.ok(last.towels.some(o=>o.spe>0&&!o.worn));assert.ok(!last.halfGas);assert.deepEqual([last.hp,last.hpmax,last.attrs[0]],[113,113,4]);assert.equal(last.mort,0);
  }else assert.fail('unhandled ordinary proposal');
 });
 if(Object.hasOwn(recipe.unchangedOutputHashes,part.name))check('negative retains all five sealed hashes',()=>assert.deepEqual(h,recipe.unchangedOutputHashes[part.name]));
 Object.assign(row,{hashes:h,boundaries:v.screens.length,rngCalls:v.rng.length,animationFrames:v.frames.flat().length,witnesses:[...witnesses,witness,last],pending:late.pending});
 }catch(e){row.checks.push({name:'execution',pass:false,error:e.message.slice(0,1000)});}
 row.pass=row.checks.every(c=>c.pass);reports.push(row);
}
clearTimeout(deadline);const assertionErrors=branchAssertionErrors(recipe,{segments:assertionSegments});
const report={total:reports.length,passed:reports.filter(s=>s.pass).length,assertionErrors,nativeSHA256,nativeCounts,
 nativeIntegrityChecked:true,nativeInputFieldsChecked:['name','seed','datetime','nethackrc','moves'],nativeParityClaimed:false,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,assertionErrors,failed:reports.filter(r=>!r.pass).map(r=>({name:r.name,checks:r.checks.filter(c=>!c.pass)}))}));
if(report.passed!==report.total||assertionErrors.length)process.exitCode=1;
