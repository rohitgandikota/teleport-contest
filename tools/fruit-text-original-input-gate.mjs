import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reportPath, repoRoot, js, root, sha, original, nativePreflight, sourcePreflight, markerAccounting } from './fruit-text-preflight.mjs';
const recipe = original.original5.recipe, recipeBytes = original.original5.recipeBytes;
const negatives = JSON.parse(fs.readFileSync(new URL('reports/fruit-original-negative-hashes.json', root)));
const {runSegment} = await import(new URL('jsmain.js', js));
const {InMemoryStorage} = await import(new URL('storage.js', js));
const {outputs, hashes, deferred} = await import(new URL('tools/half-damage-reader-observe.mjs', repoRoot));
const {decodeScreen} = await import(new URL('frozen/screen-decode.mjs', repoRoot));
const asByteHex = text => Array.from(text, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
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
                    fruitText: g.svp.pl_fruit, fruitTextByteHex: asByteHex(g.svp.pl_fruit),
                    fruitChainHead: g.ffruit?.fname ?? null,
                    fruitChainHeadByteHex: g.ffruit ? asByteHex(g.ffruit.fname) : null,
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
        check('C-predicted stored name bytes, measured as byte-valued code units', () => {
            assert.ok(states.every(s => s.fruitTextByteHex === expected.storedNameHex));
            assert.ok(states.every(s => s.fruitChainHeadByteHex === expected.storedNameHex));
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
        if (!expected.positive) check('original ASCII five hashes unchanged', () => {
            assert.deepEqual(hashes(output), negatives.controls.find(c => c.name === part.name).hashes);
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
    // Portable composition accounting, outside the original assertion body.
    for (const row of rows) {
        const accounted = markerAccounting.rows.find(r => r.name === row.name);
        assert.deepEqual(row.hashes, accounted.afterHashes, row.name);
    }
    const report = { classification: 'Original recorded fruit5 assertions with unchanged byte observer on the installed root.',
        sourcePreflight, nativePreflight, recipeSHA256: sha(recipeBytes), total: rows.length,
        matchingSourcePredictions: rows.filter(row => row.sourcePredictionMatches).length, rows };
    if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ total: report.total, matchingSourcePredictions: report.matchingSourcePredictions }));
    if (report.matchingSourcePredictions !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
