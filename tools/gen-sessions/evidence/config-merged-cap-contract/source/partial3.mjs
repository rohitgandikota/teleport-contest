import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('../', import.meta.url);
const variant = process.argv[2];
assert.ok(['baseline', 'candidate'].includes(variant));
const sha = value => createHash('sha256').update(value).digest('hex');
const recipeBytes = readFileSync(new URL('recipes/partial-symbol-proposals.json', root));
assert.equal(sha(recipeBytes), 'ce51f43c9fa948482830926260a72e6f4e7a489702523b524990713c59eee93b');
const recipe = JSON.parse(recipeBytes);
const lockBytes = readFileSync(new URL('recipes/partial-symbol-input-lock.json', root));
assert.equal(sha(lockBytes), '840b566686f9eb91aa526bbc926446d6d32bd82a19275453322794e32641f9d2');
const lock = JSON.parse(lockBytes);
assert.deepEqual(lock.fields, ['seed', 'datetime', 'nethackrc', 'moves', 'name']);
const tuples = recipe.segments.map((part, i) => {
    const tuple = lock.fields.map(field => {
        assert.ok(Object.hasOwn(part, field));
        return [field, part[field]];
    });
    assert.equal(sha(JSON.stringify(tuple)), lock.segments[i].inputSHA256);
    assert.equal(part.moves.length, lock.segments[i].keys);
    return tuple;
});
assert.equal(sha(JSON.stringify(tuples)), lock.inputFieldsSHA256);
const mapBytes = readFileSync(new URL(`source/${variant}-runtime.json`, root));
if (variant === 'baseline')
    assert.equal(sha(mapBytes), '227567f7163bcc49aa09addaaac59478a05d0f7799404dd662d13bf133519f5a');
const runtime = JSON.parse(mapBytes);
assert.equal(Object.keys(runtime).length, 280);
for (const [file, expected] of Object.entries(runtime))
    assert.equal(sha(readFileSync(new URL(`${variant}/${file}`, root))), expected, file);

const js = new URL(`${variant}/js/`, root);
const {runSegment} = await import(new URL('jsmain.js', js));
const {InMemoryStorage} = await import(new URL('storage.js', js));
const symbols = await import(new URL('symbols.js', js));
const {outputs, hashes, deferred} = await import(new URL(`${variant}/tools/half-damage-reader-observe.mjs`, root));
const {decodeScreen, renderCell} = await import(new URL(`${variant}/frozen/screen-decode.mjs`, root));
const room = symbols.match_sym('S_room');
assert.ok(room);
const rows = [];
const deadline = setTimeout(() => process.exit(2), 55000);
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
        check('all keys and observer/plain/deferred all-five equality', () => {
            assert.deepEqual(output, plain);
            assert.deepEqual(output, late);
            assert.deepEqual(output.slices.flat(), output.calls);
            for (const key of ['screens', 'cursors', 'slices', 'frames'])
                assert.equal(output[key].length, part.moves.length + 1);
            assert.equal(states.length, part.moves.length + 1);
        });
        check('no collected parser error or unhandled statement', () => {
            assert.ok(states.every(state => !state.errors.length && !state.unhandled.length));
        });
        check('C-predicted real symbol override state', () => {
            assert.ok(states.every(state => state.roomOverride === expected.roomOverride));
        });
        const {step, x, y, ch} = expected.firstRoomCell;
        const cell = decodeScreen(output.screens[step])[y][x];
        check('C-predicted ordinary room glyph', () => assert.equal(renderCell(cell), ch));
        rows.push({name: part.name, positive: expected.positive, pass: checks.every(c => c.pass),
            checks, hashes: hashes(output), firstState: states[0], firstRoomCell: cell,
            boundaries: output.screens.length, calls: output.calls.length,
            frames: output.frames.flat().length});
    }
    const report = {classification: 'Locked ordinary proposals; source predictions, new C recording pending',
        variant, recipeSHA256: sha(recipeBytes), runtimeMapSHA256: sha(mapBytes),
        total: rows.length, passed: rows.filter(row => row.pass).length, rows};
    const reportPath = new URL(`reports/partial-symbol-${variant}.json`, root);
    assert.equal(existsSync(reportPath), false, 'preserve previous evidence');
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    const negativePath = new URL('reports/partial-symbol-negative-hashes.json', root);
    if (variant === 'baseline') {
        assert.equal(existsSync(negativePath), false, 'capture baseline controls once');
        const controls = rows.filter(row => !row.positive).map(({name, hashes}) => ({name, hashes}));
        writeFileSync(negativePath, JSON.stringify({recipeSHA256: sha(recipeBytes), controls}, null, 2) + '\n');
    } else {
        const negatives = JSON.parse(readFileSync(negativePath));
        assert.equal(negatives.recipeSHA256, sha(recipeBytes));
        assert.equal(negatives.controls.length, 2);
        for (const control of negatives.controls) {
            assert.deepEqual(Object.keys(control.hashes).sort(), ['calls', 'cursors', 'frames', 'screens', 'slices']);
            assert.deepEqual(rows.find(row => row.name === control.name).hashes, control.hashes);
        }
    }
    console.log(JSON.stringify({passed: report.passed, total: report.total,
        failures: rows.filter(row => !row.pass).map(row => row.name)}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
