// Four ordinary keyboard cases. Native recording and parity remain parent work.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {outputs,hashes,hash,deferred} from './half-damage-reader-observe.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
// BEGIN mandatory canonical C preflight. Integrity is not a native replay.
const canonicalSHA=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonicalRecipeBytes=readFileSync(new URL('gen-sessions/recipes/moving-engulfer-owner.json',import.meta.url));
assert.equal(canonicalSHA(canonicalRecipeBytes),'e71b70f072fda3d65a8f0a1ba9eb872583537df6aeca8d1560b2ad3288646114','primary recipe bytes');
const canonicalRecipe=JSON.parse(canonicalRecipeBytes);
const canonicalOriginalBytes=readFileSync(new URL('gen-sessions/evidence/moving-engulfer-owner/recording-recipe.json',import.meta.url));
assert.equal(canonicalSHA(canonicalOriginalBytes),'30d516914e33451b429ef1d18a26b6f18b0ba80169f2104e0b36a2d8a610aeac','original recording recipe bytes');
const canonicalOriginal=JSON.parse(canonicalOriginalBytes);
const {requireBranchAssertions,branches,branchAssertions,...canonicalOriginalFields}=canonicalRecipe;
assert.deepEqual(canonicalOriginalFields,canonicalOriginal,'all original recipe fields, requirements and negative hashes');
assert.equal(hash({requireBranchAssertions,branches,branchAssertions}),'ccb188022c3d16db1ae90478efdcdfa30ee5f78959a061b2cf1907d57f48445c','primary branch metadata');
assert.equal(requireBranchAssertions,true);assert.equal(branches.length,4);assert.equal(branchAssertions.length,4);
assert.deepEqual(branches,canonicalRecipe.segments.map(s=>'moving-engulfer.'+s.name));
assert.deepEqual(branchAssertions.map(a=>[a.branch,a.segment]),branches.map((branch,i)=>[branch,i]));
const canonicalLockBytes=readFileSync(new URL('gen-sessions/evidence/moving-engulfer-owner/input-lock.json',import.meta.url));
assert.equal(canonicalSHA(canonicalLockBytes),'e7b3be5c07f6f5e25fb4b77bc457b9f31cec6c8850f1d5906d1ace457056ce3f','original input lock bytes');
const canonicalLock=JSON.parse(canonicalLockBytes);
assert.equal(canonicalLock.recipeSHA256,canonicalSHA(canonicalOriginalBytes));
const canonicalFields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
const canonicalTuples=canonicalRecipe.segments.map(canonicalFields);
assert.equal(canonicalRecipe.segments.length,4);assert.equal(canonicalLock.segments,4);
assert.equal(hash(canonicalTuples),'df719db22a119d8f79df03d788bdf220a91b77d6545d41aa790997536ff29060','all five fields and presence');
assert.equal(canonicalLock.fieldsPresenceSHA256,hash(canonicalTuples));
assert.equal(canonicalLock.branchRequirementsSHA256,hash(canonicalRecipe.branchRequirements));
assert.equal(canonicalLock.negativeHashesSHA256,hash(canonicalRecipe.unchangedOutputHashes));
assert.equal(canonicalLock.segmentsSHA256.length,4);
// Only this installed canonical recording is accepted. No alternate path or selector.
const canonicalRawBytes=readFileSync(new URL('gen-sessions/generated/moving-engulfer-owner.session.json',import.meta.url));
assert.equal(canonicalSHA(canonicalRawBytes),'a61a564baa15cbd43f63f8440c2420bbb8de671b8390a50d9bc76d299827f229','exact canonical C raw bytes');
assert.equal(canonicalRawBytes.length,470887);
const canonicalNative=JSON.parse(canonicalRawBytes);
assert.equal(canonicalNative.source,'c');assert.equal(canonicalNative.version,5);assert.equal(canonicalNative.segments.length,4);
assert.deepEqual(canonicalNative.segments.map(canonicalFields),canonicalTuples,'C input field presence and values');
for(const [i,part]of canonicalNative.segments.entries()){
    const input=canonicalRecipe.segments[i],locked=canonicalLock.segmentsSHA256[i];
    assert.equal(locked.name,input.name);assert.equal(locked.fieldsSHA256,hash(canonicalFields(input)));
    assert.equal(locked.movesSHA256,canonicalSHA(Buffer.from(input.moves,'utf8')),'exact key bytes');
    assert.ok(Array.isArray(part.steps)&&part.steps.length,'C boundaries are mandatory');
    assert.deepEqual(part.steps.map(step=>step.key),[null,...input.moves],'every recorded key and initial boundary');
}
assert.equal(canonicalLock.keys,204);assert.equal(canonicalLock.boundaries,208);
assert.equal(canonicalNative.segments.reduce((n,s)=>n+s.moves.length,0),204);
assert.equal(canonicalNative.segments.reduce((n,s)=>n+s.steps.length,0),208);
assert.deepEqual(recordingIntegrityErrors(canonicalNative),[],'canonical recording integrity');
assert.deepEqual(branchAssertionErrors(canonicalRecipe,canonicalNative),[],'all four primary C branches');
// END mandatory canonical C preflight.
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/moving-engulfer-owner.json',import.meta.url)));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(recipe.segments.length,4);
assert.equal(hash(recipe.segments.map(fields)),'df719db22a119d8f79df03d788bdf220a91b77d6545d41aa790997536ff29060');
assert.equal(hash(recipe.branchRequirements),'0d55528250b580ad7ce4d6afd00bcb6d4b6c38782873395547213cfb0cc7bcb3');
assert.equal(hash(recipe.unchangedOutputHashes),'4daf51f97a3dca34811d2611d1afd07c2a4d818c06b06ed1ac8b487125aa3605');
const results=[],bound=setTimeout(()=>{console.error('55 second ordinary bound');process.exit(2);},55000);
for(const [i,part]of recipe.segments.entries()){
    const r={name:part.name,inputSHA256:hash(fields(part))},req=recipe.branchRequirements[i],states=[];
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    try{
        let output;
        try{
            globalThis.__step_snapshot={step:'*',cb(g,step){
                if(!g.u||!g.level)return;
                const u=g.u,m=u.ustuck;
                states.push({step,turn:g.moves,xy:[u.ux,u.uy],oldXY:[u.ux0,u.uy0],hp:u.uhp,mortality:u.umortality||0,
                    swallowed:!!u.uswallow,holder:m?{id:m.m_id,xy:[m.mx,m.my],species:m.mnum,hp:m.mhp,invisible:!!m.minvis,peaceful:!!m.mpeaceful}:null,
                    monster:g.level.monsters.filter(m=>m.mhp>0&&m.m_id===req.monsterID).map(m=>({id:m.m_id,xy:[m.mx,m.my],species:m.mnum,invisible:!!m.minvis,peaceful:!!m.mpeaceful,canmove:!!m.mcanmove}))});
            }};
            output=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        }finally{if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);else delete globalThis.__step_snapshot;}
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
        Object.assign(r,{hashes:hashes(output),boundaries:output.screens.length,calls:output.calls.length,frames:output.frames.flat().length,stateSHA256:hash(states)});
        assert.deepEqual(output,outputs(await runSegment({...part,storage:new InMemoryStorage()})),'all-five observer neutrality');r.observerNeutral=true;
        assert.deepEqual(output,await deferred(part),'all-five deferred delivery and held EOF');r.deferredNeutral=true;
        assert.equal(output.screens.length,part.moves.length+1);assert.deepEqual(output.slices.flat(),output.calls);
        const screens=output.screens.map(decodeScreen),text=screens.map(rows=>rows.map(row=>row.map(renderCell).join('').trimEnd()).join('\n'));
        const byStep=new Map(states.map(s=>[s.step,s])),inside=states.filter(s=>s.swallowed),last=states.at(-1);
        const moving=states.filter((s,j)=>j&&s.swallowed&&states[j-1].swallowed&&s.holder.id===states[j-1].holder.id&&hash(s.holder.xy)!==hash(states[j-1].holder.xy));
        Object.assign(r,{firstSwallowed:inside[0]||null,movingSteps:moving.map(s=>s.step),final:last});
        assert.equal(req.name,part.name);assert.ok(states.every(s=>s.hp===req.hp&&!s.mortality),'survival without HP loss at every boundary');
        assert.equal(last.turn,req.endTurn);assert.match(text.at(-1),/MacOS NetHack Version 5\.0\.0/);
        if(req.monsterID!==null){
            const created=states.find(s=>s.monster.length);r.created=created;
            assert.ok(created,'actual wizard monster creation is reached');
            assert.equal(created.monster[0].species,req.monsterSpecies);assert.equal(created.monster[0].invisible,req.invisible);assert.equal(created.monster[0].peaceful,req.peaceful);
            assert.ok(states.filter(s=>s.monster.length).every(s=>s.monster[0].canmove));
        }else assert.ok(states.every(s=>s.monster.length===0));
        assert.equal(inside.length>0,req.swallowedRequired);
        if(req.swallowedRequired){assert.equal(inside[0].step,req.firstSwallowedStep);assert.deepEqual(inside[0].xy,req.origin);assert.equal(inside[0].holder.id,req.monsterID);}
        if(req.positive){
            const step=req.moveStep,before=byStep.get(step-1),after=byStep.get(step);
            r.move={before,after};r.prefixHashes=hashes({screens:output.screens.slice(0,step),cursors:output.cursors.slice(0,step),calls:output.slices.slice(0,step).flat(),slices:output.slices.slice(0,step),frames:output.frames.slice(0,step)});
            assert.ok(moving.some(s=>s.step===step));assert.deepEqual(before.holder.xy,req.origin);assert.deepEqual(after.holder.xy,req.destination);
            assert.deepEqual(after.xy,req.destination,'hero follows ordinary moving engulfer');assert.deepEqual(after.oldXY,req.origin);
            for(const s of inside)assert.deepEqual(s.xy,s.holder.xy,'every swallowed input boundary shares monster position');
            const view=(at,xy)=>Array.from({length:3},(_,dy)=>Array.from({length:3},(_,dx)=>screens[at][xy[1]+dy][xy[0]+dx-2]));
            assert.deepEqual(view(step,req.destination),view(step-1,req.origin),'translated full styled stomach at actual input boundary');
            for(let yy=req.origin[1]-1;yy<=req.origin[1]+1;yy++)for(let xx=req.origin[0]-1;xx<=req.origin[0]+1;xx++)
                if(Math.abs(xx-req.destination[0])>1||Math.abs(yy-req.destination[1])>1)assert.equal(renderCell(screens[step][yy+1][xx-1]),' ','old stomach-only cells clear');
        }else{
            assert.equal(moving.length,0);assert.deepEqual(last.xy,req.endXY);
            assert.deepEqual(r.hashes,recipe.unchangedOutputHashes[part.name],'all-five matched negative outputs fixed');
            if(req.peaceful)assert.ok(new Set(states.flatMap(s=>s.monster.map(m=>hash(m.xy)))).size>1,'peaceful negative actually moves');
        }
        r.pass=true;
    }catch(e){r.pass=false;r.error=e.message.slice(0,450);}
    results.push(r);
}
clearTimeout(bound);
const report={classification:'four ordinary debug keyboard cases; real creation, engulfing and invisible movement',nativeParityClaimed:false,total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error})),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
