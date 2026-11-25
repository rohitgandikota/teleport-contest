// Six original inputs and two separately recorded RC inputs. No runtime variants.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Blind} from '../js/youprop.js';
import {TIMEOUT} from '../js/const.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {getRngLog} from '../js/rng.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {outputs,hashes,hash,deferred} from './half-damage-reader-observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const bytesSHA=value=>createHash('sha256').update(value).digest('hex');
const fields=['name','seed','datetime','nethackrc','moves'];
const fieldValues=s=>fields.map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
const top=screen=>decodeScreen(screen).slice(0,2).map(r=>r.map(renderCell).join('').trimEnd()).join(' ');
const originalBytes=readFileSync(new URL('./gen-sessions/evidence/queued-notice-input-boundary/original-recipe.json',import.meta.url));
const correctedBytes=readFileSync(new URL('./gen-sessions/recipes/queued-notice-nonduplicate-rc.json',import.meta.url));
const recipeBytes=readFileSync(new URL('./gen-sessions/recipes/queued-notice-input-boundary.json',import.meta.url));
assert.equal(bytesSHA(originalBytes),'39ee33e4769474485f27acaabd1b9974d5891e56d0aa03e49634fab49abb61ab');
assert.equal(bytesSHA(correctedBytes),'b38cbf9443dce4319e74c974e86fe3ecda3503254dcf8cad672e3ea40d777bc2');
assert.equal(bytesSHA(recipeBytes),'15dda3a4d80a1b3729a83aa0dcd35cfd1eb67f396c87361f6272ec633835e4f6');
const original=JSON.parse(originalBytes),corrected=JSON.parse(correctedBytes),recipe=JSON.parse(recipeBytes);
assert.equal(original.segments.length,8);assert.equal(corrected.segments.length,2);assert.equal(recipe.segments.length,8);
assert.equal(hash(original.segments.map(fieldValues)),'ddb7d4642a4b4d58af652a90d2416ed90907f87f13317467339d9582ddb4a6c9');
assert.equal(hash(corrected.segments.map(fieldValues)),'b2a4d507865c351a6c3494c11143545606947f2d324a0687d7488b73f1144d15');
assert.equal(hash(original.unchangedOutputHashes),'e8ca180c8f62f9cb5a65c78ad6353db0898f4d0f18fecea25361f434fe922341');
for(const [index,oldIndex,removed,replacement] of [
    [0,1,'OPTIONS=accessiblemsg,whatis_coord:map\n','OPTIONS=whatis_coord:map\n'],
    [1,4,'OPTIONS=spot_monsters\n','']]){
    const old=original.segments[oldIndex],part=corrected.segments[index];
    assert.equal(old.nethackrc.split(removed).length,2);
    assert.equal(part.name,old.name+'-nonduplicate-rc');
    assert.equal(part.nethackrc,old.nethackrc.replace(removed,replacement));
    for(const field of ['seed','datetime','moves'])assert.equal(part[field],old[field]);
}

// Mandatory native preflight, before any ordinary JS replay. Historical raw
// stays outside generated fixtures because its two startup failures are open.
const originalsNativeBytes=readFileSync(new URL('./gen-sessions/evidence/queued-notice-input-boundary/parent-original.session.json',import.meta.url));
const correctedNativeBytes=readFileSync(new URL('./gen-sessions/evidence/queued-notice-input-boundary/parent-nonduplicate-rc.session.json',import.meta.url));
const maintainedNativeBytes=readFileSync(new URL('./gen-sessions/generated/queued-notice-input-boundary.session.json',import.meta.url));
assert.equal(bytesSHA(originalsNativeBytes),'dfce373f5410e4caf4a7b806fed09cec78be14ca1e763fb0711f71e2986568cd','original raw SHA256');
assert.equal(bytesSHA(correctedNativeBytes),'47b56614f28cbd50d0b807fffcc3cddf799373c308e4b0be3ebf2f56e5a836e0','new raw SHA256');
assert.equal(bytesSHA(maintainedNativeBytes),'83dea13c2e2945eaab0916ae9d0b083450b3154db4f4a35ccfa3dbfcb7c0ef51','maintained raw SHA256');
const originalsNative=JSON.parse(originalsNativeBytes),correctedNative=JSON.parse(correctedNativeBytes);
const maintainedNative=JSON.parse(maintainedNativeBytes);
const nativeCounts=[];
for(const [native,input,expected] of [
    [originalsNative,original,{boundaries:802,calls:20630,frames:0}],
    [correctedNative,corrected,{boundaries:198,calls:5172,frames:0}],
    [maintainedNative,recipe,{boundaries:802,calls:20732,frames:0}]]){
    assert.equal(native.source,'c');assert.equal(native.version,5);
    assert.ok(Array.isArray(native.segments));assert.equal(native.segments.length,input.segments.length);
    const counts={boundaries:0,calls:0,frames:0};
    for(const [index,part] of native.segments.entries()){
        const expectedPart=input.segments[index];
        for(const field of fields){
            assert.ok(Object.hasOwn(expectedPart,field),`recipe ${index}: missing ${field}`);
            assert.ok(Object.hasOwn(part,field),`native ${index}: missing ${field}`);
            assert.deepEqual(part[field],expectedPart[field],`native ${index}: ${field}`);
        }
        assert.ok(Array.isArray(part.steps));assert.equal(part.steps.length,part.moves.length+1);
        for(const [stepIndex,step] of part.steps.entries()){
            assert.ok(Object.hasOwn(step,'key'));
            assert.equal(step.key,stepIndex===0?null:part.moves[stepIndex-1]);
            assert.equal(typeof step.screen,'string');
            assert.ok(Array.isArray(step.cursor)&&step.cursor.length===3);
            assert.ok(Array.isArray(step.rng)&&step.rng.every(c=>typeof c==='string'));
            if(Object.hasOwn(step,'animation_frames'))assert.ok(Array.isArray(step.animation_frames));
            counts.boundaries++;counts.calls+=step.rng.length;counts.frames+=(step.animation_frames||[]).length;
        }
    }
    assert.deepEqual(recordingIntegrityErrors(native),[]);assert.deepEqual(counts,expected);nativeCounts.push(counts);
}
const nativeSelected={source:'c',version:5,segments:recipe.nativeSources.map((source,index)=>{
    assert.ok(['original-eight','nonduplicate-rc'].includes(source.recording));
    const part=(source.recording==='original-eight'?originalsNative:correctedNative).segments[source.segment];
    for(const field of fields){
        assert.ok(Object.hasOwn(recipe.segments[index],field));
        assert.deepEqual(part[field],recipe.segments[index][field]);
    }
    return part;
})};
assert.equal(recipe.nativeSources.filter(s=>s.recording==='original-eight').length,6);
assert.equal(recipe.nativeSources.filter(s=>s.recording==='nonduplicate-rc').length,2);
assert.deepEqual(maintainedNative.segments,nativeSelected.segments,'entire unchanged source segments, including all raw output');
assert.equal(recipe.requireBranchAssertions,true);assert.equal(recipe.branchAssertions.length,8);
assert.deepEqual(recipe.branchAssertions.map(a=>a.branch),recipe.branches);
assert.deepEqual(branchAssertionErrors(recipe,nativeSelected),[]);
assert.deepEqual(branchAssertionErrors(corrected,correctedNative),[]);
const originalStartupFailures=[1,4].map(index=>{
    const part=originalsNative.segments[index],option=index===1?'accessiblemsg':'spot_monsters';
    const rows=decodeScreen(part.steps[0].screen).slice(0,8).map(r=>r.map(renderCell).join('').trimEnd());
    assert.ok(rows.some(row=>row.includes('boolean option specified multiple times: '+option)));
    assert.ok(rows.some(row=>row.startsWith('1 error in ')));
    return {name:part.name,firstBoundary:0,status:'unresolved original duplicate-RC failure',nativeRows:rows};
});
assert.deepEqual(recipe.unresolvedOriginalInputs,originalStartupFailures.map(x=>x.name));

const deadline=setTimeout(()=>{console.error('55 second queued-notice input limit');process.exit(2);},55000);
const results=[],assertionSegments=[];
for(const [index,part] of recipe.segments.entries()){
    const states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const row={name:part.name,inputSHA256:hash(fieldValues(part)),checks:[]};
    const check=(name,fn)=>{try{fn();row.checks.push({name,pass:true});}catch(e){row.checks.push({name,pass:false,error:e.message.slice(0,900)});}};
    try{
        let output;
        try{
            globalThis.__step_snapshot={step:'*',cb(g,step){
                if(!g.u||!g.level)return;
                states.push({step,turn:g.moves,hp:g.u.uhp,mortality:g.u.umortality||0,
                    blind:!!Blind(),timeout:(g.u.intrinsic?.HBlinded||0)&TIMEOUT,
                    prev:g._prevmsg||'',pending:(g.a11y?.notices||[]).map(n=>n.text),flags:g.pline_flags|0,
                    rngCalls:getRngLog().length,form:g.u.umonnum,notices:!!g.flags.spot_monsters,
                    jelly:g.level.monsters.filter(m=>m.mnum===P.PM_BLUE_JELLY).map(m=>({xy:[m.mx,m.my],peaceful:!!m.mpeaceful,spotted:!!m.mspotted})),
                    spotted:g.level.monsters.filter(m=>m.mspotted).map(m=>({mnum:m.mnum,xy:[m.mx,m.my]}))});
            }};
            output=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
        const plain=outputs(await runSegment({...part,storage:new InMemoryStorage()})),late=await deferred(part);
        const tops=output.screens.map(top);
        assertionSegments[index]={steps:output.screens.map((screen,i)=>({screen,rng:output.slices[i]}))};
        check('all keys and complete observer/deferred equality',()=>{
            assert.deepEqual(output,plain);assert.deepEqual(output,late);assert.deepEqual(output.slices.flat(),output.calls);
            for(const key of ['screens','cursors','slices','frames'])assert.equal(output[key].length,part.moves.length+1);
            assert.equal(states.length,part.moves.length+1);assert.match(tops.at(-1),/NetHack Version/);
            assert.ok(states.every(s=>s.hp>0&&!s.mortality));
        });
        const timerCase=part.name.startsWith('unknown-')||part.name==='target-inspection'||part.name==='notice-option-off-nonduplicate-rc';
        check('real blindness producer and sight restoration',()=>{
            assert.ok(states.some(s=>s.blind));assert.equal(states.at(-1).blind,false);
            if(timerCase){
                assert.ok(states.some(s=>s.blind&&s.timeout>0));assert.equal(states[88].blind,false);assert.equal(states[88].timeout,0);
                assert.ok(states[88].jelly.some(m=>m.xy[0]===8&&m.xy[1]===5&&m.peaceful));
            }
        });
        if(part.name.startsWith('unknown-')||part.name==='target-inspection'){
            check('timeout sighting completes before the next input',()=>{
                assert.equal(states[88].pending.length,0);assert.ok(states[88].notices);
                assert.ok(states[88].spotted.some(m=>m.xy[0]===8&&m.xy[1]===5));
                assert.match(tops[88],/You can see again\..*You see a peaceful blue jelly\./);
                assert.equal(part.moves[88],part.name==='target-inspection'?';':'~');
                if(part.name==='unknown-stop'){
                    assert.ok(tops[88].includes('--More--'));assert.equal(tops[89],tops[88]);
                    assert.equal(states[89].rngCalls,states[88].rngCalls);
                    assert.ok(!tops[90].includes('--More--'));assert.equal(states[90].rngCalls-states[89].rngCalls,2);
                }else assert.ok(!tops[88].includes('--More--'));
                if(part.name==='unknown-plain-nonduplicate-rc')assert.ok(!tops[88].includes('<8,5>'));
            });
            if(part.name==='unknown-hide')check('hidden command error remains hidden',()=>assert.ok(tops.every(t=>!t.includes('Unknown command'))));
        }else if(part.name==='notice-option-off-nonduplicate-rc'){
            check('disabled notices remain unaffected',()=>{
                assert.equal(states[88].notices,false);assert.ok(states.every(s=>s.pending.length===0));
                assert.ok(tops.every(t=>!t.includes('You see a peaceful blue jelly.')));
            });
        }else if(part.name==='blindfold-removal'){
            check('actual blindfold removal remains unaffected',()=>{
                assert.ok(tops.some(t=>t.includes('You were wearing a blindfold.')));
                assert.ok(tops.some(t=>t.includes('You see a peaceful newt.')));
            });
        }else if(part.name==='eyeless-reversion'){
            check('actual eyeless reversion remains unaffected',()=>{
                assert.ok(new Set(states.map(s=>s.form)).size>1);assert.equal(states.at(-1).form,states[0].form);
                assert.ok(tops.some(t=>t.includes('You feel like a new man!')));
            });
        }
        const actual=hashes(output);
        if(Object.hasOwn(recipe.unchangedOutputHashes,part.name))
            check('all five original unaffected hashes',()=>assert.deepEqual(actual,recipe.unchangedOutputHashes[part.name]));
        if(Object.hasOwn(corrected.sameEffectiveJSOutputHashes,part.name))
            check('RC correction preserves all five original effective JS hashes',()=>assert.deepEqual(actual,corrected.sameEffectiveJSOutputHashes[part.name]));
        if(part.name==='target-inspection')row.priorNegative={classification:'positive for the pre-input prerequisite',
            originalHashes:original.unchangedOutputHashes[part.name],changedStreams:Object.keys(actual).filter(k=>actual[k]!==original.unchangedOutputHashes[part.name][k])};
        Object.assign(row,{hashes:actual,boundaries:output.screens.length,calls:output.calls.length,frames:output.frames.flat().length,
            witness:timerCase?{...states[88],text:tops[88]}:null});
    }catch(e){row.checks.push({name:'execution',pass:false,error:e.message.slice(0,1200)});}
    row.pass=row.checks.every(c=>c.pass);results.push(row);
}
clearTimeout(deadline);
const branchErrors=branchAssertionErrors(recipe,{segments:assertionSegments});
const report={total:results.length,passed:results.filter(r=>r.pass).length,branchErrors,nativePreflight:true,nativeCounts,
    nativeSHA256:{original:bytesSHA(originalsNativeBytes),nonduplicateRC:bytesSHA(correctedNativeBytes),maintained:bytesSHA(maintainedNativeBytes)},
    originalStartupFailures,originalEightNativeStatus:'6/8 exact; two startup failures remain unresolved',results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,branchErrors,originalStartupFailures:originalStartupFailures.map(x=>({name:x.name,status:x.status})),
    failures:results.filter(r=>!r.pass).map(r=>({name:r.name,checks:r.checks.filter(c=>!c.pass)}))}));
if(report.passed!==report.total||branchErrors.length)process.exitCode=1;
