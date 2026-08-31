#!/usr/bin/env node

// State checks for the lycanthropy arm of src/eat.c:maybe_cannibal(). The
// paired C recording pins the taste messages, penalty draws, and meal flow.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';
import { FROMOUTSIDE } from '../js/const.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/were-family-cannibalism.json', import.meta.url),
'utf8'));
const expected = [
    { family: 'rat', ulycn: PMNAMES.PM_WERERAT, luck: -1 },
    { family: 'jackal', ulycn: PMNAMES.PM_WEREJACKAL, luck: -4 },
    { family: 'wolf', ulycn: PMNAMES.PM_WEREWOLF, luck: -1 },
];

for (let index = 0; index < expected.length; index += 1) {
    const want = expected[index];
    await runSegment({ ...recipe.segments[index], onFrame: () => {} });
    assert.equal(game.u.ulycn, want.ulycn,
                 `the ${want.family} scenario retains its infection`);
    assert.equal(game.u.uluck, want.luck,
                 `the ${want.family} corpse applies its recorded luck loss`);
    assert.ok((game.u.intrinsic?.HAggravate_monster | 0) & FROMOUTSIDE,
              `the ${want.family} corpse grants permanent aggravation`);
    assert.ok((game.level.monsters || []).some(mon =>
        (mon.mhp | 0) > 0 && mon.mpeaceful),
    `the ${want.family} source is pacified before the meal`);
}

console.log('were-family corpse cannibalism state: PASS');
