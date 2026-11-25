// Article and fruit prerequisite contract. Original inputs and recipe stay fixed.
// Ordinary input only. Observations copy fields without calling naming helpers.
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
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as PM} from '../js/monst_data.js';
import {CORPSTAT_GENDER,CORPSTAT_FEMALE} from '../js/const.js';
import {ART_EXCALIBUR,ART_YENDORIAN_EXPRESS_CARD} from '../js/artilist_data.js';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const deadline=setTimeout(()=>{console.error('55 second article input limit');process.exit(1);},55000);deadline.unref();
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const hashes=v=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,digest(x)]));
const output=r=>({screens:r.getScreens(),cursors:r.getCursors(),rng:[...r.getRngLog()],slices:r.getRngSlices(),frames:r.getAnimationFramesByStep()});
function object(o){return {otyp:o.otyp,quan:o.quan,spe:o.spe,oeaten:o.oeaten||0,corpsenm:o.corpsenm,
    oname:o.oname,artifact:o.oartifact||0,novelidx:o.novelidx,known:o.known,bknown:o.bknown,rknown:o.rknown,dknown:o.dknown};}
function snapshot(g,step){
    const floor=[];
    for(let o=g.level.objAt.get(`${g.u.ux},${g.u.uy}`);o;o=o.nexthere){assert.ok(floor.length<32);floor.push(object(o));}
    const fruits=[];for(let f=g.ffruit;f;f=f.nextf){assert.ok(fruits.length<32);fruits.push({fid:f.fid,fname:f.fname});}
    return {step,turn:g.moves,hp:g.u.uhp,food:g.u.uconduct.food,fruit:g.svp.pl_fruit,currentFruit:g.context.current_fruit,fruits,
        inventory:g.invent.map(object),floor,victual:g.context.victual?.piece?object(g.context.victual.piece):null,
        rngCount:getRngLog().length,top:g._toplines,pending:g._pending_message};
}
async function deferred(input,hold,pending){
    const run=new NethackGame({...input,storage:new InMemoryStorage()}),display=new GameDisplay(null),end=new Error('Input queue empty: bounded article gate');
    let used=0,complete=false;
    display.onEmptyQueue=async()=>{await setImmediate();
        if(used===hold||used===input.moves.length){
            const before=snapshot(game,used),rng=[...getRngLog()];await setImmediate();
            assert.equal(complete,false);assert.deepEqual(snapshot(game,used),before);assert.deepEqual(getRngLog(),rng);pending.push(before);
        }
        if(used===input.moves.length)throw end;
        return input.moves.charCodeAt(used++);
    };
    run._pendingDisplay=display;
    try{await run.start();for(let i=0;i<2048&&!game.program_state?.gameover;i++)await moveloop_core();}catch(e){if(e!==end)throw e;}
    complete=true;assert.equal(used,input.moves.length);
    assert.ok(pending.some(s=>s.step===hold),'selected feedback boundary stayed pending');
    assert.ok(pending.some(s=>s.step===input.moves.length),'exhausted input stayed pending');return run;
}
async function runCase(part,mode,hold=-1){
    const input=Object.fromEntries(['seed','datetime','nethackrc','moves'].map(k=>[k,part[k]])),states=[],pending=[];
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
    try{
        if(mode==='observer')globalThis.__step_snapshot={step:'*',cb(g,s){states.push(snapshot(g,s));}};
        run=mode==='deferred'?await deferred(input,hold,pending):await runSegment({...input,storage:new InMemoryStorage()});
    }finally{if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);else delete globalThis.__step_snapshot;}
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    return {outputs:output(run),states,pending};
}
const recipeBytes=fs.readFileSync(new URL('./gen-sessions/recipes/article-owner-contract.json',import.meta.url));
const recipe=JSON.parse(recipeBytes);
const prerequisitePositive='fruit-excalibur-sit-negative'; // fixed legacy input name
const unchangedNegatives=[
    'apple-sit-negative','artifact-excalibur-sit-negative','fruit-lower-sit-negative',
    'fruit-zelda-eat-negative','novel-lowercase-of-negative'];
assert.equal(recipe.segments.length,14);assert.deepEqual(branchAssertionErrors(recipe),[]);
assert.deepEqual(Object.keys(recipe.unchangedOutputHashes).sort(),
    [...unchangedNegatives,prerequisitePositive].sort());
// C objnam.c:1275-1299 doname_base(): artifact-named fruit follows that
// artifact's article convention. Keep the original 14 article assertions,
// and prove the newly included prerequisite in both raw C and JS output.
const prerequisiteAssertions={requireBranchAssertions:true,
    branches:['fruit-excalibur-sit-prerequisite','fruit-excalibur-eat-prerequisite'],
    branchAssertions:[
        {branch:'fruit-excalibur-sit-prerequisite',segment:2,
         screenIncludes:['a - Excalibur.','You drop Excalibur.'],
         screenExcludes:['a - an Excalibur.','You drop an Excalibur.']},
        {branch:'fruit-excalibur-eat-prerequisite',segment:4,
         screenIncludes:['a - partly eaten Excalibur.','You eat partly eaten Excalibur.'],
         screenExcludes:['a - a partly eaten Excalibur.','You eat a partly eaten Excalibur.']}
    ]};
assert.equal(recipe.segments[2].name,prerequisitePositive);
assert.equal(recipe.segments[4].name,'fruit-excalibur-eat');
// Mandatory unchanged native provenance, input and branch checks before gameplay.
assert.equal(createHash('sha256').update(recipeBytes).digest('hex'),
    '09fc3b40d639b6324a63101fc40e282d62149fe177a2d354140defcc1ca7acfd','sealed recipe SHA256');
const nativeBytes=fs.readFileSync(new URL('./gen-sessions/generated/article-owner-contract.session.json',import.meta.url));
const nativeSHA256=createHash('sha256').update(nativeBytes).digest('hex');
assert.equal(nativeSHA256,'39a77d5a3a4824b6aab836a85c3f1d014a202299122592f94687bd3ef7aff5dc','canonical native SHA256');
const native=JSON.parse(nativeBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);
assert.ok(Array.isArray(native.segments));assert.equal(native.segments.length,14);
assert.equal(recipe.requireBranchAssertions,true);assert.equal(recipe.branchAssertions.length,14);
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
        nativeCounts.boundaries++;nativeCounts.rngCalls+=step.rng.length;
        nativeCounts.animationFrames+=(step.animation_frames||[]).length;
    }
}
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(recipe,native),[]);
assert.deepEqual(branchAssertionErrors(prerequisiteAssertions,native),[]);
assert.deepEqual(nativeCounts,{boundaries:462,rngCalls:40460,animationFrames:0});

const reports=[],assertionSegments=[];
for(const [index,part] of recipe.segments.entries()){
    const row={name:part.name,checks:[]};
    const check=(name,fn)=>{try{fn();row.checks.push({name,pass:true});}catch(e){row.checks.push({name,pass:false,error:e.message.slice(0,1000)});}};
    try{
        const plain=await runCase(part,'plain'),seen=await runCase(part,'observer');
        const states=seen.states,last=states.at(-1),message=recipe.branchAssertions[index].screenIncludes[0];
        const witness=states.find(s=>s.pending?.includes(message)||s.top?.includes(message));
        const late=await runCase(part,'deferred',witness?.step??part.moves.length-1),v=plain.outputs,h=hashes(v);
        check('all keys and complete observer/deferred equality',()=>{
            assert.deepEqual(hashes(seen.outputs),h);assert.deepEqual(hashes(late.outputs),h);
            for(const k of ['screens','cursors','slices','frames'])assert.equal(v[k].length,part.moves.length+1);
            assert.deepEqual(v.slices.flat(),v.rng);assert.equal(states.length,part.moves.length+1);
        });
        assertionSegments.push({steps:v.screens.map((screen,i)=>({screen,rng:v.slices[i]}))});
        const witnesses=[];
        check('actual producer, naming consequence and consumption',()=>{
            assert.ok(witness,'expected naming message at a real input boundary');assert.ok(last.hp>0);
            if(part.name.startsWith('fruit-')){
                const before=states.find(s=>s.inventory.some(o=>o.otyp===O.SLIME_MOLD));assert.ok(before);
                const fruit=before.inventory.find(o=>o.otyp===O.SLIME_MOLD);
                assert.equal(fruit.artifact,0);assert.equal(fruit.spe,before.currentFruit);
                assert.ok(before.fruits.some(f=>f.fid===fruit.spe&&f.fname===before.fruit));
                const name=part.name.includes('excalibur')?'Excalibur':part.name.includes('rubies')?'Ruby':part.name.includes('lower')?'mango':'Zelda';
                assert.equal(before.fruit,name);assert.equal(fruit.quan,part.name.includes('rubies')?3:1);
                if(part.name.includes('-eat')){
                    assert.ok(fruit.oeaten>0);assert.equal(last.food,1);assert.equal(last.inventory.length,0);
                    assert.ok(!last.floor.some(o=>o.otyp===O.SLIME_MOLD));
                }else{
                    assert.equal(last.food,0);assert.ok(witness.floor.some(o=>o.otyp===O.SLIME_MOLD&&o.quan===fruit.quan&&o.spe===fruit.spe));
                }
                witnesses.push(before);
            }else if(part.name.includes('corpse-eat')){
                const before=states.find(s=>s.floor.some(o=>o.otyp===O.CORPSE));assert.ok(before);
                const corpse=before.floor.find(o=>o.otyp===O.CORPSE);assert.equal(corpse.artifact,0);
                const species=part.name.startsWith('oracle')?PM.PM_ORACLE
                    :part.name.startsWith('twoflower')?PM.PM_TWOFLOWER:PM.PM_CAVE_DWELLER;
                assert.equal(corpse.corpsenm,species);
                if(part.name.startsWith('cavewoman'))assert.equal(corpse.spe&CORPSTAT_GENDER,CORPSTAT_FEMALE);
                assert.equal(last.food,1);assert.equal(last.inventory.length,0);
                assert.ok(!last.floor.some(o=>o.otyp===O.CORPSE));witnesses.push(before);
            }else if(part.name.startsWith('novel-')){
                const book=last.inventory.find(o=>o.otyp===O.SPE_NOVEL);assert.ok(book);
                assert.equal(book.oname,'The Colour of Magic');assert.equal(book.novelidx,0);assert.equal(book.artifact,0);
                assert.equal(last.food,0);
            }else if(part.name.startsWith('artifact-')){
                const card=part.name==='artifact-card-sit';
                const before=states.find(s=>s.inventory.some(o=>o.artifact&&(o.known&&o.bknown&&o.rknown&&o.dknown)));assert.ok(before);
                const art=before.inventory.find(o=>o.artifact);assert.equal(art.otyp,card?O.CREDIT_CARD:O.LONG_SWORD);
                assert.equal(art.oname,card?'The Platinum Yendorian Express Card':'Excalibur');
                assert.equal(art.artifact,card?ART_YENDORIAN_EXPRESS_CARD:ART_EXCALIBUR);
                assert.ok(witness.floor.some(o=>o.artifact===art.artifact&&o.known&&o.bknown&&o.rknown&&o.dknown));
                assert.equal(last.food,0);witnesses.push(before);
            }else if(part.name==='apple-sit-negative'){
                assert.ok(witness.floor.some(o=>o.otyp===O.APPLE&&!o.artifact));assert.equal(last.food,0);
            }else assert.fail('unhandled proposal');
            witnesses.push(witness,last);
        });
        if(unchangedNegatives.includes(part.name))
            check('negative retains all five fixed baseline hashes',()=>assert.deepEqual(h,recipe.unchangedOutputHashes[part.name]));
        if(part.name===prerequisitePositive){
            const original=recipe.unchangedOutputHashes[part.name];
            const changedStreams=Object.keys(original).filter(k=>h[k]!==original[k]);
            row.scopeReconciliation={classification:'doname prerequisite positive; original the() target neutral',
                originalNegativeHashes:original,oldNegativeHashCheckPass:changedStreams.length===0,changedStreams};
            check('prerequisite positive changes only the old defective screen stream',()=>{
                assert.deepEqual(changedStreams,['screens']);
                for(const key of ['cursors','rng','slices','frames'])assert.equal(h[key],original[key]);
                assert.ok(states.some(s=>s.top?.includes('a - Excalibur.')||s.pending?.includes('a - Excalibur.')));
                assert.ok(states.some(s=>s.top?.includes('You drop Excalibur.')||s.pending?.includes('You drop Excalibur.')));
            });
        }
        Object.assign(row,{hashes:h,boundaries:v.screens.length,rngCalls:v.rng.length,animationFrames:v.frames.flat().length,witnesses,pending:late.pending});
    }catch(e){row.checks.push({name:'execution',pass:false,error:e.stack.slice(0,1500)});}
    row.pass=row.checks.every(c=>c.pass);reports.push(row);
}
clearTimeout(deadline);
const assertionErrors=branchAssertionErrors(recipe,{segments:assertionSegments});
const prerequisiteAssertionErrors=branchAssertionErrors(prerequisiteAssertions,{segments:assertionSegments});
const report={total:reports.length,passed:reports.filter(r=>r.pass).length,assertionErrors,prerequisiteAssertionErrors,
    originalBranchAssertions:14,prerequisiteBranchAssertions:2,unchangedNegatives,
    nativePreflight:{source:native.source,version:native.version,sha256:nativeSHA256,requiredInputFields:['name','seed','datetime','nethackrc','moves'],...nativeCounts},
    nativeParityClaimed:false,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,assertionErrors,prerequisiteAssertionErrors,failed:reports.filter(r=>!r.pass).map(r=>({name:r.name,checks:r.checks.filter(c=>!c.pass)}))}));
if(report.passed!==report.total||assertionErrors.length||prerequisiteAssertionErrors.length)process.exitCode=1;
