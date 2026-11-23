#!/usr/bin/env node
// C cmd.c rhack(): queue precedence, result cleanup and command identity.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { cmdq_add_ec, cmdq_add_int, cmdq_peek, rhack } from '../js/cmd.js';
import { ddoinv } from '../js/invent.js';
import { CQ_CANNED, CQ_REPEAT } from '../js/const.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/command-result-flags.json', import.meta.url)));
async function start() {
    const replay = await runSegment({ ...recipe.segments[0], moves: ' \x1b',
        storage: new InMemoryStorage() });
    replay._display.onEmptyQueue = () => 27;
    game.opt_need_redraw = game.opt_need_glyph_reset = game.opt_symset_changed = false;
}
async function press(keys) {
    for (const key of keys)
        game.nhDisplay.pushKey(key.charCodeAt(0));
    await rhack(0);
}

test('a queued command takes precedence over a supplied command key', async () => {
    await start();
    cmdq_add_ec(CQ_CANNED, ddoinv);
    await rhack('V'.charCodeAt(0));
    assert.equal(game._pending_message, 'Not carrying anything.');
    assert.equal(cmdq_peek(CQ_CANNED), null);
    assert.equal(cmdq_peek(CQ_REPEAT)?.ec_entry.ef_txt, 'inventory');
});

test('unexpected queued input discards a supplied key and clears both queues', async () => {
    await start();
    let reads = 0;
    game.nhDisplay.onEmptyQueue = () => { reads++; return 27; };
    cmdq_add_int(CQ_CANNED, 3);
    await rhack('V'.charCodeAt(0));
    assert.equal(reads, 0);
    assert.equal(cmdq_peek(CQ_CANNED), null);
    assert.equal(cmdq_peek(CQ_REPEAT), null);
    assert.equal(game.context.move, 0);
});

test('escape suppresses the next sanity check when checking is enabled', async () => {
    await start();
    game.iflags.sanity_check = true;
    game.iflags.sanity_no_check = false;
    await rhack(27);
    assert.equal(game.iflags.sanity_no_check, true);
});

test('a direct kick retains its location for pet movement', async () => {
    await start();
    const target = { x: game.u.ux - 1, y: game.u.uy };
    await press('\x04h');
    assert.equal(game.context.move, 1);
    assert.deepEqual(game.kickedloc, target);
});

test('a named kick clears its location because the initiating function is doextcmd', async () => {
    await start();
    await press('#kick\rh');
    assert.equal(game.context.move, 1);
    assert.deepEqual(game.kickedloc, { x: 0, y: 0 });
});
