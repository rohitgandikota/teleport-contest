// Actual wizard inputs for C do.c:560-561, 579, 645 and 649.
// Run: node tools/sink-ring-disposal-boundaries-input-gate.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { Blind } from '../js/youprop.js';
import { ONAMES } from '../js/objects_data.js';
import { ART_MAGICBANE } from '../js/artilist_data.js';
import { COLNO, ROWNO, ROOM, SINK, THRONE,
    OBJ_FLOOR, OBJ_INVENT, OBJ_BURIED, OBJ_DELETED } from '../js/const.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/sink-ring-disposal-boundaries.json', import.meta.url)));
const cases = [
    ['hunger-punishment-artifact', ONAMES.RIN_HUNGER],
    ['blind-teleport-success', ONAMES.RIN_TELEPORTATION],
    ['air-teleport-failure', ONAMES.RIN_TELEPORTATION],
    ['polymorph-zero-disposition', ONAMES.RIN_POLYMORPH],
];
assert.deepEqual(recipe.segments.map(s => s.name), cases.map(([name]) => name));
const object = o => o && ({id:o.o_id, type:o.otyp, artifact:o.oartifact || 0,
    where:o.where, inUse:!!o.in_use});
const hooks = ['__step_snapshot', '__rng_trace_sites'];

for (const [index, [name, type]] of cases.entries()) {
    const states = [];
    let ring, run;
    const previous = hooks.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
    try {
        globalThis.__rng_trace_sites = false;
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            ring ||= (g.invent || []).find(o => o.otyp === type);
            const x = g.u.ux, y = g.u.uy, sinks = [];
            let roomTiles = 0;
            for (let cx = 1; cx < COLNO; cx++) for (let cy = 0; cy < ROWNO; cy++) {
                const terrain = g.level.at(cx, cy).typ;
                if (terrain === SINK) sinks.push([cx, cy]);
                if (terrain === ROOM) roomTiles++;
            }
            states[step] = {x, y, hp:g.u.uhp, blind:!!Blind(),
                terrain:g.level.at(x,y).typ, roomTiles, sinks,
                ball:object(g.u.uball), chain:object(g.u.uchain),
                floor:g.level.objectsAt(x,y).map(object), ring:object(ring)};
            // Naming can pause after the sink changes. Keep tracing enabled.
            globalThis.__rng_trace_sites = !!ring;
        }};
        run = await runSegment({...recipe.segments[index], storage:new InMemoryStorage()});
    } finally {
        for (const [i, key] of hooks.entries()) {
            if (previous[i]) Object.defineProperty(globalThis, key, previous[i]);
            else delete globalThis[key];
        }
    }
    assert.deepEqual(hooks.map(key => Object.getOwnPropertyDescriptor(globalThis, key)), previous);
    const screens = run.getScreens(), calls = run.getRngSlices().flat();
    const owned = calls.filter(call => / @js\/do\.js:/.test(call));
    const drop = screens.findIndex(screen => screen.includes('down the drain.'));
    assert.ok(drop > 0, name + ' reaches dosinkring');
    const before = states[drop - 1], last = states.at(-1);
    assert.equal(before.terrain, SINK);
    assert.equal(before.ring.type, type);
    assert.equal(before.ring.where, OBJ_INVENT);
    assert.ok(last.hp > 0);
    const disposition = owned.filter(call => /^rn2\((20|5)\)=/.test(call))
        .map(call => call.split(' @')[0]);
    assert.ok(!screens.some(screen => screen.includes('sink backs up')));

    if (name === 'hunger-punishment-artifact') {
        // C do.c:560-561 skips the actual punishment objects. Only Magicbane
        // spends an obj_resists draw, and 79 < the artifact threshold of 99.
        assert.ok(before.ball && before.chain);
        assert.equal(before.ball.type, ONAMES.HEAVY_IRON_BALL);
        assert.equal(before.chain.type, ONAMES.IRON_CHAIN);
        assert.notEqual(before.ball.id, before.chain.id);
        const artifact = before.floor.find(o => o.artifact === ART_MAGICBANE);
        assert.ok(artifact);
        assert.equal(before.floor.length, 3);
        for (const obj of [before.ball, before.chain, artifact]) {
            assert.ok(before.floor.some(o => o.id === obj.id && o.where === OBJ_FLOOR));
            assert.ok(last.floor.some(o => o.id === obj.id && o.where === OBJ_FLOOR));
        }
        assert.deepEqual(owned.filter(call => call.startsWith('rn2(100)='))
            .map(call => call.split(' @')[0]), ['rn2(100)=79']);
        const punishment = screens.findIndex(screen => screen.includes('You are being punished for your misbehavior!'));
        assert.ok(punishment > 0 && punishment < drop);
        assert.deepEqual(disposition, ['rn2(20)=9', 'rn2(5)=0']);
        assert.equal(ring.where, OBJ_BURIED);
        assert.equal(!!ring.in_use, false);
    } else if (name === 'polymorph-zero-disposition') {
        // C do.c:583-584 always sets nosink. With rn2(20)=0, the second
        // conjunct at 649 is evaluated false and the rn2(5) arm is reached.
        const outcome = screens.findIndex(screen => screen.includes('The sink transforms into an opulent throne!'));
        assert.ok(outcome >= drop);
        assert.equal(states[outcome].terrain, THRONE);
        assert.deepEqual(owned.filter(call => call.startsWith('rn2(4)='))
            .map(call => call.split(' @')[0]), ['rn2(4)=1']);
        assert.deepEqual(disposition, ['rn2(20)=0', 'rn2(5)=3']);
        assert.equal(ring.where, OBJ_DELETED);
        // C useup destroys the object; it does not clear in_use first.
    } else {
        const success = name === 'blind-teleport-success';
        const message = success ? 'The sink vanishes.' : 'The sink momentarily vanishes.';
        const outcome = screens.findIndex(screen => screen.includes(message));
        assert.ok(outcome >= drop);
        const state = states[outcome];
        const pairs = calls.flatMap((call, i) => /^rn2\(19\)=\d+ @js\/do\.js:/.test(call) ? [i] : []);
        for (const i of pairs) assert.match(calls[i - 1], /^rnd\(77\)=\d+$/);
        if (success) {
            // C do.c:592 skips the visual switch when blind, leaving ideed
            // false. The relocated sink makes !nosink false at line 645.
            assert.equal(before.blind, true);
            assert.equal(state.blind, true);
            assert.equal(pairs.length, 5);
            assert.ok(state.sinks.some(([x,y]) => x !== before.x || y !== before.y));
            assert.ok(!state.sinks.some(([x,y]) => x === before.x && y === before.y));
            assert.ok(!screens.some(screen => screen.includes('bouncing down the drainpipe')));
            assert.deepEqual(disposition, ['rn2(20)=3', 'rn2(5)=1']);
        } else {
            // C do.c:476 rejects every target on the actual Air map. The
            // 200th rejection returns false, selecting "momentarily" at 579.
            assert.equal(before.roomTiles, 0);
            assert.equal(pairs.length, 200);
            assert.equal(state.terrain, SINK);
            assert.equal(state.roomTiles, 0);
            assert.ok(state.sinks.some(([x,y]) => x === before.x && y === before.y));
            const arrival = screens.findIndex(screen => screen.includes('You notice that there is no gravity here.'));
            assert.ok(arrival > 0 && arrival < drop);
            assert.deepEqual(disposition, ['rn2(20)=6', 'rn2(5)=1']);
        }
        assert.equal(ring.where, OBJ_DELETED);
    }
    console.log(JSON.stringify({name, boundaries:screens.length, drop, disposition, where:ring.where}));
}
