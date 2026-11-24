// Strict native parity: all 24x80 rendered glyph/color/attr cells, including blanks.
// Complete streams, per-input slices, every frame and cursor are checked.
// Usage: node tools/passes-walls-consumers-native-gate.mjs [fixture] [report.json]
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
const bytes=readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/passes-walls-consumers.session.json',import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),
    'a7b566e0c2a9c360c929426541beecb55feef67ba559e80c32d669c92e6be3e1');
const fixture=JSON.parse(bytes),storage=new InMemoryStorage(),results=[];
// Strip callsite annotations only; never discard an unknown or extra entry.
const calls=list=>(list||[]).map(entry=>{
    const call=String(entry).replace(/\s*@\s.*$/,'').replace(/^\d+\s+/,'').trim();
    assert.match(call,/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/,'every RNG entry is a call');
    return call;
});
assert.equal(fixture.version,5);assert.equal(fixture.source,'c');
const recipe=JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/passes-walls-consumers.json',import.meta.url)));
assert.equal(fixture.segments.length,recipe.segments.length);
const nativeAssertions=[];
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
    for(const field of ['name','seed','datetime','nethackrc','moves'])
        assert.deepEqual(part[field],recipe.segments[segment][field],field);
    assert.equal(part.steps.length,part.moves.length+1);
    assert.equal(part.steps[0].key,null);
    assert.deepEqual(part.steps.slice(1).map(s=>s.key),Array.from(part.moves));
    const text=part.steps.map(s=>decodeScreen(s.screen).map(row=>row.map(c=>c.ch).join('')).join('\n'));
    const assertions=recipe.branchAssertions[segment];
    const witnesses=assertions.screenIncludes.map(message=>{
        const step=text.findIndex(screen=>screen.includes(message));
        assert.ok(step>=0,`${part.name}: native ${message}`);
        return {message,step};
    });
    for(const message of assertions.screenExcludes || [])
        assert.ok(!text.some(screen=>screen.includes(message)),`${part.name}: native excludes ${message}`);
    const native = recipe.branchAssertions[segment + 4];
    assert.equal(native.segment, segment);
    const evidence = native.nativeEvidence;
    const row = (step, y) => decodeScreen(part.steps[step].screen)[y]
        .map(cell => cell.ch).join('').trimEnd();
    const nativeWitnesses = native.screenIncludes.map(message => {
        const step = text.findIndex(screen => screen.includes(message));
        assert.ok(step >= 0, `${part.name}: native ${message}`);
        return {message, step};
    });
    for (const message of native.screenExcludes || [])
        assert.ok(!text.some(screen => screen.includes(message)), message);
    if (segment < 2) {
        const {triggerStep, ackStep, hpBefore, hpAfter, pwBefore, pwAfter, maxPwAfter} = evidence;
        assert.equal(part.steps[triggerStep].key, '\r');
        assert.equal(part.steps[ackStep].key, ' ');
        assert.ok(row(triggerStep - 1, 23).includes(`HP:${hpBefore}(12) Pw:${pwBefore}(7)`));
        assert.ok(row(triggerStep, 23).includes(`HP:${hpAfter}(12) Pw:${pwAfter}(${maxPwAfter})`));
        assert.deepEqual(part.steps[triggerStep].rng, native.rngIncludes,
            'complete native implosion and energy draws, in source order');
        assert.ok(row(triggerStep, 0).includes(native.screenIncludes[0] + '--More--'));
        assert.equal(row(ackStep, 0), native.screenIncludes[1]);
        assert.deepEqual(part.steps[ackStep].cursor, evidence.cursorAfterAck);
        assert.equal(nativeWitnesses[0].step, triggerStep);
        assert.equal(nativeWitnesses[1].step, ackStep);
    } else {
        assert.equal(part.steps[evidence.teleportStep].key, '.');
        assert.ok(row(evidence.teleportStep, 0).includes('You materialize in a different location!'));
        assert.deepEqual(part.steps[evidence.occupiedStep].cursor, evidence.occupiedCursor);
        if (segment === 2) {
            assert.ok(evidence.grantStep < evidence.teleportStep
                && evidence.teleportStep < evidence.repairStep);
            assert.ok(row(evidence.grantStep, 0).includes('Timeout for pass thru walls set to 30.'));
            assert.equal(row(evidence.repairStep, 0), native.screenIncludes[2]);
            assert.deepEqual(part.steps[evidence.repairStep].cursor, evidence.occupiedCursor);
        } else {
            for (const step of evidence.waitSteps) {
                assert.equal(part.steps[step].key, '.');
                assert.deepEqual(part.steps[step].cursor, evidence.occupiedCursor);
            }
        }
        assert.deepEqual(part.steps.flatMap((step, index) => step.animation_frames?.length
            ? [{step:index, count:step.animation_frames.length}] : []),
            [{step:evidence.frameStep, count:evidence.frames}]);
        assert.ok(evidence.frameStep < evidence.teleportStep, 'digging frames precede teleportation');
    }
    nativeAssertions.push({segment, branch:native.branch, witnesses, nativeWitnesses, evidence});
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
