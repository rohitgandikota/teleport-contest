#!/usr/bin/env node
// Ordinary-input observations only. No module overrides or game-state writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { getRngLog } from '../js/rng.js';
import { inside_region, visible_region_at } from '../js/region.js';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const recipePath = process.argv[2] || new URL(
    './gen-sessions/recipes/flip-gas-region-location.json', import.meta.url);
const nativePath = process.argv[3];
const recipe = JSON.parse(fs.readFileSync(recipePath));
assert.equal(recipe.segments.length, 2);
const results = [];
const failures = [];
const replay = { segments: [] };

function output(run) {
    return structuredClone({
        screens: run.getScreens(), cursors: run.getCursors(), rng: run.getRngLog(),
        slices: run.getRngSlices(), animations: run.getAnimationFramesByStep(),
    });
}

for (const [segment, part] of recipe.segments.entries()) {
    const states = [];
    const oldHook = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let observed;
    try {
        globalThis.__step_snapshot = {
            step: '*',
            cb(game, step) {
                const reg = game.regions?.[0];
                states[step] = structuredClone({
                    step, moves: game.moves, calls: getRngLog().length,
                    hero: [game.u.ux, game.u.uy], regions: game.regions || [],
                    heroInGeometry: !!reg && inside_region(reg, game.u.ux, game.u.uy),
                    visibleOnHero: !!reg && visible_region_at(game.u.ux, game.u.uy) === reg,
                });
            },
        };
        observed = output(await runSegment({ ...part, storage: new InMemoryStorage() }));
    } finally {
        if (oldHook) Object.defineProperty(globalThis, '__step_snapshot', oldHook);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), oldHook);
    const unobserved = output(await runSegment({ ...part, storage: new InMemoryStorage() }));
    assert.deepEqual(observed, unobserved, 'read-only observer preserves complete output');
    const afterStep = segment === 0 ? 101 : 95;
    const goneStep = segment === 0 ? 124 : 107;
    try {
        const setup = states[84];
        const after = states[afterStep];
        assert.equal(setup.regions.length, 1);
        assert.deepEqual(setup.regions[0].bounding_box, { lx: 28, ly: 5, hx: 33, hy: 9 });
        assert.equal(setup.regions[0].nrects, 15);
        assert.equal(setup.regions[0].ttl, 2);
        assert.equal(setup.regions[0].arg, 8);
        assert.equal(after.moves, setup.moves, 'explicit flip/control spends no turn');
        assert.equal(after.calls, setup.calls, 'explicit flip/control spends no RNG');
        assert.deepEqual(after.hero, segment === 0 ? [46, 7] : [30, 7]);
        const expected = structuredClone(setup.regions);
        if (segment === 0) {
            expected[0].bounding_box = { lx: 43, ly: 5, hx: 48, hy: 9 };
            for (const rect of expected[0].rects) {
                // These ordinary clouds contain single-cell rectangles.
                assert.equal(rect.lx, rect.hx);
                rect.lx = rect.hx = 76 - rect.lx;
            }
        }
        assert.deepEqual(after.regions, expected, 'only reflected geometry changes');
        assert.equal(after.heroInGeometry, true);
        assert.equal(after.visibleOnHero, true);
        assert.equal(states[goneStep].moves, 10);
        assert.deepEqual(states[goneStep].regions, [], 'real expiry removes the region');
    } catch (error) {
        failures.push({ segment, error: error.message });
    }
    replay.segments.push({ ...part, steps: observed.screens.map((screen, step) => ({
        screen, cursor: observed.cursors[step], rng: observed.slices[step],
        animation_frames: observed.animations[step],
    })) });
    results.push({
        segment, name: part.name, hookNeutral: true,
        boundaries: observed.screens.length, calls: observed.rng.length,
        animations: observed.animations.reduce((n, frames) => n + frames.length, 0),
        outputSha256: createHash('sha256').update(JSON.stringify(observed)).digest('hex'),
        observations: [84, afterStep, goneStep].map(step => states[step]),
    });
}
failures.push(...branchAssertionErrors(recipe, replay));
let nativeSha256 = null;
if (nativePath) {
    const bytes = fs.readFileSync(nativePath);
    const native = JSON.parse(bytes);
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(native.segments.length, recipe.segments.length);
    for (const [index, part] of recipe.segments.entries()) {
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
            assert.deepEqual(native.segments[index][field], part[field], `${index}.${field}`);
        }
        assert.equal(native.segments[index].steps.length, part.moves.length + 1);
    }
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    nativeSha256 = createHash('sha256').update(bytes).digest('hex');
}
console.log(JSON.stringify({
    evidence: nativePath
        ? 'normal JS observations and independent native recipe assertions; exact replay is separate'
        : 'normal JS observations; no native oracle supplied to this invocation',
    passed: recipe.segments.length - new Set(failures.filter(item => item.segment !== undefined)
        .map(item => item.segment)).size,
    results, failures, nativeSha256,
}, null, 4));
process.exitCode = failures.length ? 1 : 0;
