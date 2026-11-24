#!/usr/bin/env node
// Ordinary input with the existing read-only boundary observer. No loader,
// private exports, function replacements or game-state writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { getRngLog } from '../js/rng.js';
import { couldsee } from '../js/vision.js';
import { gettrack } from '../js/track.js';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const [recipePath, nativePath] = process.argv.slice(2);
assert.ok(recipePath, 'provide the paired recipe, then optional independent native output');
const recipe = JSON.parse(fs.readFileSync(recipePath));
assert.equal(recipe.segments.length, 2);

function output(run) {
    return structuredClone({
        screens: run.getScreens(), cursors: run.getCursors(), rng: run.getRngLog(),
        slices: run.getRngSlices(), animations: run.getAnimationFramesByStep()
    });
}

async function observe(part) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let result;
    try {
        globalThis.__step_snapshot = {
            step: '*',
            cb(game, step) {
                const pet = game.level?.monsters.find(mon => mon.mtame);
                if (!pet) return;
                states[step] = structuredClone({
                    step, moves: game.moves, hero: { x: game.u.ux, y: game.u.uy },
                    pet: { x: pet.mx, y: pet.my, type: pet.mnum },
                    ogoal: pet.edog.ogoal, mgoal: pet.mgoal,
                    petTrack: pet.mtrack, heroTrack: game.utrack,
                    masterVisible: couldsee(pet.mx, pet.my),
                    nearbyTrack: gettrack(pet.mx, pet.my), calls: getRngLog().length
                });
            }
        };
        result = output(await runSegment({ ...part, storage: new InMemoryStorage() }));
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const unobserved = output(await runSegment({ ...part, storage: new InMemoryStorage() }));
    assert.deepEqual(result, unobserved, 'read-only observation leaves every output unchanged');
    return { states, result };
}

const failures = [];
const observations = [];
const replayed = { segments: [] };
for (const [segment, part] of recipe.segments.entries()) {
    const { states, result } = await observe(part);
    try {
        const setup = states[82];
        assert.deepEqual(setup.pet, { x: 25, y: 8, type: 32 });
        assert.deepEqual(setup.ogoal, { x: 24, y: 5 });
        assert.equal(setup.masterVisible, false);
        assert.equal(setup.nearbyTrack, null);
        assert.equal(setup.moves, 18);
        if (segment === 0) {
            const flipped = states[97];
            assert.deepEqual(flipped.pet, { x: 51, y: 8, type: 32 });
            assert.deepEqual(flipped.hero, { x: 66, y: 3 });
            assert.deepEqual(flipped.ogoal, setup.ogoal);
            assert.deepEqual(flipped.petTrack, setup.petTrack);
            assert.deepEqual(flipped.heroTrack, setup.heroTrack);
            assert.equal(flipped.calls, setup.calls, 'explicit flip consumes no RNG');
            assert.equal(flipped.moves, setup.moves, 'explicit flip consumes no turn');
            assert.deepEqual(states[103].pet, { x: 50, y: 8, type: 32 });
        } else {
            assert.deepEqual(states[88].pet, { x: 26, y: 8, type: 32 });
        }
    } catch (error) {
        failures.push({ segment, error: error.message });
    }
    observations.push({
        segment, boundaries: result.screens.length, calls: result.rng.length,
        animations: result.animations.reduce((sum, frames) => sum + frames.length, 0),
        hookNeutral: true,
        states: (segment === 0 ? [82, 97, 100, 103] : [82, 85, 88]).map(step => {
            const { petTrack, heroTrack, ...state } = states[step];
            return state;
        })
    });
    replayed.segments.push({ ...part, steps: result.screens.map((screen, step) => ({
        screen, cursor: result.cursors[step], rng: result.slices[step],
        animation_frames: result.animations[step]
    })) });
}
failures.push(...branchAssertionErrors(recipe, replayed));
let nativeSha256 = null;
if (nativePath) {
    const bytes = fs.readFileSync(nativePath);
    const native = JSON.parse(bytes);
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(native.segments.length, recipe.segments.length);
    for (const [index, part] of recipe.segments.entries()) {
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(native.segments[index][field], part[field], `${index}.${field}`);
        assert.ok(native.segments[index].steps.length, 'independent native output must be populated');
    }
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    nativeSha256 = createHash('sha256').update(bytes).digest('hex');
}
console.log(JSON.stringify({ evidence: nativePath
    ? 'normal JS state and independent native recipe assertions; exact replay is separate'
    : 'normal JS state; recipe C witnesses remain predictions until native recording',
    observations, assertions: recipe.branchAssertions.length, failures, nativeSha256 }, null, 4));
if (failures.length)
    process.exitCode = 1;
