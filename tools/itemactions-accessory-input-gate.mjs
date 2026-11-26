// Verify tracked C/input/source evidence before importing the installed game.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length <= 3
    && (process.argv[2] === undefined || (process.argv[2] && !process.argv[2].startsWith('-'))),
    'usage: itemactions-accessory-input-gate.mjs [new-compact-report.json]; no selectors');
const reportPath = process.argv[2] || null;
assert.ok(!reportPath || !fs.existsSync(reportPath), 'report path must be new');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function pinned(path, digest) {
    const bytes = fs.readFileSync(new URL(path, import.meta.url));
    assert.equal(sha(bytes), digest, 'exact tracked evidence: ' + path);
    return bytes;
}
const evidence = 'gen-sessions/evidence/itemactions-accessory/';
const pins = {
    "CANDIDATE-PLAN.md": "ef39a34962a20184f8de73a783d6aff46a941bc594bbb1e7112ac6423e60d70d",
    "README.md": "3eb157f608258ecdca81e49e4f542ae93dfbe15ed46934a0afaf48120e1f780b",
    "SOURCE-REVIEW.md": "63e0f449fdb5ccb71fdfd06a9e521528273c3f0d61acbf4176f22337ced7ed58",
    "VALIDATION.md": "6ad6ee50829c1e862147ce3a136ce89cfc453f66e53900a4c329919a8cc93666",
    "assertion-preservation.json": "fcc41855a3ae8ba0d271c8f6ff37b709079b24e7e1dd8070ca67522e338566ba",
    "baseline-native-command.json": "d593aea52ad78e2587e1d681e78d40cd715d1942ab0b91e380b02aeaaa083250",
    "baseline-native.json": "70bbba0614ee71cf619715291c5f99fb60d2dd7aa2e4bfd5ac842cdde77503f4",
    "baseline-native.log": "8465b1267b6914b19d58e68541cd1086db38917df72bf7e1939749af804887fc",
    "candidate-native.json": "7ba67eed022596835043cb92fc87e5d947a0fd4cd512af2ee88ab54827d8d764",
    "candidate-ordinary.json": "ede953746ae7070c9d083b1690b45718d65817a4e01f582bb8581f8c62f2709b",
    "candidate-validation.json": "4d2fa255eff8ae5fe51f13905698938340e0654737d56681c46b1d4cc44f5553",
    "coverage-bounds.json": "4799c4a404e750907005176b7fece7520abdd8411afd3b2f41b0c1574663c973",
    "native-primary.json": "6c552d488372a00e0919614dedee6d1061a9126076e37650553a10d2eeb51bcf",
    "native-recording.json": "1c3ee738c47739759ee622afb73b76c5f6151e20bdc9e2bbd63fc6c30eab4a58",
    "pre-implementation-lock.json": "35447680e73569c002579f4ed112a86e36f03ac37f19ad14c4f340e9e5073392",
    "scope-check.json": "229cf847bb55a6661c9421b5f2d680c42e3a74778de45569c05aba12041aa7d0",
    "source/baseline-ordinary-command.json": "f08b7bbee87326d983599c68c895069e2933c3a7f1671e7ed420b23b963e15be",
    "source/baseline-ordinary.json": "fd375690a28f28dede11d6cc9c2121cbf71a62e74730572972a8c17b473f9161",
    "source/baseline-ordinary.log": "081126bb8553dedfd612c17e55098aa71ef65265be946ce8e7cae195bf5f343c",
    "source/input-lock.json": "701ebc821ae3aa1d3b7ee28288d2fe30bf9b6821315de1760cfb224d027d1701",
    "source/ordinary.mjs": "eae296b0e365802529c6d15457169e397c1bbd879f1c5eea6cb0eac06cf6a9f2",
    "source/probe-01.json": "80b9da555e498aa196d11e0ac2ef9a9c2aa41bce7bc8bb151816179ca0a8f2f3",
    "source/probe-01.log": "37b207fa5f01a496d2fb457786094d550ce18008317559c8484eecf50a637e8b",
    "source/probe.mjs": "35f9d8a819a3b5450698a788b91af9917ddfef77af567f6ba81c0bfa5c3ef39b",
    "source/proposal-01.json": "a63e3d3b005df3f718a766517f995d1d1bb178f38c52c8b84a700de8f453582e",
    "source-coverage.json": "467ccaa6594bfa10e830c5c07f767c61044e4afbc8868563c86724e653a80ee0",
    "source-provenance.json": "1cccf382533df7aa5549224ad8648479229d6054bdd9018691daf42ca2509f89"
};
for (const [name, digest] of Object.entries(pins)) pinned(evidence + name, digest);
const readEvidence = name => JSON.parse(pinned(evidence + name, pins[name]));

// These maintained helpers do not import the game during metadata preflight.
pinned('half-damage-reader-observe.mjs',
    '201cdafe4409d5d58414c1d0ebc0449c32b29834cdf35c72c151a555d9031d07');
pinned('gen-sessions/assertions.mjs',
    'aed2dfe01e18cb2e8b0d62e389ab9d8a9c02b0e3e98d4e427fcead4c228e3adc');
pinned('gen-sessions/screen-decode.mjs',
    '0831fd4db121dab1d3c8f80efac29c68ce50f67fedbb49f2bd7c21371244dae0');
pinned('../frozen/screen-decode.mjs', "cb4a0fbfed3dda28c14736e6ae9c8b9eb8c87d75916c50d6df80f40eb0368cbe");

const primaryBytes = pinned('gen-sessions/recipes/itemactions-accessory.json',
    'f935cf193457465170409417b52ba2a86ea742b82b75f3c0fd7757c02da49df3');
const primary = JSON.parse(primaryBytes);
const recipe = readEvidence('source/proposal-01.json');
const initial = readEvidence('source/probe-01.json');
const lock = readEvidence('source/input-lock.json');
const pre = readEvidence('pre-implementation-lock.json');
assert.equal(pre.candidateExisted, false);
assert.equal(pre.workerCRecorded, false);
assert.equal(lock.candidateExisted, false);
assert.equal(lock.cExecuted, false);
assert.equal(Object.keys(pre.sourceFiles).length, 10);
for (const [name, row] of Object.entries(pre.sourceFiles)) {
    const data = name === 'primary-recipe.json'
        ? primaryBytes : pinned(evidence + 'source/' + name, row.sha256);
    assert.equal(sha(data), row.sha256);
    assert.equal(data.length, row.bytes);
}
assert.equal(pre.sourceReviewSHA256, pins['SOURCE-REVIEW.md']);
assert.equal(pre.planSHA256, pins['CANDIDATE-PLAN.md']);
assert.equal(pre.sourceCoverageSHA256, pins['source-coverage.json']);
assert.equal(pre.parentBaselineNativeSHA256, pins['baseline-native.json']);
assert.equal(pre.inputLockSHA256, pins['source/input-lock.json']);
assert.equal(pre.proposalSHA256, pins['source/proposal-01.json']);
assert.equal(pre.primaryRecipeSHA256, sha(primaryBytes));
assert.equal(pre.ordinaryBodyFileSHA256, pins['source/ordinary.mjs']);
assert.equal(lock.recipeSHA256, pins['source/proposal-01.json']);
assert.equal(lock.ordinarySHA256, pins['source/ordinary.mjs']);
assert.equal(lock.probeSHA256, pins['source/probe-01.json']);
assert.deepEqual(primary.segments, recipe.segments);
assert.deepEqual(primary.expectations, recipe.expectations);
assert.deepEqual(recipe.segments, lock.tuples);
assert.deepEqual(lock.inputFields, ['name', 'seed', 'datetime', 'nethackrc', 'moves']);
const fields = part => Object.fromEntries(lock.inputFields.map(field => [field, {
    present: Object.hasOwn(part, field), value: part[field],
}]));
const tuples = recipe.segments.map(fields);
assert.deepEqual(tuples, pre.presenceTuples);
assert.ok(tuples.every(tuple => Object.values(tuple).every(field => field.present)));
assert.equal(sha(JSON.stringify(tuples)), pre.tupleSHA256);
assert.equal(pre.tupleSHA256,
    'a914e4498e84fb763d7085ad6af381697664204074e69bbd4932582017401dd3');
assert.deepEqual([pre.cases, pre.keys, pre.boundaries], [4, 197, 201]);
assert.deepEqual(lock.negativeHashes, pre.negativeHashes);
assert.deepEqual(Object.keys(lock.negativeHashes), recipe.segments.slice(1).map(part => part.name));
for (const row of initial.slice(1)) {
    assert.deepEqual(Object.keys(row.hashes), ['screens', 'cursors', 'calls', 'slices', 'frames']);
    assert.deepEqual(row.hashes, lock.negativeHashes[row.name]);
}

// Saved reports are inherited expected proof. The assertion loop below observes
// this invocation's installed runtime, including the direct-P C quirk.
const baselineOrdinary = readEvidence('source/baseline-ordinary.json');
const expectedOrdinary = readEvidence('candidate-ordinary.json');
assert.equal(baselineOrdinary.length, 4);
assert.equal(expectedOrdinary.length, 4);
assert.equal(baselineOrdinary.filter(row => row.passed).length, 3);
assert.ok(expectedOrdinary.every(row => row.passed));
assert.deepEqual(baselineOrdinary.slice(1), expectedOrdinary.slice(1));
assert.deepEqual(baselineOrdinary[0].failures,
    ['Expected values to be strictly equal:\n\ntrue !== false\n', "Don't even bother."]);
assert.equal(baselineOrdinary[0].final.amulet, 208);
assert.equal(baselineOrdinary[0].final.turn, 8);
assert.equal(expectedOrdinary[0].final.amulet, null);
assert.equal(expectedOrdinary[0].final.turn, 1);
for (const row of expectedOrdinary.slice(1)) {
    assert.deepEqual(row.hashes, lock.negativeHashes[row.name]);
}
assert.deepEqual(recipe.expectations.map(row => row.amuletWorn), [false, true, true, false]);
const baselineNative = readEvidence('baseline-native.json');
const candidateNative = readEvidence('candidate-native.json');
const exact = row => row.fullStyleExact && row.frozenScreenCursorExact
    && row.fullRngExact && row.animationExact;
assert.equal(baselineNative.length, 4);
assert.equal(candidateNative.length, 4);
assert.equal(baselineNative.filter(exact).length, 3);
assert.ok(candidateNative.every(exact));
assert.deepEqual(baselineNative.slice(1), candidateNative.slice(1));
assert.deepEqual(baselineNative[0].screenDifferences.map(row => row.step), [55]);
assert.equal(baselineNative[0].glyphMismatches, 65);
assert.equal(baselineNative[0].calls.actual - baselineNative[0].calls.expected, 149);
assert.equal(baselineNative[0].frames.actual, 2);
assert.equal(baselineNative[0].frames.expected, 0);
const validation = readEvidence('candidate-validation.json');
assert.equal(validation.candidateOrdinarySHA256, pins['candidate-ordinary.json']);
assert.equal(validation.candidateNativeSHA256, pins['candidate-native.json']);
assert.equal(validation.ordinary.negativeHashesUnchanged, 15);
assert.equal(validation.native.negativeCompleteRowsUnchanged, 3);

// Historical C/build/cache paths in these records are provenance only.
const provenance = readEvidence('source-provenance.json');
assert.equal(provenance.candidateSealSHA256,
    'e9dc07a82966f16ffa4930c01956da67a8991eefc46eac6a42e054f7c3e29ea0');
assert.equal(provenance.candidateMembers, 338);
assert.equal(provenance.sourceReviewSHA256, pins['SOURCE-REVIEW.md']);
assert.equal(provenance.inputLockSHA256, pins['source/input-lock.json']);
assert.equal(provenance.originalControlSHA256, pins['source/ordinary.mjs']);
assert.equal(provenance.sourceCoverageSHA256, pins['source-coverage.json']);
assert.equal(readEvidence('source-coverage.json').ranges.length, 51);
assert.equal(provenance.freshGameplayReplayInPromotion, false);
assert.equal(provenance.freshNativeReplayInPromotion, false);
assert.equal(readEvidence('coverage-bounds.json').endOfFileClipping[0].effectiveEnd, 716);
assert.deepEqual(readEvidence('scope-check.json').changedRuntimeFiles, ['js/cmd.js']);

const rawBytes = pinned('gen-sessions/generated/itemactions-accessory.session.json',
    '94db2c2d62e2e7390bebdc905ec7a645d299e045d6cec54f3569a76273e6826f');
assert.equal(rawBytes.length, 476442);
const raw = JSON.parse(rawBytes);
assert.equal(raw.source, 'c');
assert.equal(raw.version, 5);
assert.equal(raw.segments.length, 4);
assert.deepEqual(raw.segments.map(fields), tuples);
for (const [i, part] of raw.segments.entries()) {
    assert.deepEqual(part.steps.map(step => step.key), [null, ...recipe.segments[i].moves]);
}
const steps = raw.segments.flatMap(part => part.steps);
assert.equal(raw.segments.reduce((count, part) => count + part.moves.length, 0), 197);
assert.equal(steps.length, 201);
assert.equal(steps.reduce((count, step) => count + (step.rng || []).length, 0), 8980);
assert.equal(steps.reduce((count, step) => count + (step.animation_frames || []).length, 0), 2);
assert.equal(primary.requireBranchAssertions, true);
assert.equal(primary.branches.length, 4);
assert.deepEqual(primary.branchAssertions.map(row => [row.branch, row.segment]),
    primary.branches.map((branch, i) => [branch, i]));
assert.deepEqual(branchAssertionErrors(primary), []);
assert.deepEqual(recordingIntegrityErrors(raw), []);
assert.deepEqual(branchAssertionErrors(primary, raw), []);
assert.deepEqual(readEvidence('native-primary.json'), {
    cases: 4, branches: 4, source: 'c', version: 5, branchErrors: [], integrityErrors: [],
});
const receipt = readEvidence('native-recording.json');
assert.equal(receipt.cExecutedOnce, true);
assert.equal(receipt.exit, 0);
assert.equal(receipt.primaryRecipeSHA256, sha(primaryBytes));
assert.equal(receipt.rawSha256, sha(rawBytes));
assert.equal(receipt.fiveInputFieldsAndPresencePreserved, true);
assert.equal(receipt.allKeysExact, true);

const root = new URL('../', import.meta.url);
const {runSegment} = await import(new URL('js/jsmain.js', root));
const {InMemoryStorage} = await import(new URL('js/storage.js', root));
const {PMNAMES} = await import(new URL('js/monst_data.js', root));
const {decodeScreen, renderCell} = await import(new URL('frozen/screen-decode.mjs', root));
const {outputs, hashes, deferred} = await import(new URL('tools/half-damage-reader-observe.mjs', root));

// BEGIN ORIGINAL ASSERTION AND OBSERVER BODY
const results = [];
for (const part of recipe.segments) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            if (!g.u || !g.level) return;
            states.push({step, turn: g.moves, form: g.u.umonnum,
                amulet: g.u.uamul?.otyp ?? null,
                inventory: g.invent.map(o => ({otyp: o.otyp, invlet: o.invlet,
                    worn: o.owornmask || 0}))});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const output = outputs(run), streamHashes = hashes(output);
    assert.equal(output.screens.length, part.moves.length + 1);
    assert.deepEqual(output.slices.flat(), output.calls);
    assert.deepEqual(hashes(outputs(await runSegment({...part, storage: new InMemoryStorage()}))), streamHashes);
    assert.deepEqual(hashes(await deferred(part)), streamHashes);
    const text = output.screens.map(s => decodeScreen(s)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    const expected = recipe.expectations.find(e => e.name === part.name);
    const final = states.at(-1), failures = [];
    const check = fn => { try { fn(); } catch (error) { failures.push(error.message); } };
    check(() => assert.equal(final.amulet !== null, expected.amuletWorn));
    if (expected.message)
        check(() => assert.ok(text.at(-1).includes(expected.message), expected.message));
    else
        check(() => assert.ok(text.at(-1).includes('(being worn).')));
    if (part.name.startsWith('nohands-')) {
        check(() => assert.equal(final.form, PMNAMES.PM_FOG_CLOUD));
        check(() => assert.ok(text.some(s => s.includes('You turn into a fog cloud!'))));
    }
    if (part.name.includes('inventory-'))
        check(() => assert.ok(text.some(s => s.includes('Put this amulet on'))));
    if (part.name.endsWith('-negative')) {
        const before = initial.find(r => r.name === part.name);
        check(() => assert.deepEqual(streamHashes, before.hashes));
        check(() => assert.deepEqual(final, before.states.at(-1)));
    }
    const result = {name: part.name, passed: failures.length === 0,
        failures, hashes: streamHashes, final};
    results.push(result);
    console.log(JSON.stringify({name: result.name, passed: result.passed, failures}));
}
// END ORIGINAL ASSERTION AND OBSERVER BODY

assert.deepEqual(results, expectedOrdinary,
    'fresh complete ordinary results match the inherited candidate proof');
if (reportPath) {
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2) + '\n', {flag: 'wx'});
}
if (results.some(row => !row.passed)) process.exitCode = 1;
