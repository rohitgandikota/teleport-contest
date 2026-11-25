// Portable current-repository gate with mandatory exact canonical C/input preflight.
// Usage: node tools/mcureblindness-input-gate.mjs [compact-report.json]
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {Blind} from '../js/youprop.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {hash,outputs,hashes,deferred} from './half-damage-reader-observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/mcureblindness-owner.json',import.meta.url)));
const names=['healing-blessed','healing-plain','healing-uncursed','extra-uncursed','extra-cursed','full-cursed','natural-horn-unseen','carrot-pet'];
const fields=p=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(p,field),value:p[field]}));
assert.deepEqual(recipe.segments.map(p=>p.name),names);
assert.equal(hash(recipe.segments.map(fields)),'bd7e648981c3ce5409062eaec1a396f532f1e7d8c9758f0ead2ca2c75759c5df','fixed original input fields');
assert.deepEqual(recipe.branches,names.map(n=>'mcureblindness.owner.'+n));
assert.equal(recipe.requireBranchAssertions,true);assert.equal(recipe.branchAssertions.length,8);
assert.deepEqual(Object.keys(recipe.unchangedOutputHashes),["healing-plain","healing-uncursed","extra-cursed","natural-horn-unseen"]);
assert.equal(hash(recipe.unchangedOutputHashes),'2338b3aaf8db450184d26afca6c6e4d9c86b87780c52f7a3ec5772dd8ff494f3','all twenty fixed unchanged-output hashes');
assert.equal(hash(recipe.branchAssertions),'6d6241d104481275d4f30c7efa0b5762935785943b8f62f5901f6cb04a1de6db','all eight original feedback predicates');
// Read the installed canonical bytes unchanged. Metadata belongs to the recipe.
const nativeBytes=readFileSync(new URL('gen-sessions/generated/mcureblindness-owner.session.json',import.meta.url));
const nativeSHA256=createHash('sha256').update(nativeBytes).digest('hex');
assert.equal(nativeSHA256,'6dd6e4cad1e964b564494f7cab7aed3c122051e232da1fab524d0ed8c7cdefbc',
    'canonical native recording must preserve the exact original raw bytes');
const native=JSON.parse(nativeBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);assert.equal(native.segments.length,8);
assert.deepEqual(native.segments.map(fields),recipe.segments.map(fields),'all five original input fields and presence');
for(const part of native.segments){
    assert.ok(part.steps?.length,'recorded native boundaries are mandatory');
    assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves],'all recorded input keys are fixed');
}
assert.deepEqual(recordingIntegrityErrors(native),[],'native recording integrity');
assert.deepEqual(recipe.branchAssertions.map(a=>[a.branch,a.segment]),recipe.branches.map((b,i)=>[b,i]));
assert.deepEqual(branchAssertionErrors(recipe,native),[],'all eight C branch assertions');
const nativeIntegrity={rawSHA256:nativeSHA256,sourceCVersion5:true,inputFieldsAndKeysExact:true,
    recordingIntegrity:true,branches:8,negativeControls:4,nativeParityClaimed:false};
const results=[];
const deadline=setTimeout(()=>{console.error('55 second ordinary worker limit');process.exit(2);},55000);
for(const [index,part] of recipe.segments.entries()) {
    const result={name:part.name,inputSHA256:hash(fields(part))},states=[];
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let output;
    try {
        try {
            globalThis.__step_snapshot={step:'*',cb(g,step){
                if(!g.u||!g.level)return;
                states.push({step,turn:g.moves,hp:g.u.uhp,mortality:g.u.umortality||0,heroBlind:Blind(),
                    held:g.invent.map(o=>({id:o.o_id,letter:o.invlet,type:o.otyp,blessed:!!o.blessed,cursed:!!o.cursed})),
                    floor:g.level.objects.map(o=>o.o_id),
                    mons:g.level.monsters.map(m=>({id:m.m_id,type:m.mnum,xy:[m.mx,m.my],hp:m.mhp,see:!!m.mcansee,blind:m.mblinded,tame:m.mtame}))});
            }};
            output=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        } finally {if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
        assert.deepEqual(output,outputs(await runSegment({...part,storage:new InMemoryStorage()})),'observer neutrality across all five outputs');
        assert.deepEqual(output,await deferred(part),'deferred-input neutrality across all five outputs');
        assert.equal(output.screens.length,part.moves.length+1);assert.deepEqual(output.slices.flat(),output.calls);
        Object.assign(result,{observerNeutral:true,deferredNeutral:true,boundaries:output.screens.length,calls:output.calls.length,frames:output.frames.flat().length,hashes:hashes(output)});
        const text=output.screens.map(s=>decodeScreen(s).map(r=>r.map(renderCell).join('').trimEnd()).join('\n'));
        assert.match(text.at(-1),/NetHack Version/,'final command completes');
        assert.ok(states.every(s=>s.hp>0&&!s.mortality),'hero survives without debug resurrection');
        const type=part.name==='carrot-pet'?P.PM_PONY:part.name==='natural-horn-unseen'?P.PM_GRAY_UNICORN:P.PM_HILL_GIANT;
        const at=states.find(s=>s.mons.some(m=>m.type===type));assert.ok(at,'target created through normal command');
        const first=at.mons.find(m=>m.type===type),id=first.id;
        const target=states.filter(s=>s.mons.some(m=>m.id===id)).map(s=>({...s,mon:s.mons.find(m=>m.id===id)}));
        assert.ok(target.every(s=>s.mon.hp>0),'target survives the actual impacts');
        const blindIndex=target.findIndex(s=>!s.mon.see&&s.mon.blind>0);assert.ok(blindIndex>=0,'real blindness potion reached target');
        const before=target[blindIndex],last=target.at(-1),cure=target.slice(blindIndex+1).find(s=>s.mon.see&&s.mon.blind===0);
        const a=at.held.find(o=>o.letter==='a'),b=at.held.find(o=>o.letter==='b');assert.equal(a?.type,O.POT_BLINDNESS);assert.ok(b);
        assert.ok(!last.held.some(o=>o.id===a.id)&&!last.floor.includes(a.id),'blindness bottle consumed');
        const negative=part.name==='healing-uncursed'||part.name==='extra-cursed';
        if(negative){assert.equal(cure,undefined);assert.equal(last.mon.see,false);assert.ok(last.mon.blind>0);}
        else assert.ok(cure,'same monster recovers before the original timer can expire');
        if(part.name==='natural-horn-unseen') {
            assert.ok(cure.heroBlind,'actual vapor blinds hero before natural-horn feedback');
            assert.ok(last.held.some(o=>o.id===b.id),'unused healing potion rules out potion cure');
            assert.equal(b.type,O.POT_HEALING);assert.ok(cure.turn-before.turn<=1);
        } else {
            assert.ok(!last.held.some(o=>o.id===b.id)&&!last.floor.includes(b.id),'healing item actually consumed');
            if(part.name==='carrot-pet') {assert.equal(b.type,O.CARROT);assert.ok(cure.mon.tame>0);assert.deepEqual(cure.mon.xy,[9,5]);}
            else {
                assert.equal(b.type,part.name.startsWith('extra')?O.POT_EXTRA_HEALING:part.name.startsWith('full')?O.POT_FULL_HEALING:O.POT_HEALING);
                assert.equal(b.blessed,part.name==='healing-blessed'||part.name==='healing-plain');
                assert.equal(b.cursed,part.name.endsWith('-cursed'));
            }
        }
        result.reach={monster:id,blindnessBefore:before.mon.blind,recovered:!!cure,heroBlindAtCure:cure?.heroBlind||false,finalTimer:last.mon.blind};
        const recorded={segments:[]};recorded.segments[index]={steps:output.screens.map((screen,i)=>({screen,rng:output.slices[i]}))};
        assert.deepEqual(branchAssertionErrors({branches:[recipe.branches[index]],requireBranchAssertions:true,branchAssertions:[recipe.branchAssertions[index]]},recorded),[],'ordinary feedback and branch assertions');
        if(recipe.unchangedOutputHashes[part.name]) assert.deepEqual(result.hashes,recipe.unchangedOutputHashes[part.name],'fixed negative outputs');
        result.pass=true;
    }catch(error){result.pass=false;result.error=String(error.message).slice(0,1200);}
    results.push(result);
}
clearTimeout(deadline);
const report={total:results.length,passed:results.filter(r=>r.pass).length,nativeParityClaimed:false,nativeIntegrity,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,firstFailure:results.find(r=>!r.pass)||null}));
if(report.passed!==report.total)process.exitCode=1;
