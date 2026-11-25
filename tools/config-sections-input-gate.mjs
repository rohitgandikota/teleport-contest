import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';

const reportPath = process.argv[2];
assert.ok(process.argv.length <= 3, 'optional argument: compact report path');
const root = new URL('../', import.meta.url), js = new URL('js/', root);
const evidence = new URL('tools/gen-sessions/evidence/config-sections-contract/', root);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = readFileSync(new URL('initial-ordinary-probes.json', evidence));
assert.equal(sha(bytes), 'a0d882c6fea50b0a3b25f9d3137d86b85eb815d005054ae04c5aaf92f00c1df8');
const recipe = JSON.parse(bytes);
const lockBytes = readFileSync(new URL('initial-input-lock.json', evidence));
assert.equal(sha(lockBytes), 'a9ce72b466f6a5f66f009c4722b0e595ba1f0bac7d7fd8a90a01fe943a32e0ce');
const lock = JSON.parse(lockBytes);
assert.equal(sha(bytes), lock.recipeSHA256);
assert.deepEqual(lock.fields, ['seed', 'datetime', 'nethackrc', 'moves', 'name']);
assert.equal(recipe.segments.length, 10);
assert.equal(recipe.expectations.length, 10);
assert.equal(lock.segments.length, 10);
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
const primaryBytes = readFileSync(new URL('tools/gen-sessions/recipes/config-sections-contract.json', root));
assert.equal(sha(primaryBytes), '7f0f481a3c02a7639f6ceb95275562952a8b09aa3d1d2275eae076b7739d974b');
const primary = JSON.parse(primaryBytes);
const derivationBytes = readFileSync(new URL('primary-derivation.json', evidence));
assert.equal(sha(derivationBytes), '0efebf7c5795edf23e005e1608f4025a85d483b9b54a73f70bfe0186f5fa0c20');
const derivation = JSON.parse(derivationBytes);
assert.equal(derivation.originalRecipeSHA256, sha(bytes));
assert.equal(derivation.primaryRecipeSHA256, sha(primaryBytes));
assert.equal(derivation.inputLockSHA256, sha(lockBytes));
assert.deepEqual(derivation.preservedKeys, Object.keys(recipe));
assert.ok(Object.keys(derivation.addedMetadata).every(key => !Object.hasOwn(recipe, key)));
assert.deepEqual(primary, {...recipe, ...derivation.addedMetadata});
assert.equal(primary.requireBranchAssertions, true);
assert.equal(primary.branchAssertions.length, 10);
assert.deepEqual(primary.branches, recipe.segments.map(part => `config-sections.${part.name}`));
assert.deepEqual(primary.branchAssertions, recipe.expectations.map((expected, i) => {
    const assertion = {branch: primary.branches[i], segment: i};
    if (expected.symbol) assertion.screenCells = [{step: 0, x: 0, y: 1, equals: expected.symbol}];
    if (expected.message) assertion.screenIncludes = [expected.message];
    if (expected.prefix) assertion.rngIncludes = expected.prefix;
    return assertion;
}));
assert.deepEqual(branchAssertionErrors(primary), []);
const canonicalBytes = readFileSync(new URL('canonical-inputs.json', evidence));
assert.equal(sha(canonicalBytes), '8d07868e2e7b19c6f874b2dd76bd1c7fe9e5e934b5c7c3d4843872924c3887b8');
const canonical = JSON.parse(canonicalBytes);
const negativeBytes = readFileSync(new URL('negative-hashes.json', evidence));
assert.equal(sha(negativeBytes), 'a34972ada8c10d2daa11b16361182e53b6878517da6a8d5b0406b4428a2e6e32');

// Exact original C evidence is mandatory before importing ordinary gameplay.
const rawBytes = readFileSync(new URL('tools/gen-sessions/generated/config-sections-contract.session.json', root));
assert.equal(sha(rawBytes), 'bf8ea773b316f2b3543f72b13ba9cd9850d707c85b10a46e0c2c3cc530b04955');
const native = JSON.parse(rawBytes);
assert.equal(native.version, 5);
assert.equal(native.source, 'c');
assert.ok(Array.isArray(native.segments));
assert.equal(native.segments.length, 10);
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
    const expected = recipe.expectations[i];
    if (expected.inactivePair) {
        const pair = native.segments.find(part => part.name === expected.inactivePair);
        assert.ok(pair);
        assert.deepEqual(segment.steps, pair.steps, 'C inactive-body intervention is neutral');
    }
}
assert.deepEqual({boundaries, calls, frames, keys}, {boundaries: 43, calls: 26547, frames: 0, keys: 33});
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(primary, native), []);
const nativePreflight = {sha256: sha(rawBytes), version: 5, source: 'c',
    segments: 10, fields: lock.fields, boundaries, calls, frames, keys,
    primaryBranchAssertions: 10, integrityErrors: [], branchErrors: []};
const {runSegment} = await import(new URL('jsmain.js', js));
const {InMemoryStorage} = await import(new URL('storage.js', js));
const {cmdbind_get} = await import(new URL('cmd.js', js));
const symbols = await import(new URL('symbols.js', js));
const {outputs, hashes, deferred} = await import(new URL('tools/half-damage-reader-observe.mjs', root));
const text = screen => decodeScreen(screen).map(row => row.map(renderCell).join('').trimEnd()).join('\n');
const deadline = setTimeout(() => process.exit(2), 55000);
const rows = [], pairOutputs = new Map();
try {
    for (const [index, part] of recipe.segments.entries()) {
        const expected = recipe.expectations[index], states = [], checks = [];
        const check = (name, fn) => {
            try { fn(); checks.push({name, pass: true}); }
            catch (e) { checks.push({name, pass: false, error: e.message.slice(0, 700)}); }
        };
        const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        let output;
        try {
            globalThis.__step_snapshot = {step: '*', cb(g, step) {
                states.push({step, errors: [...(g.rc?.errors || [])], unhandled: [...(g.rc?.unhandled || [])],
                    symbol: String.fromCharCode(symbols.get_othersym(symbols.SYM_UNEXPLORED, symbols.PRIMARYSET)),
                    binding: cmdbind_get('~'.charCodeAt(0))?.cmd?.ef_txt || null});
            }};
            output = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
        } finally {
            if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), prior);
        const plain = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
        const late = await deferred(part);
        check('observer/plain/deferred all five streams and every key', () => {
            assert.deepEqual(output, plain); assert.deepEqual(output, late);
            assert.deepEqual(output.slices.flat(), output.calls);
            for (const key of ['screens', 'cursors', 'slices', 'frames'])
                assert.equal(output[key].length, part.moves.length + 1);
            assert.equal(states.length, part.moves.length + 1);
        });
        check('C-valid section input has no parse errors or unhandled directives', () => {
            assert.ok(states.every(s => !s.errors.length && !s.unhandled.length));
        });
        if (expected.prefix?.some(call => call === 'rn2(1)=0'))
            check('C-source CHOOSE draws precede gameplay and survive in first slice', () => {
                assert.deepEqual(output.calls.slice(0, expected.prefix.length), expected.prefix);
                assert.deepEqual(output.slices[0].slice(0, expected.prefix.length), expected.prefix);
            });
        if (expected.symbol)
            check('selected section reaches real map symbol producer and consumer', () => {
                assert.ok(states.every(s => s.symbol === expected.symbol));
                assert.equal(renderCell(decodeScreen(output.screens[0])[1][0]), expected.symbol);
            });
        if (expected.binding)
            check('selected section reaches real key binding and description', () => {
                assert.ok(states.every(s => s.binding === expected.binding));
                assert.ok(output.screens.some(s => text(s).includes(expected.message)));
            });
        if (expected.canonicalReference) {
            const ref = outputs(await runSegment({...canonical[expected.canonicalReference], storage: new InMemoryStorage()}));
            check('unaffected negative all five canonical hashes', () => assert.deepEqual(hashes(output), hashes(ref)));
        }
        if (expected.inactivePair)
            check('changing only inactive section has no effect on all five streams', () => {
                assert.deepEqual(output, pairOutputs.get(expected.inactivePair));
            });
        pairOutputs.set(part.name, output);
        rows.push({name: part.name, pass: checks.every(c => c.pass), checks,
            negative: expected.negative, hashes: hashes(output), boundaries: output.screens.length,
            calls: output.calls.length, frames: output.frames.flat().length,
            firstCalls: output.calls.slice(0, 3), firstObservedState: states[0]});
    }
    const a = rows.find(r => r.name === 'sections-single-symbols-Z');
    const b = rows.find(r => r.name === 'sections-single-symbols-Y');
    const report = {classification: 'JS runtime versus C-source predicates, not native comparison', nativePreflight,
        primaryRecipeSHA256: sha(primaryBytes),
        recipeSHA256: sha(bytes), total: rows.length, passed: rows.filter(r => r.pass).length,
        inactiveSectionIntervention: {cases: [a.name, b.name],
            changedStreams: Object.keys(a.hashes).filter(k => a.hashes[k] !== b.hashes[k])}, rows};
    const negatives = JSON.parse(negativeBytes);
    assert.equal(negatives.controls.length, 3);
    for (const control of negatives.controls) {
        assert.deepEqual(Object.keys(control.hashes).sort(), ['calls', 'cursors', 'frames', 'screens', 'slices']);
        assert.deepEqual(rows.find(row => row.name === control.name).hashes, control.hashes);
    }
    if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({passed: report.passed, total: report.total,
        inactiveSectionIntervention: report.inactiveSectionIntervention}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
