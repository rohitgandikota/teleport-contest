// Actual config and keyboard producers. Observe, then independently replay without the hook.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/msg-window-option.json', import.meta.url)));
const expected = ['f', 'r', 'c', 's', 's', 's'];
const outputs = run => ({screens: run.getScreens(), cursors: run.getCursors(),
    rng: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep()});
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
for (const [index, part] of recipe.segments.entries()) test(part.name, async () => {
    const rows = [], previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            rows.push({step, mode: g.iflags.prevmsg_window,
                flagsHasMode: Object.hasOwn(g.flags, 'msg_window'),
                errors: [...g.rc.errors], configured: !!g.rc.optSetInConfig?.msg_window,
                inread: g.ttyDisplay?.inread || 0});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    const observed = structuredClone(outputs(run));
    const plain = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
    for (const key of Object.keys(observed))
        assert.deepEqual(observed[key], plain[key], key + ' observer neutrality');
    assert.equal(rows.length, part.moves.length + 1);
    assert.equal(observed.screens.length, rows.length);
    assert.equal(run._display.inputQueueLength, 0);
    assert.ok(rows.every(row => row.mode === expected[index] && !row.flagsHasMode));
    assert.ok(rows.every(row => row.errors.length === 0));
    assert.equal(rows[0].configured, index !== 4);
    assert.equal(rows.at(-1).inread, 0);
    const texts = observed.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('')).join('\n'));
    for (const phrase of recipe.branchAssertions[index].screenIncludes)
        assert.ok(texts.some(text => text.includes(phrase)), phrase);
    assert.ok(texts.some(text => text.includes('Set what options?')));
    assert.equal(observed.frames.flat().length, 0);
    console.log(JSON.stringify({case: index, name: part.name, mode: expected[index],
        boundaries: rows.length, calls: observed.rng.length, frames: 0, observerNeutral: true,
        hashes: Object.fromEntries(Object.entries(observed).map(([key,value]) => [key,hash(value)]))}));
});
