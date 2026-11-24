// Strict native parity: all 24x80 rendered glyph/color/attr cells, including blanks.
// Complete streams, per-input slices, every frame and cursor are checked.
// Usage: node tools/rogue-xray-priority-native-gate.mjs [fixture] [report.json]
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const bytes=readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/rogue-xray-priority.session.json',import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '01cb679043f5d727dcc0ba531f3a05c20ee34b53814dfac228a39bb933a4d54b');
const fixture=JSON.parse(bytes),storage=new InMemoryStorage(),results=[];
// Strip callsite annotations only; never discard an unknown or extra entry.
const calls=list=>(list||[]).map(entry=>{
    const call=String(entry).replace(/\s*@\s.*$/,'').replace(/^\d+\s+/,'').trim();
    assert.match(call,/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/,'every RNG entry is a call');
    return call;
});
assert.equal(fixture.version,5);assert.equal(fixture.source,'c');
const recipe=JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/rogue-xray-priority.json',import.meta.url)));
assert.equal(fixture.segments.length,recipe.segments.length);
assert.deepEqual(recordingIntegrityErrors(fixture), []);
assert.deepEqual(branchAssertionErrors(recipe, fixture), []);
// Native terminal witnesses. Hidden property/level state is checked by the
// separate real-input gate; these assertions do not pretend to inspect C flags.
const nativeAssertions=[];
const top=step=>decodeScreen(step.screen)[0].map(renderCell).join('').trimEnd();
const nativeMap=step=>decodeScreen(step.screen).slice(1,22)
    .map(row=>row.slice(0,79).map(cell=>[renderCell(cell),cell.color,cell.attr]));
const nonblank=map=>map.flat().filter(cell=>cell[0]!==' ').length;
assert.equal(fixture.segments.length,3);
for(const [index,part] of fixture.segments.entries()) {
    assert.equal(part.steps.length,[49,40,34][index]);
    assert.equal(part.steps.flatMap(s=>calls(s.rng)).length,[2657,2286,2655][index]);
    assert.ok(part.steps.every(s=>(s.animation_frames||[]).length===0));
    const wear=part.moves.indexOf('Pa')+2, last=part.steps.at(-1);
    assert.equal(part.steps[wear-1].key,'P');
    assert.equal(part.steps[wear].key,'a');
    assert.match(top(part.steps[wear-1]),/^What do you want to put on/);
    assert.equal(top(part.steps[wear]),index===2
        ? 'You are now wearing a pair of lenses.'
        : 'You are now wearing a pair of lenses named the Eyes of the Overworld.');
    assert.equal(last.key,'\x12');
    assert.deepEqual(last.rng,[],'native redraw consumes no calls');
    assert.deepEqual(nativeMap(last),nativeMap(part.steps[wear]),
        'native redraw retains every styled map cell, including blanks');
    const rogueMessage=part.steps.some(step=>top(step).includes(
        'You enter what seems to be an older, more primitive world.'));
    assert.equal(rogueMessage,index!==1);
    assert.equal(nonblank(nativeMap(last)),index===1?69:9);
    if(index!==1) {
        for(const step of [wear,part.steps.length-1]) {
            const grid=decodeScreen(part.steps[step].screen);
            for(const x of [11,12]) {
                assert.equal(renderCell(grid[8][x]),' ','native distant wall stays hidden');
                assert.equal(grid[8][x].color,8);
                assert.equal(grid[8][x].attr,0);
            }
            assert.equal(renderCell(grid[8][13]),'-','adjacent wall remains visible');
            assert.equal(renderCell(grid[9][14]),'@','native hero remains visible');
        }
        assert.deepEqual(nativeMap(part.steps[wear]),nativeMap(part.steps[wear-1]),
            'native Rogue view stays local across facewear acquisition');
    }
    nativeAssertions.push({name:part.name,wearBoundary:wear,
        nativeWearMessage:top(part.steps[wear]),rogueMessage,
        redrawBoundary:part.steps.length-1,redrawCalls:0,
        styledMapPreservedOnRedraw:true,nonblankMapCells:nonblank(nativeMap(last))});
}
assert.deepEqual(nativeMap(fixture.segments[0].steps.at(-1)),
    nativeMap(fixture.segments[2].steps.at(-1)),
    'native Rogue map agrees for real Eyes and ordinary-lenses negative');
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
