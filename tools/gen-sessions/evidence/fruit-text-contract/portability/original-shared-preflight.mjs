import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

// Metadata-only mandatory preflight. No game or observer helper imports precede it.
const reportPath = process.argv[2];
assert.ok(process.argv.length <= 3 && !reportPath?.startsWith('--'),
          'optional argument: compact report path');
const repoRoot = new URL('../', import.meta.url), js = new URL('js/', repoRoot);
const root = new URL('tools/gen-sessions/evidence/fruit-text-contract/', repoRoot);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function pinned(file, expected, base = root) {
    const bytes = fs.readFileSync(new URL(file, base));
    assert.equal(sha(bytes), expected, file);
    return { bytes, value: JSON.parse(bytes) };
}
const sourceContract = pinned('source-contract.json', '30ac501c9127639f3cce5c0808fe36fbbfbfcb080babf2adea324655bacf0f70').value;
for (const [file, digest] of Object.entries(sourceContract.sourcePins))
    assert.equal(sha(fs.readFileSync(new URL(file, repoRoot))), digest, file);
for (const [file, digest] of Object.entries(sourceContract.immutableEvidence))
    assert.equal(sha(fs.readFileSync(new URL(file, root))), digest, file);
const nativePins = pinned('native-pins.json', '1e9441105e1c9791c63205c7a07af8c99e6045ea64d6a7e650d49e37ae86a455').value;
const original = {};
const fields = ['seed', 'datetime', 'nethackrc', 'moves', 'name'];
for (const [id, recipePath, lockPath, count] of [
    ['initial11', 'recipes/initial-ordinary.json', 'locks/initial-input-lock.json', 11],
    ['pickup2', 'recipes/pickup-ordinary.json', 'locks/pickup-input-lock.json', 2],
    ['original5', 'recipes/fruit-original-probes.json', 'locks/fruit-original-input-lock.json', 5],
]) {
    const rb = fs.readFileSync(new URL(recipePath, root));
    const lb = fs.readFileSync(new URL(lockPath, root));
    const recipe = JSON.parse(rb), lock = JSON.parse(lb);
    assert.equal(sha(rb), sourceContract.immutableEvidence[recipePath]);
    assert.equal(sha(lb), sourceContract.immutableEvidence[lockPath]);
    assert.equal(lock.recipeSHA256, sha(rb)); assert.deepEqual(lock.fields, fields);
    assert.equal(recipe.segments.length, count); assert.equal(lock.segments.length, count);
    assert.equal(recipe.expectations.length, count);
    const tuples = recipe.segments.map((part, i) => {
        const tuple = fields.map(field => {
            assert.ok(Object.hasOwn(part, field), `${id}/${i}: missing ${field}`);
            return [field, part[field]];
        });
        assert.equal(sha(JSON.stringify(tuple)), lock.segments[i].inputSHA256);
        assert.equal(part.name, lock.segments[i].name);
        assert.equal(part.name, recipe.expectations[i].name);
        assert.equal(part.moves.length, lock.segments[i].keys);
        return tuple;
    });
    assert.equal(sha(JSON.stringify(tuples)), lock.inputFieldsSHA256);
    original[id] = { recipe, lock, recipeBytes: rb, lockBytes: lb };
}
const families = ['initial11', 'pickup2', 'original5'];
assert.deepEqual(Object.keys(nativePins.raws).sort(), [...families].sort());
const nativeByFamily = {}, nativeBytes = {}, nativePreflight = {};
for (const id of families) {
    const pin = nativePins.raws[id], expectedSegments = original[id].recipe.segments;
    const raw = pinned(pin.path, pin.sha256, repoRoot);
    assert.equal(raw.bytes.length, pin.bytes);
    const native = raw.value;
    assert.equal(native.version, 5); assert.equal(native.source, 'c');
    assert.equal(native.segments.length, expectedSegments.length);
    assert.equal(native.segments.length, pin.segments);
    let keys = 0, boundaries = 0, calls = 0, frames = 0;
    for (const [i, part] of native.segments.entries()) {
        const expected = expectedSegments[i];
        for (const field of fields) {
            assert.ok(Object.hasOwn(part, field), `${id}/${i}: native missing ${field}`);
            assert.deepEqual(part[field], expected[field], `${id}/${i}: ${field}`);
        }
        assert.equal(part.steps.length, expected.moves.length + 1);
        assert.deepEqual(part.steps.map(s => s.key), [null, ...expected.moves]);
        for (const step of part.steps) {
            assert.ok(Object.hasOwn(step, 'key'));
            assert.equal(typeof step.screen, 'string');
            assert.ok(Array.isArray(step.cursor) && step.cursor.length === 3
                      && step.cursor.every(Number.isInteger));
            assert.ok(Array.isArray(step.rng) && step.rng.every(c => typeof c === 'string'));
            if (Object.hasOwn(step, 'animation_frames')) assert.ok(Array.isArray(step.animation_frames));
            calls += step.rng.length; frames += (step.animation_frames || []).length;
        }
        keys += expected.moves.length; boundaries += part.steps.length;
    }
    assert.deepEqual({ keys, boundaries, calls, frames },
        { keys: pin.keys, boundaries: pin.boundaries, calls: pin.calls, frames: pin.frames });
    nativeByFamily[id] = native; nativeBytes[id] = raw.bytes;
    nativePreflight[id] = { sha256: pin.sha256, version: 5, source: 'c',
        segments: native.segments.length, fields, keys, boundaries, calls, frames };
}
// The initial recording succeeded once. Its wrapper failed on missing source metadata.
// Preserve the original raw and verify the exact certified prefix insertion.
const certification = nativePins.certification;
const missingSource = pinned(certification.originalPath, certification.originalSHA256);
const certificationProof = pinned(certification.proofPath, certification.proofSHA256).value;
assert.equal(missingSource.bytes.length, certification.originalBytes);
assert.equal(missingSource.bytes[0], 123);
assert.equal(Object.hasOwn(missingSource.value, 'source'), false);
assert.deepEqual(nativeBytes.initial11,
    Buffer.concat([Buffer.from('{"source":"c",'), missingSource.bytes.subarray(1)]));
assert.deepEqual(nativeByFamily.initial11, { source: 'c', ...missingSource.value });
assert.equal(certificationProof.originalSHA256, certification.originalSHA256);
assert.equal(certificationProof.canonicalSHA256, nativePins.raws.initial11.sha256);
assert.equal(certificationProof.cExecutedOnce, true);
assert.equal(certificationProof.rerecorded, false);
assert.equal(certificationProof.recordedStepsUnchanged, true);
assert.equal(certificationProof.fiveFieldsAndAllKeysUnchanged, true);
// Pure recording checks only; their source hashes have already been checked.
const { recordingIntegrityErrors, branchAssertionErrors } =
    await import(new URL('tools/gen-sessions/assertions.mjs', repoRoot));
for (const native of Object.values(nativeByFamily))
    assert.deepEqual(recordingIntegrityErrors(native), []);
assert.equal(nativePins.status, 'reviewed-parent-native-and-composition');
assert.equal(nativePins.compositionReview.state, 'reviewed');
const reviewedComposition = pinned(nativePins.compositionReview.path,
                                    nativePins.compositionReview.sha256).value;
assert.equal(reviewedComposition.runtimeFiles, 280);
assert.equal(reviewedComposition.runtimeMapSHA256,
             '8de03214a2c538db68e8b0a0ac5e0a1ef17fcb49cb5f97214168aec5cc52cff8');
for (const id of families) {
    const receiptPin = nativePins.recordingReceipts[id];
    const receipt = pinned(receiptPin.path, receiptPin.sha256).value;
    assert.equal(receipt.exit, 0);
    assert.equal(receipt.cPin, '16ff59115315917b93185d026aeefea06db9b0f4');
    assert.equal(receipt.binarySha256, 'ba4dbc1c823f8d4b0cfb6fd594d00ff0ff5754daaaa2036bee15baeffdf85aa7');
    assert.equal(receipt.recorderSha256, 'b129caee2ca3941b30c36f5c26644bd37ff610344332eb511c474b8709b70648');
    if (id === 'initial11') {
        assert.equal(Object.hasOwn(receipt, 'rawSha256'), false);
        assert.equal(certificationProof.recordingReceiptSHA256, receiptPin.sha256);
    } else assert.equal(receipt.rawSha256, nativePins.raws[id].sha256);
    const primaryPin = nativePins.primaryRecipes[id];
    const primary = pinned(primaryPin.path, primaryPin.sha256, repoRoot).value;
    const derivation = pinned(primaryPin.derivationPath, primaryPin.derivationSHA256).value;
    for (const key of Object.keys(original[id].recipe))
        assert.deepEqual(primary[key], original[id].recipe[key], `${id}: preserve ${key}`);
    assert.deepEqual(Object.keys(primary).filter(k => !Object.hasOwn(original[id].recipe, k)).sort(),
        ['branchAssertions', 'branches', 'requireBranchAssertions']);
    assert.equal(derivation.originalRecipeSHA256, sha(original[id].recipeBytes));
    assert.equal(derivation.primaryRecipeSHA256, primaryPin.sha256);
    assert.equal(primary.requireBranchAssertions, true);
    assert.equal(primary.branchAssertions.length, original[id].recipe.segments.length);
    assert.deepEqual(primary.branches, primaryPin.branches);
    assert.deepEqual(primary.branchAssertions.map(a => [a.branch, a.segment]),
        primary.branches.map((name, i) => [name, i]));
    assert.deepEqual(branchAssertionErrors(primary), []);
    assert.deepEqual(branchAssertionErrors(primary, nativeByFamily[id]), []);
    nativePreflight[id].primaryBranches = primary.branchAssertions.length;
}
const readEvidence = file => JSON.parse(fs.readFileSync(new URL(file, root)));
const markerAccounting = readEvidence(reviewedComposition.sourceAccounting);
const parentAccounting = readEvidence(reviewedComposition.parentNativeAccounting);
assert.equal(markerAccounting.sourceAndDeltaPassed, 18);
assert.equal(markerAccounting.changedCells, 2);
assert.equal(markerAccounting.legacyNegativeHashesUnchanged, 34);
assert.equal(markerAccounting.legacyNegativeHashesTotal, 35);
assert.equal(parentAccounting.cases, 18);
assert.equal(parentAccounting.completeNativeReportsUnchanged, 16);
assert.equal(parentAccounting.allCInputsFixed, true);
assert.equal(parentAccounting.newCRecordings, 0);
assert.equal(parentAccounting.sourceAccountingSHA256,
    sha(fs.readFileSync(new URL(reviewedComposition.sourceAccounting, root))));
assert.equal(parentAccounting.composedRuntimeSHA256, reviewedComposition.runtimeMapSHA256);
for (const family of ['initial', 'pickup', 'original5']) {
    const candidateBytes = fs.readFileSync(new URL(`parent/fruit-text-marker-parent-candidate-${family}-native.json`, root));
    const composedBytes = fs.readFileSync(new URL(`parent/fruit-text-marker-parent-composed-${family}-native.json`, root));
    assert.deepEqual(candidateBytes, composedBytes);
    const rows = JSON.parse(composedBytes);
    assert.equal(rows.length, family === 'initial' ? 11 : family === 'pickup' ? 2 : 5);
    for (const row of rows) {
        for (const key of ['frozenScreenCursorExact', 'fullRngExact', 'fullStyleExact', 'animationExact'])
            assert.equal(row[key], true, `${row.name}: ${key}`);
        const accounted = markerAccounting.rows.find(r => r.name === row.name);
        assert.deepEqual(row.rawHashes.js, accounted.afterHashes);
    }
}
assert.deepEqual(parentAccounting.onlyScreenHashesChanged.map(r => r.name),
    ['fruit-text-menu-color-byte-search', 'fruit-text-menu-color-ascii-negative']);
for (const row of parentAccounting.onlyScreenHashesChanged) {
    const accounted = markerAccounting.rows.find(r => r.name === row.name);
    assert.equal(row.originalScreenSHA256, accounted.beforeHashes.screens);
    assert.equal(row.correctedScreenSHA256, accounted.afterHashes.screens);
    assert.equal(row.otherFourHashesUnchanged, true);
    for (const stream of ['cursors', 'calls', 'slices', 'frames'])
        assert.equal(accounted.beforeHashes[stream], accounted.afterHashes[stream]);
}
const sourcePreflight = { immutableEvidence: Object.keys(sourceContract.immutableEvidence).length,
    sourcePins: Object.keys(sourceContract.sourcePins).length, review: nativePins.status,
    certifiedPrefixOnly: true, legacyNegativeHashesUnchanged: '34/35; one explicit failure retained' };
// End mandatory preflight. Runtime imports may begin only below this line.

export { reportPath, repoRoot, js, root, sha, original, nativePreflight, sourcePreflight, markerAccounting, reviewedComposition, sourceContract, readEvidence };
