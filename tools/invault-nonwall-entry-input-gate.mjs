// Mandatory tracked metadata preflight precedes every game import.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {decodeScreen} from './gen-sessions/screen-decode.mjs';
assert.ok(process.argv.length<=3 && (process.argv[2]===undefined
    || (process.argv[2] && !process.argv[2].startsWith('-'))),
    'usage: invault-nonwall-entry-input-gate.mjs [new-compact-report.json]; no selectors');
const reportPath=process.argv[2]||null;
assert.ok(!reportPath||!existsSync(reportPath),'report path must be new');
const sha=b=>createHash('sha256').update(b).digest('hex');
function pinned(path,digest) {
    const bytes=readFileSync(new URL(path,import.meta.url));
    assert.equal(sha(bytes),digest,'exact tracked evidence: '+path);return bytes;
}
const evidence='gen-sessions/evidence/invault-nonwall-entry/';
const pins={
    "CANDIDATE-REVIEW.md": "2044fff0a2ecfa1c09a47259254770092c3c1cd97b89ca4a9d40801adb5d400b",
    "README.md": "1fd4bd45951589486b3eaf6f9a6b4104bec73e3497be7d4017738e5d2aa47c52",
    "SOURCE-REVIEW.md": "e16f0c425810d5caeaccd6f9e28332cc0b1943f29aba4e73fb1244e544552e87",
    "baseline-ordinary.json": "bd88b31eaacdb304d4cd0291cb5475951375d18b9a3794440e3e22405a16f030",
    "candidate-ordinary.json": "e3adad646da2c50ddb3f71574d2edaf724c4e3e612ea03bb0ac3f8b586fa7292",
    "initial-proposal-limit.json": "335a43999f34bbfbcf52922866d9ab9d78bcce6dc8da88d587ee59489859cd3d",
    "initial-proposal.json": "70f54ce753546cbf8b9747e47b40a0140cac0fdc5c5ffadc369caa37866890cf",
    "input-lock-initial.json": "d3142defd0126fb9ac0c3b82927df444e3be96c8fd0d7e42ea4801d95228a74d",
    "input-lock.json": "19d6fc18f7f75c4d7c1ee7c48194e37f64cb7411273fd25d5475c881fec2234a",
    "metadata-revision.json": "907c2055b68f2ed4065e1e3a7f5e629b118ffe174e3a4024aba58fc8fc14dbd2",
    "native-branch-checks.json": "0423578ba05583aaf404dce4a6f50a399aa094ab757f235c59f0d5adf54d66ef",
    "native-validation.json": "224068974558b12c8fc933b271a88c314c3c17da7c55d5262d6ac7d50c8abceb",
    "observer-original.mjs": "ad45fe74b6e05af85585ff16b411357b08f74e7e17df71005e0d01c798cc6b16",
    "ordinary-controls-original.mjs": "fb0b779ab19426055ccaac99ea6b511cf1e83951a88363fcef577dae8801da1c",
    "original-proposals.json": "6819e59563abf6bb6d0b5b88fb048f8dcf3531bc6a68468abc0336f96cdd10f5",
    "pre-candidate-lock-initial.json": "ceae3f2764822e514dd6e430ba1633ef540706c343a257f7e282770ef2c5c7e5",
    "pre-candidate-lock.json": "78ecc42380933390c5693b306680c01b7ae493b5d83d350668aae495a3e97278",
    "primary-recipe-initial.json": "b4e5ae370317b7f3752753e531e4505be1f9d44b50c066a4b4b4c48fd62037aa",
    "recording-receipt.json": "4281465dd0d92c56c5d747e3a2da46074cec7240b635f01822d75d71e5f1cf62",
    "source-provenance.json": "bebed88aa509c11d6fd18058505e71dbd895d25d21fc33681628bd9a574a3d65"
};
for(const [name,digest] of Object.entries(pins))pinned(evidence+name,digest);
const read=name=>JSON.parse(pinned(evidence+name,pins[name]));
pinned('half-damage-reader-observe.mjs','201cdafe4409d5d58414c1d0ebc0449c32b29834cdf35c72c151a555d9031d07');
pinned('gen-sessions/assertions.mjs','aed2dfe01e18cb2e8b0d62e389ab9d8a9c02b0e3e98d4e427fcead4c228e3adc');
pinned('gen-sessions/screen-decode.mjs','0831fd4db121dab1d3c8f80efac29c68ce50f67fedbb49f2bd7c21371244dae0');
const recipe=JSON.parse(pinned('gen-sessions/recipes/invault-nonwall-entry.json',
    'e377c1fe35cf14bf3f49481e3966ce002937810de42bf9f4b679f25c71834454'));
const lock=read('input-lock.json'),initialLock=read('input-lock-initial.json');
const prelock=read('pre-candidate-lock.json'),initialPrelock=read('pre-candidate-lock-initial.json');
assert.equal(lock.candidateExisted,false);assert.equal(initialLock.candidateExisted,false);assert.equal(lock.final,true);
assert.equal(prelock.candidateExisted,false);assert.equal(initialPrelock.candidateExisted,false);
assert.equal(prelock.inputLockSHA256,pins['input-lock.json']);
assert.equal(initialPrelock.inputLockSHA256,pins['input-lock-initial.json']);
assert.equal(prelock.initialPreCandidateLockSHA256,pins['pre-candidate-lock-initial.json']);
assert.equal(prelock.files['tools/ordinary-controls.mjs'].sha256,pins['ordinary-controls-original.mjs']);
assert.equal(prelock.files['tools/observer.mjs'].sha256,pins['observer-original.mjs']);
assert.equal(prelock.files['ordinary/proposal-02.json'].sha256,pins['initial-proposal.json']);
assert.equal(lock.recipeSHA256,'e377c1fe35cf14bf3f49481e3966ce002937810de42bf9f4b679f25c71834454');
assert.equal(lock.sourceProposalSHA256,pins['original-proposals.json']);
assert.deepEqual(recipe.segments,read('original-proposals.json').segments);
assert.deepEqual(lock.inputFields,['name','seed','datetime','nethackrc','moves']);
const fields=s=>Object.fromEntries(lock.inputFields.map(f=>[f,{present:Object.hasOwn(s,f),value:s[f]}]));
const tuples=recipe.segments.map(fields);
assert.equal(tuples.length,4);assert.ok(tuples.every(t=>Object.values(t).every(v=>v.present)));
assert.deepEqual(tuples,lock.tuples);assert.deepEqual(tuples,initialLock.tuples);
assert.equal(sha(JSON.stringify(tuples)),lock.tupleSHA256);
assert.equal(lock.tupleSHA256,'03fb31911af491aae7d481203c40b110f6dec6dd63d0d7b2216f7a5971bae895');
assert.deepEqual([lock.cases,lock.keys,lock.boundaries],[4,593,597]);
const initialRecipe=read('primary-recipe-initial.json'),revision=read('metadata-revision.json');
assert.equal(initialLock.recipeSHA256,pins['primary-recipe-initial.json']);
assert.equal(revision.initialRecipeSHA256,pins['primary-recipe-initial.json']);
assert.equal(revision.finalRecipeSHA256,lock.recipeSHA256);
assert.equal(revision.initialInputLockSHA256,pins['input-lock-initial.json']);
assert.equal(revision.finalInputLockSHA256,pins['input-lock.json']);
assert.equal(prelock.metadataRevisionSHA256,pins['metadata-revision.json']);
assert.equal(revision.allFieldsAndKeysUnchanged,true);
const derived=structuredClone(initialRecipe),changes=[];
for(const [i,branch] of derived.branchAssertions.entries())for(const [j,cell] of (branch.screenCells||[]).entries()) {
    assert.equal(cell.y,5);cell.y=6;
    changes.push({path:`branchAssertions[${i}].screenCells[${j}].y`,before:5,after:6});
}
assert.equal(changes.length,6);assert.deepEqual(changes,revision.changes);assert.deepEqual(derived,recipe);
const before=read('baseline-ordinary.json'),expected=read('candidate-ordinary.json');
assert.deepEqual([before.passed,before.total,expected.passed,expected.total],[25,28,28,28]);
assert.deepEqual(before.results.filter(r=>!r.pass).map(r=>r.name),[
    'dig-entry-summon: C entry initialization or early-return policy',
    'dig-entry-summon: C restoration and movement or paired negative',
    'dig-entry-summon: C reconstructed wall flags saved']);
assert.deepEqual(before.results.map(r=>r.name),expected.results.map(r=>r.name));
assert.ok(expected.results.every(r=>r.pass));
assert.deepEqual(lock.negativeHashes,initialLock.negativeHashes);
assert.deepEqual(Object.keys(lock.negativeHashes),recipe.segments.slice(1).map(s=>s.name));
for(const [name,hashes] of Object.entries(lock.negativeHashes)) {
    assert.deepEqual(Object.keys(hashes),['screens','cursors','calls','slices','frames']);
    assert.deepEqual(hashes,before.rows.find(r=>r.name===name).hashes);
    assert.deepEqual(hashes,expected.rows.find(r=>r.name===name).hashes);
}
assert.equal(read('initial-proposal-limit.json').runtimeChanged,false);
// Historical source/build/cache paths are provenance data only.
const provenance=read('source-provenance.json'),recording=read('recording-receipt.json');
assert.equal(provenance.sourceSealSHA256,'c16345b25d85a478af70901f244c1b62c054ab37e07e01c81cd98357a7b37c75');
assert.equal(provenance.candidateSealSHA256,'2a8d6c49ec66183e7c95498aff88994566aaa3b90a3b9c111cada30be64daf05');
assert.equal(provenance.inputLockSHA256,pins['input-lock.json']);
assert.equal(recording.cExecutedOnce,true);assert.equal(recording.exit,0);
assert.equal(recording.primaryRecipeSHA256,lock.recipeSHA256);
assert.equal(recording.rawSha256,'e1dc36a677bdf89e203f04b27b6018f68ade3e49bc460257aea208ea5004f7af');
assert.equal(recording.fiveInputFieldsAndPresencePreserved,true);assert.equal(recording.allKeysExact,true);
const nativeProof=read('native-validation.json').native;
assert.equal(nativeProof.baseline,'3/4');assert.equal(nativeProof.candidate,'4/4');
assert.equal(nativeProof.completeNegativeRowsUnchanged,true);
assert.equal(nativeProof.candidateReportSHA256,'46b791cdfa6affe8111c5726bc5c84ed71702d26e215b529b5ff8e3899744ab9');
assert.equal(recipe.requireBranchAssertions,true);assert.equal(recipe.branches.length,4);
assert.deepEqual(recipe.branchAssertions.map(a=>[a.branch,a.segment]),recipe.branches.map((b,i)=>[b,i]));
assert.deepEqual(branchAssertionErrors(recipe),[]);
assert.deepEqual(read('native-branch-checks.json'),{integrityErrors:[],branchErrors:[],primaryBranches:4});
const rawBytes=pinned('gen-sessions/generated/invault-nonwall-entry.session.json',
    'e1dc36a677bdf89e203f04b27b6018f68ade3e49bc460257aea208ea5004f7af');
assert.equal(rawBytes.length,2642356);
const raw=JSON.parse(rawBytes);assert.equal(raw.source,'c');assert.equal(raw.version,5);
assert.equal(raw.segments.length,4);assert.deepEqual(raw.segments.map(fields),tuples);
for(const [i,part] of raw.segments.entries())assert.deepEqual(part.steps.map(s=>s.key),[null,...recipe.segments[i].moves]);
const steps=raw.segments.flatMap(s=>s.steps);
assert.equal(raw.segments.reduce((n,s)=>n+s.moves.length,0),593);assert.equal(steps.length,597);
assert.equal(steps.reduce((n,s)=>n+(s.rng||[]).length,0),20703);
assert.equal(steps.reduce((n,s)=>n+(s.animation_frames||[]).length,0),21);
assert.deepEqual(recordingIntegrityErrors(raw),[]);assert.deepEqual(branchAssertionErrors(recipe,raw),[]);
const nativePreflight={source:'c',version:5,sha256:sha(rawBytes),cases:4,keys:593,boundaries:597,calls:20703,frames:21,branches:4};
const root=new URL('../',import.meta.url);
const {runSegment}=await import(new URL('js/jsmain.js',root));
const {InMemoryStorage}=await import(new URL('js/storage.js',root));
const {DOOR,VWALL}=await import(new URL('js/const.js',root));
const {ONAMES}=await import(new URL('js/objects_data.js',root));
const {MELT_ICE_AWAY,TIMER_LEVEL}=await import(new URL('js/timeout.js',root));
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
            const whistle=g.invent.find(o=>o.otyp===ONAMES.TIN_WHISTLE);
            states.push({step,turn:g.moves,hero:[g.u.ux,g.u.uy],uinvault:g.u.uinvault,
                entry:{typ:c.typ,flags:c.flags,wall:c.wall_info,door:c.doormask},
                wand:{letter:wand?.invlet,charges:wand?.spe},whistle:{letter:whistle?.invlet,cursed:whistle?.cursed},
                timers:(g.timer_base||[]).filter(t=>t.kind===TIMER_LEVEL&&t.func_index===MELT_ICE_AWAY&&t.arg===((25<<16)|5)).length,
                guard:guard?{id:guard.m_id,xy:[guard.mx,guard.my],peaceful:guard.mpeaceful,
                    begin:e?.fcbeg,end:e?.fcend,done:e?.gddone,room:e?.vroom,
                    first:Array.isArray(e?.fakecorr)&&e.fakecorr[0]?{...e.fakecorr[0]}:null}:null,
                top:g.nhDisplay.grid[0].map(c=>c.ch).join('').trimEnd()});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } catch(e) {error={name:e.name,message:e.message};}
    finally {
        if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const output=run?outputs(run):null;
    return {error,states,output,hashes:output?hashes(output):null,
        allKeysCaptured:output?.screens.length===part.moves.length+1};
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
    check(part.name+': fresh observer and complete input',()=>{
        assert.equal(probe.error,null);assert.equal(probe.allKeysCaptured,true);
        assert.equal(plain.screens.length,part.moves.length+1);assert.deepEqual(plain.slices.flat(),plain.calls);
    });
    check(part.name+': passive observer neutral',()=>assert.deepEqual(probe.hashes,plainHashes));
    check(part.name+': deferred and exhausted input equal',()=>assert.deepEqual(heldHashes,plainHashes));
    check(part.name+': actual wand and whistle producers',()=>{
        const setup=at(103);assert.deepEqual(setup.hero,[23,5]);assert.equal(setup.guard,null);
        assert.equal(setup.entry.typ,VWALL);assert.deepEqual(setup.wand,{letter:'o',charges:8});
        assert.deepEqual(setup.whistle,{letter:'p',cursed:1});
        if(i!==1){assert.equal(at(106).entry.typ,DOOR);assert.equal(at(106).wand.charges,7);}
        if(i<2){const s=at(i===0?108:105);assert.equal(s.guard.first,null);
            assert.deepEqual(s.guard.xy,[25,5]);assert.equal(s.guard.peaceful,1);}
        assert.ok(probe.states.every(s=>s.timers===0),'these inputs do not reach ice timer cleanup');
    });
    check(part.name+': C entry initialization or early-return policy',()=>{
        if(i<2){const s=at(i===0?121:118);assert.equal(s.guard.end,1);assert.equal(s.guard.begin,0);
            assert.equal(s.guard.room,8);assert.equal(s.guard.first.ftyp,VWALL);}
        else if(i===2){assert.equal(last.guard,null);assert.equal(last.entry.typ,DOOR);}
        else {assert.ok(probe.states.some(s=>s.guard&&s.guard.first===null));
            assert.equal(last.guard,null);assert.equal(last.entry.typ,DOOR);}
    });
    check(part.name+': C restoration and movement or paired negative',()=>{
        assert.equal(last.guard,null);
        if(i<2){assert.equal(at(i===0?147:144).entry.typ,VWALL);
            assert.equal(last.entry.typ,VWALL);assert.deepEqual(last.hero,[24,5]);}
        else {assert.equal(last.entry.typ,DOOR);assert.deepEqual(last.hero,[23,5]);}
    });
    if(i===0)check(part.name+': C reconstructed wall flags saved',()=>{
        assert.equal(at(121).guard.first.flags,2,'C WM_W_RIGHT from the outer rock/corridor side');
    });
    if(i>0)check(part.name+': five original negative hashes',()=>assert.deepEqual(plainHashes,lock.negativeHashes[part.name]));
    const grid=decodeScreen(plain.screens.at(-1));
    rows.push({name:part.name,keys:part.moves.length,boundaries:plain.screens.length,calls:plain.calls.length,
        hashes:plainHashes,deferredHashes:heldHashes,
        milestones:probe.states.filter(s=>[103,105,106,108,118,121,124,127,144,147,174,177,178,179,180,182,183].includes(s.step)),
        finalRow5Columns22To26:grid[5].slice(21,26)});
}
const report={classification:'Fresh ordinary JS controls against C source contracts; no candidate or native comparison',
    passed:results.filter(r=>r.pass).length,total:results.length,results,rows};
// END ORIGINAL ORDINARY CONTROL BODY
Object.assign(report,{classification:'Fresh installed-runtime ordinary controls; canonical C metadata verified, full native comparison retained separately.',nativePreflight});
if(reportPath)writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:report.passed,total:report.total,failures:results.filter(r=>!r.pass)}));
if(report.passed!==report.total)process.exitCode=1;
