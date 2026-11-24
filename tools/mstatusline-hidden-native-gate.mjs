// Independent C comparison. Every cell style, RNG entry, input slice, cursor,
// animation and animation metadata field participates in the result.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {recordingIntegrityErrors, branchAssertionErrors} from './gen-sessions/assertions.mjs';
import coverage from './gen-sessions/coverage-requirements.json' with {type:'json'};

const sha = value => createHash('sha256').update(value).digest('hex');
const hash = value => sha(JSON.stringify(value));
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const hashes = out => Object.fromEntries(Object.entries(out).map(([key,value]) => [key,hash(value)]));
const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/mstatusline-hidden.json', import.meta.url)));
const path = process.argv[2] || new URL('gen-sessions/generated/mstatusline-hidden.session.json', import.meta.url);
const raw = readFileSync(path), native = JSON.parse(raw);
assert.equal(sha(raw), '4cfdd6d2321fde40c77ec7f632f564662cde6d660e90e9f0a40eaa5bbea2f1b8');
assert.equal(raw.length, 786793);
assert.equal(native.source, 'c'); assert.equal(native.version, 5);
assert.equal(native.segments.length, 4); assert.equal(recipe.name, 'mstatusline-hidden');
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(recipe, native), []);
const registered = new Set(coverage.requirements.map(r => r.id));
assert.ok(recipe.coverage.every(tag => registered.has(tag)));

// Only diagnostic source annotations differ between recorders. Retain every
// draw, argument, result, display-RNG marker, position and slice boundary.
function calls(entries) {
    assert.ok(Array.isArray(entries));
    return entries.map(entry => {
        assert.equal(typeof entry, 'string');
        const call = entry.replace(/\s+@\s*.*$/, '');
        assert.match(call, /^(?:~d)?(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(-?\d+(?:,\s*-?\d+)*\)=-?\d+$/);
        return call;
    });
}
const grid = screen => decodeScreen(screen).map(row => row.map(cell =>
    [renderCell(cell),cell.color,cell.attr]));
function frame(frame) {
    assert.ok(Object.hasOwn(frame, 'screen'));
    const metadata = Object.fromEntries(Object.keys(frame).filter(k => k !== 'screen')
        .sort().map(k => [k,frame[k]]));
    return {screen:grid(frame.screen), metadata};
}
function comparison(out) {
    return {screens:out.screens.map(grid), cursors:out.cursors, calls:calls(out.calls),
        slices:out.slices.map(calls), frames:out.frames.map(frames => frames.map(frame))};
}
const count = out => ({boundaries:out.screens.length,cursors:out.cursors.length,
    calls:out.calls.length,slices:out.slices.length,frameBoundaries:out.frames.length,
    frames:out.frames.flat().length});
const fields = ['name','seed','datetime','nethackrc','moves'];
for (const [index, part] of native.segments.entries()) {
    const proposed = recipe.segments[index];
    for (const field of fields) {
        assert.equal(Object.hasOwn(part,field), Object.hasOwn(proposed,field));
        assert.deepEqual(part[field], proposed[field]);
    }
    assert.deepEqual(part.steps.map(s => s.key), [null,...part.moves]);
    assert.equal(part.steps.length, part.moves.length + 1);
    for (const step of part.steps)
        assert.deepEqual(Object.keys(step).filter(k => !['key','screen','cursor','rng','animation_frames'].includes(k)), [],
            'no unexamined step metadata');
    const run = await runSegment({...part, storage:new InMemoryStorage()});
    const output = {screens:run.getScreens(),cursors:run.getCursors(),calls:run.getRngLog(),
        slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()};
    const recorded = {screens:part.steps.map(s => s.screen),cursors:part.steps.map(s => s.cursor),
        calls:part.steps.flatMap(s => s.rng),slices:part.steps.map(s => s.rng),
        frames:part.steps.map(s => s.animation_frames || [])};
    const c = comparison(recorded), js = comparison(output);
    assert.deepEqual(js.slices.flat(),js.calls);
    assert.deepEqual(c.slices.flat(),c.calls);
    assert.equal(c.calls.length,recorded.calls.length); assert.equal(js.calls.length,output.calls.length);
    const matched = {grids:0,cursors:0,slices:0,frameCounts:0,frameGrids:0,frameCursors:0,frameMetadata:0,callPositions:0};
    const differences = [], frameMetadataKeys = new Set();
    for (let step=0;step<Math.max(c.screens.length,js.screens.length);step++) {
        const cells = [];
        if (c.screens[step] && js.screens[step]) {
            for(let y=0;y<24;y++) for(let x=0;x<80;x++)
                if(!same(c.screens[step][y][x],js.screens[step][y][x]))
                    cells.push({x,y,c:c.screens[step][y][x],js:js.screens[step][y][x]});
        }
        const screen = !!c.screens[step] && !!js.screens[step] && cells.length === 0;
        const cursor = same(c.cursors[step],js.cursors[step]);
        const slice = same(c.slices[step],js.slices[step]);
        const cframes = c.frames[step] || [], jframes = js.frames[step] || [];
        const frameCount = cframes.length === jframes.length;
        let frames = frameCount;
        const frameDifferences = [];
        for(let f=0;f<Math.max(cframes.length,jframes.length);f++) {
            const cf=cframes[f],jf=jframes[f];
            const screenExact = !!cf && !!jf && same(cf.screen,jf.screen);
            const metadataExact = !!cf && !!jf && same(cf.metadata,jf.metadata);
            const cursorExact = !!cf && !!jf && same(cf.metadata.cursor,jf.metadata.cursor);
            for(const key of [...Object.keys(cf?.metadata || {}),...Object.keys(jf?.metadata || {})]) frameMetadataKeys.add(key);
            matched.frameGrids += +screenExact; matched.frameCursors += +cursorExact;
            matched.frameMetadata += +metadataExact;
            frames &&= screenExact && metadataExact;
            if(!screenExact || !metadataExact) frameDifferences.push({frame:f,screenExact,metadataExact,c:cf,js:jf});
        }
        matched.grids += +screen; matched.cursors += +cursor; matched.slices += +slice;
        matched.frameCounts += +frameCount;
        if(!screen || !cursor || !slice || !frames) differences.push({step,key:part.steps[step]?.key,
            screen,cursor,slice,frames,cells,cCursor:c.cursors[step],jsCursor:js.cursors[step],
            cSlice:c.slices[step],jsSlice:js.slices[step],frameDifferences});
    }
    let firstCall = null;
    for(let i=0;i<Math.max(c.calls.length,js.calls.length);i++) {
        if(c.calls[i]===js.calls[i]) matched.callPositions++;
        else if(!firstCall) firstCall={index:i,c:c.calls[i]??null,js:js.calls[i]??null};
    }
    const fullStreamExact = same(c.calls,js.calls);
    const lengthsExact = same(count(recorded),count(output));
    const exact = differences.length === 0 && fullStreamExact && lengthsExact;
    console.log(JSON.stringify({segment:index,name:part.name,exact,nativeSHA256:sha(raw),
        comparator:'All decoded glyph/color/attribute cells including blanks; exact cursors, complete RNG and slices; every frame cell, key and metadata value. No masking or resynchronization.',
        expected:count(recorded),actual:count(output),matched,fullStreamExact,lengthsExact,firstCall,
        everyRngEntryRecognized:true,discardedRngEntries:0,
        allFiveInputFieldsAndPresenceExact:true,allInputKeysExact:true,nativeBranchAssertionsPass:true,
        frameMetadataKeys:[...frameMetadataKeys].sort(),
        rawNativeHashes:hashes(recorded),rawJSHashes:hashes(output),
        comparisonNativeHashes:hashes(c),comparisonJSHashes:hashes(js),differences}));
    if(!exact) process.exitCode=1;
}
