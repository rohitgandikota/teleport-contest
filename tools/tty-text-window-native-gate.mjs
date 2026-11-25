// Every decoded glyph, color and attribute is checked, including blank cells.
// Frozen-viewer equality is reported separately and never overrides style failures.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen,renderCell,diffCell} from '../frozen/screen-decode.mjs';
const [fixture, output] = process.argv.slice(2);
assert.ok(fixture && output);
const raw=readFileSync(fixture);
const native=JSON.parse(raw);
const calls=a=>(a||[]).map(s=>{
    const call=String(s).replace(/\s*@\s.*$/,'').replace(/^\d+\s+/,'').trim();
    assert.match(call,/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/,'every raw entry is a retained core RNG call');
    return call;
});
const hash=a=>createHash('sha256').update(JSON.stringify(a)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const styled=c=>({ch:renderCell(c),color:c.color,attr:c.attr});
function gridDiff(c,j) {
    const cg=decodeScreen(c),jg=decodeScreen(j);
    const out={frozenEqual:true,fullStyleEqual:true,totalCells:0,matchingStyleCells:0,
        blankStyleMismatches:0,nonblankStyleMismatches:0,glyphMismatches:0};
    for(let y=0;y<24;y++)for(let x=0;x<80;x++){
        const cv=styled(cg[y][x]),jv=styled(jg[y][x]);out.totalCells++;
        if(same(cv,jv))out.matchingStyleCells++;
        else {
            out.fullStyleEqual=false;
            const difference={x,y,c:cv,js:jv};
            out.firstFullStyleDifference??=difference;
            if(cv.ch!==jv.ch)out.glyphMismatches++;
            else if(cv.ch===' ')out.blankStyleMismatches++;
            else out.nonblankStyleMismatches++;
        }
        const frozen=diffCell(cg[y][x],jg[y][x]);
        if(frozen){out.frozenEqual=false;out.firstFrozenDifference??={x,y,kind:frozen,c:cv,js:jv};}
    }
    return out;
}
function firstArrayDiff(c,j) {
    for(let i=0;i<Math.max(c.length,j.length);i++)if(!same(c[i],j[i]))return {index:i,c:c[i]??null,js:j[i]??null};
    return null;
}
const storage=new InMemoryStorage(),results=[];
for(const [segment,part] of native.segments.entries()){
    const run=await runSegment({...part,storage});
    const c={screens:part.steps.map(s=>s.screen),cursors:part.steps.map(s=>s.cursor),
        calls:part.steps.flatMap(s=>s.rng||[]),slices:part.steps.map(s=>s.rng||[]),
        frames:part.steps.map(s=>s.animation_frames||[])};
    const j={screens:run.getScreens(),cursors:run.getCursors(),calls:run.getRngLog(),
        slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()};
    const expectedCalls=calls(c.calls),actualCalls=calls(j.calls);
    const expectedSlices=c.slices.map(calls),actualSlices=j.slices.map(calls);
    const result={segment,name:part.name,boundaries:{expected:c.screens.length,actual:j.screens.length},
        frozenScreens:0,fullStyleScreens:0,matchingStyleCells:0,totalCells:0,blankStyleMismatches:0,
        nonblankStyleMismatches:0,glyphMismatches:0,screenDifferences:[],
        cursors:{expected:c.cursors.length,actual:j.cursors.length,matched:0,firstDifference:firstArrayDiff(c.cursors,j.cursors)},
        calls:{rawExpected:c.calls.length,rawActual:j.calls.length,discardedEntries:0,expected:expectedCalls.length,actual:actualCalls.length,firstDifference:firstArrayDiff(expectedCalls,actualCalls)},
        slices:{expected:expectedSlices.length,actual:actualSlices.length,matched:0,differences:[]},
        frames:{expected:c.frames.flat().length,actual:j.frames.flat().length,expectedSlices:c.frames.length,actualSlices:j.frames.length,countMismatches:[],fullStyleMatches:0,cursorMatches:0},
        rawHashes:{c:Object.fromEntries(Object.entries(c).map(([k,v])=>[k,hash(v)])),js:Object.fromEntries(Object.entries(j).map(([k,v])=>[k,hash(v)]))},
        normalizedHashes:{c:{calls:hash(expectedCalls),slices:hash(expectedSlices)},js:{calls:hash(actualCalls),slices:hash(actualSlices)}}};
    for(let step=0;step<c.screens.length;step++){
        if(j.screens[step]!==undefined){const d=gridDiff(c.screens[step],j.screens[step]);
            result.frozenScreens+=+d.frozenEqual;result.fullStyleScreens+=+d.fullStyleEqual;
            for(const k of ['matchingStyleCells','totalCells','blankStyleMismatches','nonblankStyleMismatches','glyphMismatches'])result[k]+=d[k];
            if(!d.fullStyleEqual)result.screenDifferences.push({step,...d});
        }
        result.cursors.matched+=+same(c.cursors[step],j.cursors[step]);
        if(same(expectedSlices[step],actualSlices[step]))result.slices.matched++;
        else result.slices.differences.push({step,expected:expectedSlices[step].length,actual:actualSlices[step]?.length??null,
            first:firstArrayDiff(expectedSlices[step],actualSlices[step]||[])});
        const cf=c.frames[step],jf=j.frames[step]||[];
        if(cf.length!==jf.length)result.frames.countMismatches.push({step,expected:cf.length,actual:jf.length});
        for(let frame=0;frame<cf.length;frame++)if(jf[frame]){
            const d=gridDiff(cf[frame].screen,jf[frame].screen);result.frames.fullStyleMatches+=+d.fullStyleEqual;
            result.frames.cursorMatches+=+same(cf[frame].cursor,jf[frame].cursor);
            if(!d.fullStyleEqual)(result.frames.styleDifferences??=[]).push({step,frame,...d});
        }
    }
    result.frozenScreenCursorExact=result.boundaries.expected===result.boundaries.actual&&result.frozenScreens===c.screens.length&&result.cursors.matched===c.cursors.length;
    result.fullRngExact=expectedCalls.length===actualCalls.length&&!result.calls.firstDifference
        &&expectedSlices.length===actualSlices.length&&result.slices.matched===expectedSlices.length;
    result.fullStyleExact=result.boundaries.expected===result.boundaries.actual&&result.fullStyleScreens===c.screens.length;
    result.animationExact=result.frames.expected===result.frames.actual&&!result.frames.countMismatches.length
        &&result.frames.expectedSlices===result.frames.actualSlices&&result.frames.fullStyleMatches===result.frames.expected&&result.frames.cursorMatches===result.frames.expected;
    results.push(result);
    console.log(JSON.stringify({segment,name:part.name,boundaries:result.boundaries,frozenScreens:result.frozenScreens,
        fullStyleScreens:result.fullStyleScreens,blankStyleMismatches:result.blankStyleMismatches,
        nonblankStyleMismatches:result.nonblankStyleMismatches,glyphMismatches:result.glyphMismatches,
        cursors:result.cursors,calls:result.calls,firstSliceDifference:result.slices.differences[0]||null,frames:result.frames,
        firstFullStyle:result.screenDifferences[0]||null,
        firstFrozen:result.screenDifferences.find(d=>!d.frozenEqual)||null}));
}
writeFileSync(output,JSON.stringify(results,null,2)+'\n');
if(!results.every(r=>r.fullStyleExact&&r.frozenScreenCursorExact&&r.fullRngExact&&r.animationExact))process.exitCode=1;
