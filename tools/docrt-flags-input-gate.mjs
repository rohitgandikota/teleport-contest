// Ordinary-input reach through normal imports. New native evidence is separate.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Underwater, Blind, Swimming} from '../js/youprop.js';

const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/docrt-flags.json',import.meta.url)));
const input=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2])):recipe;
assert.equal(input.segments.length,8);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs=run=>({screens:hash(run.getScreens()),cursors:hash(run.getCursors()),
    rng:hash(run.getRngLog()),slices:hash(run.getRngSlices()),frames:hash(run.getAnimationFramesByStep())});
const reports=[];
for(const [index,part] of input.segments.entries()) {
    const expected=recipe.segments[index];
    for(const key of ['name','seed','datetime','nethackrc','moves'])
        assert.deepEqual(part[key],expected[key],`unchanged ${part.name} ${key}`);
    if(part.steps?.length){
        assert.equal(input.source,'c');assert.equal(input.version,5);
        assert.equal(part.steps.length,part.moves.length+1);assert.equal(part.steps[0].key,null);
        assert.deepEqual(part.steps.slice(1).map(s=>s.key),Array.from(part.moves));
    }
    const states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            let outside=0,heroGlyphs=0;
            const grid=g.nhDisplay.grid,u=g.u;
            for(let y=0;y<21;y++)for(let x=1;x<80;x++){
                if(Math.max(Math.abs(x-u.ux),Math.abs(y-u.uy))>1&&grid[y+1][x-1].ch!==' ')outside++;
                if(g.gbuf?.[y]?.[x]?.disp_glyph?.kind==='hero')heroGlyphs++;
            }
            states.push({step,underwater:Underwater(),blind:Blind(),swimming:Swimming(),
                swallowed:!!u.uswallow,inDocrt:!!g.program_state.in_docrt,outside,heroGlyphs,
                terrainmode:g.iflags?.terrainmode||0,top:grid[0].map(c=>c.ch).join('').trimEnd()});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const hashes=outputs(run),redraw=part.moves.lastIndexOf('\x12');
    const before=states.find(s=>s.step===redraw),after=states.find(s=>s.step===redraw+1);
    const unobserved=await runSegment({...part,storage:new InMemoryStorage()});
    await test(`${part.name}: complete boundaries and read-only observer`,()=>{
        assert.equal(run.getScreens().length,part.moves.length+1);
        assert.deepEqual(hashes,outputs(unobserved));assert.ok(states.every(s=>!s.inDocrt));
    });
    await test(`${part.name}: source-derived branch reach`,()=>{
        if(index===0||index===2){
            assert.equal(before.underwater,true);assert.equal(after.underwater,true);
            assert.equal(before.outside,0);assert.equal(after.outside,0);
            if(index===2){assert.equal(before.blind,true);assert.equal(before.swimming,true);}
        }else if(index===1){
            assert.equal(before.underwater,false);assert.equal(after.underwater,false);
            assert.ok(before.outside>0);assert.equal(after.outside,before.outside);
        }else if(index===3){
            assert.equal(before.swallowed,true);assert.equal(after.swallowed,true);
            assert.equal(after.outside,0);
        }else if(index===4){
            assert.equal(before.terrainmode,17);assert.equal(after.terrainmode,17);
            assert.equal(before.heroGlyphs,0);assert.equal(after.heroGlyphs,0);
            assert.equal(after.outside,before.outside);assert.ok(after.outside>100);
            assert.match(after.top,/Move cursor to anything of interest/);
        }else if(index===5){
            assert.equal(redraw,-1);assert.ok(states.some(s=>s.terrainmode===17&&s.heroGlyphs===0));
            assert.equal(states.at(-1).terrainmode,0);
        }else if(index===6){
            assert.equal(before.top,'In what direction?');assert.equal(after.top,'In what direction?');
        }else{
            assert.equal(redraw,-1);assert.ok(states.some(s=>s.top==='In what direction?'));
            assert.doesNotMatch(states.at(-1).top,/Invalid direction/);
        }
    });
    reports.push({name:part.name,boundaries:run.getScreens().length,calls:run.getRngLog().length,
        frames:run.getAnimationFramesByStep().flat().length,hashes,before,after});
}
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify({evidence:'ordinary JS reach only',reports},null,2)+'\n');
