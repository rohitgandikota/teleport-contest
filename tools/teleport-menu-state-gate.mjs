#!/usr/bin/env node

// State checks for src/teleport.c dotelecmd() and src/spell.c tport_spell().
// The matching C recipe records every visible wizard teleport-menu outcome.

import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { pushKey, pushKeys } from '../js/input.js';
import { dotelecmd } from '../js/teleport.js';
import { force_learn_spell, known_spell, spe_Fresh, spe_Unknown,
         tport_spell, NOOP_SPELL, HIDE_SPELL, ADD_SPELL,
         UNHIDESPELL, REMOVESPELL } from '../js/spell.js';
import { ONAMES } from '../js/objects_data.js';
import { TOPLINE_NEED_MORE } from '../js/display.js';

await runSegment({
    seed: 6959,
    datetime: '20000112121000',
    nethackrc: [
        'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug',
        'OPTIONS=!autopickup,!tutorial,!tips,pettype:none,debug_mongen',
        'OPTIONS=suppress_alert:3.4.3',
        'OPTIONS=symset:DECgraphics',
        '',
    ].join('\n'),
    moves: ' ',
    onFrame: () => {},
});

const spellSnapshot = () => structuredClone(game.spl_book || []);
const initialBook = spellSnapshot();

let undo = tport_spell(ADD_SPELL);
assert.equal(undo, REMOVESPELL, 'adding teleport away returns its inverse');
assert.equal(known_spell(ONAMES.SPE_TELEPORT_AWAY), spe_Fresh,
             'temporary teleport away is fully learned');
tport_spell(undo);
assert.deepEqual(spellSnapshot(), initialBook,
                 'removing the temporary spell restores the exact spell list');

force_learn_spell(ONAMES.SPE_TELEPORT_AWAY);
const learnedBook = spellSnapshot();
assert.equal(tport_spell(ADD_SPELL), NOOP_SPELL,
             'adding an already-known spell is a no-op');
assert.deepEqual(spellSnapshot(), learnedBook,
                 'the no-op leaves the learned spell untouched');

undo = tport_spell(HIDE_SPELL);
assert.equal(undo, UNHIDESPELL, 'hiding teleport away returns its inverse');
assert.equal(known_spell(ONAMES.SPE_TELEPORT_AWAY), spe_Unknown,
             'a hidden teleport-away slot is not discoverable');
tport_spell(undo);
assert.deepEqual(spellSnapshot(), learnedBook,
                 'unhiding restores every field in the learned spell slot');

const intrinsic = (game.u.intrinsic ||= {});
const uprops = (game.u.uprops ||= {});
intrinsic.HTeleportation = 0x01020304;
uprops.TELEPORT = 0x00040000;

async function choose(mode, extraKeys = '') {
    game.iflags.menu_requested = true;
    if (game._toplin === TOPLINE_NEED_MORE)
        pushKey(' ');
    pushKey(mode);
    pushKeys(extraKeys);
    await dotelecmd();
    assert.equal(intrinsic.HTeleportation, 0x01020304,
                 `${mode} restores intrinsic teleportation`);
    assert.equal(uprops.TELEPORT, 0x00040000,
                 `${mode} restores extrinsic teleportation`);
    assert.deepEqual(spellSnapshot(), learnedBook,
                     `${mode} restores the learned spell list`);
}

await choose('t');
await choose('n');
await choose('s');
await choose('w', '.');

const beforeCancel = {
    intrinsic: intrinsic.HTeleportation,
    extrinsic: uprops.TELEPORT,
    spells: spellSnapshot(),
    energy: game.u.uen,
    hunger: game.u.uhunger,
    x: game.u.ux,
    y: game.u.uy,
};
game.iflags.menu_requested = true;
if (game._toplin === TOPLINE_NEED_MORE)
    pushKey(' ');
pushKey('\x1b');
await dotelecmd();
assert.deepEqual({
    intrinsic: intrinsic.HTeleportation,
    extrinsic: uprops.TELEPORT,
    spells: spellSnapshot(),
    energy: game.u.uen,
    hunger: game.u.uhunger,
    x: game.u.ux,
    y: game.u.uy,
}, beforeCancel, 'cancelling the menu changes no gameplay state');

console.log('teleport menu state: PASS');
