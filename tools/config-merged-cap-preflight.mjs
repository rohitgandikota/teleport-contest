import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Shared by six gates. Only pinned metadata helpers may load before this finishes.
const reportPath = process.argv[2];
assert.ok(process.argv.length <= 3 && !reportPath?.startsWith('--'),
          'optional argument: compact report path');
const root = new URL('../', import.meta.url), js = new URL('js/', root);
const evidence = new URL('tools/gen-sessions/evidence/config-merged-cap-contract/', root);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const readEvidence = file => readFileSync(new URL(file, evidence));
const contractBytes = readEvidence('source-contract.json');
assert.equal(sha(contractBytes), 'b4f3d512a9ce6cadc848b06cce4c6f9943106ddd5d8d85c014fcc128e3b84122');
const contract = JSON.parse(contractBytes);
assert.equal(contract.reviewedCVersion, '16ff59115315917b93185d026aeefea06db9b0f4');
// C/build pins remain historical provenance, not clean-checkout dependencies.
for (const [file, digest] of Object.entries(contract.portableDependencyPins))
    assert.equal(sha(readFileSync(new URL(file, root))), digest, file);
for (const [file, digest] of Object.entries(contract.evidencePins))
    assert.equal(sha(readEvidence(file)), digest, file);
const {recordingIntegrityErrors, branchAssertionErrors} =
    await import(new URL('tools/gen-sessions/assertions.mjs', root));

const fields = ['seed', 'datetime', 'nethackrc', 'moves', 'name'];
const families = {}, nativePreflight = {};
const totals = {segments: 0, keys: 0, boundaries: 0, calls: 0, frames: 0};
let negativeControls = 0;
for (const [id, pin] of Object.entries(contract.families)) {
    const recipeBytes = readEvidence(pin.originalRecipe), recipe = JSON.parse(recipeBytes);
    const lockBytes = readEvidence(pin.inputLock), lock = JSON.parse(lockBytes);
    assert.equal(lock.recipeSHA256, sha(recipeBytes));
    assert.deepEqual(lock.fields, fields);
    assert.equal(recipe.segments.length, pin.counts.segments);
    assert.equal(recipe.expectations.length, pin.counts.segments);
    assert.equal(lock.segments.length, pin.counts.segments);
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
    const primaryBytes = readFileSync(new URL(pin.primaryRecipe, root));
    assert.equal(sha(primaryBytes), pin.primaryRecipeSHA256);
    const primary = JSON.parse(primaryBytes);
    const derivation = JSON.parse(readEvidence(pin.primaryDerivation));
    assert.equal(derivation.originalRecipeSHA256, sha(recipeBytes));
    assert.equal(derivation.inputLockSHA256, sha(lockBytes));
    assert.equal(derivation.primaryRecipeSHA256, sha(primaryBytes));
    assert.deepEqual(derivation.preservedKeys, Object.keys(recipe));
    for (const key of Object.keys(recipe)) assert.deepEqual(primary[key], recipe[key], `${id}: ${key}`);
    assert.deepEqual(primary, {...recipe, ...derivation.addedMetadata});
    assert.equal(primary.requireBranchAssertions, true);
    assert.deepEqual(primary.branches, pin.branches);
    assert.deepEqual(primary.branchAssertions.map(a => [a.branch, a.segment]),
        pin.branches.map((branch, i) => [branch, i]));

    const rawBytes = readFileSync(new URL(pin.canonicalRaw, root));
    assert.equal(sha(rawBytes), pin.rawSHA256, pin.canonicalRaw);
    assert.equal(rawBytes.length, pin.rawBytes);
    const native = JSON.parse(rawBytes);
    assert.equal(native.version, 5); assert.equal(native.source, 'c');
    assert.equal(native.jsGroundTruth, undefined);
    assert.equal(native.segments.length, pin.counts.segments);
    const counts = {segments: native.segments.length, keys: 0, boundaries: 0, calls: 0, frames: 0};
    for (const [i, part] of native.segments.entries()) {
        const expected = recipe.segments[i];
        for (const field of fields) {
            assert.ok(Object.hasOwn(part, field), `${id}/${i}: native missing ${field}`);
            assert.deepEqual(part[field], expected[field], `${id}/${i}: ${field}`);
        }
        assert.equal(part.steps.length, expected.moves.length + 1);
        assert.deepEqual(part.steps.map(step => step.key), [null, ...expected.moves]);
        for (const step of part.steps) {
            assert.ok(Object.hasOwn(step, 'key'));
            assert.equal(typeof step.screen, 'string');
            assert.ok(Array.isArray(step.cursor) && step.cursor.length === 3
                      && step.cursor.every(Number.isInteger));
            assert.ok(Array.isArray(step.rng) && step.rng.every(call => typeof call === 'string'));
            if (Object.hasOwn(step, 'animation_frames')) assert.ok(Array.isArray(step.animation_frames));
            counts.calls += step.rng.length; counts.frames += (step.animation_frames || []).length;
        }
        counts.keys += expected.moves.length; counts.boundaries += part.steps.length;
        const prefix = recipe.expectations[i].prefix;
        if (prefix?.length) {
            // Native calls carry source annotations. Check the ordered call prefix
            // without changing or reserializing any recorded value.
            for (const [position, call] of prefix.entries()) {
                const actual = part.steps[0].rng[position];
                assert.ok(actual === call || actual?.startsWith(call + ' @ '));
                assert.equal(part.steps.flatMap(step => step.rng)[position], actual);
            }
        }
    }
    assert.deepEqual(counts, pin.counts);
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(primary), []);
    assert.deepEqual(branchAssertionErrors(primary, native), []);
    for (const key of Object.keys(totals)) totals[key] += counts[key];

    const negative = JSON.parse(readEvidence(pin.negativeHashes));
    if (Object.hasOwn(negative, 'recipeSHA256')) assert.equal(negative.recipeSHA256, sha(recipeBytes));
    assert.deepEqual(negative.controls.map(control => control.name),
        recipe.expectations.filter(expected => !expected.positive).map(expected => expected.name));
    for (const control of negative.controls)
        assert.deepEqual(Object.keys(control.hashes).sort(), ['calls', 'cursors', 'frames', 'screens', 'slices']);
    negativeControls += negative.controls.length;
    families[id] = {recipe, recipeBytes, negative,
        canonical: pin.canonicalInputs ? JSON.parse(readEvidence(pin.canonicalInputs)) : null};
    nativePreflight[id] = {sha256: pin.rawSHA256, version: 5, source: 'c', fields,
        ...counts, primaryBranches: primary.branchAssertions.length};
}
assert.deepEqual(totals, contract.totalNative);
assert.equal(negativeControls, contract.negativeControls);
assert.equal(negativeControls * 5, contract.negativeStreamHashes);
const sourcePreflight = {reviewedCVersion: contract.reviewedCVersion,
    sourceManifestSHA256: contract.fixedSourceManifestSHA256,
    immutableEvidence: Object.keys(contract.evidencePins).length,
    portableDependencies: Object.keys(contract.portableDependencyPins).length,
    reviewedCSourcePins: Object.keys(contract.reviewedCSourcePins).length,
    negativeControls, negativeStreamHashes: negativeControls * 5};
// Gameplay and observer imports in callers follow this completed preflight.
export {reportPath, root, js, sha, families, nativePreflight, sourcePreflight};
