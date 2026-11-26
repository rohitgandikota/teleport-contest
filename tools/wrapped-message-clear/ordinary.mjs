// Locked ordinary keyboard controls. Original C evidence is parent-owned.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {runSegment} from '../../js/jsmain.js';
import {InMemoryStorage} from '../../js/storage.js';
import {GLYPH_UNEXPLORED_OFF} from '../../js/const.js';
import {NO_COLOR} from '../../js/terminal.js';
import {outputs,hash,hashes,deferred} from '../half-damage-reader-observe.mjs';
import {branchAssertionErrors} from '../gen-sessions/assertions.mjs';

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const recipe=JSON.parse(readFileSync(new URL('../gen-sessions/recipes/wrapped-message-clear.json',import.meta.url)));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(hash(recipe.segments.map(fields)),'15cb38f510c228fe4bfae21fe86ee99811a789650ea38cfab6926002bfd779dd');
assert.deepEqual(branchAssertionErrors(recipe),[]);
const results=[],timer=setTimeout(()=>process.exit(2),55000);
for(const [i,part] of recipe.segments.entries()){
    const states=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let out;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            if(!g.u||!g.level)return;
            states.push({step,xy:[g.u.ux,g.u.uy],hp:g.u.uhp,turn:g.moves,
                curxy:[g._topl_curx??0,g._topl_cury??0],inread:g.ttyDisplay?.inread??0,
                frame:g.wsettings.map_frame_color,
                unknown:g.gbuf[0][70].disp_glyphnum,
                cell70:g.nhDisplay.grid[1][69].ch});
        }};
        out=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    }finally{
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    const req=recipe.branchRequirements[i],before=states.find(s=>s.step===req.beforeStep),after=states.find(s=>s.step===req.afterStep);
    const result={name:part.name,inputSHA256:hash(fields(part)),hashes:hashes(out),
        boundaries:out.screens.length,calls:out.calls.length,frames:out.frames.flat().length,
        before,after,final:states.at(-1),checks:[]};
    async function check(name,fn){try{await fn();result.checks.push({name,pass:true});}catch(e){result.checks.push({name,pass:false,error:e.message.slice(0,700)});}}
    await check('real producer, C cleanup branches and five-field negatives',async()=>{
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
        assert.equal(out.screens.length,part.moves.length+1);assert.deepEqual(out.slices.flat(),out.calls);
        assert.ok(states.every(s=>s.hp>0&&s.turn===1));
        assert.equal(before.curxy[1],req.wrapped?1:0);
        assert.equal(after.curxy[1],0,'C cleanup resets message row');
        assert.equal(after.unknown,GLYPH_UNEXPLORED_OFF);assert.equal(after.frame,NO_COLOR);
        assert.equal(after.cell70,req.expectedAfter);
        assert.deepEqual(states.at(-1).xy,req.finalXY);assert.equal(states.at(-1).inread,0);
        const generated={segments:[]};generated.segments[i]={steps:out.screens.map((screen,j)=>({screen,rng:out.slices[j]}))};
        const assertion=recipe.branchAssertions[i];
        assert.deepEqual(branchAssertionErrors({...recipe,branches:[assertion.branch],branchAssertions:[assertion]},generated),[]);
        if(req.negative)assert.deepEqual(result.hashes,recipe.unchangedOutputHashes[part.name]);
    });
    await check('all-five observer neutrality',async()=>assert.deepEqual(out,outputs(await runSegment({...part,storage:new InMemoryStorage()}))));
    await check('all-five deferred keys and held EOF equality',async()=>assert.deepEqual(out,await deferred(part)));
    result.pass=result.checks.every(c=>c.pass);results.push(result);
}
clearTimeout(timer);
const report={classification:'ordinary JS keyboard evidence, no native comparison',cases:5,total:15,
    passed:results.flatMap(r=>r.checks).filter(c=>c.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,checks:r.checks.filter(c=>!c.pass)}))}));
if(report.passed!==report.total)process.exitCode=1;
