// Compare every native output, retaining mismatches instead of stopping at the first.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { decodeScreen, renderCell } from '../frozen/screen-decode.mjs';
const fixture=process.argv[2] || fileURLToPath(new URL(
    'gen-sessions/generated/message-query-bounds.session.json',import.meta.url));
const bytes = fs.readFileSync(fixture);
const raw = JSON.parse(bytes);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function calls(entries) {
    return entries.map(entry => {
        const value = String(entry).replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim();
        assert.match(value, /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/,
            'every RNG entry is retained and recognized');
        return value;
    });
}
function grid(screen) {
    return decodeScreen(screen).map(row => row.map(cell =>
        [renderCell(cell), cell.color, cell.attr]));
}
function firstGridDifference(a, b) {
    if (!a || !b)
        return { missing: !a ? 'native' : 'JS' };
    for (let y = 0; y < 24; y++)
        for (let x = 0; x < 80; x++)
            if (!same(a[y][x], b[y][x]))
                return { x, y, native: a[y][x], js: b[y][x] };
    return null;
}
function firstDifference(a, b) {
    for (let index = 0; index < Math.max(a.length, b.length); index++)
        if (!same(a[index], b[index]))
            return { index, native: a[index] ?? null, js: b[index] ?? null };
    return null;
}
function normalize(screens, cursors, rng, slices, frames) {
    return {
        styledGrids: screens.map(grid),
        cursors,
        completeRng: calls(rng),
        rngSlices: slices.map(calls),
        animations: frames.map(group => group.map(frame => ({
            grid: grid(frame.screen), cursor: frame.cursor,
        }))),
    };
}
const reports = [], storage = new InMemoryStorage();
for (const [segment, part] of raw.segments.entries()) {
    const run = await runSegment({ ...part, storage });
    const c = normalize(part.steps.map(step => step.screen), part.steps.map(step => step.cursor),
        part.steps.flatMap(step => step.rng || []), part.steps.map(step => step.rng || []),
        part.steps.map(step => step.animation_frames || []));
    const j = normalize(run.getScreens(), run.getCursors(), run.getRngLog(),
        run.getRngSlices(), run.getAnimationFramesByStep());
    const hashes = Object.fromEntries(Object.keys(c).map(key => [key, {
        native: hash(c[key]), js: hash(j[key]), equal: hash(c[key]) === hash(j[key]),
    }]));
    const report = {
        segment, name: part.name, hashes,
        boundaries: { native: c.styledGrids.length, js: j.styledGrids.length },
        calls: { native: c.completeRng.length, js: j.completeRng.length },
        frames: { native: c.animations.flat().length, js: j.animations.flat().length },
        collectionLengthsExact: ['styledGrids', 'cursors', 'rngSlices', 'animations']
            .every(key => c[key].length === j[key].length),
        completeRngExact: same(c.completeRng, j.completeRng),
        firstRngDifference: firstDifference(c.completeRng, j.completeRng),
        exactStyledGrids: 0, exactCursors: 0, exactSlices: 0,
        exactAnimationCountBoundaries: 0,
        comparedAnimationGrids: 0, exactAnimationGrids: 0, exactAnimationCursors: 0,
        extraJsFrames: 0, missingJsFrames: 0,
        gridDifferenceSteps: [], cursorDifferenceSteps: [], sliceDifferenceSteps: [],
        animationCountDifferenceSteps: [],
        firstGridDifference: null, firstCursorDifference: null,
        firstSliceDifference: null, firstAnimationDifference: null,
    };
    for (let step = 0; step < Math.max(c.styledGrids.length, j.styledGrids.length); step++) {
        const difference = firstGridDifference(c.styledGrids[step], j.styledGrids[step]);
        if (difference) {
            report.gridDifferenceSteps.push(step);
            report.firstGridDifference ||= { step, ...difference,
                nativeTop: c.styledGrids[step]?.[0].map(cell => cell[0]).join('').trimEnd(),
                jsTop: j.styledGrids[step]?.[0].map(cell => cell[0]).join('').trimEnd() };
        } else {
            report.exactStyledGrids++;
        }
        if (same(c.cursors[step], j.cursors[step])) {
            report.exactCursors++;
        } else {
            report.cursorDifferenceSteps.push(step);
            report.firstCursorDifference ||= { step, native: c.cursors[step], js: j.cursors[step] };
        }
        if (same(c.rngSlices[step], j.rngSlices[step])) {
            report.exactSlices++;
        } else {
            report.sliceDifferenceSteps.push(step);
            report.firstSliceDifference ||= { step,
                native: c.rngSlices[step], js: j.rngSlices[step],
                nativeContexts: part.steps[step]?.rng };
        }
        const a = c.animations[step] || [], b = j.animations[step] || [];
        report.extraJsFrames += Math.max(0, b.length - a.length);
        report.missingJsFrames += Math.max(0, a.length - b.length);
        if (a.length === b.length) {
            report.exactAnimationCountBoundaries++;
        } else {
            report.animationCountDifferenceSteps.push(step);
            report.firstAnimationDifference ||= { step, nativeCount: a.length, jsCount: b.length,
                firstJsCursor: b[0]?.cursor,
                firstJsTop: b[0]?.grid[0].map(cell => cell[0]).join('').trimEnd() };
        }
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            report.comparedAnimationGrids++;
            const frameDifference = firstGridDifference(a[i].grid, b[i].grid);
            report.exactAnimationGrids += !frameDifference;
            report.exactAnimationCursors += same(a[i].cursor, b[i].cursor);
            if (frameDifference || !same(a[i].cursor, b[i].cursor))
                report.firstAnimationDifference ||= { step, frame: i,
                    grid: frameDifference, nativeCursor: a[i].cursor, jsCursor: b[i].cursor };
        }
    }
    report.exact = Object.values(hashes).every(pair => pair.equal);
    reports.push(report);
}
console.log(JSON.stringify({
    evidence: 'native C versus captured normal-import JS',
    rawSha256: createHash('sha256').update(bytes).digest('hex'),
    styleDefinition: 'rendered glyph, exact color and attributes, including blank cells',
    rngNormalization: 'strip only numeric index and caller context; retain every call',
    reports,
    exact: reports.every(report => report.exact),
}, null, 4));
process.exitCode = reports.every(report => report.exact) ? 0 : 1;
