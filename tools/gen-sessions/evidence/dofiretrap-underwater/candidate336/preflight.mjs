// Source, input and original-C checks complete before any dynamic gameplay import.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './tools/gen-sessions/assertions.mjs';

export const root = new URL('./', import.meta.url);
export const sha = value => createHash('sha256').update(value).digest('hex');
const bytes = name => readFileSync(new URL(name, root));
export const read = name => JSON.parse(bytes(name));
const lock = read('pre-edit-lock.json');
for (const [name, digest] of Object.entries(lock.files))
    assert.equal(sha(bytes(name)), digest, name);
const sourceSeal = read('history/source-SEAL.json');
assert.equal(sha(bytes('history/source-MANIFEST.json')), sourceSeal.manifestSHA256);
const sourceManifest = read('history/source-MANIFEST.json');
assert.equal(Object.keys(sourceManifest).length, 33);
for (const [name, digest] of Object.entries(sourceManifest))
    assert.equal(sha(bytes('source/' + name)), digest, name);
const inputLock = read('history/source-input-lock.json');
for (const [name, digest] of Object.entries(inputLock.files))
    assert.equal(sha(bytes('source/' + name)), digest, name);
assert.equal(sha(bytes('history/original-probe.mjs')), inputLock.probeSHA256);
for (const [name, digest] of Object.entries(read('source-pins.json')))
    assert.equal(sha(readFileSync(name)), digest, name);

const baselineRuntime = read('baseline-runtime.json'), runtime = read('runtime.json');
assert.equal(sha(bytes('runtime.json')), lock.candidateRuntimeSHA256);
assert.deepEqual(Object.keys(runtime), Object.keys(baselineRuntime));
assert.deepEqual(Object.keys(runtime).filter(n => runtime[n] !== baselineRuntime[n]), ['js/trap.js']);
for (const [name, digest] of Object.entries(baselineRuntime))
    assert.equal(sha(bytes('source/' + name)), digest, name);
export const verifyRuntime = () => {
    assert.equal(Object.keys(runtime).length, 280);
    for (const [name, digest] of Object.entries(runtime))
        assert.equal(sha(bytes(name)), digest, name);
};
verifyRuntime();
const change = read('planned-change.json');
const before = bytes('source/js/trap.js').toString();
assert.equal(before.split(change.before).length, 2);
assert.equal(bytes('js/trap.js').toString(), before.replace(change.before, change.after));
assert.equal(sha(bytes('scoped-runtime.patch')), lock.patchSHA256);

const correction = read('history/correction-lock.json');
assert.equal(sha(bytes('history/correction-lock.json')), '5a2485d6a023ee95e6a86932ad86ae743e87a1baa438637685a212c67457d7c7');
assert.equal(sha(bytes('history/authoritative-baseline-accounting.json')), correction.authoritativeAccountingSHA256);
assert.ok(correction.beforeC);
assert.ok(correction.createdAt < read('history/parent-recording.json').startedAt);
const body = text => text.slice(text.indexOf('const {runSegment}'),
    text.indexOf('\nverifyRuntime();', text.indexOf('const {runSegment}')));
let correctedBody = body(bytes('history/original-probe.mjs').toString());
assert.equal(sha(correctedBody), lock.originalBodySHA256);
for (const replacement of correction.replacements) {
    assert.equal(correctedBody.split(replacement.before).length, 2);
    correctedBody = correctedBody.replace(replacement.before, replacement.after);
}
assert.equal(body(bytes('probe.mjs').toString()), correctedBody);
assert.equal(sha(correctedBody), lock.correctedBodySHA256);

export const recipe = read('recipe.json'), predictions = read('predictions.json');
assert.deepEqual(recipe, read('history/parent-primary-recipe.json'));
assert.deepEqual(recipe.segments.map(s => inputLock.fields.map(field =>
    ({field, present: Object.hasOwn(s, field), value: s[field]}))), inputLock.tuples);
assert.deepEqual(recipe.segments.map(s => Array.from(s.moves, c => c.charCodeAt(0))), inputLock.keys);
assert.deepEqual(predictions.filter(p => p.negative).map(p => p.index), [2, 3, 4, 5]);
const original = read('history/original-observation.json');
const authoritative = read('history/authoritative-baseline-accounting.json');
assert.equal(original.flatMap(r => r.checks).filter(c => c.pass).length, 88);
assert.equal(authoritative.flatMap(r => r.checks).filter(c => c.pass).length, 90);
const expected = structuredClone(original);
for (const check of expected[4].checks) {
    if (!check.pass) {
        assert.ok(check.name === 'underwater return retains slime apart from elapsed turns; dry fire cures'
            || check.name === 'source trap RNG prefix is preserved without filtering world-turn calls');
        check.pass = true;
        delete check.error;
    }
}
expected[4].source = true;
assert.deepEqual(authoritative, expected);
assert.deepEqual(original.filter(r => r.negative).map(r => ({index: r.index, outputHashes: r.outputHashes})), read('negative-hashes.json'));

export const rawFile = new URL('native.session.json', root);
const native = read('native.session.json');
assert.equal(sha(bytes('native.session.json')), 'd125503c599d02d578681ade762ca7278da2abf4896c4dcff0d4f70e5da053de');
assert.equal(bytes('native.session.json').length, 1208359);
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
assert.equal(recipe.segments.reduce((n, p) => n + p.moves.length, 0), 867);
assert.equal(native.segments.reduce((n, p) => n + p.steps.length, 0), 873);
assert.equal(native.segments.reduce((n, p) => n + p.steps.flatMap(s => s.rng || []).length, 0), 16839);
assert.equal(native.segments.reduce((n, p) => n + p.steps.flatMap(s => s.animation_frames || []).length, 0), 21);
assert.equal(recipe.branchAssertions.length, 6);
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(recipe, native), []);
writeFileSync(new URL('reports/preflight.json', root), JSON.stringify({
    beforeGameplayImports: true, sourceMembers: 33, runtimePins: 280,
    sourceSealSHA256: sha(bytes('history/source-SEAL.json')), correctionLockSHA256: sha(bytes('history/correction-lock.json')),
    candidateRuntimeSHA256: sha(bytes('runtime.json')), rawSHA256: sha(bytes('native.session.json')),
    recipeSHA256: sha(bytes('recipe.json')), originalBodySHA256: lock.originalBodySHA256,
    correctedBodySHA256: lock.correctedBodySHA256, source: 'c', version: 5,
    cases: 6, keys: 867, boundaries: 873, calls: 16839, frames: 21,
    rootMetadataPreserved: true, allFiveFieldsAndPresence: true, keysExact: true,
    primaryAssertions: 6, integrityErrors: [], branchErrors: [],
    originalDiagnostic: '88/102', authoritativeBaselineAccounting: '90/102'
}, null, 2) + '\n', {flag: 'wx'});
