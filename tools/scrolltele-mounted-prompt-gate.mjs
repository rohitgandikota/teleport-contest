// Required tracked C/source/input evidence precedes every gameplay import.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync, readdirSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length <= 3 && (process.argv[2] === undefined
    || (process.argv[2] && !process.argv[2].startsWith('-'))),
    'usage: scrolltele-mounted-prompt-gate.mjs [new-compact-report.json]; no selectors');
const target = process.argv[2] || null;
assert.ok(!target || !existsSync(target), 'report path must be new');
const repo = new URL('../', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function pinned(path, digest) {
    const bytes = readFileSync(new URL(path, repo));
    assert.equal(sha(bytes), digest, 'exact tracked evidence: ' + path);
    return bytes;
}
const evidence = 'tools/gen-sessions/evidence/scrolltele-mounted-prompt/';
const evidencePins = {
    "README.md": "8ce26d8234c4f55ee0cda66d96733f09b6ed73b453899f4286ec1b5432fa8cb7",
    "assertion-body.json": "2340044064d1f9d202447ffd27bdd71798d5c5af7fc2f3115d1382d12078f8ca",
    "baseline-native.json": "88c56ee8230ab7776a940ad5ffde5c8858f2498c5fec6abd511353750f5ae828",
    "baseline-ordinary.json": "7159733c833ae0c1d42b24801d891e4a855b9180f46a8053635a66a2dbf10578",
    "candidate-native.json": "211e6c75bf1dd5f78286814fcfcc468be4ddd26d5c62e65bf46daf815f9ab2ab",
    "candidate-ordinary.json": "7bbb58bcd2be2fc1d48dffc322c036633d03cae19cc9ce3a4d909956b66bcfb2",
    "candidate-probe-adaptation.json": "4a5b3078894cc3ffc6ebb1d59aa9a9305befee6741437a1681b794024e6535f7",
    "candidate-review.md": "28a6778ccfc6bb819912c07bd292b3846b091b029c6172783f74eef8471145b7",
    "candidate-validation.json": "fbd7417a5e13a9e4e2beb5b550eed6feea6a3da4b4f0ae1b60825cc9875f2a0d",
    "input-lock.json": "ee0304f24f9094f8899bd1e9d9f9c133afa507b664217c405ae245632862ca2e",
    "native-recording.json": "5a10651fcfc55c8028840e812022728885cf7d663a49e73ebb512bea7facdce2",
    "negative-hashes.json": "05aa6cc32c2d8adbc3e32a131dc57218ed65c844a32c93284d46a8c4a8293156",
    "original-probe.mjs": "bbc5a58efed6e32377705f43fe59cddd54c6d1a845c687d4c6913c2c61dc1554",
    "parent-input-lock.json": "a85a71b8317daaef8582c4b868a50a9a4da1b2376b53bb556d331c64240450fc",
    "predictions.json": "2b6dd896c1f7a9abd96a926b67e8ebb7beb708e86602098f382528d3cb69d1f6",
    "producer-origin.json": "0c4d5f7d3f5de7a9d6237679f0c8d547ff608f45a95277ed7c26535e23f074e9",
    "read-scope.json": "3bfc3e98777913e0b62b92ca9bcf9e750cc41176db64ded2b160f2af8a0af0d2",
    "scope.json": "b8257c7971165c134d68d69e52efbaaffc4b3d85458954c984f6072d8e31b6d8",
    "source-pin-setup-initial.json": "3033fb2b9ad31aafcbc68816f2e7989637e909082de362b40aa835cf1210d4e1",
    "source-pin-setup-second.json": "67050bdbc112af55292bea2171c21dcc670791a6972de54dfb298228f56a7358",
    "source-pins.json": "0eea395c88c705283690a462c82e00db130a2e43f7da6efbf15d1975dae009bd",
    "source-provenance.json": "822fff1eb4e1167ae15f1fef06591dbbce1aa825239d411a05506277faa34088",
    "source-review.md": "b4927342eb4631d9263a87495f35a604a7c3b62783e0df6610a2a9d2d146796a"
};
for (const [name, digest] of Object.entries(evidencePins)) pinned(evidence + name, digest);
const readEvidence = name => JSON.parse(pinned(evidence + name, evidencePins[name]));
const provenance = readEvidence('source-provenance.json');
assert.equal(provenance.sourceSealSHA256, '50c59f41c15c0d11d59fa675e2a9f18debadcea472af97c5d67adae9086b8f9e');
assert.equal(provenance.candidateSealSHA256, '759d5fae79b66bbd3c96a956473b6867a8a80e9a3b5bd79d7d3bd258512833e0');
assert.equal(provenance.baselineSnapshotRequired, false);
assert.equal(provenance.historicalHashesOnly, true);
const recipeBytes = pinned('tools/gen-sessions/recipes/scrolltele-mounted-prompt.json',
    '6262c6c0fd0f998e881e687fa57a248deb4de033ceaa88cd580eb65a40ee3ce3');
const recipe = JSON.parse(recipeBytes);
const lock = readEvidence('input-lock.json');
assert.equal(lock.beforeGameplayAndCandidate, true);
assert.equal(provenance.sourceInputLockSHA256, evidencePins['input-lock.json']);
assert.equal(provenance.recipeSHA256, sha(recipeBytes));
assert.deepEqual(Object.keys(lock.files).sort(),
    [...Object.keys(provenance.publicPathsForOriginalLock),
     ...Object.keys(provenance.historicalLockOnlyFiles)].sort());
for (const [name, path] of Object.entries(provenance.publicPathsForOriginalLock))
    pinned(path, lock.files[name]);
assert.deepEqual(provenance.historicalLockOnlyFiles,
    {'baseline-runtime.json':provenance.sourceBaselineRuntimeSHA256});
assert.equal(lock.files['baseline-runtime.json'], provenance.sourceBaselineRuntimeSHA256);
const originalProbe = pinned(evidence + 'original-probe.mjs', lock.probeSHA256).toString();
assert.equal(provenance.sourceProbeSHA256, lock.probeSHA256);
const predictions = readEvidence('predictions.json');
const negative = readEvidence('negative-hashes.json');
assert.deepEqual(lock.negativeIndexes, [2,3]);
assert.deepEqual(negative.map(row => row.index), lock.negativeIndexes);
assert.equal(negative.reduce((n,row) => n+Object.keys(row.hashes).length,0), 10);

const fields = ['name','seed','datetime','nethackrc','moves'];
assert.deepEqual(lock.fields, fields);
const fieldTuple = part => fields.map(field => ({field, present:Object.hasOwn(part,field),
    ...(Object.hasOwn(part,field) ? {value:part[field]} : {})}));
const tuples = recipe.segments.map(fieldTuple);
const keys = recipe.segments.map(part => [null,...part.moves]);
assert.deepEqual(tuples, lock.tuples);
assert.ok(tuples.every(row => row.every(field => field.present)));
assert.equal(sha(JSON.stringify(tuples)), lock.tuplesSHA256);
assert.equal(lock.tuplesSHA256, 'fa57ee01b503213c8132154bab16c8d1855011736587e795addd8ba988e02b8c');
assert.equal(sha(JSON.stringify(keys)), lock.allKeysSHA256);
assert.equal(lock.allKeysSHA256, 'da698eb991802119e34da681fc249d86677cc92fe740d6b3c06a031677506264');
assert.equal(recipe.segments.length, 4);
assert.equal(recipe.segments.reduce((n,part) => n+part.moves.length,0), 266);
assert.equal(keys.flat().length, 270);
const parentLock = readEvidence('parent-input-lock.json');
assert.equal(parentLock.sourceSealSHA256, provenance.sourceSealSHA256);
for (const field of ['sourceRecipeSHA256','primaryRecipeSHA256','minimalSHA256'])
    assert.equal(parentLock[field], sha(recipeBytes));
assert.equal(parentLock.beforeC, true);
assert.equal(parentLock.preserveAllRootMetadata, true);

const rawBytes = pinned('tools/gen-sessions/generated/scrolltele-mounted-prompt.session.json',
    '00e4b2257cb728e331561ff7292c3ea54687c109636b11442bd6364d46207de5');
assert.equal(rawBytes.length, 569315);
const raw = JSON.parse(rawBytes);
assert.equal(raw.source, 'c');
assert.equal(raw.version, 5);
assert.equal(raw.segments.length, 4);
assert.deepEqual(Object.keys(raw).filter(k => k !== 'segments').sort(),
    Object.keys(recipe).filter(k => k !== 'segments').sort());
for (const key of Object.keys(recipe))
    if (key !== 'segments') assert.deepEqual(raw[key], recipe[key]);
assert.deepEqual(raw.segments.map(fieldTuple), tuples);
assert.deepEqual(raw.segments.map(part => part.steps.map(step => step.key)), keys);
assert.deepEqual(recordingIntegrityErrors(raw), []);
assert.equal(recipe.requireBranchAssertions, true);
assert.deepEqual(recipe.branchAssertions.map(row => row.segment), [0,1,2,3]);
assert.deepEqual(recipe.branchAssertions.map(row => row.branch), recipe.branches);
assert.deepEqual(branchAssertionErrors(recipe), []);
assert.deepEqual(branchAssertionErrors(recipe,raw), []);
const recording = readEvidence('native-recording.json');
assert.equal(recording.rawSha256, sha(rawBytes));
assert.equal(recording.primaryRecipeSHA256, sha(recipeBytes));
assert.equal(recording.bytes, rawBytes.length);
for (const field of ['cExecutedOnce','fiveInputFieldsAndPresencePreserved','allKeysExact','rootMetadataPreserved'])
    assert.equal(recording[field], true);

// Historical failures and observations are fixed expectations, never live state.
const baseline = readEvidence('baseline-ordinary.json');
const expected = readEvidence('candidate-ordinary.json');
const baselineNative = readEvidence('baseline-native.json');
const candidateNative = readEvidence('candidate-native.json');
const validation = readEvidence('candidate-validation.json');
assert.equal(expected.recipeSHA256, sha(recipeBytes));
assert.equal(expected.runtimeSHA256, provenance.candidateRuntimeSHA256);
assert.equal(baseline.runtimeSHA256, provenance.sourceBaselineRuntimeSHA256);
assert.deepEqual(baseline.failures.map(row => [row.case,row.name]), [
    ['mounted-explore-blessed-cancel','C controlled prompt includes the actual mounted name'],
    ['mounted-wizard-blessed-cancel','C controlled prompt includes the actual mounted name']]);
assert.equal(expected.checks, 44);
assert.deepEqual(expected.failures, []);
assert.ok(expected.rows.every(row => row.checks.length === 11 && row.checks.every(check => check.pass)));
assert.equal(validation.ordinaryPassed, 44);
assert.equal(validation.nativePassed, 4);
assert.equal(validation.negativeHashes, 10);
assert.equal(validation.completeOrdinaryNegativeRowsUnchanged, 2);
assert.equal(validation.completeNativeNegativeRowsUnchanged, 2);
const exactNative = row => row.fullStyleExact && row.frozenScreenCursorExact
    && row.fullRngExact && row.animationExact;
assert.equal(baselineNative.length, 4);
assert.equal(candidateNative.length, 4);
assert.equal(baselineNative.filter(exactNative).length, 2);
assert.ok(candidateNative.every(exactNative));
assert.ok(candidateNative.every(row => row.calls.discardedEntries === 0));
for (const {index,hashes} of negative) {
    assert.deepEqual(candidateNative[index], baselineNative[index]);
    assert.deepEqual(expected.rows[index], baseline.rows[index]);
    assert.deepEqual(expected.rows[index].hashes, hashes);
}
for (const name of provenance.failedSetups) assert.equal(readEvidence(name).pass, false);
const adaptation = readEvidence('candidate-probe-adaptation.json');
const startMarker = 'const ' + 'object =';
const endMarker = '\n// ' + 'END ORIGINAL ASSERTION BODY';
const originalBody = originalProbe.slice(originalProbe.indexOf(startMarker),
    originalProbe.indexOf('\nverifyRuntime();\nconst failures'));
const installedGate = readFileSync(new URL(import.meta.url),'utf8');
const installedBody = installedGate.slice(installedGate.indexOf(startMarker), installedGate.indexOf(endMarker));
assert.equal(installedBody, originalBody, 'all original44 observation/assertion bodies unchanged');
assert.equal(sha(installedBody), lock.assertionBodySHA256);
assert.equal(sha(installedBody), adaptation.assertionAndObserverBodySHA256);
assert.equal(adaptation.preservedChecks, 44);

pinned('tools/gen-sessions/assertions.mjs', 'aed2dfe01e18cb2e8b0d62e389ab9d8a9c02b0e3e98d4e427fcead4c228e3adc');
pinned('tools/gen-sessions/screen-decode.mjs', '0831fd4db121dab1d3c8f80efac29c68ce50f67fedbb49f2bd7c21371244dae0');
pinned('tools/half-damage-reader-observe.mjs', '201cdafe4409d5d58414c1d0ebc0449c32b29834cdf35c72c151a555d9031d07');
pinned('frozen/screen-decode.mjs', 'cb4a0fbfed3dda28c14736e6ae9c8b9eb8c87d75916c50d6df80f40eb0368cbe');

// Discover the installed graph; historical runtime hashes are provenance only.
function currentRuntime() {
    const paths = [];
    function visit(directory) {
        for (const name of readdirSync(new URL(directory,repo))) {
            const path = directory + name;
            if (statSync(new URL(path,repo)).isDirectory()) visit(path + '/');
            else if (path.endsWith('.js')) paths.push(path);
        }
    }
    visit('js/');
    const map = Object.fromEntries(paths.sort().map(path =>
        [path,sha(readFileSync(new URL(path,repo)))]));
    return {files:paths.length,sha256:sha(JSON.stringify(map,null,2)+'\n')};
}
const runtime = currentRuntime();
function verifyRuntime() {
    assert.deepEqual(currentRuntime(),runtime,'installed graph unchanged during this invocation');
}

// All gameplay imports follow mandatory original C/source/input preflight.
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {ONAMES} = await import('../js/objects_data.js');
const {PMNAMES} = await import('../js/monst_data.js');
const {W_SADDLE} = await import('../js/const.js');
const {Blind,Blinded,Hallucination,Confusion,Stunned,Teleport_control} = await import('../js/youprop.js');
const {noteleport_level} = await import('../js/teleport.js');
const {unconscious} = await import('../js/trap.js');
const {decodeScreen,renderCell} = await import('../frozen/screen-decode.mjs');
const {outputs,hashes,hash,deferred} = await import('./half-damage-reader-observe.mjs');

const object = o => ({id:o.o_id,type:o.otyp,quantity:o.quan,letter:o.invlet,
    blessed:!!o.blessed,cursed:!!o.cursed,seen:!!o.dknown});
const rows = [];
for (const [index,part] of recipe.segments.entries()) {
    const p = predictions[index], states = [], checks = [];
    const check = (name,body) => {
        try {body();checks.push({name,pass:true});}
        catch(error) {checks.push({name,pass:false,error:error.message});}
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run,runError;
    try {
        globalThis.__step_snapshot = {step:'*',cb(g,step) {
            if (!g.u || !g.level || !g.youmonst?.data) return;
            const m = g.u.usteed;
            states.push({step,turn:g.moves,hp:g.u.uhp,mortality:g.u.umortality || 0,
                xy:[g.u.ux,g.u.uy],level:{...g.u.uz},wizard:!!g.wizard,explore:!!g.discover,
                naturalNoTeleport:!!g.level.flags.noteleport,stasisUntil:g.level.flags.stasis_until || 0,
                restricted:!!noteleport_level(g.youmonst),blind:!!Blind(),blinded:!!Blinded(),
                hallucinating:!!Hallucination(),confused:!!Confusion(),stunned:!!Stunned(),
                unconscious:!!unconscious(),teleportControl:!!Teleport_control(),
                scrollKnown:!!g.objects[ONAMES.SCR_TELEPORTATION].oc_name_known,
                wishes:g.u.uconduct?.wishes || 0,inventoryCount:(g.invent || []).length,
                scrolls:(g.invent || []).filter(o => o.otyp === ONAMES.SCR_TELEPORTATION).map(object),
                steed:m ? {id:m.m_id,type:m.mnum,xy:[m.mx,m.my],hp:m.mhp,tame:m.mtame,
                    givenName:m.mextra?.mgivenname || m.mgivenname || '',invisible:!!m.minvis,
                    appearanceType:m.m_ap_type || 0,wornSaddle:!!((m.misc_worn_check || 0)&W_SADDLE),
                    saddle:(m.minvent || []).some(o => o.otyp === ONAMES.SADDLE
                        && !!(o.owornmask&W_SADDLE) && o.leashmon === m.m_id),
                    rawMapOccupant:g.level.monAt.get(`${m.mx},${m.my}`)?.m_id || null} : null});
        }};
        run = await runSegment({...part,storage:new InMemoryStorage()});
    } catch(error) {runError=error.stack;}
    finally {
        if (previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    const out = run ? structuredClone(outputs(run)) : null;
    const texts = out?.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n')) || [];
    const at = step => states.find(s => s.step === step);
    const first = at(1), mounted = p.mounted ? at(p.mountStep) : null;
    const beforeRead = at(p.beforeRead), last = states.at(-1);
    const prompts = texts.flatMap((text,step) => step > p.beforeRead
        && /Where do .* want to be teleported\?/.test(text)
        ? [{step,top:text.split('\n').slice(0,2).join('\n')}] : []);
    const promptState = prompts.length ? at(prompts[0].step) : null;
    check('real maintained mount producer or unmounted control',() => {
        assert.equal(first?.steed,null);
        if (p.mounted) {
            assert.equal(first.inventoryCount,0);
            assert.ok(mounted?.steed && mounted.steed.hp>0 && mounted.steed.tame>0);
            assert.equal(mounted.steed.type,PMNAMES.PM_PONY);
            assert.ok(mounted.steed.saddle && mounted.steed.wornSaddle);
            assert.equal(mounted.steed.rawMapOccupant,null);
            assert.deepEqual(mounted.xy,[40,4]);
            assert.deepEqual(mounted.steed.xy,mounted.xy);
            assert.ok(states.filter(s => s.step>=p.mountStep).every(s =>
                s.steed?.id === mounted.steed.id && s.steed.hp>0 && s.steed.saddle));
        } else assert.ok(states.every(s => s.steed === null));
    });
    check('real wished blessed scroll is ready to read',() => {
        assert.equal(beforeRead?.wishes,1);
        assert.equal(beforeRead.scrolls.length,1);
        const scroll=beforeRead.scrolls[0];
        assert.equal(scroll.type,ONAMES.SCR_TELEPORTATION);
        assert.equal(scroll.quantity,1);assert.equal(scroll.letter,p.scrollLetter);
        assert.equal(scroll.blessed,true);assert.equal(scroll.cursed,false);assert.equal(scroll.seen,true);
        assert.equal(beforeRead.scrollKnown,false);
    });
    check('actual wizard or explore flag at the read',() => {
        assert.equal(beforeRead?.wizard,p.wizard);
        assert.equal(beforeRead?.explore,!p.wizard);
        assert.equal(texts.some(t => t.includes('now in non-scoring explore mode')),!p.wizard);
    });
    check('unrestricted conscious sober controlled branch',() => {
        assert.ok(beforeRead);
        for (const field of ['naturalNoTeleport','restricted','blind','blinded','hallucinating',
                             'confused','stunned','unconscious','teleportControl'])
            assert.equal(beforeRead[field],false,field);
        assert.equal(beforeRead.stasisUntil,0);
        assert.equal(texts.some(t => t.includes('A mysterious force prevents you from teleporting!')),false);
    });
    check('actual steed and naming prerequisites at controlled prompt',() => {
        assert.ok(prompts.length>0 && promptState,'real prompt boundary observed');
        assert.equal(promptState.wizard,p.wizard);
        assert.equal(promptState.explore,!p.wizard);
        assert.equal(promptState.unconscious,false);assert.equal(promptState.stunned,false);
        assert.equal(promptState.hallucinating,false);assert.equal(promptState.blind,false);
        if (p.mounted) {
            assert.equal(promptState.steed?.id,mounted.steed.id);
            assert.equal(promptState.steed.type,PMNAMES.PM_PONY);
            assert.equal(promptState.steed.givenName,'');assert.equal(promptState.steed.invisible,false);
            assert.equal(promptState.steed.appearanceType,0);
            assert.ok(promptState.steed.saddle && promptState.steed.wornSaddle);
            assert.deepEqual(promptState.steed.xy,promptState.xy);
        } else assert.equal(promptState.steed,null);
    });
    check('C controlled prompt includes the actual mounted name',() => {
        assert.ok(prompts.some(row => row.top.includes(p.expectedPrompt)),p.expectedPrompt);
        if (p.mounted) assert.ok(!prompts.some(row => row.top.includes('Where do you want to be teleported?')));
    });
    check('read discovers and consumes the scroll once',() => {
        assert.ok(last);assert.deepEqual(last.scrolls,[]);assert.equal(last.scrollKnown,true);
        assert.equal(last.wishes,beforeRead.wishes);
        assert.equal(last.turn-beforeRead.turn,1);
    });
    check('cancel preserves hero and steed destination',() => {
        assert.deepEqual(last.xy,beforeRead.xy);assert.deepEqual(last.level,beforeRead.level);
        assert.equal(texts.slice(p.beforeRead).some(t => t.includes('You materialize')),false);
        if (p.mounted) {
            assert.equal(last.steed?.id,beforeRead.steed.id);
            assert.deepEqual(last.steed.xy,beforeRead.steed.xy);
        } else assert.equal(last.steed,null);
    });
    check('survival, every key and every random slice',() => {
        assert.equal(runError,undefined);assert.ok(states.every(s => s.hp>0 && !s.mortality));
        assert.equal(last.step,part.moves.length);assert.equal(out.screens.length,part.moves.length+1);
        assert.deepEqual(out.slices.flat(),out.calls);
    });
    let plainHashes,deferredHashes,plainError,deferredError;
    try {plainHashes=hashes(outputs(await runSegment({...part,storage:new InMemoryStorage()})));}
    catch(error) {plainError=error.stack;}
    check('passive observation preserves all five streams',() => {
        assert.equal(plainError,undefined);assert.deepEqual(plainHashes,hashes(out));
    });
    try {deferredHashes=hashes(await deferred(part));}
    catch(error) {deferredError=error.stack;}
    check('deferred EOF preserves all five streams',() => {
        assert.equal(deferredError,undefined);assert.deepEqual(deferredHashes,hashes(out));
    });
    rows.push({name:part.name,checks,first,mounted,beforeRead,promptState,last,prompts,
        stateTraceSHA256:hash(states),hashes:out ? hashes(out) : null,plainHashes,deferredHashes,
        keys:part.moves.length,boundaries:out?.screens.length,calls:out?.calls.length,
        frames:out?.frames.flat().length,
        ...(runError || plainError || deferredError ? {runError,plainError,deferredError} : {})});
}
// END ORIGINAL ASSERTION BODY
verifyRuntime();
const failures = rows.flatMap(r => r.checks.filter(c => !c.pass).map(c => ({case:r.name,...c})));
const negativeChecks = negative.map(n => ({index:n.index,name:n.name,
    pass:JSON.stringify(rows[n.index].hashes)===JSON.stringify(n.hashes),
    expected:n.hashes,actual:rows[n.index].hashes}));
const report = {classification:'ordinary JS source-prediction controls, no native comparison',
    recipeSHA256:sha(recipeBytes),runtimeSHA256:runtime.sha256,
    cases:rows.length,checks:rows.reduce((n,row) => n+row.checks.length,0),failures,negativeChecks,rows};
if (target) writeFileSync(target, JSON.stringify(report,null,2)+'\n', {flag:'wx'});
console.log(JSON.stringify({cases:rows.length,checks:report.checks,passed:report.checks-failures.length,
    failures,runtimeSHA256:runtime.sha256,runtimeFiles:runtime.files,
    nativeProof:'inherited4/4; no fresh native comparison'}));
if (failures.length) process.exitCode = 1;
assert.deepEqual(rows,expected.rows,'fresh complete rows equal fixed candidate proof');
for (const {index,hashes} of negative) {
    assert.deepEqual(rows[index],baseline.rows[index],'complete ordinary negative row');
    assert.deepEqual(rows[index].hashes,hashes,'all10 original negative hashes');
}
