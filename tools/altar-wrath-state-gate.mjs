#!/usr/bin/env node

// Source-state checks complement the byte-identical C altar recording.
// include/you.h defines Luck as uluck + moreluck; pray.c changes uluck only.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/altar-wrath-luck.json', import.meta.url), 'utf8'));
const reference = JSON.parse(readFileSync(new URL(
    'gen-sessions/generated/altar-wrath-luck.session.json', import.meta.url), 'utf8'));

// The fixed full-moon date supplies +1 base luck. These totals follow the
// recorded altar_wrath rolls, including the two-point penalty in segment 0.
const expected = [
    { uluck: -5, moreluck: 0 },
    { uluck: -1, moreluck: 3 },
    { uluck: -2, moreluck: -3 },
    { uluck: 1, moreluck: 0 },
    { uluck: 1, moreluck: 0 },
];
for (const [index, segment] of recipe.segments.entries()) {
    await runSegment({ ...segment, onFrame: () => {} });
    assert.deepEqual({ uluck: game.u.uluck, moreluck: game.u.moreluck },
                     expected[index], `segment ${index}: base and bonus luck`);
}

// After the seventh sit, C's total luck is -5. Thirteen further desecrations
// still print the warning, but must not draw either altar_wrath random number.
const segment = recipe.segments[0];
const eighthSit = [...segment.moves.matchAll(/#sit/g)][7].index;
assert.ok(eighthSit > 0, 'the cutoff probe includes later desecrations');
const tail = reference.segments[0].steps.slice(eighthSit + 1);
assert.ok(tail.some(step => step.screen.includes('Thou shalt pay, infidel!')),
          'C continues warning at the luck cutoff');
assert.ok(tail.every(step => step.rng.every(call => !call.includes('altar_wrath'))),
          'C consumes no wrath RNG once total luck reaches -5');

console.log('altar wrath state: PASS');
