// Constructed bill operations, using real generated shop and public producers.
import assert from 'node:assert/strict';
import {game as g} from '../js/gstate.js'; // Preserve the live binding; this module has no dependencies.
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
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
const {resetInputState}=await import('../js/input.js');
const {mksobj,splitobj,place_object}=await import('../js/mkobj.js');
const {addinv,useupall}=await import('../js/invent.js');
const {addtobill,onbill,subfrombill,setpaid,obfree_bill,globby_bill_fixup,doinvbill}=await import('../js/shk.js');
const {ONAMES: O}=await import('../js/objects_data.js');
const {BILLSZ,OBJ_ONBILL}=await import('../js/const.js');
const {getRngLog}=await import('../js/rng.js');
const {hash}=await import('./half-damage-reader-observe.mjs');
const results=[],bound=setTimeout(()=>{console.error('55 second mutation bound');process.exit(2);},55000);
async function fresh(){
    const part=JSON.parse(readFileSync(new URL('gen-sessions/evidence/shopkeeper-reentry-owner/proposal-02.json',import.meta.url))).segments[0];
    const run=await runSegment({...part,storage:new InMemoryStorage()});
    let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<60);return 32;};g._preNhgetchHook=null;resetInputState();
    const mon=g.level.monsters.find(m=>m.m_id===97);assert.ok(mon.isshk&&g.u.ushops);assert.equal(mon.eshk.billct,0);return mon;
}
async function billed(mon,type=O.DAGGER,quantity=1,floor=false){
    let obj=mksobj(type,true,false);obj.quan=quantity;
    if(floor)await place_object(obj,g.u.ux,g.u.uy);else obj=await addinv(obj);
    const prior=[...getRngLog()];await addtobill(obj,false,false,true);assert.deepEqual(getRngLog(),prior,'silent billing consumes no RNG');
    const entry=onbill(obj,mon,true);assert.ok(obj.unpaid&&entry);return {obj,entry};
}
async function check(name,body){const r={name};try{await body(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,400);}results.push(r);}
await check('remove first live record by value without moving slot identities',async()=>{
    const m=await fresh(),a=await billed(m),b=await billed(m,O.ELVEN_DAGGER),bill=m.eshk.bill_p,saved={...b.entry},rng=[...getRngLog()];
    subfrombill(a.obj,m);assert.equal(m.eshk.billct,1);assert.equal(onbill(a.obj,m,true),null);assert.equal(onbill(b.obj,m,true),a.entry);
    assert.equal(bill[0],a.entry);assert.equal(bill[1],b.entry);assert.notEqual(a.entry,b.entry);assert.deepEqual(a.entry,saved);
    assert.equal(bill.length,BILLSZ);assert.deepEqual(getRngLog(),rng);
});
await check('setpaid followed by append overwrites the same value slot',async()=>{
    const m=await fresh(),a=await billed(m),bill=m.eshk.bill_p,saved={...a.entry};setpaid(m);
    assert.equal(m.eshk.billct,0);assert.equal(onbill(a.obj,m,true),null);assert.deepEqual(a.entry,saved);
    const b=await billed(m,O.ELVEN_DAGGER);assert.equal(b.entry,a.entry);assert.equal(m.eshk.bill_p,bill);assert.equal(b.entry.bo_id,b.obj.o_id);assert.equal(m.eshk.billct,1);
});
await check('real splitobj writes next live bill slot and preserves unit price',async r=>{
    const m=await fresh(),a=await billed(m,O.DART,3),before=getRngLog().length,price=a.entry.price;
    const child=splitobj(a.obj,1),bp=onbill(child,m,true);r.rng=getRngLog().slice(before);
    assert.equal(r.rng.length,1);assert.match(r.rng[0],/^rnd\(2\)=[12]$/);assert.ok(child.unpaid);assert.equal(m.eshk.billct,2);
    assert.equal(a.entry.bquan,2);assert.equal(bp.bquan,1);assert.equal(bp.price,price);assert.equal(bp,m.eshk.bill_p[1]);assert.equal(m.eshk.bill_p.length,BILLSZ);
});
await check('real split at BILLSZ makes only the child free',async()=>{
    const m=await fresh();let first;
    for(let i=0;i<BILLSZ;i++){const b=await billed(m,O.DART,i?1:3,true);first||=b;}
    const child=splitobj(first.obj,1);assert.equal(m.eshk.billct,BILLSZ);assert.equal(first.entry.bquan,2);
    assert.ok(first.obj.unpaid);assert.equal(child.unpaid,0);assert.equal(onbill(child,m,true),null);
});
await check('merge bookkeeping keeps slots and combines billed quantity',async()=>{
    const m=await fresh(),a=await billed(m,O.DART,3),child=splitobj(a.obj,1),last=onbill(child,m,true),rng=[...getRngLog()];
    assert.equal(obfree_bill(child,a.obj),false);assert.equal(m.eshk.billct,1);assert.equal(a.entry.bquan,3);
    assert.equal(m.eshk.bill_p[1],last);assert.equal(onbill(child,m,true),null);assert.equal(m.eshk.bill_p.length,BILLSZ);assert.deepEqual(getRngLog(),rng);
});
await check('real useup retains bill-only object and reset excludes stale entries',async()=>{
    const m=await fresh(),a=await billed(m,O.APPLE);useupall(a.obj);
    assert.equal(a.obj.where,OBJ_ONBILL);assert.ok(a.entry.useup);assert.equal(await doinvbill(0),1);
    setpaid(m);assert.equal(await doinvbill(0),0);assert.equal(m.eshk.billct,0);assert.equal(m.eshk.bill_p.length,BILLSZ);
});
for(const absorberFirst of [true,false])await check(`glob absorption retains C slot-address ordering: absorberFirst=${absorberFirst}`,async r=>{
    const m=await fresh(),a=await billed(m,O.GLOB_OF_GRAY_OOZE),b=await billed(m,O.GLOB_OF_BROWN_PUDDING);
    const absorber=absorberFirst?a:b,absorbed=absorberFirst?b:a,pa=absorber.entry.price,pb=absorbed.entry.price,slots=m.eshk.bill_p.slice(0,2),before=getRngLog().length;
    await globby_bill_fixup(absorber.obj,absorbed.obj);r.rng=getRngLog().slice(before);
    assert.equal(m.eshk.billct,1);assert.equal(onbill(absorbed.obj,m,true),null);
    // C clear_unpaid_obj runs after removal, finds no live entry and leaves
    // this flag set. The caller has not yet disposed of the absorbed object.
    assert.equal(absorbed.obj.unpaid,1);
    assert.equal(m.eshk.bill_p[0],slots[0]);assert.equal(m.eshk.bill_p[1],slots[1]);assert.notEqual(slots[0],slots[1]);
    assert.equal(onbill(absorber.obj,m,true).price,absorberFirst?pa+pb:pa,'C cached absorber pointer can address the now inactive last slot');
    assert.equal(absorber.entry.price,pa+pb);assert.deepEqual(r.rng,[]);assert.equal(m.eshk.bill_p.length,BILLSZ);
});
clearTimeout(bound);
const report={classification:'constructed bill operations with real public startup/object/billing/split/consume producers; no native claim',total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
