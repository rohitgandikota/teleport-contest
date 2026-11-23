#!/usr/bin/env node
// C pray.c:1363 increases prayer timeout after 100,000 turns and caps it
// at LARGEST_INT. Exercise the boundaries without simulating long games.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { dopray } from '../js/pray.js';
import { initRng } from '../js/rng.js';
import { LARGEST_INT } from '../js/const.js';

const segment = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/recorder-meta-keys.json', import.meta.url))).segments[0];

async function prayAt(moves, demigod = false, crowned = false) {
    const replay = await runSegment({ ...segment, moves: ' ',
        storage: new InMemoryStorage() });
    replay._display.onEmptyQueue = () => 0x1b;
    game.flags.paranoia_bits = 0;
    game.wizard = false;
    game.u.ublesscnt = 0;
    game.u.uevent ||= {};
    game.u.uevent.udemigod = demigod;
    game.u.uevent.uhand_of_elbereth = crowned ? 1 : 0;
    game.moves = moves;
    await dopray();
    initRng(1);
    await game.afternmv();
    return game.u.ublesscnt;
}

test('late prayer timeout starts with the first complete hundred turns', async () => {
    const base = await prayAt(100000);
    assert.ok(base > 0);
    assert.equal(await prayAt(99999), base);
    assert.equal(await prayAt(100099), base);
    assert.equal(await prayAt(100100), base + 1);
    assert.equal(await prayAt(100500), base + 5);
});

test('very late prayer timeout saturates instead of growing without bound', async () => {
    assert.equal(await prayAt(100000000), LARGEST_INT);
    assert.equal(await prayAt(1000000000), LARGEST_INT);
});

for (const [demigod, crowned] of [[true, false], [false, true], [true, true]]) {
    test(`late timeout includes divine rank penalties, demigod=${demigod}, crowned=${crowned}`, async () => {
        const base = await prayAt(100000, demigod, crowned);
        assert.equal(await prayAt(100100, demigod, crowned), base + 1);
        assert.equal(await prayAt(100000000, demigod, crowned), LARGEST_INT);
    });
}
