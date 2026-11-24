// Compare delayed input through the interactive API with ordinary replay.
// Run native scoring and RNG/frame checks separately for the same fixtures.
// Usage: node tools/deferred-input-gate.mjs session.session.json [...]
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setImmediate} from 'node:timers/promises';
import {NethackGame, runSegment} from '../js/jsmain.js';
import {moveloop_core} from '../js/allmain.js';
import {game} from '../js/gstate.js';
import {GameDisplay} from '../js/game_display.js';
import {InMemoryStorage} from '../js/storage.js';
import {normalizeSession} from '../frozen/session_loader.mjs';

function outputs(run) {
    return {
        screens: run.getScreens(),
        cursors: run.getCursors(),
        rng: run.getRngLog(),
        rngSlices: run.getRngSlices(),
        animations: run.getAnimationFramesByStep(),
    };
}

async function deferredSegment(segment, storage) {
    const display = new GameDisplay(null);
    const run = new NethackGame({...segment, storage});
    run._pendingDisplay = display;
    game.nhDisplay = display;
    const keys = Array.from(segment.moves, ch => ch.charCodeAt(0));
    let consumed = 0, stop, atEnd;
    const exhausted = new Promise(resolve => { atEnd = resolve; });
    const end = new Error('deferred input complete');
    display.onEmptyQueue = async () => {
        // Leave the real command suspended while the next key is unavailable.
        await setImmediate();
        if (consumed < keys.length)
            return keys[consumed++];
        return new Promise((_resolve, reject) => {
            stop = () => reject(end);
            atEnd('input');
        });
    };
    const operation = (async () => {
        try {
            await run.start();
            while (!game.program_state?.gameover)
                await moveloop_core();
        } catch (error) {
            if (error !== end) throw error;
        }
    })();
    try {
        await Promise.race([exhausted, operation.then(() => 'exit')]);
        // Capture before releasing the final pending read with the test sentinel.
        return {output: structuredClone(outputs(run)), consumed};
    } finally {
        if (stop) stop();
        await operation;
    }
}

const paths = process.argv.slice(2);
assert.ok(paths.length, 'provide at least one session fixture');
for (const path of paths) {
    const parts = normalizeSession(JSON.parse(readFileSync(path))).segments;
    const immediateStorage = new InMemoryStorage();
    const deferredStorage = new InMemoryStorage();
    let boundaries = 0, calls = 0, frames = 0;
    for (const [index, part] of parts.entries()) {
        const reference = await runSegment({...part, storage: immediateStorage});
        const immediate = structuredClone(outputs(reference));
        const expectedConsumed = Array.from(part.moves).length
            - reference._display.inputQueueLength;
        const {output, consumed} = await deferredSegment(part, deferredStorage);
        assert.equal(consumed, expectedConsumed, `${path} segment ${index} input count`);
        for (const key of Object.keys(immediate)) {
            const label = `${path} segment ${index} ${key}`;
            assert.equal(output[key].length, immediate[key].length, label);
            for (let step = 0; step < immediate[key].length; step++)
                assert.deepEqual(output[key][step], immediate[key][step], `${label} ${step}`);
        }
        boundaries += output.screens.length;
        calls += output.rng.length;
        frames += output.animations.reduce((sum, slice) => sum + slice.length, 0);
    }
    console.log(JSON.stringify({path, segments: parts.length, boundaries, calls, frames,
        deferredEqualsImmediate: true}));
}
