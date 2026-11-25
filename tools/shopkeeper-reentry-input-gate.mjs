// Locked keyboard witnesses; C recording and native comparison belong to parent.
import assert from 'node:assert/strict';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
// BEGIN mandatory canonical C preflight. Gameplay imports and controls follow it.
const canonicalSHA=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonicalHash=value=>canonicalSHA(JSON.stringify(value));
const canonicalRecipeBytes=readFileSync(new URL('gen-sessions/recipes/shopkeeper-reentry-owner.json',import.meta.url));
assert.equal(canonicalSHA(canonicalRecipeBytes),'957d5155e32bba8097cb1f356729b044942e8feda15d364206a2d4c02683ad7a','primary recipe bytes');
const canonicalRecipe=JSON.parse(canonicalRecipeBytes);
const canonicalOriginalBytes=readFileSync(new URL('gen-sessions/evidence/shopkeeper-reentry-owner/recording-recipe.json',import.meta.url));
assert.equal(canonicalSHA(canonicalOriginalBytes),'e14c7ed6a103bf51af69675b083197f3bf4bbdbb010b1b151fe04637df4eb813','original recipe bytes');
const canonicalOriginal=JSON.parse(canonicalOriginalBytes);
const {requireBranchAssertions,branches,branchAssertions,...canonicalOriginalFields}=canonicalRecipe;
assert.deepEqual(canonicalOriginalFields,canonicalOriginal,'all original recipe fields, state requirements and negative hashes');
assert.equal(canonicalHash({requireBranchAssertions,branches,branchAssertions}),'4307c4d6645d32a7ae4e2578070b0381524af743aab8f4a8a2db71b74d314bef','primary branch metadata');
assert.equal(requireBranchAssertions,true);assert.equal(branches.length,4);assert.equal(branchAssertions.length,4);
assert.deepEqual(branches,canonicalRecipe.branchRequirements.map(r=>'shopkeeper-reentry.'+r.branch));
assert.deepEqual(branchAssertions.map(a=>[a.branch,a.segment]),branches.map((branch,i)=>[branch,i]));
const canonicalLockBytes=readFileSync(new URL('gen-sessions/evidence/shopkeeper-reentry-owner/input-lock.json',import.meta.url));
assert.equal(canonicalSHA(canonicalLockBytes),'c928e92bab4fd4b0c0f008fa0390829f2bbb77feed1b73d33253d8d398038019','original input lock bytes');
const canonicalLock=JSON.parse(canonicalLockBytes);
assert.equal(canonicalLock.recipeSHA256,canonicalSHA(canonicalOriginalBytes));
const canonicalFields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
const canonicalTuples=canonicalRecipe.segments.map(canonicalFields);
assert.equal(canonicalRecipe.segments.length,4);assert.equal(canonicalLock.cases.length,4);
assert.equal(canonicalHash(canonicalTuples),'182db55d431161efbd545209837c19571d9a999f919b6446e2c2d4fc847ac2a2','all five fields and presence');
assert.equal(canonicalLock.inputFieldsSHA256,canonicalHash(canonicalTuples));
assert.equal(canonicalLock.branchRequirementsSHA256,canonicalHash(canonicalRecipe.branchRequirements));
assert.equal(canonicalLock.negativeHashesSHA256,canonicalHash(canonicalRecipe.unchangedOutputHashes));
for(const [n,index,sha]of [['02',1,'fe394a3245b20831fd5d0370f2113aa263c6baf34980dec89ea290a2d02c058f'],['16',2,'1b875a64639b0afd35f9468e5019f91cb2cf8fed418d8ebe6c9bcafb198a89a9']]){
    const bytes=readFileSync(new URL(`gen-sessions/evidence/shopkeeper-reentry-owner/proposal-${n}.json`,import.meta.url));
    assert.equal(canonicalSHA(bytes),sha,'original setup proposal bytes');
    assert.deepEqual(canonicalFields(JSON.parse(bytes).segments[0]),canonicalTuples[index],'setup fields match original ordinary tuples');
}
// Accept only the exact canonical parent recording, without selectors or alternate paths.
const canonicalRawBytes=readFileSync(new URL('gen-sessions/generated/shopkeeper-reentry-owner.session.json',import.meta.url));
assert.equal(canonicalSHA(canonicalRawBytes),'fe782df3f2a31af72f27db6ac37e6f092780b2714ce609dcf9b35229c675e05b','exact canonical C raw bytes');
assert.equal(canonicalRawBytes.length,2864141);
const canonicalNative=JSON.parse(canonicalRawBytes);
assert.equal(canonicalNative.source,'c');assert.equal(canonicalNative.version,5);assert.equal(canonicalNative.segments.length,4);
assert.deepEqual(canonicalNative.segments.map(canonicalFields),canonicalTuples,'C input field presence and values');
for(const [i,part]of canonicalNative.segments.entries()){
    const input=canonicalRecipe.segments[i],locked=canonicalLock.cases[i];
    assert.equal(locked.name,input.name);assert.deepEqual(locked.fiveFields,canonicalFields(input));
    assert.equal(locked.fieldsSHA256,canonicalHash(canonicalFields(input)));
    assert.equal(locked.movesSHA256,canonicalSHA(Buffer.from(input.moves,'utf8')),'exact key bytes');assert.equal(locked.keys,input.moves.length);
    assert.ok(Array.isArray(part.steps)&&part.steps.length,'C boundaries are mandatory');
    assert.deepEqual(part.steps.map(step=>step.key),[null,...input.moves],'every recorded key and initial null boundary');
}
assert.equal(canonicalNative.segments.reduce((n,s)=>n+s.moves.length,0),629);
assert.equal(canonicalNative.segments.reduce((n,s)=>n+s.steps.length,0),633);
assert.deepEqual(recordingIntegrityErrors(canonicalNative),[],'canonical recording integrity');
assert.deepEqual(branchAssertionErrors(canonicalRecipe,canonicalNative),[],'all four primary C branches');
// END mandatory canonical C preflight.
const {runSegment}=await import('../js/jsmain.js');
const {InMemoryStorage}=await import('../js/storage.js');
const {inhishop}=await import('../js/monmove.js');
const {MONSYMS}=await import('../js/monst_data.js');
const {hash,hashes,outputs,deferred}=await import('./half-damage-reader-observe.mjs');
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/shopkeeper-reentry-owner.json',import.meta.url)));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(hash(recipe.segments.map(fields)),'182db55d431161efbd545209837c19571d9a999f919b6446e2c2d4fc847ac2a2');
assert.equal(hash(recipe.branchRequirements),'945a0e7f5b6b0e6368041ba846e206ac85dc6ed62be45ae35f6ec98b645c603d');
assert.equal(hash(recipe.unchangedOutputHashes),'92a4ea2ee713c9227bb3a5d7968fa652a5794619f982211dcacd31fcf0b6c14c');
const results=[],bound=setTimeout(()=>{console.error('55 second ordinary bound');process.exit(2);},55000);
for(const [i,part]of recipe.segments.entries()){
    const r={name:part.name,inputSHA256:hash(fields(part))},req=recipe.branchRequirements[i],states=[];
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    try{
        let output;
        try{
            globalThis.__step_snapshot={step:'*',cb(g,step){
                if(!g.u||!g.level)return;
                const m=g.level.monsters.find(m=>m.m_id===req.keeperID&&m.isshk),e=m?.eshk;
                states.push({step,turn:g.moves,xy:[g.u.ux,g.u.uy],hp:g.u.uhp,mortality:g.u.umortality||0,shops:g.u.ushops,
                    keeper:m?{xy:[m.mx,m.my],hp:m.mhp,following:!!e.following,peaceful:!!m.mpeaceful,inShop:!!inhishop(m),
                        distance:(m.mx-g.u.ux)**2+(m.my-g.u.uy)**2,billct:e.billct,robbed:e.robbed,
                        sentinel:e.bill_p===-1000,bill:Array.isArray(e.bill_p)?e.bill_p.slice(0,e.billct).map(b=>({...b})):null}:null,
                    leash:g.invent.filter(o=>o.o_id===113).map(o=>({id:o.o_id,unpaid:!!o.unpaid,quantity:o.quan})),
                    kops:g.level.monsters.filter(m=>m.mhp>0&&m.data?.mlet===MONSYMS.S_KOP).length});
            }};
            output=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
        Object.assign(r,{hashes:hashes(output),boundaries:output.screens.length,calls:output.calls.length,frames:output.frames.flat().length,stateSHA256:hash(states)});
        assert.deepEqual(output,outputs(await runSegment({...part,storage:new InMemoryStorage()})),'all-five observer neutrality');r.observerNeutral=true;
        assert.deepEqual(output,await deferred(part),'all-five deferred delivery and held EOF');r.deferredNeutral=true;
        assert.equal(output.screens.length,part.moves.length+1);assert.deepEqual(output.slices.flat(),output.calls);
        assert.equal(req.name,part.name);assert.ok(states.every(s=>s.hp>=req.minimumHP&&!s.mortality),'survival at every boundary');
        const at=step=>states.find(s=>s.step===step),last=states.at(-1);r.final=last;
        const text=output.screens.map(s=>decodeScreen(s).map(row=>row.map(renderCell).join('').trimEnd()).join('\n')).join('\n');
        if(req.branch!=='normal-return-pickup')assert.deepEqual(r.hashes,recipe.unchangedOutputHashes[part.name],'all-five matched negative outputs fixed');
        if(req.branch==='normal-return-pickup'){
            r.absent=at(184);r.returned=at(185);
            assert.deepEqual(r.absent.xy,[76,9]);assert.deepEqual(r.absent.keeper.xy,[72,10]);assert.equal(r.absent.keeper.inShop,false);
            assert.equal(r.absent.keeper.distance,17);assert.ok(r.absent.keeper.following);assert.equal(r.absent.keeper.billct,0);
            assert.match(text,/This shop is deserted\./);
            assert.deepEqual(r.returned.keeper.xy,[73,9]);assert.equal(r.returned.keeper.inShop,true);assert.equal(r.returned.keeper.distance,9);
            assert.equal(r.returned.shops,'\n','normal postmov repairs occupancy before the next keyboard command');
            assert.ok(r.absent.keeper.sentinel,'actual absent-entry producer sets C sentinel');
            assert.equal(last.shops,'\n');assert.equal(last.keeper.robbed,0);assert.equal(last.keeper.billct,1);
            assert.deepEqual(last.leash,[{id:113,unpaid:true,quantity:1}]);assert.equal(last.keeper.bill[0].bo_id,113);
            assert.ok(!text.includes('escaped the shop without paying'),'pickup inside the returned keeper shop is not remote burglary');
        }else if(req.branch==='tended-entry'){
            assert.equal(last.shops,'\n');assert.ok(last.keeper.inShop&&last.keeper.peaceful&&!last.keeper.following);assert.equal(last.keeper.billct,0);
        }else if(req.branch==='outside-no-reentry'){
            assert.deepEqual(last.xy,[72,11]);assert.deepEqual(last.keeper.xy,[72,10]);assert.equal(last.keeper.inShop,false);
            assert.ok(last.keeper.following);assert.equal(last.shops,'');assert.equal(last.keeper.sentinel,false);
        }else{
            assert.equal(req.branch,'absent-special-no-return');assert.deepEqual(last.xy,[74,10]);assert.deepEqual(last.keeper.xy,[72,10]);
            assert.equal(last.keeper.distance,4);assert.equal(last.keeper.inShop,false);assert.equal(last.shops,'');
            assert.ok(last.keeper.following);assert.equal(last.keeper.billct,0);assert.match(text,/This shop is deserted\./);
            assert.equal(last.keeper.sentinel,true,'producer positive, return-hook negative: special route cannot take this detour');
        }
        r.pass=true;
    }catch(e){r.pass=false;r.error=e.message.slice(0,450);}
    results.push(r);
}
clearTimeout(bound);
const report={classification:'ordinary keyboard, real shop generation, thrown-weapon pursuit and return; no injected state or map',nativeParityClaimed:false,total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error})),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
