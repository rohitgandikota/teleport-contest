// Shared metadata-only preflight. No game imports or default file output.
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length <= 3
    && (process.argv[2] === undefined || (process.argv[2] && !process.argv[2].startsWith('-'))),
    'usage: gate.mjs [compact-report.json]; selectors are not supported');
export const reportPath = process.argv[2] || null;
assert.ok(!reportPath || !existsSync(reportPath), 'compact report path must be new');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const evidence = 'gen-sessions/evidence/guard-cleanup-prompt/';
const pins = {
    "README.md": "66f3d1e4525bbd8f35d99ff6db95198ccd7d2236d5645fe9aaa21241958ea694",
    "await-pre-candidate-lock.json": "a83ff0208d178e0dbc08c844a72fa0ecdb2dc2ebada030a462e132c9b191e378",
    "cleanup-pre-candidate-lock.json": "fead85bb1605ba12243c521927177a9b2389a75bd404c77a33987c21b35c4683",
    "history/await-baseline31.json": "a82be8c22575e1f3b8b643e620852cd6f2687dc81a2e5cc05e4e7a9f1a6bd9b0",
    "history/await-candidate39.json": "79ffa50cee5cd1123c225c5d75e10aa7a92ea5dc6463ff396179ab91f06c7b0d",
    "history/await-initial-body.mjs": "6da316e0b3b9df2a9f459ac350094b5960f70d25f8ef17573ac40755cf661984",
    "history/feedback-premise.md": "15734dc33b1df915f36b002cfd8894e10e2449654450d0b5cb9b48118d57f3f6",
    "history/ordinary-control-derivation.json": "3fb201fcb1f81468ca8ac096d0cd70f82c8e78385284ea14575ca6b86b0cfd94",
    "history/ordinary-control-premise.patch": "8d28e92b29ae6ec853c6d2f3e5c3362693e93f3ee8ab074b1d740d564f843144",
    "history/original23-controls25.json": "5464e910866d7562cc05ba351c1202cb35d37daa38f54132d2e443a5f4045114",
    "input-lock.json": "92991e901984e5a9a9957f872c355eb7386ab297c4dd97ffda8eb440ef618c73",
    "original/escape.mjs": "1cc4df850c91a5cf4ef3be01469e427da959c21369e514be77a21d4b6cfb1494",
    "original/ordinary.mjs": "c80cea6236e2f25d05170a1e49c5006fa0564842a3ecd1bdcb594638b729c5d4",
    "original/source.mjs": "ee121bb0250b347606d9c078c39e38d15897df3531947a061d659767467e395d",
    "original-proposals.json": "340be103d5c2a319564a7c818e6e11cc4ae2081e2c1be0bf2de2623829bd76d6",
    "probe-01.json": "4d432621bfbaa455a6be536c35d37092730aa504cbb5f73a9650b1107a647e98"
};
function pinned(file, digest) {
    const bytes = readFileSync(new URL(file, import.meta.url));
    assert.equal(sha(bytes), digest, 'exact evidence bytes: ' + file);
    return bytes;
}
for (const [file, digest] of Object.entries(pins))
    pinned(evidence + file, digest);
const json = file => JSON.parse(pinned(evidence + file, pins[file]));

// Stable metadata/observer dependencies, checked before game imports.
pinned('gen-sessions/assertions.mjs', 'aed2dfe01e18cb2e8b0d62e389ab9d8a9c02b0e3e98d4e427fcead4c228e3adc');
pinned('gen-sessions/screen-decode.mjs', '0831fd4db121dab1d3c8f80efac29c68ce50f67fedbb49f2bd7c21371244dae0');
pinned('half-damage-reader-observe.mjs', '201cdafe4409d5d58414c1d0ebc0449c32b29834cdf35c72c151a555d9031d07');

const lock = json('input-lock.json');
const recipe = JSON.parse(pinned('gen-sessions/recipes/guard-cleanup-prompt.json',
    'f9918a947a5cc009eb7985efb92042e78d8e896b41d1b05ecab072c839b652af'));
assert.equal(lock.recipeSHA256, 'f9918a947a5cc009eb7985efb92042e78d8e896b41d1b05ecab072c839b652af');
assert.equal(recipe.name, 'guard-cleanup-prompt');
assert.equal(recipe.segments.length, 5);
assert.deepEqual(recipe.segments, json('original-proposals.json').segments);
assert.deepEqual(lock.inputFields, ['name','seed','datetime','nethackrc','moves']);
const fields = part => Object.fromEntries(lock.inputFields.map(field =>
    [field, {present: Object.hasOwn(part, field), value: part[field]}]));
const tuples = recipe.segments.map(fields);
assert.ok(tuples.every(tuple => Object.values(tuple).every(f => f.present)),
    'all five original fields present');
assert.deepEqual(tuples, lock.tuples, 'original values and field presence');
assert.equal(sha(JSON.stringify(tuples)), 'fc19347a713fe57d054bdf5f295787929458d414713919cc32c9e2f6302fef72');
assert.equal(lock.tupleSHA256, 'fc19347a713fe57d054bdf5f295787929458d414713919cc32c9e2f6302fef72');
assert.equal(lock.cases, 5); assert.equal(lock.keys, 1004); assert.equal(lock.boundaries, 1009);
assert.deepEqual(Object.keys(lock.negativeHashes), recipe.segments.slice(3).map(p => p.name));
const probe = json('probe-01.json').results;
assert.equal(probe.length, 5);
for (const [i, part] of recipe.segments.entries()) {
    assert.equal(probe[i].name, part.name);
    if (i >= 3) {
        const hashes = lock.negativeHashes[part.name];
        assert.deepEqual(Object.keys(hashes), ['screens','cursors','calls','slices','frames']);
        assert.deepEqual(hashes, probe[i].hashes, 'all ten original negative hashes');
        assert.deepEqual(hashes, probe[0].prefix187Hashes, 'unchanged prefix negative');
    }
}
const awaitLock = json('await-pre-candidate-lock.json');
const cleanupLock = json('cleanup-pre-candidate-lock.json');
assert.equal(awaitLock.candidateExisted, false); assert.equal(cleanupLock.candidateExisted, false);
assert.equal(awaitLock.files['evidence/input-lock.json'].sha256, pins['input-lock.json']);
assert.equal(cleanupLock.files['evidence/input-lock.json'].sha256, pins['input-lock.json']);
assert.equal(awaitLock.files['tools/ordinary-controls.mjs'].sha256, pins['history/await-initial-body.mjs']);
assert.equal(cleanupLock.files['tools/ordinary-controls-validated.mjs'].sha256, pins['original/ordinary.mjs']);
assert.equal(cleanupLock.baselinePolicy, '3/5');
assert.equal(cleanupLock.baselineMapSHA256, '301f03d938470072506c81b71b536b3be5a306ad9a820de4e1a8213f3f342271');
const originalFailures = json('history/original23-controls25.json');
const initialBaseline = json('history/await-baseline31.json');
const initialCandidate = json('history/await-candidate39.json');
assert.deepEqual([originalFailures.passed, originalFailures.total], [25,30]);
assert.deepEqual([initialBaseline.passed, initialBaseline.total], [31,40]);
assert.deepEqual([initialCandidate.passed, initialCandidate.total], [39,40]);
assert.deepEqual(initialCandidate.results.filter(r => !r.pass).map(r => r.name),
    ['guard-cleanup-stop: all diagnostic lines precede resumed command']);
const derivation = json('history/ordinary-control-derivation.json');
assert.equal(derivation.originalSHA256, pins['history/await-initial-body.mjs']);
assert.equal(derivation.derivedSHA256, pins['original/ordinary.mjs']);
assert.equal(derivation.recipeSHA256, lock.recipeSHA256);
assert.equal(derivation.unchangedCheckFamilies, 7);
assert.equal(derivation.correctedCheckFamilies, 1);
assert.equal(derivation.unchangedPolicyFamily, true);
assert.equal(recipe.requireBranchAssertions, true);
assert.equal(recipe.branches.length, 5); assert.equal(recipe.branchAssertions.length, 5);
assert.deepEqual(recipe.branchAssertions.map(a => [a.branch, a.segment]),
    recipe.branches.map((branch, index) => [branch, index]));
assert.deepEqual(branchAssertionErrors(recipe), [], 'all original primary branch declarations');

const rawBytes = pinned('gen-sessions/generated/guard-cleanup-prompt.session.json',
    'fc19509383920053b46ababaa4f8d25264a29a562e4d93392529db670e6c9218');
assert.equal(rawBytes.length, 4211305);
const raw = JSON.parse(rawBytes);
assert.equal(raw.source, 'c'); assert.equal(raw.version, 5);
assert.equal(raw.segments.length, 5);
assert.deepEqual(raw.segments.map(fields), tuples, 'all C/input fields, presence and values');
for (const [i, part] of raw.segments.entries()) {
    assert.ok(Array.isArray(part.steps) && part.steps.length, 'C boundaries required');
    assert.deepEqual(part.steps.map(s => s.key), [null, ...recipe.segments[i].moves],
        'all recorded keys including initial null boundary');
    assert.equal(sha(Buffer.from(part.moves, 'utf8')),
        sha(Buffer.from(recipe.segments[i].moves, 'utf8')), 'exact input bytes');
}
assert.equal(raw.segments.reduce((n,s) => n + s.moves.length, 0), 1004);
assert.equal(raw.segments.reduce((n,s) => n + s.steps.length, 0), 1009);
assert.equal(raw.segments.flatMap(s => s.steps).reduce((n,s) => n + (s.rng || []).length, 0), 32501);
assert.equal(raw.segments.flatMap(s => s.steps).reduce((n,s) => n + (s.animation_frames || []).length, 0), 0);
assert.deepEqual(recordingIntegrityErrors(raw), [], 'canonical C recording integrity');
assert.deepEqual(branchAssertionErrors(recipe, raw), [], 'all five original primary C branches');
export const nativeEvidence = {source:'c', version:5,
    sha256:'fc19509383920053b46ababaa4f8d25264a29a562e4d93392529db670e6c9218',
    cases:5, keys:1004, boundaries:1009, calls:32501, frames:0, branches:5};
