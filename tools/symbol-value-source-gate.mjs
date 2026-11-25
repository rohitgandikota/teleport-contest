import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const reportPath = process.argv[2];
assert.ok(process.argv.length <= 3, 'optional argument: compact report path');
const root = new URL('../', import.meta.url), js = new URL('js/', root);
const evidence = new URL('tools/gen-sessions/evidence/symbol-value-contract/', root);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const recipeBytes = readFileSync(new URL('original-recipe.json', evidence));
assert.equal(sha(recipeBytes), 'e81b47816c4b088074825e7ac4c6ec498ac8bace0d02177801e5bd2dc080cf5a');
const recipe = JSON.parse(recipeBytes);
const lockBytes = readFileSync(new URL('input-lock.json', evidence));
assert.equal(sha(lockBytes), 'c2cf9b3a6e64817b0e3727b40c3cf29e0c18331c0c8dcd4a29f484b44f0951b9');
const lock = JSON.parse(lockBytes);
assert.equal(lock.recipeSHA256, sha(recipeBytes));
assert.deepEqual(lock.fields, ['seed', 'datetime', 'nethackrc', 'moves', 'name']);
assert.equal(recipe.segments.length, 4);
assert.equal(recipe.expectations.length, 4);
assert.equal(lock.segments.length, 4);
const tuples = recipe.segments.map((part, i) => {
    const tuple = lock.fields.map(field => {
        assert.ok(Object.hasOwn(part, field)); return [field, part[field]];
    });
    assert.equal(sha(JSON.stringify(tuple)), lock.segments[i].inputSHA256);
    assert.equal(part.name, recipe.expectations[i].name);
    assert.equal(part.name, lock.segments[i].name);
    assert.equal(part.moves.length, lock.segments[i].keys);
    return tuple;
});
assert.equal(sha(JSON.stringify(tuples)), lock.inputFieldsSHA256);
const primaryBytes = readFileSync(new URL('tools/gen-sessions/recipes/symbol-value-contract.json', root));
assert.equal(sha(primaryBytes), '565ad0da22c4d1cbcb78b44aff6efaafc74a7a59416fd995c667ebf59ca8c6cd');
const primary = JSON.parse(primaryBytes);
const derivationBytes = readFileSync(new URL('primary-derivation.json', evidence));
assert.equal(sha(derivationBytes), 'de8a8a1b901ee5bbbdce193646913d6d912e9260c012db8c5746f8f88d11b159');
const derivation = JSON.parse(derivationBytes);
assert.equal(derivation.originalRecipeSHA256, sha(recipeBytes));
assert.equal(derivation.primaryRecipeSHA256, sha(primaryBytes));
assert.equal(derivation.inputLockSHA256, sha(lockBytes));
assert.deepEqual(derivation.preservedKeys, Object.keys(recipe));
assert.ok(Object.keys(derivation.addedMetadata).every(key => !Object.hasOwn(recipe, key)));
assert.deepEqual(primary, {...recipe, ...derivation.addedMetadata});
assert.equal(primary.requireBranchAssertions, true);
assert.equal(primary.branchAssertions.length, 4);
assert.deepEqual(primary.branches, recipe.segments.map(part => `symbol-value-contract.${part.name}`));
assert.deepEqual(primary.branchAssertions, recipe.expectations.map((expected, i) => ({
    branch: primary.branches[i], segment: i,
    screenCells: [{step: 0, x: expected.firstRoomCell.x, y: expected.firstRoomCell.y,
        equals: expected.firstRoomCell.ch}],
})));
assert.deepEqual(branchAssertionErrors(primary), []);
const canonicalBytes = readFileSync(new URL('canonical-inputs.json', evidence));
assert.equal(sha(canonicalBytes), '486cbcead3ffd4563147eddf8d92c6c3f03ad4651a67df8c2c145f9d1d928512');
const canonical = JSON.parse(canonicalBytes);
const negativeBytes = readFileSync(new URL('negative-hashes.json', evidence));
assert.equal(sha(negativeBytes), '247e0ef65ad6f099ba895a1566775bed0cc8e7d9923543158dafde43e426392a');
const gapBytes = readFileSync(new URL('open-failures.json', evidence));
assert.equal(sha(gapBytes), '433150666d7a0dc031ebaefff515a39e5c24a6ff111993f409b6ace66b931d51');
const openGaps = JSON.parse(gapBytes);
assert.equal(openGaps.originalNine.cases, 9);
assert.equal(openGaps.originalNine.nativeCandidateExact, 7);
assert.equal(openGaps.originalNine.candidateExit, 1);
assert.equal(openGaps.originalNine.failedNegativeMetadataPreserved, true);
assert.equal(openGaps.originalSix.cases, 6);
assert.equal(openGaps.originalSix.nativeCandidateExact, 4);
assert.equal(openGaps.originalSix.candidateExit, 1);
assert.equal(openGaps.unchangedOriginalNegativeHashes, 55);
assert.deepEqual(openGaps.expectedFailures.map(row => row.name), [
    'reader-fruit-utf8-bytes', 'reader-fruit-partial-byte-limit-negative',
    'config-bytes-merged-ascii-cap', 'config-bytes-merged-utf8-cap',
]);
const provenanceBytes = readFileSync(new URL('native-provenance.json', evidence));
assert.equal(sha(provenanceBytes), 'a6931c4548cad6f7f4f36a226c34cb1b9023823b2453ec3ba64495e59b40e494');
const provenance = JSON.parse(provenanceBytes);
const recordingBytes = readFileSync(new URL('parent-recording.json', evidence));
assert.equal(sha(recordingBytes), '33acbd018dc92767c54c30221142bf6a57fee32e1570b2293652648f06993197');
const recording = JSON.parse(recordingBytes);
assert.equal(provenance.recording.sha256, sha(recordingBytes));
assert.equal(provenance.inputLock.sha256, sha(lockBytes));
assert.equal(recording.sealSha256, sha(lockBytes));
assert.equal(recording.inputSha256, provenance.inputMinimal.sha256);

// Exact original C evidence is mandatory before importing the tested runtime.
const rawBytes = readFileSync(new URL('tools/gen-sessions/generated/symbol-value-contract.session.json', root));
assert.equal(sha(rawBytes), 'd792d4da09f7d58cf0798b330bd059dae932e3d41d73340f09738f868624e357');
assert.equal(rawBytes.length, 507861);
assert.equal(provenance.raw.sha256, sha(rawBytes));
assert.equal(recording.rawSha256, sha(rawBytes));
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
        assert.ok(Array.isArray(step.cursor) && step.cursor.length === 3 && step.cursor.every(Number.isInteger));
        assert.ok(Array.isArray(step.rng) && step.rng.every(call => typeof call === 'string'));
        if (Object.hasOwn(step, 'animation_frames')) assert.ok(Array.isArray(step.animation_frames));
        boundaries++;
        calls += step.rng.length;
        frames += (step.animation_frames || []).length;
    }
}
assert.deepEqual({boundaries, calls, frames, keys}, {boundaries: 16, calls: 12156, frames: 0, keys: 12});
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(primary, native), []);
assert.deepEqual(native.segments[0].steps, native.segments[2].steps);
assert.deepEqual(native.segments[1].steps, native.segments[2].steps);
assert.notDeepEqual(native.segments[3].steps, native.segments[2].steps);
const nativePreflight = {sha256: sha(rawBytes), version: 5, source: 'c',
    segments: 4, fields: lock.fields, boundaries, calls, frames, keys,
    primaryBranchAssertions: 4, firstThreeEntireStepArraysEqual: true,
    integrityErrors: [], branchErrors: []};
await import(new URL('jsmain.js', js));
const symbols = await import(new URL('symbols.js', js));
const state = await import(new URL('gstate.js', js));
const {txt2key} = await import(new URL('options.js', js));
const deadline = setTimeout(() => process.exit(2), 55000);
const rows = [];
function check(name, fn) {
    try { fn(); rows.push({name, pass: true}); }
    catch (error) { rows.push({name, pass: false, error: error.message.slice(0, 700)}); }
}
function reset() {
    state.resetGame();
    symbols.clear_symsetentry(symbols.PRIMARYSET, true);
    symbols.clear_symsetentry(symbols.ROGUESET, true);
    symbols.init_symbols();
    symbols.savedsym_free();
}

// src/options.c:9385, QBUFSZ=128, signed-char return proven in the pinned binary.
// These are constructed helper/limit controls, separate from native ordinary9.
const values = [
    ['empty', '', 0], ['space', ' ', 0], ['tab', '\t', 0],
    ['ASCII-single', 'A', 65], ['ASCII-multiple', 'AB', 65],
    ['NUL-first', '\0é', 0], ['NUL-after-space', ' \0Z', 0],
    ['NUL-after-quote', "'\0A'", 39], ['NUL-after-ASCII', 'A\0B', 65],
    ['UTF8-two-byte', 'é', -61], ['UTF8-three-byte', '€', -30],
    ['UTF8-four-byte', '😀', -16], ['non-ASCII-space-is-byte', '\u00a0', -62],
    ['single-quote-character', "'", 39], ['simple-quoted-ASCII', "'A'", 65],
    ['triple-quote', "'''", 39], ['simple-quoted-backslash', "'\\'", 92],
    ['escaped-quote', "'\\''", 39], ['escaped-double-quote', "'\\\"'", 34],
    ['quoted-UTF8', "'é'", -61], ['unclosed-quote', "'é", 0],
    ['ASCII-closing-quote-fits127', "'" + 'A'.repeat(126) + "'", 65],
    ['ASCII-closing-quote-beyond127', "'" + 'A'.repeat(127) + "'", 0],
    ['UTF8-closing-quote-fits127', "'" + 'é'.repeat(63) + "'", -61],
    ['UTF8-closing-quote-beyond127', "'" + 'é'.repeat(64) + "'", 0],
    ['decimal-127', '\\127', 127], ['decimal-128', '\\128', -128],
    ['decimal-195', '\\195', -61], ['decimal-255', '\\255', -1],
    ['hex-byte', '\\xE9', -23], ['octal-byte', '\\o377', -1],
    ['meta-byte', '\\MA', -63], ['control-byte', '^A', 1],
    ['C-newline-escape', '\\n', 10], ['trailing-backslash', '\\', 92],
];

try {
    for (const [name, value, expected] of values)
        check(`sym_val/${name}`, () => assert.equal(symbols.sym_val(value), expected));
    const room = symbols.match_sym('S_room'); assert.ok(room);
    // src/symbols.c:295-317, all four actual nhsym destinations are uchar.
    for (const [setter, array] of [
        ['update_ov_primary_symset', 'go_ov_primary_syms'],
        ['update_ov_rogue_symset', 'go_ov_rogue_syms'],
        ['update_primary_symset', 'gp_primary_syms'],
        ['update_rogue_symset', 'gr_rogue_syms'],
    ]) {
        for (const [label, value, expected] of [['signed-byte', -61, 195], ['ASCII-negative', 65, 65]])
            check(`${setter}/${label}`, () => {
                reset(); symbols[setter](room, value);
                assert.equal(symbols[array][room.idx], expected);
            });
    }
    for (const which of [symbols.PRIMARYSET, symbols.ROGUESET]) {
        const override = which === symbols.PRIMARYSET ? 'go_ov_primary_syms' : 'go_ov_rogue_syms';
        const loaded = which === symbols.PRIMARYSET ? 'gp_primary_syms' : 'gr_rogue_syms';
        check(`parsesymbols/${which}/literal-byte`, () => {
            reset(); assert.equal(symbols.parsesymbols('S_room:é', which), true);
            assert.equal(symbols[override][room.idx], 195);
        });
        check(`parsesymbols/${which}/decimal-negative`, () => {
            reset(); assert.equal(symbols.parsesymbols('S_room:\\195', which), true);
            assert.equal(symbols[override][room.idx], 195);
        });
        check(`parse_sym_line/${which}/real-start-and-value`, () => {
            reset(); symbols.gs_symset[which].name = 'ByteProbe';
            assert.equal(symbols.parse_sym_line('start:ByteProbe', which), 1);
            assert.equal(symbols.parse_sym_line('S_room:é', which), 1);
            assert.equal(symbols[loaded][room.idx], 195);
            assert.equal(symbols.parse_sym_line('finish', which), 1);
        });
    }
    for (const [value, expected] of [['M-Ā', 68], ['\\195', 195], ['~', 126]])
        check(`existing-txt2key/${JSON.stringify(value)}`, () => assert.equal(txt2key(value), expected));
    const report = {classification: 'Constructed source controls, not ordinary reach. No mocks or new runtime exports.',
        nativePreflight, primaryRecipeSHA256: sha(primaryBytes), openGapManifestSHA256: sha(gapBytes),
        total: rows.length, passed: rows.filter(row => row.pass).length, rows,
        symbolsSHA256: createHash('sha256').update(readFileSync(new URL('symbols.js', js))).digest('hex')};
    if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({passed: report.passed, total: report.total,
        originalNine: '7/9 exit1', originalSix: '4/6 exit1',
        failures: rows.filter(row => !row.pass).map(row => row.name)}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
