// Mandatory tracked metadata preflight precedes every game import.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
assert.ok(process.argv.length<=3 && (process.argv[2]===undefined
    || (process.argv[2] && !process.argv[2].startsWith('-'))),
    'usage: fakecorr-saved-flags-input-gate.mjs [new-compact-report.json]; no selectors');
const reportPath=process.argv[2]||null;
assert.ok(!reportPath||!existsSync(reportPath),'report path must be new');
const sha=b=>createHash('sha256').update(b).digest('hex');
function pinned(path,digest) {
    const bytes=readFileSync(new URL(path,import.meta.url));
    assert.equal(sha(bytes),digest,'exact tracked evidence: '+path);return bytes;
}
const evidence='gen-sessions/evidence/fakecorr-saved-flags/';
const pins={
    "CANDIDATE-REVIEW.md": "87706fedfd2b7653eb3b7b14b0fb92d9f169e5a86494433904bda39ee354b622",
    "README.md": "ece3e3918cfea730ed0f9abf9ac9bacee50da93f3841994c389b5a1d30c9fc16",
    "SOURCE-REVIEW.md": "6ddc43e9a142378ba851f1062dccc62da5a5b982908b5a8270409c2aff6907a7",
    "baseline-ordinary.json": "e6fdbbfc82a0ec40d06055b1168594e4850b1bc86425067f7b5c8907bfb7dd87",
    "baseline-primary.json": "d2d1013cbee2488fd0ef6d4324d2f167cf73786ead50ec8c95aa7b719a366d2e",
    "candidate-ordinary.json": "f4702a246e69e782b5f13f0c02665818b23cd0cb74a0d354eed3b3e88a457b20",
    "initial-proposal.json": "8b645a970ce790a3e7af64b92cd80a7d819e2f5539fa46909419553fd020df4b",
    "input-lock.json": "5ba2481b8d7224375bf6d063e881d38db5921cd1a90ede2dcd55e4d7a0507d90",
    "inspection-failures.json": "84775796d15eb269a708f94ac129a501db2698cc5923da16bf97a20161e801e8",
    "native-branch-checks.json": "71beebb39f2e98421fbda73f3c9982f9f87f9b5f2ef3361ba8771bc491318620",
    "native-validation.json": "ed21668b6525d9649111e77e33d033fffac6aafed17958bb16048f3747c16b23",
    "observer-original.mjs": "8b017cef03590565a65e2bb3a4e65e70b69fba74fd6971b3b2df4dd4c2b8cc6c",
    "ordinary-controls-original.mjs": "490cc46a6cf84897c37c7adb8f040b4bb2f275021e62c65cdfeb0573b31f3e94",
    "original-proposals.json": "77462d608c1db7b6c66233f58fe539d48e596a056534a5c1b80881cf8be979f4",
    "pre-candidate-lock.json": "eca8b5fe4eb1de347020a0e13eb7663b249c003141aabe14151e3abe702c1007",
    "preflight-correction.json": "8186c480e2debca8c46912acbad5202ea589e4aa5d16c67f66e5721edb989c3a",
    "preflight-initial-failure.json": "6f9c601a0febd31f659774fc98c2b8a94f25feed87e34544557f465a2b82c7c7",
    "recording-receipt.json": "097d9088bd9d34ca402f316f5babbf3f9d9949b88579e79a9d519192306d7454",
    "source-coverage.json": "40ebaf96c8ff9b267ed16ff042bfcd364f302c5bdb8d46d22d122335f09b1e2e",
    "source-provenance.json": "07faed641a1d6c119670e5c2db295ce9d35a3fea137522b17c45c530b9b161a8"
};
for(const [name,digest] of Object.entries(pins))pinned(evidence+name,digest);
const read=name=>JSON.parse(pinned(evidence+name,pins[name]));
pinned('half-damage-reader-observe.mjs','201cdafe4409d5d58414c1d0ebc0449c32b29834cdf35c72c151a555d9031d07');
pinned('gen-sessions/assertions.mjs','aed2dfe01e18cb2e8b0d62e389ab9d8a9c02b0e3e98d4e427fcead4c228e3adc');
pinned('gen-sessions/screen-decode.mjs','0831fd4db121dab1d3c8f80efac29c68ce50f67fedbb49f2bd7c21371244dae0');
const recipeBytes=pinned('gen-sessions/recipes/fakecorr-saved-flags.json',
    '85ee6bc1294863c9919697f351948dbd4f61fe12c658087e9b1c776ba3529f85');
// Remove only the unregistered coverage label; preserve the original input and assertions.
assert.equal(sha(recipeBytes.toString().replace('    "social.vault-guard"',
    '    "social.vault-guard",\n    "terrain.digging"')),
    '322026dec878b81ba70f1132cff3e4105c07372a047304441712f86e6a9ffc06');
const recipe=JSON.parse(recipeBytes);
const lock=read('input-lock.json'),prelock=read('pre-candidate-lock.json');
assert.equal(lock.final,true);assert.equal(lock.candidateExisted,false);
assert.equal(prelock.candidateExisted,false);assert.equal(prelock.workerCExecuted,false);
assert.equal(prelock.inputLockSHA256,pins['input-lock.json']);
assert.equal(prelock.files['tools/ordinary-controls.mjs'].sha256,pins['ordinary-controls-original.mjs']);
assert.equal(prelock.files['tools/observer.mjs'].sha256,pins['observer-original.mjs']);
assert.equal(prelock.files['ordinary/proposal-01.json'].sha256,pins['initial-proposal.json']);
assert.equal(prelock.files['ordinary/proposal-02.json'].sha256,pins['original-proposals.json']);
assert.equal(prelock.files['review/baseline-ordinary.json'].sha256,pins['baseline-ordinary.json']);
assert.equal(prelock.files['review/baseline-primary.json'].sha256,pins['baseline-primary.json']);
assert.equal(lock.recipeSHA256,'322026dec878b81ba70f1132cff3e4105c07372a047304441712f86e6a9ffc06');
assert.equal(lock.sourceProposalSHA256,pins['original-proposals.json']);
assert.deepEqual(recipe.segments,read('original-proposals.json').segments);
assert.equal(recipe.segments[0].moves,read('initial-proposal.json').segments[0].moves);
assert.deepEqual(lock.inputFields,['name','seed','datetime','nethackrc','moves']);
const fields=s=>Object.fromEntries(lock.inputFields.map(f=>[f,{present:Object.hasOwn(s,f),value:s[f]}]));
const tuples=recipe.segments.map(fields);
assert.equal(tuples.length,4);assert.ok(tuples.every(t=>Object.values(t).every(v=>v.present)));
assert.deepEqual(tuples,lock.tuples);assert.equal(sha(JSON.stringify(tuples)),lock.tupleSHA256);
assert.equal(lock.tupleSHA256,'e02857d11d46b99ad0714ef97e9401dd2d3e9d8f07ab615afd02c7bd0ea8168a');
assert.deepEqual([lock.cases,lock.keys,lock.boundaries],[4,759,763]);
const before=read('baseline-ordinary.json'),expected=read('candidate-ordinary.json');
assert.deepEqual([before.passed,before.total,expected.passed,expected.total],[25,27,27,27]);
assert.deepEqual(before.results.filter(r=>!r.pass).map(r=>r.name),[
    'entry-nondiggable-bars: C saved wall flags restoration or pending-cleanup control',
    'entry-nondiggable-bars: C post-cleanup digging and move or stopped-before-cleanup control']);
assert.deepEqual(before.results.map(r=>r.name),expected.results.map(r=>r.name));
assert.ok(expected.results.every(r=>r.pass));
assert.deepEqual(read('baseline-primary.json').errors,[
    'vault.fakecorr.restore-nondiggable-entry: segment 0 step 211 cell (24,6) is "│", expected "@"']);
assert.deepEqual(Object.keys(lock.negativeHashes),recipe.segments.slice(1).map(s=>s.name));
for(const [name,hashes] of Object.entries(lock.negativeHashes)) {
    assert.deepEqual(Object.keys(hashes),['screens','cursors','calls','slices','frames']);
    assert.deepEqual(hashes,before.rows.find(r=>r.name===name).hashes);
    assert.deepEqual(hashes,expected.rows.find(r=>r.name===name).hashes);
}
assert.deepEqual(read('inspection-failures.json').gameplayProposalFailures,[]);
const correction=read('preflight-correction.json');
assert.equal(correction.rawOrRecipeChanged,false);assert.equal(correction.runtimeChecksBeforeCorrection,0);
assert.equal(correction.correctedCalls,21254);assert.equal(read('preflight-initial-failure.json').exit,1);
// Historical source/build/cache paths are provenance data only.
const provenance=read('source-provenance.json'),recording=read('recording-receipt.json');
assert.equal(provenance.sourceSealSHA256,'e79749d61347eae6e009eeae423b500e31a7fd7b4df5b1126eb7a48d2a460b23');
assert.equal(provenance.candidateSealSHA256,'ec7ded1d1914017a5c8af770ab9298744705976564c3cae8e20105380023140d');
assert.equal(provenance.inputLockSHA256,pins['input-lock.json']);
assert.equal(provenance.sourceCoverageSHA256,pins['source-coverage.json']);
assert.equal(provenance.publicNeedsHistoricalCOrCache,false);
assert.equal(recording.cExecutedOnce,true);assert.equal(recording.exit,0);
assert.equal(recording.primaryRecipeSHA256,lock.recipeSHA256);
assert.equal(recording.rawSha256,'e2297e8ec282afb08f1d7391c178b8627dcd13ba866363d8e67063fe78bd7ca1');
assert.equal(recording.fiveInputFieldsAndPresencePreserved,true);assert.equal(recording.allKeysExact,true);
const nativeProof=read('native-validation.json').native;
assert.equal(nativeProof.baseline,'3/4 parent report');assert.equal(nativeProof.candidate,'4/4 bounded JS comparison');
assert.equal(nativeProof.negativeRowsUnchanged,3);
assert.equal(nativeProof.candidateReportSHA256,'b2190f309ff2de8686924862c3db4c821a730a7d0ce2efeccff2f906bb0cf64e');
assert.equal(recipe.requireBranchAssertions,true);assert.equal(recipe.branches.length,4);
assert.deepEqual(recipe.branches,lock.branches);
assert.deepEqual(recipe.branchAssertions.map(a=>[a.branch,a.segment]),recipe.branches.map((b,i)=>[b,i]));
assert.deepEqual(branchAssertionErrors(recipe),[]);
assert.deepEqual(read('native-branch-checks.json'),{cases:4,branches:4,branchErrors:[],integrityErrors:[],source:'c',version:5});
const rawBytes=pinned('gen-sessions/generated/fakecorr-saved-flags.session.json',
    'e2297e8ec282afb08f1d7391c178b8627dcd13ba866363d8e67063fe78bd7ca1');
assert.equal(rawBytes.length,3175731);
const raw=JSON.parse(rawBytes);assert.equal(raw.source,'c');assert.equal(raw.version,5);
assert.equal(raw.segments.length,4);assert.deepEqual(raw.segments.map(fields),tuples);
for(const [i,part] of raw.segments.entries())assert.deepEqual(part.steps.map(s=>s.key),[null,...recipe.segments[i].moves]);
const steps=raw.segments.flatMap(s=>s.steps);
assert.equal(raw.segments.reduce((n,s)=>n+s.moves.length,0),759);assert.equal(steps.length,763);
assert.equal(steps.reduce((n,s)=>n+(s.rng||[]).length,0),21254);
assert.equal(steps.reduce((n,s)=>n+(s.animation_frames||[]).length,0),27);
assert.deepEqual(recordingIntegrityErrors(raw),[]);assert.deepEqual(branchAssertionErrors(recipe,raw),[]);
const nativePreflight={source:'c',version:5,sha256:sha(rawBytes),cases:4,keys:759,boundaries:763,calls:21254,frames:27,branches:4};
const root=new URL('../',import.meta.url);
const {runSegment}=await import(new URL('js/jsmain.js',root));
const {InMemoryStorage}=await import(new URL('js/storage.js',root));
const {DOOR,VWALL,IRONBARS,W_NONDIGGABLE}=await import(new URL('js/const.js',root));
const {ONAMES}=await import(new URL('js/objects_data.js',root));
const {outputs,hashes,deferred}=await import('./half-damage-reader-observe.mjs');
// BEGIN ORIGINAL OBSERVER
async function observed(part) {
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states=[];let run,error=null;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step) {
            if(step<100||!g.level||!g.u)return;
            const c=g.level.at(25,5),guard=g.level.monsters.find(m=>m.isgd),e=guard?.mextra?.egd;
            const wand=g.invent.find(o=>o.otyp===ONAMES.WAN_DIGGING);
            const here=g.level.at(g.u.ux,g.u.uy);
            const snapshot={turn:g.moves,hero:[g.u.ux,g.u.uy],uinvault:g.u.uinvault,
                entry:{typ:c.typ,flags:c.flags,wall:c.wall_info,door:c.doormask,seen:c.seenv},
                here:{typ:here.typ,flags:here.flags,wall:here.wall_info,door:here.doormask},
                wand:{letter:wand?.invlet,charges:wand?.spe},
                guard:guard?{id:guard.m_id,xy:[guard.mx,guard.my],hp:guard.mhp,peaceful:guard.mpeaceful,
                    begin:e?.fcbeg,end:e?.fcend,done:e?.gddone,warn:e?.warncnt,
                    corridor:Array.isArray(e?.fakecorr)?e.fakecorr.map(c=>({...c})):null}:null};
            const state={step,key:part.moves[step-1],...snapshot,
                top:g.nhDisplay.grid[0].map(c=>c.ch).join('').trimEnd()};
            states.push(state);
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } catch(e) {error={name:e.name,message:e.message};}
    finally {
        if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const out=run?outputs(run):null;
    return {error,states,output:out,hashes:out?hashes(out):null,allKeysCaptured:out?.screens.length===part.moves.length+1};
}
// END ORIGINAL OBSERVER
// BEGIN ORIGINAL ORDINARY CONTROL BODY
const results=[],rows=[];
function check(name,fn){try{fn();results.push({name,pass:true});}
    catch(e){results.push({name,pass:false,error:e.message.slice(0,600)});}}
for(const [i,part] of recipe.segments.entries()) {
    const probe=await observed(part);
    const plain=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    const held=await deferred(part),plainHashes=hashes(plain),heldHashes=hashes(held);
    const at=step=>probe.states.find(s=>s.step===step),last=probe.states.at(-1);
    const wish='\x17undiggable iron bars\r';
    const mutation=part.moves.indexOf(wish);
    const mutationStep=mutation<0?null:mutation+wish.length;
    const beforeDig=part.moves.lastIndexOf('zol');
    check(part.name+': complete input and observer',()=>{
        assert.equal(probe.error,null);assert.equal(probe.allKeysCaptured,true);
        assert.equal(plain.screens.length,part.moves.length+1);
        assert.deepEqual(plain.slices.flat(),plain.calls);
    });
    check(part.name+': passive observer neutral',()=>assert.deepEqual(probe.hashes,plainHashes));
    check(part.name+': deferred and exhausted input equal',()=>assert.deepEqual(heldHashes,plainHashes));
    check(part.name+': real snapshot and typed-field producer',()=>{
        const saved=at(118),entry=at(126);
        assert.deepEqual(saved.hero,[23,5]);assert.equal(saved.guard.end,1);
        assert.deepEqual(saved.guard.corridor[0],{fx:25,fy:5,ftyp:VWALL,flags:2,doormask:0});
        assert.deepEqual(entry.hero,[25,5]);assert.equal(entry.entry.typ,DOOR);
        assert.equal(entry.entry.wall,2);assert.equal(entry.guard.end,3);
        assert.deepEqual(entry.wand,{letter:'o',charges:8});
        if(mutationStep!==null) {
            const changed=at(mutationStep);
            assert.equal(changed.here.typ,IRONBARS);
            assert.equal(changed.here.wall,W_NONDIGGABLE);
            if(i===2){assert.deepEqual(changed.hero,[24,5]);assert.equal(changed.guard,null);
                assert.equal(changed.entry.typ,VWALL);assert.equal(changed.entry.wall,2);}
            else {assert.deepEqual(changed.hero,[25,5]);assert.equal(changed.guard.begin,0);
                assert.equal(changed.guard.corridor[0].flags,2);}
        }
    });
    check(part.name+': C saved wall flags restoration or pending-cleanup control',()=>{
        if(i<3) {
            const restored=at(beforeDig);
            assert.equal(restored.guard,null);assert.deepEqual(restored.hero,[24,5]);
            assert.equal(restored.entry.typ,VWALL);assert.equal(restored.entry.flags,2);
            assert.equal(restored.entry.wall,2,'C flags assignment restores wall_info, not temporary terrain flags');
        } else {
            assert.equal(beforeDig,-1);assert.equal(last.guard.begin,0);
            assert.equal(last.guard.end,3);assert.equal(last.entry.typ,IRONBARS);
            assert.equal(last.entry.wall,W_NONDIGGABLE);
        }
    });
    check(part.name+': C post-cleanup digging and move or stopped-before-cleanup control',()=>{
        if(i<3) {
            assert.equal(last.guard,null);assert.equal(last.wand.charges,7);
            assert.equal(last.entry.typ,DOOR,'restored original wall is diggable');
            assert.deepEqual(last.hero,[25,5]);
        } else {
            assert.equal(last.wand.charges,8);assert.deepEqual(last.hero,[25,5]);
            assert.equal(last.turn,at(126).turn,'debug terrain wish does not advance the guard');
        }
    });
    if(i>0)check(part.name+': five original negative hashes',()=>assert.deepEqual(plainHashes,lock.negativeHashes[part.name]));
    const marks=[118,126,mutationStep,beforeDig,part.moves.length];
    rows.push({name:part.name,keys:part.moves.length,boundaries:plain.screens.length,calls:plain.calls.length,
        hashes:plainHashes,deferredHashes:heldHashes,milestones:probe.states.filter(s=>marks.includes(s.step))});
}
const report={classification:'Fresh keyboard reach and original C source predictions; no candidate or native comparison',
    passed:results.filter(r=>r.pass).length,total:results.length,results,rows};
// END ORIGINAL ORDINARY CONTROL BODY
Object.assign(report,{classification:'Fresh installed-runtime ordinary controls; canonical C metadata verified, full native comparison retained separately.',nativePreflight});
if(reportPath)writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:report.passed,total:report.total,failures:results.filter(r=>!r.pass)}));
if(report.passed!==report.total)process.exitCode=1;
