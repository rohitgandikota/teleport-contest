// Native parity: all 24x80 styled cells, complete streams and per-input slices.
// Usage: node tools/weight-cap-native-gate.mjs [fixture] [report.json]
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen,diffCell} from '../frozen/screen-decode.mjs';
const bytes=readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/weight-capacity-boundaries.session.json',import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),
    'a2f4e9ac9cf27b0f691656587cefa314b9d5b9651dd94cce545dd0357782eac3');
const fixture=JSON.parse(bytes),storage=new InMemoryStorage(),results=[];
const calls=list=>(list||[]).map(s=>String(s).replace(/\s*@\s.*$/,'')
    .replace(/^\d+\s+/,'').trim()).filter(s=>/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(s));
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
        const kind=diffCell(c[y][x],j[y][x]);
        if(kind){count++;firstCell||={x,y,kind,c:c[y][x],js:j[y][x]};}
    }
    return count?{count,firstCell,cTop:c[0].map(c=>c.ch).join('').trimEnd(),
        jsTop:j[0].map(c=>c.ch).join('').trimEnd()}:null;
}
for(const [segment,part] of fixture.segments.entries()) {
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
        jsHashes:{screens:hash(screens),cursors:hash(cursors),fullRng:hash(actual),
            slices:hash(slices),animations:hash(frames)}};
    result.exact=result.nativeBoundaries===result.jsBoundaries
        && result.jsCursorCount===part.steps.length&&result.jsSliceCount===part.steps.length
        && result.jsFrameBoundaryCount===part.steps.length&&d===null
        && Object.entries(matches).every(([k,v])=>v===(k==='frames'?nativeFrames:part.steps.length))
        && nativeFrames===jsFrames;
    results.push(result);
    console.log(JSON.stringify({...result,differences:result.differences.slice(0,1)}));
}
if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(results,null,2)+'\n');
assert.ok(results.every(result=>result.exact),'all native grids, cursors, streams, slices and animation counts match');
