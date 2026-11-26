import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

import {root, load, read, sha, nativePreflight, legacyPrimaryErrors} from './preflight.mjs';
const lock = load('recipes/initial-input-lock.json');
const recipe = load('recipes/initial-proposals.json');
const recipeBytes = read('recipes/initial-proposals.json');
const {runSegment} = await import(new URL('js/jsmain.js', root));
const {InMemoryStorage} = await import(new URL('js/storage.js', root));
const {outputs, hashes, deferred} = await import(new URL('tools/half-damage-reader-observe.mjs', root));
const {decodeScreen, renderCell} = await import(new URL('frozen/screen-decode.mjs', root));
const rows = [], timer = setTimeout(() => process.exit(124), 55000);
try {
    for (const [i, part] of recipe.segments.entries()) {
        const expected = recipe.expectations[i], states = [], checks = [];
        const check = (name, body) => {
            try { body(); checks.push({name, pass: true}); }
            catch (error) { checks.push({name, pass: false, error: error.message.slice(0, 600)}); }
        };
        const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        let output;
        try {
            globalThis.__step_snapshot = {step: '*', cb(g, step) {
                states.push({step, errors: [...g.rc.errors], unhandled: [...g.rc.unhandled],
                    inventory: g.invent.map(o => [o.o_id, o.invlet, o.otyp, o.quan]),
                    moves: g.moves});
            }};
            output = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
        } finally {
            if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), prior);
        const plain = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
        const late = await deferred(part);
        const screens = output.screens.map(screen => decodeScreen(screen)
            .map(row => row.map(renderCell).join('')));
        const entries = screens.map(lines => lines.flatMap((line, y) => {
            const match = line.match(/^\s*([a-zA-Z$]) ([-+#*]) /);
            if (!match) return [];
            return [{y, x: line.indexOf(match[1]) + 2, selector: match[1], mark: match[2], text: line.trim()}];
        }));
        check('all keys and observer/plain/deferred all-five equality', () => {
            assert.deepEqual(output, plain); assert.deepEqual(output, late);
            assert.deepEqual(output.slices.flat(), output.calls);
            for (const key of ['screens', 'cursors', 'slices', 'frames'])
                assert.equal(output[key].length, part.moves.length + 1);
            assert.equal(states.length, part.moves.length + 1);
        });
        check('valid RC has no parser errors or unhandled statements', () =>
            assert.ok(states.every(s => !s.errors.length && !s.unhandled.length)));
        check('menu cancellation leaves actual inventory and turn unchanged', () => {
            for (const state of states) {
                assert.deepEqual(state.inventory, states[0].inventory);
                assert.equal(state.moves, states[0].moves);
            }
        });
        if (expected.selectionSteps) check('real drop menu applies C-predicted selections', () => {
            for (const step of expected.selectionSteps) {
                assert.ok(screens[step].some(line => line.includes('What would you like to drop?')));
                assert.ok(entries[step].length > 1);
                const selected = entries[step].filter(entry => entry.mark === '+');
                assert.equal(selected.length, expected.selected === 'all' ? entries[step].length : 1);
            }
        });
        if (expected.helpAlias) check('menu help reads the same alias store', () =>
            assert.ok(screens.some(lines => lines.some(line => line.includes('Select     ' + expected.helpAlias)))));
        if (expected.inventoryStep) check('unrelated ordinary command binding still opens inventory', () =>
            assert.ok(entries[expected.inventoryStep].length > 1));
        rows.push({name: part.name, positive: expected.positive, pass: checks.every(c => c.pass), checks,
            hashes: hashes(output), boundaries: output.screens.length, calls: output.calls.length,
            frames: output.frames.flat().length, firstState: states[0],
            relevantScreens: screens.map((lines, step) => ({step,
                titles: lines.map(line => line.trim()).filter(line => /What would you like|Menu control keys|Select     |Select one item/.test(line)),
                entries: entries[step]})).filter(row => row.titles.length || row.entries.length)});
    }
    const report = {classification: 'Isolated candidate, original five unchanged assertions and certified decoded primary',
        recipeSHA256: sha(recipeBytes), total: rows.length, passed: rows.filter(row => row.pass).length, rows};
    writeFileSync(new URL('reports/initial-candidate.json', root), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
    const controls = rows.filter(row => !row.positive);
    assert.equal(controls.length, 3); assert.ok(controls.every(row => row.pass));
    writeFileSync(new URL('reports/initial-candidate-negative-hashes.json', root), JSON.stringify({recipeSHA256: sha(recipeBytes),
        controls: controls.map(({name, hashes}) => ({name, hashes}))}, null, 2) + '\n', {flag: 'wx'});
    const retained = load('source/original-audit/reports/initial-negative-hashes.json').controls;
    assert.equal(controls.length, 3);
    assert.deepEqual(controls.map(({name,hashes}) => ({name,hashes})),
        retained.map(({name,hashes}) => ({name,hashes})), 'all five hashes of every original negative');
    console.log(JSON.stringify({passed: report.passed, total: report.total,
        failures: rows.filter(row => !row.pass).map(row => ({name: row.name, checks: row.checks.filter(c => !c.pass)}))}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(timer); }
