#!/usr/bin/env node

// State checks for src/were.c:new_were() applying a timed flee when a
// human were creature changes form during its attack on an Elbereth square.
// The paired C recording pins the attack-time form roll and flee duration.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/were-scary-flee.json', import.meta.url), 'utf8'));
const watchedSteps = new Set([74, 75, 77]);
const trace = new Map();

globalThis.__step_snapshot = {
    step: '*',
    cb: (state, step) => {
        if (!watchedSteps.has(step))
            return;
        const mon = (state.level.monsters || []).find(candidate =>
            (candidate.mnum === PMNAMES.PM_HUMAN_WEREWOLF
             || candidate.mnum === PMNAMES.PM_WEREWOLF)
            && (candidate.mhp | 0) > 0);
        assert.ok(mon, 'were creature exists at step ' + step);
        trace.set(step, {
            mnum: mon.mnum,
            peaceful: !!mon.mpeaceful,
            fleeing: !!mon.mflee,
            fleeTime: mon.mfleetim | 0,
            x: mon.mx | 0,
            y: mon.my | 0,
            targetX: mon.mux | 0,
            targetY: mon.muy | 0,
        });
    },
};
try {
    await runSegment({ ...recipe.segments[0], onFrame: () => {} });
} finally {
    delete globalThis.__step_snapshot;
}

const created = trace.get(74);
assert.deepEqual({
    mnum: created?.mnum,
    peaceful: created?.peaceful,
    fleeing: created?.fleeing,
    fleeTime: created?.fleeTime,
}, {
    mnum: PMNAMES.PM_HUMAN_WEREWOLF,
    peaceful: false,
    fleeing: false,
    fleeTime: 0,
}, 'the hostile human werewolf starts unafraid of Elbereth');

assert.equal(trace.get(75)?.mnum, PMNAMES.PM_HUMAN_WEREWOLF,
             'the first recorded full-moon roll keeps human form');
assert.equal(trace.get(75)?.fleeing, false,
             'the human form remains immune to the magical scare');

const changed = trace.get(77);
assert.equal(changed?.mnum, PMNAMES.PM_WEREWOLF,
             'the attack-time summonmu roll changes the werewolf to beast form');
assert.equal(changed?.fleeing, true,
             'the new beast form flees from the Elbereth square');
assert.equal(changed?.fleeTime, 4,
             'the C-recorded five-turn timer decrements once by the snapshot');
assert.ok(Math.max(Math.abs(changed.x - changed.targetX),
                   Math.abs(changed.y - changed.targetY)) <= 1,
          'the form change happens while the werewolf is next to its target');

const paths = [...(game.unported || [])];
assert.ok(!paths.some(path => path.startsWith('were:')),
          'scary-square transformation leaves no were implementation marker');

console.log('were scary-square form-change flee state: PASS');
