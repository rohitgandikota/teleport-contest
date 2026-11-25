// Compare every native output, retaining mismatches instead of stopping at the first.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
const fixture = process.argv[2] || new URL(
    'gen-sessions/generated/monster-miscellaneous-use.session.json', import.meta.url);
const bytes = fs.readFileSync(fixture);
assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '0aef44bd299815a5383f6d67d02202b1eb78fd3688e05e9ca2f029fedf853f1b');
const raw = JSON.parse(bytes);
assert.equal(raw.source, 'c'); assert.equal(raw.version, 5);
assert.equal(raw.segments.length, 9);
for (const part of raw.segments)
    assert.deepEqual(part.steps.map(step => step.key), [null, ...part.moves]);
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
function allGridDifferences(a, b) {
    if (!a || !b)
        throw Error('missing complete grid');
    const ranges = [];
    let cells = 0;
    for (let y = 0; y < 24; y++) {
        for (let x = 0; x < 80; x++) {
            if (same(a[y][x], b[y][x]))
                continue;
            cells++;
            const last = ranges.at(-1);
            if (last && last.y === y && last.to + 1 === x
                && same(last.native, a[y][x]) && same(last.js, b[y][x])) {
                last.to = x;
            } else {
                ranges.push({ y, from: x, to: x, native: a[y][x], js: b[y][x] });
            }
        }
    }
    return { cells, ranges };
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
const negativeHashes = {
    "1": {
        "screens": "f818e0c80c1b9468a9c26473f69a1412b3e87b95d1d0530e8010ebaa06c9a045",
        "cursors": "e1bc1c9b2ce6c387b6958eedf8315d5a0709663874ef62ead374add8764dcd40",
        "calls": "be0c4acfd0214b71610f1d13e6e5b394b3d708a62f7f814a2127fbe4d487bd36",
        "slices": "0b803ff93de835c60c51aa67c42b3de00a8db3f5f2a49a822d234a02fb73d054",
        "frames": "f5d71f4bea36a1c582fdbeb84bba7f0acc04e03fc1eedaae56817f8a7e389807"
    },
    "2": {
        "screens": "8aa1d78f1cfb5d52f1aaa48583b46030b03dc71a3908b15b2ace23527c58f849",
        "cursors": "e0acaf4af4184e016f444201f4f6dd09254d5db6f225362e7bb8887cafcb2558",
        "calls": "9a56dd72e7fa73318f8d3bb36734b1565bd400420ce4fee80c113bcc5c9492d9",
        "slices": "0df78bc7fa7badd5636218a7b210ec324bda64b8294eab65071759d5e3ad8f51",
        "frames": "8199c11547b06fee4848349ef1354c749be2964bea2cb0131b622f4f341a7b56"
    },
    "4": {
        "screens": "9a764319d6f8a38811567a45132e27ddf3350111c9e1d228a8bcd9ce4c7d4b12",
        "cursors": "e4843b554ae8c8d1845cb78e9d4ed03430d1684866ccf763c97323401ca475db",
        "calls": "df88fd044f3fc31312598c23f80576b2579995fe1c0288a6d8c3686ccc8e84a7",
        "slices": "43a68bbaf3b8f58804a4e5d6864968a980c406fc55849cebf504e9b8334a182b",
        "frames": "df9d8b6589deeb4b04ce405a1070a7c03705e5ad451c117574ea288303c80cb3"
    },
    "6": {
        "screens": "67ce642ae9eb1922da3ea846c5bf41f37853707d2b68228c22b6923187d3ed0a",
        "cursors": "3558667556fc36faf49e602ccfba7d742494598ad4282bf5a799fab5b0040afb",
        "calls": "d48216460ccb0439c753fd4646761c1261ea33267f0c5798a34787af7dbfe329",
        "slices": "959f861ac169cad2110721b6d2b2130f76ae0b2718eb02a7904d033cf6c279b1",
        "frames": "b4cf188c5dc6b27b37d1f85649b5bb578915d9b4591c79f547d77b90b4744435"
    },
    "7": {
        "screens": "a302fac33dc97163fba8ba95d4bf3ea92bb6e8d9b4f93329fbc9b8297ba81ebf",
        "cursors": "392093c082328f04119fe4adea81f163445c1021dd7579c630471720a3eed1b9",
        "calls": "933a3c4730dfad8a7f06391d3c36e249e81ab711df5d509f4663d30b3a3ed31d",
        "slices": "69fe0505ddfa1b276a3622f851c39c25fb8f0bff3d2633d268d51523c326c257",
        "frames": "f64e5a9a7839e91b65c9a2b7a071f1d9dfe91025de9c63a3973c06dafa62e40e"
    },
    "8": {
        "screens": "01a9eace0784592a4761ffe3479aee1d4cf34ab628ee336af1a2b134772fc1c5",
        "cursors": "9da30c7d6c860f8712009045f34d0d76e7f59db3911377f1c9bf87db5a1a4fb9",
        "calls": "539a28a8003e39e881b9827d473c5c7cc4b35aa89338c698b1375efa78889b41",
        "slices": "e53085451e4bd4aff41ffef4612cc7fe2dc5fb12366eff90eb5c7fadad8cb47d",
        "frames": "92d41b9f7c881cec4c231375aaf4f24aefc574798ecc5af912d2d73dd456e7aa"
    }
};
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
        originalOutputHashes: { screens: hash(run.getScreens()), cursors: hash(run.getCursors()), calls: hash(run.getRngLog()), slices: hash(run.getRngSlices()), frames: hash(run.getAnimationFramesByStep()) },
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
        allCellDifferences: [], allAnimationCellDifferences: [],
        comparedCells: 0, differentCells: 0,
        comparedAnimationCells: 0, differentAnimationCells: 0,
        firstGridDifference: null, firstCursorDifference: null,
        firstSliceDifference: null, firstAnimationDifference: null,
    };
    for (let step = 0; step < Math.max(c.styledGrids.length, j.styledGrids.length); step++) {
        const all = allGridDifferences(c.styledGrids[step], j.styledGrids[step]);
        report.comparedCells += 24 * 80;
        report.differentCells += all.cells;
        if (all.cells)
            report.allCellDifferences.push({ step, ...all });
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
            const all = allGridDifferences(a[i].grid, b[i].grid);
            report.comparedAnimationCells += 24 * 80;
            report.differentAnimationCells += all.cells;
            if (all.cells)
                report.allAnimationCellDifferences.push({ step, frame: i, ...all });
            const frameDifference = firstGridDifference(a[i].grid, b[i].grid);
            report.exactAnimationGrids += !frameDifference;
            report.exactAnimationCursors += same(a[i].cursor, b[i].cursor);
            if (frameDifference || !same(a[i].cursor, b[i].cursor))
                report.firstAnimationDifference ||= { step, frame: i,
                    grid: frameDifference, nativeCursor: a[i].cursor, jsCursor: b[i].cursor };
        }
    }
    report.exact = Object.values(hashes).every(pair => pair.equal);
    if (Object.hasOwn(negativeHashes, segment))
        assert.deepEqual(report.originalOutputHashes, negativeHashes[segment],
            `case ${segment}: preserve all five original JS output hashes`);
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
