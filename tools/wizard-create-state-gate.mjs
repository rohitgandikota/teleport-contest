#!/usr/bin/env node

// State checks for src/read.c create_particular_creation(). The matching C
// recipe pins every visible frame and every random draw for the same cases.

import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { M_AP_TYPE, M_AP_OBJECT, NON_PM, W_SADDLE } from '../js/const.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { which_armor } from '../js/worn.js';

const nethackrc = [
    'OPTIONS=name:wizard,role:Valkyrie,race:human,gender:female,align:lawful,playmode:debug',
    'OPTIONS=!autopickup,!tutorial,!tips,pettype:none',
    'OPTIONS=suppress_alert:3.4.3',
    'OPTIONS=symset:DECgraphics',
    '',
].join('\n');

async function run(seed, moves) {
    await runSegment({
        seed,
        datetime: '20000112090000',
        nethackrc,
        moves,
        onFrame: () => {},
    });
    return (game.level.monsters || []).filter(mon => (mon.mhp || 0) > 0);
}

let monsters = await run(6966, ' \x073 newt\r');
assert.equal(monsters.filter(mon => mon.mnum === PMNAMES.PM_NEWT).length, 3,
             'text quantity creates three monsters');

monsters = await run(6967, ' 3\x07newt\r');
assert.equal(monsters.filter(mon => mon.mnum === PMNAMES.PM_NEWT).length, 3,
             'command count creates three monsters');
assert.equal(game.multi || 0, 0,
             'wizard creation consumes its command count without repetition');

monsters = await run(6968, ' \x07tame saddled pony\r');
let mon = monsters.find(candidate => candidate.mnum === PMNAMES.PM_PONY);
assert.ok(mon, 'saddled pony was created');
assert.ok(mon.mtame > 0, 'explicitly tame pony has pet state');
assert.equal(which_armor(mon, W_SADDLE)?.otyp, ONAMES.SADDLE,
             'valid mount receives a worn saddle');

monsters = await run(6969, ' \x07sleeping hidden lurker above\r');
mon = monsters.find(candidate => candidate.mnum === PMNAMES.PM_LURKER_ABOVE);
assert.ok(mon, 'hidden lurker was created');
assert.equal(mon.mundetected, 1, 'ceiling hider starts hidden');
assert.equal(mon.msleeping, 1, 'sleeping modifier is retained with hiding');

monsters = await run(6970, ' \x07hidden snake\r');
mon = monsters.find(candidate => candidate.mnum === PMNAMES.PM_SNAKE);
assert.ok(mon, 'hidden-request snake was created');
assert.equal(mon.mundetected || 0, 0,
             'concealer without an object does not become hidden');

monsters = await run(6971, ' \x07female amorous demon\r');
mon = monsters.find(candidate => candidate.mnum === PMNAMES.PM_AMOROUS_DEMON);
assert.equal(mon?.female, 1, 'explicit female term selects succubus sex');

monsters = await run(6972, ' \x07male succubus\r');
mon = monsters.find(candidate => candidate.mnum === PMNAMES.PM_AMOROUS_DEMON);
assert.equal(mon?.female, 0,
             'explicit male term overrides the conflicting female name');

monsters = await run(6973, ' \x07succubus\r');
mon = monsters.find(candidate => candidate.mnum === PMNAMES.PM_AMOROUS_DEMON);
assert.equal(mon?.female, 1, 'gendered monster name supplies female sex');

monsters = await run(6978, ' \x07I\r');
mon = monsters.find(candidate => candidate.mnum === PMNAMES.PM_STALKER);
assert.ok(mon, 'invisible-class symbol creates a stalker');
assert.equal(mon.perminvis, true, 'stalker retains permanent invisibility');
assert.equal(mon.minvis, true, 'stalker begins invisible');

monsters = await run(6980, ' \x07guard\rn');
assert.ok(monsters.some(candidate => candidate.mnum === PMNAMES.PM_HUMAN_ZOMBIE),
          'declined guard override creates the safe replacement');

monsters = await run(6981, ' \x07guard\ry');
assert.ok(monsters.some(candidate => candidate.mnum === PMNAMES.PM_GUARD),
          'accepted guard override creates the requested special monster');

monsters = await run(6982, ' \x07saddled newt\r');
mon = monsters.find(candidate => candidate.mnum === PMNAMES.PM_NEWT);
assert.ok(mon, 'saddled-request newt was created');
assert.equal(which_armor(mon, W_SADDLE), null,
             'unsaddleable monster does not receive a saddle');

monsters = await run(6983, ' \x07Digger\r');
assert.ok(monsters.some(candidate => candidate.mnum === PMNAMES.PM_ARCHEOLOGIST),
          'rank title resolves to its player-monster role');

monsters = await run(6984, ' \x07elf lady\r');
mon = monsters.find(candidate => candidate.mnum === PMNAMES.PM_ELF_NOBLE);
assert.equal(mon?.female, 1, 'gendered alternate name selects elf-lady sex');

monsters = await run(6985, ' \x07]\r');
mon = monsters.find(candidate => M_AP_TYPE(candidate) === M_AP_OBJECT
                              && candidate.mappearance === ONAMES.GOLD_PIECE);
assert.ok(mon, 'mimic-class symbol can create a coin-pile disguise');

monsters = await run(6987, ' \x07Medusa\rn');
mon = monsters.find(candidate => candidate.mnum === PMNAMES.PM_MEDUSA);
assert.ok(mon, 'safe shapechanger replacement assumes the requested form');
assert.equal(mon.cham, PMNAMES.PM_DOPPELGANGER,
             'replacement retains its doppelganger base form');

monsters = await run(6988, ' \x07long worm tail\r');
mon = monsters.find(candidate => candidate.mnum === PMNAMES.PM_LONG_WORM);
assert.ok(mon, 'long worm tail request creates a long worm');
assert.notEqual(mon.wormno || 0, 0, 'created long worm has tail state');
assert.notEqual(mon.cham ?? NON_PM, PMNAMES.PM_DOPPELGANGER,
                'long worm conversion is not a shapechanger replacement');

console.log('wizard create state: PASS');
