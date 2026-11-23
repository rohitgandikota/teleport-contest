#!/usr/bin/env node
// Constructed contracts for do_name.c:1460 and youprop.h:115-120.
// Source-derived expectations, not native recordings or input-reach evidence.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { game, resetGame } from '../js/gstate.js';
import { hcolor } from '../js/do_name.js';
import { Hallucination } from '../js/youprop.js';
import { FROMOUTSIDE, W_ARM } from '../js/const.js';
import { initRng, enableRngLog, getRngLog, rn2, rn2_on_display_rng } from '../js/rng.js';

// C's 74-entry hcolors table: index 5 is light black, index 71 is fulvous.
// These seeds exercise distinct entries using the real display generator.
const seeds = [[1, 'light black'], [7, 'fulvous']];
const cases = [
    { name: 'real color without hallucination', pref: 'white' },
    { name: 'no preference without hallucination', pref: null, draw: true },
    { name: 'active hallucination replaces a real color', timer: 20, pref: 'white', draw: true },
    { name: 'active hallucination with no preference', timer: 20, pref: null, draw: true },
    { name: 'intrinsic resistance keeps a real color', timer: 20, intrinsic: FROMOUTSIDE, pref: 'silver' },
    { name: 'intrinsic resistance with no preference still draws', timer: 20, intrinsic: FROMOUTSIDE, pref: null, draw: true },
    { name: 'extrinsic resistance keeps a real color', timer: 20, extrinsic: W_ARM, pref: 'black' },
    { name: 'extrinsic resistance with no preference still draws', timer: 20, extrinsic: W_ARM, pref: null, draw: true },
    { name: 'both resistance sources keep a real color', timer: 20, intrinsic: FROMOUTSIDE, extrinsic: W_ARM, pref: 'white' },
    { name: 'resistance without a timer keeps a real color', intrinsic: FROMOUTSIDE, extrinsic: W_ARM, pref: 'silver' },
    // Unlike hliquid, C hcolor has no program_state.gameover condition.
    { name: 'game over does not suppress active hallucination', timer: 20, gameover: true, pref: 'white', draw: true },
    { name: 'game over with no preference still draws', gameover: true, pref: null, draw: true },
    { name: 'game over respects intrinsic resistance', timer: 20, intrinsic: FROMOUTSIDE, gameover: true, pref: 'silver' },
    { name: 'game over respects extrinsic resistance', timer: 20, extrinsic: W_ARM, gameover: true, pref: 'black' },
    // C !colorpref checks a null pointer, not an empty pointed-to string.
    { name: 'empty preference without hallucination is preserved', pref: '' },
    { name: 'active hallucination replaces an empty preference', timer: 20, pref: '', draw: true },
    { name: 'intrinsic resistance preserves an empty preference', timer: 20, intrinsic: FROMOUTSIDE, pref: '' },
    { name: 'extrinsic resistance preserves an empty preference', timer: 20, extrinsic: W_ARM, pref: '' },
    { name: 'game over does not suppress an active empty preference', timer: 20, gameover: true, pref: '', draw: true },
    { name: 'game over with resistance preserves an empty preference', timer: 20, extrinsic: W_ARM, gameover: true, pref: '' },
];

for (const sample of cases) test(sample.name, () => {
    const oldDisplayLog = globalThis.__rng_log_disp;
    globalThis.__rng_log_disp = true;
    try {
        for (const [seed, color] of seeds) {
            resetGame();
            game.u = {
                intrinsic: { HHallucination: sample.timer || 0,
                    HHalluc_resistance: sample.intrinsic || 0 },
                uprops: { HALLUC: sample.timer || 0, HALLUC_RES: sample.extrinsic || 0 },
            };
            game.program_state_gameover = !!sample.gameover;
            assert.equal(Hallucination(), !!sample.timer && !sample.intrinsic && !sample.extrinsic);

            // C spends one display draw only for Hallucination or a null
            // preference. Probe the following display and core positions too.
            initRng(seed); game.dispCtx = null; enableRngLog();
            if (sample.draw) rn2_on_display_rng(74);
            const nextDisplay = rn2_on_display_rng(997);
            const nextCore = rn2(997);
            const expectedDraws = getRngLog().slice();

            initRng(seed); game.dispCtx = null; enableRngLog();
            assert.equal(hcolor(sample.pref), sample.draw ? color : sample.pref);
            assert.equal(rn2_on_display_rng(997), nextDisplay);
            assert.equal(rn2(997), nextCore);
            assert.deepEqual(getRngLog(), expectedDraws);
            assert.equal(game.u.intrinsic.HHallucination, sample.timer || 0);
            assert.equal(game.u.uprops.HALLUC_RES, sample.extrinsic || 0);
        }
    } finally {
        if (oldDisplayLog === undefined) delete globalThis.__rng_log_disp;
        else globalThis.__rng_log_disp = oldDisplayLog;
    }
});
