// Locked ordinary keyboard inputs. C recording and native comparison belong to parent.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {outputs,hash,hashes,deferred} from './half-damage-reader-observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
// BEGIN mandatory canonical C preflight. Metadata checks, not native replay.
const canonicalRoot = new URL('../', import.meta.url);
const canonicalSHA = bytes => createHash('sha256').update(bytes).digest('hex');
const canonicalRecipeBytes = readFileSync(new URL('tools/gen-sessions/recipes/invocation-message-owner.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalRecipeBytes), '4ff09eeee073ab87dcefb77a1fd5b1d5f76d209d06a5396ab77f6a801de8ed10', 'unchanged recording recipe');
const canonicalRecipe = JSON.parse(canonicalRecipeBytes);
const canonicalLockBytes = readFileSync(new URL('tools/gen-sessions/evidence/invocation-message-owner/input-lock.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalLockBytes), 'ca5b3e9408795be6a8953cf3588a2a82f158346cfdac43ae94aac8fd6c62c3ba', 'original final input lock');
const canonicalLock = JSON.parse(canonicalLockBytes);
assert.equal(canonicalLock.recipeSHA256, canonicalSHA(canonicalRecipeBytes));
assert.deepEqual(canonicalRecipe.segments, canonicalLock.segments);
assert.deepEqual(canonicalRecipe.branchRequirements, canonicalLock.branchRequirements);
assert.deepEqual(canonicalRecipe.unchangedOutputHashes, canonicalLock.negativeHashes);
const canonicalFields = ['name', 'seed', 'datetime', 'nethackrc', 'moves'];
const canonicalTuples = canonicalRecipe.segments.map(s => canonicalFields.map(field => ({field, present:Object.hasOwn(s,field), value:s[field]})));
assert.equal(canonicalSHA(JSON.stringify(canonicalTuples)), '7afc7e0665b98693f6d935340d0d17ee3b05c05dcc5411472ac418a309185feb');
assert.equal(canonicalLock.tupleSHA256, canonicalSHA(JSON.stringify(canonicalTuples)));
assert.equal(canonicalRecipe.requireBranchAssertions, true);
assert.equal(canonicalRecipe.branches.length, 4);
assert.deepEqual(canonicalRecipe.branchAssertions.map(a => a.segment), [0, 1, 2, 3]);
const canonicalBytes = readFileSync(new URL('tools/gen-sessions/generated/invocation-message-owner.session.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalBytes), 'a333e1d3d354f9f35c32c1fe6c8c2040eaf24b3a699e678ad996e9d6e4dda819', 'locked canonical C raw');
assert.equal(canonicalBytes.length, 2768201);
const canonicalNative = JSON.parse(canonicalBytes);
assert.equal(canonicalNative.source, 'c');
assert.equal(canonicalNative.version, 5);
assert.equal(canonicalNative.segments.length, 4);
assert.equal(canonicalRecipe.segments.length, 4);
assert.deepEqual(recordingIntegrityErrors(canonicalNative), [], 'canonical recording integrity');
assert.deepEqual(branchAssertionErrors(canonicalRecipe, canonicalNative), [], 'all four original primary branches');
for (let i = 0; i < 4; i++) {
    const actual = canonicalNative.segments[i], expected = canonicalRecipe.segments[i];
    for (const field of canonicalFields) {
        assert.ok(Object.hasOwn(expected, field), `recipe field presence ${i} ${field}`);
        assert.equal(Object.hasOwn(actual, field), Object.hasOwn(expected, field), `C field presence ${i} ${field}`);
        assert.deepEqual(actual[field], expected[field], `C field value ${i} ${field}`);
    }
    assert.deepEqual(actual.steps.map(step => step.key), [null, ...expected.moves], `every C key ${i}`);
}
assert.equal(canonicalRecipe.segments.reduce((n,s) => n + s.moves.length, 0), 171);
assert.equal(canonicalNative.segments.reduce((n,s) => n + s.steps.length, 0), 175);
// END mandatory canonical C preflight.
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/invocation-message-owner.json',import.meta.url)));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(recipe.segments.length,4);
assert.equal(hash(recipe.segments.map(fields)),'7afc7e0665b98693f6d935340d0d17ee3b05c05dcc5411472ac418a309185feb');
assert.deepEqual(branchAssertionErrors(recipe),[]);
const results=[],bound=setTimeout(()=>process.exit(2),55000);
for(const [i,part] of recipe.segments.entries()){
    const r={name:part.name,inputSHA256:hash(fields(part)),checks:[]},states=[];
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let out;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){if(!g.u||!g.level)return;
            states.push({step,xy:[g.u.ux,g.u.uy],turn:g.moves,hp:g.u.uhp,mortality:g.u.umortality||0,
                invocation:g.invocation_pos&&[g.invocation_pos.x,g.invocation_pos.y],uz:{...g.u.uz},
                uvibrated:g.u.uevent?.uvibrated||0,run:g.context.run||0,multi:g.multi||0,
                trap:g.level.traps.find(t=>t.tx===g.invocation_pos?.x&&t.ty===g.invocation_pos?.y)?.ttyp});
        }};
        out=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    }finally{if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);else delete globalThis.__step_snapshot;}
    Object.assign(r,{hashes:hashes(out),boundaries:out.screens.length,calls:out.calls.length,frames:out.frames.flat().length});
    async function check(name,fn){try{await fn();r.checks.push({name,pass:true});}catch(e){r.checks.push({name,pass:false,error:e.message.slice(0,550)});}}
    await check('primary causal branches and unaffected negative hashes',async()=>{
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
        assert.equal(out.screens.length,part.moves.length+1);assert.deepEqual(out.slices.flat(),out.calls);
        const req=recipe.branchRequirements[i],last=states.at(-1);r.final=last;
        assert.equal(req.name,part.name);assert.ok(states.every(s=>s.hp>0&&!s.mortality));
        assert.deepEqual(last.xy,req.finalXY);assert.equal(last.turn,req.finalTurn);assert.equal(last.uvibrated,req.uvibrated);
        assert.deepEqual(last.invocation,req.invocationXY);assert.deepEqual(last.uz,{dnum:1,dlevel:23});assert.equal(last.trap,23);
        assert.equal(last.run,0);assert.equal(last.multi,0);
        if(req.arrivalKey){const before=states.find(s=>s.step===req.arrivalKey-1),after=states.find(s=>s.step===req.arrivalKey);
            r.before=before;r.after=after;assert.equal(part.moves[req.arrivalKey-1],'h');
            assert.deepEqual(before.xy,req.approachXY);assert.equal(before.uvibrated,0);
            assert.deepEqual(after.xy,req.invocationXY);assert.equal(after.uvibrated,1);assert.equal(after.turn,before.turn+1);
        }
        const texts=out.screens.map(s=>decodeScreen(s).map(row=>row.map(renderCell).join('').trimEnd()).join('\n'));
        assert.match(texts.at(-1),/MacOS NetHack Version 5\.0\.0/);
        const generated={segments:[]};generated.segments[i]={steps:out.screens.map((screen,j)=>({screen,rng:out.slices[j]||[]}))};
        const branch=recipe.branchAssertions[i];
        assert.deepEqual(branchAssertionErrors({...recipe,branches:[branch.branch],branchAssertions:[branch]},generated),[]);
        if(req.negative)assert.deepEqual(r.hashes,recipe.unchangedOutputHashes[part.name],'all five unchanged negative fields');
    });
    await check('all-five observer neutrality',async()=>{assert.deepEqual(out,outputs(await runSegment({...part,storage:new InMemoryStorage()})));});
    await check('all-five deferred input and held EOF equality',async()=>{assert.deepEqual(out,await deferred(part));});
    r.pass=r.checks.every(c=>c.pass);results.push(r);
}
clearTimeout(bound);const report={classification:'four ordinary keyboard cases; native comparison not performed by worker',
    cases:results.length,total:results.flatMap(r=>r.checks).length,passed:results.flatMap(r=>r.checks).filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,checks:r.checks.filter(c=>!c.pass)}))}));
if(report.passed!==report.total)process.exitCode=1;
