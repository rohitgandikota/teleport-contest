#!/usr/bin/env node

// State checks for src/dothrow.c mhurtle_step() and src/trap.c
// minstapetrify(). The paired two-segment C recording pins both collision
// directions at the terminal and RNG level.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { mhurtle } from '../js/uhitm.js';
import { minstapetrify } from '../js/trap.js';
import { mksobj } from '../js/mkobj.js';
import { mpickobj } from '../js/steal.js';
import { MFAST, W_ARM, W_ARMF } from '../js/const.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';

const recipePath = new URL(
    'gen-sessions/recipes/mhurtle-collision-petrification.json',
    import.meta.url);
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
        path.includes('mhurtle:collision_petrify')
        || path.includes('minstapetrify'));
}

async function run(index, moves = recipe.segments[index].moves) {
    const nhGame = await runSegment({
        ...recipe.segments[index],
        moves,
        onFrame: () => {},
    });
    nhGame._display.onEmptyQueue = () => 0x20;
    return nhGame;
}

async function setupCollision() {
    const segment = recipe.segments[0];
    const command = segment.moves.indexOf('#wiztelekinesis');
    assert.ok(command > 0, 'fixture contains the telekinesis command');
    await run(0, segment.moves.slice(0, command));

    const minotaur = liveMonster(PMNAMES.PM_MINOTAUR);
    const cockatrice = liveMonster(PMNAMES.PM_COCKATRICE);
    assert.ok(minotaur && cockatrice,
              'setup creates both collision participants');
    assert.equal(minotaur.mx, cockatrice.mx + 2,
                 'setup leaves one open square between the monsters');
    assert.equal(minotaur.my, cockatrice.my,
                 'setup leaves the monsters on one row');
    game.unported = new Set();
    return { minotaur, cockatrice };
}

await run(0);
assert.equal(liveMonster(PMNAMES.PM_MINOTAUR), undefined,
             'a minotaur hurtled into a cockatrice is petrified');
assert.ok(liveMonster(PMNAMES.PM_COCKATRICE),
          'the petrifying blocker survives the collision');
assert.ok(hasStatue(PMNAMES.PM_MINOTAUR),
          'hurtler petrification leaves a minotaur statue');
assert.equal(game.u.uconduct?.killer, 1,
             'wizard telekinesis credits the petrification to the hero');
assert.equal(formerMarkerPresent(), false,
             'hurtler petrification leaves no former gap marker');

await run(1);
assert.equal(liveMonster(PMNAMES.PM_MINOTAUR), undefined,
             'a minotaur touched by a hurtled cockatrice is petrified');
assert.ok(liveMonster(PMNAMES.PM_COCKATRICE),
          'the petrifying hurtler survives the collision');
assert.ok(hasStatue(PMNAMES.PM_MINOTAUR),
          'blocker petrification leaves a minotaur statue');
assert.equal(game.u.uconduct?.killer, 1,
             'reverse collision petrification is also a hero kill');
assert.equal(formerMarkerPresent(), false,
             'blocker petrification leaves no former gap marker');

let state = await setupCollision();
const armor = mksobj(ONAMES.PLATE_MAIL, false, false);
mpickobj(state.minotaur, armor);
armor.owornmask = W_ARM;
state.minotaur.misc_worn_check |= W_ARM;
await mhurtle(state.minotaur, -1, 0, 6);
assert.ok((state.minotaur.mhp || 0) > 0,
          'body armor protects the hurtler from cockatrice contact');
assert.equal(hasStatue(PMNAMES.PM_MINOTAUR), false,
             'protected collision creates no statue');

state = await setupCollision();
const conductBeforeResistance = game.u.uconduct?.killer | 0;
await minstapetrify(state.cockatrice, true);
assert.ok((state.cockatrice.mhp || 0) > 0,
          'stone resistance rejects monster petrification');
assert.equal(game.u.uconduct?.killer | 0, conductBeforeResistance,
             'resisted petrification does not change hero conduct');

state = await setupCollision();
state.minotaur.mnum = PMNAMES.PM_FLESH_GOLEM;
state.minotaur.data = game.mons[PMNAMES.PM_FLESH_GOLEM];
state.minotaur.msleeping = 0;
const conductBeforeGolem = game.u.uconduct?.killer | 0;
await minstapetrify(state.minotaur, true);
assert.equal(state.minotaur.mnum, PMNAMES.PM_STONE_GOLEM,
             'a susceptible golem converts into a stone golem');
assert.ok((state.minotaur.mhp || 0) > 0,
          'golem conversion does not kill the monster');
assert.equal(game.u.uconduct?.killer | 0, conductBeforeGolem,
             'golem conversion does not change hero conduct');

state = await setupCollision();
state.minotaur.msleeping = 0;
state.minotaur.mcanmove = 1;
state.minotaur.mfrozen = 0;
state.minotaur.permspeed = MFAST;
state.minotaur.mspeed = MFAST;
const conductBeforeEnvironment = game.u.uconduct?.killer | 0;
await minstapetrify(state.minotaur, false);
assert.equal(state.minotaur.permspeed, 0,
             'petrification removes intrinsic monster speed');
assert.equal(state.minotaur.mspeed, 0,
             'an unbooted petrifying monster returns to normal speed');
assert.ok(hasStatue(PMNAMES.PM_MINOTAUR),
          'environmental petrification creates a statue');
assert.equal(game.u.uconduct?.killer | 0, conductBeforeEnvironment,
             'environmental petrification is not credited to the hero');

state = await setupCollision();
const boots = mksobj(ONAMES.SPEED_BOOTS, false, false);
mpickobj(state.minotaur, boots);
boots.owornmask = W_ARMF;
state.minotaur.misc_worn_check |= W_ARMF;
state.minotaur.msleeping = 0;
state.minotaur.mcanmove = 1;
state.minotaur.mfrozen = 0;
state.minotaur.permspeed = MFAST;
state.minotaur.mspeed = MFAST;
await minstapetrify(state.minotaur, false);
assert.equal(state.minotaur.permspeed, 0,
             'petrification still removes speed under speed boots');
assert.equal(state.minotaur.mspeed, MFAST,
             'worn speed boots retain effective monster speed');
assert.ok(hasStatue(PMNAMES.PM_MINOTAUR),
          'booted monster petrification still creates a statue');

assert.equal(formerMarkerPresent(), false,
             'covered ordinary petrification paths leave no gap marker');

console.log('mhurtle collision petrification state: PASS');
