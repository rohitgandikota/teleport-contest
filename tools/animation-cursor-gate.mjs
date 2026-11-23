#!/usr/bin/env node
// Compare frame counts, decoded animation cells and exact cursor triples.
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {normalizeSession} from '../frozen/session_loader.mjs';
import {decodeScreen, diffCell} from '../frozen/screen-decode.mjs';
const paths = process.argv.slice(2);
if (!paths.length) {
    console.error('Usage: node tools/animation-cursor-gate.mjs <session.json> [...]');
    process.exit(2);
}
for(const path of paths) {
    const input=normalizeSession(JSON.parse(fs.readFileSync(path))), storage=new InMemoryStorage();
    const counts={expected:0,actual:0,cells:0,cursors:0,countMismatches:0,boundaryCursors:0,boundaries:0},errors=[];
    for(const [segment,part] of input.segments.entries()) {
        const result=await runSegment({...part,storage}), frames=result.getAnimationFramesByStep();
        for(let step=0;step<part.steps.length;step++) {
            const c=part.steps[step].animation_frames||[],j=frames[step]||[];
            counts.boundaries++;
            const cb=part.steps[step].cursor,jb=result.getCursors()[step];
            if(JSON.stringify(cb)===JSON.stringify(jb))counts.boundaryCursors++;
            else if(errors.length<50)errors.push({segment,step,kind:'boundary-cursor',c:cb,js:jb});
            counts.expected+=c.length;counts.actual+=j.length;
            if(c.length!==j.length){counts.countMismatches++;if(errors.length<50)errors.push({segment,step,kind:'count',c:c.length,js:j.length});}
            for(let f=0;f<c.length;f++) {
                if(!j[f])continue;
                const cg=decodeScreen(c[f].screen),jg=decodeScreen(j[f].screen);
                const match=cg.every((row,y)=>row.every((cell,x)=>!diffCell(cell,jg[y][x])));
                const cursor=JSON.stringify(c[f].cursor)===JSON.stringify(j[f].cursor);
                counts.cells+=+match;counts.cursors+=+cursor;
                if((!match||!cursor)&&errors.length<50)errors.push({segment,step,frame:f,match,cursor,c:c[f].cursor,js:j[f].cursor});
            }
        }
    }
    console.log(JSON.stringify({path,...counts,errors}));
    if (counts.actual !== counts.expected || counts.cells !== counts.expected
        || counts.cursors !== counts.expected || counts.countMismatches
        || counts.boundaryCursors !== counts.boundaries)
        process.exitCode = 1;
}
