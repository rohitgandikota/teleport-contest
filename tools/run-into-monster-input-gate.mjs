// Current-repository gate with mandatory exact canonical C/input preflight.
// Integrity is separate from native replay and native improvement attribution.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Blind} from '../js/youprop.js';
import {mon_visible,sensemon,is_safemon} from '../js/display.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ART_EYES_OF_THE_OVERWORLD} from '../js/artilist_data.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {outputs,hashes,hash,deferred} from './half-damage-reader-observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/run-into-monster-owner.json',import.meta.url)));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(recipe.segments.length,4);
assert.equal(hash(recipe.segments.map(fields)),'3879beb652c0590fd6e8e6cf94eb7d2483e44a7bd7583010c0c7b601c2f4cb5c');
assert.equal(hash(recipe.branchRequirements),'ba9000daaa3bd2081eb2ea6e24f46fd81de3cc32f8c522f71529b2d4a4969f1a');
assert.equal(hash(recipe.unchangedOutputHashes),'2b20d88cc0f3364ccec38bbe6eaa91c01fa2437c6962a85ef6c9293683224f89');
// Preserve every original recipe field; only the four native branch claims are added.
const originalBytes=readFileSync(new URL('gen-sessions/evidence/run-into-monster-owner/recording-recipe.json',import.meta.url));
assert.equal(createHash('sha256').update(originalBytes).digest('hex'),
    'b5fa6a04bdea65c3a5790c591855ff40bac4352384560cff058ee0b7998c66b6','original recording recipe bytes');
const {requireBranchAssertions,branches,branchAssertions,...originalFields}=recipe;
assert.deepEqual(originalFields,JSON.parse(originalBytes),'original recipe, state requirements and negative hashes');
assert.equal(hash({requireBranchAssertions,branches,branchAssertions}),
    '5d81530960ecf82c3dd26574b2a2b3e7e4ecc53d2045695d32b976e7c32545a4','derived C branch metadata');
assert.equal(requireBranchAssertions,true);assert.equal(branches.length,4);assert.equal(branchAssertions.length,4);
assert.deepEqual(branches,recipe.segments.map(s=>'run-into-monster.'+s.name));
assert.deepEqual(branchAssertions.map(a=>[a.branch,a.segment]),branches.map((branch,i)=>[branch,i]));
// Installed canonical raw bytes are mandatory. There is no alternate raw-path option.
const nativeBytes=readFileSync(new URL('gen-sessions/generated/run-into-monster-owner.session.json',import.meta.url));
const rawSHA256=createHash('sha256').update(nativeBytes).digest('hex');
assert.equal(rawSHA256,'9341aa8eb7b9046c1c2815465bba48cd7c0bf2b48cccb8b39be10c2cbc4f10b1',
    'canonical native recording must preserve the exact parent raw bytes');
assert.equal(nativeBytes.length,606766);
const native=JSON.parse(nativeBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);assert.equal(native.segments.length,4);
assert.deepEqual(native.segments.map(fields),recipe.segments.map(fields),'all five input fields and presence');
for(const part of native.segments){
    assert.ok(part.steps?.length,'recorded native boundaries are mandatory');
    assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves],'every recorded key is fixed');
}
assert.deepEqual(recordingIntegrityErrors(native),[],'native recording integrity');
assert.deepEqual(branchAssertionErrors(recipe,native),[],'all four C branch assertions');
const nativeIntegrity={rawSHA256,sourceCVersion5:true,inputFieldsAndKeysExact:true,
    recordingIntegrity:true,branches:4,boundaries:native.segments.reduce((n,s)=>n+s.steps.length,0),
    keys:native.segments.reduce((n,s)=>n+s.moves.length,0),nativeParityClaimed:false};
assert.equal(nativeIntegrity.boundaries,255);assert.equal(nativeIntegrity.keys,251);
const results=[],bound=setTimeout(()=>{console.error('55 second ordinary bound');process.exit(2);},55000);
for(const [i,part]of recipe.segments.entries()){
    const r={name:part.name,inputSHA256:hash(fields(part))},states=[];
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    try{
        let output;
        try{
            globalThis.__step_snapshot={step:'*',cb(g,step){if(!g.u||!g.level)return;
                const mon=g.level.monsters.find(m=>m.mnum===P.PM_NEWT&&m.mhp>0);
                states.push({step,xy:[g.u.ux,g.u.uy],origin:[g.u.ux0,g.u.uy0],target:g.bhitpos&&{...g.bhitpos},turn:g.moves,hp:g.u.uhp,mortality:g.u.umortality||0,
                    run:g.context.run,blind:Blind(),cached:!!g.u.ublind,cream:g.u.ucreamed||0,timeout:g.u.intrinsic?.HBlinded||0,
                    blocked:g.u.blocked?.BLINDED||0,artifact:g.u.ublindf?.oartifact||0,
                    mon:mon&&{id:mon.m_id,xy:[mon.mx,mon.my],hp:mon.mhp,sleeping:!!mon.msleeping,
                        safe:is_safemon(mon),visible:mon_visible(mon),sensed:sensemon(mon)}});
            }};
            output=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
        Object.assign(r,{hashes:hashes(output),boundaries:output.screens.length,calls:output.calls.length,frames:output.frames.flat().length});
        assert.deepEqual(output,outputs(await runSegment({...part,storage:new InMemoryStorage()})),'all-five observer neutrality');r.observerNeutral=true;
        assert.deepEqual(output,await deferred(part),'all-five deferred delivery and held EOF');r.deferredNeutral=true;
        assert.equal(output.screens.length,part.moves.length+1);assert.deepEqual(output.slices.flat(),output.calls);
        const req=recipe.branchRequirements[i],before=states.find(s=>s.step===req.runKey),after=states.find(s=>s.step===req.runKey+1),last=states.at(-1);
        r.before=before;r.after=after;r.final={xy:last.xy,turn:last.turn,hp:last.hp,mon:last.mon};
        const texts=output.screens.map(s=>decodeScreen(s).map(row=>row.map(renderCell).join('').trimEnd()).join('\n'));
        assert.equal(req.name,part.name);assert.equal(part.moves[req.runKey-1],'G');assert.ok(states.every(s=>s.hp>0&&!s.mortality),'hero survival');
        assert.equal(before.run,3);assert.deepEqual(before.xy,req.startXY);assert.deepEqual(before.mon.xy,req.targetXY);
        assert.ok(before.mon.hp>0&&before.mon.sleeping);assert.equal(before.mon.safe,false);assert.equal(before.mon.visible,true);assert.equal(before.mon.sensed,false);
        assert.equal(before.blind,req.blind);assert.equal(!!before.cream,req.cream);assert.equal(before.artifact===ART_EYES_OF_THE_OVERWORLD,req.eyes);
        if(req.eyes)assert.ok(before.blocked);if(req.cream)assert.ok(before.timeout>0);
        assert.deepEqual(last.xy,req.finalXY);assert.equal(last.turn,req.finalTurn,'canonical guard costs no turn; unseen bump costs one');
        assert.equal(after.turn,before.turn+(req.stops?0:1));assert.equal(after.run,0);
        if(req.stops){
            assert.deepEqual(after.mon,before.mon,'early guard leaves actual target alive, sleeping and untouched');
            assert.deepEqual(after.origin,before.origin);assert.deepEqual(after.target,before.target);
            assert.deepEqual(last.mon,before.mon);assert.ok(!texts.join('\n').includes('You kill the newt!'));
        }else{assert.ok(after.mon.hp>0);assert.equal(after.mon.sleeping,false);assert.match(texts.join('\n'),/Wait!  There's something there you can't see!/);}
        assert.match(texts.at(-1),/MacOS NetHack Version 5\.0\.0/);
        if(req.negative)assert.deepEqual(r.hashes,recipe.unchangedOutputHashes[part.name],'three original all-five negatives');
        r.pass=true;
    }catch(e){r.pass=false;r.error=e.message.slice(0,450);}
    results.push(r);
}
clearTimeout(bound);
const report={nativeIntegrity,classification:'four ordinary debug keyboard cases',nativeParityClaimed:false,total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>r.name),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
