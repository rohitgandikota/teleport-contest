import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {js, reportPath, sourcePreflight, nativePreflight, root, sha, families} from './config-merged-cap-preflight.mjs';

const {recipe, recipeBytes: bytes, canonical} = families.additional4;
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
    const report = {classification: 'Additional fixed controls; UTF8 inequality/equality and NUL continuation', runtime: 'installed',
        recipeSHA256: sha(bytes), total: rows.length, passed: rows.filter(row => row.pass).length, rows};
    if (reportPath) writeFileSync(reportPath, JSON.stringify({...report, sourcePreflight, nativePreflight}, null, 2) + '\n', {flag: 'wx'});
    const controls = rows.filter(row => !row.positive);
    assert.equal(controls.length, 2); assert.ok(controls.every(row => row.pass));
    {
        const negatives = families.additional4.negative.controls;
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
