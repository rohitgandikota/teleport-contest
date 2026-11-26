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
assert.deepEqual(recipe.segments.map(part => Array.from(part.moves, c => c.charCodeAt(0))), lock.keys);

const {runSegment} = await import('./js/jsmain.js');
const {InMemoryStorage} = await import('./js/storage.js');
const {PMNAMES} = await import('./js/monst_data.js');
const {FIRE_TRAP, ROOM, POOL} = await import('./js/const.js');
const {Underwater, Fire_resistance, Swimming, Breathless, Blind, Flying, Levitation, Fumbling} = await import('./js/youprop.js');
const {can_reach_floor} = await import('./js/pickup.js');
const {decodeScreen, renderCell} = await import('./frozen/screen-decode.mjs');
const {outputs, hashes, deferred} = await import('./tools/half-damage-reader-observe.mjs');
const cure = 'The slime that covers you is burned away!';
const steam = 'A cascade of steamy bubbles erupts';
const flame = 'A tower of flame erupts';
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
            const trap = g.level.traps.find(t => t.tx === g.u.ux && t.ty === g.u.uy);
            states.push({step, turn: g.moves, form: g.u.umonnum,
                hp: g.u.uhp, hpmax: g.u.uhpmax, mh: g.u.mh, mhmax: g.u.mhmax,
                mortality: g.u.umortality || 0, gameover: !!g.program_state?.gameover,
                xy: [g.u.ux, g.u.uy], terrain: g.level.at(g.u.ux, g.u.uy).typ,
                underwater: !!Underwater(), uinwater: !!g.u.uinwater,
                resistant: !!Fire_resistance(), swimming: !!Swimming(), breathless: !!Breathless(),
                blind: !!Blind(), flying: !!Flying(), levitating: !!Levitation(), fumbling: !!Fumbling(),
                canReachFloor: !!can_reach_floor(false), utrap: g.u.utrap || 0,
                slime: g.u.uprops?.SLIMED || 0, gloves: g.u.uarmg?.otyp ?? null,
                inventory: (g.invent || []).map(o => ({id: o.o_id, type: o.otyp, count: o.quan, worn: o.owornmask || 0})),
                floor: g.level.objectsAt(g.u.ux, g.u.uy).map(o => ({id: o.o_id, type: o.otyp, count: o.quan})),
                trap: trap ? {type: trap.ttyp, seen: !!trap.tseen} : null,
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
    const at = step => states.find(s => s.step === step);
    const phases = Object.fromEntries(Object.entries(p.boundaries).map(([name, step]) => [name, at(step)]));
    const before = phases.beforeAction, after = states.at(-1);
    const actionTexts = texts.slice(p.boundaries.beforeAction + 1);
    const actionCalls = out.slices.slice(p.boundaries.beforeAction + 1).flat();
    const actionFrames = out.frames.slice(p.boundaries.beforeAction + 1).flat().length;
    const has = text => actionTexts.some(s => s.includes(text));
    check('producer', 'real cleanup reaches empty room square with no living monster', () => {
        assert.deepEqual(phases.cleanup.xy, p.xy); assert.equal(phases.cleanup.terrain, ROOM);
        assert.equal(phases.cleanup.liveMonsters, 0); assert.deepEqual(phases.cleanup.floor, []);
        assert.deepEqual(phases.cleanup.inventory, []);
    });
    check('producer', 'actual form supplies the intended resistance and safe-water properties', () => {
        assert.equal(before.form, PMNAMES[p.form]); assert.equal(before.resistant, p.resistant);
        assert.equal(before.swimming, p.swimming); assert.equal(before.breathless, true);
        assert.equal(before.blind, p.blind); assert.ok(before.mh > 12);
    });
    check('producer', 'unseen fire trap is created on dry floor before any pool', () => {
        assert.equal(phases.trap.terrain, ROOM);
        assert.deepEqual(phases.trap.trap, {type: FIRE_TRAP, seen: false});
        assert.deepEqual(phases.trap.floor, []); assert.equal(phases.trap.underwater, false);
    });
    check('producer', 'real wait establishes water state and separates iron entry rust', () => {
        assert.equal(phases.settled.underwater, p.wet); assert.equal(phases.settled.uinwater, p.wet);
        assert.equal(phases.settled.terrain, p.wet ? POOL : ROOM);
        if (p.wet && p.resistant) assert.ok(phases.settled.mhmax < phases.trap.mhmax);
        else assert.equal(phases.settled.mhmax, phases.trap.mhmax);
    });
    check('producer', 'action starts with actual pool/trap and no floor or equipment interception', () => {
        assert.equal(before.underwater, p.wet); assert.equal(before.uinwater, p.wet);
        assert.equal(before.terrain, p.wet ? POOL : ROOM); assert.deepEqual(before.xy, p.xy);
        assert.deepEqual(before.trap, {type: FIRE_TRAP, seen: false});
        assert.deepEqual(before.inventory, []); assert.deepEqual(before.floor, []);
        assert.equal(before.gloves, null); assert.equal(before.fumbling, false);
        assert.equal(before.canReachFloor, true); assert.equal(before.levitating, false);
        assert.equal(before.flying, false); assert.equal(before.utrap, 0); assert.equal(before.liveMonsters, 0);
    });
    check('producer', 'real intrinsic menu gives timer100 and no fire occurred during setup', () => {
        assert.equal(before.slime, 100);
        assert.ok(texts.slice(0, p.boundaries.beforeAction + 1).some(t => t.includes('You are turning into slime.')));
        assert.ok(!texts.slice(0, p.boundaries.beforeAction + 1).some(t => t.includes(flame) || t.includes(steam)));
    });
    check('producer', 'all ordinary keys finish without death, rehumanization or displacement', () => {
        assert.equal(after.step, part.moves.length); assert.equal(out.screens.length, part.moves.length + 1);
        assert.deepEqual(out.slices.flat(), out.calls);
        assert.ok(states.every(s => s.hp > 0 && !s.mortality && !s.gameover));
        assert.equal(after.form, PMNAMES[p.form]); assert.ok(after.mh > 0);
        assert.deepEqual(after.xy, p.xy); assert.deepEqual(after.inventory, []); assert.deepEqual(after.floor, []);
    });
    check('source', 'sit actually triggers and reveals the trap while look does not', () => {
        assert.equal(has(flame) || has(steam), p.trigger);
        assert.deepEqual(after.trap, {type: FIRE_TRAP, seen: p.trigger});
    });
    check('source', 'steamy bubbles occur exactly for underwater fire', () => assert.equal(has(steam), p.expectedCSteam));
    check('source', 'flame feedback occurs only for dry fire', () => assert.equal(has(flame), p.expectedCFlame));
    check('source', 'underwater return retains slime apart from elapsed turns; dry fire cures', () => {
        if (!p.trigger) assert.equal(after.slime, 100);
        else if (p.wet) {
            assert.ok(after.slime > 0);
            assert.equal(after.slime, before.slime - (after.turn - before.turn));
        } else assert.equal(after.slime, 0);
    });
    check('source', 'slime cure feedback occurs only for dry fire', () => assert.equal(has(cure), p.expectedCCure));
    check('source', 'underwater fire preserves maximum and applies only the source boiling-water damage', () => {
        assert.equal(after.hpmax, before.hpmax); assert.equal(after.hp, before.hp);
        if (p.wet || !p.trigger) assert.equal(after.mhmax, before.mhmax);
        if (!p.trigger || (p.wet && p.resistant)) assert.equal(after.mh, before.mh);
        else if (p.wet) assert.ok(after.mh >= before.mh - 3 && after.mh <= before.mh);
        else assert.ok(after.mhmax <= before.mhmax && after.mh <= before.mh);
    });
    check('source', 'source trap RNG prefix is preserved without filtering world-turn calls', () => {
        if (!p.trigger) assert.deepEqual(actionCalls, []);
        for (const [i, call] of p.expectedCTrapRngPrefix.entries())
            assert.ok(actionCalls[i]?.startsWith(call + '='), `${call}: ${actionCalls[i]}`);
    });
    check('source', 'underwater return has no shield animation', () => {
        if (!p.wet && p.trigger && p.resistant) assert.ok(actionFrames > 0);
        else assert.equal(actionFrames, 0);
    });
    const plain = structuredClone(outputs(await runSegment({...part, storage: new InMemoryStorage()})));
    const delayed = await deferred(part);
    check('neutrality', 'passive observer preserves all five streams', () => assert.deepEqual(out, plain));
    check('neutrality', 'deferred input preserves all five streams', () => assert.deepEqual(out, delayed));
    rows.push({index, name: part.name, negative: p.negative, checks,
        producer: checks.filter(c => c.kind === 'producer').every(c => c.pass),
        source: checks.filter(c => c.kind === 'source').every(c => c.pass),
        phases, before, after, actionCalls, actionFrames,
        statesSHA256: sha(JSON.stringify(states)), outputHashes: hashes(out),
        boundaries: out.screens.length, calls: out.calls.length, frames: out.frames.flat().length});
    console.log(JSON.stringify({index, name: part.name, producer: rows.at(-1).producer,
        source: rows.at(-1).source, failed: checks.filter(c => !c.pass).map(c => c.name)}));
}
verifyRuntime();
const write = (name, value) => writeFileSync(new URL(name, root), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
write('baseline-observation.json', rows);
write('negative-hashes.json', rows.filter(r => r.negative).map(r => ({index: r.index, outputHashes: r.outputHashes})));
const summary = {cases: rows.length, setupCases: rows.filter(r => r.producer).length,
    producerChecks: rows.flatMap(r => r.checks).filter(c => c.kind === 'producer' && c.pass).length, producerTotal: 42,
    sourceChecks: rows.flatMap(r => r.checks).filter(c => c.kind === 'source' && c.pass).length, sourceTotal: 48,
    neutrality: rows.flatMap(r => r.checks).filter(c => c.kind === 'neutrality' && c.pass).length,
    checksPassed: rows.flatMap(r => r.checks).filter(c => c.pass).length, checksTotal: 102,
    setupFailedIndexes: rows.filter(r => !r.producer).map(r => r.index),
    sourceFailedIndexes: rows.filter(r => !r.source).map(r => r.index),
    reachedSourceFailures: rows.filter(r => r.producer && !r.source).map(r => r.index),
    negativeIndexes: [2, 3, 4, 5], negativeHashes: 20,
    keys: recipe.segments.reduce((n, s) => n + s.moves.length, 0),
    boundaries: rows.reduce((n, r) => n + r.boundaries, 0), calls: rows.reduce((n, r) => n + r.calls, 0),
    frames: rows.reduce((n, r) => n + r.frames, 0), nativeRecordings: 0, runtimeCandidate: false};
write('summary.json', summary);
console.log(JSON.stringify(summary));
if (summary.checksPassed !== summary.checksTotal) process.exitCode = 1;
