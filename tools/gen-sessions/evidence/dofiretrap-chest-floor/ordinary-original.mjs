import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('./', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => JSON.parse(readFileSync(new URL(name, root)));
const lock = read('input-lock.json');
for (const [name, digest] of Object.entries(lock.files))
    assert.equal(sha(readFileSync(new URL(name, root))), digest, name);
const runtime = read('runtime.json');
const verifyRuntime = () => {
    for (const [name, digest] of Object.entries(runtime))
        assert.equal(sha(readFileSync(new URL(name, root))), digest, name);
};
verifyRuntime();
for (const [name, digest] of Object.entries(read('source-pins.json')))
    assert.equal(sha(readFileSync(new URL('../../../' + name, root))), digest, name);
const recipe = read('recipe.json'), predictions = read('predictions.json');
assert.deepEqual(recipe.segments.map(s => lock.fields.map(field =>
    ({field, present: Object.hasOwn(s, field),
        ...(Object.hasOwn(s, field) ? {value: s[field]} : {})}))), lock.tuples);
assert.deepEqual(recipe.segments.map(s => [...s.moves].map(c => c.charCodeAt(0))), lock.keys);

const {runSegment} = await import('./js/jsmain.js');
const {InMemoryStorage} = await import('./js/storage.js');
const {ONAMES} = await import('./js/objects_data.js');
const {decodeScreen, renderCell} = await import('./frozen/screen-decode.mjs');
const {outputs, hashes, deferred} = await import('./tools/half-damage-reader-observe.mjs');
const snapshotObject = o => ({id: o.o_id, type: o.otyp, letter: o.invlet,
    where: o.where, lit: !!o.lamplit, age: o.age, cursed: !!o.cursed,
    trapped: !!o.otrapped, locked: !!o.olocked, xy: [o.ox, o.oy]});
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
            states.push({step, turn: g.moves, hp: g.u.uhp, maxHp: g.u.uhpmax,
                mortality: g.u.umortality || 0, gameover: !!g.program_state?.gameover,
                xy: [g.u.ux, g.u.uy], inventory: (g.invent || []).map(snapshotObject),
                floor: g.level.objectsAt(g.u.ux, g.u.uy).map(snapshotObject)});
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
    const before = states.find(s => s.step === p.before), after = states.at(-1);
    const lamp = state => state?.[p.lampWhere].find(o => o.type === ONAMES.OIL_LAMP);
    const chest = state => state?.[p.chestWhere].find(o => o.type === ONAMES.CHEST);
    const actionTexts = texts.slice(p.before + 1);
    const has = text => actionTexts.some(s => s.includes(text));
    check('producer', 'starting uncursed lamp is unlit and fueled at the selected location', () => {
        assert.ok(lamp(before)); assert.equal(lamp(before).lit, false);
        assert.equal(lamp(before).cursed, false); assert.ok(lamp(before).age > 0);
    });
    check('producer', 'actual trapped unlocked chest occupies the selected location', () => {
        assert.ok(chest(before)); assert.equal(chest(before).trapped, true);
        assert.equal(chest(before).locked, false);
    });
    check('producer', 'actual fire dispatch matches the predeclared action', () => {
        assert.equal(has('A tower of flame bursts from the chest!'), p.fire);
        assert.equal(has('You trigger a trap!'), p.fire);
    });
    check('producer', 'all inputs finish without death or relocation', () => {
        assert.equal(after.step, part.moves.length); assert.equal(out.screens.length, part.moves.length + 1);
        assert.deepEqual(out.slices.flat(), out.calls);
        assert.ok(states.every(s => s.hp > 0 && !s.mortality && !s.gameover));
        assert.deepEqual(after.xy, before.xy);
    });
    check('source', 'chest fire preserves ground fuel and may ignite carried fuel', () => {
        assert.ok(lamp(after)); assert.equal(lamp(after).id, lamp(before).id);
        assert.equal(lamp(after).lit, p.lampLitAfter);
    });
    check('source', 'lamp ignition feedback agrees with the source item path', () => {
        assert.equal(has('catches light!'), p.lampLitAfter);
    });
    check('source', 'opening spends only the chest trap; look preserves it', () => {
        assert.ok(chest(after)); assert.equal(chest(after).trapped, !p.fire);
    });
    const plain = structuredClone(outputs(await runSegment({...part, storage: new InMemoryStorage()})));
    const delayed = await deferred(part);
    check('neutrality', 'passive observation preserves all five streams', () => assert.deepEqual(out, plain));
    check('neutrality', 'deferred input preserves all five streams', () => assert.deepEqual(out, delayed));
    rows.push({index, negative: p.negative, checks, before, after,
        producer: checks.filter(c => c.kind === 'producer').every(c => c.pass),
        source: checks.filter(c => c.kind === 'source').every(c => c.pass),
        statesSHA256: sha(JSON.stringify(states)), outputHashes: hashes(out),
        actionCalls: out.slices.slice(p.before + 1).flat(), boundaries: out.screens.length,
        calls: out.calls.length, frames: out.frames.flat().length});
}
verifyRuntime();
const write = (name, data) => writeFileSync(new URL(name, root), JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
write('baseline-observation.json', rows);
write('negative-hashes.json', rows.filter(r => r.negative).map(r => ({index: r.index, outputHashes: r.outputHashes})));
const summary = {cases: rows.length, setupCases: rows.filter(r => r.producer).length,
    checksPassed: rows.flatMap(r => r.checks).filter(c => c.pass).length,
    checksTotal: rows.flatMap(r => r.checks).length,
    setupFailedIndexes: rows.filter(r => !r.producer).map(r => r.index),
    sourceFailedIndexes: rows.filter(r => !r.source).map(r => r.index),
    neutrality: rows.flatMap(r => r.checks).filter(c => c.kind === 'neutrality' && c.pass).length,
    negativeIndexes: [1, 2], negativeHashes: 10, nativeRecordings: 0, runtimeCandidate: false};
write('summary.json', summary);
console.log(JSON.stringify(summary));
if (summary.checksPassed !== summary.checksTotal) process.exitCode = 1;
