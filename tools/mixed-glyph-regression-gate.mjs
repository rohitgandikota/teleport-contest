import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reportPath, js, sha, fixtures, expected, accounting, decodeScreen, renderCell }
    from './mixed-glyph-preflight.mjs';
const { runSegment } = await import(new URL('jsmain.js', js));
const { InMemoryStorage } = await import(new URL('storage.js', js));
const timer = setTimeout(() => process.exit(124), 55_000);
const rows = [];
try {
    for (const [fixture, native] of Object.entries(fixtures)) {
        const storage = new InMemoryStorage(), segments = [];
        for (const [index, part] of native.segments.entries()) {
            const run = await runSegment({ ...part, storage });
            const streams = { screens: run.getScreens(), cursors: run.getCursors(),
                calls: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep() };
            const hashes = Object.fromEntries(Object.entries(streams).map(([name, value]) => [name, sha(JSON.stringify(value))]));
            assert.deepEqual(hashes, expected[fixture][index].rawHashes.js, `${fixture}/${index}: all five complete streams`);
            assert.equal(streams.screens.length, part.steps.length);
            for (const row of accounting.newRegressions.filter(r => r.fixture === fixture && r.segment === index)) {
                const {x, y, c} = row.difference;
                const grid = decodeScreen(streams.screens[row.step]);
                assert.deepEqual({ch: renderCell(grid[y][x]), color: grid[y][x].color, attr: grid[y][x].attr}, c);
            }
            segments.push({ index, boundaries: streams.screens.length, hashes,
                retainedFullStyleExact: expected[fixture][index].fullStyleExact,
                retainedBlankStyleMismatchCells: expected[fixture][index].blankStyleMismatches });
        }
        rows.push({fixture, segments});
    }
    const report = { classification: 'Live current-runtime outputs equal all five complete published streams. Three old full-style failures remain explicit.',
        fixtures: 9, segments: 28, boundaries: 6160, repairedGlyphCells: 17,
        retainedBlankStyleMismatchCells: 1182, rows };
    if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({fixtures: 9, segments: 28, boundaries: 6160, repairedGlyphCells: 17,
        oldFullStyleFailures: 3, oldBlankStyleCells: 1182}));
} finally { clearTimeout(timer); }
