import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';

const reportPath = process.argv[2];
assert.ok(process.argv.length <= 3, 'optional argument: compact report path');
const root = new URL('../', import.meta.url), js = new URL('js/', root);
const evidence = new URL('tools/gen-sessions/evidence/config-section-composition-contract/', root);
const sha = value => createHash('sha256').update(value).digest('hex');
const bytes = readFileSync(new URL('original-recipe.json', evidence));
assert.equal(sha(bytes), '0a591a546c1e7d59903220f98cc87d5eab0c07411bbfa6b22fc1d91623f2e5a6');
const recipe = JSON.parse(bytes);
const lockBytes = readFileSync(new URL('input-lock.json', evidence));
assert.equal(sha(lockBytes), '2e5f0b645e26320486a43c27f61792220c3d4a4ada66b38a357473d3d856e08c');
const lock = JSON.parse(lockBytes);
assert.equal(lock.recipeSHA256, sha(bytes));
assert.deepEqual(lock.fields, ['seed', 'datetime', 'nethackrc', 'moves', 'name']);
assert.equal(recipe.segments.length, 4);
assert.equal(recipe.expectations.length, 4);
assert.equal(lock.segments.length, 4);
const tuples = recipe.segments.map((part, i) => {
    const tuple = lock.fields.map(field => {
        assert.ok(Object.hasOwn(part, field)); return [field, part[field]];
    });
    assert.equal(sha(JSON.stringify(tuple)), lock.segments[i].inputSHA256);
    assert.equal(part.name, lock.segments[i].name);
    assert.equal(part.name, recipe.expectations[i].name);
    assert.equal(part.moves.length, lock.segments[i].keys);
    return tuple;
});
assert.equal(sha(JSON.stringify(tuples)), lock.inputFieldsSHA256);
const primaryBytes = readFileSync(new URL('tools/gen-sessions/recipes/config-section-composition-contract.json', root));
assert.equal(sha(primaryBytes), '6372c3ce0636f3f7e8a2e2048548f380cd5094f967e0864f23dbe650787a64b2');
const primary = JSON.parse(primaryBytes);
const derivationBytes = readFileSync(new URL('primary-derivation.json', evidence));
assert.equal(sha(derivationBytes), '2c8b8e92f7e5e8bcdcd7d38f31259e6b2d8de83977c2608bd974a086661c6f6e');
const derivation = JSON.parse(derivationBytes);
assert.equal(derivation.originalRecipeSHA256, sha(bytes));
assert.equal(derivation.primaryRecipeSHA256, sha(primaryBytes));
assert.equal(derivation.inputLockSHA256, sha(lockBytes));
assert.deepEqual(derivation.preservedKeys, Object.keys(recipe));
assert.ok(Object.keys(derivation.addedMetadata).every(key => !Object.hasOwn(recipe, key)));
assert.deepEqual(primary, {...recipe, ...derivation.addedMetadata});
assert.equal(primary.requireBranchAssertions, true);
assert.equal(primary.branchAssertions.length, 4);
assert.deepEqual(primary.branches, recipe.segments.map(part => `config-section-composition-contract.${part.name}`));
assert.deepEqual(primary.branchAssertions, recipe.expectations.map((expected, i) => {
    const assertion = {branch: primary.branches[i], segment: i,
        screenCells: [{step: 0, x: 0, y: 1, equals: 'U'}]};

    if (expected.prefix.length) assertion.rngIncludes = expected.prefix;
    return assertion;
}));
assert.deepEqual(branchAssertionErrors(primary), []);
const canonicalBytes = readFileSync(new URL('canonical-section-inputs.json', evidence));
assert.equal(sha(canonicalBytes), 'a0d882c6fea50b0a3b25f9d3137d86b85eb815d005054ae04c5aaf92f00c1df8');
const canonical = JSON.parse(canonicalBytes).segments;
const negativeBytes = readFileSync(new URL('section-negative-hashes.json', evidence));
assert.equal(sha(negativeBytes), 'a34972ada8c10d2daa11b16361182e53b6878517da6a8d5b0406b4428a2e6e32');
const negatives = JSON.parse(negativeBytes).controls;
const gapBytes = readFileSync(new URL('tools/gen-sessions/evidence/config-nul-contract/open-byte-gaps.json', root));
assert.equal(sha(gapBytes), '127fca0e44e1bcaa2c140813c2c4a1e86f3b70ae0ddaa7d0583da30a642b8cd3');
const openGaps = JSON.parse(gapBytes);
assert.equal(openGaps.originalSix.candidateExact, 4);
assert.equal(openGaps.originalSix.cases, 6);
assert.equal(openGaps.originalSix.gateExit, 1);
assert.deepEqual(openGaps.expectedFailures.map(row => row.name),
    ['config-bytes-merged-ascii-cap', 'config-bytes-merged-utf8-cap']);

// Exact original C evidence is mandatory before importing the tested runtime.
const rawBytes = readFileSync(new URL('tools/gen-sessions/generated/config-section-composition-contract.session.json', root));
assert.equal(sha(rawBytes), 'ef77b5add50c5c8e55a8e638a3324b1f8498717238f4fa4f06f9ddbf6895e132');
const native = JSON.parse(rawBytes);
assert.equal(native.version, 5);
assert.equal(native.source, 'c');
assert.ok(Array.isArray(native.segments));
assert.equal(native.segments.length, 4);
let boundaries = 0, calls = 0, frames = 0, keys = 0;
for (const [i, segment] of native.segments.entries()) {
    for (const field of lock.fields) {
        assert.ok(Object.hasOwn(segment, field), `native ${i}: missing ${field}`);
        assert.deepEqual(segment[field], recipe.segments[i][field], `native ${i}: ${field}`);
    }
    assert.ok(Array.isArray(segment.steps));
    assert.equal(segment.steps.length, segment.moves.length + 1);
    keys += segment.moves.length;
    for (const [stepIndex, step] of segment.steps.entries()) {
        assert.ok(Object.hasOwn(step, 'key'));
        assert.equal(step.key, stepIndex ? segment.moves[stepIndex - 1] : null);
        assert.equal(typeof step.screen, 'string');
        assert.ok(Array.isArray(step.cursor) && step.cursor.length === 3);
        assert.ok(Array.isArray(step.rng) && step.rng.every(call => typeof call === 'string'));
        if (Object.hasOwn(step, 'animation_frames')) assert.ok(Array.isArray(step.animation_frames));
        boundaries++;
        calls += step.rng.length;
        frames += (step.animation_frames || []).length;
    }
    for (const [j, prefix] of recipe.expectations[i].prefix.entries()) {
        const call = segment.steps[0].rng[j];
        assert.ok(call === prefix || call?.startsWith(prefix + ' @ '), 'C CHOOSE prefix precedes gameplay');
    }
}
assert.deepEqual({boundaries, calls, frames, keys}, {boundaries: 16, calls: 11574, frames: 0, keys: 12});
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(primary, native), []);
const nativePreflight = {sha256: sha(rawBytes), version: 5, source: 'c',
    segments: 4, fields: lock.fields, boundaries, calls, frames, keys,
    primaryBranchAssertions: 4, integrityErrors: [], branchErrors: []};
const {runSegment} = await import(new URL('jsmain.js', js));
const {InMemoryStorage} = await import(new URL('storage.js', js));
const symbols = await import(new URL('symbols.js', js));
const {outputs, hashes, deferred} = await import(new URL('tools/half-damage-reader-observe.mjs', root));
const deadline = setTimeout(() => process.exit(2), 55000);
const rows = [], references = new Map();
try {
    for (const [index, part] of recipe.segments.entries()) {
        const expected = recipe.expectations[index], states = [], checks = [];
        const check = (name, fn) => {
            try { fn(); checks.push({name, pass: true}); }
            catch (error) { checks.push({name, pass: false, error: error.message.slice(0, 700)}); }
        };
        const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        let output;
        try {
            globalThis.__step_snapshot = {step: '*', cb(g, step) {
                states.push({step, errors: [...g.rc.errors], unhandled: [...g.rc.unhandled],
                    symbol: String.fromCharCode(symbols.get_othersym(symbols.SYM_UNEXPLORED, symbols.PRIMARYSET))});
            }};
            output = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
        } finally {
            if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), prior);
        const plain = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
        const late = await deferred(part);
        if (!references.has(expected.canonicalReference)) {
            const reference = canonical.find(value => value.name === expected.canonicalReference);
            assert.ok(reference);
            references.set(reference.name, outputs(await runSegment({...reference, storage: new InMemoryStorage()})));
        }
        const reference = references.get(expected.canonicalReference);
        check('all keys and observer/plain/deferred all-five equality', () => {
            assert.deepEqual(output, plain); assert.deepEqual(output, late);
            assert.deepEqual(output.slices.flat(), output.calls);
            for (const key of ['screens', 'cursors', 'slices', 'frames']) assert.equal(output[key].length, part.moves.length + 1);
            assert.equal(states.length, part.moves.length + 1);
        });
        check('real selected map effect without errors', () => {
            assert.ok(states.every(state => !state.errors.length && !state.unhandled.length && state.symbol === expected.symbol));
            assert.equal(renderCell(decodeScreen(output.screens[0])[1][0]), expected.symbol);
        });
        check('all-five equality to explicit noncontinued canonical input', () => assert.deepEqual(output, reference));
        if (expected.prefix.length)
            check('single CHOOSE draw retained before gameplay', () => {
                assert.deepEqual(output.calls.slice(0, expected.prefix.length), expected.prefix);
                assert.deepEqual(output.slices[0].slice(0, expected.prefix.length), expected.prefix);
            });
        const negative = negatives.find(value => value.name === expected.canonicalReference);
        if (negative) check('original canonical negative all-five hashes unchanged', () => {
            assert.deepEqual(Object.keys(negative.hashes).sort(), ['calls', 'cursors', 'frames', 'screens', 'slices']);
            assert.deepEqual(hashes(output), negative.hashes);
        });
        rows.push({name: part.name, pass: checks.every(c => c.pass), checks, hashes: hashes(output),
            boundaries: output.screens.length, calls: output.calls.length, frames: output.frames.flat().length,
            firstCalls: output.calls.slice(0, 3), firstState: states[0]});
    }
    const report = {classification: 'Section/continuation regression-only, no NUL improvement attributed', nativePreflight,
        primaryRecipeSHA256: sha(primaryBytes), openGapManifestSHA256: sha(gapBytes),
        recipeSHA256: sha(bytes), total: rows.length, passed: rows.filter(row => row.pass).length, rows};
    if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({passed: report.passed, total: report.total, classification: 'regression-only'}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
