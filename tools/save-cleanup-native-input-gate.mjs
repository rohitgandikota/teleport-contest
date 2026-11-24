#!/usr/bin/env node
// Two unchanged C recordings, their recipe assertions, and read-only JS owners.
// Screen/RNG/animation parity remains the responsibility of the existing gates.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { gamestate_decode } from '../js/save.js';
import { ONAMES as N } from '../js/objects_data.js';
import { OBJ_FLOOR } from '../js/const.js';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const root = new URL('./gen-sessions/', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const tuple = ({ name, seed, datetime, nethackrc, moves }) =>
    ({ name, seed, datetime, nethackrc, moves });
const cases = [
    {
        name: 'swallowed-punishment-detection',
        sha256: 'b5e07bba39a21e4a24a931cca8403780fddc6bf16183df930687c4e9a183c277',
        purpose: 'retained qb rejection after the potion receives slot a'
    },
    {
        name: 'save-swallowed-punishment-native-slot-a',
        sha256: 'ea9c8812db11222f0d1c909a03dfe93f92ad3954d5bc806cee765201536cf898',
        purpose: 'qa drinks the potion and detection displays the local chain'
    }
];

const results = [];
for (const item of cases) {
    const path = new URL(`generated/${item.name}.session.json`, root);
    const bytes = readFileSync(path);
    const native = JSON.parse(bytes);
    const recipe = JSON.parse(readFileSync(new URL(`recipes/${item.name}.json`, root)));
    assert.equal(hash(bytes), item.sha256);
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(native.name, item.name);
    assert.equal(recipe.name, item.name);
    assert.deepEqual(native.segments.map(tuple), recipe.segments.map(tuple));
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);

    const storage = new InMemoryStorage();
    const observations = [];
    const replayed = { source: 'js-observation', segments: [] };
    for (const [segment, part] of native.segments.entries()) {
        const replay = await runSegment({ ...part, storage });
        const screens = replay.getScreens();
        replayed.segments.push({ steps: screens.map(screen => ({ screen })) });
        const raw = storage.getItem(`save:${game.plname}`);
        if (segment === 0)
            assert.ok(raw, 'ordinary input completed a real save');
        const record = segment === 0 ? gamestate_decode(JSON.parse(raw)) : game;
        assert.equal(record.u.uswallow, 1);
        const attachments = [N.HEAVY_IRON_BALL, N.IRON_CHAIN].map(type =>
            record.level.objects.filter(obj => obj.otyp === type));
        for (const objects of attachments) {
            assert.equal(objects.length, 1, 'one canonical local owner for each attachment');
            assert.equal(objects[0].where, OBJ_FLOOR);
        }
        const [ball, chain] = attachments.map(objects => objects[0]);
        if (segment === 1) {
            assert.equal(record.u.uball, ball);
            assert.equal(record.u.uchain, chain);
            assert.equal(ball.o_id, observations[0].ballId);
            assert.equal(chain.o_id, observations[0].chainId);
        }
        observations.push({ segment, boundaries: screens.length,
            calls: replay.getRngLog().length, ballId: ball.o_id, chainId: chain.o_id });
    }
    assert.deepEqual(branchAssertionErrors(recipe, replayed), []);
    assert.equal(hash(readFileSync(path)), item.sha256, 'native bytes remain unchanged');
    results.push({ ...item, nativeAssertions: recipe.branches.length,
        jsAssertions: recipe.branches.length, observations });
}
console.log(JSON.stringify({
    evidence: 'native screen assertions plus ordinary-input read-only JS ownership',
    passed: results.length, results
}, null, 4));
