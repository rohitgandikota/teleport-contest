#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import {
    ICE, ICED_MOAT, ICED_POOL, MOAT, OBJ_BURIED, PIT, ROOM,
} from '../js/const.js';
import {
    MELT_ICE_AWAY, ROT_CORPSE, TIMER_LEVEL, TIMER_OBJECT,
} from '../js/timeout.js';
import { ONAMES } from '../js/objects_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/elemental-terrain-transitions.json',
    import.meta.url), 'utf8'));

function timersAt(x, y) {
    const packed = ((x & 0xffff) << 16) | (y & 0xffff);
    return (game.timer_base || []).filter(timer =>
        (timer.arg?.a_long ?? timer.arg) === packed);
}

function cloudSquares() {
    return (game.regions || []).flatMap(region =>
        (region.rects || []).map(rect => [rect.lx, rect.ly]));
}

function relevantUnported() {
    return [...(game.unported || [])].filter(path =>
        /zap_over_floor|wizterrainwish|obj_ice_effects|bury|region|melt_ice/
            .test(path));
}

const states = [];
for (const segment of recipe.segments) {
    await runSegment({ ...segment, onFrame: () => {} });
    const x = game.u.ux + 1;
    const y = game.u.uy;
    const loc = game.level.at(x, y);
    const buried = (game.level.buriedobjs || []).filter(obj =>
        obj.ox === x && obj.oy === y);
    states.push({
        hero: [game.u.ux, game.u.uy],
        target: [x, y],
        terrain: loc.typ,
        icedpool: loc.icedpool ?? 0,
        traps: (game.level.traps || []).filter(trap =>
            trap.tx === x && trap.ty === y).map(trap => trap.ttyp),
        clouds: cloudSquares(),
        buried: buried.map(obj => ({
            otyp: obj.otyp,
            where: obj.where,
            onIce: obj.on_ice ?? 0,
            timed: obj.timed ?? 0,
            age: obj.age ?? 0,
        })),
        objectTimers: (game.timer_base || []).filter(timer =>
            buried.includes(timer.arg)).map(timer =>
                [timer.kind, timer.func_index, timer.timeout]),
        meltTimers: timersAt(x, y),
        relevantUnported: relevantUnported(),
    });
}

assert.deepEqual({
    hero: states[0].hero,
    target: states[0].target,
    terrain: states[0].terrain,
    traps: states[0].traps,
    clouds: states[0].clouds,
    relevantUnported: states[0].relevantUnported,
}, {
    hero: [38, 7],
    target: [39, 7],
    terrain: ROOM,
    traps: [PIT],
    clouds: [[39, 7], [39, 6], [40, 7]],
    relevantUnported: [],
}, 'fire evaporates an ordinary pool into a pit and creates visible steam');

assert.deepEqual({
    terrain: states[1].terrain,
    traps: states[1].traps,
    clouds: states[1].clouds,
    relevantUnported: states[1].relevantUnported,
}, {
    terrain: MOAT,
    traps: [],
    clouds: [[39, 7]],
    relevantUnported: [],
}, 'fire creates steam over a moat without replacing its terrain');

assert.deepEqual({
    terrain: states[2].terrain,
    icedpool: states[2].icedpool,
    buried: states[2].buried,
    objectTimers: states[2].objectTimers,
    meltTimers: states[2].meltTimers.map(timer =>
        [timer.kind, timer.func_index, timer.timeout]),
    relevantUnported: states[2].relevantUnported,
}, {
    terrain: ICE,
    icedpool: ICED_POOL,
    buried: [{
        otyp: ONAMES.CORPSE,
        where: OBJ_BURIED,
        onIce: 1,
        timed: 1,
        age: 0,
    }],
    objectTimers: [[TIMER_OBJECT, ROT_CORPSE, 496]],
    meltTimers: [[TIMER_LEVEL, MELT_ICE_AWAY, 140]],
    relevantUnported: [],
}, 'cold freezes a pool, buries its corpse, and slows the corpse timer');

assert.deepEqual({
    terrain: states[3].terrain,
    icedpool: states[3].icedpool,
    meltTimers: states[3].meltTimers.map(timer =>
        [timer.kind, timer.func_index, timer.timeout]),
    relevantUnported: states[3].relevantUnported,
}, {
    terrain: ICE,
    icedpool: ICED_MOAT,
    meltTimers: [[TIMER_LEVEL, MELT_ICE_AWAY, 846]],
    relevantUnported: [],
}, 'cold bridges a moat with timed ice that remembers the moat below');

assert.deepEqual({
    terrain: states[4].terrain,
    icedpool: states[4].icedpool,
    meltTimers: states[4].meltTimers,
    relevantUnported: states[4].relevantUnported,
}, {
    terrain: ROOM,
    icedpool: 0,
    meltTimers: [],
    relevantUnported: [],
}, 'cold solidifies lava permanently without scheduling an ice timer');

console.log('elemental terrain-transition state: PASS');
