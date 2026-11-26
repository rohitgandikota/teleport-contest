// Metadata and source checks only. Gameplay modules are imported after this completes.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './tools/gen-sessions/assertions.mjs';

export const root = new URL('./', import.meta.url);
export const sha = value => createHash('sha256').update(value).digest('hex');
export const read = name => JSON.parse(readFileSync(new URL(name, root)));
const bytes = name => readFileSync(new URL(name, root));
const lock = read('pre-edit-lock.json');
for (const [name, digest] of Object.entries(lock.files))
    assert.equal(sha(bytes(name)), digest, name);

const sourceRoot = new URL('../dofiretrap-slime-source-audit/', root);
const sourceSeal = read('history/source-SEAL.json');
assert.equal(sha(bytes('history/source-MANIFEST.json')), sourceSeal.manifestSHA256);
const sourceManifest = read('history/source-MANIFEST.json');
assert.equal(Object.keys(sourceManifest).length, 15);
for (const [name, digest] of Object.entries(sourceManifest))
    assert.equal(sha(readFileSync(new URL(name, sourceRoot))), digest, name);
const inputLock = read('history/source-input-lock.json');
for (const [name, digest] of Object.entries(inputLock.files))
    assert.equal(sha(readFileSync(new URL(name, sourceRoot))), digest, name);
assert.equal(sha(bytes('history/original-probe.mjs')), inputLock.probeSHA256);
for (const [name, digest] of Object.entries(read('source-pins.json')))
    assert.equal(sha(readFileSync(name)), digest, name);

const baselineRuntime = read('baseline-runtime.json');
const runtime = read('runtime.json');
assert.equal(sha(bytes('runtime.json')), lock.candidateRuntimeSHA256);
assert.equal(sha(bytes('scoped-runtime.patch')), lock.patchSHA256);
assert.deepEqual(Object.keys(runtime), Object.keys(baselineRuntime));
assert.deepEqual(Object.keys(runtime).filter(name => runtime[name] !== baselineRuntime[name]), ['js/trap.js']);
for (const [name, digest] of Object.entries(baselineRuntime))
    assert.equal(sha(readFileSync(new URL(name, sourceRoot))), digest, name);
export const verifyRuntime = () => {
    assert.equal(Object.keys(runtime).length, 280);
    for (const [name, digest] of Object.entries(runtime))
        assert.equal(sha(bytes(name)), digest, name);
};
verifyRuntime();
const body = text => text.slice(text.indexOf('const {runSegment}'),
    text.indexOf('\nverifyRuntime();', text.indexOf('const {runSegment}')));
assert.equal(body(bytes('probe.mjs').toString()), body(bytes('history/original-probe.mjs').toString()));
assert.equal(sha(body(bytes('probe.mjs').toString())), lock.originalBodySHA256);

export const recipe = read('recipe.json');
export const predictions = read('predictions.json');
assert.deepEqual(recipe, read('history/parent-primary-recipe.json'));
assert.deepEqual(recipe.segments.map(part => inputLock.fields.map(field =>
    ({field, present: Object.hasOwn(part, field), value: part[field]}))), inputLock.tuples);
assert.deepEqual(predictions.filter(p => p.negative).map((p) => predictions.indexOf(p)), [1, 3, 4, 5]);
const oldRows = read('history/source-baseline-observation.json');
assert.equal(oldRows.flatMap(r => r.checks).length, 54);
assert.equal(oldRows.flatMap(r => r.checks).filter(c => c.pass).length, 50);
assert.deepEqual(oldRows.filter(r => !r.source).map(r => r.index), [0, 2]);
assert.deepEqual(oldRows.filter(r => r.negative).map(r => ({index: r.index, outputHashes: r.outputHashes})), read('negative-hashes.json'));
for (const [index, hashes] of Object.entries(read('existing-healthy-hashes.json')))
    assert.deepEqual(oldRows[index].outputHashes, hashes);

export const rawFile = new URL('native.session.json', root);
const native = read('native.session.json');
assert.equal(native.source, 'c');
assert.equal(native.version, 5);
assert.equal(native.segments.length, 6);
for (const key of Object.keys(recipe))
    if (key !== 'segments') assert.deepEqual(native[key], recipe[key]);
for (const [index, part] of recipe.segments.entries()) {
    const actual = native.segments[index];
    for (const field of inputLock.fields) {
        assert.equal(Object.hasOwn(actual, field), Object.hasOwn(part, field), `${index}:${field}`);
        assert.deepEqual(actual[field], part[field], `${index}:${field}`);
    }
    assert.deepEqual(actual.steps.map(s => s.key), [null, ...part.moves]);
}
assert.equal(recipe.segments.reduce((n, p) => n + p.moves.length, 0), 940);
assert.equal(native.segments.reduce((n, p) => n + p.steps.length, 0), 946);
assert.equal(native.segments.reduce((n, p) => n + p.steps.flatMap(s => s.rng || []).length, 0), 16874);
assert.equal(native.segments.reduce((n, p) => n + p.steps.flatMap(s => s.animation_frames || []).length, 0), 42);
assert.equal(recipe.branchAssertions.length, 6);
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(recipe, native), []);
writeFileSync(new URL('reports/preflight.json', root), JSON.stringify({
    beforeGameplayImports: true, sourceMembers: 15, runtimePins: 280,
    sourceSealSHA256: sha(bytes('history/source-SEAL.json')),
    candidateRuntimeSHA256: sha(bytes('runtime.json')), originalBodySHA256: lock.originalBodySHA256,
    rawSHA256: sha(bytes('native.session.json')), recipeSHA256: sha(bytes('recipe.json')),
    source: 'c', version: 5, cases: 6, keys: 940, boundaries: 946, calls: 16874, frames: 42,
    rootMetadataPreserved: true, allFiveFieldsAndPresence: true, keysExact: true,
    primaryAssertions: 6, integrityErrors: [], branchErrors: [], originalDiagnostic: '50/54'
}, null, 2) + '\n', {flag: 'wx'});
