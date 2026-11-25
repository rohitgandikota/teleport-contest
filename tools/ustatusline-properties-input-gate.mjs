// Ordinary keys only. Read-only snapshots are checked against plain and delayed input.
// Usage: node tools/ustatusline-properties-input-gate.mjs [input.json] [report.json]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {NethackGame,runSegment} from '../js/jsmain.js';
import {GameDisplay} from '../js/game_display.js';
import {InMemoryStorage} from '../js/storage.js';
import {moveloop_core} from '../js/allmain.js';
import {game} from '../js/gstate.js';
import {visible_region_at,reg_damg} from '../js/region.js';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const recipe=JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/ustatusline-canonical-properties.json',import.meta.url)));
const input=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2])):recipe;
assert.equal(input.segments.length,6);
const collect=run=>({screens:run.getScreens(),cursors:run.getCursors(),rng:run.getRngLog(),
    slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
const hashes=data=>Object.fromEntries(Object.entries(data).map(([k,v])=>
    [k,createHash('sha256').update(JSON.stringify(v)).digest('hex')]));
async function delayed(part){
    const run=new NethackGame({...part,storage:new InMemoryStorage()});
    const display=new GameDisplay(null),end=new Error('Input queue empty');let used=0;
    display.onEmptyQueue=async()=>{
        await setImmediate();if(used===part.moves.length)throw end;
        return part.moves.charCodeAt(used++);
    };
    run._pendingDisplay=display;
    try{await run.start();for(let i=0;i<1024&&!game.program_state?.gameover;i++)await moveloop_core();}
    catch(error){if(error!==end)throw error;}
    assert.equal(used,part.moves.length);return run;
}
const reports=[],observed={segments:[]};
const keys=['SICK','STONED','SLIMED','VOMITING'];
for(const [index,part] of input.segments.entries()){
    for(const key of ['name','seed','datetime','nethackrc','moves']){
        assert.equal(Object.hasOwn(part,key),Object.hasOwn(recipe.segments[index],key));
        assert.deepEqual(part[key],recipe.segments[index][key]);
    }
    if(part.steps?.length){
        assert.equal(input.source,'c');assert.equal(input.version,5);
        assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves]);
        assert.deepEqual(recordingIntegrityErrors({segments:[part]}),[]);
    }
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),states=[];
    let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            const region=visible_region_at(g.u.ux,g.u.uy);
            states.push({step,topline:g._toplines,msg:g._prevmsg,
                timers:Object.fromEntries(keys.map(k=>[k,g.u.uprops?.[k]||0])),
                phantomAliases:Object.fromEntries(keys.map(k=>[k,g.u.intrinsic?.['H'+k[0]+k.slice(1).toLowerCase()]||0])),
                sickType:g.u.usick_type||0,blind:g.u.intrinsic?.HBlinded||0,
                cloud:region?{damage:reg_damg(region),ttl:region.ttl}:null,
                swallowed:!!g.u.uswallow,gameover:!!g.program_state?.gameover});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const out=collect(run),plain=collect(await runSegment({...part,storage:new InMemoryStorage()}));
    const late=collect(await delayed(part));
    await test(`${part.name}: observer and delayed input preserve all five full outputs`,()=>{
        for(const k of ['screens','cursors','slices','frames'])assert.equal(out[k].length,part.moves.length+1,k);
        assert.deepEqual(out.slices.flat(),out.rng);
        assert.ok(out.rng.every(s=>/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(s)));
        assert.deepEqual(hashes(out),hashes(plain));assert.deepEqual(hashes(out),hashes(late));
        assert.equal(out.frames.flat().length,0);
    });
    const phrase=['dying from food poisoning','solidifying','becoming slimy','nauseated','AC 10.','nauseated'][index];
    const statusStates=states.filter(s=>[s.msg,s.topline].some(t=>t?.includes('Status of wizard')&&t.includes(phrase)));
    await test(`${part.name}: actual producer state accompanies the self-status feedback`,()=>{
        assert.ok(statusStates.length>0,'status text must be observed at a real boundary');
        assert.ok(statusStates.every(s=>!s.gameover&&!s.swallowed));
        if(index<4||index===5){
            const key=index===5?'VOMITING':keys[index];
            assert.ok(statusStates.some(s=>s.timers[key]>0));
            assert.ok(statusStates.every(s=>Object.values(s.phantomAliases).every(v=>v===0)));
            if(index===0)assert.ok(statusStates.some(s=>s.sickType===1));
        }else if(index===4){
            assert.ok(statusStates.every(s=>Object.values(s.timers).every(v=>v===0)&&s.cloud===null));
        }else{
            assert.ok(statusStates.some(s=>s.cloud?.damage>0));
        }
    });
    observed.segments.push({steps:out.screens.map(screen=>({screen}))});
    reports.push({name:part.name,boundaries:out.screens.length,calls:out.rng.length,
        frames:out.frames.flat().length,hashes:hashes(out),plainHashes:hashes(plain),
        deferredHashes:hashes(late),statusStates});
}
await test('six source-derived terminal assertions and registered coverage tags',()=>{
    const tags=JSON.parse(fs.readFileSync(new URL('gen-sessions/coverage-requirements.json',import.meta.url)));
    assert.ok(recipe.coverage.every(c=>tags.requirements.some(r=>r.id===c)));
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    assert.deepEqual(branchAssertionErrors(recipe,observed),[]);
    if(input.segments.every(s=>s.steps?.length))assert.deepEqual(branchAssertionErrors(recipe,input),[]);
});
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify({
    evidence:'JS ordinary-input reach and observer neutrality; no native execution or parity claim',reports},null,2)+'\n');
