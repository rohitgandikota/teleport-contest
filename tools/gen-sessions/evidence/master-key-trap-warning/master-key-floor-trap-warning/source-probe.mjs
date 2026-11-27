import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {root, read, verifyRuntime} from './preflight.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const recipe = read('recipe.json'), predictions = read('predictions.json');
// Only the source pin/preflight prefix is relocated; all runtime imports,
// passive observations, assertion bodies and output bookkeeping below are exact.
const {runSegment} = await import('./js/jsmain.js');
const {InMemoryStorage} = await import('./js/storage.js');
const {ONAMES} = await import('./js/objects_data.js');
const {ART_MASTER_KEY_OF_THIEVERY} = await import('./js/artilist_data.js');
const {ARROW_TRAP, ROOM, D_TRAPPED, OBJ_INVENT, W_WEP, W_ARMG} = await import('./js/const.js');
const {Blind} = await import('./js/youprop.js');
const {glyph_at, glyph_is_trap} = await import('./js/display.js');
const {isok} = await import('./js/hacklib.js');
const {decodeScreen, renderCell} = await import('./frozen/screen-decode.mjs');
const {outputs, hashes, deferred} = await import('./tools/half-damage-reader-observe.mjs');
const snapshotObject = o => o ? {id: o.o_id, type: o.otyp, count: o.quan,
    letter: o.invlet, where: o.where, worn: o.owornmask || 0,
    artifact: o.oartifact || 0, trapped: !!o.otrapped,
    blessed: !!o.blessed, cursed: !!o.cursed} : null;
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
            const neighbors = [];
            for (let x = g.u.ux - 1; x <= g.u.ux + 1; x++)
                for (let y = g.u.uy - 1; y <= g.u.uy + 1; y++) {
                    if (!isok(x, y)) continue;
                    const cell = g.level.at(x, y);
                    const trap = g.level.traps.find(t => t.tx === x && t.ty === y);
                    neighbors.push({xy: [x, y], terrain: cell.typ,
                        doorMask: cell.doormask || 0, glyph: glyph_at(x, y),
                        shownTrap: !!glyph_is_trap(glyph_at(x, y)),
                        trap: trap ? {type: trap.ttyp, seen: !!trap.tseen} : null,
                        objects: g.level.objectsAt(x, y).map(snapshotObject)});
                }
            states.push({step, turn: g.moves, hp: g.u.uhp, maxHp: g.u.uhpmax,
                mortality: g.u.umortality || 0, gameover: !!g.program_state?.gameover,
                xy: [g.u.ux, g.u.uy], blind: !!Blind(),
                // The C global starts at zero; the absent JS owner has no counter yet.
                warningCount: g.mkot_trap_warn_count ?? 0,
                weapon: snapshotObject(g.u.uwep), gloves: snapshotObject(g.u.uarmg),
                liveMonsters: g.level.monsters.filter(m => m.mhp > 0).length,
                inventory: (g.invent || []).map(snapshotObject), neighbors});
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
    const before = at(p.before), first = at(p.firstEnd), after = states.at(-1);
    const firstTexts = texts.slice(p.before + 1, p.firstEnd + 1);
    const secondTexts = texts.slice(p.firstEnd + 1);
    const hasWarning = text => text.includes('The Key feels');
    const key = s => s?.inventory.find(o => o.type === ONAMES.SKELETON_KEY);
    check('producer', 'real acquired key has the declared artifact identity and location', () => {
        assert.ok(key(before)); assert.equal(key(before).count, 1);
        assert.equal(key(before).where, OBJ_INVENT); assert.equal(key(before).letter, 'b');
        assert.equal(key(before).artifact, p.artifact ? ART_MASTER_KEY_OF_THIEVERY : 0);
        assert.equal(key(before).blessed, true); assert.equal(key(before).cursed, false);
    });
    check('producer', 'actual wielded slot matches the key or stays empty', () => {
        if (p.held) {
            assert.equal(before.weapon.id, key(before).id);
            assert.ok(before.weapon.worn & W_WEP);
        } else assert.equal(before.weapon, null);
    });
    check('producer', 'actual gloves match the declared bare-hand control', () => {
        if (p.gloves) {
            assert.equal(before.gloves.type, ONAMES.LEATHER_GLOVES);
            assert.ok(before.gloves.worn & W_ARMG);
        } else assert.equal(before.gloves, null);
    });
    check('producer', 'one real hidden or covered arrow trap occupies the hero square', () => {
        assert.deepEqual(before.xy, p.xy); assert.equal(before.blind, false);
        assert.equal(before.neighbors.find(n => n.xy[0] === p.xy[0] && n.xy[1] === p.xy[1]).terrain, ROOM);
        const trapped = before.neighbors.filter(n => n.trap);
        assert.equal(trapped.length, 1); assert.deepEqual(trapped[0].xy, p.xy);
        assert.deepEqual(trapped[0].trap, {type: ARROW_TRAP, seen: p.known});
        assert.equal(trapped[0].shownTrap, false);
        assert.ok(before.neighbors.every(n => !(n.doorMask & D_TRAPPED)));
        assert.ok(before.neighbors.every(n => n.objects.length === 0));
    });
    check('producer', 'warning window begins before a world turn can check the new trap', () => {
        assert.equal(before.warningCount, 0);
        assert.equal(texts.slice(0, p.before + 1).some(hasWarning), false);
        assert.equal(before.liveMonsters, 0);
    });
    check('producer', 'both real waits complete and preserve the trap and equipment', () => {
        assert.ok(first.turn > before.turn); assert.ok(after.turn > first.turn);
        assert.deepEqual(after.xy, before.xy); assert.deepEqual(after.weapon, before.weapon);
        assert.deepEqual(after.gloves, before.gloves); assert.deepEqual(after.inventory, before.inventory);
        assert.deepEqual(after.neighbors.filter(n => n.trap).map(n => n.trap),
            before.neighbors.filter(n => n.trap).map(n => n.trap));
    });
    check('producer', 'all ordinary inputs finish with the hero alive', () => {
        assert.equal(after.step, part.moves.length); assert.equal(out.screens.length, part.moves.length + 1);
        assert.deepEqual(out.slices.flat(), out.calls);
        assert.ok(states.every(s => s.hp > 0 && !s.mortality && !s.gameover));
    });
    check('source', 'only a bare wielded artifact key reports the nearby trap', () => {
        assert.equal(firstTexts.some(t => t.includes('The Key feels slightly warm.')), p.warning);
    });
    check('source', 'the remembered count follows the actual warning condition', () => {
        assert.equal(first.warningCount, p.warning ? 1 : 0);
        assert.equal(after.warningCount, p.warning ? 1 : 0);
    });
    check('source', 'an unchanged count emits no repeated warning on the second wait', () => {
        assert.equal(secondTexts.some(hasWarning), false);
    });
    const plain = structuredClone(outputs(await runSegment({...part, storage: new InMemoryStorage()})));
    const delayed = await deferred(part);
    check('neutrality', 'passive observation preserves all five streams', () => assert.deepEqual(out, plain));
    check('neutrality', 'deferred input preserves all five streams', () => assert.deepEqual(out, delayed));
    rows.push({index, name: part.name, negative: p.negative, checks, before, first, after,
        producer: checks.filter(c => c.kind === 'producer').every(c => c.pass),
        source: checks.filter(c => c.kind === 'source').every(c => c.pass),
        firstMessages: [...new Set(firstTexts.map(t => t.split('\n')[0]))],
        secondMessages: [...new Set(secondTexts.map(t => t.split('\n')[0]))],
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
    negativeIndexes: [2, 3, 4], negativeHashes: 15, nativeRecordings: 0, runtimeCandidate: false};
write('summary.json', summary);
console.log(JSON.stringify(summary));
if (summary.checksPassed !== summary.checksTotal) process.exitCode = 1;
