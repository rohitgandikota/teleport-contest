#!/usr/bin/env node

// State checks for the corpse payload cleanup in src/mon.c seemimic().
// The recorded shop sessions cover the visible reveal and map update.

import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { seemimic } from '../js/mon.js';
import { makemon, NO_MM_FLAGS } from '../js/makemon.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { M_AP_NOTHING, M_AP_OBJECT, NON_PM } from '../js/const.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';

await runSegment({
    seed: 8111,
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

const mimic = makemon(game.mons[PMNAMES.PM_SMALL_MIMIC], 0, 0,
                      NO_MM_FLAGS);
assert.ok(mimic, 'test mimic was created');
mimic.m_ap_type = M_AP_OBJECT;
mimic.mappearance = ONAMES.CORPSE;
mimic.mcorpsenm = PMNAMES.PM_GNOME;

initRng(102);
enableRngLog();
seemimic(mimic);

assert.deepEqual(getRngLog(), [], 'revealing a mimic consumes no RNG');
assert.equal(mimic.mcorpsenm, NON_PM,
             'revealing clears the saved corpse species');
assert.equal(mimic.m_ap_type, M_AP_NOTHING,
             'revealing clears the disguise type');
assert.equal(mimic.mappearance, 0,
             'revealing clears the disguise value');
assert.ok(!game.unported?.has('seemimic:mcorpsenm'),
          'mimic payload cleanup is no longer marked unported');

console.log('mimic disguise state: PASS');
