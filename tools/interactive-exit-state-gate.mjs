#!/usr/bin/env node
// Drive the public interactive API with native quit, save and startup inputs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {NethackGame} from '../js/jsmain.js';
import {moveloop_core} from '../js/allmain.js';
import {game} from '../js/gstate.js';
import {GameDisplay} from '../js/game_display.js';
import {InMemoryStorage} from '../js/storage.js';

const fixture = name => JSON.parse(readFileSync(new URL(name, import.meta.url)));
const recipe = fixture('gen-sessions/recipes/game-exit-boundaries.json');
const native = fixture('gen-sessions/generated/game-exit-boundaries.session.json');

function prepare(segment) {
    const display = new GameDisplay(null);
    const inputError = new Error('interactive input exhausted');
    display.onEmptyQueue = () => { throw inputError; };
    const run = new NethackGame({...segment, storage:new InMemoryStorage()});
    run._pendingDisplay = display;
    game.nhDisplay = display;
    for (const ch of segment.moves)
        display.pushKey(ch.charCodeAt(0));
    return {run, display, inputError};
}

async function finish(index) {
    const state = prepare(recipe.segments[index]);
    await state.run.start();
    for (let turn = 0; turn < 1000 && !game.program_state?.gameover; turn++)
        await moveloop_core();
    assert.equal(game.program_state.gameover, true);
    return state;
}

for (const index of [0, 2, 4]) {
    test(`${recipe.segments[index].name} completes without an escaping exit signal`, async () => {
        const {run, display} = await finish(index);
        // The judge omits the empty native frame after character cancellation.
        const frames = native.segments[index].steps.filter(step => step.screen).length;
        assert.equal(run.getScreens().length, frames);
        if (index === 4)
            assert.equal(display.terminal.serialize(), '');
        const remaining = display.inputQueueLength;
        assert.ok(remaining > 0, 'keys after process exit remain unused');
        await moveloop_core();
        assert.equal(run.getScreens().length, frames);
        assert.equal(display.inputQueueLength, remaining);
    });
}

test('a new game clears the completed interactive state', async () => {
    await finish(0);
    const {run} = prepare(recipe.segments[1]);
    await run.start();
    assert.equal(!!game.program_state.gameover, false);
});

test('ordinary move-loop exceptions still reach the caller', async () => {
    const {run, display, inputError} = prepare(recipe.segments[1]);
    await run.start();
    display.clearInputQueue();
    await assert.rejects(moveloop_core, error => error === inputError);
    assert.equal(!!game.program_state.gameover, false);
});

test('ordinary startup exceptions still reach the caller', async () => {
    const {run, inputError} = prepare({...recipe.segments[4], moves:''});
    await assert.rejects(() => run.start(), error => error === inputError);
});
