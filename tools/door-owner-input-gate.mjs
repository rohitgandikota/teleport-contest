#!/usr/bin/env node
// Ordinary inputs and read-only owner checks. An optional raw C fixture adds
// independent screen assertions; existing scorer/RNG/animation gates do parity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { DOOR, D_TRAPPED } from '../js/const.js';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const [recipePath, nativePath] = process.argv.slice(2);
if (!recipePath) {
    console.error('Usage: node tools/door-owner-input-gate.mjs <recipe.json> [native.session.json]');
    process.exit(2);
}
const recipe = JSON.parse(fs.readFileSync(recipePath));
assert.deepEqual(branchAssertionErrors(recipe), []);
const storage = new InMemoryStorage();
const replayed = { segments: [] };
const observations = [];
let savedDoor;
let savedBytes;

for (const [segment, part] of recipe.segments.entries()) {
    const result = await runSegment({ ...part, storage });
    const level = game.level;
    const lastRoom = level.rooms[level.nroom - 1];
    const endpoint = lastRoom ? lastRoom.fdoor + lastRoom.doorct : 0;
    if (segment === 0) {
        savedBytes = storage.getItem('bones:0.6');
        assert.ok(savedBytes, 'ordinary petrification left bones');
        const saved = JSON.parse(savedBytes);
        assert.equal(Object.hasOwn(saved, 'doorindex'), false);
        savedDoor = saved.doors.find(({ x, y }) => saved.cells[x][y].typ === DOOR
            && (saved.cells[x][y].doormask & D_TRAPPED));
        assert.deepEqual(savedDoor, { x: 36, y: 12 });
    } else {
        assert.ok(level.bonesinfo, 'ordinary level entry loaded bones');
        assert.equal(level.doorindex, endpoint);
        assert.equal(level.doorindex, 24);
        assert.ok(level.doors.slice(0, level.doorindex)
            .some(({ x, y }) => x === savedDoor.x && y === savedDoor.y));
        assert.ok(level.at(savedDoor.x, savedDoor.y).doormask & D_TRAPPED);
        assert.equal(storage.getItem('bones:0.6'), savedBytes,
            'answering no to Unlink bones retains the original bytes');
    }
    observations.push({ segment, boundaries: result.getScreens().length,
        calls: result.getRngLog().length, doorindex: level.doorindex, endpoint });
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
    ? 'JS owner observations and native recipe witnesses; parity checked separately'
    : 'JS ordinary-input reach only, native pending',
    segments: observations.length, assertions: recipe.branchAssertions.length,
    observations, nativeSha256 }, null, 4));
