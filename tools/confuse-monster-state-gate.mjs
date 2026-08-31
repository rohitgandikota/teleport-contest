#!/usr/bin/env node

// State checks for src/read.c seffect_confuse_monster() and the charged-touch
// tail of src/uhitm.c hmon_hitmon(). The paired C recording pins output and
// RNG order for the same ordinary, blessed, blind, and cursed cases.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';

const recipePath = new URL('gen-sessions/recipes/confuse-monster-touch.json',
                           import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));

async function run(index, capture = false) {
    const trace = [];
    if (capture) {
        globalThis.__step_snapshot = {
            step: '*',
            cb: (state, step) => {
                const target = (state.level.monsters || [])
                    .find(mon => mon.mnum === PMNAMES.PM_ARCH_LICH
                                 && (mon.mhp || 0) > 0);
                trace.push({
                    step,
                    umconf: state.u.umconf | 0,
                    mconf: target?.mconf | 0,
                });
            },
        };
    }
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

function assertNoFormerMarkers() {
    const paths = [...(game.unported || [])];
    assert.ok(!paths.some(path =>
        path === 'read:seffects:otyp=325'
        || path === 'uhitm:hmon_hitmon:resist_confuse'
        || path === 'uhitm:nohandglow:message'),
    'confuse-monster cases leave no former implementation marker');
}

await run(0);
assert.equal(liveMonster(PMNAMES.PM_STONE_GIANT)?.mconf, 1,
             'failed resistance confuses the stone giant');
assert.equal(game.u.umconf, 3,
             'one successful touch spends one of four ordinary charges');
assertNoFormerMarkers();

const trace = await run(1, true);
const resisted = trace.find(state => state.step === 115);
const successful = trace.find(state => state.step === 117);
assert.deepEqual(resisted, { step: 115, umconf: 8, mconf: 0 },
                 'the first arch-lich touch is resisted but spends a charge');
assert.deepEqual(successful, { step: 117, umconf: 7, mconf: 1 },
                 'the second arch-lich touch fails resistance and confuses it');
assertNoFormerMarkers();

await run(2);
assert.equal(game.u.ublind, 1,
             'the blind feedback case remains blind after reading');
assert.equal(game.u.umconf, 5,
             'blind feedback still grants the ordinary charge count');
assertNoFormerMarkers();

await run(3);
assert.equal(game.u.intrinsic?.HConfusion, 16,
             'the cursed scroll applies its C-recorded confusion timeout');
assert.equal(game.u.uprops?.CONFUSION, 1,
             'the timed confusion property is active');
assert.equal(game.u.umconf | 0, 0,
             'the cursed scroll does not charge monster-confusing touch');
assertNoFormerMarkers();

console.log('confuse-monster scroll and touch state: PASS');
