// BEGIN mandatory canonical C preflight. Metadata only, before game imports.
import {createHash} from 'node:crypto';

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const canonicalRoot = new URL('../', import.meta.url);
const canonicalSHA = bytes => createHash('sha256').update(bytes).digest('hex');
const canonicalRecipeBytes = readFileSync(new URL('tools/gen-sessions/recipes/row-refresh-owner.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalRecipeBytes), '5ae0788985abccda96baf4e1c94106e7b6bf067c60782f11906ab7b271206351', 'unchanged recording recipe');
const canonicalRecipe = JSON.parse(canonicalRecipeBytes);
const canonicalLockBytes = readFileSync(new URL('tools/gen-sessions/evidence/row-refresh-owner/input-lock.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalLockBytes), '83356d2b8cd26371560325e2da949b51f12850449c5b818fdb9007f2f249bd58', 'original final input lock');
const canonicalLock = JSON.parse(canonicalLockBytes);
assert.equal(canonicalLock.recipeSHA256, canonicalSHA(canonicalRecipeBytes));
const canonicalFields = ['name', 'seed', 'datetime', 'nethackrc', 'moves'];
assert.deepEqual(canonicalLock.tupleFields, canonicalFields);
const canonicalTuples = canonicalRecipe.segments.map(s => canonicalFields.map(field => ({field, present:Object.hasOwn(s,field), value:s[field]})));
assert.equal(canonicalSHA(JSON.stringify(canonicalTuples)), 'eb01f6a7f477cb0c5214ce900b7935b5c8c733cae375a0053804d50584a962af');
assert.equal(canonicalLock.tupleSHA256, canonicalSHA(JSON.stringify(canonicalTuples)));
assert.equal(canonicalLock.cases, 7);
assert.equal(canonicalLock.keys, 158);
assert.equal(canonicalLock.boundaries, 165);
assert.equal(canonicalRecipe.requireBranchAssertions, true);
assert.equal(canonicalRecipe.segments.length, 7);
assert.equal(canonicalRecipe.branches.length, 7);
assert.equal(canonicalRecipe.branchAssertions.length, 7);
assert.deepEqual(canonicalRecipe.branchAssertions.map(a => a.segment), [0, 1, 2, 3, 4, 5, 6]);
const canonicalBytes = readFileSync(new URL('tools/gen-sessions/generated/row-refresh-owner.session.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalBytes), '7b1be02ec8062856a39860d4095c0ffdb5a25be97fdf5cdd7f01a3330e1587cf', 'locked canonical C raw');
assert.equal(canonicalBytes.length, 969822);
const canonicalNative = JSON.parse(canonicalBytes);
assert.equal(canonicalNative.source, 'c');
assert.equal(canonicalNative.version, 5);
assert.equal(canonicalNative.segments.length, 7);
assert.deepEqual(recordingIntegrityErrors(canonicalNative), [], 'canonical recording integrity');
assert.deepEqual(branchAssertionErrors(canonicalRecipe, canonicalNative), [], 'all seven original primary branches');
for (let i = 0; i < 7; i++) {
    const actual = canonicalNative.segments[i], expected = canonicalRecipe.segments[i];
    for (const field of canonicalFields) {
        assert.ok(Object.hasOwn(expected, field), `recipe field presence ${i} ${field}`);
        assert.equal(Object.hasOwn(actual, field), Object.hasOwn(expected, field), `C field presence ${i} ${field}`);
        assert.deepEqual(actual[field], expected[field], `C field value ${i} ${field}`);
    }
    assert.deepEqual(canonicalLock.segments[i], {name:expected.name, keys:expected.moves.length, tupleSHA256:canonicalSHA(JSON.stringify(canonicalTuples[i]))});
    assert.deepEqual(actual.steps.map(step => step.key), [null, ...expected.moves], `every C key ${i}`);
}
assert.equal(canonicalRecipe.segments.reduce((n,s) => n + s.moves.length, 0), 158);
assert.equal(canonicalNative.segments.reduce((n,s) => n + s.steps.length, 0), 165);
// END mandatory canonical C preflight.
// Locked ordinary keyboard inputs. Native recording/comparison belongs to parent.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {HI_ZAP,GLYPH_UNEXPLORED_OFF} = await import('../js/const.js');
const {NO_COLOR,ATR_INVERSE} = await import('../js/terminal.js');
const {cmap_names:CM} = await import('../js/drawing_data.js');
const {outputs,hash,hashes,deferred} = await import('./half-damage-reader-observe.mjs');
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/row-refresh-owner.json',import.meta.url)));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(recipe.segments.length,7);
assert.equal(hash(recipe.segments.map(fields)),'eb01f6a7f477cb0c5214ce900b7935b5c8c733cae375a0053804d50584a962af');
assert.deepEqual(branchAssertionErrors(recipe),[]);
const results=[],timer=setTimeout(()=>process.exit(2),55000);
for(const [i,part] of recipe.segments.entries()){
    const r={name:part.name,inputSHA256:hash(fields(part)),checks:[]},states=[];
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let out;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            if(!g.u||!g.level)return;
            const pet=g.level.monsters.find(m=>m.mtame);
            states.push({step,xy:[g.u.ux,g.u.uy],hp:g.u.uhp,mortality:g.u.umortality||0,
                bgcolors:g.iflags?.bgcolors??null,frame:g.wsettings?.map_frame_color??null,
                unknown:g.gbuf?.[0]?.[70]?.disp_glyphnum??GLYPH_UNEXPLORED_OFF,
                room:g.gbuf?.[2]?.[56]?.disp_glyph?.cmap??null,
                pet:pet?{xy:[pet.mx,pet.my],tame:pet.mtame,attr:g.nhDisplay.grid[pet.my+1][pet.mx-1].attr}:null});
        }};
        out=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    }finally{
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    Object.assign(r,{hashes:hashes(out),boundaries:out.screens.length,calls:out.calls.length,frames:out.frames.flat().length});
    async function check(name,fn){try{await fn();r.checks.push({name,pass:true});}catch(e){r.checks.push({name,pass:false,error:e.message.slice(0,750)});}}
    await check('actual producers, C branches, cleanup and all-five negatives',async()=>{
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
        assert.equal(out.screens.length,part.moves.length+1);assert.deepEqual(out.slices.flat(),out.calls);
        const req=recipe.branchRequirements[i];assert.equal(req.name,part.name);
        const menu=states.find(s=>s.step===req.menuStep),dismiss=states.find(s=>s.step===req.dismissStep),last=states.at(-1);
        Object.assign(r,{menu,dismiss,final:last});
        assert.ok(states.every(s=>s.hp>0&&!s.mortality));assert.deepEqual(last.xy,req.finalXY);
        if(i===2)assert.equal(dismiss.room,CM.S_room,'same U character has explored room identity');
        if(i===0)assert.equal(dismiss.unknown,GLYPH_UNEXPLORED_OFF);
        if(i>=3){
            assert.equal(menu.bgcolors,req.background);assert.equal(menu.frame,req.background?HI_ZAP:NO_COLOR);
            assert.equal(dismiss.frame,req.background?HI_ZAP:NO_COLOR);
            if(i>=5){
                const targeting=states.find(s=>s.step===31);
                assert.ok(targeting.pet?.tame);assert.equal(targeting.pet.attr,req.background?0:ATR_INVERSE);
                assert.equal(dismiss.pet.attr,req.background?0:ATR_INVERSE);
                assert.equal(last.pet.attr,ATR_INVERSE,'leaving getpos restores pet attribute');
            }
        }
        const generated={segments:[]};generated.segments[i]={steps:out.screens.map((screen,j)=>({screen,rng:out.slices[j]||[]}))};
        const branch=recipe.branchAssertions[i];
        assert.deepEqual(branchAssertionErrors({...recipe,branches:[branch.branch],branchAssertions:[branch]},generated),[]);
        if(req.negative)assert.deepEqual(r.hashes,recipe.unchangedOutputHashes[part.name],'five unchanged negative output fields');
    });
    await check('all-five observer neutrality',async()=>assert.deepEqual(out,outputs(await runSegment({...part,storage:new InMemoryStorage()}))));
    await check('all-five deferred input and held EOF equality',async()=>assert.deepEqual(out,await deferred(part)));
    r.pass=r.checks.every(c=>c.pass);results.push(r);
}
clearTimeout(timer);
const report={classification:'ordinary JS keyboard evidence; parent alone supplies native comparison',cases:results.length,total:results.flatMap(r=>r.checks).length,passed:results.flatMap(r=>r.checks).filter(c=>c.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,checks:r.checks.filter(c=>!c.pass)}))}));
if(report.passed!==report.total)process.exitCode=1;
