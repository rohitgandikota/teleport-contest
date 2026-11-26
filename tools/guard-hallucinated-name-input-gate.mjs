// Complete ordinary gate. Mandatory metadata preflight precedes all game imports.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
assert.ok(process.argv.length<=3 && (process.argv[2]===undefined
    || (process.argv[2] && !process.argv[2].startsWith('-'))),
    'usage: guard-hallucinated-name-input-gate.mjs [new-compact-report.json]; no selectors');
const reportPath=process.argv[2] || null;
assert.ok(!reportPath || !existsSync(reportPath),'report path must be new');
const sha=b=>createHash('sha256').update(b).digest('hex');
const evidence='gen-sessions/evidence/guard-hallucinated-name/';
const pins={
    "README.md": "f640c8824142b661de8397eb09f05a1d036ea725a4d23cab59eb88eac8963243",
    "SOURCE-REVIEW.md": "6c3553861a058c50804e453011e760aa1461926a4a23c58726434f29d252fb8e",
    "blind-stack.log": "80d408c12081b6d050b0443fda5798a395cdebecb9bb0baee6759bbed8c49c4f",
    "candidate-trace.json": "f279d906772f395170b3276ac1d5101f05886837391c3e3e4843912537e78bb7",
    "initial-observer-failure.json": "d17dac3cf248d679e1696773e2b0c3ebc4c22428479863da3b2f2ddde373ce1f",
    "initial-observer-results.json": "3f5d96ed79ecc9e138720cf1b3156d8ba10c36de540fb45e63c0fbdcc8cb25de",
    "initial-setup-failure.json": "04af32f57f5158131bf01aaa6c679a6c246e14cd0347fd9a233e41d20c2cdb51",
    "input-lock.json": "33c5a0e39b5cf78788fa3987a4135b658b93cb3649c1e0c6e123cb7bab4ed25e",
    "observation-derivation.json": "fcce6578c71a100229407e6ecb833abb33040456923b5353e622eb4816752a16",
    "observations.json": "aba0b77c4ecb10bfdb60156eecddec17b43d0bc6a7772a7aa174be2cc108f12f",
    "observer-original.mjs": "4aab46804d98df9f3192e39c33c29992c9c1eaa7b5e15c8ed48777c8cbeebc23",
    "ordinary-controls-original.mjs": "e00313e155903099fc796ba410b2fcf4b825eda8046f333fbea8a027542fe188",
    "original-recipe.json": "c09d559e4ecb157f176b65db3ee3c2f2fbe9079d829c5dbf5ea3e39828c28a8e",
    "owner-input-lock.json": "486ed4fcb219776308c5fabc856883671676dc99322d2ac6cec666c6d71bec02",
    "parent-native-checks.json": "0576738b739b455978780d3bab53fd2c13a64aea842d5f2ec598d360935dd7cb",
    "parked-stack.log": "59baf991cd74a75fb48a05726d08e7b3c86d1bbe3bd4f8eed6e4f4a64a64b9e2",
    "pre-candidate-lock.json": "d57dfd52b6d674183d0f0fc521d87975da0b0aec07b2e7d53c36287fc83da47d",
    "recipe-derivation.json": "6ce0832bc91708117b11b00c086e19de8b1ec164a386e0d2cd990f9d593b994e",
    "recording-receipt.json": "a6a592c3b81cf3045be08c8314f53d95455b638caf1dc1037ce376227db45fa6",
    "source-provenance.json": "0bc6733810b85a692ac0b1cf5fc092b908b38b446be19f569885b758df7a9320",
    "source-trace.json": "57f132d883c38dfa8bf3030a0f45ac1b5395226776dc6ad7b990cffcad24d26a"
};
function pinned(path,digest) {
    const bytes=readFileSync(new URL(path,import.meta.url));
    assert.equal(sha(bytes),digest,'exact tracked evidence: '+path);
    return bytes;
}
for(const [name,digest] of Object.entries(pins))pinned(evidence+name,digest);
const evidenceJson=name=>JSON.parse(pinned(evidence+name,pins[name]));
pinned('half-damage-reader-observe.mjs','201cdafe4409d5d58414c1d0ebc0449c32b29834cdf35c72c151a555d9031d07');
pinned('gen-sessions/assertions.mjs','aed2dfe01e18cb2e8b0d62e389ab9d8a9c02b0e3e98d4e427fcead4c228e3adc');
pinned('gen-sessions/screen-decode.mjs','0831fd4db121dab1d3c8f80efac29c68ce50f67fedbb49f2bd7c21371244dae0');
const recipe=JSON.parse(pinned('gen-sessions/recipes/guard-hallucinated-name.json',
    'f7c36bc50d7c92a2c8ebc69940a4707b76212de900932b6060e5e6bc8660400f'));
const originalRecipe=evidenceJson('original-recipe.json');
const lock=evidenceJson('input-lock.json');
const ownerLock=evidenceJson('owner-input-lock.json');
const prelock=evidenceJson('pre-candidate-lock.json');
assert.equal(lock.candidateExisted,false);assert.equal(prelock.candidateExisted,false);
assert.equal(lock.recipeSHA256,pins['original-recipe.json']);
assert.equal(ownerLock.sourceLockSHA256,pins['input-lock.json']);
assert.equal(ownerLock.recipeSHA256,'f7c36bc50d7c92a2c8ebc69940a4707b76212de900932b6060e5e6bc8660400f');
assert.equal(prelock.files['tools/ordinary-controls.mjs'].sha256,pins['ordinary-controls-original.mjs']);
assert.deepEqual(recipe.segments,originalRecipe.segments,'six original tuples unchanged');
assert.deepEqual(lock.inputFields,['name','seed','datetime','nethackrc','moves']);
const fields=part=>Object.fromEntries(lock.inputFields.map(field=>
    [field,{present:Object.hasOwn(part,field),value:part[field]}]));
const tuples=recipe.segments.map(fields);
assert.equal(tuples.length,6);
assert.ok(tuples.every(tuple=>Object.values(tuple).every(f=>f.present)));
assert.deepEqual(tuples,lock.tuples,'all five values and field presence');
assert.equal(sha(JSON.stringify(tuples)),'0dec7414df643620f80b6c8dde5f59f81ca908e247b8b591b6ab07c0e08fefb7');
assert.equal(lock.tupleSHA256,ownerLock.tupleSHA256);
assert.deepEqual([lock.cases,lock.keys,lock.boundaries],[6,1337,1343]);
const derivation=evidenceJson('recipe-derivation.json');
assert.equal(derivation.originalRecipeSHA256,pins['original-recipe.json']);
assert.equal(derivation.derivedRecipeSHA256,ownerLock.recipeSHA256);
assert.equal(derivation.segmentsUnchanged,true);
assert.equal(derivation.tupleSHA256,lock.tupleSHA256);
const expectedProbes=evidenceJson('observations.json').results;
assert.equal(expectedProbes.length,6);
assert.equal(evidenceJson('observation-derivation.json').derivedSHA256,pins['observations.json']);
assert.deepEqual(Object.keys(lock.negativeHashes),[recipe.segments[0].name,
    recipe.segments[4].name,recipe.segments[5].name]);
assert.deepEqual(lock.negativeHashes,ownerLock.negativeHashes);
for(const [name,hashes] of Object.entries(lock.negativeHashes)) {
    assert.deepEqual(Object.keys(hashes),['screens','cursors','calls','slices','frames']);
    assert.deepEqual(hashes,expectedProbes.find(p=>p.name===name).hashes,'all15 original negative hashes');
}
const sourceTrace=evidenceJson('source-trace.json').rows;
const candidateTrace=evidenceJson('candidate-trace.json').rows;
assert.equal(sourceTrace.length,4);assert.equal(candidateTrace.length,6);
assert.ok(sourceTrace[3].namingDraws.length>0);
assert.deepEqual(candidateTrace[3].namingDraws,[]);
assert.ok(sourceTrace[1].namingDraws.some(d=>d.step>211));
assert.ok(candidateTrace[1].namingDraws.every(d=>d.step===211));
assert.deepEqual(candidateTrace[1].namingDraws,candidateTrace[2].namingDraws,
    'hidden policy retains required name argument');
assert.ok(candidateTrace.every(r=>r.loggingNeutral));
assert.equal(evidenceJson('initial-setup-failure.json').inputsChanged,false);
assert.equal(evidenceJson('initial-observer-failure.json').runtimeChanged,false);
assert.ok(evidenceJson('initial-observer-results.json').results.every(r=>r.error?.name==='TypeError'));
// Source/build paths in provenance and recording receipts are historical data only.
// No historical C checkout, recorder, snapshot or cache is needed by this gate.
assert.equal(recipe.requireBranchAssertions,true);
assert.equal(recipe.branches.length,6);assert.equal(recipe.branchAssertions.length,6);
assert.deepEqual(recipe.branchAssertions.map(a=>[a.branch,a.segment]),
    recipe.branches.map((b,i)=>[b,i]));
assert.deepEqual(branchAssertionErrors(recipe),[]);
const rawBytes=pinned('gen-sessions/generated/guard-hallucinated-name.session.json',
    'a68e3eaf35cfbf52cafa3b562e9e46b19e0459fa587be0820be9a045606cbd10');
assert.equal(rawBytes.length,5369894);
const raw=JSON.parse(rawBytes);
assert.equal(raw.source,'c');assert.equal(raw.version,5);
assert.equal(raw.segments.length,6);
assert.deepEqual(raw.segments.map(fields),tuples,'C field presence and exact values');
for(const [i,part] of raw.segments.entries())
    assert.deepEqual(part.steps.map(s=>s.key),[null,...recipe.segments[i].moves],
        'every input key including initial null boundary');
assert.equal(raw.segments.reduce((n,s)=>n+s.moves.length,0),1337);
assert.equal(raw.segments.reduce((n,s)=>n+s.steps.length,0),1343);
assert.equal(raw.segments.flatMap(s=>s.steps).reduce((n,s)=>n+(s.rng||[]).length,0),39082);
assert.equal(raw.segments.flatMap(s=>s.steps).reduce((n,s)=>n+(s.animation_frames||[]).length,0),0);
assert.deepEqual(recordingIntegrityErrors(raw),[],'canonical C recording integrity');
assert.deepEqual(branchAssertionErrors(recipe,raw),[],'all six original primary C branches');
const nativePreflight={source:'c',version:5,sha256:'a68e3eaf35cfbf52cafa3b562e9e46b19e0459fa587be0820be9a045606cbd10',
    cases:6,keys:1337,boundaries:1343,calls:39082,frames:0,branches:6};
const root=new URL('../',import.meta.url);
const {runSegment}=await import(new URL('js/jsmain.js',root));
const {InMemoryStorage}=await import(new URL('js/storage.js',root));
const {outputs,hashes,deferred}=await import('./half-damage-reader-observe.mjs');
const {Hallucination,Blind}=await import(new URL('js/youprop.js',root));
const {canspotmon}=await import(new URL('js/display.js',root));
const stateHash=value=>sha(JSON.stringify(value,
    (_key,v)=>typeof v==='bigint' ? v.toString() : v));
async function observeCurrent(part) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let run, error = null;
    try {
        globalThis.__step_snapshot = {step:'*',cb(g, step) {
            if (step < 180 || !g.u || !g.level) return;
            const guard = g.level.monsters.find(m => m.isgd);
            const egd = guard?.mextra?.egd;
            states.push({step, key:part.moves[step - 1], turn:g.moves,
                hero:[g.u.ux,g.u.uy], hallu:Hallucination(), blind:Blind(),
                timeouts:[g.u.intrinsic?.HHallucination || 0,g.u.intrinsic?.HBlinded || 0],
                top:g.nhDisplay.grid[0].map(c=>c.ch).join('').trimEnd(),
                logical:g._toplines, impossible:g.program_state.in_impossible || 0,
                displayRngHash:stateHash(g.dispCtx || null),
                guard:guard ? {id:guard.m_id,xy:[guard.mx,guard.my],hp:guard.mhp,
                    spot:canspotmon(guard),peaceful:guard.mpeaceful,state:guard.mstate,
                    done:egd.gddone,begin:egd.fcbeg,end:egd.fcend,
                    heroInCorridor:Array.isArray(egd.fakecorr)
                        ? egd.fakecorr.slice(egd.fcbeg,egd.fcend)
                            .some(c=>c.fx===g.u.ux && c.fy===g.u.uy) : null} : null});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } catch (e) { error = {name:e.name,message:e.message}; }
    finally {
        if (previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    const out = run ? outputs(run) : null;
    return {name:part.name,keys:part.moves.length,error,
        boundaries:out?.screens.length,calls:out?.calls.length,
        hashes:out ? hashes(out) : null,
        allKeysCaptured:out?.screens.length===part.moves.length+1,states};
}
const probes=[];
const observerTimer=setTimeout(()=>{throw new Error('bounded passive observation exceeded55s');},55000);
try {
    for(const [i,part] of recipe.segments.entries()) {
        const live=await observeCurrent(part);
        assert.equal(expectedProbes[i].name,part.name);
        assert.deepEqual(live.hashes,expectedProbes[i].hashes,
            'exact immutable output hashes: '+part.name);
        probes.push(live);
    }
} finally {clearTimeout(observerTimer);}
// BEGIN ORIGINAL ORDINARY CONTROL BODY
const results=[],rows=[];
function check(name,fn) {try {fn();results.push({name,pass:true});}
    catch(e) {results.push({name,pass:false,error:e.message.slice(0,700)});}}
const timer=setTimeout(()=>{throw new Error('bounded ordinary controls exceeded55s');},55000);
try {
    for(const [i,part] of recipe.segments.entries()) {
        const probe=probes[i];
        const plain=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        const held=await deferred(part);
        const plainHashes=hashes(plain),heldHashes=hashes(held);
        check(part.name+': observer neutral',()=>assert.deepEqual(plainHashes,probe.hashes));
        check(part.name+': deferred and exhausted input equal',()=>assert.deepEqual(heldHashes,plainHashes));
        check(part.name+': every key and RNG boundary retained',()=>{
            assert.equal(plain.screens.length,part.moves.length+1);
            assert.deepEqual(plain.slices.flat(),plain.calls);
            assert.equal(probe.error,null);assert.equal(probe.allKeysCaptured,true);
        });
        check(part.name+': real guard and property producers',()=>{
            const before=probe.states.find(s=>s.step===187);
            assert.equal(before.guard.id,122);assert.equal(before.guard.done,0);
            assert.deepEqual(before.guard.xy,[27,5]);assert.equal(before.hallu,false);
            assert.equal(probe.states.at(-1).hallu,i!==0);
            assert.equal(probe.states.at(-1).blind,i===3||i===5);
        });
        check(part.name+': cleanup branch or paired prefix',()=>{
            const first=probe.states.find(s=>s.guard?.done);
            if(i>=4) {assert.equal(first,undefined);assert.equal(probe.states.at(-1).guard.done,0);}
            else {
                assert.equal(first.step,[188,211,211,215][i]);
                assert.equal(first.guard.id,122);assert.equal(first.guard.hp,47);
                assert.deepEqual(first.guard.xy,[0,0]);assert.equal(first.guard.heroInCorridor,true);
                assert.equal(probe.states.at(-1).guard,null);
                if(i<2) assert.ok(first.top.startsWith('Suddenly, '));
                else assert.ok(first.top.startsWith('newsym: attempting screen update'));
            }
        });
        rows.push({name:part.name,keys:part.moves.length,boundaries:plain.screens.length,
            calls:plain.calls.length,hashes:plainHashes,deferredHashes:heldHashes});
    }
} finally {clearTimeout(timer);}
const report={classification:'Ordinary keyboard reach only; no candidate or native comparison',
    passed:results.filter(r=>r.pass).length,total:results.length,results,rows};
// END ORIGINAL ORDINARY CONTROL BODY
const compact={...report,classification:'Ordinary keyboard controls with canonical C metadata preflight; no native replay',nativePreflight};
if(reportPath)writeFileSync(reportPath,JSON.stringify(compact,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:report.passed,total:report.total,cases:report.rows.length}));
if(report.passed!==30 || report.total!==30)process.exitCode=1;
