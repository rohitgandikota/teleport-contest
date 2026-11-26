import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Baseline observation only. This does not prescribe a new runtime byte API.
const root = new URL('../', import.meta.url), js = new URL('baseline/js/', root);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const recipeBytes = readFileSync(new URL('recipes/fruit-byte-probes.json', root));
assert.equal(sha(recipeBytes), 'fb3339e5af6d14598d544b7e363202461a8385c6ef440b2cbbc4d93f85bfd062');
const recipe = JSON.parse(recipeBytes);
const lockBytes = readFileSync(new URL('recipes/fruit-byte-input-lock.json', root));
assert.equal(sha(lockBytes), '202c2ce1e8a2d8dae386ba6573833819b40ab1d7756f97622658392c96a51240');
const lock = JSON.parse(lockBytes);
assert.equal(lock.recipeSHA256, sha(recipeBytes));
assert.deepEqual(lock.fields, ['seed', 'datetime', 'nethackrc', 'moves', 'name']);
assert.equal(recipe.segments.length, 5);
const tuples = recipe.segments.map((part, i) => {
    const tuple = lock.fields.map(field => {
        assert.ok(Object.hasOwn(part, field)); return [field, part[field]];
    });
    assert.equal(sha(JSON.stringify(tuple)), lock.segments[i].inputSHA256);
    assert.equal(part.name, recipe.expectations[i].name);
    assert.equal(part.moves.length, lock.segments[i].keys);
    return tuple;
});
assert.equal(sha(JSON.stringify(tuples)), lock.inputFieldsSHA256);
const {runSegment} = await import(new URL('jsmain.js', js));
const {InMemoryStorage} = await import(new URL('storage.js', js));
const {outputs, hashes, deferred} = await import(new URL('baseline/tools/half-damage-reader-observe.mjs', root));
const {decodeScreen} = await import(new URL('baseline/frozen/screen-decode.mjs', root));
const asUtf8Hex = text => Buffer.from(text, 'utf8').toString('hex');
const rows = [];
const deadline = setTimeout(() => process.exit(2), 55000);
try {
    for (const [i, part] of recipe.segments.entries()) {
        const expected = recipe.expectations[i], states = [], checks = [];
        const check = (name, fn) => {
            try { fn(); checks.push({name, pass: true}); }
            catch (error) { checks.push({name, pass: false, error: error.message.slice(0, 700)}); }
        };
        const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        let output;
        try {
            globalThis.__step_snapshot = {step: '*', cb(g, step) {
                states.push({step, errors: [...g.rc.errors], unhandled: [...g.rc.unhandled],
                    fruitText: g.svp.pl_fruit, fruitTextUtf8Hex: asUtf8Hex(g.svp.pl_fruit),
                    fruitChainHead: g.ffruit?.fname ?? null,
                    fruitChainHeadUtf8Hex: g.ffruit ? asUtf8Hex(g.ffruit.fname) : null,
                    currentFruit: g.context.current_fruit,
                    optionValue: g.rc.opts.eight_bit_tty,
                    flagsValue: !!g.flags.eight_bit_tty,
                    iflagsPresent: Object.hasOwn(g.iflags, 'wc_eight_bit_input'),
                    iflagsValue: !!g.iflags.wc_eight_bit_input,
                    inventory: g.invent.map(o => ({otyp: o.otyp, spe: o.spe, quan: o.quan}))});
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
            assert.deepEqual(output, plain); assert.deepEqual(output, late);
            assert.deepEqual(output.slices.flat(), output.calls);
            for (const key of ['screens', 'cursors', 'slices', 'frames'])
                assert.equal(output[key].length, part.moves.length + 1);
            assert.equal(states.length, part.moves.length + 1);
        });
        check('valid RC has no collected error or unhandled directive', () => {
            assert.ok(states.every(s => !s.errors.length && !s.unhandled.length));
        });
        check('C-predicted stored name bytes, observed through existing JS text storage', () => {
            assert.ok(states.every(s => s.fruitTextUtf8Hex === expected.storedNameHex));
            assert.ok(states.every(s => s.fruitChainHeadUtf8Hex === expected.storedNameHex));
        });
        check('C boolean reader agrees with final actual option value', () => {
            assert.ok(states.every(s => s.optionValue === expected.eightBitInput));
            assert.ok(states.every(s => s.iflagsValue === expected.eightBitInput));
        });
        check('ordinary wish creates the current real fruit', () => {
            assert.equal(states[0].inventory.length, 0);
            assert.equal(states.at(-1).inventory.length, 1);
            assert.equal(states.at(-1).currentFruit, expected.fruitID);
            assert.equal(states.at(-1).inventory[0].spe, expected.fruitID);
            assert.equal(states.at(-1).inventory[0].quan, 1);
        });
        const cell = expected.wishResultCell;
        const screen = decodeScreen(output.screens[expected.wishResultStep]);
        check('source-predicted period position after byte-counted fruit name', () => {
            assert.equal(screen[cell.y][cell.x].ch, cell.ch);
        });
        rows.push({name: part.name, positive: expected.positive,
            sourcePredictionMatches: checks.every(c => c.pass), checks, hashes: hashes(output),
            boundaries: output.screens.length, calls: output.calls.length,
            frames: output.frames.flat().length, firstState: states[0], lastState: states.at(-1),
            observedWishCell: screen[cell.y][cell.x],
            wishTopline: output.screens[expected.wishResultStep].split('\n')[0]});
    }
    const negative = rows.filter(row => !row.positive);
    assert.equal(negative.length, 1);
    assert.ok(negative.every(row => row.sourcePredictionMatches));
    const report = {classification: 'Read-only fixed NUL baseline observation against C source predictions, not a candidate API or native pass claim.',
        recipeSHA256: sha(recipeBytes), total: rows.length,
        matchingSourcePredictions: rows.filter(row => row.sourcePredictionMatches).length, rows};
    writeFileSync(new URL('reports/fruit-byte-baseline.json', root), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
    writeFileSync(new URL('reports/fruit-byte-negative-hashes.json', root), JSON.stringify({controls: negative.map(row => ({name: row.name, hashes: row.hashes}))}, null, 2) + '\n', {flag: 'wx'});
    console.log(JSON.stringify({total: report.total, matchingSourcePredictions: report.matchingSourcePredictions,
        boundaries: rows.reduce((n, row) => n + row.boundaries, 0),
        calls: rows.reduce((n, row) => n + row.calls, 0),
        failures: rows.filter(row => !row.sourcePredictionMatches).map(row => ({name: row.name,
            checks: row.checks.filter(c => !c.pass).map(c => c.name)}))}));
    if (report.matchingSourcePredictions !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
