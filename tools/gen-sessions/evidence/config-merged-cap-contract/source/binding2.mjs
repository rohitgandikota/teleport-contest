import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root = new URL('../', import.meta.url), variant = process.argv[2];
assert.ok(['baseline', 'candidate'].includes(variant));
const sha = b => createHash('sha256').update(b).digest('hex');
const recipeBytes = readFileSync(new URL('recipes/binding-param-proposals.json', root));
const recipe = JSON.parse(recipeBytes);
const lock = JSON.parse(readFileSync(new URL('recipes/binding-param-input-lock.json', root)));
assert.equal(sha(recipeBytes), lock.recipeSHA256);
const tuples = recipe.segments.map((part, i) => {
    const tuple = lock.fields.map(field => { assert.ok(Object.hasOwn(part, field)); return [field, part[field]]; });
    assert.equal(sha(JSON.stringify(tuple)), lock.segments[i].inputSHA256);
    assert.equal(part.moves.length, lock.segments[i].keys);
    return tuple;
});
assert.equal(sha(JSON.stringify(tuples)), lock.inputFieldsSHA256);
const mapBytes = readFileSync(new URL(`source/${variant}-runtime.json`, root));
if (variant === 'baseline') assert.equal(sha(mapBytes), '227567f7163bcc49aa09addaaac59478a05d0f7799404dd662d13bf133519f5a');
const map = JSON.parse(mapBytes); assert.equal(Object.keys(map).length, 280);
for (const [name, digest] of Object.entries(map))
    assert.equal(sha(readFileSync(new URL(`${variant}/${name}`, root))), digest, name);
const js = new URL(`${variant}/js/`, root);
const {runSegment} = await import(new URL('jsmain.js', js));
const {InMemoryStorage} = await import(new URL('storage.js', js));
const {cmdbind_get} = await import(new URL('cmd.js', js));
const {outputs, hashes, deferred} = await import(new URL(`${variant}/tools/half-damage-reader-observe.mjs`, root));
const {decodeScreen, renderCell} = await import(new URL(`${variant}/frozen/screen-decode.mjs`, root));
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
    const report = {classification: 'Ordinary controls locked before runtime edits; no new C recording claimed',
        variant, total: rows.length, passed: rows.filter(r => r.pass).length, rows};
    writeFileSync(new URL(`reports/binding-param-${variant}.json`, root), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
    const path = new URL('reports/binding-param-negative-hashes.json', root);
    if (variant === 'baseline') writeFileSync(path, JSON.stringify({recipeSHA256: sha(recipeBytes),
        controls: rows.map(({name, hashes}) => ({name, hashes}))}, null, 2) + '\n', {flag: 'wx'});
    else {
        const negative = JSON.parse(readFileSync(path));
        assert.equal(negative.recipeSHA256, sha(recipeBytes)); assert.equal(negative.controls.length, 2);
        for (const row of rows) assert.deepEqual(row.hashes, negative.controls.find(c => c.name === row.name).hashes);
    }
    console.log(JSON.stringify({passed: report.passed, total: report.total, rows: rows.map(({name, firstState, parameterLines}) => ({name, firstState, parameterLines}))}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(timer); }
