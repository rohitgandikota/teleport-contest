// Source-derived inventory actions, native input integrity and passive keyboard checks.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pins={
  "proposal-01.json": "4af2c78c109ba0cd9218f37c4529213e52db5b49cbbab7f349868f4bb544d1ad",
  "reach-probe.json": "0fcd5cafb456affad17d703bd550bf777fa9eb4d23f6db0601539cecdefd8736",
  "input-lock.json": "93af73f10a636d5359767a706523a4399ca1bb96e8040262ad8dbe08159b5fa6",
  "source-triage.json": "f8a9c267f46ea42ff7a63724ed045dc31875f57cd82c8d2d7c375f087989c41a",
  "ordinary-original.mjs": "b48c467ad1a4888d0c57836fb6d7c8ec773c8ac9022c4ee0889746bb5f8c5508",
  "baseline-ordinary.json": "7cc25d0aa9c35e0647ae2f0fb65ab28cf18c4e12986a060b6cf3e0bd1fca15b2",
  "candidate-ordinary.json": "931f4e40e324b6af1b9dd1596d28cee7c671a897087889816b190fbee61be11a",
  "baseline-native.json": "4efa48cffad7ef65dd68e1af566c22f566fef90009d4342e855c6edb9d5df0a7",
  "candidate-native.json": "d3b1e4e73cc247e74acf4cc26f8c708935d24f467f0e8d76984ef6ce301bc5c6",
  "native-branch-checks.json": "e6441f60641507b65a73f652b3bc76ab66bab23d653730db81d561342b606660",
  "recording-receipt.json": "10b9f63acc4665c4c73d8902748665b5a187be9b431c22e6f29facbd88ca239c"
};
const evidence=new URL('gen-sessions/evidence/itemactions-context/',import.meta.url);
function readEvidence(name){
    const bytes=fs.readFileSync(new URL(name,evidence));
    assert.equal(sha(bytes),pins[name],name);
    return JSON.parse(bytes);
}
for(const [name,digest] of Object.entries(pins))
    assert.equal(sha(fs.readFileSync(new URL(name,evidence))),digest,name);
const recipeBytes=fs.readFileSync(new URL('gen-sessions/recipes/itemactions-context.json',import.meta.url));
assert.equal(sha(recipeBytes),'de169606dd962dade60e21801d8081121282c3593a0263dd45b071b276113a37');
const recipe=JSON.parse(recipeBytes);
const original=readEvidence('proposal-01.json'),lock=readEvidence('input-lock.json');
assert.equal(lock.candidateExisted,false);assert.equal(lock.cExecuted,false);
assert.deepEqual(recipe.segments,original.segments);
assert.deepEqual(recipe.expectations,original.expectations);
assert.deepEqual(recipe.segments,lock.tuples);
assert.equal(lock.recipeSHA256,pins['proposal-01.json']);
assert.equal(lock.probeSHA256,pins['reach-probe.json']);
assert.equal(lock.ordinarySHA256,pins['ordinary-original.mjs']);
assert.deepEqual(lock.inputFields,['name','seed','datetime','nethackrc','moves']);
const rawBytes=fs.readFileSync(new URL('gen-sessions/generated/itemactions-context.session.json',import.meta.url));
assert.equal(sha(rawBytes),'9e9feb96ac64fb307e4a7e1ca859a477594ac2e04aea0ec403e8fb34c60a3349');
assert.equal(rawBytes.length,878319);
const raw=JSON.parse(rawBytes);
assert.equal(raw.source,'c');assert.equal(raw.version,5);assert.equal(raw.segments.length,8);
for(const [i,part] of raw.segments.entries()){
    for(const key of lock.inputFields){
        assert.equal(Object.hasOwn(part,key),Object.hasOwn(recipe.segments[i],key));
        assert.deepEqual(part[key],recipe.segments[i][key]);
    }
    assert.deepEqual(part.steps.map(s=>s.key),[null,...recipe.segments[i].moves]);
}
const steps=raw.segments.flatMap(s=>s.steps);
assert.equal(steps.length,279);
assert.equal(raw.segments.reduce((n,s)=>n+s.moves.length,0),271);
assert.equal(steps.reduce((n,s)=>n+s.rng.length,0),17704);
assert.equal(steps.reduce((n,s)=>n+(s.animation_frames||[]).length,0),0);
assert.deepEqual(recordingIntegrityErrors(raw),[]);
assert.deepEqual(branchAssertionErrors(recipe,raw),[]);
const before=readEvidence('baseline-native.json'),after=readEvidence('candidate-native.json');
const exact=r=>['fullStyleExact','frozenScreenCursorExact','fullRngExact','animationExact'].every(k=>r[k]);
assert.equal(before.filter(exact).length,5);assert.equal(after.filter(exact).length,8);
for(const [i,row] of after.entries())
    if(row.name.endsWith('-negative'))assert.deepEqual(row,before[i]);
const initial=readEvidence('reach-probe.json');
assert.equal(Object.keys(lock.negativeHashes).length,5);
for(const [name,streams] of Object.entries(lock.negativeHashes)){
    assert.deepEqual(Object.keys(streams),['screens','cursors','calls','slices','frames']);
    assert.deepEqual(initial.find(r=>r.name===name).hashes,streams);
}
const target=process.argv[2]||null;
assert.ok(process.argv.length<=3&&(!target||(!target.startsWith('-')&&!fs.existsSync(target))));
const {runSegment}=await import('../js/jsmain.js');
const {InMemoryStorage}=await import('../js/storage.js');
const {decodeScreen,renderCell}=await import('../frozen/screen-decode.mjs');
const {outputs,hashes,deferred}=await import('./half-damage-reader-observe.mjs');
const results=[];
for(const part of recipe.segments){
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states=[];let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            if(!g.u||!g.level)return;
            states.push({step,turn:g.moves,weapon:g.u.uwep?.otyp??null,
                inventory:(g.invent||[]).map(o=>({otyp:o.otyp,invlet:o.invlet,quan:o.quan,
                    lamplit:o.lamplit||0,known:g.objects[o.otyp].oc_name_known||false}))});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    const output=outputs(run),streamHashes=hashes(output);
    assert.equal(output.screens.length,part.moves.length+1);
    assert.deepEqual(output.slices.flat(),output.calls);
    const plain=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    const held=await deferred(part);
    assert.deepEqual(hashes(plain),streamHashes,'passive observer preserves all output');
    assert.deepEqual(hashes(held),streamHashes,'deferred keyboard input preserves all output');
    const texts=output.screens.map(s=>decodeScreen(s).map(r=>r.map(renderCell).join('').trimEnd()).join('\n'));
    const expected=recipe.expectations.find(e=>e.name===part.name);
    const failures=[];
    const check=fn=>{try{fn();}catch(e){failures.push(e.message);}};
    check(()=>assert.ok(texts.some(t=>t.includes(expected.menu)),expected.menu));
    if(expected.result)check(()=>assert.ok(texts.at(-1).includes(expected.result),expected.result));
    const final=states.at(-1);
    if(part.name==='known-oil-light')check(()=>assert.equal(final.inventory[0].lamplit,1,'oil is burning'));
    if(part.name==='known-oil-snuff')check(()=>assert.equal(final.inventory[0].lamplit,0,'oil is snuffed'));
    if(part.name.startsWith('known-oil')){
        check(()=>assert.equal(final.inventory[0].known,1));
        check(()=>assert.ok(!texts.at(-1).includes('What do you want to dip')));
    }
    if(part.name.endsWith('-negative')){
        check(()=>assert.deepEqual(streamHashes,initial.find(r=>r.name===part.name).hashes));
        check(()=>assert.deepEqual(final,initial.find(r=>r.name===part.name).states.at(-1)));
    }
    const result={name:part.name,passed:failures.length===0,failures,hashes:streamHashes,final};
    results.push(result);console.log(JSON.stringify({name:result.name,passed:result.passed,failures}));
}
if(target)fs.writeFileSync(target,JSON.stringify(results,null,2)+'\n');
if(results.some(r=>!r.passed))process.exitCode=1;
