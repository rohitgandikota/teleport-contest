import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const root = new URL('../../../', import.meta.url);
const packet = new URL('./', import.meta.url);
const recipe = JSON.parse(fs.readFileSync(new URL('proposal-01.json', packet)));
const mapBytes = fs.readFileSync(new URL('../menu-input-parent-composed/runtime.json', packet));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(mapBytes), recipe.runtime);
for (const [path, digest] of Object.entries(JSON.parse(mapBytes)))
    assert.equal(sha(fs.readFileSync(new URL(path, root))), digest, path);

const {runSegment} = await import(new URL('js/jsmain.js', root));
const {InMemoryStorage} = await import(new URL('js/storage.js', root));
const {decodeScreen, renderCell} = await import(new URL('frozen/screen-decode.mjs', root));
const {outputs, hashes} = await import(new URL('tools/half-damage-reader-observe.mjs', root));
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
    const output = outputs(run);
    const text = output.screens.map(s => decodeScreen(s)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    const result = {name: part.name, boundaries: output.screens.length,
        hashes: hashes(output), states, finalText: text.at(-1),
        recentTop: text.slice(-5).map(s => s.split('\n').slice(0, 3))};
    results.push(result);
    console.log(JSON.stringify({name: part.name, boundaries: result.boundaries,
        expected: part.moves.length + 1, final: states.at(-1), recentTop: result.recentTop}));
}
const target = new URL('probe-01.json', packet);
assert.equal(fs.existsSync(target), false);
fs.writeFileSync(target, JSON.stringify(results, null, 2) + '\n');
