import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const variant = process.argv[2];
assert.ok(['baseline', 'candidate'].includes(variant));
const root = new URL('../', import.meta.url), js = new URL(`${variant}/js/`, root);
const sha = value => createHash('sha256').update(value).digest('hex');
const bytes = readFileSync(new URL('recipes/nul-utf8-additional-probes.json', root));
assert.equal(sha(bytes), '2c913699672463ad044a9c09c277b92d2fee0a5af8fb30cb48ca38039dcb2775');
const recipe = JSON.parse(bytes);
const lockBytes = readFileSync(new URL('recipes/nul-utf8-additional-input-lock.json', root));
assert.equal(sha(lockBytes), 'd0e9a81fac019ca0d0ce5cb10f4d5114ffd40a65150927dd59201d4eb2549205');
const lock = JSON.parse(lockBytes);
assert.deepEqual(lock.fields, ['seed', 'datetime', 'nethackrc', 'moves', 'name']);
const tuples = recipe.segments.map((part, i) => {
    const tuple = lock.fields.map(field => { assert.ok(Object.hasOwn(part, field)); return [field, part[field]]; });
    assert.equal(sha(JSON.stringify(tuple)), lock.segments[i].inputSHA256);
    assert.equal(part.moves.length, lock.segments[i].keys);
    return tuple;
});
assert.equal(sha(JSON.stringify(tuples)), lock.inputFieldsSHA256);
const canonicalBytes = readFileSync(new URL('recipes/nul-utf8-canonical-inputs.json', root));
assert.equal(sha(canonicalBytes), '6f0d1cc12129d288bfaafbdb64c96b5a4441c9077f78e33dad90b273adbd21fd');
const canonical = JSON.parse(canonicalBytes);
const {runSegment} = await import(new URL('jsmain.js', js));
const {InMemoryStorage} = await import(new URL('storage.js', js));
const symbols = await import(new URL('symbols.js', js));
const {outputs, hashes, deferred} = await import(new URL(`${variant}/tools/half-damage-reader-observe.mjs`, root));
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
    const report = {classification: 'Additional fixed controls; UTF8 inequality/equality and NUL continuation', variant,
        recipeSHA256: sha(bytes), total: rows.length, passed: rows.filter(row => row.pass).length, rows};
    const reportPath = new URL(`reports/nul-utf8-${variant}.json`, root);
    assert.equal(existsSync(reportPath), false, 'preserve original byte evidence');
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    const controls = rows.filter(row => !row.positive);
    assert.equal(controls.length, 2); assert.ok(controls.every(row => row.pass));
    const path = new URL('reports/nul-utf8-negative-hashes.json', root);
    if (variant === 'baseline') {
        assert.equal(existsSync(path), false);
        writeFileSync(path, JSON.stringify({controls: controls.map(row => ({name: row.name, hashes: row.hashes}))}, null, 2) + '\n');
    } else {
        const negatives = JSON.parse(readFileSync(path)).controls;
        assert.equal(negatives.length, 2);
        for (const control of negatives) {
            assert.deepEqual(Object.keys(control.hashes).sort(), ['calls', 'cursors', 'frames', 'screens', 'slices']);
            assert.deepEqual(rows.find(row => row.name === control.name).hashes, control.hashes);
        }
    }
    console.log(JSON.stringify({passed: report.passed, total: report.total,
        predictedPositiveFailures: rows.filter(row => row.positive && !row.pass).map(row => row.name)}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
