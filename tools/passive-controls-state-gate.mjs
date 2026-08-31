#!/usr/bin/env node

// State checks for resisted and polymorphed branches of src/uhitm.c
// passive(). The paired C recordings pin the terminal output and RNG order.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { M_SEEN_ACID, M_SEEN_COLD, M_SEEN_ELEC, M_SEEN_FIRE,
         M_SEEN_MAGR } from '../js/const.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';

const controlsPath = new URL('gen-sessions/recipes/passive-controls.json',
                             import.meta.url);
const golemsPath = new URL('gen-sessions/recipes/passive-golem-controls.json',
                           import.meta.url);
const controls = JSON.parse(await readFile(controlsPath, 'utf8'));
const golems = JSON.parse(await readFile(golemsPath, 'utf8'));

async function run(recipe, index) {
    const trace = [];
    globalThis.__step_snapshot = {
        step: '*',
        cb: (state, step) => trace.push({
            step,
            multi: state.multi | 0,
            reason: state.multi_reason || '',
            mh: state.u?.mh | 0,
            mhmax: state.u?.mhmax | 0,
            umonnum: state.u?.umonnum,
        }),
    };
    try {
        await runSegment({ ...recipe.segments[index], onFrame: () => {} });
    } finally {
        delete globalThis.__step_snapshot;
    }
    return trace;
}

function liveMonster(mnum) {
    return (game.level.monsters || []).find(mon => mon.mnum === mnum
                                             && (mon.mhp || 0) > 0);
}

function sawResistance(mon, mask) {
    return !!((mon?.seen_resistance || 0) & mask);
}

let trace = await run(controls, 0);
assert.ok(!trace.some(state => state.multi < 0
                               && state.reason.includes('gaze')),
          'reflection prevents floating-eye paralysis');

trace = await run(controls, 1);
assert.ok(!trace.some(state => state.multi < 0
                               && state.reason.includes('gaze')),
          'free action prevents floating-eye paralysis');

trace = await run(controls, 2);
assert.ok(!trace.some(state => state.multi < 0
                               && state.reason.includes('gelatinous cube')),
          'free action prevents gelatinous-cube paralysis');

await run(controls, 3);
assert.equal(game.u.uhp, game.u.uhpmax,
             'cold resistance prevents blue-jelly passive damage');
assert.ok(sawResistance(liveMonster(PMNAMES.PM_BLUE_JELLY), M_SEEN_COLD),
          'visible blue jelly remembers cold resistance');

await run(controls, 4);
assert.equal(game.u.uhp, game.u.uhpmax,
             'fire resistance prevents fire-elemental passive damage');
assert.ok(sawResistance(liveMonster(PMNAMES.PM_FIRE_ELEMENTAL), M_SEEN_FIRE),
          'visible fire elemental remembers fire resistance');

await run(controls, 5);
assert.equal(game.u.uhp, game.u.uhpmax,
             'shock resistance prevents energy-vortex passive damage');
assert.ok(sawResistance(liveMonster(PMNAMES.PM_ENERGY_VORTEX), M_SEEN_ELEC),
          'visible energy vortex remembers shock resistance');

await run(controls, 6);
assert.equal(game.u.uhp, game.u.uhpmax,
             'magic resistance prevents Oracle passive damage');
assert.ok(sawResistance(liveMonster(PMNAMES.PM_ORACLE), M_SEEN_MAGR),
          'visible Oracle remembers magic resistance');

await run(controls, 7);
assert.equal(game.u.umortality || 0, 0,
             'weapon contact prevents cockatrice petrification');

await run(controls, 8);
assert.equal(game.u.uhp, game.u.uhpmax,
             'acid resistance prevents acid-blob passive damage');
assert.equal(game.u.uarm?.otyp, ONAMES.YELLOW_DRAGON_SCALE_MAIL,
             'acid control keeps yellow dragon scale mail worn');
assert.equal(game.u.uwep?.oeroded2 || 0, 0,
             'acid-resistant equipment protects the striking katana');
assert.ok(sawResistance(liveMonster(PMNAMES.PM_ACID_BLOB), M_SEEN_ACID),
          'visible acid blob remembers acid resistance');

await run(controls, 9);
assert.equal(liveMonster(PMNAMES.PM_RUST_MONSTER)?.mcan, 1,
             'wand cancellation marks the rust monster cancelled');
assert.equal(game.u.uwep?.oeroded || 0, 0,
             'cancelled rust retaliation does not erode the katana');

trace = await run(golems, 0);
assert.equal(game.u.umonnum, PMNAMES.PM_IRON_GOLEM,
             'fire control remains in iron-golem form');
assert.ok(trace.some(state => state.mh === 120 && state.mhmax === 120),
          'fire retaliation heals the damaged iron golem to full');
assert.equal(game.u.mh, 119,
             'later C-recorded bite leaves the healed iron golem at 119 HP');
assert.ok(sawResistance(liveMonster(PMNAMES.PM_FIRE_ELEMENTAL), M_SEEN_FIRE),
          'fire elemental remembers the iron golem fire resistance');

trace = await run(golems, 1);
assert.equal(game.u.umonnum, PMNAMES.PM_FLESH_GOLEM,
             'shock control remains in flesh-golem form');
assert.ok(trace.some(state => state.mh === 40 && state.mhmax === 40),
          'shock retaliation heals the damaged flesh golem to full');
assert.equal(game.u.mh, 40,
             'flesh golem ends the control at full health');

await run(golems, 2);
assert.equal(game.u.umonnum, PMNAMES.PM_STONE_GOLEM,
             'cockatrice contact converts a flesh golem to stone');
assert.equal(game.u.mhmax, 100,
             'stone conversion installs the fixed maximum HP');
assert.equal(game.u.mh, 96,
             'later C-recorded damage leaves the stone golem at 96 HP');

console.log('passive controls state: PASS');
