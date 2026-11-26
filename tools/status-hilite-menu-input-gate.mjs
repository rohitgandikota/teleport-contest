// Validate tracked evidence before importing the installed game runtime.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length <= 3
    && (process.argv[2] === undefined || (process.argv[2] && !process.argv[2].startsWith('-'))),
    'usage: status-hilite-menu-input-gate.mjs [new-compact-report.json]; no selectors');
const reportPath = process.argv[2] || null;
assert.ok(!reportPath || !existsSync(reportPath), 'report path must be new');

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function pinned(path, digest) {
    const bytes = readFileSync(new URL(path, import.meta.url));
    assert.equal(sha(bytes), digest, 'exact tracked evidence: ' + path);
    return bytes;
}

const evidence = 'gen-sessions/evidence/status-hilite-menu/';
const pins = {
    "CANDIDATE-REVIEW.md": "8daf9b2b15c99fb9fb65ea84f7fb4f41da7224932994be058c0ac0dd767d0e0d",
    "README.md": "72f0913914e34289cdec3eb8f08d7859f398eb13f66cf9edf2fafe0d24847488",
    "SOURCE-REVIEW.md": "a92237d60fd30860deeff82ee446b57b413f1c375ac72ae4e45139fdefcbdda0",
    "baseline-native.json": "6da034b986da42986c5d0fef8d582462f8fb6e271fba5d8e2c6abb17999c92bd",
    "baseline-ordinary.json": "6101173e5746c231be0c22aaa6cdd19c4e1ef1cd2e4565270bca911ec482627b",
    "candidate-native.json": "597ed654ec518cdd0ae3aa052fef7ca90bbbdb128b25d34030ec4573a975eefd",
    "candidate-ordinary.json": "b688937bac693c686afbb2624929bd4fec09831dbf36bfbdf05566fdfa253677",
    "candidate-validation.json": "740131527006b74a58c77512b457aeb12dccf34ede1947f88ea1773700b110ba",
    "historical-profile.json": "22d0174f3f7baa9bf798dba019a78f5599681a7bbd402934c7e13f7539cc0a25",
    "initial-loader-failure.log": "0946bc2763dd3d27a68fb8af3be19bf61370bb2a68c7d079f770aa0b3c0e817b",
    "initial-proposal.json": "ce70f3b51344661b1839c62b7a61003d274cf341abee5cf2cfc811c755f9a162",
    "input-lock.json": "d0624cad0d5d2a3680ba8be093679c23fe0aa92b8f7feb8ff4465c6406e9797f",
    "native-branch-checks.json": "6c552d488372a00e0919614dedee6d1061a9126076e37650553a10d2eeb51bcf",
    "ordinary-controls-original.mjs": "010a0d6308de9d19b05774f2e55e2caa79df825068a9748b69a0b006ffdc278d",
    "original-proposals.json": "9dd5a2546d6cd7ebae257d440affbeec5473f8623595003d88ab3debc0593f86",
    "parent-baseline-confirmation.json": "926ad8de95579c05f3d13022b004f9f0571c8350890d901bc1393d568036b7e6",
    "pre-candidate-lock.json": "a01b2f68466f57f9d8e2844603466a3245439cbe6b94075124f59872abf96911",
    "proposal-02-finding.json": "85ff5956a1ca7b625157e6bac5f8f0b01463c0e20bc996b49809845ff0dca589",
    "proposal-02-prediction.json": "23a6643621f08ea3c7580972f0ab6e543771b804afc3fa4992a7519678ce3fb0",
    "proposal-02-probe.json": "3536bb988f41810200ddd73a18f3729faffe591052965b5721b7de115dbf5911",
    "proposal-02.json": "abc819bde7d3bc2c50128733eb203aefb9c045c9f7a40cb190c458c3901a95c1",
    "recording-receipt.json": "d72bfebe2f568c991cd759bdbeaa1c94133ddc36a6bc8e1c2f873083a0cba8d7",
    "source-coverage.json": "a4602063c4db13e8e4d4d990a37f5117f0aaf71bfce3cef1bc2acd7e19a5da26",
    "source-provenance.json": "ce91b81737a35f2196da5adbbd36506f317d8351d73d439e86a05e76db6034d2"
};
for (const [name, digest] of Object.entries(pins)) {
    pinned(evidence + name, digest);
}
const readEvidence = name => JSON.parse(pinned(evidence + name, pins[name]));
pinned('half-damage-reader-observe.mjs',
    '201cdafe4409d5d58414c1d0ebc0449c32b29834cdf35c72c151a555d9031d07');
pinned('gen-sessions/assertions.mjs',
    'aed2dfe01e18cb2e8b0d62e389ab9d8a9c02b0e3e98d4e427fcead4c228e3adc');
pinned('gen-sessions/screen-decode.mjs',
    '0831fd4db121dab1d3c8f80efac29c68ce50f67fedbb49f2bd7c21371244dae0');

// The primary recipe and every input remain exactly as recorded.
const recipeBytes = pinned('gen-sessions/recipes/status-hilite-menu.json',
    'f4fafd3678b1bbc3112a52f31b2a487bd7d199eae920552869667a12884b0e6d');
const recipe = JSON.parse(recipeBytes);
const lock = readEvidence('input-lock.json');
const prelock = readEvidence('pre-candidate-lock.json');
assert.equal(lock.final, true);
assert.equal(lock.candidateExisted, false);
assert.equal(prelock.candidateExisted, false);
assert.equal(prelock.workerCExecuted, false);
assert.equal(prelock.inputLockSHA256, pins['input-lock.json']);
assert.equal(prelock.files['tools/ordinary-controls.mjs'].sha256,
    pins['ordinary-controls-original.mjs']);
assert.equal(prelock.files['review/baseline-ordinary.json'].sha256,
    pins['baseline-ordinary.json']);
assert.equal(prelock.files['review/source-coverage.json'].sha256,
    pins['source-coverage.json']);
assert.equal(prelock.files['ordinary/proposal-01.json'].sha256,
    pins['initial-proposal.json']);
assert.equal(prelock.files['ordinary/proposal-02.json'].sha256,
    pins['proposal-02.json']);
assert.equal(prelock.files['ordinary/proposal-02-probe.json'].sha256,
    pins['proposal-02-probe.json']);
assert.equal(prelock.files['review/proposal-02-prediction.json'].sha256,
    pins['proposal-02-prediction.json']);
assert.equal(prelock.files['review/proposal-02-finding.json'].sha256,
    pins['proposal-02-finding.json']);
assert.equal(prelock.files['ordinary/proposal-03.json'].sha256,
    pins['original-proposals.json']);
assert.equal(lock.recipeSHA256, sha(recipeBytes));
assert.equal(lock.sourceProposalSHA256, pins['original-proposals.json']);
assert.deepEqual(recipe.segments, readEvidence('original-proposals.json').segments);
assert.deepEqual(lock.inputFields, ['name', 'seed', 'datetime', 'nethackrc', 'moves']);
const fields = segment => Object.fromEntries(lock.inputFields.map(field => [field, {
    present: Object.hasOwn(segment, field), value: segment[field],
}]));
const tuples = recipe.segments.map(fields);
assert.equal(tuples.length, 4);
assert.ok(tuples.every(tuple => Object.values(tuple).every(field => field.present)));
assert.deepEqual(tuples, lock.tuples);
assert.equal(sha(JSON.stringify(tuples)), lock.tupleSHA256);
assert.equal(lock.tupleSHA256,
    '61ff4e473a84bc218a35db1e68ef056f619c9babeebb6ac9fc0187ba9843b96c');
assert.deepEqual([lock.cases, lock.keys, lock.boundaries], [4, 63, 67]);
assert.deepEqual(recipe.segments.map(segment => sha(segment.moves)), lock.keySHA256);

// Keep the unsuccessful exit prediction and its pre-lock correction explicit.
const initial = readEvidence('initial-proposal.json').segments[0];
assert.ok(recipe.segments[0].moves.startsWith(initial.moves));
const earlier = readEvidence('proposal-02.json').segments;
for (const [i, part] of earlier.entries()) {
    const finalPart = i === 3 ? part : {...part, moves: part.moves.slice(0, -2) + ' \x1b\x1b'};
    assert.deepEqual(recipe.segments[i], finalPart);
}
assert.ok(readEvidence('proposal-02-finding.json').failedPrediction);
assert.equal(readEvidence('proposal-02-prediction.json').beforeRuntimeProbe, true);
for (const row of readEvidence('proposal-02-probe.json').rows.slice(0, 3)) {
    assert.equal(row.states.at(-1).botDisabled, true);
    assert.equal(row.states.at(-1).hiliteDelta, null);
}

// Saved reports are expected evidence, never substitutes for fresh observations.
const before = readEvidence('baseline-ordinary.json');
const expected = readEvidence('candidate-ordinary.json');
assert.deepEqual([before.passed, before.total, expected.passed, expected.total], [33, 34, 34, 34]);
assert.deepEqual(before.results.filter(result => !result.pass).map(result => result.name),
    ['percent-bare-commit: C comparison suffix or empty-input return']);
assert.deepEqual(before.results.map(result => result.name), expected.results.map(result => result.name));
assert.ok(expected.results.every(result => result.pass));
assert.deepEqual(expected.primary.errors, []);
assert.deepEqual(before.primary.errors, [
    'Less than 50%', '50% or less', 'Exactly 50%', '50% or more', 'More than 50%',
].map(text => 'status.hilite-menu.percent-suffix: segment 0 lacks screen text ' + JSON.stringify(text)));
assert.deepEqual(Object.keys(lock.negativeHashes), recipe.segments.slice(1).map(part => part.name));
for (const [name, hashes] of Object.entries(lock.negativeHashes)) {
    assert.deepEqual(Object.keys(hashes), ['screens', 'cursors', 'calls', 'slices', 'frames']);
    const beforeRow = before.rows.find(row => row.name === name);
    const candidateRow = expected.rows.find(row => row.name === name);
    assert.deepEqual(beforeRow, candidateRow);
    assert.deepEqual(hashes, beforeRow.hashes);
}

// Historical source/build/cache locations are provenance strings only.
const provenance = readEvidence('source-provenance.json');
assert.equal(provenance.sourceSealSHA256,
    '4b977a46222c8607a33aee089e8296b253fe190157e3a2d81c277d5e9e310e0a');
assert.equal(provenance.candidateSealSHA256,
    '322173a0a4344a50d9afe32112f018c915a58653e60e2be7b5f5167d66190e77');
assert.equal(provenance.inputLockSHA256, pins['input-lock.json']);
assert.equal(provenance.originalBodySHA256, pins['ordinary-controls-original.mjs']);
assert.equal(provenance.sourceCoverageSHA256, pins['source-coverage.json']);
assert.equal(provenance.publicNeedsHistoricalCOrCache, false);
assert.equal(readEvidence('source-coverage.json').ranges.length, 60);
const historical = readEvidence('historical-profile.json');
assert.equal(historical.creditedInputs, 851);
assert.deepEqual([historical.owner.calls, historical.owner.covered, historical.owner.outcomes], [1, 4, 246]);
assert.equal(historical.current926Coverage, false);
assert.equal(historical.proofOfBug, false);

const baselineNative = readEvidence('baseline-native.json');
const candidateNative = readEvidence('candidate-native.json');
const exact = row => row.fullStyleExact && row.frozenScreenCursorExact
    && row.fullRngExact && row.animationExact;
assert.equal(baselineNative.length, 4);
assert.equal(candidateNative.length, 4);
assert.equal(baselineNative.filter(exact).length, 3);
assert.ok(candidateNative.every(exact));
assert.deepEqual(baselineNative[0].screenDifferences.map(diff => diff.step), [11]);
assert.equal(baselineNative[0].glyphMismatches, 20);
assert.deepEqual(baselineNative.slice(1), candidateNative.slice(1));
const confirmation = readEvidence('parent-baseline-confirmation.json');
assert.equal(confirmation.reportSHA256, pins['baseline-native.json']);
assert.equal(confirmation.initialLoaderFailureSHA256, pins['initial-loader-failure.log']);
assert.equal(confirmation.initialInferenceRetractionPreserved, true);
const validation = readEvidence('candidate-validation.json');
assert.equal(validation.candidateOrdinarySHA256, pins['candidate-ordinary.json']);
assert.equal(validation.candidateNativeSHA256, pins['candidate-native.json']);
assert.equal(validation.candidateNative.parentBaselineReportSHA256, pins['baseline-native.json']);

// Mandatory original C preflight, including every recorded key and primary branch.
const rawBytes = pinned('gen-sessions/generated/status-hilite-menu.session.json',
    '92f1b7874b112c686022d871664f161a0e3445fc5e0ce152b3a82eb517c7e7d8');
assert.equal(rawBytes.length, 711816);
const raw = JSON.parse(rawBytes);
assert.equal(raw.source, 'c');
assert.equal(raw.version, 5);
assert.equal(raw.segments.length, 4);
assert.deepEqual(raw.segments.map(fields), tuples);
for (const [i, part] of raw.segments.entries()) {
    assert.deepEqual(part.steps.map(step => step.key), [null, ...recipe.segments[i].moves]);
}
const steps = raw.segments.flatMap(part => part.steps);
assert.equal(raw.segments.reduce((count, part) => count + part.moves.length, 0), 63);
assert.equal(steps.length, 67);
assert.equal(steps.reduce((count, step) => count + (step.rng || []).length, 0), 16116);
assert.equal(steps.reduce((count, step) => count + (step.animation_frames || []).length, 0), 0);
assert.equal(recipe.requireBranchAssertions, true);
assert.equal(recipe.branches.length, 4);
assert.deepEqual(recipe.branches, lock.branches);
assert.deepEqual(recipe.branchAssertions.map(branch => [branch.branch, branch.segment]),
    recipe.branches.map((branch, i) => [branch, i]));
assert.deepEqual(branchAssertionErrors(recipe), []);
assert.deepEqual(recordingIntegrityErrors(raw), []);
assert.deepEqual(branchAssertionErrors(recipe, raw), []);
assert.deepEqual(readEvidence('native-branch-checks.json'), {
    cases: 4, branches: 4, source: 'c', version: 5, branchErrors: [], integrityErrors: [],
});
const recording = readEvidence('recording-receipt.json');
assert.equal(recording.cExecutedOnce, true);
assert.equal(recording.exit, 0);
assert.equal(recording.primaryRecipeSHA256, sha(recipeBytes));
assert.equal(recording.rawSha256, sha(rawBytes));
assert.equal(recording.fiveInputFieldsAndPresencePreserved, true);
assert.equal(recording.allKeysExact, true);
const nativePreflight = {
    source: 'c', version: 5, sha256: sha(rawBytes),
    cases: 4, keys: 63, boundaries: 67, calls: 16116, frames: 0, branches: 4,
};

const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {outputs, hashes, deferred} = await import('./half-damage-reader-observe.mjs');

// BEGIN ORIGINAL ORDINARY CONTROL BODY
const results=[],rows=[],allOutputs=[],generated=[];
function check(name,body) {
    try {body();results.push({name,pass:true});}
    catch(e) {results.push({name,pass:false,error:e.message});}
}
for(const [i,part] of recipe.segments.entries()) {
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states=[];let run;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step) {
            if(!g.nhDisplay||!g.u)return;
            const text=g.nhDisplay.grid.map(row=>row.map(c=>c.ch).join('').trimEnd());
            states.push({step,key:part.moves[step-1]??null,turn:g.moves,
                botDisabled:!!g.bot_disabled,inGetlin:g.program_state?.in_getlin??null,
                hiliteDelta:g.iflags?.hilite_delta??null,
                rules:Object.entries(g.blstats_thresholds||{}).flatMap(([field,list])=>list.map(r=>({field:Number(field),...r}))),
                conditions:(g.cond_hilites||[]).map((mask,slot)=>({slot,mask})).filter(r=>r.mask),
                lines:text.flatMap((line,row)=>/Select.*hilite|Status hilites|Choose|Enter.*threshold|Exactly|Less than|More than| or less| or more|Added hilite|Current.*hilites|hitpoints\//.test(line)?[{row,text:line.trimStart()}]:[])});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    const out=outputs(run);
    const plain=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    const pending=await deferred(part);
    const at=step=>states.find(s=>s.step===step);
    const line=step=>at(step).lines.map(s=>s.text);
    const cancelled=i===3,comparison=i===1?12:11;
    const number=i===2?'50':'50%';
    check(`${part.name}: all keys, fresh observer/plain/deferred outputs and negative hashes`,()=>{
        assert.equal(out.screens.length,part.moves.length+1);
        assert.deepEqual(states.map(s=>s.step),Array.from({length:part.moves.length+1},(_,j)=>j));
        assert.deepEqual(states.slice(1).map(s=>s.key).join(''),part.moves);
        assert.deepEqual(out.slices.flat(),out.calls);
        assert.deepEqual(out,plain);assert.deepEqual(out,pending);
        if(i)assert.deepEqual(hashes(out),lock.negativeHashes[part.name]);
    });
    check(`${part.name}: fresh rule lifetime and real hitpoints option route`,()=>{
        assert.deepEqual(at(0).rules,[]);assert.deepEqual(at(0).conditions,[]);
        assert.equal(at(0).botDisabled,false);assert.equal(at(0).hiliteDelta,null);
        assert.deepEqual(line(7),['Select hitpoints field hilite behavior:']);
    });
    check(`${part.name}: actual line-input producer`,()=>{
        assert.equal(at(8).inGetlin,1);assert.deepEqual(at(8).rules,[]);
        assert.deepEqual(line(8),[i===2?'Enter value for hitpoints threshold:':'Enter percentage value for hitpoints threshold:']);
        assert.equal(at(cancelled?9:comparison).inGetlin,0);
    });
    check(`${part.name}: C comparison suffix or empty-input return`,()=>{
        assert.deepEqual(line(cancelled?9:comparison),cancelled
            ?['Select hitpoints field hilite behavior:']
            :[`a - Less than ${number}`,`b - ${number} or less`,`c - Exactly ${number}`,`d - ${number} or more`,`e - More than ${number}`]);
    });
    check(`${part.name}: color and attribute feedback or cancellation bypass`,()=>{
        if(cancelled)assert.ok(states.every(s=>s.lines.every(l=>!l.text.startsWith('Choose '))));
        else {
            assert.deepEqual(line(comparison+1),[`Choose a color for when hitpoints is ${number}:`]);
            assert.deepEqual(line(comparison+2),[`Choose attribute for when hitpoints is ${number}:`]);
            assert.deepEqual(at(comparison+2).rules,[]);
        }
    });
    check(`${part.name}: exact inserted rule or no insertion`,()=>{
        const expected=cancelled?[]:[{field:18,set:true,fld:18,behavior:i===2?101:100,rel:0,value:50,textmatch:'',coloridx:257,anytype:4}];
        assert.deepEqual(states.at(-1).rules,expected);
        assert.ok(states.every(s=>s.conditions.length===0));
        if(cancelled)assert.ok(states.every(s=>s.rules.length===0));
        else assert.deepEqual(at(comparison+3).rules,expected);
    });
    check(`${part.name}: real acknowledgement and field-menu ordering`,()=>{
        if(cancelled)assert.deepEqual(line(10),['Status hilites:']);
        else {
            assert.deepEqual(line(comparison+3),[`Added hilite hitpoints/=${number}/red&normal--More--`]);
            assert.equal(at(comparison+4).key,' ');
            assert.deepEqual(line(comparison+4),['Current hitpoints hilites:',`a - hitpoints/=${number}/red&normal`]);
            assert.deepEqual(line(comparison+5),['Status hilites:']);
        }
    });
    check(`${part.name}: exit cleanup and stored-rule enablement`,()=>{
        assert.equal(states.at(-1).botDisabled,false);assert.equal(states.at(-1).inGetlin,0);
        assert.equal(states.at(-1).hiliteDelta,cancelled?null:3);
        assert.deepEqual(states.at(-1).lines,[]);assert.ok(states.every(s=>s.turn===1));
    });
    rows.push({name:part.name,keys:part.moves.length,boundaries:out.screens.length,calls:out.calls.length,
        frames:out.frames.flat().length,hashes:hashes(out),plainHashes:hashes(plain),deferredHashes:hashes(pending),states});
    allOutputs.push(out);
    generated.push({...part,steps:out.screens.map((screen,j)=>({screen,cursor:out.cursors[j],rng:out.slices[j],key:j?part.moves[j-1]:null}))});
}
check('Bare and explicit percentage paths converge after choosing the comparison',()=>{
    assert.deepEqual(allOutputs[0].calls,allOutputs[1].calls);
    for(const field of ['screens','cursors','slices','frames'])
        assert.deepEqual(allOutputs[0][field].slice(12),allOutputs[1][field].slice(13));
    assert.deepEqual(rows[0].states.at(-1).rules,rows[1].states.at(-1).rules);
});
check('All four menu paths preserve the complete startup RNG stream',()=>{
    for(const out of allOutputs.slice(1))assert.deepEqual(out.calls,allOutputs[0].calls);
});
const session={source:'js',segments:generated};
const primaryErrors=branchAssertionErrors(recipe,session),integrityErrors=recordingIntegrityErrors(session);
assert.deepEqual(integrityErrors,[]);
const report={classification:'Fresh ordinary JS controls against pinned C source; no native comparison',
    passed:results.filter(r=>r.pass).length,total:results.length,results,rows,
    primary:{definitionErrors:branchAssertionErrors(recipe),errors:primaryErrors,integrityErrors,branches:4}};
// END ORIGINAL ORDINARY CONTROL BODY

assert.deepEqual(rows.map(row => row.hashes), expected.rows.map(row => row.hashes),
    'all four fresh output hash sets match the sealed candidate proof');
Object.assign(report, {
    classification: 'Fresh installed-runtime controls; canonical C metadata verified, native comparison retained separately.',
    nativePreflight,
});
if (reportPath) {
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
}
console.log(JSON.stringify({
    passed: report.passed, total: report.total,
    failures: results.filter(result => !result.pass).map(result => result.name),
    primaryErrors,
}));
if (report.passed !== report.total || primaryErrors.length) process.exitCode = 1;
