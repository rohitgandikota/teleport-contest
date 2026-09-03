#!/usr/bin/env node

// src/read.c:3112 cant_revive returns both a decision and a monster type.
// Keep both outputs pinned, including the exceptions for saved traits.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { cant_revive } from '../js/read.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/revival-substitute-types.json', import.meta.url), 'utf8'));
await runSegment({ ...recipe.segments[0], moves: ' ' });

const cases = [
    ['PM_GUARD', true, null, 'PM_HUMAN_ZOMBIE'],
    ['PM_HIGH_CLERIC', true, null, 'PM_HUMAN_ZOMBIE'],
    ['PM_ALIGNED_CLERIC', true, null, 'PM_HUMAN_ZOMBIE'],
    ['PM_ANGEL', true, null, 'PM_HUMAN_ZOMBIE'],
    ['PM_SHOPKEEPER', false, null, 'PM_HUMAN_ZOMBIE'],
    ['PM_SHOPKEEPER', true, null, 'PM_SHOPKEEPER'],
    ['PM_LONG_WORM_TAIL', false, null, 'PM_LONG_WORM'],
    ['PM_DEATH', true, null, 'PM_DOPPELGANGER'],
    ['PM_PESTILENCE', true, null, 'PM_DOPPELGANGER'],
    ['PM_FAMINE', true, null, 'PM_DOPPELGANGER'],
    ['PM_MEDUSA', true, {}, 'PM_DOPPELGANGER'],
    ['PM_MEDUSA', true, { oextra: { omonst: {} } }, 'PM_MEDUSA'],
    ['PM_NEWT', true, null, 'PM_NEWT'],
];
for (const [input, revival, corpse, output] of cases) {
    const type = { v: PMNAMES[input] };
    assert.equal(cant_revive(type, revival, corpse), input !== output,
                 `${input}: substitution decision`);
    assert.equal(type.v, PMNAMES[output], `${input}: output monster type`);
}

for (let index = 0; index < 3; index++) {
    await runSegment({ ...recipe.segments[index] });
    const zombie = game.level.monsters.find(mon =>
        mon.mnum === PMNAMES.PM_HUMAN_ZOMBIE && mon.mhp > 0);
    assert.ok(zombie, `segment ${index}: substitute zombie exists`);
    assert.equal(zombie.mhpmax, 100, 'revive gives the substitute 100 HP');
    assert.equal(zombie.permspeed, 2, 'revive makes the substitute fast');
}
await runSegment({ ...recipe.segments[3] });
assert.ok(game.level.monsters.some(mon =>
    mon.mnum === PMNAMES.PM_MEDUSA && mon.cham === PMNAMES.PM_DOPPELGANGER),
    'the unique corpse becomes a shapechanger in the original form');

console.log('revival substitution state: PASS');
