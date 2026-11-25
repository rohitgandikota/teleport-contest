// Current-repository gate with mandatory exact canonical C/input preflight.
// Native replay attribution is separate from recording integrity.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {P_RIDING,P_UNSKILLED,P_BASIC,W_SADDLE} from '../js/const.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {outputs,hashes,hash,deferred} from './half-damage-reader-observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/mounted-movement-owner.json',import.meta.url)));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(recipe.segments.length,6);
assert.equal(hash(recipe.segments.map(fields)),'c7f6567e104fa4add297f88f8c2b2654625cb67e31ae583d7613c6cead735d6a');
assert.equal(hash(recipe.branchRequirements),'175bcdf2c825563ba4077bfdff2be3b6e9bc4075b02e53d592f3e3615d0278ed');
assert.equal(hash(recipe.unchangedOutputHashes),'dd3d46bc61c0f6a4ed4db6d6bd6393c85ef1adb9fec35177ec821d9c35dfd183');
// Preserve the complete original recipe; only six C-observed branch claims are added.
const originalBytes=readFileSync(new URL('gen-sessions/evidence/mounted-movement-owner/recording-recipe.json',import.meta.url));
assert.equal(createHash('sha256').update(originalBytes).digest('hex'),
    '4a6028dd869dbcb273341fd64f7bed0ea9ce79a0ef02580bee5afc8a4e1eeaf8','original recording recipe bytes');
const {requireBranchAssertions,branches,branchAssertions,...originalFields}=recipe;
assert.deepEqual(originalFields,JSON.parse(originalBytes),'original recipe, state requirements and negative hashes');
assert.equal(hash({requireBranchAssertions,branches,branchAssertions}),
    '46c9df5a4d92492d74e2a0a389405dd4cc3842de3b425fee2513399fb44deebb','derived C branch metadata');
assert.equal(requireBranchAssertions,true);assert.equal(branches.length,6);assert.equal(branchAssertions.length,6);
assert.deepEqual(branches,recipe.segments.map(s=>'mounted-movement.'+s.name));
assert.deepEqual(branchAssertions.map(a=>[a.branch,a.segment]),branches.map((branch,i)=>[branch,i]));
// Installed canonical raw bytes are mandatory. There is no alternate raw-path option.
const nativeBytes=readFileSync(new URL('gen-sessions/generated/mounted-movement-owner.session.json',import.meta.url));
const rawSHA256=createHash('sha256').update(nativeBytes).digest('hex');
assert.equal(rawSHA256,'2aa599996e5ce54c8214eb94b1c4b0e1e02e0030710d8734324e954975e5e295',
    'canonical native recording must preserve the exact parent raw bytes');
assert.equal(nativeBytes.length,1154194);
const native=JSON.parse(nativeBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);assert.equal(native.segments.length,6);
assert.deepEqual(native.segments.map(fields),recipe.segments.map(fields),'all five input fields and presence');
for(const part of native.segments){
    assert.ok(part.steps?.length,'recorded native boundaries are mandatory');
    assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves],'every recorded key is fixed');
}
assert.deepEqual(recordingIntegrityErrors(native),[],'native recording integrity');
assert.deepEqual(branchAssertionErrors(recipe,native),[],'all six C branch assertions');
const nativeIntegrity={rawSHA256,sourceCVersion5:true,inputFieldsAndKeysExact:true,
    recordingIntegrity:true,branches:6,boundaries:native.segments.reduce((n,s)=>n+s.steps.length,0),
    keys:native.segments.reduce((n,s)=>n+s.moves.length,0),nativeParityClaimed:false};
assert.equal(nativeIntegrity.boundaries,756);assert.equal(nativeIntegrity.keys,750);
const results=[],bound=setTimeout(()=>{console.error('55 second ordinary bound');process.exit(2);},55000);
for(const [i,part]of recipe.segments.entries()){
    const r={name:part.name,inputSHA256:hash(fields(part))},states=[];
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    try{
        let output;
        try{
            globalThis.__step_snapshot={step:'*',cb(g,step){if(!g.u||!g.level)return;
                const steed=g.u.usteed;
                states.push({step,xy:[g.u.ux,g.u.uy],turn:g.moves,hp:g.u.uhp,mortality:g.u.umortality||0,ride:g.u.urideturns||0,
                    skill:{...g.u.weapon_skills[P_RIDING]},steed:steed?{id:steed.m_id,mnum:steed.mnum,xy:[steed.mx,steed.my],hp:steed.mhp,tame:steed.mtame,
                        saddle:steed.minvent.some(o=>o.otyp===O.SADDLE&&(o.owornmask&W_SADDLE)&&o.leashmon===steed.m_id),
                        rawMapOccupant:g.level.monAt.get(`${steed.mx},${steed.my}`)?.m_id||null}:null});
            }};
            output=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
        Object.assign(r,{hashes:hashes(output),boundaries:output.screens.length,calls:output.calls.length,frames:output.frames.flat().length});
        assert.deepEqual(output,outputs(await runSegment({...part,storage:new InMemoryStorage()})),'all-five observer neutrality');r.observerNeutral=true;
        assert.deepEqual(output,await deferred(part),'all-five deferred delivery and held EOF');r.deferredNeutral=true;
        assert.equal(output.screens.length,part.moves.length+1);assert.deepEqual(output.slices.flat(),output.calls);
        const req=recipe.branchRequirements[i],before=states.find(s=>s.step===req.startStep),last=states.at(-1);
        const sequence=states.filter(s=>s.step>req.startStep&&s.step<=req.startStep+req.commandCount);
        const texts=output.screens.map(s=>decodeScreen(s).map(row=>row.map(renderCell).join('').trimEnd()).join('\n'));
        const ridingRows=[...new Set(texts.flatMap(t=>t.split('\n')).filter(line=>/riding\s+Unskilled/.test(line)))];
        Object.assign(r,{before,final:last,ridingRows,sequenceSHA256:hash(sequence)});
        assert.equal(req.name,part.name);assert.equal(sequence.length,req.commandCount);assert.ok(states.every(s=>s.hp>0&&!s.mortality),'hero survives every input');
        assert.equal(!!before.steed,req.mounted);assert.deepEqual(before.skill,{skill:P_UNSKILLED,max:P_BASIC,advance:0});assert.equal(before.ride,0);
        if(req.mounted){const mounted=states.find(s=>s.step===28);assert.deepEqual(mounted.xy,[40,4]);assert.equal(mounted.turn,2);assert.equal(mounted.ride,0,'mounting itself is not movement training');
            assert.equal(mounted.steed.mnum,P.PM_PONY);assert.ok(mounted.steed.tame>0&&mounted.steed.saddle&&mounted.steed.hp>0);assert.equal(mounted.steed.rawMapOccupant,null);
            assert.ok(states.filter(s=>s.step>=28).every(s=>s.steed?.id===mounted.steed.id&&s.steed.hp>0&&s.steed.saddle),'same real saddled pony throughout');}
        for(const [j,s]of sequence.entries()){
            const trained=req.mounted&&req.movementSteps>0?j+1:0;
            assert.equal(s.ride,trained%100,`riding counter after command ${j+1}`);assert.equal(s.skill.advance,Math.floor(trained/100),`practice after command ${j+1}`);
            assert.equal(s.skill.skill,P_UNSKILLED);assert.equal(s.skill.max,P_BASIC);
            if(req.movementSteps)assert.deepEqual(s.xy,[40,(req.mounted?4:5)+(j%2===0?1:0)],`actual movement after command ${j+1}`);
            else assert.deepEqual(s.xy,before.xy,'wait or wall attempt leaves position fixed');
            if(req.mounted)assert.deepEqual(s.steed.xy,s.xy);
        }
        assert.deepEqual(last.xy,req.endXY);assert.equal(last.turn,req.endTurn);assert.equal(last.ride,req.ride);assert.equal(last.skill.advance,req.practice);
        assert.ok(ridingRows.some(row=>new RegExp(`riding\\s+Unskilled\\s+${req.practice}\\(\\s*20\\)`).test(row)),'real #enhance displays the expected practice');
        assert.match(texts.at(-1),/MacOS NetHack Version 5\.0\.0/);assert.ok(!texts.join('\n').includes('You die'));
        if(req.negative)assert.deepEqual(r.hashes,recipe.unchangedOutputHashes[part.name],'three all-five negative streams remain fixed');
        r.pass=true;
    }catch(e){r.pass=false;r.error=e.message.slice(0,450);}
    results.push(r);
}
clearTimeout(bound);
const report={nativeIntegrity,classification:'six ordinary debug keyboard cases',nativeParityClaimed:false,total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>r.name),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
