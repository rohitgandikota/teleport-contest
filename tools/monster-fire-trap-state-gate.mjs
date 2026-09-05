#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import {
    BURN_OBJECT, FIRE_TRAP, OBJ_FLOOR, OBJ_MINVENT,
} from '../js/const.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/monster-fire-trap.json', import.meta.url),
'utf8'));

function quantityAt(otyp, x, y) {
    return (game.level?.objects || [])
        .filter(obj => obj.where === OBJ_FLOOR && obj.ox === x
            && obj.oy === y && obj.otyp === otyp)
        .reduce((quantity, obj) => quantity + (obj.quan | 0), 0);
}

function monsterState(mnum) {
    const mon = (game.level?.monsters || []).find(candidate =>
        candidate.mnum === mnum && (candidate.mhp | 0) > 0);
    assert.ok(mon, `live monster ${mnum} remains after the fire trap`);
    const candle = (mon.minvent || []).find(obj =>
        obj.otyp === ONAMES.WAX_CANDLE);
    const light = candle && (game.light_sources || []).find(source =>
        source.type === 1 && source.id === candle.o_id);
    const timer = candle && (game.timer_base || []).find(entry =>
        entry.func_index === BURN_OBJECT && entry.arg === candle);
    return {
        type: mon.mnum,
        position: [mon.mx, mon.my],
        hp: mon.mhp | 0,
        maxHp: mon.mhpmax | 0,
        candle: candle ? {
            where: candle.where,
            lit: !!candle.lamplit,
            hasCarrier: candle.ocarry === mon,
            lightRange: light?.range ?? null,
            burnTimer: !!timer,
        } : null,
    };
}

const states = [];
for (const [index, segment] of recipe.segments.entries()) {
    await runSegment({ ...segment, onFrame: () => {} });
    const trap = (game.level?.traps || []).find(candidate =>
        candidate.ttyp === FIRE_TRAP);
    assert.ok(trap, `segment ${index} retains its fire trap`);
    states.push({
        blind: !!game.u.ublind,
        detection: game.u.intrinsic?.HDetect_monsters | 0,
        trap: {
            position: [trap.tx, trap.ty],
            seen: !!trap.tseen,
        },
        scrolls: quantityAt(ONAMES.SCR_AMNESIA, trap.tx, trap.ty),
        monster: monsterState(index === 2
            ? PMNAMES.PM_FIRE_ANT : PMNAMES.PM_GNOME_RULER),
        relevantUnported: [...(game.unported || [])].filter(path =>
            path.includes('trapeffect_fire_trap')
            || path.includes('burn_floor_objects')
            || path.includes('ignite_items')
            || path.includes('catch_lit')
            || path.includes('wiz_intrinsic')),
    });
}

assert.deepEqual(states[0], {
    blind: false,
    detection: 0,
    trap: { position: [10, 6], seen: true },
    scrolls: 3,
    monster: {
        type: PMNAMES.PM_GNOME_RULER,
        position: [10, 6],
        hp: 10,
        maxHp: 13,
        candle: {
            where: OBJ_MINVENT,
            lit: true,
            hasCarrier: true,
            lightRange: 2,
            burnTimer: true,
        },
    },
    relevantUnported: [],
}, 'visible monster fire processes direct, carried, floor, and trap state');

assert.deepEqual(states[1], {
    blind: true,
    detection: 30,
    trap: { position: [10, 6], seen: false },
    scrolls: 3,
    monster: {
        type: PMNAMES.PM_GNOME_RULER,
        position: [10, 6],
        hp: 10,
        maxHp: 13,
        candle: {
            where: OBJ_MINVENT,
            lit: true,
            hasCarrier: true,
            lightRange: 2,
            burnTimer: true,
        },
    },
    relevantUnported: [],
}, 'blind nearby fire burns unseen items, emits smoke, and hides the trap');

assert.deepEqual(states[2], {
    blind: false,
    detection: 0,
    trap: { position: [10, 6], seen: true },
    scrolls: 3,
    monster: {
        type: PMNAMES.PM_FIRE_ANT,
        position: [10, 6],
        hp: 5,
        maxHp: 5,
        candle: null,
    },
    relevantUnported: [],
}, 'fire resistance preserves monster HP without skipping floor destruction');

console.log('monster fire-trap state: PASS');
