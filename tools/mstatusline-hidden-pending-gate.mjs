// Inspect the real display queue, hold the next read, then resume unchanged keys.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {test} from 'node:test';
import {NethackGame, runSegment} from '../js/jsmain.js';
import {moveloop_core} from '../js/allmain.js';
import {game} from '../js/gstate.js';
import {GameDisplay} from '../js/game_display.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/mstatusline-hidden.json', import.meta.url)));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs = run => ({screens: run.getScreens(), cursors: run.getCursors(),
    calls: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep()});
const hashes = run => Object.fromEntries(Object.entries(outputs(run)).map(([key, value]) => [key, hash(value)]));

for (const [index, part] of recipe.segments.entries())
test(`${part.name}: status More waits, resumes, and returns to input`, async () => {
    const expected = recipe.jsReach[index];
    const reference = await runSegment({...part, storage: new InMemoryStorage()});
    const referenceHashes = hashes(reference);
    const display = new GameDisplay(null);
    const run = new NethackGame({...part, storage: new InMemoryStorage()});
    run._pendingDisplay = display;
    game.nhDisplay = display;
    const keys = Array.from(part.moves, ch => ch.charCodeAt(0));
    const end = new Error('pending input gate complete');
    let consumed = 0, held = false, settled = false, abort = false;
    let resume, rejectPending, stop, atPause, atEnd;
    const paused = new Promise(resolve => { atPause = resolve; });
    const exhausted = new Promise(resolve => { atEnd = resolve; });
    display.onEmptyQueue = async () => {
        if (abort) throw end;
        if (!held && consumed === expected.selectedStep) {
            held = true;
            return new Promise((resolve, reject) => {
                resume = () => resolve(keys[consumed++]);
                rejectPending = reject;
                atPause('paused');
            });
        }
        if (consumed < keys.length) return keys[consumed++];
        return new Promise((_resolve, reject) => {
            stop = () => reject(end);
            atEnd('input');
        });
    };
    const operation = (async () => {
        try {
            await run.start();
            while (!game.program_state?.gameover) await moveloop_core();
        } catch (error) {
            if (error !== end) throw error;
        } finally {
            settled = true;
        }
    })();
    try {
        assert.equal(await Promise.race([paused, operation.then(() => 'exit')]), 'paused');
        assert.equal(consumed, expected.selectedStep);
        assert.equal(settled, false);
        const pausedHashes = hashes(run);
        const rows = decodeScreen(display.terminal.serialize()).map(row => row.map(renderCell).join(''));
        const text = rows.join(' ').replace(/\s+/g, ' ');
        assert.ok(text.includes('Status of'));
        assert.ok(text.includes(recipe.branchAssertions[index].screenIncludes.at(-1)));
        assert.ok(!text.includes('not carrying anything'));
        const pendingMore = text.includes('--More--');
        assert.equal(pendingMore, true);
        await setImmediate();
        await setImmediate();
        assert.equal(settled, false);
        assert.equal(consumed, expected.selectedStep);
        assert.deepEqual(hashes(run), pausedHashes);
        resume();
        assert.equal(await Promise.race([exhausted, operation.then(() => 'exit')]), 'input');
        assert.equal(consumed, keys.length);
        assert.equal(settled, false);
        assert.deepEqual(hashes(run), referenceHashes);
        await setImmediate(); await setImmediate();
        assert.equal(settled, false);
        assert.equal(consumed, keys.length);
        assert.deepEqual(hashes(run), referenceHashes, 'exhaustion waits without extra RNG or output');
        console.log(JSON.stringify({name: part.name, heldAtBoundary: expected.selectedStep,
            pendingMore, noProgressWithoutInput: true, boundedEndOfInputStable: true,
            resumedAllFiveHashesExact: true, boundaries: run.getScreens().length,
            calls: run.getRngLog().length}));
    } finally {
        abort = true;
        if (rejectPending) rejectPending(end);
        if (stop) stop();
        await operation;
    }
});
