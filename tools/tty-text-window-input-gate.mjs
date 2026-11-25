// Ordinary input only. The existing snapshot hook observes live windows without changing them.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {tty_get_nhwindow} from '../js/tty/wintty.js';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs = run => ({screens: run.getScreens(), cursors: run.getCursors(),
    calls: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep()});
const paths = process.argv.slice(2);
assert.ok(paths.length, 'provide the unchanged history, followthrough or option fixture');
for (const path of paths) {
    const raw = JSON.parse(readFileSync(path));
    assert.equal(raw.source, 'c');
    assert.equal(raw.version, 5);
    const observedStorage = new InMemoryStorage(), plainStorage = new InMemoryStorage();
    for (const [index, part] of raw.segments.entries()) {
        const states = [], previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        let observed;
        try {
            globalThis.__step_snapshot = {step: '*', cb(g, step) {
                const cw = tty_get_nhwindow(g.ttyDisplay?.lastwin);
                states.push({step, mode: g.iflags.prevmsg_window,
                    inread: g.ttyDisplay?.inread || 0, logical: g._toplines,
                    history: !!cw?.active && cw.data[0] === 'Message History',
                    visible: g.nhDisplay.grid.map(row => row.map(c => c.ch).join('')).join('\n')});
            }};
            observed = await runSegment({...part, storage: observedStorage});
        } finally {
            if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
        const first = structuredClone(outputs(observed));
        const plain = await runSegment({...part, storage: plainStorage});
        const second = outputs(plain);
        for (const key of Object.keys(first)) assert.deepEqual(first[key], second[key], `${path}:${index} ${key}`);
        assert.equal(observed._display.inputQueueLength, plain._display.inputQueueLength);
        const option = part.nethackrc.match(/OPTIONS=msg_window:(single|combination|full|reversed)/)?.[1];
        const mode = option ? option[0] : 's';
        assert.ok(states.length > 0);
        assert.ok(states.every(s => s.mode === mode));
        const recalled = states.filter(s => s.history);
        if (part.moves.includes('\x10') && mode !== 's') {
            assert.ok(recalled.length > 0, `${part.name}: live history window must survive until input`);
            assert.ok(recalled.every(s => s.inread === 0));
            assert.ok(recalled.some(s => s.visible.includes('Message History')));
        } else {
            assert.equal(recalled.length, 0, `${part.name}: no text-history window expected`);
        }
        if (part.name.endsWith('-resume'))
            assert.ok(states.some(s => s.logical === 'What do you want to name this dagger? Edge'),
                `${part.name}: original line resumes after the recalled window`);
        console.log(JSON.stringify({path, index, name: part.name, mode,
            historySteps: recalled.map(s => s.step), boundaries: first.screens.length,
            hashes: Object.fromEntries(Object.entries(first).map(([k, v]) => [k, hash(v)])),
            observerNeutral: true}));
    }
}
