// Run: node tools/mkobj-timer-input-gate.mjs <input-recipe.json>
// Read-only observations of actual actions. This does not replace native parity checks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { OBJ_FLOOR, OBJ_INVENT, ICE } from '../js/const.js';
import { ROT_CORPSE } from '../js/timeout.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';

const recipe = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const storage = new InMemoryStorage();
let saved;
for (const part of recipe.segments) {
    const states = [];
    globalThis.__step_snapshot = { step: '*', cb(g, step) {
        const obj = [...g.invent || [], ...g.level.objects].find(item =>
            item.otyp === ONAMES.CORPSE && item.corpsenm === PMNAMES.PM_NEWT);
        const timer = obj && g.timer_base.find(t => t.arg === obj && t.func_index === ROT_CORPSE);
        states.push({ step, moves: g.moves, terrain: g.level.at(g.u.ux, g.u.uy).typ,
            debug: !!g.iflags.debug_hunger && !!g.iflags.debug_mongen,
            monsters: g.level.monsters.filter(mon => mon.mhp > 0).length,
            corpse: obj ? { id: obj.o_id, where: obj.where, ice: obj.on_ice || 0,
                age: obj.age, timed: obj.timed, deadline: timer?.timeout, tid: timer?.tid,
                linked: obj.where !== OBJ_FLOOR || g.level.objectAt(obj.ox, obj.oy) === obj } : null,
            message: g._toplines || '' });
    }};
    let run;
    try { run = await runSegment({ ...part, storage }); }
    finally { delete globalThis.__step_snapshot; }
    const first = states.find(s => s.corpse);
    const floor = states.find(s => s.corpse?.where === OBJ_FLOOR);
    const picked = floor && states.find(s => s.step > floor.step && s.corpse?.where === OBJ_INVENT);
    const result = { name: part.name, screens: run.getScreens().length,
        rngCalls: run.getRngLog().length, first, floor, picked, pass: false };
    try {
        assert.ok(first && floor, 'live corpse and floor placement reached');
        assert.equal(floor.corpse.timed, 1); assert.equal(floor.corpse.linked, true);
        if (part.name !== 'ice-restore-pickup-expiry') {
            assert.equal(first.corpse.where, OBJ_INVENT);
            assert.equal(floor.debug, true); assert.equal(floor.monsters, 0);
        }
        if (part.name === 'ordinary-floor-control') {
            assert.notEqual(floor.terrain, ICE); assert.equal(floor.corpse.ice, 0);
            assert.ok(picked); assert.equal(picked.corpse.deadline, first.corpse.deadline);
            assert.equal(picked.corpse.age, first.corpse.age);
            assert.ok(states.some(s => s.moves === 245 && s.corpse));
            assert.ok(states.some(s => s.moves === 255 && !s.corpse));
        } else if (part.name === 'ice-restore-pickup-expiry') {
            assert.ok(saved, 'save segment ran first');
            assert.equal(first.moves, saved.moves);
            assert.deepEqual(first.corpse, saved.corpse, 'restore preserves all floor timer state');
            assert.ok(picked); assert.equal(picked.debug, true); assert.equal(picked.monsters, 0);
            assert.equal(picked.corpse.ice, 0); assert.equal(picked.corpse.age, 102);
            assert.equal(picked.corpse.deadline, 349);
            assert.ok(states.some(s => s.moves === 344 && s.corpse));
            assert.ok(states.some(s => s.moves === 354 && !s.corpse));
        } else {
            assert.equal(floor.terrain, ICE); assert.equal(floor.corpse.ice, 1);
            assert.equal(floor.corpse.deadline, first.moves + 2 * (first.corpse.deadline - first.moves));
            if (part.name === 'ice-save') {
                saved = states.filter(s => s.corpse).at(-1);
                assert.equal(saved.moves, 103); assert.equal(saved.corpse.deadline, 496);
                assert.equal(game.program_state_gameover, true);
            } else if (part.name === 'ice-drop-pickup-expiry') {
                assert.ok(picked); assert.equal(picked.corpse.ice, 0);
                assert.equal(picked.corpse.age, 52); assert.equal(picked.corpse.deadline, 299);
                assert.ok(states.some(s => s.moves === 284 && s.corpse));
                assert.ok(states.some(s => s.moves === 304 && !s.corpse));
            } else if (part.name === 'ice-terrain-thaw') {
                const thawed = states.find(s => s.step > floor.step
                    && s.corpse?.where === OBJ_FLOOR && !s.corpse.ice && s.terrain !== ICE);
                assert.ok(thawed, 'terrain thaw reaches obj_ice_effects before pickup');
                assert.equal(thawed.corpse.age, 55); assert.equal(thawed.corpse.deadline, 309);
                assert.ok(picked); assert.equal(picked.corpse.deadline, thawed.corpse.deadline);
                assert.equal(picked.corpse.age, thawed.corpse.age);
                assert.ok(states.some(s => s.moves === 278 && s.corpse));
                assert.ok(states.some(s => s.moves === 318 && !s.corpse));
                result.thawed = thawed;
            } else assert.fail('unexpected input case ' + part.name);
        }
        if (part.name !== 'ice-save') {
            assert.equal(!!game.program_state_gameover, false);
            assert.ok(states.some(s => s.message.includes('Your newt corpse rots away.')));
        }
        const screens = run.getScreens().map(screen => decodeScreen(screen)
            .map(row => row.map(cell => cell.ch).join('')).join('\n'));
        for (const expected of recipe.branchAssertions.find(assertion =>
            assertion.segment === recipe.segments.indexOf(part)).screenIncludes)
            assert.ok(screens.some(screen => screen.includes(expected)), `screen contains ${expected}`);
        result.pass = true;
    } catch (error) {
        result.error = error.message;
        process.exitCode = 1;
        if (part.name === 'ice-save') saved = states.filter(s => s.corpse).at(-1);
    }
    console.log(JSON.stringify(result));
}
