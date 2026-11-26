import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const root = new URL('../../../', import.meta.url);
const packet = new URL('./', import.meta.url);
const recipe = JSON.parse(fs.readFileSync(new URL('proposal-01.json', packet)));
const initial = JSON.parse(fs.readFileSync(new URL('probe-01.json', packet)));
const mapBytes = fs.readFileSync(new URL('../menu-input-parent-composed/runtime.json', packet));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(mapBytes), recipe.runtime);
for (const [path, digest] of Object.entries(JSON.parse(mapBytes)))
    assert.equal(sha(fs.readFileSync(new URL(path, root))), digest, path);

const {runSegment} = await import(new URL('js/jsmain.js', root));
const {InMemoryStorage} = await import(new URL('js/storage.js', root));
const {PMNAMES} = await import(new URL('js/monst_data.js', root));
const {decodeScreen, renderCell} = await import(new URL('frozen/screen-decode.mjs', root));
const {outputs, hashes, deferred} = await import(new URL('tools/half-damage-reader-observe.mjs', root));
const target = new URL(process.argv[2] || 'baseline-ordinary.json', packet);
assert.equal(fs.existsSync(target), false);
const results = [];
for (const part of recipe.segments) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            if (!g.u || !g.level) return;
            states.push({step, turn: g.moves, form: g.u.umonnum,
                amulet: g.u.uamul?.otyp ?? null,
                inventory: g.invent.map(o => ({otyp: o.otyp, invlet: o.invlet,
                    worn: o.owornmask || 0}))});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const output = outputs(run), streamHashes = hashes(output);
    assert.equal(output.screens.length, part.moves.length + 1);
    assert.deepEqual(output.slices.flat(), output.calls);
    assert.deepEqual(hashes(outputs(await runSegment({...part, storage: new InMemoryStorage()}))), streamHashes);
    assert.deepEqual(hashes(await deferred(part)), streamHashes);
    const text = output.screens.map(s => decodeScreen(s)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    const expected = recipe.expectations.find(e => e.name === part.name);
    const final = states.at(-1), failures = [];
    const check = fn => { try { fn(); } catch (error) { failures.push(error.message); } };
    check(() => assert.equal(final.amulet !== null, expected.amuletWorn));
    if (expected.message)
        check(() => assert.ok(text.at(-1).includes(expected.message), expected.message));
    else
        check(() => assert.ok(text.at(-1).includes('(being worn).')));
    if (part.name.startsWith('nohands-')) {
        check(() => assert.equal(final.form, PMNAMES.PM_FOG_CLOUD));
        check(() => assert.ok(text.some(s => s.includes('You turn into a fog cloud!'))));
    }
    if (part.name.includes('inventory-'))
        check(() => assert.ok(text.some(s => s.includes('Put this amulet on'))));
    if (part.name.endsWith('-negative')) {
        const before = initial.find(r => r.name === part.name);
        check(() => assert.deepEqual(streamHashes, before.hashes));
        check(() => assert.deepEqual(final, before.states.at(-1)));
    }
    const result = {name: part.name, passed: failures.length === 0,
        failures, hashes: streamHashes, final};
    results.push(result);
    console.log(JSON.stringify({name: result.name, passed: result.passed, failures}));
}
fs.writeFileSync(target, JSON.stringify(results, null, 2) + '\n');
if (results.some(r => !r.passed)) process.exitCode = 1;
