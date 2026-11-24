// Strict native parity: all 24x80 rendered glyph/color/attr cells, including blanks.
// Complete streams, per-input slices, every frame and cursor are checked.
// Usage: node tools/docrt-flags-native-gate.mjs [fixture] [report.json]
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const bytes=readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/docrt-flags.session.json',import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '5cc8a25783820fb21308075428c0bd09d30c98298d3926a8e21384c21d379a35');
const fixture=JSON.parse(bytes),storage=new InMemoryStorage(),results=[];
// Strip callsite annotations only; never discard an unknown or extra entry.
const calls=list=>(list||[]).map(entry=>{
    const call=String(entry).replace(/\s*@\s.*$/,'').replace(/^\d+\s+/,'').trim();
    assert.match(call,/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/,'every RNG entry is a call');
    return call;
});
assert.equal(fixture.version,5);assert.equal(fixture.source,'c');
const recipe=JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/docrt-flags.json',import.meta.url)));
assert.equal(fixture.segments.length,recipe.segments.length);
assert.deepEqual(recordingIntegrityErrors(fixture), []);
assert.deepEqual(branchAssertionErrors(recipe, fixture), []);
// These are observations of the immutable C terminal, not inferred C flags.
const nativeAssertions=[];
const top=step=>decodeScreen(step.screen)[0].map(renderCell).join('').trimEnd();
const nativeMap=step=>decodeScreen(step.screen).slice(1,22)
    .map(row=>row.slice(0,79).map(cell=>[renderCell(cell),cell.color,cell.attr]));
const nonblank=map=>map.flat().filter(cell=>cell[0]!==' ').length;
assert.equal(fixture.segments.length,8);
for(const [index,part] of fixture.segments.entries()) {
    const counts=[58,58,48,172,14,13,5,4];
    const callCounts=[2339,2323,2828,2430,2300,2300,2300,2300];
    assert.equal(part.steps.length,counts[index]);
    assert.equal(part.steps.flatMap(s=>s.rng||[]).length,callCounts[index]);
    assert.ok(part.steps.every(s=>(s.animation_frames||[]).length===0));
    const redraw=part.moves.lastIndexOf('\x12');
    if(redraw>=0) {
        const before=part.steps[redraw],after=part.steps[redraw+1];
        assert.equal(after.key,'\x12');
        assert.deepEqual(nativeMap(after),nativeMap(before),
            `${part.name}: C redraw preserves the current complete styled map`);
        assert.deepEqual(after.rng,[],`${part.name}: C redraw consumes no RNG`);
        if(index===0||index===2) {
            assert.equal(nonblank(nativeMap(after)),1,'restricted native pool view');
        } else if(index===1) {
            assert.equal(nonblank(nativeMap(after)),77,'dry native room remains visible');
        } else if(index===3) {
            assert.equal(nonblank(nativeMap(after)),9,'native engulfing interior');
        } else if(index===4) {
            assert.equal(nonblank(nativeMap(after)),552,'native terrain view keeps the whole map');
            assert.equal(renderCell(decodeScreen(after.screen)[6][39]),'<');
            assert.equal(top(after),'Move cursor to anything of interest:');
        } else if(index===6) {
            assert.equal(top(before),'In what direction?');
            assert.equal(top(after),'In what direction?');
            assert.deepEqual(after.cursor,[19,0,1]);
            assert.ok(!part.steps.some(s=>top(s).includes('Invalid direction')));
        }
        nativeAssertions.push({name:part.name,redrawBoundary:redraw+1,
            fullStyledMapPreserved:true,nonblank:nonblank(nativeMap(after)),
            redrawCalls:after.rng.length,top:top(after),cursor:after.cursor});
    } else if(index===5) {
        assert.equal(part.steps[12].key,'\x1b');
        assert.equal(renderCell(decodeScreen(part.steps[11].screen)[6][39]),'<');
        assert.equal(renderCell(decodeScreen(part.steps[12].screen)[6][39]),'@');
        nativeAssertions.push({name:part.name,noRedraw:true,terrainEscapeRestoresHero:true});
    } else {
        assert.equal(index,7);assert.equal(top(part.steps[2]),'In what direction?');
        assert.equal(part.steps[3].key,'\x1b');
        assert.ok(!part.steps.some(s=>top(s).includes('Invalid direction')));
        nativeAssertions.push({name:part.name,noRedraw:true,directionEscape:true});
    }
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
    const run=await runSegment({...part,storage});
    const screens=run.getScreens(),cursors=run.getCursors();
    const slices=run.getRngSlices().map(calls),frames=run.getAnimationFramesByStep();
    const actual=calls(run.getRngLog()),expected=part.steps.flatMap(s=>calls(s.rng));
    const matches={screens:0,cursors:0,slices:0,frameCounts:0,frames:0};
    const differences=[];
    let nativeFrames=0,jsFrames=0;
    for(const [step,c] of part.steps.entries()) {
        const grid=gridDifference(c.screen,screens[step]);
        const cursor=equal(c.cursor,cursors[step]),slice=equal(calls(c.rng),slices[step]);
        const cf=c.animation_frames||[],jf=frames[step]||[];
        nativeFrames+=cf.length;jsFrames+=jf.length;
        const counts=cf.length===jf.length;
        matches.screens+=+!grid;matches.cursors+=+cursor;
        matches.slices+=+slice;matches.frameCounts+=+counts;
        const frameDifferences=[];
        for(let f=0;f<Math.max(cf.length,jf.length);f++) {
            const cg=cf[f],jg=jf[f];
            const frameGrid=cg?gridDifference(cg.screen,jg?.screen):{extra:true};
            const frameCursor=!!cg&&!!jg&&equal(cg.cursor,jg.cursor);
            matches.frames+=+(!frameGrid&&frameCursor);
            if(frameGrid||!frameCursor)frameDifferences.push({frame:f,grid:frameGrid,
                cCursor:cg?.cursor,jsCursor:jg?.cursor});
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
assert.ok(results.every(result=>result.exact),'all native grids, cursors, streams, slices and animation counts match');
