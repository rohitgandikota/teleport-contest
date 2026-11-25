// Current-repository gate with mandatory exact canonical C/input preflight.
// Native output comparison remains a separate parent check.
// Usage: node tools/forcefight-input-gate.mjs [compact-report.json]
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {IRONBARS,WEB} from '../js/const.js';
import {ONAMES as O} from '../js/objects_data.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {outputs,hashes,hash,deferred} from './half-damage-reader-observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/forcefight-owner.json',import.meta.url)));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(recipe.segments.length,16);
assert.equal(hash(recipe.segments.map(fields)),'750d9a4ae29445615e31d4ff8a9ab7b06c178a81c540445a20437f326724fbab');
assert.equal(hash(recipe.unchangedOutputHashes),'3379875658f91b377f46258e336a0ee040e12e1a1e130f972815b32562c9ac8a');
assert.equal(hash(recipe.branchRequirements),'7fd78aa031d49e3d718f5a2df7a2fdd2fecdf11147c9fdfc069aedfe783db892');
assert.equal(recipe.branches.length,16);assert.equal(recipe.branchAssertions.length,16);
assert.equal(recipe.requireBranchAssertions,true);
// Read the installed canonical bytes unchanged. No baseline or raw-path override.
const nativeBytes=readFileSync(new URL('gen-sessions/generated/forcefight-owner.session.json',import.meta.url));
const nativeSHA256=createHash('sha256').update(nativeBytes).digest('hex');
assert.equal(nativeSHA256,'ee7b48ab9b0db9ea36c252d40e01260610177d13f2a6a71735df7bfdd7a000ca',
    'canonical native recording must preserve the exact parent raw bytes');
assert.equal(nativeBytes.length,2313875);
const native=JSON.parse(nativeBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);assert.equal(native.segments.length,16);
assert.deepEqual(native.segments.map(fields),recipe.segments.map(fields),'all five input fields and presence');
for(const part of native.segments){
    assert.ok(part.steps?.length,'recorded native boundaries are mandatory');
    assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves],'every recorded input key is fixed');
}
assert.deepEqual(recordingIntegrityErrors(native),[],'native recording integrity');
assert.deepEqual(recipe.branches,recipe.branchRequirements.map(r=>r.branch));
assert.deepEqual(recipe.branchAssertions.map(a=>[a.branch,a.segment]),recipe.branches.map((branch,i)=>[branch,i]));
for(const [i,requirement] of recipe.branchRequirements.entries()){
    assert.equal(requirement.name,recipe.segments[i].name);
    assert.deepEqual(recipe.branchAssertions[i].screenIncludes,[requirement.message,'MacOS NetHack Version 5.0.0']);
}
assert.deepEqual(branchAssertionErrors(recipe,native),[],'all sixteen C branch assertions');
const nativeIntegrity={rawSHA256:nativeSHA256,sourceCVersion5:true,inputFieldsAndKeysExact:true,
    recordingIntegrity:true,branches:16,negativeControls:4,nativeParityClaimed:false};
const results=[],timer=setTimeout(()=>{console.error('55 second ordinary-worker bound');process.exit(2);},55000);
for(const [index,part] of recipe.segments.entries()) {
    const states=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const r={name:part.name,inputSHA256:hash(fields(part))};let output;
    try {
        try {globalThis.__step_snapshot={step:'*',cb(g,step){if(!g.u||!g.level)return;
            const t=g.level.traps.find(t=>t.tx===51&&t.ty===18);
            states.push({step,xy:[g.u.ux,g.u.uy],hp:g.u.uhp,mortality:g.u.umortality||0,
                terrain:g.level.at(51,18).typ,trap:t?{type:t.ttyp,seen:!!t.tseen}:null,
                wield:g.u.uwep?{type:g.u.uwep.otyp,quan:g.u.uwep.quan,spe:g.u.uwep.spe,artifact:g.u.uwep.oartifact||0}:null,
                conduct:g.u.uconduct?.weaphit||0});}};
            output=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        }finally{if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);else delete globalThis.__step_snapshot;}
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
        assert.deepEqual(output,outputs(await runSegment({...part,storage:new InMemoryStorage()})),'all-five observer neutrality');
        r.observerNeutral=true;
        assert.deepEqual(output,await deferred(part),'all-five deferred input and held EOF');r.deferredNeutral=true;
        assert.equal(output.screens.length,part.moves.length+1);assert.deepEqual(output.slices.flat(),output.calls);
        const tops=output.screens.map(s=>decodeScreen(s).slice(0,2).map(row=>row.map(renderCell).join('').trimEnd()).join(' '));
        const requirement=recipe.branchRequirements[index],last=states.at(-1),top=tops.join('\n');
        assert.equal(requirement.name,part.name);assert.equal(requirement.branch,recipe.branches[index]);
        assert.equal(recipe.branchAssertions[index].branch,requirement.branch);assert.equal(recipe.branchAssertions[index].segment,index);
        assert.deepEqual(recipe.branchAssertions[index].screenIncludes,[requirement.message,'MacOS NetHack Version 5.0.0']);
        assert.match(tops.at(-1),/MacOS NetHack Version 5\.0\.0/);assert.ok(states.every(s=>s.hp>0&&!s.mortality),'survival');
        const hit=part.moves.indexOf('Fh'),before=states.find(s=>s.step===hit+1);
        if(hit>=0){assert.ok(before);assert.deepEqual(before.xy,[52,18]);r.ownerInputBoundary=hit+1;}
        if(part.name.startsWith('bars-')) {
            assert.ok(states.some(s=>s.terrain===IRONBARS),'real terrain wish');
            assert.deepEqual(last.xy,[52,18]);assert.equal(last.terrain===IRONBARS,part.name!=='bars-acid');
            if(hit>=0)assert.equal(before.terrain,IRONBARS);
            if(part.name==='bars-mirror-single'||part.name==='bars-acid'){
                assert.ok(before.wield);assert.equal(last.wield,null);
            }else if(part.name==='bars-potion-stack'){
                assert.deepEqual([before.wield.type,before.wield.quan],[O.POT_WATER,2]);
                assert.deepEqual([last.wield.type,last.wield.quan],[O.POT_WATER,1]);
            }else if(part.name==='bars-unarmed-negative'){
                assert.equal(before.wield,null);assert.equal(last.wield,null);
            }else if(part.name==='bars-unforced-negative'){
                assert.equal(last.wield.type,O.MIRROR);assert.equal(last.wield.quan,1);
                assert.ok(states.some(s=>s.xy[0]===51&&s.terrain===IRONBARS));
                assert.ok(!top.includes('shatters'));assert.ok(!top.includes('attack the iron bars'));
            }else assert.deepEqual(last.wield,before.wield);
        } else if(part.name.startsWith('web-')) {
            assert.equal(before.trap?.type,WEB,'real trap wish before force-fight');assert.deepEqual(last.xy,[52,18]);
            const unseen=part.name==='web-unseen-negative';assert.equal(before.trap.seen,!unseen);
            const remains=unseen||part.name==='web-dagger-failure'||part.name==='web-nonblade';
            assert.equal(!!last.trap,remains);assert.equal(last.conduct,before.conduct);
            assert.deepEqual(last.wield,before.wield);
            if(part.name==='web-bare')assert.equal(before.wield,null);
            if(part.name==='web-sting'||part.name==='web-fire-brand')assert.ok(before.wield.artifact);
            if(part.name==='web-axe')assert.equal(before.wield.type,O.AXE);
        } else {
            assert.equal(part.name,'floor-negative');assert.deepEqual(last.xy,[51,18]);assert.equal(last.wield.type,O.DAGGER);
        }
        assert.ok(top.includes(requirement.message),'source branch output: '+requirement.message);
        const actual=hashes(output);
        if(recipe.unchangedOutputHashes[part.name])assert.deepEqual(actual,recipe.unchangedOutputHashes[part.name],'all five negative outputs');
        Object.assign(r,{pass:true,boundaries:output.screens.length,calls:output.calls.length,
            frames:output.frames.flat().length,hashes:actual});
    } catch(error){Object.assign(r,{pass:false,error:error.message.slice(0,900)});}
    results.push(r);
}
clearTimeout(timer);
const report={classification:'12 ordinary positives and four negatives, fixed real keyboard producers',nativeParityClaimed:false,
    nativeIntegrity,total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,nativeBranches:nativeIntegrity.branches,
    firstFailure:results.find(r=>!r.pass)||null}));
if(report.passed!==report.total)process.exitCode=1;
