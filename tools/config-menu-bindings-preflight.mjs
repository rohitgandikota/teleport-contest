import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Shared metadata/native checks complete before any gate imports gameplay.
const reportPath = process.argv[2];
assert.ok(process.argv.length <= 3 && !reportPath?.startsWith('--'),
          'optional argument: compact report path');
const root = new URL('../', import.meta.url);
const evidence = new URL('tools/gen-sessions/evidence/config-menu-bindings-contract/', root);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => readFileSync(new URL(file, root));
const readEvidence = file => readFileSync(new URL(file, evidence));
const loadEvidence = file => JSON.parse(readEvidence(file));
const contractBytes = readEvidence('source-contract.json');
assert.equal(sha(contractBytes), '6656f0e9b28eef10693cafb780070a9104a2bc28d2eac8aaa5b9b5350a5b4a17');
const contract = JSON.parse(contractBytes);
assert.equal(contract.reviewedCVersion, '16ff59115315917b93185d026aeefea06db9b0f4');
// Historical C/build pins are provenance. A portable run needs no C tree/cache.
for (const [file, digest] of Object.entries(contract.portableDependencyPins))
    assert.equal(sha(read(file)), digest, file);
for (const [file, digest] of Object.entries(contract.evidencePins))
    assert.equal(sha(readEvidence(file)), digest, file);
for (const [file, digest] of Object.entries(contract.publicGatePins))
    assert.equal(sha(read(file)), digest, file);
const {branchAssertionErrors, recordingIntegrityErrors} =
    await import(new URL('tools/gen-sessions/assertions.mjs', root));

const fields = ['seed','datetime','nethackrc','moves','name'];
function checkNative(bytes, pin, recipe) {
    assert.equal(sha(bytes), pin.rawSHA256); assert.equal(bytes.length, pin.rawBytes);
    const native = JSON.parse(bytes);
    assert.equal(native.source, 'c'); assert.equal(native.version, 5);
    assert.equal(native.jsGroundTruth, undefined);
    assert.equal(native.segments.length, recipe.segments.length);
    const counts = {segments:native.segments.length,keys:0,boundaries:0,calls:0,frames:0};
    for (const [i, actual] of native.segments.entries()) {
        const wanted = recipe.segments[i];
        for (const field of fields) {
            assert.ok(Object.hasOwn(wanted, field)); assert.ok(Object.hasOwn(actual, field));
            assert.deepEqual(actual[field], wanted[field]);
        }
        assert.equal(actual.steps.length, wanted.moves.length + 1);
        assert.deepEqual(actual.steps.map(step => step.key), [null,...wanted.moves]);
        for (const step of actual.steps) {
            assert.ok(Object.hasOwn(step, 'key')); assert.equal(typeof step.screen, 'string');
            assert.ok(Array.isArray(step.cursor) && step.cursor.length === 3
                      && step.cursor.every(Number.isInteger));
            assert.ok(Array.isArray(step.rng) && step.rng.every(call => typeof call === 'string'));
            if (Object.hasOwn(step, 'animation_frames')) assert.ok(Array.isArray(step.animation_frames));
            counts.calls += step.rng.length; counts.frames += (step.animation_frames || []).length;
        }
        counts.keys += wanted.moves.length; counts.boundaries += actual.steps.length;
    }
    assert.deepEqual(counts, pin.counts);
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    return {native,counts};
}

const families = {}, nativePreflight = {};
const exact = row => row.fullStyleExact && row.frozenScreenCursorExact
    && row.fullRngExact && row.animationExact;
let negativeControls = 0;
for (const [id, pin] of Object.entries(contract.families)) {
    const recipeBytes = readEvidence(pin.originalRecipe), recipe = JSON.parse(recipeBytes);
    const lock = loadEvidence(pin.inputLock);
    assert.equal(sha(recipeBytes), lock.recipeSHA256); assert.deepEqual(lock.fields, fields);
    assert.equal(recipe.segments.length, lock.segments.length);
    const tuples = recipe.segments.map((part, i) => {
        const tuple = fields.map(field => {
            assert.ok(Object.hasOwn(part, field)); return [field,part[field]];
        });
        assert.equal(sha(JSON.stringify(tuple)), lock.segments[i].inputSHA256);
        assert.equal(part.name, lock.segments[i].name);
        assert.equal(part.name, recipe.expectations[i].name);
        assert.equal(part.moves.length, lock.segments[i].keys);
        if (lock.segments[i].keyCodePoints)
            assert.deepEqual([...part.moves].map(c => c.codePointAt(0)), lock.segments[i].keyCodePoints);
        return tuple;
    });
    assert.equal(sha(JSON.stringify(tuples)), lock.inputFieldsSHA256);
    const primaryBytes = read(pin.primaryRecipe);
    assert.equal(sha(primaryBytes), pin.primaryRecipeSHA256);
    const primary = JSON.parse(primaryBytes);
    const originalPrimary = loadEvidence(pin.originalPrimary);
    // Public naming/coverage metadata is separate from the fixed source recipe.
    assert.deepEqual(primary, {...originalPrimary,...pin.publicMetadata});
    for (const key of Object.keys(recipe)) assert.deepEqual(originalPrimary[key], recipe[key]);
    assert.equal(primary.requireBranchAssertions, true);
    assert.deepEqual(primary.branches, recipe.segments.map(s => s.name));
    assert.deepEqual(primary.branchAssertions.map(a => [a.branch,a.segment]),
        primary.branches.map((branch,i) => [branch,i]));
    const {native,counts} = checkNative(read(pin.raw), pin, primary);
    const negative = loadEvidence(pin.negativeHashes);
    assert.equal(negative.recipeSHA256, lock.recipeSHA256);
    assert.deepEqual(negative.controls.map(c => c.name),
        recipe.expectations.filter(e => !e.positive).map(e => e.name));
    for (const control of negative.controls)
        assert.deepEqual(Object.keys(control.hashes).sort(), ['calls','cursors','frames','screens','slices']);
    negativeControls += negative.controls.length;

    const report = loadEvidence(pin.fixedNativeReport);
    const invocation = loadEvidence(pin.fixedNativeInvocation);
    const baseline = loadEvidence(pin.baselineNativeReport);
    assert.equal(report.length, recipe.segments.length);
    assert.deepEqual(report.map(exact), pin.expectedNativeExact);
    assert.equal(invocation.exit, pin.expectedNativeExit);
    assert.ok(report.every(r => r.fullStyleExact && r.fullRngExact && r.animationExact));
    for (const control of negative.controls) {
        const current = report.find(r => r.name === control.name);
        assert.deepEqual(current, baseline.find(r => r.name === control.name));
    }
    families[id] = {recipe,recipeBytes,lock,negative,primary,native};
    nativePreflight[id] = {rawSHA256:pin.rawSHA256,version:5,source:'c',...counts,
        primaryBranches:primary.branches.length,fieldsPresenceKeys:true,
        integrityErrors:[],branchErrors:[],historicalNativeExact:report.filter(exact).length,
        historicalNativeExit:invocation.exit};
}
assert.equal(negativeControls, 7);

// Reproduce the two original ANSI-substring failures, then verify the exact
// decoded-cell correction relation. No old visual predicate is weakened.
const oldPrimary = loadEvidence('history/old-primary-recipe.json');
const helpProof = loadEvidence('history/help-primary-derivation.json');
assert.equal(sha(readEvidence('history/old-primary-recipe.json')), helpProof.originalPrimaryRecipeSHA256);
assert.equal(sha(readEvidence('original5/primary-recipe.json')), helpProof.correctedPrimaryRecipeSHA256);
const corrected = structuredClone(oldPrimary);
for (const correction of helpProof.corrections) {
    const row = corrected.branchAssertions[correction.segment];
    const original = correction.originalPredicate.screenIncludes;
    assert.equal(row.screenIncludes.filter(s => s === original).length, 1);
    row.screenIncludes = row.screenIncludes.filter(s => s !== original);
    row.screenCells.push(...correction.replacementPredicate.screenCells);
}
assert.deepEqual(corrected, loadEvidence('original5/primary-recipe.json'));
const legacyPrimaryErrors = branchAssertionErrors(oldPrimary, families.initial.native);
assert.equal(legacyPrimaryErrors.length, 2);
assert.deepEqual(legacyPrimaryErrors, loadEvidence('original5/parent-native-primary-check.json').branchErrors);

// Retain all eight diagnostic segments. Derive the maintained seven only by
// the explicit index map; compare entire objects, fields and step arrays.
const partition = loadEvidence('partition-receipt.json');
const keep = [0,1,2,3,4,5,7];
assert.deepEqual(partition.keepSourceIndices, keep);
assert.equal(partition.sourceRawSHA256, nativePreflight.prerequisite.rawSHA256);
const full = families.prerequisite.native;
const passingBytes = read(partition.targetRaw), passingRecipeBytes = read(partition.targetRecipe);
assert.equal(sha(passingRecipeBytes), partition.targetRecipeSHA256);
const passingRecipe = JSON.parse(passingRecipeBytes);
const expectedRecipe = {...families.prerequisite.primary,...partition.recipeDerivation.onlyAdditionalRootMetadata};
for (const key of ['segments','expectations','branches'])
    expectedRecipe[key] = keep.map(i => families.prerequisite.primary[key][i]);
expectedRecipe.branchAssertions = keep.map((i,j) => ({...families.prerequisite.primary.branchAssertions[i],segment:j}));
assert.deepEqual(passingRecipe, expectedRecipe);
const passingPin = {rawSHA256:partition.targetRawSHA256,rawBytes:partition.targetRawBytes,counts:partition.targetCounts};
const passing = checkNative(passingBytes, passingPin, passingRecipe);
assert.deepEqual(passing.native, {...full,segments:keep.map(i => full.segments[i])});
for (const [j,i] of keep.entries()) {
    assert.deepEqual(passing.native.segments[j], full.segments[i]);
    assert.equal(partition.segments[j].sourceIndex,i); assert.equal(partition.segments[j].targetIndex,j);
}
assert.equal(full.segments[6].name, 'menu-capacity-33-reject-positive');
assert.deepEqual(full.segments[6].steps.map(s => s.cursor), [[0,1,1],[0,1,1],[0,1,1],[0,1,1],[0,1,1]]);
const diagnostic = loadEvidence('prerequisite8/candidate-native.json')[6];
assert.equal(diagnostic.cursors.matched,0); assert.equal(diagnostic.cursors.expected,5);
assert.equal(diagnostic.cursors.actual,5); assert.equal(diagnostic.screenDifferences.length,0);
assert.equal(diagnostic.frozenScreenCursorExact,false);
const requirements = loadEvidence('requirements-additions.json').requirements;
assert.deepEqual(requirements.map(r => r.id),
    [...families.initial.recipe.segments,...families.prerequisite.recipe.segments].map(s => s.name));
assert.deepEqual(requirements.filter(r => !r.maintainedPassingCorpus).map(r => r.id),
    ['menu-capacity-33-reject-positive']);
assert.equal(requirements.find(r => !r.maintainedPassingCorpus).nativeStatus,'diagnostic');

const sourcePreflight = {reviewedCVersion:contract.reviewedCVersion,
    sourceManifestSHA256:contract.fixedSourceManifestSHA256,
    immutableEvidence:Object.keys(contract.evidencePins).length,
    portableDependencies:Object.keys(contract.portableDependencyPins).length,
    negativeControls,negativeStreamHashes:35,ordinaryCases:13,
    maintainedNativeCases:12,fullPrerequisiteDiagnostic:'7/8; exit 1; five cursor defects retained',
    passingPrerequisiteSHA256:partition.targetRawSHA256};
export {root,reportPath,sha,families,nativePreflight,sourcePreflight,legacyPrimaryErrors};
