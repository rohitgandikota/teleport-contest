#!/usr/bin/env node
// Source-derived prayer confirmation, repeat-input and blindness contracts
// from pray.c dopray(). Native recordings check the prompt frames separately.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { dopray } from '../js/pray.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { cmdq_add_key } from '../js/cmd.js';
import { PARANOID_PRAY, PARANOID_CONFIRM, CQ_REPEAT, CMDQ_KEY,
         ECMD_OK, ECMD_TIME } from '../js/const.js';

const segment = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/recorder-meta-keys.json', import.meta.url))).segments[0];

async function setup(bits = PARANOID_PRAY, keys = '') {
    const replay = await runSegment({ ...segment, moves: ' ',
        storage: new InMemoryStorage() });
    replay._display.onEmptyQueue = () => 0x1b;
    game.flags.paranoia_bits = bits;
    game.wizard = false;
    game.u.ublesscnt = 0;
    game._toplines = game._pending_message = '';
    game._msg_history = [];
    game._toplin = 0;
    game.command_queue = [];
    resetInputState();
    pushKeys(keys);
}

function messages() {
    return [...game._msg_history, game._toplines].join('\n');
}

test('declining default confirmation preserves atheist conduct', async () => {
    await setup(PARANOID_PRAY, 'n');
    assert.equal(await dopray(), ECMD_OK);
    assert.equal(game.u.uconduct.gnostic, 0);
    assert.ok(!game.u.uinvulnerable);
});

test('disabled confirmation begins prayer without an answer', async () => {
    await setup(0);
    assert.equal(await dopray(), ECMD_TIME);
    assert.equal(game.u.uconduct.gnostic, 1);
    assert.ok(game.u.uinvulnerable);
    assert.equal(game.multi, -3);
});

test('full-word confirmation rejects a lone y and accepts no', async () => {
    await setup(PARANOID_PRAY | PARANOID_CONFIRM, 'y\rno\r');
    assert.equal(await dopray(), ECMD_OK);
    assert.equal(game.u.uconduct.gnostic, 0);
    assert.ok(!game.u.uinvulnerable);
});

test('full-word yes starts prayer without saving confirmation keys', async () => {
    await setup(PARANOID_PRAY | PARANOID_CONFIRM, 'yes\r');
    assert.equal(await dopray(), ECMD_TIME);
    assert.equal(game.u.uconduct.gnostic, 1);
    assert.equal(game.command_queue[CQ_REPEAT], undefined);
});

for (const blind of [false, true]) {
    test(`prayer light respects canonical blindness, blind=${blind}`, async () => {
        await setup(PARANOID_PRAY, 'y');
        game.u.intrinsic.HBlinded = blind ? 20 : 0;
        assert.equal(await dopray(), ECMD_TIME);
        assert.ok(game.u.uinvulnerable);
        assert.equal(messages().includes('surrounded by a shimmering light'),
                     !blind);
    });
}

test('unconfirmed debug prayer saves its force-success answer for repeat', async () => {
    await setup(0, ' y');
    game.wizard = true;
    game.u.ublesscnt = 500;
    assert.equal(await dopray(), ECMD_TIME);
    assert.equal(game.u.ublesscnt, 0);
    assert.deepEqual(game.command_queue[CQ_REPEAT], [{ typ: CMDQ_KEY, key: 'y' }]);
});

test('unconfirmed repeated debug prayer consumes its saved answer', async () => {
    await setup(0);
    game.wizard = true;
    game.u.ublesscnt = 500;
    game.in_doagain = true;
    cmdq_add_key(CQ_REPEAT, 'y');
    assert.equal(await dopray(), ECMD_TIME);
    assert.equal(game.u.ublesscnt, 0);
    assert.deepEqual(game.command_queue[CQ_REPEAT], []);
    assert.equal(game.in_doagain, true);
});

test('confirmed repeated debug prayer asks again and restores repeat state', async () => {
    await setup(PARANOID_PRAY, 'y y');
    game.wizard = true;
    game.u.ublesscnt = 500;
    game.in_doagain = true;
    cmdq_add_key(CQ_REPEAT, 'n');
    assert.equal(await dopray(), ECMD_TIME);
    assert.equal(game.u.ublesscnt, 0);
    assert.deepEqual(game.command_queue[CQ_REPEAT], [{ typ: CMDQ_KEY, key: 'n' }]);
    assert.equal(game.in_doagain, true);
});
