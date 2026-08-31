#!/usr/bin/env node

// State checks for src/uhitm.c joust(), hmon_hitmon_jousting(), and
// mhurtle_to_doom(). The paired C recording pins ordinary failure, primary
// success, offhand success, knockback and collision, stun, fumbling, and a
// mount death at the terminal and RNG level.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { hmon_hitmon } from '../js/uhitm.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { setuwep, setuswapwep, set_twoweap } from '../js/wield.js';
import { maketrap } from '../js/mklev.js';
import { ART_ORCRIST } from '../js/artilist_data.js';
import { HMON_MELEE, OBJ_DELETED, OBJ_INVENT, PIT,
         TT_PIT } from '../js/const.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';

const recipePath = new URL('gen-sessions/recipes/mounted-jousting.json',
                           import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));
const SHATTER_SEED = 588;

function liveMonster(mnum) {
    return (game.level.monsters || []).find(mon => mon.mnum === mnum
                                             && (mon.mhp || 0) > 0);
}

function inventoryObject(otyp) {
    return (game.invent || []).find(obj => obj.otyp === otyp);
}

async function setup() {
    const segment = recipe.segments[0];
    const nhGame = await runSegment({
        ...segment,
        // Stop after the minotaur is created, before either recorded attack.
        moves: segment.moves.slice(0, 97),
        onFrame: () => {},
    });
    // Direct helper calls can produce --More-- prompts. Supply the same
    // dismiss key a replay would use instead of leaving the helper blocked.
    nhGame._display.onEmptyQueue = () => 0x20;

    const target = liveMonster(PMNAMES.PM_MINOTAUR);
    const lance = inventoryObject(ONAMES.LANCE);
    const sword = inventoryObject(ONAMES.LONG_SWORD);
    assert.ok(game.u.usteed, 'setup leaves the Knight mounted');
    assert.ok(target, 'setup creates a live minotaur south of the hero');
    assert.ok(lance && sword, 'setup retains the starting lance and sword');
    assert.equal(target.mx, game.u.ux, 'target shares the hero column');
    assert.equal(target.my, game.u.uy + 1, 'target is one square south');

    game.u.dx = 0;
    game.u.dy = 1;
    game.unported = new Set();
    return { target, lance, sword };
}

async function strike(target, lance) {
    initRng(SHATTER_SEED);
    enableRngLog();
    const result = await hmon_hitmon(target, lance, HMON_MELEE, 10);
    return { result, log: [...getRngLog()] };
}

function saw(log, entry) {
    return log.some(value => value === entry);
}

function sawJoustRoll(log) {
    return log.some(value => /^rn2\(5\)=/.test(value));
}

function assertNoFormerMarker() {
    assert.ok(![...(game.unported || [])].some(path =>
        path.includes('hmon_hitmon:jousting')),
    'jousting leaves no former unported marker');
}

let state = await setup();
let before = { x: state.target.mx, y: state.target.my };
let attack = await strike(state.target, state.lance);
assert.deepEqual(attack.log.slice(0, 5), [
    'rnd(8)=5',
    'rn2(5)=0',
    'rnl(50)=49',
    'rn2(100)=13',
    'd(2,10)=4',
], 'primary shatter follows the pinned C helper draw order');
assert.equal(game.u.uwep || null, null,
             'a shattered primary lance clears uwep');
assert.equal(state.lance.where, OBJ_DELETED,
             'a shattered primary lance is deleted');
assert.equal((game.invent || []).includes(state.lance), false,
             'a shattered primary lance leaves inventory');
assert.equal(!!game.u.twoweap, false,
             'shattering disables two-weapon mode');
assert.deepEqual({ x: state.target.mx, y: state.target.my },
                 { x: before.x, y: before.y + 1 },
                 'a surviving joust target is knocked back one square');
assertNoFormerMarker();

state = await setup();
setuwep(state.sword);
setuswapwep(state.lance);
set_twoweap(true);
before = { x: state.target.mx, y: state.target.my };
attack = await strike(state.target, state.lance);
assert.ok(saw(attack.log, 'd(2,2)=2'),
          'an offhand lance uses the two d2 joust bonus');
assert.equal(game.u.uwep, state.sword,
             'offhand shatter preserves the primary sword');
assert.equal(game.u.uswapwep || null, null,
             'offhand shatter clears the secondary slot');
assert.equal(state.lance.where, OBJ_DELETED,
             'offhand shatter deletes the lance');
assert.equal(!!game.u.twoweap, false,
             'offhand shatter disables two-weapon mode');
assert.deepEqual({ x: state.target.mx, y: state.target.my },
                 { x: before.x, y: before.y + 1 },
                 'offhand jousting also knocks the target back');

state = await setup();
(game.u.intrinsic ||= {}).HFumbling = 1;
attack = await strike(state.target, state.lance);
assert.equal(sawJoustRoll(attack.log), false,
             'fumbling rejects jousting before its one-in-five roll');
assert.equal(state.lance.where, OBJ_INVENT,
             'fumbling cannot shatter the lance');

state = await setup();
(game.u.intrinsic ||= {}).HStun = 1;
attack = await strike(state.target, state.lance);
assert.equal(sawJoustRoll(attack.log), false,
             'stun rejects jousting before its one-in-five roll');
assert.equal(state.lance.where, OBJ_INVENT,
             'stun cannot shatter the lance');

state = await setup();
game.u.utrap = 1;
game.u.utraptype = TT_PIT;
attack = await strike(state.target, state.lance);
assert.equal(sawJoustRoll(attack.log), false,
             'a trapped rider cannot make the joust roll');
assert.equal(state.lance.where, OBJ_INVENT,
             'being trapped cannot shatter the lance');

state = await setup();
setuwep(state.sword);
setuswapwep(state.lance);
set_twoweap(false);
attack = await strike(state.target, state.lance);
assert.equal(sawJoustRoll(attack.log), false,
             'an inactive offhand lance cannot make the joust roll');
assert.equal(state.lance.where, OBJ_INVENT,
             'an inactive offhand lance cannot shatter');

state = await setup();
state.target.data = game.mons[PMNAMES.PM_GHOST];
attack = await strike(state.target, state.lance);
assert.ok(saw(attack.log, 'rnl(50)=49'),
          'unsolid control reaches the shatter decision');
assert.equal(attack.log.some(value => /^rn2\(100\)=/.test(value)), false,
             'unsolid target short-circuits object resistance');
assert.ok(attack.log.some(value => /^d\(2,10\)=/.test(value)),
          'unsolid target still receives ordinary primary joust bonus');
assert.equal(state.lance.where, OBJ_INVENT,
             'an unsolid target suppresses lance shatter');

state = await setup();
state.lance.oartifact = ART_ORCRIST;
attack = await strike(state.target, state.lance);
assert.ok(saw(attack.log, 'rn2(100)=13'),
          'artifact control spends the ordinary resistance draw');
assert.ok(saw(attack.log, 'd(2,10)=4'),
          'resistant lance still receives primary joust bonus');
assert.equal(state.lance.where, OBJ_INVENT,
             'artifact resistance suppresses lance shatter');

state = await setup();
state.lance.oartifact = ART_ORCRIST;
state.target.mhp = state.target.mhpmax = 12;
assert.ok(maketrap(state.target.mx, state.target.my + 1, PIT),
          'trap control places a pit behind the target');
attack = await strike(state.target, state.lance);
assert.equal(attack.result, false,
             'a pit kill during joust knockback reports target death');
assert.ok(state.target.mhp <= 0,
          'the target dies before pending lance damage is applied');
assert.equal(state.target.my, game.u.uy + 2,
             'the fatal trap is reached by one-square knockback');
assert.equal(state.lance.where, OBJ_INVENT,
             'the resistant lance survives the trap-kill control');

console.log('mounted jousting state: PASS');
