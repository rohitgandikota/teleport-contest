#!/usr/bin/env node

// State checks for src/dothrow.c:thitmonst() and src/potion.c:potionhit()
// when the hero throws blessed water at a peaceful human werewolf.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/potion-monster-impact.json', import.meta.url),
'utf8'));
const watchedSteps = new Set([120, 123, 124, 125]);
const trace = new Map();

globalThis.__step_snapshot = {
    step: '*',
    cb: (state, step) => {
        if (!watchedSteps.has(step))
            return;
        const mon = (state.level.monsters || []).find(candidate =>
            candidate.mnum === PMNAMES.PM_HUMAN_WEREWOLF
            && (candidate.mhp | 0) > 0);
        assert.ok(mon, 'human werewolf exists at step ' + step);
        trace.set(step, {
            hp: mon.mhp | 0,
            maxHp: mon.mhpmax | 0,
            peaceful: !!mon.mpeaceful,
            sleeping: !!mon.msleeping,
            waterCount: (state.invent || []).filter(obj =>
                obj.otyp === ONAMES.POT_WATER)
                .reduce((total, obj) => total + (obj.quan | 0), 0),
        });
    },
};
try {
    await runSegment({ ...recipe.segments[0], onFrame: () => {} });
} finally {
    delete globalThis.__step_snapshot;
}

assert.deepEqual(trace.get(120), {
    hp: 27,
    maxHp: 27,
    peaceful: true,
    sleeping: false,
    waterCount: 2,
}, 'the target begins healthy and peaceful with blessed water in inventory');

assert.deepEqual(trace.get(123), {
    hp: 26,
    maxHp: 27,
    peaceful: true,
    sleeping: false,
    waterCount: 1,
}, 'the successful throw consumes the potion and applies one shard damage');

assert.deepEqual(trace.get(124), {
    hp: 21,
    maxHp: 27,
    peaceful: false,
    sleeping: false,
    waterCount: 1,
}, 'blessed water deals the C-recorded five damage and angers the target');

assert.equal(trace.get(125)?.hp, 22,
             'ordinary monster regeneration follows the completed impact');
assert.equal(trace.get(125)?.peaceful, false,
             'the attacked werewolf remains hostile');

const paths = [...(game.unported || [])];
assert.ok(!paths.some(path => path.startsWith('potion:potionhit:monster')),
          'the monster potion impact leaves no potionhit implementation marker');

console.log('thrown blessed-water monster impact state: PASS');
