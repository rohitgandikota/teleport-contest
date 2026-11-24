// Existing C recordings: assert complete styled chargen prefixes, including blanks.
// Later gameplay is covered by the separate whole-fixture replay receipts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { decodeScreen, renderCell } from '../frozen/screen-decode.mjs';

const root = new URL('../', import.meta.url);
const cases = [
    ['seed0002-healer-reflection-drummer', 7, 28],
    ['seed0004-feeding-pony', 7, 28],
    ['seed0007-rogue-snake-swamp', 8, 28],
    ['seed0009-swimmer-mforce', 9, 28],
];
function grid(screen) {
    return decodeScreen(screen).map(row => row.map(cell =>
        [renderCell(cell), cell.color, cell.attr]));
}

for (const [name, confirmStep, gapColumn] of cases) {
    test(`${name}: every styled cell through character confirmation matches native`, async () => {
        const raw = JSON.parse(fs.readFileSync(new URL(`sessions/${name}.session.json`, root)));
        assert.equal(raw.source, 'c');
        assert.equal(raw.version, 5);
        const part = raw.segments[0];
        const native = grid(part.steps[confirmStep].screen);
        assert.ok(native.some(row => row.map(cell => cell[0]).join('').includes('Is this ok?')));
        assert.deepEqual(native[4][gapColumn], [' ', 8, 0], 'native default-colored gap');
        const run = await runSegment({ ...part, storage: new InMemoryStorage() });
        assert.equal(run.getScreens().length, part.steps.length, 'whole replay boundary count');
        for (let step = 0; step <= confirmStep; step++) {
            assert.deepEqual(grid(run.getScreens()[step]), grid(part.steps[step].screen), `step ${step}`);
            assert.deepEqual(run.getCursors()[step], part.steps[step].cursor, `cursor ${step}`);
        }
    });
}
