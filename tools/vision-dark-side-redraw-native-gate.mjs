// Strict native parity for the unchanged parent C recording.
// Every rendered 24x80 cell includes glyph, color and attributes, including blanks.
// Usage: node tools/vision-dark-side-redraw-native-gate.mjs [fixture] [report.json]
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const bytes = readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/vision-dark-side-redraw.session.json', import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '5837649a9bfe665a4ee8e3156b47b0df85c3af7ae5e1963f8b9004c104d40e3a');
const fixture = JSON.parse(bytes), results = [];
const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/vision-dark-side-redraw.json', import.meta.url)));
assert.equal(fixture.source, 'c');
assert.equal(fixture.version, 5);
assert.equal(fixture.segments.length, 4);
assert.equal(recipe.segments.length, 4);
assert.deepEqual(recordingIntegrityErrors(fixture), []);
assert.deepEqual(branchAssertionErrors(recipe, fixture), []);
// Remove callsite annotations only. Unknown, extra and missing entries fail.
// The native recording contains core calls, not a display-RNG diagnostic trace.
const calls = list => (list || []).map(entry => {
    const call = String(entry).replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim();
    assert.match(call, /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/, 'every RNG entry is a call');
    return call;
});
const top = step => decodeScreen(step.screen)[0].map(renderCell).join('').trimEnd();
const cell = (step, x, y) => {
    const value = decodeScreen(step.screen)[y][x];
    return [renderCell(value), value.color, value.attr];
};
const nativeAssertions = [];
for (const [index, part] of fixture.segments.entries()) {
    assert.equal(part.steps.length, [145,147,122,135][index]);
    assert.ok(part.steps.every(s => Array.isArray(s.rng)));
    assert.equal(part.steps.flatMap(s => calls(s.rng)).length, [2817,2817,2817,2789][index]);
    assert.ok(part.steps.every(s => !Object.hasOwn(s,'animation_frames')
        || (Array.isArray(s.animation_frames) && s.animation_frames.length === 0)));
    const wear=part.steps.findIndex(s=>top(s).includes('a ring of stealth (on left hand)'));
    const creation=part.steps.findIndex(s=>top(s)==='A xorn appears next to you.');
    const effectText=index===1?'A lit field surrounds you!':'You are surrounded by darkness!';
    const effect=part.steps.findIndex(s=>top(s).includes(effectText));
    const door=part.steps.findIndex(s=>top(s)==='A closed door.');
    assert.ok(wear>0 && creation>wear && effect>creation,'native producer order');
    assert.equal(door>=0,index!==2);
    if(index!==2)assert.ok(door>wear && door<creation);
    const departure=part.steps.length-4, end=part.steps.length-1;
    assert.ok(effect<departure);
    assert.deepEqual(part.steps.slice(departure).map(s=>s.key),['.','\x1b','\x1b','\x12']);
    assert.equal(top(part.steps[departure]),'You materialize in a different location!');
    assert.deepEqual(cell(part.steps[departure-1],10,14),[index===3?'+':'X',3,0]);
    const expected=index===1||index===2?'X':'+';
    for(let step=departure;step<=end;step++) {
        assert.deepEqual(cell(part.steps[step],10,14),[expected,3,0]);
        assert.deepEqual(part.steps[step].cursor,[13,13,1]);
    }
    assert.deepEqual(part.steps[end].rng,[],'native Ctrl-R adds no core call');
    nativeAssertions.push({name:part.name,wearBoundary:wear,creationBoundary:creation,
        doorBoundary:door,effectBoundary:effect,nativeEffect:effectText,
        departureBoundary:departure,priorCell:cell(part.steps[departure-1],10,14),
        departureCell:cell(part.steps[departure],10,14),redrawCell:cell(part.steps[end],10,14),
        redrawBoundary:end,redrawCoreCalls:0});
}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const first=(a,b)=>{
    for(let i=0;i<Math.max(a.length,b.length);i++)if(!equal(a[i],b[i]))return i;
    return null;
};
function gridDifference(a,b) {
    if(typeof b!=='string')return {missing:true};
    const c=decodeScreen(a),j=decodeScreen(b);
    let count=0,firstCell=null;
    for(let y=0;y<24;y++)for(let x=0;x<80;x++) {
        // DEC graphics and Unicode are decoded glyph representations.
        // Color and every attribute remain strict, including on spaces.
        const fields=['color','attr'].filter(k=>c[y][x][k]!==j[y][x][k]);
        if(renderCell(c[y][x])!==renderCell(j[y][x]))fields.unshift('glyph');
        const kind=fields.length?fields.join(','):null;
        if(kind){count++;firstCell||={x,y,kind,c:c[y][x],js:j[y][x]};}
    }
    return count?{count,firstCell,cTop:c[0].map(c=>c.ch).join('').trimEnd(),
        jsTop:j[0].map(c=>c.ch).join('').trimEnd()}:null;
}
for(const [segment,part] of fixture.segments.entries()) {
    for(const field of ['name','seed','datetime','nethackrc','moves']) {
        assert.equal(Object.hasOwn(part,field),Object.hasOwn(recipe.segments[segment],field),field);
        assert.deepEqual(part[field],recipe.segments[segment][field],field);
    }
    assert.equal(part.steps.length,part.moves.length+1);
    assert.equal(part.steps[0].key,null);
    assert.deepEqual(part.steps.slice(1).map(s=>s.key),Array.from(part.moves));
    const run=await runSegment({...part,storage:new InMemoryStorage()});
    const screens=run.getScreens(),cursors=run.getCursors();
    const slices=run.getRngSlices().map(calls),frames=run.getAnimationFramesByStep();
    const actual=calls(run.getRngLog()),expected=part.steps.flatMap(s=>calls(s.rng));
    assert.deepEqual(slices.flat(),actual,'complete JS call stream equals all input slices');
    const matches={screens:0,cursors:0,slices:0,frameCounts:0,frames:0};
    const differences=[];
    let nativeFrames=0,jsFrames=0;
    for(const [step,c] of part.steps.entries()) {
        const grid=gridDifference(c.screen,screens[step]);
        const cursor=equal(c.cursor,cursors[step]),slice=equal(calls(c.rng),slices[step]);
        const cf=Object.hasOwn(c,'animation_frames')?c.animation_frames:[];
        const jf=frames[step];
        assert.ok(Array.isArray(cf),'native animation collection');
        assert.ok(Array.isArray(jf),'JS animation collection at every input boundary');
        nativeFrames+=cf.length;jsFrames+=jf.length;
        const counts=cf.length===jf.length;
        matches.screens+=+!grid;matches.cursors+=+cursor;
        matches.slices+=+slice;matches.frameCounts+=+counts;
        const frameDifferences=[];
        for(let f=0;f<Math.max(cf.length,jf.length);f++) {
            const cg=cf[f],jg=jf[f];
            const frameGrid=cg?gridDifference(cg.screen,jg?.screen):{extra:true};
            const frameCursor=!!cg&&!!jg&&equal(cg.cursor,jg.cursor);
            const otherFields=frame=>Object.fromEntries(Object.entries(frame||{})
                .filter(([key])=>key!=='screen'&&key!=='cursor'));
            const frameOther=!!cg&&!!jg&&equal(otherFields(cg),otherFields(jg));
            matches.frames+=+(!frameGrid&&frameCursor&&frameOther);
            if(frameGrid||!frameCursor||!frameOther)frameDifferences.push({frame:f,grid:frameGrid,
                cCursor:cg?.cursor,jsCursor:jg?.cursor,
                cOther:otherFields(cg),jsOther:otherFields(jg)});
        }
        if(grid||!cursor||!slice||!counts||frameDifferences.length) {
            const r=first(calls(c.rng),slices[step]||[]);
            differences.push({step,key:c.key,grid,
                cursor:cursor?null:{c:c.cursor,js:cursors[step]},
                rng:slice?null:{cLength:calls(c.rng).length,jsLength:slices[step]?.length,
                    index:r,c:calls(c.rng).slice(r,r+6),js:(slices[step]||[]).slice(r,r+6)},
                nativeFrames:cf.length,jsFrames:jf.length,frameDifferences});
        }
    }
    if(frames.length>part.steps.length)jsFrames+=frames.slice(part.steps.length)
        .reduce((n,f)=>n+f.length,0);
    const d=first(expected,actual);
    const result={segment,name:part.name,nativeBoundaries:part.steps.length,
        jsBoundaries:screens.length,jsCursorCount:cursors.length,jsSliceCount:slices.length,
        jsFrameBoundaryCount:frames.length,matches,nativeCalls:expected.length,jsCalls:actual.length,
        fullStreamExact:d===null,firstRngDifference:d===null?null:
            {index:d,c:expected.slice(d,d+8),js:actual.slice(d,d+8)},
        nativeFrames,jsFrames,differences,
        jsHashes:{screens:hash(screens),cursors:hash(cursors),fullRng:hash(run.getRngLog()),
            slices:hash(run.getRngSlices()),animations:hash(frames)}};
    result.exact=result.nativeBoundaries===result.jsBoundaries
        && result.jsCursorCount===part.steps.length&&result.jsSliceCount===part.steps.length
        && result.jsFrameBoundaryCount===part.steps.length&&d===null
        && Object.entries(matches).every(([k,v])=>v===(k==='frames'?nativeFrames:part.steps.length))
        && nativeFrames===jsFrames;
    results.push(result);
    console.log(JSON.stringify({...result,differences:result.differences.slice(0,1)}));
}
if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify({results,nativeAssertions,rawSha256:createHash('sha256').update(bytes).digest('hex')},null,2)+'\n');
assert.ok(results.every(result=>result.exact),'all native grids, cursors, streams, slices, frame fields and collection lengths match');
