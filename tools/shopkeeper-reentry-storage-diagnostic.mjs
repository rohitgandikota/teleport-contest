// Source diagnostics on real keyboard-produced keepers; one adjacent gap retained.
// Explicit C-storage fixtures below are constructed, never ordinary evidence.
import assert from 'node:assert/strict';
import {game as g} from '../js/gstate.js'; // Preserve the live game binding.
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
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
const {u_on_newpos}=await import('../js/teleport.js');
const {check_special_room}=await import('../js/hack.js');
const {vision_recalc}=await import('../js/vision.js');
const {inhishop,m_move}=await import('../js/monmove.js');
const {copy_mextra}=await import('../js/mon.js');
const {onbill,setpaid,subfrombill,after_shk_move,shk_move,restshk,
        pacify_shk,hot_pursuit,shopper_financial_report}=await import('../js/shk.js');
const {get_mtraits}=await import('../js/mkobj.js');
const {gamestate_encode,gamestate_decode}=await import('../js/save.js');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const recipe=n=>JSON.parse(readFileSync(new URL(`gen-sessions/evidence/shopkeeper-reentry-owner/proposal-${n}.json`,import.meta.url))).segments[0];
const results=[],bound=setTimeout(()=>{console.error('55 second diagnostic bound');process.exit(2);},55000);
async function fresh(kind='entered'){
    const part=recipe(kind==='outside'?'16':'02');
    if(kind==='billed')part.moves+=',  \x1b\x1b';
    const run=await runSegment({...part,storage:new InMemoryStorage()});
    let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<60);return 32;};
    g._preNhgetchHook=null;resetInputState();
    const mon=g.level.monsters.find(m=>m.m_id===97),e=mon.eshk;
    assert.ok(mon.isshk&&mon.mhp>0&&g.u.uhp>0&&!g.u.umortality);
    assert.equal(e.billct,kind==='billed'?1:0);
    return {mon,e,run,obj:g.invent.find(o=>o.o_id===110)};
}
async function enterAbsent(){
    const f=await fresh('outside');assert.equal(inhishop(f.mon),false);
    g.u.ux0=g.u.ux;g.u.uy0=g.u.uy;await u_on_newpos(76,9);vision_recalc();
    await check_special_room(false);assert.equal(g.u.ushops,'');return f;
}
function cStorage(e){
    // Model the missing C value field using the real current bill entries.
    // This assignment isolates contracts downstream of the absent producer.
    // Once the real entry owner sets the sentinel, keep its existing backing.
    // The unpatched runtime still needs the explicit constructed value field.
    if(e.bill_p!==-1000)e.bill=e.bill_p;
    assert.ok(Array.isArray(e.bill));return e.bill;
}
async function check(name,classification,body){
    const r={name,classification};try{await body(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,350);}results.push(r);
}
await check('generated keeper owns bill backing independently of bill_p','real ordinary generation',async()=>{
    const {e}=await fresh();assert.ok(Array.isArray(e.bill),'C eshk.bill value field exists');assert.equal(e.bill_p,e.bill);
});
await check('real unpaid pickup writes the keeper backing bill','real ordinary pickup',async()=>{
    const {e,obj}=await fresh('billed');assert.ok(obj.unpaid);assert.equal(e.bill_p,e.bill);assert.equal(e.bill[0].bo_id,obj.o_id);
});
await check('absent entry creates sentinel before returning','real public entry after constructed hero reposition',async()=>{
    const {e}=await enterAbsent();assert.equal(e.bill_p,-1000);
});
await check('ordinary following keeper selects normal movement','real ordinary pursuit; constructed hero reposition',async r=>{
    const {mon,e}=await enterAbsent();r.distance=(mon.mx-g.u.ux)**2+(mon.my-g.u.uy)**2;
    assert.equal(r.distance,17);assert.ok(e.following);assert.equal(e.billct,0);assert.equal(await shk_move(mon),-1);
});
await check('normal postmov restores pointer and occupancy after arrival','constructed C sentinel; real public m_move',async r=>{
    const {mon,e}=await enterAbsent(),bill=cStorage(e);e.bill_p=-1000;r.moves=[];
    for(let i=0;i<3&&!inhishop(mon);i++)r.moves.push(await m_move(mon,0));
    assert.ok(inhishop(mon),'actual movement reaches own shop boundary');r.xy=[mon.mx,mon.my];
    assert.equal(e.bill_p,bill);assert.equal(g.u.ushops,'\n');
});
await check('existing after_shk_move works with actual backing supplied','constructed C sentinel/backing; real helper',async()=>{
    const {mon,e}=await fresh(),bill=cStorage(e);e.bill_p=-1000;g.u.ushops='';
    await after_shk_move(mon);assert.equal(e.bill_p,bill);assert.equal(g.u.ushops,'\n');
});
await check('after_shk_move keeps absent pointer while outside','constructed C sentinel; real absent keeper',async()=>{
    const {mon,e}=await fresh('outside');cStorage(e);e.bill_p=-1000;
    await after_shk_move(mon);assert.equal(e.bill_p,-1000);assert.equal(g.u.ushops,'');
});
await check('gameover restores pointer without occupancy callback','constructed C sentinel/gameover; real helper',async()=>{
    const {mon,e}=await fresh(),bill=cStorage(e);e.bill_p=-1000;g.u.ushops='';g.program_state.gameover=true;
    await after_shk_move(mon);assert.equal(e.bill_p,bill);assert.equal(g.u.ushops,'');
});
await check('onbill does not dereference zero-count sentinel','constructed C sentinel; actual unpaid-free keeper',async()=>{
    const {mon,e}=await enterAbsent();e.bill_p=-1000;assert.equal(onbill(g.invent[0],mon,true),null);
});
await check('financial report handles zero-count absent resident','constructed C sentinel; public dollar-command owner',async()=>{
    const {e}=await enterAbsent();e.bill_p=-1000;await shopper_financial_report();
});
await check('pacify skips zero-count sentinel bill','constructed C sentinel; actual pursuit surcharge',async()=>{
    const {mon,e}=await enterAbsent();assert.ok(e.surcharge);e.bill_p=-1000;pacify_shk(mon,true);assert.equal(e.surcharge,false);
});
await check('hot_pursuit skips zero-count sentinel bill','constructed C sentinel; real pacify and pursuit',async()=>{
    const {mon,e}=await enterAbsent();pacify_shk(mon,true);e.bill_p=-1000;hot_pursuit(mon);assert.ok(e.following&&e.surcharge);
});
await check('setpaid clears count without replacing active storage','real ordinary bill; constructed backing alias',async()=>{
    const {mon,e,obj}=await fresh('billed'),bill=cStorage(e),before=structuredClone(bill);
    setpaid(mon);assert.equal(e.billct,0);assert.equal(obj.unpaid,0);assert.equal(e.bill_p,bill);assert.deepEqual(e.bill,before);
});
await check('setpaid preserves absent sentinel','constructed C zero-count sentinel; public reset',async()=>{
    const {mon,e}=await enterAbsent();cStorage(e);e.bill_p=-1000;setpaid(mon);assert.equal(e.billct,0);assert.equal(e.bill_p,-1000);
});
await check('copy_mextra value-copies backing and shallow-copies pointer','constructed C backing; actual public copy',async()=>{
    const {mon,e}=await fresh('billed'),bill=cStorage(e),other={};copy_mextra(other,mon);
    assert.notEqual(other.eshk.bill,bill);assert.deepEqual(other.eshk.bill,bill);assert.equal(other.eshk.bill_p,bill);
});
await check('restshk rebinds copied active pointer to own backing','constructed C backing; actual public copy and restore',async()=>{
    const {mon,e}=await fresh('billed');cStorage(e);const other={};copy_mextra(other,mon);
    restshk(other,false);assert.equal(other.eshk.bill_p,other.eshk.bill);assert.notEqual(other.eshk.bill_p,e.bill_p);
});
await check('save codec retains active backing alias and inactive sentinel','constructed C-shaped record; real graph codec',async()=>{
    const {e}=await fresh('billed');cStorage(e);
    const active=gamestate_decode(gamestate_encode(e));assert.equal(active.bill_p,active.bill);assert.notEqual(active.bill,e.bill);
    e.bill_p=-1000;const inactive=gamestate_decode(gamestate_encode(e));assert.equal(inactive.bill_p,-1000);assert.deepEqual(inactive.bill,e.bill);
});
await check('subfrombill decrements live count while keeping C value slot','real ordinary unpaid item; constructed backing alias',async()=>{
    const {mon,e,obj}=await fresh('billed'),bill=cStorage(e),before=structuredClone(bill);
    subfrombill(obj,mon);assert.equal(e.billct,0);assert.equal(obj.unpaid,0);assert.deepEqual(bill,before);
});
await check('get_mtraits copy retains C shallow bill pointer contract','constructed saved-traits record; real keeper and public copy',async()=>{
    const {mon,e}=await fresh('billed');cStorage(e);const obj={omonst:mon,oextra:{omonst:mon}};
    const copy=get_mtraits(obj,true);assert.notEqual(copy.eshk.bill,e.bill);assert.deepEqual(copy.eshk.bill,e.bill);assert.equal(copy.eshk.bill_p,e.bill_p);
});
clearTimeout(bound);
const report={classification:'source contract diagnostics; explicit C-shaped storage fixtures separate from ordinary inputs; adjacent get_mtraits gap retained',nativeParityClaimed:false,total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error})),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
