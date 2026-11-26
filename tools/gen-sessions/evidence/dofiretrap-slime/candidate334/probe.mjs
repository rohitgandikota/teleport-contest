// Candidate bookkeeping only; the original imports, passive observer and assertion loop follow verbatim.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {root, sha, read, verifyRuntime, recipe, predictions} from './preflight.mjs';

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
writeFileSync(new URL('reports/candidate-observation.json', root), JSON.stringify(rows, null, 2) + '\n', {flag: 'wx'});
const negatives = rows.filter(r => r.negative);
writeFileSync(new URL('reports/negative-hashes.json', root), JSON.stringify(negatives
    .map(r => ({index: r.index, outputHashes: r.outputHashes})), null, 2) + '\n', {flag: 'wx'});
assert.deepEqual(negatives, read('history/source-baseline-observation.json').filter(r => r.negative));
assert.deepEqual(read('reports/negative-hashes.json'), read('negative-hashes.json'));
assert.equal(rows.flatMap(r => r.checks).length, 54);
assert.ok(rows.every(r => r.checks.every(c => c.pass)), 'all 54 original checks');
console.log(JSON.stringify({ordinaryCases: rows.length, passedChecks: 54, totalChecks: 54,
    producerChecks: 24, sourceChecks: 18, neutrality: 12,
    negativeHashes: 20, fullNegativeRows: 4, existingHealthyHashesExact: 10}));
