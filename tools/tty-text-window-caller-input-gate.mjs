// Run after all post-display caller waits have been removed, including parent-owned sites.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';

const [path] = process.argv.slice(2);
assert.ok(path, 'provide caller-recorder-input-v5.session.json or its unchanged C recording');
const raw = JSON.parse(readFileSync(path));
assert.equal(raw.source, 'c');
assert.equal(raw.version, 5);
const failures = [];
for (const part of raw.segments) {
    const run = await runSegment({...part, storage: new InMemoryStorage()});
    const out = {screens: run.getScreens(), cursors: run.getCursors(),
        calls: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep()};
    const inventory = out.screens.flatMap((screen, step) => {
        const text = decodeScreen(screen).map(row => row.map(renderCell).join('')).join('\n');
        return text.includes('Not carrying anything.') ? [step] : [];
    });
    if (!inventory.length) failures.push(part.name);
    console.log(JSON.stringify({name: part.name, inventorySteps: inventory,
        hashes: Object.fromEntries(Object.entries(out).map(([key, value]) =>
            [key, createHash('sha256').update(JSON.stringify(value)).digest('hex')]))}));
}
assert.deepEqual(failures, [], 'every following inventory command must reach the command loop');
