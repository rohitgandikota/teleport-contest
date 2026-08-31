#!/usr/bin/env node

// State checks for controlled hero lycanthropy, cursed-water changes, and
// holy-water purification. The paired C recording pins every visible frame
// and random call while this gate checks the underlying form state.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { FROMFORM, NON_PM } from '../js/const.js';

const recipePath = new URL(
    'gen-sessions/recipes/were-hero-control-cure.json', import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));
const watchedSteps = new Set([210, 211, 214, 215, 222, 223, 224]);
const trace = new Map();

globalThis.__step_snapshot = {
    step: '*',
    cb: (state, step) => {
        if (!watchedSteps.has(step))
            return;
        trace.set(step, {
            ulycn: state.u.ulycn,
            umonster: state.u.umonster,
            umonnum: state.u.umonnum,
            mtimedone: state.u.mtimedone | 0,
            mh: state.u.mh | 0,
            mhmax: state.u.mhmax | 0,
            drainResistance: state.u.intrinsic?.HDrain_resistance || 0,
            cloak: state.u.uarmc?.otyp ?? null,
            weapon: state.u.uwep?.otyp ?? null,
            controlRing: state.u.uright?.otyp ?? null,
            message: state._pending_message || '',
        });
    },
};
try {
    await runSegment({ ...recipe.segments[0], onFrame: () => {} });
} finally {
    delete globalThis.__step_snapshot;
}

const firstPrompt = trace.get(210);
assert.equal(firstPrompt.ulycn, PMNAMES.PM_WEREWOLF,
             'the first cursed dose leaves the infection active');
assert.equal(firstPrompt.umonnum, firstPrompt.umonster,
             'the hero is still in base form while the first prompt waits');
assert.equal(firstPrompt.controlRing, ONAMES.RIN_POLYMORPH_CONTROL,
             'the right-hand control ring supplies the prompt');
assert.equal(firstPrompt.message,
             'Do you want to change into a wolf? [yn] (n) ',
             'the controlled were-change prompt names the beast form');

const declined = trace.get(211);
assert.equal(declined.ulycn, PMNAMES.PM_WEREWOLF,
             'declining does not cure the infection');
assert.equal(declined.umonnum, declined.umonster,
             'declining keeps the hero in base form');
assert.ok(declined.drainResistance & FROMFORM,
          'the infected base form retains lycanthropic drain resistance');

assert.equal(trace.get(214).message,
             'Do you want to change into a wolf? [yn] (n) ',
             'a later cursed dose offers the same controlled choice');
const changed = trace.get(215);
assert.equal(changed.ulycn, PMNAMES.PM_WEREWOLF,
             'accepting preserves the infection');
assert.equal(changed.umonnum, PMNAMES.PM_WEREWOLF,
             'accepting installs the werewolf body');
assert.ok(changed.mtimedone > 0 && changed.mh > 0
          && changed.mh === changed.mhmax,
          'the new body receives its form timer and hit points');
assert.equal(changed.cloak, null,
             'the werewolf body sheds the incompatible cloak');

const purified = trace.get(222);
assert.equal(purified.ulycn, NON_PM,
             'holy water cures the infection before the form prompt');
assert.equal(purified.umonnum, PMNAMES.PM_WEREWOLF,
             'purification leaves the current beast body in place initially');
assert.equal(purified.message,
             'You feel full of awe.  You feel purified.',
             'the water and cure messages share the expected page');
assert.equal(trace.get(223).message, 'Remain in beast form? [yn] (n) ',
             'polymorph control can retain the cured beast body');

const restored = trace.get(224);
assert.equal(restored.ulycn, NON_PM,
             'the cured hero remains free of lycanthropy');
assert.equal(restored.umonnum, restored.umonster,
             'declining retention restores the base body');
assert.equal(restored.mtimedone, 0,
             'returning to base form clears the polymorph timer');
assert.equal(restored.mh, 0,
             'returning to base form clears current monster hit points');
assert.equal(restored.mhmax, 0,
             'returning to base form clears maximum monster hit points');
assert.equal(restored.drainResistance & FROMFORM, 0,
             'purification removes lycanthropy-sourced drain resistance');
assert.equal(restored.weapon, null,
             'the weapon dropped by the werewolf form stays on the floor');
assert.equal(restored.message, 'You return to human form!',
             'rehumanization reports the race form');

const droppedStaff = (game.level.objects || []).find(obj =>
    obj.otyp === ONAMES.QUARTERSTAFF && !(obj.owornmask | 0));
assert.ok(droppedStaff,
          'the incompatible quarterstaff remains as an unworn floor object');

const paths = [...(game.unported || [])];
assert.ok(!paths.some(path =>
    path === 'you_were:controlled_prompt'
    || path === `peffects:otyp=${ONAMES.POT_WATER}`),
'controlled lycanthropy and holy water leave no former implementation marker');

console.log('controlled lycanthropy and purification state: PASS');
