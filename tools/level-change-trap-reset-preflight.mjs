// Shared metadata-only preflight. No game imports or file output.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length <= 3 && !process.argv[2]?.startsWith('-'),
    'usage: gate.mjs [compact-report.json]; selectors are not supported');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const originalPins = {
    "recipe.json": "414d39a8a8b21d7f97993ab89741331fa392b60708f339127ec9ecb4a2a079b0",
    "PLAN.json": "18e70cdbd6c672968460008dae1f92219b83faa3ad6d532a1c8237da2cd6c787",
    "tools/state.mjs": "a387b4554832e5daa6b92f0d4d793dab683544ce3721ba774b65fd235abbbc51",
    "tools/ordinary.mjs": "62230f56bcff5bfae8f8e5162b9c37bd61fabff9425d6341bbc1be572762b276"
};
const historyPins = {
    "proposal-01.json": "684570352b672600c5dfc3bc951e841ffee8053fbbcd9936525576acc28dc0f2",
    "probe-01.json": "962ab717d1351381afa8a3018b84f89ca631738676a626517bcf6c4924651cd2",
    "proposal-02.json": "20da2a13bf3a374560cc71fed93aa9aa788955ac50cf7e163723a9e2e14ae785",
    "probe-02.json": "9594a278fc3f4d432a147f6fc233ef0c93c3cdaa266a6fdd1aa58d66fb2bbbbe",
    "proposal-03.json": "a84052d694aa07d5c7bbc9a7845b8de626e6a97f7746e37ee8504e53042ab054",
    "probe-03.json": "379979931c3423e31f3174e66e6ad10a27619d113351e7a3db5725cbfc46ec19",
    "proposal-04.json": "c7ba9cf12bf1c20d0c4b80d97eecab13ccf33d5812645b3dabb872852fd76bc2",
    "probe-04.json": "80c6230683dbe540818def4195d610e40c2d9c9f941cfb3f4f0a8b627519b152",
    "proposal-05.json": "6b00bd05f4c44d6fbe2f8bcb59a2be6e819edb22ec48e85f0051a10d0df70abc",
    "probe-05.json": "a3a34e001b37c4d7b8b2c6e206da0a8c98c7da45a71f2a73f434d8405a520752",
    "proposal-06.json": "3f213df082cf1ab33a1826827012e1098f1eea52dac0e76a0e662d380a3dfc0b",
    "probe-06.json": "adcec291c122bea8e83cd4323f441783465fdd9e27652bb6d96516c62c20d82f"
};
const evidence = 'gen-sessions/evidence/level-change-trap-reset/';
function pinned(file, digest) {
    const bytes = readFileSync(new URL(file, import.meta.url));
    assert.equal(sha(bytes), digest, 'exact evidence bytes: ' + file);
    return bytes;
}
const original = JSON.parse(pinned(evidence + 'original/recipe.json', originalPins['recipe.json']));
const lock = JSON.parse(pinned(evidence + 'pre-candidate-lock.json', '1ba0a989d93db9709a12600c95fb7974e50f1f7464cd936257a88434fd165fc6'));
assert.deepEqual(lock.files, originalPins, 'original pre-candidate source/input lock');
for (const [file, digest] of Object.entries(originalPins))
    pinned(evidence + 'original/' + file, digest);
assert.equal(lock.negativeCases, 4); assert.equal(lock.negativeHashes, 20);
const recipe = JSON.parse(pinned('gen-sessions/recipes/level-change-trap-reset.json', '953d93a25f2ee73bc4c9259940711f24d269519590e113d0cfc71d4861c234ce'));
const {coverage, ...withoutCoverage} = recipe;
assert.deepEqual(withoutCoverage, original, 'only coverage metadata added to the original recipe');
assert.deepEqual(coverage, ["mode.debug", "turn.occupation-interrupt", "object.tools-containers"]);
assert.equal(recipe.segments.length, 5);
assert.equal(recipe.requireBranchAssertions, true);
assert.equal(recipe.branches.length, 5); assert.equal(recipe.branchAssertions.length, 5);
assert.deepEqual(recipe.branches, recipe.segments.map(p => 'level-change-trap.' + p.name));
assert.deepEqual(recipe.branchAssertions.map(a => [a.branch, a.segment]),
    recipe.branches.map((branch, index) => [branch, index]));
assert.deepEqual(branchAssertionErrors(original), []);
assert.deepEqual(branchAssertionErrors(recipe), []);
const negative = recipe.unchangedOutputHashes;
assert.deepEqual(Object.keys(negative), recipe.segments.slice(1).map(p => p.name));
assert.ok(Object.values(negative).every(v => Object.keys(v).length === 5));
assert.deepEqual(negative, original.unchangedOutputHashes, 'all20 original negative hashes');
const history = {};
for (const [name, digest] of Object.entries(historyPins))
    history[name] = JSON.parse(pinned(evidence + 'history/' + name, digest));
for (let i = 1; i <= 6; ++i) {
    const suffix = String(i).padStart(2, '0') + '.json';
    assert.equal(history['probe-' + suffix].recipeSHA256, historyPins['proposal-' + suffix],
        'each original probe was run on its pinned proposal');
}
assert.deepEqual(history['proposal-06.json'].segments, original.segments,
    'the final ordinary proposal and original locked inputs are unchanged');
const fields = part => ['name','seed','datetime','nethackrc','moves'].map(field =>
    ({field, present: Object.hasOwn(part, field), value: part[field]}));
const tuples = recipe.segments.map(fields);
assert.ok(tuples.every(tuple => tuple.every(f => f.present)), 'all five original fields present');
assert.equal(sha(JSON.stringify(tuples)), 'feac2804f9964261183ae8bf3f6aec849cb1d4c9ae743b2ba97b6955efa62bbb');

const rawBytes = pinned('gen-sessions/generated/level-change-trap-reset.session.json',
    '8e1c68d16e15adb0b33c9fb4d552b6c0c5962489d52c09307629671977600e28');
assert.equal(rawBytes.length, 728222);
const raw = JSON.parse(rawBytes);
assert.equal(raw.source, 'c'); assert.equal(raw.version, 5);
assert.equal(raw.segments.length, 5);
assert.deepEqual(raw.segments.map(fields), tuples, 'all C fields, presence and values');
for (const [i, part] of raw.segments.entries()) {
    assert.ok(Array.isArray(part.steps) && part.steps.length, 'C boundaries mandatory');
    assert.deepEqual(part.steps.map(s => s.key), [null, ...recipe.segments[i].moves],
        'all recorded keys and initial null boundary');
    assert.equal(sha(Buffer.from(part.moves, 'utf8')),
        sha(Buffer.from(recipe.segments[i].moves, 'utf8')), 'input bytes');
}
assert.equal(raw.segments.reduce((n,s) => n + s.moves.length, 0), 159);
assert.equal(raw.segments.reduce((n,s) => n + s.steps.length, 0), 164);
assert.equal(raw.segments.flatMap(s => s.steps).reduce((n,s) => n + (s.rng || []).length, 0), 16004);
assert.equal(raw.segments.flatMap(s => s.steps).reduce((n,s) => n + (s.animation_frames || []).length, 0), 0);
assert.deepEqual(recordingIntegrityErrors(raw), [], 'canonical C recording integrity');
assert.deepEqual(branchAssertionErrors(original, raw), [], 'all five original primary C branches');
assert.deepEqual(branchAssertionErrors(recipe, raw), [], 'all five maintained primary C branches');
