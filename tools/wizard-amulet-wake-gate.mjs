#!/usr/bin/env node

// State checks for the sleeping-Wizard branch of src/wizard.c amulet().
// Existing C sessions cover the no-draw path when all Wizards are awake.

import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { amulet } from '../js/wizard.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { pushKey } from '../js/input.js';

await runSegment({
    seed: 8110,
    datetime: '20000112090000',
    nethackrc: [
        'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug',
        'OPTIONS=!autopickup,!tutorial,!tips,pettype:none',
        'OPTIONS=suppress_alert:3.4.3',
        'OPTIONS=symset:DECgraphics',
        '',
    ].join('\n'),
    moves: ' ',
    onFrame: () => {},
});

game.u.uamul = null;
game.u.uwep = null;
const ordinaryMonsters = [...(game.level.monsters || [])];
const farX = game.u.ux > 20 ? game.u.ux - 10 : game.u.ux + 10;
const wizard = (fields = {}) => ({
    mhp: 10,
    iswiz: true,
    msleeping: true,
    mx: farX,
    my: game.u.uy,
    ...fields,
});

const dead = wizard({ mhp: 0 });
const firstSleeping = wizard();
const secondSleeping = wizard();
game.level.monsters = [dead, firstSleeping, secondSleeping,
                       ...ordinaryMonsters];
game.context.no_of_wizards = 3;

initRng(84);
enableRngLog();
pushKey(' ');
await amulet();

assert.deepEqual(getRngLog(), ['rn2(40)=18', 'rn2(40)=0'],
                 'dead Wizards are skipped and sleeping Wizards roll in order');
assert.equal(dead.msleeping, true, 'dead Wizard remains asleep');
assert.equal(firstSleeping.msleeping, true,
             'failed wake roll leaves the first live Wizard asleep');
assert.equal(secondSleeping.msleeping, 0,
             'successful wake roll wakes the next live Wizard');
assert.ok(game.nhDisplay.terminal.serialize().includes('creepy feeling'),
          'a distant wake prints the Amulet warning');

game.level.monsters = [wizard({ msleeping: false }), ...ordinaryMonsters];
game.context.no_of_wizards = 1;
initRng(102);
enableRngLog();
await amulet();

assert.deepEqual(getRngLog(), [], 'an awake Wizard consumes no wake roll');
assert.ok(!game.unported?.has('amulet:wake_wizard'),
          'the sleeping-Wizard path is no longer marked unported');

game.context.no_of_wizards = 0;
game.level.monsters[0].msleeping = true;
initRng(102);
enableRngLog();
await amulet();
assert.deepEqual(getRngLog(), [], 'no known Wizard consumes no wake roll');

console.log('wizard Amulet wake: PASS');
