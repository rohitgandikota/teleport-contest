#!/usr/bin/env node

// State checks for the ordinary-monster status branches in
// src/potion.c:potionhit(). The companion recording pins every RNG draw and
// visible frame; these assertions pin the otherwise silent monster fields.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { MFAST } from '../js/const.js';
import { PMNAMES } from '../js/monst_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/potion-monster-status.json', import.meta.url),
'utf8'));

function newestLivingMonster() {
    return [...(game.level.monsters || [])]
        .filter(mon => (mon.mhp | 0) > 0)
        .sort((a, b) => (b.m_id | 0) - (a.m_id | 0))[0];
}

const states = [];
for (const segment of recipe.segments) {
    await runSegment({ ...segment, onFrame: () => {} });
    const mon = newestLivingMonster();
    assert.ok(mon, 'the created potion target survives the segment');
    states.push({
        mnum: mon.mnum,
        hp: mon.mhp | 0,
        maxHp: mon.mhpmax | 0,
        peaceful: !!mon.mpeaceful,
        confused: !!mon.mconf,
        invisible: !!mon.minvis,
        permanentlyInvisible: !!mon.perminvis,
        canMove: !!mon.mcanmove,
        frozen: mon.mfrozen | 0,
        speed: mon.mspeed | 0,
        permanentSpeed: mon.permspeed | 0,
        canSee: !!mon.mcansee,
        blinded: mon.mblinded | 0,
        heroBlind: !!game.u.ublind,
        heroBlindTimeout: game.u.intrinsic?.HBlinded | 0,
        unported: [...(game.unported || [])],
    });
}

const { unported: confusionMarkers, ...confusionState } = states[0];
assert.deepEqual(confusionState, {
    mnum: PMNAMES.PM_HILL_GIANT,
    hp: 55,
    maxHp: 56,
    peaceful: false,
    confused: true,
    invisible: false,
    permanentlyInvisible: false,
    canMove: true,
    frozen: 0,
    speed: 0,
    permanentSpeed: 0,
    canSee: true,
    blinded: 0,
    heroBlind: false,
    heroBlindTimeout: 0,
}, 'confusion survives the impact and the target becomes hostile');

assert.equal(states[1].frozen, 8,
             'sleeping leaves the target unable to move for eight turns');
assert.equal(states[1].canMove, false,
             'the sleeping target is temporarily helpless');
assert.equal(states[1].peaceful, false,
             'sleeping does not suppress anger from a hero throw');

assert.equal(states[2].frozen, 17,
             'paralysis uses the C-recorded seventeen-turn duration');
assert.equal(states[2].canMove, false,
             'paralysis clears monster movement');

assert.equal(states[3].speed, MFAST,
             'speed raises the effective movement rate');
assert.equal(states[3].permanentSpeed, MFAST,
             'speed raises the permanent movement rate');
assert.equal(states[3].peaceful, true,
             'speed is a beneficial, non-angering potion hit');

assert.equal(states[4].canSee, false,
             'blindness clears monster sight');
assert.equal(states[4].blinded, 75,
             'monster blindness ticks from the C-recorded duration');
assert.equal(states[4].heroBlind, true,
             'adjacent blindness vapor also blinds the hero');
assert.equal(states[4].heroBlindTimeout, 2,
             'hero blindness uses and ticks the HBlinded timeout');

assert.equal(states[5].invisible, true,
             'invisibility hides the target');
assert.equal(states[5].permanentlyInvisible, true,
             'ordinary invisibility is permanent for the monster');
assert.equal(states[5].peaceful, true,
             'ordinary invisibility follows C non-angering behavior');

assert.equal(states[6].hp, 27,
             'sickness halves the chipped target hit points');
assert.equal(states[6].peaceful, false,
             'harmful sickness angers the target');

assert.equal(states[7].mnum, PMNAMES.PM_KITTEN,
             'polymorph chooses the C-recorded kitten form');
assert.equal(states[7].peaceful, false,
             'the polymorphed target remains hostile');

for (const [index, state] of states.entries()) {
    assert.ok(!state.unported.some(path => path.includes('potionhit')),
              `segment ${index} leaves no potionhit implementation marker`);
}

console.log('thrown monster potion status effects state: PASS');
