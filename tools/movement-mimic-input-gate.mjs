// Six locked keyboard inputs on generated maps. Native recording belongs to parent.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {M_AP_NOTHING,M_AP_OBJECT} from '../js/const.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {outputs,hash,hashes,deferred} from './half-damage-reader-observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
// BEGIN mandatory canonical C preflight. Metadata checks, not native replay.
const canonicalRoot = new URL('../', import.meta.url);
const canonicalSHA = bytes => createHash('sha256').update(bytes).digest('hex');
const canonicalRecipeBytes = readFileSync(new URL('tools/gen-sessions/recipes/movement-mimic-owner.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalRecipeBytes), 'aa9fc270ed88c59fd263e3472e7c7ca2206b1f7a286df10ebc4bb36b5ef465de', 'unchanged recording recipe');
const canonicalRecipe = JSON.parse(canonicalRecipeBytes);
const canonicalLockBytes = readFileSync(new URL('tools/gen-sessions/evidence/movement-mimic-owner/input-lock.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalLockBytes), 'e2d4a798c8e5748d7c66dc54e1d3f91501fdb892000831d2f2f22a04fd4f42a4', 'original final input lock');
const canonicalLock = JSON.parse(canonicalLockBytes);
assert.equal(canonicalLock.recipeSHA256, canonicalSHA(canonicalRecipeBytes));
assert.deepEqual(canonicalRecipe.segments, canonicalLock.segments);
assert.deepEqual(canonicalRecipe.branchRequirements, canonicalLock.branchRequirements);
assert.deepEqual(canonicalRecipe.unchangedOutputHashes, canonicalLock.negativeHashes);
const canonicalFields = ['name', 'seed', 'datetime', 'nethackrc', 'moves'];
const canonicalTuples = canonicalRecipe.segments.map(s => canonicalFields.map(field => ({field, present:Object.hasOwn(s,field), value:s[field]})));
assert.equal(canonicalSHA(JSON.stringify(canonicalTuples)), '693b1c294721626f8cef8261ea8bea799a8a7ea7e62a4753dd8b3fa238857ecf');
assert.equal(canonicalLock.tupleSHA256, canonicalSHA(JSON.stringify(canonicalTuples)));
assert.equal(canonicalRecipe.requireBranchAssertions, true);
assert.equal(canonicalRecipe.branches.length, 6);
assert.deepEqual(canonicalRecipe.branchAssertions.map(a => a.segment), [0, 1, 2, 3, 4, 5]);
const canonicalBytes = readFileSync(new URL('tools/gen-sessions/generated/movement-mimic-owner.session.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalBytes), '9e4d62808a0abe3042e54ad40866652252531ede8cddf38c56e29f5b95d1bcfa', 'locked canonical C raw');
assert.equal(canonicalBytes.length, 773661);
const canonicalNative = JSON.parse(canonicalBytes);
assert.equal(canonicalNative.source, 'c');
assert.equal(canonicalNative.version, 5);
assert.equal(canonicalNative.segments.length, 6);
assert.equal(canonicalRecipe.segments.length, 6);
assert.deepEqual(recordingIntegrityErrors(canonicalNative), [], 'canonical recording integrity');
assert.deepEqual(branchAssertionErrors(canonicalRecipe, canonicalNative), [], 'all six original primary branches');
for (let i = 0; i < 6; i++) {
    const actual = canonicalNative.segments[i], expected = canonicalRecipe.segments[i];
    for (const field of canonicalFields) {
        assert.ok(Object.hasOwn(expected, field), `recipe field presence ${i} ${field}`);
        assert.equal(Object.hasOwn(actual, field), Object.hasOwn(expected, field), `C field presence ${i} ${field}`);
        assert.deepEqual(actual[field], expected[field], `C field value ${i} ${field}`);
    }
    assert.deepEqual(actual.steps.map(step => step.key), [null, ...expected.moves], `every C key ${i}`);
}
assert.equal(canonicalRecipe.segments.reduce((n,s) => n + s.moves.length, 0), 216);
assert.equal(canonicalNative.segments.reduce((n,s) => n + s.steps.length, 0), 222);
// END mandatory canonical C preflight.
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/movement-mimic-owner.json',import.meta.url)));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(recipe.segments.length,6);
assert.equal(hash(recipe.segments.map(fields)),'693b1c294721626f8cef8261ea8bea799a8a7ea7e62a4753dd8b3fa238857ecf');
assert.deepEqual(branchAssertionErrors(recipe),[]);
const results=[],bound=setTimeout(()=>process.exit(2),55000);
for(const [i,part] of recipe.segments.entries()){
    const r={name:part.name,inputSHA256:hash(fields(part)),checks:[]},states=[];
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let out;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){if(!g.u||!g.level)return;
            states.push({step,xy:[g.u.ux,g.u.uy],turn:g.moves,hp:g.u.uhp,mh:g.u.mh,
                mortality:g.u.umortality||0,form:g.u.umonnum,ap:g.youmonst.m_ap_type||0,
                appearance:g.youmonst.mappearance,hidden:g.u.uundetected||0,
                run:g.context.run||0,multi:g.multi||0});
        }};
        out=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    }finally{if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);else delete globalThis.__step_snapshot;}
    Object.assign(r,{hashes:hashes(out),boundaries:out.screens.length,calls:out.calls.length,frames:out.frames.flat().length});
    async function check(name,fn){try{await fn();r.checks.push({name,pass:true});}catch(e){r.checks.push({name,pass:false,error:e.message.slice(0,550)});}}
    await check('source-derived primary branches and unaffected negative hashes',async()=>{
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
        assert.equal(out.screens.length,part.moves.length+1);assert.deepEqual(out.slices.flat(),out.calls);
        const req=recipe.branchRequirements[i];assert.equal(req.name,part.name);
        const before=states.find(s=>s.step===req.actionKey-1),after=states.find(s=>s.step===req.actionKey),last=states.at(-1);
        Object.assign(r,{before,after,final:last});
        assert.ok(states.every(s=>s.hp>0&&!s.mortality));
        assert.deepEqual(before.xy,req.beforeXY);assert.deepEqual(after.xy,req.finalXY);assert.deepEqual(last.xy,req.finalXY);
        assert.equal(before.form,PMNAMES.PM_SMALL_MIMIC);assert.equal(after.form,before.form);assert.equal(last.form,before.form);
        assert.equal(before.ap,req.disguisedBefore?M_AP_OBJECT:M_AP_NOTHING);
        assert.equal(after.ap,req.clearOnMove?M_AP_NOTHING:before.ap);
        assert.equal(after.appearance,before.appearance);assert.equal(after.hidden,0);
        assert.equal(after.hp,before.hp);assert.equal(after.mh,before.mh);
        assert.equal(last.run,0);assert.equal(last.multi,0);
        if(part.name==='blocked-preserve')assert.equal(after.turn,before.turn);
        else assert.ok(after.turn>before.turn,'ordinary movement/wait consumes time');
        const text=out.screens.map(s=>decodeScreen(s).map(row=>row.map(renderCell).join('').trimEnd()).join('\n'));
        if(req.rehide){
            const again=states.find(s=>s.step===44);
            assert.equal(again.ap,M_AP_OBJECT);assert.equal(again.appearance,ONAMES.STRANGE_OBJECT);
            assert.ok(again.turn>after.turn,'re-hiding is a fresh action');
            assert.match(text[44],/You are now mimicking a strange object\./);
        }else assert.equal(last.ap,after.ap);
        const generated={segments:[]};generated.segments[i]={steps:out.screens.map((screen,j)=>({screen,rng:out.slices[j]||[]}))};
        const branch=recipe.branchAssertions[i];
        assert.deepEqual(branchAssertionErrors({...recipe,branches:[branch.branch],branchAssertions:[branch]},generated),[]);
        if(req.negative)assert.deepEqual(r.hashes,recipe.unchangedOutputHashes[part.name],'all five unchanged negative fields');
    });
    await check('all-five observer neutrality',async()=>{assert.deepEqual(out,outputs(await runSegment({...part,storage:new InMemoryStorage()})));});
    await check('all-five deferred input and held EOF equality',async()=>{assert.deepEqual(out,await deferred(part));});
    r.pass=r.checks.every(c=>c.pass);results.push(r);
}
clearTimeout(bound);const report={classification:'six ordinary keyboard cases; worker performed no native comparison',
    cases:results.length,total:results.flatMap(r=>r.checks).length,passed:results.flatMap(r=>r.checks).filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,checks:r.checks.filter(c=>!c.pass)}))}));
if(report.passed!==report.total)process.exitCode=1;
