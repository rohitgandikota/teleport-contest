import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const reportPath = process.argv[2];
assert.ok(process.argv.length <= 3, 'optional argument: compact report path');
const root = new URL('../', import.meta.url), js = new URL('js/', root);
const evidence = new URL('tools/gen-sessions/evidence/config-nul-contract/', root);
const sha = value => createHash('sha256').update(value).digest('hex');
const bytes = readFileSync(new URL('original-recipe.json', evidence));
assert.equal(sha(bytes), '2c913699672463ad044a9c09c277b92d2fee0a5af8fb30cb48ca38039dcb2775');
const recipe = JSON.parse(bytes);
const lockBytes = readFileSync(new URL('input-lock.json', evidence));
assert.equal(sha(lockBytes), 'd0e9a81fac019ca0d0ce5cb10f4d5114ffd40a65150927dd59201d4eb2549205');
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
const primaryBytes = readFileSync(new URL('tools/gen-sessions/recipes/config-nul-contract.json', root));
assert.equal(sha(primaryBytes), 'fb29aa4a94ab7ed6e57a43aa49d174a25ccf2860b3fd7560a8b465637f4ef07c');
const primary = JSON.parse(primaryBytes);
const derivationBytes = readFileSync(new URL('primary-derivation.json', evidence));
assert.equal(sha(derivationBytes), 'e4dad99b3f21e8656b21506ebf85066edc8b21116abd4f5401190b349db35ed4');
const derivation = JSON.parse(derivationBytes);
assert.equal(derivation.originalRecipeSHA256, sha(bytes));
assert.equal(derivation.primaryRecipeSHA256, sha(primaryBytes));
assert.equal(derivation.inputLockSHA256, sha(lockBytes));
assert.deepEqual(derivation.preservedKeys, Object.keys(recipe));
assert.ok(Object.keys(derivation.addedMetadata).every(key => !Object.hasOwn(recipe, key)));
assert.deepEqual(primary, {...recipe, ...derivation.addedMetadata});
assert.equal(primary.requireBranchAssertions, true);
assert.equal(primary.branchAssertions.length, 4);
assert.deepEqual(primary.branches, recipe.segments.map(part => `config-nul-contract.${part.name}`));
assert.deepEqual(primary.branchAssertions, recipe.expectations.map((expected, i) => {
    const assertion = {branch: primary.branches[i], segment: i,
        screenCells: [{step: 0, x: 0, y: 1, equals: 'U'}]};
    assertion.screenCells.push({step: 0, x: i < 2 ? 3 : 8, y: i < 2 ? 4 : 12,
        equals: expected.roomOverride === 0 ? '.' : 'Z'});
    if (expected.prefix.length) assertion.rngIncludes = expected.prefix;
    return assertion;
}));
assert.deepEqual(branchAssertionErrors(primary), []);
const canonicalBytes = readFileSync(new URL('canonical-inputs.json', evidence));
assert.equal(sha(canonicalBytes), '6f0d1cc12129d288bfaafbdb64c96b5a4441c9077f78e33dad90b273adbd21fd');
const canonical = JSON.parse(canonicalBytes);
const negativeBytes = readFileSync(new URL('negative-hashes.json', evidence));
assert.equal(sha(negativeBytes), 'e2138cf99c41e1c5796030b4ede5a34e86db471cadd081f6d39d63c21ca458c4');

const gapBytes = readFileSync(new URL('tools/gen-sessions/evidence/config-nul-contract/open-byte-gaps.json', root));
assert.equal(sha(gapBytes), '127fca0e44e1bcaa2c140813c2c4a1e86f3b70ae0ddaa7d0583da30a642b8cd3');
const openGaps = JSON.parse(gapBytes);
assert.equal(openGaps.originalSix.candidateExact, 4);
assert.equal(openGaps.originalSix.cases, 6);
assert.equal(openGaps.originalSix.gateExit, 1);
assert.deepEqual(openGaps.expectedFailures.map(row => row.name),
    ['config-bytes-merged-ascii-cap', 'config-bytes-merged-utf8-cap']);

// Exact original C evidence is mandatory before importing the tested runtime.
const rawBytes = readFileSync(new URL('tools/gen-sessions/generated/config-nul-contract.session.json', root));
assert.equal(sha(rawBytes), 'de9db54ca299824437f0ffe66a24b99418bf68fedb980714c37a62ddf9c0a17e');
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
assert.deepEqual({boundaries, calls, frames, keys}, {boundaries: 16, calls: 11768, frames: 0, keys: 12});
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(primary, native), []);
const nativePreflight = {sha256: sha(rawBytes), version: 5, source: 'c',
    segments: 4, fields: lock.fields, boundaries, calls, frames, keys,
    primaryBranchAssertions: 4, integrityErrors: [], branchErrors: []};
const {runSegment} = await import(new URL('jsmain.js', js));
const {InMemoryStorage} = await import(new URL('storage.js', js));
const symbols = await import(new URL('symbols.js', js));
const {outputs, hashes, deferred} = await import(new URL('tools/half-damage-reader-observe.mjs', root));
const room = symbols.match_sym('S_room'); assert.ok(room);
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
                    unexplored: symbols.get_othersym(symbols.SYM_UNEXPLORED, symbols.PRIMARYSET),
                    roomOverride: symbols.go_ov_primary_syms[room.idx] || 0});
            }};
            output = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
        } finally {
            if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), prior);
        const plain = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
        const late = await deferred(part);
        if (!references.has(expected.reference))
            references.set(expected.reference, outputs(await runSegment({...canonical[expected.reference], storage: new InMemoryStorage()})));
        const reference = references.get(expected.reference);
        check('all keys and observer/plain/deferred all-five equality', () => {
            assert.deepEqual(output, plain); assert.deepEqual(output, late);
            assert.deepEqual(output.slices.flat(), output.calls);
            for (const key of ['screens', 'cursors', 'slices', 'frames']) assert.equal(output[key].length, part.moves.length + 1);
            assert.equal(states.length, part.moves.length + 1);
        });
        check('no collected parser error or unhandled statement', () => {
            assert.ok(states.every(state => !state.errors.length && !state.unhandled.length));
        });
        check('C-predicted real symbol override state', () => {
            assert.ok(states.every(state => state.unexplored === 85));
            assert.ok(states.every(state => state.roomOverride === expected.roomOverride));
        });
        if (expected.prefix.length) check('original choice prefix preserved before gameplay', () => {
            assert.deepEqual(output.calls.slice(0, expected.prefix.length), expected.prefix);
            assert.deepEqual(output.slices[0].slice(0, expected.prefix.length), expected.prefix);
        });
        check('all-five equality to source-predicted short canonical input', () => assert.deepEqual(output, reference));
        const gotHashes = hashes(output), referenceHashes = hashes(reference);
        rows.push({name: part.name, positive: expected.positive, pass: checks.every(c => c.pass), checks,
            hashes: gotHashes, referenceHashes,
            changedStreams: Object.keys(gotHashes).filter(k => gotHashes[k] !== referenceHashes[k]),
            boundaries: output.screens.length, calls: output.calls.length, frames: output.frames.flat().length,
            firstState: states[0]});
    }
    const report = {classification: 'Additional fixed controls; UTF8 inequality/equality and NUL continuation', nativePreflight,
        primaryRecipeSHA256: sha(primaryBytes), openGapManifestSHA256: sha(gapBytes),
        recipeSHA256: sha(bytes), total: rows.length, passed: rows.filter(row => row.pass).length, rows};
    const controls = rows.filter(row => !row.positive);
    assert.equal(controls.length, 2); assert.ok(controls.every(row => row.pass));
    {
        const negatives = JSON.parse(negativeBytes).controls;
        assert.equal(negatives.length, 2);
        for (const control of negatives) {
            assert.deepEqual(Object.keys(control.hashes).sort(), ['calls', 'cursors', 'frames', 'screens', 'slices']);
            assert.deepEqual(rows.find(row => row.name === control.name).hashes, control.hashes);
        }
    }
    if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({passed: report.passed, total: report.total,
        fullByteContract: 'open, original6 remains4/6 exit1'}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
