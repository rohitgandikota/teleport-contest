#!/usr/bin/env node

// State checks for the hero-collision arm of src/dothrow.c mhurtle_step().
// The paired three-segment C recording pins the visible output and RNG order.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { mhurtle } from '../js/uhitm.js';
import { set_occupation } from '../js/allmain.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { mpickobj } from '../js/steal.js';
import { setworn } from '../js/worn.js';
import { KILLED_BY, W_ARM } from '../js/const.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';

const recipePath = new URL(
    'gen-sessions/recipes/mhurtle-hero-collision.json', import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));

function liveMonster(mnum) {
    return (game.level.monsters || []).find(mon => mon.mnum === mnum
                                             && (mon.mhp || 0) > 0);
}

function hasStatue(mnum) {
    return (game.level.objects || []).some(obj =>
        obj.otyp === ONAMES.STATUE && obj.corpsenm === mnum);
}

function formerMarkerPresent() {
    return [...(game.unported || [])].some(path =>
        path.includes('mhurtle:hero_collision'));
}

function snapshot(state, step) {
    return {
        step,
        killerName: state.killer?.name || '',
        killerFormat: state.killer?.format,
        mortality: state.u?.umortality | 0,
    };
}

async function run(index, moves = recipe.segments[index].moves,
                   capture = false) {
    const trace = [];
    if (capture) {
        globalThis.__step_snapshot = {
            step: '*',
            cb: (state, step) => trace.push(snapshot(state, step)),
        };
    }
    let nhGame;
    try {
        nhGame = await runSegment({
            ...recipe.segments[index],
            moves,
            onFrame: () => {},
        });
    } finally {
        if (capture)
            delete globalThis.__step_snapshot;
    }
    nhGame._display.onEmptyQueue = () => 0x20;
    return { nhGame, trace };
}

async function setup(index) {
    const segment = recipe.segments[index];
    const command = segment.moves.indexOf('#wiztelekinesis');
    assert.ok(command > 0, 'fixture contains the telekinesis command');
    const result = await run(index, segment.moves.slice(0, command));
    const mnum = index === 2 ? PMNAMES.PM_COCKATRICE : PMNAMES.PM_MINOTAUR;
    const mon = liveMonster(mnum);
    assert.ok(mon, 'setup creates the hurtling monster');
    assert.equal(Math.max(Math.abs(game.u.ux - mon.mx),
                          Math.abs(game.u.uy - mon.my)), 1,
                 'setup leaves the hurtler adjacent to the hero');
    game.unported = new Set();
    return { ...result, mon };
}

async function hurtleIntoHero(mon) {
    const dx = Math.sign(game.u.ux - mon.mx);
    const dy = Math.sign(game.u.uy - mon.my);
    assert.ok(dx || dy, 'hurtler starts outside the hero square');
    await mhurtle(mon, dx, dy, 1);
}

async function traceDirect(nhGame, keys, fn) {
    const trace = [];
    globalThis.__step_snapshot = {
        step: '*',
        cb: (state, step) => trace.push(snapshot(state, step)),
    };
    for (const key of keys)
        nhGame._display.pushKey(key.charCodeAt(0));
    try {
        await fn();
    } finally {
        delete globalThis.__step_snapshot;
    }
    return trace;
}

await run(0);
let minotaur = liveMonster(PMNAMES.PM_MINOTAUR);
assert.ok(minotaur, 'an ordinary hero collision does not kill the hurtler');
assert.equal(minotaur.msleeping, 0, 'the hurtler wakes before the collision');
assert.equal(minotaur.mstun, 1, 'the hurtler is stunned');
assert.equal(minotaur.movement, 0, 'the hurtler loses its remaining movement');
assert.equal(Math.max(Math.abs(game.u.ux - minotaur.mx),
                      Math.abs(game.u.uy - minotaur.my)), 1,
             'the hurtler stops next to the hero');
assert.equal(formerMarkerPresent(), false,
             'ordinary hero collision leaves no former gap marker');

let state = await setup(0);
set_occupation(async () => 1, 'searching', false);
await hurtleIntoHero(state.mon);
assert.equal(game.occupation, null,
             'a monster colliding with the hero stops an occupation');
assert.equal(game.occtxt, null,
             'occupation text is cleared with the interrupted occupation');

await run(1);
assert.equal(liveMonster(PMNAMES.PM_MINOTAUR), undefined,
             'a cockatrice-form hero petrifies an unarmored hurtler');
assert.ok(hasStatue(PMNAMES.PM_MINOTAUR),
          'hero-form contact leaves a minotaur statue');
assert.equal(game.u.uconduct?.killer, 1,
             'hero-form contact is credited as a hero kill');
assert.equal(formerMarkerPresent(), false,
             'hero-form petrification leaves no former gap marker');

state = await setup(1);
const monsterArmor = mksobj(ONAMES.PLATE_MAIL, false, false);
mpickobj(state.mon, monsterArmor);
monsterArmor.owornmask = W_ARM;
state.mon.misc_worn_check |= W_ARM;
const conductBeforeArmor = game.u.uconduct?.killer | 0;
await hurtleIntoHero(state.mon);
assert.ok((state.mon.mhp || 0) > 0,
          'body armor protects a hurtler from the hero cockatrice form');
assert.equal(hasStatue(PMNAMES.PM_MINOTAUR), false,
             'protected hero contact creates no monster statue');
assert.equal(game.u.uconduct?.killer | 0, conductBeforeArmor,
             'protected hero contact does not change kill conduct');

let result = await run(2, recipe.segments[2].moves, true);
assert.ok(result.trace.some(entry =>
    entry.killerName === 'being hit by a hurtling cockatrice'
        && entry.killerFormat === KILLED_BY),
          'hostile collision records the exact hurtling cockatrice killer');
assert.equal(game.u.umortality, 1,
             'an unarmored hero collision reaches the death path once');
assert.ok(game.u.uhp > 0,
          'declining wizard-mode death restores the hero');
assert.equal(formerMarkerPresent(), false,
             'hero petrification leaves no former gap marker');

state = await setup(2);
const heroArmor = mksobj(ONAMES.PLATE_MAIL, false, false);
await addinv(heroArmor);
setworn(heroArmor, W_ARM);
const mortalityBeforeArmor = game.u.umortality | 0;
await hurtleIntoHero(state.mon);
assert.equal(game.u.umortality | 0, mortalityBeforeArmor,
             'body armor protects the hero from hurtling cockatrice contact');
assert.ok((state.mon.mhp || 0) > 0,
          'the cockatrice survives protected hero contact');

state = await setup(2);
(game.u.uprops ||= {}).STONE_RES = 1;
const mortalityBeforeResistance = game.u.umortality | 0;
await hurtleIntoHero(state.mon);
assert.equal(game.u.umortality | 0, mortalityBeforeResistance,
             'stone resistance protects the hero from collision contact');

state = await setup(2);
state.mon.mtame = 10;
state.mon.mpeaceful = 1;
const tameTrace = await traceDirect(state.nhGame, [' ', ' ', 'n'],
                                    () => hurtleIntoHero(state.mon));
assert.ok(tameTrace.some(entry =>
    entry.killerName === 'being hit by your hurtling cockatrice'
        && entry.killerFormat === KILLED_BY),
          'tame collision uses the exact possessive hurtling-monster killer');

assert.equal(formerMarkerPresent(), false,
             'covered hero-collision paths leave no gap marker');

console.log('mhurtle hero collision state: PASS');
