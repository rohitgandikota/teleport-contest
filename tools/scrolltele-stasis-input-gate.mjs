// Exact tracked C/input evidence is required before importing any game module.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync, readdirSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length <= 3 && (process.argv[2] === undefined
    || (process.argv[2] && !process.argv[2].startsWith('-'))),
    'usage: scrolltele-stasis-input-gate.mjs [new-compact-report.json]; no selectors');
const target = process.argv[2] || null;
assert.ok(!target || !existsSync(target), 'report path must be new');
const repo = new URL('../', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function pinned(path, digest) {
    const bytes = readFileSync(new URL(path, repo));
    assert.equal(sha(bytes), digest, 'exact tracked evidence: ' + path);
    return bytes;
}
const evidence = 'tools/gen-sessions/evidence/scrolltele-stasis/';
const evidencePins = {
    "README.md": "505c09ef78c258bc0acfb34851c136700ce85db7782a80b4bd2b80661fc983ae",
    "baseline-native.json": "82906c1777fdb8c6b2530a579d31739efe25cb06d60bdf634e1a42dd394997e2",
    "baseline-ordinary.json": "971ada8453f00c8c6dd825cf54228637463dead1659967dcd925bd39ed793ece",
    "candidate-native.json": "9d1d50ec1dd991511c7062c3f424930efcb1d4cc961d4684e94c84645d0e402d",
    "candidate-ordinary.json": "298405cc1ce735ec72de17977896340d62bc5c40fddeb6f76a74ffc5150d28ad",
    "candidate-probe-adaptation.json": "e0345fa1b39f5285c135546dbb0d105b53e31cc1fd5a2dcdeb98d519f442e95b",
    "candidate-review.md": "33994a3eb52587b50267f5dfc09467447109f94ba3fef8292860bce27099a2a9",
    "candidate-validation.json": "1644ad5f3c11cc6215b4688e98ed48521166036c08663c0d12bf5f446c6fc9a8",
    "canonical-input-lock.json": "646cebf1b3be55119a50a87ccacb7321ceaff06afe96a7ea72847895606bd3d3",
    "input-lock.json": "afa0134ea23ffa3c81aa90479b6aab147fe820bffd63b6f5ea378bfcd86826ce",
    "native-recording.json": "aea903f7e618c0eb0e9bf1a6083ed46eaafbf112cf2a2e9fef9197fcf6b5efbb",
    "negative-hashes.json": "2f6ffd528cee45fc57641b52bd0fa734fa03a2641d461ee7bb441fad3d9df877",
    "original-probe.mjs": "b8cdb15d271c455ef2d435b4a35af14505510a48b456e6d152d109dc3df79656",
    "parent-input-lock.json": "041ad2ecbf4b64a0572cc34393721bc11046c19978c14c1382b3339f4266aa7c",
    "predictions.json": "82cbf3fb6a978648dfd7186c1af1f360db18b68d099583b2bb9c83ef69b2b597",
    "producer-origin.json": "79ebf87251b260badddc55b6a44f9d1be9d270fd8914b69dc7c1473666de97ed",
    "scope.json": "4b71625fd6262b6cfdda400868e705627695636b9c248a2b9a83a456d6b1e713",
    "source-pins.json": "9d9ad7ba81a84fc3548ce0ec2a87c093e342c23760dea881c0f6693aa9c4f0d2",
    "source-provenance.json": "f9fa04b79043c54cd178699fc48def36f12012adb5f726a35b5c71d99cd7f94b",
    "source-review.md": "d61726c12c6c9fbc5f81dfc8b2ba521f4c271b8b0222c87afa96977112855028"
};
for (const [name, digest] of Object.entries(evidencePins)) pinned(evidence + name, digest);
const readEvidence = name => JSON.parse(pinned(evidence + name, evidencePins[name]));
const provenance = readEvidence('source-provenance.json');
assert.equal(provenance.sourceSealSHA256, '4609d027ad71d9e24ccc7ce7d9ef3b0f283f116c90f55fa8d8accb27a297b672');
assert.equal(provenance.candidateSealSHA256, 'f0a954f74602a70d4f79a02f194dddcf0382f31a45d61a761650d4eeebfeebee');
const recipeBytes = pinned('tools/gen-sessions/recipes/scrolltele-stasis.json',
    '79e04384ef460142fcc8ba9043915261cd60535c09e5b4e57b0723d9bb3a4785');
const recipe = JSON.parse(recipeBytes);
const lock = readEvidence('input-lock.json');
assert.equal(lock.beforeGameplayCAndCandidate, true);
assert.equal(lock.files['recipe.json'], sha(recipeBytes));
assert.equal(provenance.sourceInputLockSHA256, evidencePins['input-lock.json']);
assert.equal(provenance.recipeSHA256, sha(recipeBytes));
assert.equal(provenance.baselineSnapshotRequired, false);
assert.equal(provenance.historicalHashesOnly, true);
assert.deepEqual(Object.keys(lock.files).sort(),
    [...Object.keys(provenance.publicPathsForOriginalLock),
     ...Object.keys(provenance.historicalLockOnlyFiles)].sort());
for (const [name, path] of Object.entries(provenance.publicPathsForOriginalLock))
    pinned(path, lock.files[name]);
assert.deepEqual(provenance.historicalLockOnlyFiles,
    {'baseline-runtime.json':provenance.sourceBaselineRuntimeSHA256});
assert.equal(lock.files['baseline-runtime.json'], provenance.sourceBaselineRuntimeSHA256);
const originalProbe = pinned(evidence + 'original-probe.mjs', lock.probeSHA256).toString();
assert.equal(lock.probeSHA256, provenance.sourceProbeSHA256);
const predictions = readEvidence('predictions.json');
const negative = readEvidence('negative-hashes.json');
assert.deepEqual(lock.negativeIndexes, [1,2,3]);
assert.deepEqual(negative.map(row => row.index), lock.negativeIndexes);
assert.equal(negative.reduce((n,row) => n+Object.keys(row.hashes).length,0), 15);
const originalTuples = recipe.segments.map(part => Object.fromEntries(lock.fields.map(field =>
    [field,{present:Object.hasOwn(part,field), ...(Object.hasOwn(part,field) ? {value:part[field]} : {})}])));
assert.deepEqual(originalTuples, lock.tuples);
assert.equal(sha(JSON.stringify(originalTuples)), lock.tupleSHA256);
assert.equal(sha(JSON.stringify(recipe.segments.map(part => [null,...part.moves].map(key =>
    key === null ? null : key.charCodeAt(0))))), lock.allKeysSHA256);

const canonical = readEvidence('canonical-input-lock.json');
assert.equal(canonical.originalInputLockSHA256, evidencePins['input-lock.json']);
assert.equal(canonical.recipeSHA256, sha(recipeBytes));
assert.equal(canonical.inputChanged, false);
assert.equal(canonical.recipeChanged, false);
const fields = ['name','seed','datetime','nethackrc','moves'];
assert.deepEqual(canonical.fields, fields);
const fieldTuple = part => fields.map(field => ({field, present:Object.hasOwn(part,field),
    ...(Object.hasOwn(part,field) ? {value:part[field]} : {})}));
const tuples = recipe.segments.map(fieldTuple);
const keys = recipe.segments.map(part => [null,...part.moves]);
assert.deepEqual(tuples, canonical.tuples);
assert.ok(tuples.every(row => row.every(field => field.present)));
assert.equal(sha(JSON.stringify(tuples)), canonical.tuplesSHA256);
assert.equal(canonical.tuplesSHA256, '7de53ff9ad64c5b839657dc70def4993391bbb361e6bfdd7f33c459b5311f820');
assert.equal(sha(JSON.stringify(keys)), canonical.allKeysSHA256);
assert.equal(canonical.allKeysSHA256, 'e258f4d19768ce04d2d95fe90e83b8923a2236ca86fef83e70d7a1f45d4fd467');
assert.equal(recipe.segments.length, 4);
assert.equal(recipe.segments.reduce((n,part) => n+part.moves.length,0), 210);
assert.equal(keys.flat().length, 214);
const parentLock = readEvidence('parent-input-lock.json');
assert.equal(parentLock.sourceSealSHA256, provenance.sourceSealSHA256);
assert.equal(parentLock.sourceRecipeSHA256, sha(recipeBytes));
assert.equal(parentLock.primaryRecipeSHA256, sha(recipeBytes));
assert.equal(parentLock.minimalSHA256, sha(recipeBytes));
assert.equal(parentLock.beforeC, true);
assert.equal(parentLock.preserveAllRootMetadata, true);

const rawBytes = pinned('tools/gen-sessions/generated/scrolltele-stasis.session.json',
    'acb416f39cf234e10fff73ad999f0bcff6ae6f41d2423cedfbe9db38af946809');
assert.equal(rawBytes.length, 566434);
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
assert.equal(recording.cExecutedOnce, true);
assert.equal(recording.fiveInputFieldsAndPresencePreserved, true);
assert.equal(recording.allKeysExact, true);
assert.equal(recording.rootMetadataPreserved, true);

// Preserve historical failures and proof; saved observations are expectations only.
const baseline = readEvidence('baseline-ordinary.json');
const expected = readEvidence('candidate-ordinary.json');
const baselineNative = readEvidence('baseline-native.json');
const candidateNative = readEvidence('candidate-native.json');
const validation = readEvidence('candidate-validation.json');
assert.equal(expected.recipeSHA256, sha(recipeBytes));
assert.equal(expected.runtimeSHA256, provenance.candidateRuntimeSHA256);
assert.equal(baseline.runtimeSHA256, provenance.sourceBaselineRuntimeSHA256);
assert.deepEqual(baseline.failures.map(row => [row.case,row.name]),
    [['explore-stasis-blocked','C scrolltele early restriction feedback']]);
assert.equal(expected.checks, 44);
assert.deepEqual(expected.failures, []);
assert.ok(expected.rows.every(row => row.checks.length === 11 && row.checks.every(check => check.pass)));
assert.equal(validation.ordinaryPassed, 44);
assert.equal(validation.nativePassed, 4);
assert.equal(validation.negativeHashes, 15);
assert.equal(validation.completeOrdinaryNegativeRowsUnchanged, 3);
assert.equal(validation.completeNativeNegativeRowsUnchanged, 3);
const exactNative = row => row.fullStyleExact && row.frozenScreenCursorExact
    && row.fullRngExact && row.animationExact;
assert.equal(baselineNative.length, 4);
assert.equal(candidateNative.length, 4);
assert.equal(baselineNative.filter(exactNative).length, 3);
assert.ok(candidateNative.every(exactNative));
assert.ok(candidateNative.every(row => row.calls.discardedEntries === 0));
for (const {index,hashes} of negative) {
    assert.deepEqual(candidateNative[index], baselineNative[index]);
    assert.deepEqual(expected.rows[index], baseline.rows[index]);
    assert.deepEqual(expected.rows[index].hashes, hashes);
}
const adaptation = readEvidence('candidate-probe-adaptation.json');
const startMarker = 'const ' + 'object =';
const endMarker = '\n// ' + 'END ORIGINAL ASSERTION BODY';
const originalBody = originalProbe.slice(originalProbe.indexOf(startMarker),
    originalProbe.indexOf('\nverifyRuntime();\nconst failures'));
const installedGate = readFileSync(new URL(import.meta.url),'utf8');
const installedBody = installedGate.slice(installedGate.indexOf(startMarker), installedGate.indexOf(endMarker));
assert.equal(installedBody, originalBody, 'all original44 observation/assertion bodies unchanged');
assert.equal(sha(installedBody), adaptation.assertionAndObserverBodySHA256);
assert.equal(adaptation.preservedChecks, 44);

pinned('tools/gen-sessions/assertions.mjs', 'aed2dfe01e18cb2e8b0d62e389ab9d8a9c02b0e3e98d4e427fcead4c228e3adc');
pinned('tools/gen-sessions/screen-decode.mjs', '0831fd4db121dab1d3c8f80efac29c68ce50f67fedbb49f2bd7c21371244dae0');
pinned('tools/half-damage-reader-observe.mjs', '201cdafe4409d5d58414c1d0ebc0449c32b29834cdf35c72c151a555d9031d07');
pinned('frozen/screen-decode.mjs', 'cb4a0fbfed3dda28c14736e6ae9c8b9eb8c87d75916c50d6df80f40eb0368cbe');

// Record the installed graph, without requiring any historical snapshot or hash.
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

// All game imports follow the complete C/source/input/primary preflight.
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {ONAMES} = await import('../js/objects_data.js');
const {Blind, Blinded, Confusion, Stunned, Teleport_control} = await import('../js/youprop.js');
const {noteleport_level} = await import('../js/teleport.js');
const {unconscious} = await import('../js/trap.js');
const {decodeScreen, renderCell} = await import('../frozen/screen-decode.mjs');
const {outputs, hashes, hash, deferred} = await import('./half-damage-reader-observe.mjs');

const object = o => ({id:o.o_id, type:o.otyp, quantity:o.quan, letter:o.invlet,
    charges:o.spe, blessed:!!o.blessed, cursed:!!o.cursed, seen:!!o.dknown});
const rows = [];
for (const [index, part] of recipe.segments.entries()) {
    const p = predictions[index];
    const states = [], checks = [];
    const check = (name, body) => {
        try { body(); checks.push({name, pass:true}); }
        catch (error) { checks.push({name, pass:false, error:error.message}); }
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run, runError;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (!g.u || !g.level || !g.youmonst?.data) return;
            states.push({step, turn:g.moves, hp:g.u.uhp, mortality:g.u.umortality || 0,
                xy:[g.u.ux,g.u.uy], level:{...g.u.uz}, wizard:!!g.wizard, explore:!!g.discover,
                naturalNoTeleport:!!g.level.flags.noteleport,
                stasisUntil:g.level.flags.stasis_until || 0,
                restricted:!!noteleport_level(g.youmonst),
                blind:!!Blind(), blinded:!!Blinded(), confused:!!Confusion(), stunned:!!Stunned(),
                unconscious:!!unconscious(), teleportControl:!!Teleport_control(),
                scrollKnown:!!g.objects[ONAMES.SCR_TELEPORTATION].oc_name_known,
                inventory:(g.invent || []).filter(o =>
                    [ONAMES.WAN_STASIS,ONAMES.SCR_TELEPORTATION].includes(o.otyp)).map(object)});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } catch (error) { runError = error.stack; }
    finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const out = run ? structuredClone(outputs(run)) : null;
    const texts = out?.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n')) || [];
    const at = step => states.find(s => s.step === step);
    const first = at(1), beforeAction = at(p.beforeAction), beforeRead = at(p.beforeRead);
    const last = states.at(-1);
    const wand = s => s?.inventory.find(o => o.type === ONAMES.WAN_STASIS);
    const scroll = s => s?.inventory.find(o => o.type === ONAMES.SCR_TELEPORTATION);
    check('maintained startup produces a charged stasis wand', () => {
        assert.ok(first && first.hp > 0);
        assert.equal(wand(first)?.letter, 'c');
        assert.equal(wand(first)?.charges, 3);
        assert.equal(wand(first)?.cursed, false);
        assert.equal(first.stasisUntil, 0);
    });
    check('real blessed teleport scroll is ready to read', () => {
        assert.equal(scroll(beforeRead)?.letter, 'o');
        assert.equal(scroll(beforeRead)?.quantity, 1);
        assert.equal(scroll(beforeRead)?.blessed, true);
        assert.equal(scroll(beforeRead)?.cursed, false);
        assert.equal(scroll(beforeRead)?.seen, true);
        assert.equal(beforeRead.scrollKnown, false);
    });
    check('actual explore transition and wizard bypass flag', () => {
        assert.equal(beforeRead?.wizard, p.wizard);
        assert.equal(beforeRead?.explore, !p.wizard);
        assert.equal(texts.some(t => t.includes('now in non-scoring explore mode')), !p.wizard);
    });
    check('real activation charge, timeout and restriction predicate', () => {
        assert.equal(beforeRead?.naturalNoTeleport, false);
        assert.equal(beforeRead?.restricted, p.stasis);
        assert.equal(wand(beforeRead)?.charges, 3 - Number(p.stasis));
        assert.equal(beforeRead.turn - beforeAction.turn, 1);
        if (p.stasis) {
            assert.ok(beforeRead.stasisUntil >= beforeRead.turn);
            assert.ok(beforeRead.stasisUntil - beforeAction.turn >= 10);
            assert.ok(beforeRead.stasisUntil - beforeAction.turn <= 30);
        } else assert.equal(beforeRead.stasisUntil, 0);
    });
    check('ordinary perception and control prerequisites', () => {
        assert.equal(beforeRead.blind, false);
        assert.equal(beforeRead.blinded, false);
        assert.equal(beforeRead.confused, false);
        assert.equal(beforeRead.stunned, false);
        assert.equal(beforeRead.unconscious, false);
        assert.equal(beforeRead.teleportControl, false);
    });
    check('C scrolltele early restriction feedback', () => {
        const tail = texts.slice(p.beforeRead);
        assert.equal(tail.some(t => t.includes('A mysterious force prevents you from teleporting!')), p.blocked);
        assert.equal(tail.some(t => t.includes('Where do you want to be teleported?')), !p.blocked);
    });
    check('real read consumes and discovers the scroll', () => {
        assert.equal(scroll(last), undefined);
        assert.equal(last.scrollKnown, true);
        assert.equal(last.turn - beforeRead.turn, 1);
        assert.equal(wand(last)?.id, wand(first)?.id);
    });
    check('blocked or cancelled destination preserves location', () => {
        assert.deepEqual(last.xy, beforeRead.xy);
        assert.deepEqual(last.level, beforeRead.level);
        assert.equal(texts.some(t => t.includes('You materialize')), false);
    });
    check('survival, every key and every random slice', () => {
        assert.equal(runError, undefined);
        assert.ok(states.every(s => s.hp > 0 && !s.mortality));
        assert.equal(last.step, part.moves.length);
        assert.equal(out.screens.length, part.moves.length + 1);
        assert.deepEqual(out.slices.flat(), out.calls);
    });
    let plainHashes, deferredHashes, plainError, deferredError;
    try { plainHashes = hashes(outputs(await runSegment({...part,storage:new InMemoryStorage()}))); }
    catch (error) { plainError = error.stack; }
    check('passive observation preserves all five streams', () => {
        assert.equal(plainError, undefined);
        assert.deepEqual(plainHashes, hashes(out));
    });
    try { deferredHashes = hashes(await deferred(part)); }
    catch (error) { deferredError = error.stack; }
    check('deferred EOF preserves all five streams', () => {
        assert.equal(deferredError, undefined);
        assert.deepEqual(deferredHashes, hashes(out));
    });
    rows.push({name:part.name, checks, first, beforeAction, beforeRead, last,
        events: texts.flatMap((text,step) => step >= p.beforeRead &&
            /teleport|read the scroll|scroll disappears|Never mind/.test(text)
            ? [{step, top:text.split('\n').slice(0,2).join('\n')}] : []),
        stateTraceSHA256:hash(states), hashes:out ? hashes(out) : null, plainHashes, deferredHashes,
        keys:part.moves.length, boundaries:out?.screens.length,
        calls:out?.calls.length, frames:out?.frames.flat().length,
        ...(runError || plainError || deferredError ? {runError,plainError,deferredError} : {})});
}
// END ORIGINAL ASSERTION BODY
verifyRuntime();
const failures = rows.flatMap(r => r.checks.filter(c => !c.pass).map(c => ({case:r.name,...c})));
const report = {classification:'ordinary JS source-prediction controls, no native comparison',
    recipeSHA256:sha(recipeBytes), runtimeSHA256:runtime.sha256,
    cases:rows.length, checks:rows.reduce((n,r) => n+r.checks.length,0), failures, rows};
if (target) writeFileSync(target, JSON.stringify(report,null,2)+'\n', {flag:'wx'});
console.log(JSON.stringify({cases:rows.length,checks:44,failures,runtimeSHA256:runtime.sha256,
    runtimeFiles:runtime.files,nativeProof:'inherited4/4; no fresh native comparison'}));
if (failures.length) process.exitCode = 1;
assert.deepEqual(rows,expected.rows,'fresh complete rows equal fixed candidate proof');
for (const {index,hashes} of negative) {
    assert.deepEqual(rows[index],baseline.rows[index],'complete ordinary negative row');
    assert.deepEqual(rows[index].hashes,hashes,'all15 original negative hashes');
}
