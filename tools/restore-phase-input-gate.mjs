#!/usr/bin/env node
// Native scalar/state assertions supplement the maintained scorer and RNG gate.
// Usage: node tools/restore-phase-input-gate.mjs floor.json first-revert.json held.json air.json
// Paths are caller-provided. No recipe, save bytes or recorded output is changed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { gamestate_decode } from '../js/save.js';
import { ONAMES as N } from '../js/objects_data.js';
import { Is_airlevel } from '../js/const.js';

const paths = process.argv.slice(2);
assert.equal(paths.length, 4, 'supply the floor, first-revert, held-visible and Air native pairs');
const cases = [
    { name: 'floor', boundaries: 45, count: 2779, type: N.WORM_TOOTH,
        calls: ['rn2(10)=5', 'rn2(100)=24', 'rn2(3)=0', 'rn2(2)=1', 'rn2(10)=0'] },
    { name: 'first-revert', boundaries: 45, count: 2779, type: N.CRYSKNIFE,
        calls: ['rn2(10)=0', 'rn2(100)=96', 'rn2(3)=1', 'rn2(2)=1', 'rn2(10)=7'] },
    { name: 'held-visible', boundaries: 41, count: 2768, type: N.CRYSKNIFE,
        calls: ['rn2(100)=25', 'rn2(3)=2', 'rn2(2)=1'] },
    { name: 'air', boundaries: 86, count: 10630 }
];
const calls = values => values.map(value => value.replace(/\s*@.*$/, '').trim());
const hash = value => createHash('sha256').update(value).digest('hex');
const isKnife = obj => obj.otyp === N.CRYSKNIFE || obj.otyp === N.WORM_TOOTH;
for (const [index, path] of paths.entries()) {
    const original = readFileSync(path);
    const fixture = JSON.parse(original);
    assert.equal(fixture.segments.length, 2);
    const expected = cases[index];
    const storage = new InMemoryStorage();
    let boundaries = 0;
    let count = 0;
    let firstSave;
    let firstDecoded;
    for (const [segment, part] of fixture.segments.entries()) {
        const replay = await runSegment({ ...part, storage });
        boundaries += replay.getScreens().length;
        count += replay.getRngLog().length;
        assert.deepEqual(calls(replay.getRngLog()), calls(part.steps.flatMap(step => step.rng || [])));
        if (segment === 0) {
            firstSave = storage.getItem(`save:${game.plname}`);
            assert.ok(firstSave);
            firstDecoded = gamestate_decode(JSON.parse(firstSave));
            if (index < 3) {
                const objects = index === 2 ? firstDecoded.invent : firstDecoded.level.objects;
                const knife = objects.find(isKnife);
                assert.equal(knife.otyp, N.CRYSKNIFE);
                assert.equal(knife.oerodeproof, 1);
                assert.equal(!!knife.unpaid, false);
            } else {
                assert.ok(firstDecoded.level._waterlevel.bubbles.length > 0);
            }
        } else if (index < 3) {
            assert.deepEqual(calls(part.steps[0].rng), expected.calls);
            assert.deepEqual(calls(replay.getRngSlices()[0]), expected.calls);
            const objects = index === 2 ? game.invent : game.level.objects;
            assert.equal(objects.find(isKnife).otyp, expected.type);
            // Each original knife pair answers 'n' to keeping the wizard save.
            assert.equal(storage.getItem(`save:${game.plname}`), null);
            if (index < 2) {
                const temporary = game.saved_levels.get('0:1');
                const originalKnife = firstDecoded.level.objects.find(isKnife);
                const liveKnife = game.level.objects.find(isKnife);
                assert.notEqual(temporary, game.level);
                assert.notEqual(temporary.objects.find(isKnife), liveKnife);
                assert.notEqual(originalKnife, liveKnife);
                assert.equal(originalKnife.otyp, N.CRYSKNIFE);
                assert.equal(originalKnife.oerodeproof, 1);
            }
        } else {
            assert.ok(Is_airlevel(game.u.uz));
            const key = `${game.u.uz.dnum}:${game.u.uz.dlevel}`;
            assert.equal(game.saved_levels.get(key)._waterlevel.bubbles.length,
                firstDecoded.level._waterlevel.bubbles.length);
        }
    }
    assert.equal(boundaries, expected.boundaries);
    assert.equal(count, expected.count);
    assert.equal(hash(readFileSync(path)), hash(original));
    console.log(JSON.stringify({ case: expected.name, originalSha256: hash(original),
        boundaries, calls: count, savedSha256: hash(firstSave), pass: true }));
}
