#!/usr/bin/env node

// State checks for src/mon.c vamp_stone(). The paired three-segment C
// recording pins the visible vampire-bat, vampire-leader, and sandestin
// reversion paths at the terminal and RNG level.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { m_at, vamp_stone } from '../js/mon.js';
import { remove_monster, place_monster } from '../js/makemon.js';
import { COLNO, D_CLOSED, G_GENOD, IS_DOOR, NON_PM, ROWNO }
    from '../js/const.js';
import { PMNAMES } from '../js/monst_data.js';

const recipePath = new URL(
    'gen-sessions/recipes/vamp-stone-reversion.json', import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));

function liveMonster(mnum) {
    return (game.level.monsters || []).find(mon => mon.mnum === mnum
                                             && (mon.mhp || 0) > 0);
}

function liveShapechanger(cham) {
    return (game.level.monsters || []).find(mon => mon.cham === cham
                                             && (mon.mhp || 0) > 0);
}

function formerMarkerPresent() {
    return [...(game.unported || [])].some(path =>
        path.includes('minstapetrify:vamp_stone'));
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

async function setup(index) {
    const segment = recipe.segments[index];
    const command = segment.moves.indexOf('#wiztelekinesis');
    assert.ok(command > 0, 'fixture contains the telekinesis command');
    const nhGame = await run(index, segment.moves.slice(0, command));
    const cham = index === 0 ? PMNAMES.PM_VAMPIRE
        : index === 1 ? PMNAMES.PM_SANDESTIN
                      : PMNAMES.PM_VAMPIRE_LEADER;
    const mon = liveShapechanger(cham);
    assert.ok(mon, 'setup creates the shifted monster');
    game.unported = new Set();
    return { nhGame, mon };
}

await run(0);
let mon = liveMonster(PMNAMES.PM_VAMPIRE);
assert.ok(mon, 'a lapidifying vampire bat reverts and survives');
assert.equal(mon.cham, NON_PM,
             'successful vampire reversion disables further shapechanging');
assert.equal(mon.mhp, mon.mhpmax,
             'vampire reversion restores the monster to full health');

await run(1);
mon = liveMonster(PMNAMES.PM_SANDESTIN);
assert.ok(mon, 'a shifted sandestin reverts and survives');
assert.equal(mon.cham, PMNAMES.PM_SANDESTIN,
             'sandestin reversion retains its shapechanger identity');
assert.equal(mon.mhp, mon.mhpmax,
             'sandestin reversion restores the monster to full health');

await run(2);
mon = liveMonster(PMNAMES.PM_VAMPIRE_LEADER);
assert.ok(mon, 'a lapidifying wolf reverts to its vampire-leader form');
assert.equal(mon.cham, NON_PM,
             'vampire-leader reversion also disables shapechanging');

let state = await setup(0);
state.mon.mcanmove = 0;
state.mon.mfrozen = 7;
state.mon.mhpmax = 1;
state.mon.mhp = 1;
assert.equal(await vamp_stone(state.mon), false,
             'a shifted vampire is saved from petrification');
assert.equal(state.mon.mcanmove, 1,
             'vampire reversion restores movement');
assert.equal(state.mon.mfrozen, 0,
             'vampire reversion clears frozen time');
assert.ok(state.mon.mhpmax >= 10,
          'vampire reversion restores a viable maximum HP');
assert.equal(state.mon.mhp, state.mon.mhpmax,
             'direct vampire reversion finishes at full HP');

state = await setup(0);
const savedVampFlags = game.mvitals[PMNAMES.PM_VAMPIRE].mvflags;
game.mvitals[PMNAMES.PM_VAMPIRE].mvflags |= G_GENOD;
try {
    assert.equal(await vamp_stone(state.mon), true,
                 'a genocided natural vampire form cannot save the monster');
    assert.equal(state.mon.mnum, PMNAMES.PM_VAMPIRE_BAT,
                 'failed genocide reversion leaves the current form intact');
} finally {
    game.mvitals[PMNAMES.PM_VAMPIRE].mvflags = savedVampFlags;
}

state = await setup(0);
state.mon.mnum = PMNAMES.PM_VAMPIRE;
state.mon.data = game.mons[PMNAMES.PM_VAMPIRE];
assert.equal(await vamp_stone(state.mon), true,
             'an already natural vampire does not take the reversion arm');
assert.equal(state.mon.cham, PMNAMES.PM_VAMPIRE,
             'an unchanged natural vampire keeps its shapechanger identity');

state = await setup(0);
state.mon.cham = PMNAMES.PM_CHAMELEON;
assert.equal(await vamp_stone(state.mon), true,
             'a shapechanger without natural stone resistance is not saved');

state = await setup(1);
state.mon.mcanmove = 0;
state.mon.mfrozen = 9;
state.mon.mhpmax = 1;
state.mon.mhp = 1;
assert.equal(await vamp_stone(state.mon), false,
             'a shifted monster with a stone-resistant natural form is saved');
assert.equal(state.mon.mnum, PMNAMES.PM_SANDESTIN,
             'the saved monster assumes its natural resistant form');
assert.equal(state.mon.mcanmove, 1,
             'resistant-form reversion restores movement');
assert.equal(state.mon.mfrozen, 0,
             'resistant-form reversion clears frozen time');
assert.equal(state.mon.mhp, state.mon.mhpmax,
             'resistant-form reversion finishes at full HP');

state = await setup(0);
const door = (() => {
    for (let y = 0; y < ROWNO; ++y) {
        for (let x = 1; x < COLNO; ++x) {
            const loc = game.level.at(x, y);
            if (loc && IS_DOOR(loc.typ) && !m_at(x, y))
                return { x, y, loc, doormask: loc.doormask };
        }
    }
    return null;
})();
assert.ok(door, 'fixture contains a doorway for amorphous reversion');
door.loc.doormask = D_CLOSED;
remove_monster(state.mon.mx, state.mon.my);
state.mon.mnum = PMNAMES.PM_FOG_CLOUD;
state.mon.data = game.mons[PMNAMES.PM_FOG_CLOUD];
place_monster(state.mon, door.x, door.y);
try {
    assert.equal(await vamp_stone(state.mon), false,
                 'an amorphous vampire form can revert from a closed doorway');
} finally {
    door.loc.doormask = door.doormask;
}
assert.notDeepEqual({ x: state.mon.mx, y: state.mon.my }, door,
                    'the solid natural form is moved out of the closed door');
assert.equal(state.mon.mnum, PMNAMES.PM_VAMPIRE,
             'closed-door relocation still completes the reversion');

state = await setup(0);
remove_monster(state.mon.mx, state.mon.my);
state.mon.mnum = PMNAMES.PM_FOG_CLOUD;
state.mon.data = game.mons[PMNAMES.PM_FOG_CLOUD];
place_monster(state.mon, game.u.ux, game.u.uy);
game.u.ustuck = state.mon;
game.u.uswallow = 1;
game.u.uswldtim = 5;
assert.equal(await vamp_stone(state.mon), false,
             'an engulfing vampire form reverts without petrifying');
assert.equal(game.u.ustuck, null,
             'engulfing reversion releases the hero');
assert.equal(game.u.uswallow, 0,
             'engulfing reversion clears swallowed state');
assert.equal(state.mon.mnum, PMNAMES.PM_VAMPIRE,
             'engulfing reversion restores the natural form');

assert.equal(formerMarkerPresent(), false,
             'covered shapechanger reversion paths leave no gap marker');

console.log('vamp stone state: PASS');
