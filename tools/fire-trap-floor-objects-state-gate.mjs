#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { FIRE_TRAP, OBJ_FLOOR } from '../js/const.js';
import { ONAMES } from '../js/objects_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/fire-trap-floor-objects.json', import.meta.url),
'utf8'));

function quantityAtHero(otyp) {
    return (game.level?.objects || [])
        .filter(obj => obj.where === OBJ_FLOOR && obj.ox === game.u.ux
            && obj.oy === game.u.uy && obj.otyp === otyp)
        .reduce((quantity, obj) => quantity + (obj.quan | 0), 0);
}

function countAtHero(otyp) {
    return (game.level?.objects || []).filter(obj =>
        obj.where === OBJ_FLOOR && obj.ox === game.u.ux
        && obj.oy === game.u.uy && obj.otyp === otyp).length;
}

function trapAtHero() {
    return (game.level?.traps || []).find(trap =>
        trap.tx === game.u.ux && trap.ty === game.u.uy);
}

const states = [];
const heroVitals = [];
for (const segment of recipe.segments) {
    await runSegment({ ...segment, onFrame: () => {} });
    const trap = trapAtHero();
    states.push({
        blind: !!game.u.ublind,
        trap: trap ? { type: trap.ttyp, seen: !!trap.tseen } : null,
        amnesia: quantityAtHero(ONAMES.SCR_AMNESIA),
        fireScroll: quantityAtHero(ONAMES.SCR_FIRE),
        healingBooks: quantityAtHero(ONAMES.SPE_HEALING),
        healingBookObjects: countAtHero(ONAMES.SPE_HEALING),
        fireballBook: quantityAtHero(ONAMES.SPE_FIREBALL),
        deadBook: quantityAtHero(ONAMES.SPE_BOOK_OF_THE_DEAD),
        greenSlimeGlob: quantityAtHero(ONAMES.GLOB_OF_GREEN_SLIME),
        relevantUnported: [...(game.unported || [])].filter(path =>
            path.includes('dofiretrap') || path.includes('dotrap:ttyp=10')
            || path.includes('burn_floor_objects')),
    });
    heroVitals.push({
        level: game.u.ulevel | 0,
        hp: game.u.uhp | 0,
        maxHp: game.u.uhpmax | 0,
    });
}

assert.deepEqual(states[0], {
    blind: false,
    trap: { type: FIRE_TRAP, seen: true },
    amnesia: 8,
    fireScroll: 0,
    healingBooks: 0,
    healingBookObjects: 0,
    fireballBook: 0,
    deadBook: 0,
    greenSlimeGlob: 0,
    relevantUnported: [],
}, 'visible fire destroys four of twelve ordinary scrolls');

assert.deepEqual(states[1], {
    blind: false,
    trap: { type: FIRE_TRAP, seen: true },
    amnesia: 0,
    fireScroll: 0,
    healingBooks: 2,
    healingBookObjects: 2,
    fireballBook: 0,
    deadBook: 0,
    greenSlimeGlob: 1,
    relevantUnported: [],
}, 'visible fire destroys one ordinary spellbook and leaves the glob');

assert.deepEqual(states[2], {
    blind: false,
    trap: { type: FIRE_TRAP, seen: true },
    amnesia: 4,
    fireScroll: 1,
    healingBooks: 0,
    healingBookObjects: 0,
    fireballBook: 1,
    deadBook: 1,
    greenSlimeGlob: 0,
    relevantUnported: [],
}, 'fire scroll, fireball spellbook, and Book of the Dead survive floor fire');

assert.deepEqual(states[3], {
    blind: true,
    trap: { type: FIRE_TRAP, seen: true },
    amnesia: 3,
    fireScroll: 0,
    healingBooks: 0,
    healingBookObjects: 0,
    fireballBook: 0,
    deadBook: 0,
    greenSlimeGlob: 0,
    relevantUnported: [],
}, 'blind fire-trap handling destroys paper without visible burn feedback');

assert.deepEqual(states[4], {
    blind: false,
    trap: { type: FIRE_TRAP, seen: true },
    amnesia: 0,
    fireScroll: 0,
    healingBooks: 0,
    healingBookObjects: 0,
    fireballBook: 0,
    deadBook: 0,
    greenSlimeGlob: 0,
    relevantUnported: [],
}, 'a one-object green slime glob is fully consumed by floor fire');

assert.deepEqual(states[5], {
    blind: false,
    trap: { type: FIRE_TRAP, seen: true },
    amnesia: 4,
    fireScroll: 0,
    healingBooks: 0,
    healingBookObjects: 0,
    fireballBook: 0,
    deadBook: 0,
    greenSlimeGlob: 0,
    relevantUnported: [],
}, 'a nonresistant hero still burns floor paper');
assert.deepEqual(heroVitals[5], {
    level: 30,
    hp: 103,
    maxHp: 107,
}, 'a nonresistant fire trap damages current and maximum hit points');

console.log('fire trap floor-object state: PASS');
