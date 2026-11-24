#!/usr/bin/env node
// Ordinary input and read-only owner/damage witnesses. Exact C replay uses the
// existing scorer, RNG-slice, animation-cursor and hang gates separately.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const [recipePath, nativePath] = process.argv.slice(2);
assert.ok(recipePath, 'provide the paired recipe path, then an optional raw native path');
const recipe = JSON.parse(fs.readFileSync(recipePath));
const storage = new InMemoryStorage();
const replayed = { segments: [] };
const observations = [];
for (const [segment, part] of recipe.segments.entries()) {
    const result = await runSegment({ ...part, storage });
    if (segment === 0) {
        const bones = JSON.parse(storage.getItem('bones:0.2'));
        assert.equal(bones.monsters.filter(mon => mon.isshk).length, 1);
    } else {
        assert.ok(game.level.bonesinfo);
        const shop = game.level.monsters.find(mon => mon.isshk);
        assert.deepEqual(shop.eshk.shd, { x: 6, y: 9 });
        assert.equal(game.level.doors.includes(shop.eshk.shd), false);
        assert.ok(game.level.doors.some(door => door.x === 6 && door.y === 9));
        const damage = game.level.damagelist;
        assert.equal(damage.find(entry => entry.x === 6 && entry.y === 9)?.cost, 400);
        assert.equal(damage.find(entry => entry.x === 2 && entry.y === 9)?.cost, 200);
        assert.equal(damage.reduce((sum, entry) => sum + entry.cost, 0), 600);
    }
    observations.push({ segment, boundaries: result.getScreens().length,
        calls: result.getRngLog().length,
        animations: result.getAnimationFramesByStep().reduce((sum, frames) => sum + frames.length, 0) });
    replayed.segments.push({ ...part, steps: result.getScreens().map((screen, step) => ({
        screen, cursor: result.getCursors()[step], rng: result.getRngSlices()[step],
        animation_frames: result.getAnimationFramesByStep()[step]
    })) });
}
assert.equal(observations.length, 2);
assert.deepEqual(branchAssertionErrors(recipe, replayed), []);
let nativeSha256 = null;
if (nativePath) {
    const bytes = fs.readFileSync(nativePath);
    const native = JSON.parse(bytes);
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(native.segments.length, recipe.segments.length);
    for (const [index, part] of recipe.segments.entries()) {
        for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(native.segments[index][key], part[key], `${index}.${key}`);
    }
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    nativeSha256 = createHash('sha256').update(bytes).digest('hex');
}
console.log(JSON.stringify({ evidence: nativePath
    ? 'normal JS owner/damage witnesses and independent C recipe assertions'
    : 'normal JS owner/damage witnesses only; native pending',
    observations, assertions: recipe.branchAssertions.length, nativeSha256 }, null, 4));
