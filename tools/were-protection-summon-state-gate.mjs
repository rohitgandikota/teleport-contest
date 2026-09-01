#!/usr/bin/env node

// State checks for shape protection forcing a werewolf human and blocking
// hostile helpers. The paired C recording pins the turn and summon rolls.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/were-protection-summon.json', import.meta.url),
'utf8'));

await runSegment({ ...recipe.segments[0], onFrame: () => {} });
assert.equal(game.u.uright?.otyp,
             ONAMES.RIN_PROTECTION_FROM_SHAPE_CHAN,
             'the right-hand ring supplies shape protection');
const living = (game.level.monsters || []).filter(mon => (mon.mhp | 0) > 0);
assert.ok(living.some(mon => mon.mnum === PMNAMES.PM_HUMAN_WEREWOLF),
          'shape protection forces the attacking beast back to human');
for (const helper of [PMNAMES.PM_WOLF, PMNAMES.PM_WARG,
                      PMNAMES.PM_WINTER_WOLF]) {
    assert.equal(living.some(mon => mon.mnum === helper), false,
                 'shape protection blocks every hostile wolf helper');
}

console.log('were shape-protection summon state: PASS');
