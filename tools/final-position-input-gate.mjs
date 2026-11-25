// Ordinary keyboard controls. Native recording and parity are parent work.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Race_if} from '../js/u_init.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {Upolyd,ROOM,CORR,OBJ_BURIED,W_AMUL,W_RINGL,W_TOOL} from '../js/const.js';
import {Blind,Flying,Levitation} from '../js/youprop.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {outputs,hashes,hash,deferred} from './half-damage-reader-observe.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
// BEGIN mandatory canonical C preflight. Integrity is not a native replay.
const canonicalSHA=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonicalRecipeBytes=readFileSync(new URL('gen-sessions/recipes/final-position-owner.json',import.meta.url));
assert.equal(canonicalSHA(canonicalRecipeBytes),'8df9da30140b5624d432d7d5d9ef0a2bb1f5bc6debe0ebec0e3b753970608fe4','primary recipe bytes');
const canonicalRecipe=JSON.parse(canonicalRecipeBytes);
const canonicalOriginalBytes=readFileSync(new URL('gen-sessions/evidence/final-position-owner/recording-recipe.json',import.meta.url));
assert.equal(canonicalSHA(canonicalOriginalBytes),'a93452f8a5dae84a6b8dd468379fbc700abef9d5a4dc1adf1e40e079726bf22b','original recording recipe bytes');
const canonicalOriginal=JSON.parse(canonicalOriginalBytes);
const {requireBranchAssertions,branches,branchAssertions,...canonicalOriginalFields}=canonicalRecipe;
assert.deepEqual(canonicalOriginalFields,canonicalOriginal,'all original recipe fields, requirements and negative hashes');
assert.equal(hash({requireBranchAssertions,branches,branchAssertions}),'64fffae40f90de2a08452d335fba51414168b8929f4cafa3bd7005287c0a4aaf','primary branch metadata');
assert.equal(requireBranchAssertions,true);assert.equal(branches.length,7);assert.equal(branchAssertions.length,7);
assert.deepEqual(branches,canonicalRecipe.segments.map(s=>'final-position.'+s.name));
assert.deepEqual(branchAssertions.map(a=>[a.branch,a.segment]),branches.map((branch,i)=>[branch,i]));
const canonicalLockBytes=readFileSync(new URL('gen-sessions/evidence/final-position-owner/input-lock.json',import.meta.url));
assert.equal(canonicalSHA(canonicalLockBytes),'9f32f80de8a5612729558b362ffdcd29373d37b3efc3e34fc5888d058a236806','original input lock bytes');
const canonicalLock=JSON.parse(canonicalLockBytes);
assert.equal(canonicalLock.recipeSHA256,canonicalSHA(canonicalOriginalBytes));
const canonicalFields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
const canonicalTuples=canonicalRecipe.segments.map(canonicalFields);
assert.equal(canonicalRecipe.segments.length,7);assert.equal(canonicalLock.segments,7);
assert.equal(hash(canonicalTuples),'c46a13f8ec0391788fe193ccd6a8212e12e6dfa81cf34bfd0d05bd1c4c0bd5c1','all five fields and presence');
assert.equal(canonicalLock.fieldsPresenceSHA256,hash(canonicalTuples));
assert.equal(canonicalLock.branchRequirementsSHA256,hash(canonicalRecipe.branchRequirements));
assert.equal(canonicalLock.negativeHashesSHA256,hash(canonicalRecipe.unchangedOutputHashes));
assert.equal(canonicalLock.segmentsSHA256.length,7);
// Only this installed canonical recording is accepted. No alternate path or selector.
const canonicalRawBytes=readFileSync(new URL('gen-sessions/generated/final-position-owner.session.json',import.meta.url));
assert.equal(canonicalSHA(canonicalRawBytes),'b4ea635ce22af1f8a9a5d3637385fefa82fb0ea8160c49e6cfe85ef22e51363c','exact canonical C raw bytes');
assert.equal(canonicalRawBytes.length,766372);
const canonicalNative=JSON.parse(canonicalRawBytes);
assert.equal(canonicalNative.source,'c');assert.equal(canonicalNative.version,5);assert.equal(canonicalNative.segments.length,7);
assert.deepEqual(canonicalNative.segments.map(canonicalFields),canonicalTuples,'C input field presence and values');
for(const [i,part]of canonicalNative.segments.entries()){
    const input=canonicalRecipe.segments[i],locked=canonicalLock.segmentsSHA256[i];
    assert.equal(locked.name,input.name);assert.equal(locked.fieldsSHA256,hash(canonicalFields(input)));
    assert.equal(locked.movesSHA256,canonicalSHA(Buffer.from(input.moves,'utf8')),'exact key bytes');
    assert.ok(Array.isArray(part.steps)&&part.steps.length,'C boundaries are mandatory');
    assert.deepEqual(part.steps.map(step=>step.key),[null,...input.moves],'every recorded key and initial boundary');
}
assert.equal(canonicalLock.keys,334);assert.equal(canonicalLock.boundaries,341);
assert.equal(canonicalNative.segments.reduce((n,s)=>n+s.moves.length,0),334);
assert.equal(canonicalNative.segments.reduce((n,s)=>n+s.steps.length,0),341);
assert.deepEqual(recordingIntegrityErrors(canonicalNative),[],'canonical recording integrity');
assert.deepEqual(branchAssertionErrors(canonicalRecipe,canonicalNative),[],'all seven primary C branches');
// END mandatory canonical C preflight.
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/final-position-owner.json',import.meta.url)));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(recipe.segments.length,7);
assert.equal(hash(recipe.segments.map(fields)),'c46a13f8ec0391788fe193ccd6a8212e12e6dfa81cf34bfd0d05bd1c4c0bd5c1');
assert.equal(hash(recipe.branchRequirements),'0f517453f44f67ee84e1265744913a64d5ca2ff28497f5a1a7eae561c6124d1f');
assert.equal(hash(recipe.unchangedOutputHashes),'5d953bfab1ba4553355f1fbdd044c6f9db6c6d94d52e3af8807920b9018a9c68');
const results=[],bound=setTimeout(()=>{console.error('55 second ordinary bound');process.exit(2);},55000);
for(const [i,part]of recipe.segments.entries()){
    const r={name:part.name,inputSHA256:hash(fields(part))},states=[];
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    try{
        let output;
        try{
            globalThis.__step_snapshot={step:'*',cb(g,step){if(!g.u||!g.level)return;
                const buried=(g.level.buriedobjs||[]).filter(o=>o.ox===g.u.ux&&o.oy===g.u.uy);
                const terrain=g.level.at(g.u.ux,g.u.uy).typ;
                states.push({step,turn:g.moves,xy:[g.u.ux,g.u.uy],hp:g.u.uhp,mortality:g.u.umortality||0,
                    dwarf:Race_if(P.PM_DWARF),mounted:!!g.u.usteed,flying:!!Flying(),levitation:!!Levitation(),polymorphed:Upolyd(g.u),blind:!!Blind(),terrain,
                    buriedHere:buried.map(o=>({id:o.o_id,typ:o.otyp,where:o.where,xy:[o.ox,o.oy]})),
                    floorIds:g.level.objects.filter(o=>o.ox===g.u.ux&&o.oy===g.u.uy).map(o=>o.o_id),
                    inventory:(g.invent||[]).map(o=>({typ:o.otyp,mask:o.owornmask||0})),
                    eligible:Race_if(P.PM_DWARF)&&!g.u.usteed&&!Flying()&&!Levitation()&&!Upolyd(g.u)&&[ROOM,CORR].includes(terrain)&&buried.length>0});
            }};
            output=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
        Object.assign(r,{hashes:hashes(output),boundaries:output.screens.length,calls:output.calls.length,frames:output.frames.flat().length});
        assert.deepEqual(output,outputs(await runSegment({...part,storage:new InMemoryStorage()})),'all-five observer neutrality');r.observerNeutral=true;
        assert.deepEqual(output,await deferred(part),'all-five deferred delivery and held EOF');r.deferredNeutral=true;
        assert.equal(output.screens.length,part.moves.length+1);assert.deepEqual(output.slices.flat(),output.calls);
        const req=recipe.branchRequirements[i],byStep=new Map(states.map(s=>[s.step,s])),buried=byStep.get(req.buriedStep),last=states.at(-1);
        const texts=output.screens.map(s=>decodeScreen(s).map(row=>row.map(renderCell).join('').trimEnd()).join('\n'));
        const messageSteps=texts.flatMap((text,step)=>text.includes('You sense something below your feet.')?[step]:[]);
        Object.assign(r,{buried,returns:req.returnSteps.map(step=>byStep.get(step)),final:last,messageSteps,stateSHA256:hash(states)});
        assert.equal(req.name,part.name);assert.ok(states.every(s=>s.hp>0&&!s.mortality),'survival at every boundary');
        assert.deepEqual(buried.xy,req.buriedXY);
        const expected=[{id:req.buriedId,typ:O.DAGGER,where:OBJ_BURIED,xy:req.buriedXY}];
        assert.deepEqual(buried.buriedHere,expected);assert.ok(!buried.floorIds.includes(req.buriedId));
        assert.ok(texts[req.buriedStep].includes('1 object buried.'),'real #wizbury feedback');
        for(const step of req.returnSteps){const before=byStep.get(step-1),after=byStep.get(step);
            assert.equal(part.moves[step-1],'l');assert.deepEqual(before.xy,[req.buriedXY[0]-1,req.buriedXY[1]]);
            assert.deepEqual(after.xy,req.buriedXY);assert.deepEqual(after.buriedHere,expected);assert.ok(!after.floorIds.includes(req.buriedId));
            assert.equal(after.turn,before.turn+1,'return is one actual movement turn');
            for(const key of ['dwarf','mounted','flying','levitation','polymorphed','blind','terrain','eligible'])assert.equal(after[key],req[key],`${key} on return`);
        }
        assert.deepEqual(messageSteps,req.messageSteps,'exact expected feedback boundaries');
        assert.deepEqual(last.xy,req.endXY);assert.equal(last.turn,req.endTurn);assert.deepEqual(last.buriedHere,expected);
        if(req.flying)assert.ok(last.inventory.some(o=>o.typ===O.AMULET_OF_FLYING&&(o.mask&W_AMUL)),'real worn flight amulet');
        if(req.levitation)assert.ok(last.inventory.some(o=>o.typ===O.RIN_LEVITATION&&(o.mask&W_RINGL)),'real worn levitation ring');
        if(req.blind)assert.ok(last.inventory.some(o=>o.typ===O.BLINDFOLD&&(o.mask&W_TOOL)),'real worn blindfold');
        assert.match(texts.at(-1),/MacOS NetHack Version 5\.0\.0/);assert.ok(!texts.join('\n').includes('You die'));
        if(req.negative)assert.deepEqual(r.hashes,recipe.unchangedOutputHashes[part.name],'all-five negative outputs remain fixed');
        r.pass=true;
    }catch(e){r.pass=false;r.error=e.message.slice(0,450);}
    results.push(r);
}
clearTimeout(bound);
const report={classification:'seven ordinary debug keyboard cases; real burial and equipment',nativeParityClaimed:false,total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error})),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
