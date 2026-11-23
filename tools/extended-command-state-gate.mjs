#!/usr/bin/env node
// C cmd.c doextcmd applies the same availability guard as direct keys.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { rhack } from '../js/cmd.js';
import { nh_callback } from '../js/nhlua.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/platform-command-messages.json', import.meta.url)));

async function start() {
    await runSegment({ ...recipe.segments[0], moves: ' \x1b',
        storage: new InMemoryStorage() });
    game.opt_need_redraw = game.opt_need_glyph_reset = game.opt_symset_changed = false;
}

async function press(keys) {
    let extraReads = 0;
    game.nhDisplay.onEmptyQueue = () => { extraReads++; return 27; };
    for (const key of keys)
        game.nhDisplay.pushKey(key.charCodeAt(0));
    await rhack(0);
    assert.equal(extraReads, 0, 'a refused command must not ask its own questions');
    assert.equal(game.context.move, 0);
}

for (const named of [false, true]) {
    const form = named ? 'named' : 'direct';
    test(`${form} kick is refused while buried`, async () => {
        await start();
        game.u.uburied = true;
        await press(named ? '#kick\r' : '\x04');
        assert.equal(game._pending_message, "You can't do that while you are buried!");
    });

    test(`${form} save honors the tutorial callback`, async () => {
        await start();
        nh_callback('cmd_before', 'tutorial_cmd_before');
        await press(named ? '#save\r' : 'S');
        assert.equal(game.storage.length, 0);
    });

    test(`${form} quit is excluded during fuzzing`, async () => {
        await start();
        game.iflags.debug_fuzzer = true;
        await press(named ? '#quit\r' : '\xf1');
    });
}
