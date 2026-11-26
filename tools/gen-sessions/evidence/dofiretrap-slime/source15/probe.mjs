import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('./', import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const read = name => JSON.parse(readFileSync(new URL(name, root)));
const lock = read('input-lock.json');
for (const [name, digest] of Object.entries(lock.files))
    assert.equal(sha(readFileSync(new URL(name, root))), digest, name);
assert.equal(sha(readFileSync(new URL('probe.mjs', root))), lock.probeSHA256);
const runtime = read('runtime.json');
const verifyRuntime = () => {
    assert.equal(Object.keys(runtime).length, 280);
    for (const [name, digest] of Object.entries(runtime))
        assert.equal(sha(readFileSync(new URL(name, root))), digest, name);
};
verifyRuntime();
for (const [name, digest] of Object.entries(read('source-pins.json')))
    assert.equal(sha(readFileSync(name)), digest, name);
const recipe = read('recipe.json'), predictions = read('predictions.json');
assert.deepEqual(recipe.segments.map(part => lock.fields.map(field =>
    ({field, present: Object.hasOwn(part, field), value: part[field]}))), lock.tuples);
const {runSegment} = await import('./js/jsmain.js');
const {InMemoryStorage} = await import('./js/storage.js');
const {PMNAMES} = await import('./js/monst_data.js');
const {ONAMES} = await import('./js/objects_data.js');
const {FIRE_TRAP, ROOM, W_ARMG} = await import('./js/const.js');
const {Fire_resistance, Fumbling, Underwater, Blind} = await import('./js/youprop.js');
const {decodeScreen, renderCell} = await import('./frozen/screen-decode.mjs');
const {outputs, hashes, deferred} = await import('./tools/half-damage-reader-observe.mjs');
const existing = read('existing-healthy-hashes.json');
const cure = 'The slime that covers you is burned away!';
const rows = [];
for (const [index, part] of recipe.segments.entries()) {
    const p = predictions[index], states = [], checks = [];
    const check = (kind, name, fn) => {
        try { fn(); checks.push({kind, name, pass: true}); }
        catch (error) { checks.push({kind, name, pass: false, error: error.message}); }
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            if (!g.u || !g.level) return;
            states.push({step, turn: g.moves, form: g.u.umonnum,
                hp: g.u.uhp, hpmax: g.u.uhpmax, mh: g.u.mh, mhmax: g.u.mhmax,
                mortality: g.u.umortality || 0, slime: g.u.uprops?.SLIMED || 0,
                xy: [g.u.ux, g.u.uy], terrain: g.level.at(g.u.ux, g.u.uy).typ,
                resistant: !!Fire_resistance(), fumbling: !!Fumbling(),
                underwater: !!Underwater(), blind: !!Blind(),
                gloves: g.u.uarmg ? {type: g.u.uarmg.otyp, worn: g.u.uarmg.owornmask} : null,
                trap: g.level.traps.find(t => t.tx === g.u.ux && t.ty === g.u.uy)?.ttyp ?? null,
                liveMonsters: g.level.monsters.filter(m => m.mhp > 0).length});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const out = structuredClone(outputs(run));
    const texts = out.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    const before = states.find(s => s.step === p.actionStart), after = states.at(-1);
    check('producer', 'actual fire trap and safe floor reached after cleanup', () => {
        assert.equal(before.trap, FIRE_TRAP); assert.equal(before.terrain, ROOM);
        assert.deepEqual(before.xy, [58, 6]); assert.equal(before.liveMonsters, 0);
        assert.equal(before.underwater, false); assert.equal(before.blind, false);
    });
    check('producer', 'actual form, resistance and worn fumbling gloves', () => {
        assert.equal(before.form, PMNAMES[p.form]); assert.ok(before.mh > 0);
        assert.equal(before.resistant, p.resistant); assert.equal(before.fumbling, true);
        assert.equal(before.gloves.type, ONAMES.GAUNTLETS_OF_FUMBLING);
        assert.ok(before.gloves.worn & W_ARMG);
    });
    check('producer', 'requested timed slime or healthy condition exists before action', () => {
        assert.equal(before.slime, p.slimed ? 100 : 0);
        assert.equal(texts.some(t => t.includes('You are turning into slime.')), p.slimed);
    });
    check('producer', 'all inputs consumed with no death or rehumanization', () => {
        assert.equal(after.step, part.moves.length); assert.equal(out.screens.length, part.moves.length + 1);
        assert.deepEqual(out.slices.flat(), out.calls);
        assert.ok(states.every(s => s.hp > 0 && !s.mortality));
        assert.equal(after.form, PMNAMES[p.form]); assert.ok(after.mh > 0);
    });
    check('source', 'only a sit action triggers the fire trap', () =>
        assert.equal(texts.some(t => t.includes('A tower of flame erupts')), p.trigger));
    check('source', 'fire clears the timer, while look preserves it', () =>
        assert.equal(after.slime, p.expectedCSlime));
    check('source', 'cure feedback occurs only for slimed fire triggers', () =>
        assert.equal(texts.some(t => t.includes(cure)), p.slimed && p.trigger));
    const plain = structuredClone(outputs(await runSegment({...part, storage: new InMemoryStorage()})));
    const delayed = await deferred(part);
    check('neutrality', 'passive observer preserves all five streams', () => assert.deepEqual(out, plain));
    check('neutrality', 'deferred input preserves all five streams', () => assert.deepEqual(out, delayed));
    const outputHashes = hashes(out);
    if (Object.hasOwn(existing, index)) assert.deepEqual(outputHashes, existing[index]);
    rows.push({index, name: part.name, negative: p.negative, checks, before, after,
        producer: checks.filter(c => c.kind === 'producer').every(c => c.pass),
        source: checks.filter(c => c.kind === 'source').every(c => c.pass),
        statesSHA256: sha(JSON.stringify(states)), outputHashes,
        boundaries: out.screens.length, calls: out.calls.length, frames: out.frames.flat().length});
}
verifyRuntime();
writeFileSync(new URL('baseline-observation.json', root), JSON.stringify(rows, null, 2) + '\n', {flag: 'wx'});
writeFileSync(new URL('negative-hashes.json', root), JSON.stringify(rows.filter(r => r.negative)
    .map(r => ({index: r.index, outputHashes: r.outputHashes})), null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({cases: rows.length, producers: rows.filter(r => r.producer).length,
    source: rows.filter(r => r.source).length, passedChecks: rows.flatMap(r => r.checks).filter(c => c.pass).length,
    totalChecks: rows.flatMap(r => r.checks).length,
    neutrality: rows.flatMap(r => r.checks).filter(c => c.kind === 'neutrality' && c.pass).length,
    negativeHashes: 20, existingHealthyHashesExact: 10}));
