// Required tracked source/C/input evidence precedes every gameplay import.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length <= 3 && (process.argv[2] === undefined
    || (process.argv[2] && !process.argv[2].startsWith('-'))),
    'usage: role-init-gender-gate.mjs [new-compact-report.json]; no selectors');
const target = process.argv[2] || null;
assert.ok(!target || !existsSync(target), 'report path must be new');
const repo = new URL('../', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function pinned(path, digest) {
    const bytes = readFileSync(new URL(path, repo));
    assert.equal(sha(bytes), digest, 'exact tracked evidence: ' + path);
    return bytes;
}
const evidence = 'tools/gen-sessions/evidence/role-init-gender/';
const evidencePins = {
    "README.md": "cb6b5b14c7c600648e94d5c470e9eea7cb779328057d909ebfd391f9d2d62e12",
    "assertion-body.json": "d0f6c277ca88cca6225f0e345da7bf1ac785955a120d3f1ebae2718df76c1474",
    "baseline-native.json": "813d73b719860ed135ec271afaa6b8a109b3b72f55661a773938a018d63131e2",
    "baseline-ordinary.json": "e5f944c14bff9e576e61ed6b7d8bcf449549dca4ae807f5ba149e033a4db1d4e",
    "candidate-native.json": "e90de24948db4eda10f0cf8ca5642467bfd729dcc36a9c605409b55ecbe10476",
    "candidate-ordinary.json": "7d1beba71cddf44d450da9e8b0e57fed18735b2740bc5b63e003ba92ed864a34",
    "candidate-probe-adaptation.json": "5b4c2a190ebfc442db5d7c64fd0c6b55e978d237d87ec6d6b64a2954a498f24f",
    "candidate-review.md": "093686b7e40c8dc02687dbdfe0df8b2d18194830f77c455967018380e08ef045",
    "candidate-validation.json": "56c6fdb4310dc72836db7665c9f99963f7e2edac1f633660b83a2adeeda50ef0",
    "history/prefix-pin-setup-initial.json": "1527c9897e149dba626b8a62158d1d165a37823b3e3873a9af616e480a6918d0",
    "history/prefix-pin-setup-resolution.json": "88d8badfbf91bbbc04593048bfc0c7a7f3f0685c04609938ba2a7e6692b6e1fa",
    "history/source-range-setup-initial.json": "4dedb16f3d3ec36f0a7ec96e7d5758a70e7f39ac9c53368f33737b69ffc16603",
    "history/source-read-diagnostic.json": "a995fae7723e336a633d4d4fb851c28ebaa579488c1c90a050900741df216787",
    "input-lock.json": "18c483074461011935d4d8c7318c05848bd790c19881d52dad5aee6016ea44bd",
    "native-recording.json": "389cbcc6990010b386cf315d5d2cc46cc4c61d9e7a8fbe3ef3daf4f88a75be9e",
    "negative-hashes.json": "3f0a0bbdd93a7e2ac301844ce1bca9fb7ebf47254447185a9e3011e768d62c28",
    "original-probe.mjs": "3e297e508cb500776837b87e2ae2238d92cb682f5dcf958b29e31d6dc69d0802",
    "parent-input-lock.json": "eaaa457ffd0e1cdb11dd5d23ad7431392109e2ce08d0a3ffa351f14c72bd62af",
    "predictions.json": "c3ac673d02b7433d952dffd0705fa429ac748404bdfd178fa6c488b71ad9b6da",
    "producer-origin.json": "1098668a59e0442846e1a20f2a63803dd48836ea939166d8d32314f697c7fed2",
    "read-scope.json": "d178d3e53e6e52f4633c6f27d1cb4efb26434e871657165488de9d3fb33ff74e",
    "retained-welcome.json": "e4a4b3c728ffcb68a17730d8d233db78e70e2e96bce2a28254decaa1f964ca1d",
    "scope-and-preservation.json": "4ec7a3e057908f5621d2e4e06632b7c41715dc27bd1e92189939bed92f1631c5",
    "source-pins.json": "0d56e8b0d6244f22e6d4aa5d5a101c19688fdd5ec642063053d5f146a1e765cd",
    "source-provenance.json": "52ab9e680e4c06241461cce2168f0b0afe0ea1833dc139d4eed483f8dde6a87d",
    "source-review.md": "717c6a738d695688cddf45ff0adb0c7f3340e4ec6bd60ff3f916377b7d929408"
};
for (const [name, digest] of Object.entries(evidencePins)) pinned(evidence + name, digest);
const readEvidence = name => JSON.parse(pinned(evidence + name, evidencePins[name]));
const provenance = readEvidence('source-provenance.json');
assert.equal(provenance.sourceSealSHA256, '115b29dbde45316b6dac8cf9953d58b905490bd83ae2e1bb2c067352721117b8');
assert.equal(provenance.candidateSealSHA256, '8b0f381e29dde483752924fe17d295c4ca79f9d147427187d500c7923fab1861');
assert.equal(provenance.baselineSnapshotRequired, false);
assert.equal(provenance.historicalHashesOnly, true);
const recipeBytes = pinned('tools/gen-sessions/recipes/role-init-gender.json',
    '2d8324be36150ed57577386897cfd4d05560b6d10d85e7ec63626012c2f0697d');
const recipe = JSON.parse(recipeBytes);
const lock = readEvidence('input-lock.json');
assert.equal(lock.beforeGameplayAndCandidate, true);
assert.equal(lock.CRecorded, false, 'historical input lock predates original C recording');
assert.equal(provenance.sourceInputLockSHA256, evidencePins['input-lock.json']);
assert.equal(provenance.recipeSHA256, sha(recipeBytes));
assert.deepEqual(Object.keys(lock.files).sort(),
    [...Object.keys(provenance.publicPathsForOriginalLock),
     ...Object.keys(provenance.historicalLockOnlyFiles)].sort());
for (const [name, path] of Object.entries(provenance.publicPathsForOriginalLock))
    pinned(path, lock.files[name]);
assert.deepEqual(provenance.historicalLockOnlyFiles,
    { 'baseline-runtime.json': provenance.sourceBaselineRuntimeSHA256 });
assert.equal(lock.files['baseline-runtime.json'], provenance.sourceBaselineRuntimeSHA256);
const originalProbe = pinned(evidence + 'original-probe.mjs', lock.probeSHA256).toString();
assert.equal(provenance.sourceProbeSHA256, lock.probeSHA256);
const predictions = readEvidence('predictions.json');
const negative = readEvidence('negative-hashes.json');
assert.deepEqual(lock.negativeIndexes, [1, 2, 3]);
assert.equal(lock.negativeHashesPreexisting, false, 'negative indexes were locked before their first measurement');
assert.deepEqual(negative.map(row => row.index), lock.negativeIndexes);
assert.equal(negative.reduce((n, row) => n + Object.keys(row.hashes).length, 0), 15);

const fields = ['name', 'seed', 'datetime', 'nethackrc', 'moves'];
assert.deepEqual(lock.fields, fields);
const fieldTuple = part => fields.map(field => ({ field, present: Object.hasOwn(part, field),
    ...(Object.hasOwn(part, field) ? { value: part[field] } : {}) }));
const tuples = recipe.segments.map(fieldTuple);
const keys = recipe.segments.map(part => [null, ...part.moves]);
assert.deepEqual(tuples, lock.tuples);
assert.ok(tuples.every(row => row.every(field => field.present)));
assert.equal(sha(JSON.stringify(tuples)), lock.tuplesSHA256);
assert.equal(lock.tuplesSHA256, '36c15c9ba50c559143c8ff348060aa52f42d8031deca3486a70a4fbe9fb6e194');
assert.equal(sha(JSON.stringify(keys)), lock.allKeysSHA256);
assert.equal(lock.allKeysSHA256, 'c52617bd2836af8e3199c9308218176c7b1de2e93b4f2ef580353225782b181d');
assert.equal(recipe.segments.length, 4);
assert.equal(recipe.segments.reduce((n, part) => n + part.moves.length, 0), 216);
assert.equal(keys.flat().length, 220);
const parentLock = readEvidence('parent-input-lock.json');
assert.equal(parentLock.sourceSealSHA256, provenance.sourceSealSHA256);
for (const field of ['sourceRecipeSHA256', 'primaryRecipeSHA256', 'minimalSHA256'])
    assert.equal(parentLock[field], sha(recipeBytes));
assert.equal(parentLock.beforeC, true);
assert.equal(parentLock.preserveAllRootMetadata, true);

const rawBytes = pinned('tools/gen-sessions/generated/role-init-gender.session.json',
    'daa5157ad653a5c49e7d431e40f6b4e91862598a8920eeeb488232aab65f86c5');
assert.equal(rawBytes.length, 572701);
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
assert.deepEqual(recipe.branchAssertions.map(row => row.segment), [0, 1, 2, 3]);
assert.deepEqual(recipe.branchAssertions.map(row => row.branch), recipe.branches);
assert.deepEqual(branchAssertionErrors(recipe), []);
assert.deepEqual(branchAssertionErrors(recipe, raw), []);
const recording = readEvidence('native-recording.json');
assert.equal(recording.rawSha256, sha(rawBytes));
assert.equal(recording.primaryRecipeSHA256, sha(recipeBytes));
assert.equal(recording.bytes, rawBytes.length);
for (const field of ['cExecutedOnce', 'fiveInputFieldsAndPresencePreserved', 'allKeysExact', 'rootMetadataPreserved'])
    assert.equal(recording[field], true);

// Archived observations are expectations, never this invocation's live state.
const baseline = readEvidence('baseline-ordinary.json');
const expected = readEvidence('candidate-ordinary.json');
const baselineNative = readEvidence('baseline-native.json');
const candidateNative = readEvidence('candidate-native.json');
const validation = readEvidence('candidate-validation.json');
assert.equal(expected.recipeSHA256, sha(recipeBytes));
assert.equal(expected.runtimeSHA256, provenance.candidateRuntimeSHA256);
assert.equal(baseline.runtimeSHA256, provenance.sourceBaselineRuntimeSHA256);
assert.equal(baseline.checks, 44);
assert.deepEqual(baseline.failures.map(row => [row.case, row.name]), [
    ['valkyrie-invalid-male', 'C newgame gender flags are valid from the first gameplay row'],
    ['valkyrie-invalid-male', 'C intermediate gendered rank is actually rendered'],
    ['valkyrie-invalid-male', 'C final rank is actually rendered'],
]);
assert.equal(expected.checks, 44);
assert.deepEqual(expected.failures, []);
assert.ok(expected.rows.every(row => row.checks.length === 11 && row.checks.every(check => check.pass)));
assert.equal(validation.ordinary, '44/44');
assert.equal(validation.native, '4/4');
assert.equal(validation.negativeHashes, 15);
assert.equal(validation.completeNegativeOrdinaryRows, 3);
assert.equal(validation.completeNegativeNativeRows, 3);
const exactNative = row => row.fullStyleExact && row.frozenScreenCursorExact
    && row.fullRngExact && row.animationExact;
assert.equal(baselineNative.length, 4);
assert.equal(candidateNative.length, 4);
assert.equal(baselineNative.filter(exactNative).length, 3);
assert.ok(candidateNative.every(exactNative));
assert.ok(candidateNative.every(row => row.calls.discardedEntries === 0));
for (const { index, hashes } of negative) {
    assert.deepEqual(candidateNative[index], baselineNative[index]);
    assert.deepEqual(expected.rows[index], baseline.rows[index]);
    assert.deepEqual(expected.rows[index].hashes, hashes);
}
const welcome = readEvidence('retained-welcome.json');
for (const rows of Object.values(welcome.modes)) {
    assert.equal(rows.length, 16);
    assert.ok(rows.every(row => row.passed && !row.sourcePredictionFailures.length));
}
assert.equal(welcome.logCategory.passed, true);
assert.equal(provenance.retainedWelcomeArchivedOnly, true);
const scope = readEvidence('scope-and-preservation.json');
assert.equal(scope.restoredInvalidGenderValkyrieOrdinaryCovered, false);
assert.equal(scope.restoreSentinelSourceVerified, true);
for (const name of ['history/prefix-pin-setup-initial.json', 'history/source-range-setup-initial.json'])
    assert.equal(readEvidence(name).passCheck, false);
assert.equal(readEvidence('history/prefix-pin-setup-resolution.json').inputBytesChanged, false);
assert.ok(readEvidence('history/source-read-diagnostic.json').error.includes('does not exist'));

const adaptation = readEvidence('candidate-probe-adaptation.json');
let candidateProbe = originalProbe;
for (const { before, after } of adaptation.changes) {
    assert.equal(candidateProbe.split(before).length, 2, 'one historical wrapper replacement');
    candidateProbe = candidateProbe.replace(before, after);
}
assert.equal(sha(candidateProbe), provenance.candidateProbeSHA256);
const startMarker = 'const ' + 'rows =';
const endMarker = '\n// ' + 'END ORIGINAL ASSERTION BODY';
const originalBody = originalProbe.slice(originalProbe.indexOf(startMarker),
    originalProbe.indexOf('\nverifyRuntime();\nconst failures'));
const installedGate = readFileSync(new URL(import.meta.url), 'utf8');
const installedBody = installedGate.slice(installedGate.indexOf(startMarker), installedGate.indexOf(endMarker));
assert.equal(installedBody, originalBody, 'original fresh observer and all44 checks are authoritative');
assert.equal(sha(installedBody), lock.assertionBodySHA256);
assert.equal(sha(installedBody), adaptation.assertionBodySHA256);
assert.equal(Buffer.byteLength(installedBody), 6248);
assert.equal(adaptation.assertionGroups, 44);

pinned('tools/gen-sessions/assertions.mjs', 'aed2dfe01e18cb2e8b0d62e389ab9d8a9c02b0e3e98d4e427fcead4c228e3adc');
pinned('tools/gen-sessions/screen-decode.mjs', '0831fd4db121dab1d3c8f80efac29c68ce50f67fedbb49f2bd7c21371244dae0');
pinned('tools/half-damage-reader-observe.mjs', '201cdafe4409d5d58414c1d0ebc0449c32b29834cdf35c72c151a555d9031d07');
pinned('frozen/screen-decode.mjs', 'cb4a0fbfed3dda28c14736e6ae9c8b9eb8c87d75916c50d6df80f40eb0368cbe');

// Discover the installed graph; no historical runtime hash is an acceptance pin.
function currentRuntime() {
    const paths = [];
    function visit(directory) {
        for (const name of readdirSync(new URL(directory, repo))) {
            const path = directory + name;
            if (statSync(new URL(path, repo)).isDirectory()) visit(path + '/');
            else if (path.endsWith('.js')) paths.push(path);
        }
    }
    visit('js/');
    const map = Object.fromEntries(paths.sort().map(path =>
        [path, sha(readFileSync(new URL(path, repo)))]));
    return { files: paths.length, sha256: sha(JSON.stringify(map, null, 2) + '\n') };
}
const runtime = currentRuntime();
function verifyRuntime() {
    assert.deepEqual(currentRuntime(), runtime, 'installed graph unchanged during this invocation');
}

const {runSegment} = await import(new URL('js/jsmain.js', repo));
const {InMemoryStorage} = await import(new URL('js/storage.js', repo));
const {decodeScreen,renderCell} = await import(new URL('frozen/screen-decode.mjs', repo));
const {outputs,hashes,hash,deferred} = await import(new URL('tools/half-damage-reader-observe.mjs', repo));

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
            if (!g.u || !g.level || !g.urole) return;
            states.push({step,turn:g.moves,level:g.u.ulevel,hp:g.u.uhp,mortality:g.u.umortality || 0,
                xy:[g.u.ux,g.u.uy],dungeon:{...g.u.uz},wizard:!!g.wizard,
                initrole:g.flags.initrole,initrace:g.flags.initrace,initalign:g.flags.initalign,
                initgend:g.flags.initgend,initgendType:typeof g.flags.initgend,
                female:g.flags.female,femaleType:typeof g.flags.female,
                rcGender:g.rc.opts.gender,roleName:g.urole.name.m,raceName:g.urace.noun,
                genderMask:g.urole.allow & 0xf000,pantheon:g.pantheon,
                gods:[g.urole.lgod,g.urole.ngod,g.urole.cgod],
                inventoryCount:g.invent.length,gameover:!!g.program_state?.gameover,
                parserErrors:[...g.rc.errors],unhandled:[...g.rc.unhandled]});
        }};
        run = await runSegment({...part,storage:new InMemoryStorage()});
    } catch(error) {runError=error.stack;}
    finally {
        if (previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    const out = run ? outputs(run) : null;
    const screens = out?.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd())) || [];
    const text = screens.map(lines => lines.join('\n'));
    const first = states[0], last = states.at(-1);
    check('real startup identity and initial rank',() => {
        assert.ok(first);
        assert.equal(first.initrole,p.roleIndex);assert.equal(first.initrace,p.raceIndex);
        assert.equal(first.initalign,p.alignmentIndex);assert.equal(first.roleName,p.role);
        assert.equal(first.raceName,'human');assert.equal(first.rcGender,p.inputGender);
        assert.equal(first.genderMask,p.genderMask);
        assert.ok(text.some(t => t.includes(p.firstRank)));
        assert.ok(states.every(s => !s.parserErrors.length && !s.unhandled.length));
    });
    check('C newgame gender flags are valid from the first gameplay row',() => {
        assert.equal(first.initgend,p.expectedInitgend);
        assert.equal(first.female,p.expectedFemale);
        assert.equal(first.initgendType,'number');assert.equal(first.femaleType,'boolean');
        assert.ok(first.genderMask & (first.initgend === 1 ? 0x2000 : 0x1000));
    });
    check('newgame owns its pantheon and starts at level one',() => {
        assert.equal(first.level,1);assert.equal(first.pantheon,p.roleIndex);
        assert.ok(first.gods.every(Boolean));assert.ok(first.wizard);
        assert.ok(states.every(s => s.pantheon === first.pantheon
            && JSON.stringify(s.gods) === JSON.stringify(first.gods)));
    });
    check('real levelchange input reaches experience level thirty',() => {
        assert.equal(last.level,30);
        assert.ok(text.some(t => t.includes('To what experience level do you want to be set?')));
        assert.ok(text.some(t => t.includes('Welcome to experience level 30.')));
        assert.ok(states.some(s => s.level === 10));
    });
    check('C intermediate gendered rank is actually rendered',() => {
        assert.ok(screens.some(lines => lines[22]?.includes(p.genderedRank)),p.genderedRank);
    });
    check('C final rank is actually rendered',() => {
        assert.ok(screens.some(lines => lines[22]?.includes(p.finalRank)),p.finalRank);
    });
    check('initial gender fields stay stable through the real producer',() => {
        assert.ok(states.every(s => s.initgend === first.initgend && s.female === first.female));
        assert.ok(states.every(s => s.initrole === first.initrole && s.initrace === first.initrace));
    });
    check('no movement death or weapon producer is involved',() => {
        assert.ok(states.every(s => s.hp > 0 && !s.mortality && !s.gameover));
        assert.ok(states.every(s => JSON.stringify(s.xy) === JSON.stringify(first.xy)));
        assert.ok(states.every(s => s.inventoryCount === 0));
    });
    check('every input boundary and RNG slice is retained',() => {
        assert.equal(runError,undefined);
        assert.equal(last.step,part.moves.length);
        for (const name of ['screens','cursors','slices','frames'])
            assert.equal(out[name].length,part.moves.length+1,name);
        assert.deepEqual(out.slices.flat(),out.calls);
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    });
    let plainHashes,plainError;
    try {plainHashes=hashes(outputs(await runSegment({...part,storage:new InMemoryStorage()})));}
    catch(error) {plainError=error.stack;}
    check('passive observer preserves all five output streams',() => {
        assert.equal(plainError,undefined);assert.deepEqual(plainHashes,hashes(out));
    });
    let deferredHashes,deferredError;
    try {deferredHashes=hashes(await deferred(part));}
    catch(error) {deferredError=error.stack;}
    check('deferred EOF preserves all five output streams',() => {
        assert.equal(deferredError,undefined);assert.deepEqual(deferredHashes,hashes(out));
    });
    const ranks = [];
    for (const [step,lines] of screens.entries()) {
        const status = lines[22] || '';
        const match = status.match(/\bthe (.*?)\s+St:/);
        if (match && ranks.at(-1)?.rank !== match[1]) ranks.push({step,rank:match[1]});
    }
    rows.push({name:part.name,negative:p.negative,checks,first,last,ranks,
        stateTraceSHA256:hash(states),hashes:out ? hashes(out) : null,plainHashes,deferredHashes,
        keys:part.moves.length,boundaries:out?.screens.length,calls:out?.calls.length,
        frames:out?.frames.flat().length,
        ...(runError || plainError || deferredError ? {runError,plainError,deferredError} : {})});
}
// END ORIGINAL ASSERTION BODY
verifyRuntime();
const failures = rows.flatMap(row => row.checks.filter(c => !c.pass).map(c => ({case:row.name,...c})));
const comparisonFailures = [];
function compare(name, body) {
    try { body(); } catch (error) { comparisonFailures.push({ name, error: error.message }); }
}
compare('all four complete fresh rows equal accepted candidate evidence', () => assert.deepEqual(rows, expected.rows));
for (const { index, hashes: expectedHashes } of negative) {
    compare(recipe.segments[index].name + ' complete original negative row', () => {
        assert.deepEqual(rows[index], baseline.rows[index]);
        assert.deepEqual(rows[index].hashes, expectedHashes);
    });
}
const report = {
    classification: 'Fresh installed-runtime ordinary evidence; native and retained welcome proofs are archived.',
    recipeSHA256: sha(recipeBytes), inputLockSHA256: evidencePins['input-lock.json'],
    tuplesSHA256: lock.tuplesSHA256, rawSHA256: sha(rawBytes), runtimeSHA256: runtime.sha256,
    cases: rows.length, checks: rows.reduce((n, row) => n + row.checks.length, 0),
    failures, comparisonFailures, rows, negativeHashes: 15,
    freshNativeComparison: false, retainedWelcomeReplayed: false,
};
if (target) writeFileSync(target, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ cases: rows.length, checks: report.checks,
    passed: report.checks - failures.length, comparisonFailures: comparisonFailures.length,
    completeCandidateRows: comparisonFailures.length ? null : 4,
    negativeHashes: 15, primaryCBranches: 4, freshNativeComparison: false }));
if (failures.length || comparisonFailures.length) process.exitCode = 1;
