// Constructed prior customer, real pursuit/position/movement/message producers.
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
const {u_on_newpos}=await import('../js/teleport.js');
const {check_special_room}=await import('../js/hack.js');
const {vision_recalc}=await import('../js/vision.js');
const {inhishop,m_move}=await import('../js/monmove.js');
const {hot_pursuit}=await import('../js/shk.js');
const {pline}=await import('../js/display.js');
const {getRngLog}=await import('../js/rng.js');
const {hash}=await import('./half-damage-reader-observe.mjs');
const results=[],bound=setTimeout(()=>{console.error('55 second ordering bound');process.exit(2);},55000);
for(const newCustomer of [true,false]){
    const r={name:`normal reentry, new customer=${newCustomer}`};
    try{
        const part=JSON.parse(readFileSync(new URL('gen-sessions/evidence/shopkeeper-reentry-owner/proposal-16.json',import.meta.url))).segments[0];
        const run=await runSegment({...part,storage:new InMemoryStorage()});
        let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<30);return 32;};g._preNhgetchHook=null;resetInputState();
        const mon=g.level.monsters.find(m=>m.m_id===97),e=mon.eshk;
        assert.equal(inhishop(mon),false);assert.ok(e.following);assert.equal(e.billct,0);
        if(newCustomer){const name=g.plname;g.plname='PriorCustomer';hot_pursuit(mon);g.plname=name;assert.equal(e.customer,'PriorCustomer');}
        g.u.ux0=g.u.ux;g.u.uy0=g.u.uy;await u_on_newpos(76,9);vision_recalc();await check_special_room(false);
        // Supply only the C storage state to baseline too, to isolate the hook.
        if(!e.bill)e.bill=e.bill_p;e.bill_p=-1000;
        Object.assign(g,{_toplines:'',_msg_history:[],_toplin:0,_pending_message:'',_win_stop:false});g.iflags.last_msg=0;
        await pline('You pause to examine the floor carefully before taking another step.');
        let release,waiting,done=false;reads=0;const pending=new Promise(resolve=>{waiting=resolve;});
        run._display.onEmptyQueue=()=>{assert.ok(++reads<12);if(reads===1)return new Promise(resolve=>{release=resolve;waiting('input');});return 32;};
        const before=getRngLog().length;
        const operation=(async()=>{const moves=[];for(let i=0;i<3&&!inhishop(mon);i++)moves.push(await m_move(mon,0));done=true;return moves;})();
        const outcome=await Promise.race([pending,operation]);
        r.pending={done,reads,xy:[mon.mx,mon.my],shops:g.u.ushops,active:e.bill_p===e.bill,following:!!e.following,text:g._toplines,rng:getRngLog().slice(before)};
        if(release)release(32);r.moves=await operation;
        r.after={done,reads,xy:[mon.mx,mon.my],shops:g.u.ushops,active:e.bill_p===e.bill,following:!!e.following,text:[...g._msg_history,g._toplines].join('\n'),rng:getRngLog().slice(before)};
        assert.ok(inhishop(mon));assert.equal(r.after.active,true);assert.equal(r.after.shops,'\n');
        if(newCustomer){assert.equal(outcome,'input');assert.equal(r.pending.done,false);assert.equal(r.pending.active,true);assert.equal(r.pending.shops,'\n');
            assert.equal(r.pending.following,false);assert.ok(!r.pending.text.includes('Welcome'));assert.match(r.after.text,/Welcome/);
            assert.deepEqual(r.after.rng,r.pending.rng,'message acknowledgement itself adds no RNG after arrival');
        }else{assert.equal(r.pending.done,true);assert.equal(reads,0);assert.equal(!!e.following,true);assert.ok(!r.after.text.includes('Welcome'));}
        r.pass=true;
    }catch(e){r.pass=false;r.error=e.message.slice(0,400);}
    results.push(r);
}
clearTimeout(bound);
const report={classification:'constructed prior-customer/storage state, real public owners and actual pending input; no ordinary or native claim',total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error})),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
