#!/usr/bin/env node
// Source-derived cmd.c rhack/do_repeat checks. Native recordings separately
// verify visible output, turn timing and RNG for configured key bindings.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { bind_key, cmdq_add_ec, cmdq_add_int, cmdq_peek, do_reqmenu,
    ext_func_tab_from_func, rhack } from '../js/cmd.js';
import { CQ_CANNED, CQ_REPEAT } from '../js/const.js';
import { ddoinv } from '../js/invent.js';
import { doopen } from '../js/lock.js';
import { dochat } from '../js/sounds.js';
import { wiz_identify } from '../js/wizcmds.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/binding-command-execution.json', import.meta.url)));

async function start() {
    const replay = await runSegment({ ...recipe.segments[0], moves: ' \x1b',
        storage: new InMemoryStorage() });
    replay._display.onEmptyQueue = () => 27;
    game.opt_need_redraw = game.opt_need_glyph_reset = game.opt_symset_changed = false;
}

async function press(key) {
    game.nhDisplay.pushKey(key.charCodeAt(0));
    await rhack(0);
}

test('repeat survives removal of the original key and its default key', async () => {
    await start();
    await press('~');
    bind_key(126, 'nothing');
    await press('\x01');
    assert.match(game._pending_message, /NetHack Version/);
    await press('\x01');
    assert.match(game._pending_message, /NetHack Version/);
});

test('repeat survives replacing both keys with a different command', async () => {
    await start();
    await press('~');
    bind_key(126, 'inventory');
    bind_key(86, 'inventory');
    await press('\x01');
    assert.match(game._pending_message, /NetHack Version/);
});

test('a repeated parameter command sees the repeat binding, not its old parameter', async () => {
    await start();
    bind_key(126, 'toggle(autopickup)');
    await press('~');
    assert.equal(game.flags.autopickup, true);
    await press('\x01');
    assert.equal(game.flags.autopickup, true);
    assert.equal(game._pending_message, 'Use #optionsfull to set any option instead.');
});

test('movement repeats its saved direction after the triggering key is rebound', async () => {
    await start();
    bind_key(126, 'moveeast');
    const x = game.u.ux;
    await press('~');
    assert.equal(game.u.ux, x + 1);
    bind_key(126, 'inventory');
    await press('\x01');
    assert.equal(game.u.ux, x + 2);
});

test('queued wizard commands use the same availability check as typed commands', async () => {
    await start();
    game.wizard = false;
    cmdq_add_ec(CQ_CANNED, wiz_identify);
    await rhack(0);
    assert.equal(game._pending_message, "Unavailable command 'wizidentify'.");
    assert.equal(cmdq_peek(CQ_CANNED), null);
    assert.equal(cmdq_peek(CQ_REPEAT), null);
});

test('queued commands respect the buried command guard', async () => {
    await start();
    game.u.uburied = true;
    cmdq_add_ec(CQ_CANNED, doopen);
    await rhack(0);
    assert.equal(game._pending_message, "You can't do that while you are buried!");
    assert.equal(cmdq_peek(CQ_REPEAT), null);
});

test('queued prefixes validate the following queued command', async () => {
    await start();
    cmdq_add_ec(CQ_CANNED, do_reqmenu);
    cmdq_add_ec(CQ_CANNED, ddoinv);
    await rhack(0);
    await rhack(0);
    assert.equal(game.nhDisplay.terminal.serialize().split('\n')[0],
        "The inventory command does not accept 'm' prefix.");
    assert.equal(game._cmd_prefix_pending, false);
    assert.equal(cmdq_peek(CQ_REPEAT), null);
});

test('an unexpected queued input type clears the queue without reading a key', async () => {
    await start();
    let reads = 0;
    game.nhDisplay.onEmptyQueue = () => { reads++; return 27; };
    cmdq_add_int(CQ_CANNED, 3);
    await rhack(0);
    assert.equal(reads, 0);
    assert.equal(cmdq_peek(CQ_CANNED), null);
    assert.equal(game.context.move, 0);
});

test('the JavaScript chat handler resolves C dotalk command identity', () => {
    assert.equal(ext_func_tab_from_func(dochat)?.ef_txt, 'chat');
});
