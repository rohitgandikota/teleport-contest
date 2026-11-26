// Mandatory tracked metadata preflight precedes every game import.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
assert.ok(process.argv.length<=3 && (process.argv[2]===undefined
    || (process.argv[2] && !process.argv[2].startsWith('-'))),
    'usage: guard-restored-entry-input-gate.mjs [new-compact-report.json]; no selectors');
const reportPath=process.argv[2] || null;
assert.ok(!reportPath || !existsSync(reportPath),'report path must be new');
const sha=b=>createHash('sha256').update(b).digest('hex');
const evidence='gen-sessions/evidence/guard-restored-entry/';
function pinned(path,digest) {
    const bytes=readFileSync(new URL(path,import.meta.url));
    assert.equal(sha(bytes),digest,'exact tracked evidence: '+path);
    return bytes;
}
const pins={
    "README.md": "6f160d0f84a8993c1193a30f56e1b53af4dcf7dc9a4895f23deabb08bc383425",
    "SOURCE-REVIEW.md": "8d82515dec4772c3dc4218969f780db0f528cbeaa9b79aa08ffb25c469bf1391",
    "baseline-ordinary.json": "719d0262f02900fbb883201d5bce8c7b4398474de2a49bdebd6fdcee82a53c3b",
    "candidate-ordinary.json": "9c21ba0dccca9946cca0ed60afdfd12966985cea8a9daf7a749c7003fc233773",
    "candidate-trace.json": "b41a5827451802cb619f5484d8bd76776dc570e811d39a9a127885eac6b5cb9f",
    "causal-controls.json": "5490a313ac92e2b72ff5c000facf38134e0aabae6aeb40c1f73ef8b2a05be2fe",
    "implementation-lock.json": "217b635b82e3069f8212035f495ec5bd8dd1f628a2a70bfd6cad961881969967",
    "initial-proposal-limit.json": "29b5206c22cca1b58d58fcb7c7528203813e8c313bb890bdd38f40902e59804a",
    "initial-proposal.json": "54a5f2ab07097f0a926a781641d02fdf455792ba04478b814d9240afb36c79e8",
    "input-lock.json": "168468130efc663c2bef05a2488ac3b50ca26f3e24bfe41cb6776a56f78edaf8",
    "native-branch-checks.json": "abd1115c5b02d2532539248d286c021b602e0c18e2a9890c4adeb4c7845e8c72",
    "native-checks.json": "14a88f45d1ae847a53b18fbefb299563d28a7405a4cafc873c508411c39803d2",
    "observer-original.mjs": "6b0c30bca27b7a680601555cc52623885c8c76d0b689b2239e12a78015ed1784",
    "ordinary-controls-original.mjs": "7130c14c57e9b54cabaf00da9f5090975d66327d431d74ee09be79ed4dd86f33",
    "original-proposals.json": "b228f00d8b4845919b536095ca99d2ea92d55597a93b3b4761a1459567f52eb7",
    "pre-candidate-lock.json": "7ed2f7f55ee6fa4ec125550da6c3c8513e0ec8f013b724763d84e42b6d84cde8",
    "recording-receipt.json": "0b2e1d1f3e882cb4e2652b950b6fc2f87aff58de99a535f3d16c2ccfd9424766",
    "source-provenance.json": "4b4053f6c3be5cce32d0aec4408bdb486bc5827ca2b7be4ec64f9c316ec7dddd",
    "source-trace.json": "736f06f39591b63b77072da649536769e360fc226ba060d88ed9600b8b221860"
};
for(const [name,digest] of Object.entries(pins))pinned(evidence+name,digest);
const read=name=>JSON.parse(pinned(evidence+name,pins[name]));
pinned('half-damage-reader-observe.mjs','201cdafe4409d5d58414c1d0ebc0449c32b29834cdf35c72c151a555d9031d07');
pinned('gen-sessions/assertions.mjs','aed2dfe01e18cb2e8b0d62e389ab9d8a9c02b0e3e98d4e427fcead4c228e3adc');
pinned('gen-sessions/screen-decode.mjs','0831fd4db121dab1d3c8f80efac29c68ce50f67fedbb49f2bd7c21371244dae0');
const recipe=JSON.parse(pinned('gen-sessions/recipes/guard-restored-entry.json',
    '1cbf009a45ecfaeafea96d4e1fbc1cbfff010fd1fef286212dac115de3ed0ed2'));
const lock=read('input-lock.json'),prelock=read('pre-candidate-lock.json');
const implementation=read('implementation-lock.json');
assert.equal(lock.candidateExisted,false);assert.equal(lock.final,true);
assert.equal(prelock.candidateExisted,false);assert.equal(implementation.candidateExisted,false);
assert.equal(prelock.inputLockSHA256,pins['input-lock.json']);
assert.equal(implementation.files['review/input-lock.json'].sha256,pins['input-lock.json']);
assert.equal(implementation.files['review/pre-candidate-lock.json'].sha256,pins['pre-candidate-lock.json']);
assert.equal(implementation.files['tools/ordinary-controls.mjs'].sha256,pins['ordinary-controls-original.mjs']);
assert.equal(implementation.files['tools/observer.mjs'].sha256,pins['observer-original.mjs']);
assert.equal(lock.recipeSHA256,'1cbf009a45ecfaeafea96d4e1fbc1cbfff010fd1fef286212dac115de3ed0ed2');
assert.equal(lock.sourceProposalSHA256,pins['original-proposals.json']);
assert.equal(prelock.files['ordinary/proposals-01.json'].sha256,pins['initial-proposal.json']);
assert.deepEqual(recipe.segments,read('original-proposals.json').segments);
assert.deepEqual(lock.inputFields,['name','seed','datetime','nethackrc','moves']);
const fields=part=>Object.fromEntries(lock.inputFields.map(f=>
    [f,{present:Object.hasOwn(part,f),value:part[f]}]));
const tuples=recipe.segments.map(fields);
assert.equal(tuples.length,5);
assert.ok(tuples.every(tuple=>Object.values(tuple).every(f=>f.present)));
assert.deepEqual(tuples,lock.tuples,'all five original field values and presence');
assert.equal(sha(JSON.stringify(tuples)),'7f8a9386e775d7b528b8aeb078f0a9d82428ecec43e1cd78b78c757d9151db84');
assert.equal(lock.tupleSHA256,'7f8a9386e775d7b528b8aeb078f0a9d82428ecec43e1cd78b78c757d9151db84');
assert.deepEqual([lock.cases,lock.keys,lock.boundaries],[5,1072,1077]);
assert.deepEqual(Object.keys(lock.negativeHashes),recipe.segments.slice(2).map(s=>s.name));
const initial=read('baseline-ordinary.json'),expected=read('candidate-ordinary.json');
assert.deepEqual([initial.passed,initial.total,expected.passed,expected.total],[26,28,28,28]);
assert.deepEqual(initial.results.filter(r=>!r.pass).map(r=>r.name),
    recipe.segments.slice(0,2).map(s=>s.name+': C cleanup policy or paired negative'));
assert.deepEqual(initial.results.map(r=>r.name),expected.results.map(r=>r.name));
assert.ok(expected.results.every(r=>r.pass));
for(const [name,hashes] of Object.entries(lock.negativeHashes)) {
    assert.deepEqual(Object.keys(hashes),['screens','cursors','calls','slices','frames']);
    assert.deepEqual(hashes,initial.rows.find(r=>r.name===name).hashes);
    assert.deepEqual(hashes,expected.rows.find(r=>r.name===name).hashes,'all15 negative hashes');
}
const initialLimit=read('initial-proposal-limit.json');
assert.equal(initialLimit.firstEligibleStep,205);assert.equal(initialLimit.turn,44);
assert.equal(initialLimit.runtimeChanged,false);
const sourceTrace=read('source-trace.json').rows,candidateTrace=read('candidate-trace.json').rows;
assert.equal(sourceTrace.length,5);assert.equal(candidateTrace.length,5);
for(let i=0;i<5;i++) {
    assert.equal(sourceTrace[i].name,recipe.segments[i].name);
    assert.equal(candidateTrace[i].name,recipe.segments[i].name);
    assert.ok(sourceTrace[i].loggingNeutral&&candidateTrace[i].loggingNeutral);
    assert.deepEqual(sourceTrace[i].hashes,initial.rows[i].hashes);
    assert.deepEqual(candidateTrace[i].hashes,expected.rows[i].hashes);
    if(i<2) {
        assert.deepEqual(sourceTrace[i].guardCalls.map(c=>c.step),[205,211,217]);
        assert.deepEqual(candidateTrace[i].guardCalls.map(c=>c.step),[205]);
    }
}
const causal=read('causal-controls.json');
assert.deepEqual([causal.passed,causal.total],[15,15]);
assert.ok(causal.results.every(r=>r.pass));
// Historical C/build/cache paths in these records are provenance data only.
const provenance=read('source-provenance.json'),recording=read('recording-receipt.json');
assert.equal(provenance.sourceSealSHA256,'8d141acab774cba57edf58c0f40dad75a7a727d4e0b95639dc537b4896b5c7c3');
assert.equal(provenance.inputLockSHA256,pins['input-lock.json']);
assert.equal(recording.exit,0);assert.equal(recording.cExecutedOnce,true);
assert.equal(recording.primaryRecipeSHA256,lock.recipeSHA256);
assert.equal(recording.rawSha256,'0b8294748f93709831d4333e04df9bd1ebd173d6049c6bf4d6015d446c542d11');
assert.equal(recording.fiveInputFieldsAndPresencePreserved,true);assert.equal(recording.allKeysExact,true);
const nativeChecks=read('native-checks.json');
assert.deepEqual(nativeChecks.map(r=>[r.runtime,r.exact,r.total,r.exit]),[
    ['source-baseline',3,5,1],['source-candidate',5,5,0],
    ['published-baseline',3,5,1],['composed',5,5,0]]);
assert.equal(nativeChecks[1].reportSHA256,nativeChecks[3].reportSHA256);
assert.equal(nativeChecks[1].reportSHA256,'1fcc9928edc130cb1c784161c9b85a421f6fb35531b214e15adde78bc005c475');
assert.equal(recipe.requireBranchAssertions,true);
assert.equal(recipe.branches.length,5);assert.equal(recipe.branchAssertions.length,5);
assert.deepEqual(recipe.branchAssertions.map(a=>[a.branch,a.segment]),recipe.branches.map((b,i)=>[b,i]));
assert.deepEqual(branchAssertionErrors(recipe),[]);
assert.deepEqual(read('native-branch-checks.json'),{integrityErrors:[],branchErrors:[],primaryBranches:5});
const rawBytes=pinned('gen-sessions/generated/guard-restored-entry.session.json',
    '0b8294748f93709831d4333e04df9bd1ebd173d6049c6bf4d6015d446c542d11');
assert.equal(rawBytes.length,4410858);
const raw=JSON.parse(rawBytes);
assert.equal(raw.source,'c');assert.equal(raw.version,5);assert.equal(raw.segments.length,5);
assert.deepEqual(raw.segments.map(fields),tuples,'canonical C fields, presence and values');
for(const [i,part] of raw.segments.entries())
    assert.deepEqual(part.steps.map(s=>s.key),[null,...recipe.segments[i].moves],'every input key');
assert.equal(raw.segments.reduce((n,s)=>n+s.moves.length,0),1072);
assert.equal(raw.segments.reduce((n,s)=>n+s.steps.length,0),1077);
assert.equal(raw.segments.flatMap(s=>s.steps).reduce((n,s)=>n+(s.rng||[]).length,0),32428);
assert.equal(raw.segments.flatMap(s=>s.steps).reduce((n,s)=>n+(s.animation_frames||[]).length,0),0);
assert.deepEqual(recordingIntegrityErrors(raw),[],'canonical C recording integrity');
assert.deepEqual(branchAssertionErrors(recipe,raw),[],'all five original primary C branches');
const nativePreflight={source:'c',version:5,sha256:'0b8294748f93709831d4333e04df9bd1ebd173d6049c6bf4d6015d446c542d11',
    cases:5,keys:1072,boundaries:1077,calls:32428,frames:0,branches:5};
const root=new URL('../',import.meta.url);
const {runSegment}=await import(new URL('js/jsmain.js',root));
const {InMemoryStorage}=await import(new URL('js/storage.js',root));
const {couldsee,cansee}=await import(new URL('js/vision.js',root));
const {money_cnt,hidden_gold}=await import(new URL('js/invent.js',root));
const {outputs,hashes,deferred}=await import('./half-damage-reader-observe.mjs');
// BEGIN ORIGINAL OBSERVER
async function observed(part) {
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states=[];let run,error=null;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step) {
            if(step<180||!g.u||!g.level)return;
            const guard=g.level.monsters.find(m=>m.isgd);
            const e=guard?.mextra?.egd;
            const corridor=Array.isArray(e?.fakecorr)?e.fakecorr:null;
            const inside=(x,y)=>corridor?.slice(e.fcbeg,e.fcend).some(c=>c.fx===x&&c.fy===y)??null;
            const entry=corridor?.[0];
            const terms=e&&entry?{
                extended:e.fcend>2,guardInside:inside(guard.mx,guard.my),
                notDone:!e.gddone,heroOutside:!inside(g.u.ux,g.u.uy),
                entryRestored:g.level.at(entry.fx,entry.fy).typ===entry.ftyp
            }:null;
            states.push({step,key:part.moves[step-1],turn:g.moves,
                hero:[g.u.ux,g.u.uy],gold:money_cnt(g.invent),hiddenGold:hidden_gold(g.invent,true),
                top:g.nhDisplay.grid[0].map(c=>c.ch).join('').trimEnd(),logical:g._toplines,
                terms,eligible:terms?Object.values(terms).every(Boolean):false,
                guard:guard?{id:guard.m_id,xy:[guard.mx,guard.my],hp:guard.mhp,
                    peaceful:guard.mpeaceful,done:e?.gddone,begin:e?.fcbeg,end:e?.fcend,
                    old:[e?.ogx,e?.ogy],movement:guard.movement,
                    corridor:corridor?.map(c=>({xy:[c.fx,c.fy],saved:c.ftyp,
                        current:g.level.at(c.fx,c.fy).typ,couldsee:couldsee(c.fx,c.fy),
                        cansee:cansee(c.fx,c.fy)}))??null}:null});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } catch(e) {error={name:e.name,message:e.message};}
    finally {
        if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const out=run?outputs(run):null;
    return {name:part.name,error,keys:part.moves.length,boundaries:out?.screens.length,
        calls:out?.calls.length,hashes:out?hashes(out):null,
        allKeysCaptured:out?.screens.length===part.moves.length+1,states,output:out};
}
// END ORIGINAL OBSERVER
// BEGIN ORIGINAL ORDINARY CONTROL BODY
const results=[],rows=[];
function check(name,fn){try{fn();results.push({name,pass:true});}
    catch(e){results.push({name,pass:false,error:e.message.slice(0,600)});}}
for(const [i,part] of recipe.segments.entries()) {
    const probe=await observed(part);
    const plain=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    const held=await deferred(part);
    const plainHashes=hashes(plain),heldHashes=hashes(held);
    check(part.name+': passive observer neutral',()=>assert.deepEqual(probe.hashes,plainHashes));
    check(part.name+': deferred and exhausted input equal',()=>assert.deepEqual(heldHashes,plainHashes));
    check(part.name+': all keys and RNG boundaries retained',()=>{
        assert.equal(probe.error,null);assert.equal(probe.allKeysCaptured,true);
        assert.equal(plain.screens.length,part.moves.length+1);assert.deepEqual(plain.slices.flat(),plain.calls);
    });
    check(part.name+': actual guard and restoration producers',()=>{
        if(i===4){assert.equal(probe.states.find(s=>s.step===187).guard.end,3);return;}
        const s=probe.states.find(s=>s.step===205);
        assert.deepEqual(s.hero,[28,18]);assert.equal(s.gold+s.hiddenGold,0);
        assert.equal(s.guard.id,122);assert.equal(s.guard.hp,47);assert.equal(s.guard.peaceful,1);
        assert.equal(s.guard.done,0);assert.equal(s.guard.end,i===2?2:3);
        assert.equal(s.guard.begin,i===2?1:2);
        assert.equal(s.terms.entryRestored,true);assert.equal(s.terms.heroOutside,true);
        assert.equal(s.terms.guardInside,true);assert.equal(s.eligible,i!==2);
    });
    check(part.name+': C cleanup policy or paired negative',()=>{
        const last=probe.states.at(-1);
        if(i<2){
            const s=probe.states.find(s=>s.step===211);
            assert.equal(s.guard,null,'C disposes the restored-entry guard on the next turn');
            assert.equal(last.guard,null);
            const said=probe.states.some(s=>s.top.includes('The guard, confused, disappears.'));
            assert.equal(said,i===0);
            assert.ok(!probe.states.some(s=>s.step>=205&&s.top.startsWith('Suddenly,')));
        }else if(i===2){assert.equal(last.guard.id,122);assert.equal(last.guard.end,2);assert.equal(last.guard.done,0);}
        else if(i===3){assert.equal(last.step,205);assert.equal(last.guard.id,122);assert.equal(last.eligible,true);}
        else {assert.equal(last.guard,null);assert.ok(probe.states.some(s=>s.top.startsWith('Suddenly, the guard disappears.')));}
    });
    if(i>=2)check(part.name+': all five original negative hashes',()=>assert.deepEqual(plainHashes,lock.negativeHashes[part.name]));
    rows.push({name:part.name,keys:part.moves.length,boundaries:plain.screens.length,
        calls:plain.calls.length,hashes:plainHashes,deferredHashes:heldHashes});
}
const report={classification:'Fresh ordinary JS controls against C source contracts; native comparison remains parent-only',
    passed:results.filter(r=>r.pass).length,total:results.length,results,rows};
// END ORIGINAL ORDINARY CONTROL BODY
Object.assign(report,{nativePreflight});
if(reportPath)writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:report.passed,total:report.total,failures:results.filter(r=>!r.pass)}));
if(report.passed!==report.total)process.exitCode=1;
