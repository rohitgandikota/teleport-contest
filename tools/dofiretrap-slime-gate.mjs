// Original fire/slime inputs and assertions, using the current installed runtime.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('../', import.meta.url);
const evidence = new URL('tools/gen-sessions/evidence/dofiretrap-slime/', root);
const json = url => JSON.parse(readFileSync(url));
const evidenceJSON = name => json(new URL(name, evidence));
const read = name => evidenceJSON('source15/' + name);
const sha = value => createHash('sha256').update(value).digest('hex');
const hash = value => sha(JSON.stringify(value));
const digest = url => sha(readFileSync(url));
assert.ok(process.argv.length <= 3, 'usage: node tools/dofiretrap-slime-gate.mjs [new-report.json]');
const reportPath = process.argv[2] || null;
assert.ok(!reportPath || (!reportPath.startsWith('-') && !existsSync(reportPath)), 'report must be a new file');
const contractFile = new URL('source-contract.json', evidence);
assert.equal(digest(contractFile), 'be69a9edf919f82e3cfe8b39fd0e55a20fcafe100bea2abada8eaca6a14d62cc');
const contract = json(contractFile);
for (const [name, expected] of Object.entries(contract.evidencePins))
    assert.equal(digest(new URL(name, evidence)), expected, name);
for (const [name, expected] of Object.entries(contract.portableDependencyPins))
    assert.equal(digest(new URL(name, root)), expected, name);
for (const [label, pin] of Object.entries(contract.sealedPackets)) {
    const seal = evidenceJSON(label + '/SEAL.json');
    const manifest = evidenceJSON(label + '/MANIFEST.json');
    assert.equal(digest(new URL(label + '/SEAL.json', evidence)), pin.sealSHA256);
    assert.equal(digest(new URL(label + '/MANIFEST.json', evidence)), pin.manifestSHA256);
    assert.equal(seal.manifestSHA256, pin.manifestSHA256);
    assert.equal(seal.members, pin.members);
    assert.equal(Object.keys(manifest).length, pin.members);
}
for (const [name, origin] of Object.entries(contract.sealedEvidence))
    assert.equal(digest(new URL(name, evidence)),
        evidenceJSON(origin.packet + '/MANIFEST.json')[origin.member], name);

const sourceSeal = read('SEAL.json');
const candidateSeal = evidenceJSON('candidate334/SEAL.json');
assert.equal(candidateSeal.originalSourceSealSHA256, contract.sealedPackets.source15.sealSHA256);
const lock = read('input-lock.json');
assert.equal(digest(new URL('source15/input-lock.json', evidence)), contract.originalInputLockSHA256);
assert.equal(lock.probeSHA256, contract.evidencePins['source15/probe.mjs']);
for (const name of ['recipe.json', 'predictions.json', 'existing-healthy-hashes.json', 'source-pins.json', 'SOURCE-REVIEW.md'])
    assert.equal(lock.files[name], contract.evidencePins['source15/' + name]);
const sourceText = readFileSync(new URL('source15/probe.mjs', evidence), 'utf8');
const gateText = readFileSync(new URL(import.meta.url), 'utf8');
const provenance = evidenceJSON('portable-provenance.json');
const originalBody = sourceText.slice(sourceText.indexOf(provenance.bodyStart),
    sourceText.indexOf(provenance.sourceBodyEnd, sourceText.indexOf(provenance.bodyStart)));
assert.equal(sha(originalBody), contract.originalBodySHA256);
let portableBody = originalBody;
for (const {old, new: replacement} of provenance.replacements)
    portableBody = portableBody.replaceAll(old, replacement);
assert.equal(sha(portableBody), contract.portableBodySHA256);
assert.equal(gateText.slice(gateText.indexOf(provenance.bodyStart),
    gateText.indexOf(provenance.portableBodyEnd)), portableBody);

const recipeFile = new URL(contract.recipe.path, root);
assert.equal(digest(recipeFile), contract.recipe.sha256);
const recipe = json(recipeFile), predictions = read('predictions.json');
assert.deepEqual(recipe, read('recipe.json'));
assert.equal(sourceSeal.recipeSHA256, contract.recipe.sha256);
assert.deepEqual(lock.fields, ['name', 'seed', 'datetime', 'nethackrc', 'moves']);
const tuples = parts => parts.map(part => lock.fields.map(field =>
    ({field, present: Object.hasOwn(part, field), value: part[field]})));
assert.deepEqual(tuples(recipe.segments), lock.tuples);
assert.deepEqual(lock.negativeIndexes, [1, 3, 4, 5]);
assert.deepEqual(lock.existingHealthyIndexes, [1, 3]);
const parentLock = evidenceJSON('parent/input-lock.json');
const recording = evidenceJSON('parent/native-recording.json');
assert.equal(parentLock.beforeC, true);
assert.equal(recording.cExecutedOnce, true);
assert.equal(recording.exit, 0);
assert.equal(parentLock.sourceSealSHA256, contract.sealedPackets.source15.sealSHA256);
assert.equal(recording.sourceSealSHA256, contract.sealedPackets.source15.sealSHA256);
for (const name of ['sourceRecipeSHA256', 'primaryRecipeSHA256', 'minimalSHA256'])
    assert.equal(parentLock[name], contract.recipe.sha256);
assert.equal(recording.inputSHA256, contract.recipe.sha256);
assert.equal(recording.primaryRecipeSHA256, contract.recipe.sha256);
assert.equal(recording.rawSha256, contract.native.sha256);
assert.equal(recording.cPin, contract.cPin);
assert.equal(recording.binarySha256, contract.recordedBinarySHA256);
assert.equal(recording.recorderSha256, contract.recordedRecorderSHA256);
assert.equal(recording.logSHA256, contract.evidencePins['parent/native-recording.log']);

const rawBytes = readFileSync(new URL(contract.native.path, root));
assert.equal(sha(rawBytes), contract.native.sha256);
assert.equal(rawBytes.length, 1313341);
const native = JSON.parse(rawBytes);
assert.equal(native.source, 'c');
assert.equal(native.version, 5);
assert.deepEqual(Object.keys(native).sort(), Object.keys(recipe).sort());
for (const name of Object.keys(recipe))
    if (name !== 'segments') assert.deepEqual(native[name], recipe[name], name);
assert.equal(native.segments.length, 6);
assert.deepEqual(tuples(native.segments), lock.tuples);
for (const [index, part] of recipe.segments.entries()) {
    assert.deepEqual(native.segments[index].steps.map(step => step.key), [null, ...part.moves]);
    assert.equal(recipe.branchAssertions[index].branch, recipe.branches[index]);
    assert.equal(recipe.branchAssertions[index].segment, index);
}
const totals = {cases: native.segments.length, keys: recipe.segments.reduce((n, s) => n + s.moves.length, 0),
    boundaries: native.segments.reduce((n, s) => n + s.steps.length, 0),
    calls: native.segments.flatMap(s => s.steps).flatMap(s => s.rng || []).length,
    frames: native.segments.flatMap(s => s.steps).flatMap(s => s.animation_frames || []).length};
assert.deepEqual(totals, {cases: 6, keys: 940, boundaries: 946, calls: 16874, frames: 42});
assert.deepEqual(totals, contract.totals);
const {branchAssertionErrors, recordingIntegrityErrors} = await import('./gen-sessions/assertions.mjs');
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(recipe, native), []);
assert.equal(recipe.requireBranchAssertions, true);
assert.equal(recipe.branchAssertions.length, 6);
const requirements = evidenceJSON('requirements-additions.json');
assert.deepEqual(requirements.map(row => row.id), recipe.branches);
assert.ok(requirements.every(row => row.cFile === 'src/trap.c' && row.cFunction === 'dofiretrap'));

const baselineRows = read('baseline-observation.json');
const candidateRows = evidenceJSON('candidate334/reports/candidate-observation.json');
const baselineNative = evidenceJSON('parent/baseline-native.json');
const candidateNative = evidenceJSON('candidate334/reports/candidate-native.json');
const exact = row => row.fullStyleExact && row.frozenScreenCursorExact && row.fullRngExact && row.animationExact;
assert.equal(baselineRows.flatMap(row => row.checks).length, 54);
assert.equal(baselineRows.flatMap(row => row.checks).filter(c => c.pass).length, 50);
assert.deepEqual(baselineRows.filter(row => !row.source).map(row => row.index), [0, 2]);
assert.equal(candidateRows.flatMap(row => row.checks).filter(c => c.pass).length, 54);
assert.deepEqual(baselineNative.map(exact), [false, true, false, true, true, true]);
assert.equal(candidateNative.length, 6);
assert.ok(candidateNative.every(exact));
assert.equal(candidateSeal.nativeReportSHA256, contract.evidencePins['candidate334/reports/candidate-native.json']);
for (const index of contract.negativeIndexes) {
    assert.deepEqual(candidateRows[index], baselineRows[index]);
    assert.deepEqual(candidateNative[index], baselineNative[index]);
    assert.deepEqual(candidateNative[index].rawHashes.js, baselineRows[index].outputHashes);
}
assert.deepEqual(read('negative-hashes.json'), contract.negativeIndexes
    .map(index => ({index, outputHashes: baselineRows[index].outputHashes})));
for (const [index, hashes] of Object.entries(read('existing-healthy-hashes.json')))
    assert.deepEqual(baselineRows[index].outputHashes, hashes);
const nativePreflight = {beforeGameplayImports: true, sourceC5: true,
    rawSHA256: contract.native.sha256, recipeSHA256: contract.recipe.sha256,
    allRootMetadata: true, fiveFieldPresenceAndValues: true, allKeysExact: true,
    integrityErrors: [], primaryErrors: [], primaryAssertions: 6, totals};

const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {PMNAMES} = await import('../js/monst_data.js');
const {ONAMES} = await import('../js/objects_data.js');
const {FIRE_TRAP, ROOM, W_ARMG} = await import('../js/const.js');
const {Fire_resistance, Fumbling, Underwater, Blind} = await import('../js/youprop.js');
const {decodeScreen, renderCell} = await import('../frozen/screen-decode.mjs');
const {outputs, hashes, deferred} = await import('./half-damage-reader-observe.mjs');
const existing = read('existing-healthy-hashes.json');
const cure = 'The slime that covers you is burned away!';
const rows = [];
for (const [index, part] of recipe.segments.entries()) {
    const p = predictions[index], states = [], checks = [];
    const check = (kind, name, fn) => {
        try { fn(); checks.push({kind, name, pass: true}); }
        catch (error) { checks.push({kind, name, pass: false, error: error.message}); }
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            if (!g.u || !g.level) return;
            states.push({step, turn: g.moves, form: g.u.umonnum,
                hp: g.u.uhp, hpmax: g.u.uhpmax, mh: g.u.mh, mhmax: g.u.mhmax,
                mortality: g.u.umortality || 0, slime: g.u.uprops?.SLIMED || 0,
                xy: [g.u.ux, g.u.uy], terrain: g.level.at(g.u.ux, g.u.uy).typ,
                resistant: !!Fire_resistance(), fumbling: !!Fumbling(),
                underwater: !!Underwater(), blind: !!Blind(),
                gloves: g.u.uarmg ? {type: g.u.uarmg.otyp, worn: g.u.uarmg.owornmask} : null,
                trap: g.level.traps.find(t => t.tx === g.u.ux && t.ty === g.u.uy)?.ttyp ?? null,
                liveMonsters: g.level.monsters.filter(m => m.mhp > 0).length});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const out = structuredClone(outputs(run));
    const texts = out.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    const before = states.find(s => s.step === p.actionStart), after = states.at(-1);
    check('producer', 'actual fire trap and safe floor reached after cleanup', () => {
        assert.equal(before.trap, FIRE_TRAP); assert.equal(before.terrain, ROOM);
        assert.deepEqual(before.xy, [58, 6]); assert.equal(before.liveMonsters, 0);
        assert.equal(before.underwater, false); assert.equal(before.blind, false);
    });
    check('producer', 'actual form, resistance and worn fumbling gloves', () => {
        assert.equal(before.form, PMNAMES[p.form]); assert.ok(before.mh > 0);
        assert.equal(before.resistant, p.resistant); assert.equal(before.fumbling, true);
        assert.equal(before.gloves.type, ONAMES.GAUNTLETS_OF_FUMBLING);
        assert.ok(before.gloves.worn & W_ARMG);
    });
    check('producer', 'requested timed slime or healthy condition exists before action', () => {
        assert.equal(before.slime, p.slimed ? 100 : 0);
        assert.equal(texts.some(t => t.includes('You are turning into slime.')), p.slimed);
    });
    check('producer', 'all inputs consumed with no death or rehumanization', () => {
        assert.equal(after.step, part.moves.length); assert.equal(out.screens.length, part.moves.length + 1);
        assert.deepEqual(out.slices.flat(), out.calls);
        assert.ok(states.every(s => s.hp > 0 && !s.mortality));
        assert.equal(after.form, PMNAMES[p.form]); assert.ok(after.mh > 0);
    });
    check('source', 'only a sit action triggers the fire trap', () =>
        assert.equal(texts.some(t => t.includes('A tower of flame erupts')), p.trigger));
    check('source', 'fire clears the timer, while look preserves it', () =>
        assert.equal(after.slime, p.expectedCSlime));
    check('source', 'cure feedback occurs only for slimed fire triggers', () =>
        assert.equal(texts.some(t => t.includes(cure)), p.slimed && p.trigger));
    const plain = structuredClone(outputs(await runSegment({...part, storage: new InMemoryStorage()})));
    const delayed = await deferred(part);
    check('neutrality', 'passive observer preserves all five streams', () => assert.deepEqual(out, plain));
    check('neutrality', 'deferred input preserves all five streams', () => assert.deepEqual(out, delayed));
    const outputHashes = hashes(out);
    if (Object.hasOwn(existing, index)) assert.deepEqual(outputHashes, existing[index]);
    rows.push({index, name: part.name, negative: p.negative, checks, before, after,
        producer: checks.filter(c => c.kind === 'producer').every(c => c.pass),
        source: checks.filter(c => c.kind === 'source').every(c => c.pass),
        statesSHA256: sha(JSON.stringify(states)), outputHashes,
        boundaries: out.screens.length, calls: out.calls.length, frames: out.frames.flat().length});
}
// Portable accounting. Historical native reports are not a fresh native replay.
assert.equal(rows.length, 6);
assert.equal(rows.flatMap(row => row.checks).length, 54);
assert.ok(rows.every(row => row.checks.every(check => check.pass)), 'all 54 original checks');
assert.deepEqual(rows.filter(row => row.negative), baselineRows.filter(row => row.negative),
    'four complete original negative ordinary rows');
assert.deepEqual(rows.filter(row => row.negative).map(row => ({index: row.index, outputHashes: row.outputHashes})),
    read('negative-hashes.json'), '20 original negative hashes');
for (const index of contract.negativeIndexes)
    assert.deepEqual(rows[index].outputHashes, baselineNative[index].rawHashes.js);
const report = {nativePreflight,
    sourcePreflight: {immutableEvidence: Object.keys(contract.evidencePins).length,
        originalAssertionsVerbatim: true, onlyImportPathsRelocated: true, nativeReplay: false},
    runtimeOwnerSHA256: digest(new URL('js/trap.js', root)),
    summary: {cases: 6, passed: 54, total: 54, producerChecks: 24, sourceChecks: 18,
        neutrality: 12, negativeHashes: 20, fullOrdinaryNegativeRows: 4, existingHealthyHashes: 10},
    history: {source: '50/54', nativeBaseline: '4/6', nativeCandidate: '6/6', fullNativeNegativeRows: 4},
    results: rows.map(row => ({index: row.index, name: row.name, negative: row.negative,
        passed: row.checks.filter(check => check.pass).length, total: row.checks.length,
        fullRowSHA256: hash(row), hashes: row.outputHashes, statesSHA256: row.statesSHA256}))};
if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify(report, null, 2));
