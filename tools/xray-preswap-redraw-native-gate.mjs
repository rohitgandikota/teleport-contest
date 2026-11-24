// Strict native parity for the unchanged parent C recording.
// Every rendered 24x80 cell includes glyph, color and attributes, including blanks.
// Usage: node tools/xray-preswap-redraw-native-gate.mjs [fixture] [report.json]
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const bytes = readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/xray-preswap-redraw.session.json', import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '34ff8ac1db3e8d2b0bd0c8326ce7b1795d8c994e52bd9228392b7eb8e7be7138');
const fixture = JSON.parse(bytes), results = [];
const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/xray-preswap-redraw.json', import.meta.url)));
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
    assert.equal(part.steps.length, [93, 87, 78, 102][index]);
    assert.equal(part.steps.flatMap(s => calls(s.rng)).length, [2393, 2371, 2239, 2685][index]);
    assert.ok(part.steps.every(s => (s.animation_frames || []).length === 0));
    const wear = part.moves.indexOf('Pa') + 2;
    assert.equal(part.steps[wear - 1].key, 'P');
    assert.equal(part.steps[wear].key, 'a');
    assert.match(top(part.steps[wear - 1]), /^What do you want to put on/);
    assert.equal(top(part.steps[wear]), index === 2
        ? 'You are now wearing a pair of lenses.'
        : 'You are now wearing a pair of lenses named the Eyes of the Overworld.');
    const drop = part.steps.findIndex(s => top(s) === 'You drop a rock.');
    const effect = part.steps.findIndex(s => top(s) === (index === 1
        ? 'This tastes like water.' : 'Oh wow!  Everything looks so cosmic!'));
    assert.ok(drop > wear && effect > drop, 'native wear, drop and potion order');
    const rogue = part.steps.some(s => top(s).includes(
        'You enter what seems to be an older, more primitive world.'));
    assert.equal(rogue, index === 3);
    const end = part.steps.length - 1;
    assert.deepEqual(part.steps.slice(-3).map(s => s.key), ['h', 'l', '\x12']);
    assert.deepEqual(part.steps[end].rng, [], 'native redraw logs no core calls');
    assert.deepEqual(part.steps[end].cursor, part.steps[end - 1].cursor);
    if (index === 0) {
        assert.deepEqual(part.steps[90].cursor, [9, 14, 1]);
        assert.deepEqual(part.steps[91].cursor, [10, 14, 1]);
        assert.deepEqual(cell(part.steps[90], 17, 13), [')', 15, 0]);
        assert.deepEqual(cell(part.steps[90], 9, 14), ['@', 15, 0]);
        assert.deepEqual(cell(part.steps[91], 9, 14), [')', 8, 0]);
        assert.deepEqual(cell(part.steps[92], 9, 14), ['=', 8, 0]);
    } else if (index === 1) {
        for (const step of [83, 85, 86])
            assert.deepEqual(cell(part.steps[step], 9, 14), ['*', 8, 0],
                'native sane rock keeps its ordinary glyph');
    }
    nativeAssertions.push({name: part.name, wearBoundary: wear,
        nativeWearMessage: top(part.steps[wear]), dropBoundary: drop,
        effectBoundary: effect, nativeEffectMessage: top(part.steps[effect]),
        rogueMessage: rogue, tailKeys: part.steps.slice(-3).map(s => s.key),
        redrawBoundary: end, redrawCoreCalls: 0});
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
