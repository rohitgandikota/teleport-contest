#!/usr/bin/env node
// Real input plus read-only state. Exact native replay uses the maintained
// scorer, RNG-slice, animation-cursor and hang gates separately.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { MOAT } from '../js/const.js';
import { MELT_ICE_AWAY } from '../js/timeout.js';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const [recipePath, nativePath] = process.argv.slice(2);
assert.ok(recipePath, 'provide the paired recipe, then an optional raw native recording');
const recipe = JSON.parse(fs.readFileSync(recipePath));
assert.equal(recipe.segments.length, 2);
const storage = new InMemoryStorage();
const replayed = { segments: [] };
const observations = [];
const failures = [];
const streams = [];
for (const [segment, part] of recipe.segments.entries()) {
    const result = await runSegment({ ...part, storage });
    try {
        assert.deepEqual({ x: game.u.ux, y: game.u.uy },
            segment === 0 ? { x: 46, y: 7 } : { x: 30, y: 7 });
        assert.equal(game.moves, 337);
        // C objnam.c:3670, ice created over the starting stairs melts to MOAT.
        assert.equal(game.level.at(game.u.ux, game.u.uy).typ, MOAT);
        assert.equal(game.timer_base.some(timer => timer.func_index === MELT_ICE_AWAY), false);
    } catch (error) {
        failures.push({ segment, message: error.message });
    }
    streams.push(result.getRngLog());
    observations.push({ segment, boundaries: result.getScreens().length,
        calls: result.getRngLog().length,
        animations: result.getAnimationFramesByStep().reduce((sum, frames) => sum + frames.length, 0),
        moves: game.moves, hero: { x: game.u.ux, y: game.u.uy },
        terrain: game.level.at(game.u.ux, game.u.uy).typ });
    replayed.segments.push({ ...part, steps: result.getScreens().map((screen, step) => ({
        screen, cursor: result.getCursors()[step], rng: result.getRngSlices()[step],
        animation_frames: result.getAnimationFramesByStep()[step]
    })) });
}
assert.deepEqual(streams[0], streams[1], 'explicit flip and terrain descriptions consume no RNG');
failures.push(...branchAssertionErrors(recipe, replayed));
let nativeSha256 = null;
if (nativePath) {
    const bytes = fs.readFileSync(nativePath);
    const native = JSON.parse(bytes);
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(native.segments.length, recipe.segments.length);
    for (const [segment, part] of recipe.segments.entries()) {
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(native.segments[segment][field], part[field], `${segment}.${field}`);
        assert.ok(native.segments[segment].steps.length > 0, 'native output must be populated');
    }
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    nativeSha256 = createHash('sha256').update(bytes).digest('hex');
}
console.log(JSON.stringify({ evidence: nativePath
    ? 'normal JS state and independent C recipe assertions; exact replay is separate'
    : 'normal JS state only; independent native recording pending',
    observations, assertions: recipe.branchAssertions.length, failures, nativeSha256 }, null, 4));
if (failures.length)
    process.exitCode = 1;
