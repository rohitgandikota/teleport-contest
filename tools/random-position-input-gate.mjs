// Seven ordinary keyboard inputs; parent alone supplies native comparisons.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Levitation,Flying,Passes_walls} from '../js/youprop.js';
import {FROMOUTSIDE,I_SPECIAL,W_RINGL,W_AMUL,IS_OBSTRUCTED} from '../js/const.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {outputs,hash,hashes,deferred} from './half-damage-reader-observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
// BEGIN mandatory canonical C preflight. Metadata checks, not native replay.
const canonicalRoot = new URL('../', import.meta.url);
const canonicalSHA = bytes => createHash('sha256').update(bytes).digest('hex');
const canonicalRecipeBytes = readFileSync(new URL('tools/gen-sessions/recipes/random-position-owner.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalRecipeBytes), '7f7459f8941384ecdf004d80af7539d5f4beff769bbc3575d6535dd3d55500e7', 'unchanged recording recipe');
const canonicalRecipe = JSON.parse(canonicalRecipeBytes);
const canonicalLockBytes = readFileSync(new URL('tools/gen-sessions/evidence/random-position-owner/input-lock.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalLockBytes), '30c1155a1f95ba62b105df9c462420d67b1b7e8b2aa504fa1a1ec8cd7cd606e8', 'original final input lock');
const canonicalLock = JSON.parse(canonicalLockBytes);
assert.equal(canonicalLock.recipeSHA256, canonicalSHA(canonicalRecipeBytes));
assert.deepEqual(canonicalRecipe.segments, canonicalLock.segments);
const canonicalFields = ['name', 'seed', 'datetime', 'nethackrc', 'moves'];
assert.deepEqual(canonicalLock.tupleFields, canonicalFields);
const canonicalTuples = canonicalRecipe.segments.map(s => canonicalFields.map(field => ({field, present:Object.hasOwn(s,field), value:s[field]})));
assert.equal(canonicalSHA(JSON.stringify(canonicalTuples)), '158b7f3e5d8c524259ca0deb8d0a15fbdd2d6c2e46c23389546fab59e6a63d98');
assert.equal(canonicalLock.tupleSHA256, canonicalSHA(JSON.stringify(canonicalTuples)));
assert.equal(canonicalLock.cases, 7);
assert.equal(canonicalLock.keys, 517);
assert.equal(canonicalLock.boundaries, 524);
assert.equal(canonicalRecipe.requireBranchAssertions, true);
assert.equal(canonicalRecipe.branches.length, 7);
assert.equal(canonicalRecipe.branchAssertions.length, 7);
assert.deepEqual(canonicalRecipe.branchAssertions.map(a => a.segment), [0, 1, 2, 3, 4, 5, 6]);
const canonicalBytes = readFileSync(new URL('tools/gen-sessions/generated/random-position-owner.session.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalBytes), '1647efc2ac74c6d08288f86a494870c445fdf9f76491c5b329e51d26575c69ec', 'locked canonical C raw');
assert.equal(canonicalBytes.length, 1429971);
const canonicalNative = JSON.parse(canonicalBytes);
assert.equal(canonicalNative.source, 'c');
assert.equal(canonicalNative.version, 5);
assert.equal(canonicalNative.segments.length, 7);
assert.equal(canonicalRecipe.segments.length, 7);
assert.deepEqual(recordingIntegrityErrors(canonicalNative), [], 'canonical recording integrity');
assert.deepEqual(branchAssertionErrors(canonicalRecipe, canonicalNative), [], 'all seven original primary branches');
for (let i = 0; i < 7; i++) {
    const actual = canonicalNative.segments[i], expected = canonicalRecipe.segments[i];
    for (const field of canonicalFields) {
        assert.ok(Object.hasOwn(expected, field), `recipe field presence ${i} ${field}`);
        assert.equal(Object.hasOwn(actual, field), Object.hasOwn(expected, field), `C field presence ${i} ${field}`);
        assert.deepEqual(actual[field], expected[field], `C field value ${i} ${field}`);
    }
    assert.deepEqual(actual.steps.map(step => step.key), [null, ...expected.moves], `every C key ${i}`);
}
assert.equal(canonicalRecipe.segments.reduce((n,s) => n + s.moves.length, 0), 517);
assert.equal(canonicalNative.segments.reduce((n,s) => n + s.steps.length, 0), 524);
// END mandatory canonical C preflight.
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/random-position-owner.json',import.meta.url)));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(recipe.segments.length,7);
assert.equal(hash(recipe.segments.map(fields)),'158b7f3e5d8c524259ca0deb8d0a15fbdd2d6c2e46c23389546fab59e6a63d98');
assert.deepEqual(branchAssertionErrors(recipe),[]);
const results=[],bound=setTimeout(()=>process.exit(2),55000);
for(const [i,part] of recipe.segments.entries()){
    const r={name:part.name,inputSHA256:hash(fields(part)),checks:[]},states=[];
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let out;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){if(!g.u||!g.level)return;
            const u=g.u;states.push({step,xy:[u.ux,u.uy],level:[u.uz.dnum,u.uz.dlevel],typ:g.level.at(u.ux,u.uy).typ,
                turn:g.moves,hp:u.uhp,mh:u.mh,mortality:u.umortality||0,form:u.umonnum,
                water:u.uinwater||0,lev:Levitation(),fly:Flying(),passwall:Passes_walls(),
                blocked:[u.blocked?.LEVITATION||0,u.blocked?.FLYING||0],
                inventory:(g.invent||[]).map(o=>({typ:o.otyp,mask:o.owornmask||0}))});
        }};
        out=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    }finally{if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);else delete globalThis.__step_snapshot;}
    Object.assign(r,{hashes:hashes(out),boundaries:out.screens.length,calls:out.calls.length,frames:out.frames.flat().length});
    async function check(name,fn){try{await fn();r.checks.push({name,pass:true});}catch(e){r.checks.push({name,pass:false,error:e.message.slice(0,650)});}}
    await check('real producer, random arrival, C branches and negative hashes',async()=>{
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
        assert.equal(out.screens.length,part.moves.length+1);assert.deepEqual(out.slices.flat(),out.calls);
        const req=recipe.branchRequirements[i];assert.equal(req.name,part.name);
        const before=states.find(s=>s.step===req.actionKey-1),last=states.at(-1);
        Object.assign(r,{before,final:last});
        assert.ok(states.every(s=>s.hp>0&&!s.mortality));
        assert.equal(before.form,P.PM_XORN);assert.equal(last.form,P.PM_XORN);
        assert.ok(before.passwall&&last.passwall);assert.equal(before.water,0);assert.equal(last.water,0);
        assert.deepEqual(before.xy,req.beforeXY);assert.deepEqual(last.xy,req.finalXY);
        assert.deepEqual(last.level,req.finalLevel);assert.equal(last.typ,req.finalTerrain);
        assert.equal(last.hp,before.hp);assert.equal(last.mh,before.mh);
        assert.ok(last.inventory.some(o=>o.typ===(req.levitation?O.RIN_LEVITATION:O.AMULET_OF_FLYING)
            && (o.mask&(req.levitation?W_RINGL:W_AMUL))),'actual wished and worn equipment');
        if(part.name.includes('wall')){
            const wall=states.find(s=>s.step===req.wallKey);
            assert.deepEqual(wall.xy,[68,14]);assert.ok(IS_OBSTRUCTED(wall.typ));
            assert.ok(wall.blocked.every(b=>(b&FROMOUTSIDE)!==0));assert.equal(wall.lev,false);assert.equal(wall.fly,false);
        }else assert.equal(req.levitation?before.lev:before.fly,true);
        assert.deepEqual(last.blocked,[0,req.levitation?I_SPECIAL:0]);
        assert.equal(last.lev,req.levitation);assert.equal(last.fly,!req.levitation);
        const text=out.screens.map(s=>decodeScreen(s).map(row=>row.map(renderCell).join('').trimEnd()).join('\n'));
        if(!req.negative)assert.ok(text.slice(req.actionKey-1).some(s=>s.includes(req.levitation
            ?'You start to float in the air!':'You start flying.')),'restoration feedback belongs to arrival');
        const generated={segments:[]};generated.segments[i]={steps:out.screens.map((screen,j)=>({screen,rng:out.slices[j]||[]}))};
        const branch=recipe.branchAssertions[i];
        assert.deepEqual(branchAssertionErrors({...recipe,branches:[branch.branch],branchAssertions:[branch]},generated),[]);
        if(req.negative)assert.deepEqual(r.hashes,recipe.unchangedOutputHashes[part.name],'all five unaffected output fields');
    });
    await check('all-five observer neutrality',async()=>{assert.deepEqual(out,outputs(await runSegment({...part,storage:new InMemoryStorage()})));});
    await check('all-five deferred input and held EOF equality',async()=>{assert.deepEqual(out,await deferred(part));});
    r.pass=r.checks.every(c=>c.pass);results.push(r);
}
clearTimeout(bound);const report={classification:'ordinary JS keyboard evidence; no worker native comparison',
    cases:results.length,total:results.flatMap(r=>r.checks).length,passed:results.flatMap(r=>r.checks).filter(c=>c.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,checks:r.checks.filter(c=>!c.pass)}))}));
if(report.passed!==report.total)process.exitCode=1;
