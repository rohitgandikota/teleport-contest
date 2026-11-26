import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {js, reportPath, sourcePreflight, nativePreflight, root, sha, families} from './config-merged-cap-preflight.mjs';

const {recipe, recipeBytes} = families.binding2;
const {runSegment} = await import(new URL('jsmain.js', js));
const {InMemoryStorage} = await import(new URL('storage.js', js));
const {cmdbind_get} = await import(new URL('cmd.js', js));
const {outputs, hashes, deferred} = await import(new URL('tools/half-damage-reader-observe.mjs', root));
const {decodeScreen, renderCell} = await import(new URL('frozen/screen-decode.mjs', root));
const rows = [], timer = setTimeout(() => process.exit(124), 55000);
try {
    for (const [i, part] of recipe.segments.entries()) {
        const expected = recipe.expectations[i], states = [], checks = [];
        const check = (name, fn) => {
            try { fn(); checks.push({name, pass: true}); }
            catch (error) { checks.push({name, pass: false, error: error.message.slice(0, 600)}); }
        };
        const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        let output;
        try {
            globalThis.__step_snapshot = {step: '*', cb(g, step) {
                const bind = cmdbind_get(expected.key);
                states.push({step, errors: [...g.rc.errors], unhandled: [...g.rc.unhandled],
                    command: bind?.cmd?.ef_txt,
                    paramHex: Array.from(bind?.param ?? '', c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')});
            }};
            output = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
        } finally {
            if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), prior);
        const plain = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
        const late = await deferred(part);
        check('all-five observer/plain/deferred and all keys', () => {
            assert.deepEqual(output, plain); assert.deepEqual(output, late);
            assert.deepEqual(output.slices.flat(), output.calls);
            for (const key of ['screens', 'cursors', 'slices', 'frames']) assert.equal(output[key].length, part.moves.length + 1);
            assert.equal(states.length, part.moves.length + 1);
        });
        check('actual RC producer stores C-predicted parameter bytes', () => {
            assert.ok(states.every(s => s.command === expected.command && s.paramHex === expected.paramHex));
            assert.ok(states.every(s => !s.errors.length && !s.unhandled.length));
        });
        const texts = output.screens.map(s => decodeScreen(s).map(row => row.map(renderCell).join('')).join('\n'));
        check('ordinary key listing consumes the parameter owner', () => {
            for (const phrase of recipe.branchAssertions[i].screenIncludes) assert.ok(texts.some(text => text.includes(phrase)), phrase);
        });
        rows.push({name: part.name, pass: checks.every(c => c.pass), checks,
            hashes: hashes(output), boundaries: output.screens.length, calls: output.calls.length,
            frames: output.frames.flat().length, firstState: states[0],
            parameterLines: texts.flatMap((text, step) => text.split('\n').filter(line => /^A +toggle /.test(line))
                .map(line => ({step, line: line.trimEnd()})))});
    }
    const report = {classification: 'Ordinary controls locked before runtime edits; original C recording verified',
        runtime: 'installed', total: rows.length, passed: rows.filter(r => r.pass).length, rows};
    if (reportPath) writeFileSync(reportPath, JSON.stringify({...report, sourcePreflight, nativePreflight}, null, 2) + '\n', {flag: 'wx'});
    {
        const negative = families.binding2.negative;
        assert.equal(negative.recipeSHA256, sha(recipeBytes)); assert.equal(negative.controls.length, 2);
        for (const row of rows) assert.deepEqual(row.hashes, negative.controls.find(c => c.name === row.name).hashes);
    }
    console.log(JSON.stringify({passed: report.passed, total: report.total, rows: rows.map(({name, firstState, parameterLines}) => ({name, firstState, parameterLines}))}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(timer); }
