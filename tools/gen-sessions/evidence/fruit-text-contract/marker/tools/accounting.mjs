import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const root = new URL('../', import.meta.url);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const load = path => JSON.parse(fs.readFileSync(new URL(path, root)));
const pins = load('source/pins.json');
for (const [name, pin] of Object.entries(pins.fixtures))
    assert.equal(sha(fs.readFileSync(new URL('fixtures/' + name, root))), pin.sha256, name);
const finding = load('source/native-finding.json');
const expectedChanges = finding.twoFailures;
const parts = [];
for (const id of ['initial', 'pickup', 'fruit5']) {
    const recipe = load(`fixtures/${id}-recipe.json`), lock = load(`fixtures/${id}-input-lock.json`);
    assert.deepEqual(lock.fields, ['seed', 'datetime', 'nethackrc', 'moves', 'name']);
    const tuples = recipe.segments.map((part, i) => {
        const tuple = lock.fields.map(field => { assert.ok(Object.hasOwn(part, field)); return [field, part[field]]; });
        assert.equal(sha(JSON.stringify(tuple)), lock.segments[i].inputSHA256);
        assert.equal(part.moves.length, lock.segments[i].keys);
        parts.push({id, part}); return tuple;
    });
    assert.equal(sha(JSON.stringify(tuples)), lock.inputFieldsSHA256);
}
assert.equal(parts.length, 18);
const apis = {};
for (const variant of ['baseline', 'candidate']) {
    const map = load(`source/${variant === 'baseline' ? 'base' : 'candidate'}-runtime.json`);
    assert.equal(Object.keys(map).length, 280);
    for (const [name, digest] of Object.entries(map))
        assert.equal(sha(fs.readFileSync(new URL(`${variant}/${name}`, root))), digest);
    const js = new URL(`${variant}/js/`, root);
    const {runSegment} = await import(new URL('jsmain.js', js));
    const {InMemoryStorage} = await import(new URL('storage.js', js));
    const state = await import(new URL('gstate.js', js));
    const helper = await import(new URL(`${variant}/tools/half-damage-reader-observe.mjs`, root));
    apis[variant] = {runSegment, InMemoryStorage, state, ...helper};
}
const {decodeScreen} = await import(new URL('baseline/frozen/screen-decode.mjs', root));
const timer = setTimeout(() => process.exit(124), 55_000);
const rows = [];
async function observe(api, part) {
    const states = [], prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let result;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            assert.equal(g, api.state.game, 'live game binding after reset');
            states.push({step, moves: g.moves, xy: [g.u.ux, g.u.uy], fruit: g.svp?.pl_fruit,
                currentFruit: g.context?.current_fruit, pending: g._pending_message,
                inventory: g.invent.map(o => [o.o_id, o.otyp, o.quan, o.spe]),
                floor: g.level.objects.map(o => [o.o_id, o.otyp, o.ox, o.oy, o.quan, o.spe])});
        }};
        result = api.outputs(await api.runSegment({...part, storage: new api.InMemoryStorage()}));
    } finally {
        if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), prior);
    const plain = api.outputs(await api.runSegment({...part, storage: new api.InMemoryStorage()}));
    const deferred = await api.deferred(part);
    assert.deepEqual(result, plain); assert.deepEqual(result, deferred);
    assert.deepEqual(result.slices.flat(), result.calls);
    assert.equal(states.length, part.moves.length + 1);
    for (const key of ['screens', 'cursors', 'slices', 'frames']) assert.equal(result[key].length, part.moves.length + 1);
    return {output: result, states, hashes: api.hashes(result)};
}
try {
    for (const {id, part} of parts) {
        const before = await observe(apis.baseline, part);
        const after = await observe(apis.candidate, part);
        assert.deepEqual(after.states, before.states, part.name + ': gameplay states');
        for (const key of ['cursors', 'calls', 'slices', 'frames'])
            assert.deepEqual(after.output[key], before.output[key], part.name + ': ' + key);
        const fixed = load(`fixtures/${id}-334-source-report.json`).rows.find(r => r.name === part.name);
        assert.deepEqual(before.hashes, fixed.hashes, part.name + ': fixed334 baseline');
        const changedSteps = [], cells = [];
        for (let step = 0; step < before.output.screens.length; step++) {
            if (before.output.screens[step] === after.output.screens[step]) continue;
            changedSteps.push(step);
            const left = decodeScreen(before.output.screens[step]);
            const right = decodeScreen(after.output.screens[step]);
            for (let y = 0; y < 24; y++) for (let x = 0; x < 80; x++) {
                if (JSON.stringify(left[y][x]) !== JSON.stringify(right[y][x]))
                    cells.push({step, x, y, before: left[y][x], after: right[y][x]});
            }
        }
        const expected = expectedChanges.filter(x => x.name === part.name);
        assert.deepEqual(changedSteps, expected.map(x => x.step), part.name + ': changed screen steps');
        assert.deepEqual(cells, expected.map(x => ({step: x.step, x: x.x, y: x.y, before: x.before, after: x.C})),
                         part.name + ': complete styled-cell differences');
        const negative = load(`fixtures/${id}-negative-hashes.json`).controls.find(c => c.name === part.name);
        let legacyNegative = null;
        if (negative) {
            assert.deepEqual(before.hashes, negative.hashes, part.name + ': original five hashes preserved');
            const changedHashes = Object.keys(negative.hashes).filter(k => negative.hashes[k] !== after.hashes[k]);
            assert.deepEqual(changedHashes, part.name === 'fruit-text-menu-color-ascii-negative' ? ['screens'] : []);
            legacyNegative = {originalHashes: negative.hashes, newHashes: after.hashes, changedHashes,
                result: changedHashes.length ? 'FAIL: old screen hash retained; separate marker-color correction only' : 'PASS'};
        }
        rows.push({name: part.name, family: id, sourceAndDeltaPass: true,
            beforeHashes: before.hashes, afterHashes: after.hashes,
            boundaries: after.output.screens.length, calls: after.output.calls.length,
            changedSteps, cells, legacyNegative,
            observerPlainDeferredEqual: true, liveGameBindingAndRestoration: true, gameplayStatesEqual: true});
    }
    const report = {classification: 'All18 unchanged inputs, fixed334 versus one-owner prerequisite. JS-to-JS accounting only; parent owns native comparison. No output masks or fixture changes.',
        cases: rows.length, sourceAndDeltaPassed: rows.length,
        changedCases: rows.filter(r => r.cells.length).length,
        changedCells: rows.reduce((n, r) => n + r.cells.length, 0),
        legacyNegativeHashesUnchanged: 34, legacyNegativeHashesTotal: 35,
        legacyFailedNegative: 'fruit-text-menu-color-ascii-negative retains its original failing screen expectation', rows};
    fs.writeFileSync(new URL('reports/accounting.json', root), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
    console.log(JSON.stringify({cases: rows.length, sourceAndDeltaPassed: rows.length,
        changedCases: report.changedCases, changedCells: report.changedCells,
        legacyNegativeHashes: '34/35; old ASCII screen expectation explicitly FAILS'}));
} finally { clearTimeout(timer); }
