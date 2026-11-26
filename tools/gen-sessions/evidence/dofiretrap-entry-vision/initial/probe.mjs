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
const {PMNAMES} = await import('./js/monst_data.js');
const {FIRE_TRAP, ROOM, OBJ_INVENT, OBJ_FLOOR} = await import('./js/const.js');
const {Blind, Fire_resistance, Underwater, Fumbling, Flying, Levitation} = await import('./js/youprop.js');
const {decodeScreen, renderCell} = await import('./frozen/screen-decode.mjs');
const {outputs, hashes, deferred} = await import('./tools/half-damage-reader-observe.mjs');
const snapshotObject = o => ({id: o.o_id, type: o.otyp, count: o.quan,
    letter: o.invlet, where: o.where, worn: o.owornmask || 0,
    blessed: !!o.blessed, cursed: !!o.cursed});
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
            states.push({step, turn: g.moves, hp: g.u.uhp, maxHp: g.u.uhpmax,
                mh: g.u.mh, mhmax: g.u.mhmax, form: g.u.umonnum,
                mortality: g.u.umortality || 0, gameover: !!g.program_state?.gameover,
                xy: [g.u.ux, g.u.uy], terrain: g.level.at(g.u.ux, g.u.uy).typ,
                blind: !!Blind(), blinded: g.u.intrinsic?.HBlinded || 0,
                fireResistant: !!Fire_resistance(), underwater: !!Underwater(),
                fumbling: !!Fumbling(), flying: !!Flying(), levitating: !!Levitation(),
                trap: trap ? {type: trap.ttyp, seen: !!trap.tseen} : null,
                liveMonsters: g.level.monsters.filter(m => m.mhp > 0).length,
                inventory: (g.invent || []).map(snapshotObject),
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
    const during = states.filter(s => s.step > p.before);
    const actionTexts = texts.slice(p.before + 1);
    const has = text => actionTexts.some(s => s.includes(text));
    const paper = s => s?.floor.find(o => o.type === ONAMES.SCR_AMNESIA);
    const potionType = p.potion === 'blindness' ? ONAMES.POT_BLINDNESS : ONAMES.POT_FRUIT_JUICE;
    const potions = s => s?.inventory.find(o => o.type === potionType);
    check('producer', 'real sighted iron form waits on the dry unseen fire trap', () => {
        assert.deepEqual(before.xy, [58, 6]); assert.equal(before.terrain, ROOM);
        assert.equal(before.form, PMNAMES.PM_IRON_GOLEM); assert.ok(before.mh > 12);
        assert.equal(before.blind, false); assert.equal(before.fireResistant, true);
        assert.equal(before.underwater, false); assert.equal(before.liveMonsters, 0);
        assert.deepEqual(before.trap, {type: FIRE_TRAP, seen: false});
        assert.equal(before.fumbling || before.flying || before.levitating, false);
    });
    check('producer', 'twelve real paper scrolls occupy the trap square', () => {
        assert.equal(before.floor.length, 1); assert.equal(paper(before).count, 12);
        assert.equal(paper(before).where, OBJ_FLOOR);
        assert.equal(paper(before).blessed || paper(before).cursed, false);
    });
    check('producer', 'twenty unprotected carried potions have the selected type', () => {
        assert.equal(before.inventory.length, 1); assert.equal(potions(before).count, 20);
        assert.equal(potions(before).where, OBJ_INVENT); assert.equal(potions(before).worn, 0);
        assert.equal(potions(before).blessed || potions(before).cursed, false);
    });
    check('producer', 'ordinary movement returns to the trap and produces the declared fire', () => {
        assert.equal(has('A tower of flame erupts'), p.fire);
        assert.equal(during.some(s => s.xy[0] === 59 && s.xy[1] === 6), p.fire);
        assert.deepEqual(after.xy, before.xy);
        assert.deepEqual(after.trap, {type: FIRE_TRAP, seen: p.fire});
    });
    check('producer', 'fire actually consumes carried potions and floor paper', () => {
        const remainingPotions = potions(after)?.count || 0;
        const remainingPaper = paper(after)?.count || 0;
        if (p.fire) {
            assert.ok(remainingPotions < 20); assert.ok(remainingPaper < 12);
            assert.equal(has('boil and explode!') || has('boils and explodes!'), true);
        } else {
            assert.equal(remainingPotions, 20); assert.equal(remainingPaper, 12);
        }
    });
    check('producer', 'only actual blindness vapor changes the entry vision', () => {
        assert.equal(has('It suddenly gets dark.'), p.dark);
        assert.equal(during.some(s => s.blind && s.blinded > 0), p.dark);
    });
    check('producer', 'all inputs finish with the hero alive in the same form', () => {
        assert.equal(after.step, part.moves.length); assert.equal(out.screens.length, part.moves.length + 1);
        assert.deepEqual(out.slices.flat(), out.calls);
        assert.ok(states.every(s => s.hp > 0 && !s.mortality && !s.gameover));
        assert.equal(after.form, PMNAMES.PM_IRON_GOLEM); assert.ok(after.mh > 0);
    });
    check('source', 'entry sight retains visible paper-burning feedback', () => {
        assert.equal(has(' burn.') || has(' burns.'), p.fire);
    });
    check('source', 'a sighted entry never substitutes paper-smell feedback', () => {
        assert.equal(has('You smell paper burning.'), false);
    });
    check('source', 'look keeps vision, objects and world time unchanged', () => {
        if (!p.fire) {
            assert.equal(after.blind, before.blind); assert.equal(after.turn, before.turn);
            assert.deepEqual(after.floor, before.floor); assert.deepEqual(after.inventory, before.inventory);
        }
    });
    const plain = structuredClone(outputs(await runSegment({...part, storage: new InMemoryStorage()})));
    const delayed = await deferred(part);
    check('neutrality', 'passive observation preserves all five streams', () => assert.deepEqual(out, plain));
    check('neutrality', 'deferred input preserves all five streams', () => assert.deepEqual(out, delayed));
    rows.push({index, name: part.name, negative: p.negative, checks, before, after, during,
        producer: checks.filter(c => c.kind === 'producer').every(c => c.pass),
        source: checks.filter(c => c.kind === 'source').every(c => c.pass),
        actionMessages: [...new Set(actionTexts.map(t => t.split('\n')[0]))],
        statesSHA256: sha(JSON.stringify(states)), outputHashes: hashes(out),
        actionCalls: out.slices.slice(p.before + 1).flat(), boundaries: out.screens.length,
        calls: out.calls.length, frames: out.frames.flat().length});
    console.log(JSON.stringify({index, failed: checks.filter(c => !c.pass)}));
}
verifyRuntime();
const write = (name, data) => writeFileSync(new URL(name, root), JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
write('baseline-observation.json', rows);
write('negative-hashes.json', rows.filter(r => r.negative).map(r => ({index: r.index, outputHashes: r.outputHashes})));
const checks = rows.flatMap(r => r.checks);
const summary = {cases: rows.length, setupCases: rows.filter(r => r.producer).length,
    checksPassed: checks.filter(c => c.pass).length, checksTotal: checks.length,
    setupFailedIndexes: rows.filter(r => !r.producer).map(r => r.index),
    sourceFailedIndexes: rows.filter(r => !r.source).map(r => r.index),
    neutrality: checks.filter(c => c.kind === 'neutrality' && c.pass).length,
    negativeIndexes: [1, 2], negativeHashes: 10, nativeRecordings: 0, runtimeCandidate: false};
write('summary.json', summary);
console.log(JSON.stringify(summary));
if (summary.checksPassed !== summary.checksTotal) process.exitCode = 1;
