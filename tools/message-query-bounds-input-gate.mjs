// Normal imports, ordinary keys, read-only observer, and delayed-key replay.
// Usage: node tools/message-query-bounds-input-gate.mjs [input.json] [report.json]
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
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/message-query-bounds.json',import.meta.url)));
const input=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2])):recipe;
assert.equal(input.segments.length,4);
const collect=run=>({screens:run.getScreens(),cursors:run.getCursors(),rng:run.getRngLog(),
    slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
const hashes=out=>Object.fromEntries(Object.entries(out).map(([k,v])=>[k,createHash('sha256').update(JSON.stringify(v)).digest('hex')]));
async function delayed(part){
    const run=new NethackGame({...part,storage:new InMemoryStorage()});
    const display=new GameDisplay(null),end=new Error('Input queue empty');let used=0;
    display.onEmptyQueue=async()=>{await setImmediate();if(used===part.moves.length)throw end;return part.moves.charCodeAt(used++);};
    run._pendingDisplay=display;
    try{await run.start();for(let i=0;i<1024&&!game.program_state?.gameover;i++)await moveloop_core();}
    catch(error){if(error!==end)throw error;}
    assert.equal(used,part.moves.length);return run;
}
const reports=[],observed={segments:[]};
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
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),states=[];let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            const h=g.u?.ustuck;
            states.push({step,top:g._toplines,previous:g._prevmsg,gameover:!!g.program_state?.gameover,
                holder:h?{name:h.mgivenname,id:h.m_id,mnum:h.mnum,hp:h.mhp}:null,
                timers:{sick:g.u?.uprops?.SICK,stone:g.u?.uprops?.STONED,slime:g.u?.uprops?.SLIMED,
                    strangled:g.u?.intrinsic?.HStrangled,vomiting:g.u?.uprops?.VOMITING},
                sickType:g.u?.usick_type});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const out=collect(run),plain=collect(await runSegment({...part,storage:new InMemoryStorage()}));
    const late=collect(await delayed(part));
    await test(`${part.name}: all five observer and delayed-key outputs are byte identical`,()=>{
        for(const k of ['screens','cursors','slices','frames'])assert.equal(out[k].length,part.moves.length+1,k);
        assert.deepEqual(out.slices.flat(),out.rng);
        assert.ok(out.rng.every(s=>/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(s)));
        assert.deepEqual(hashes(out),hashes(plain));assert.deepEqual(hashes(out),hashes(late));
        assert.equal(out.frames.flat().length,0);
    });
    const witness=states.filter(s=>s.top?.startsWith(index===3?'Are you sure you want to pray?':'Status of wizard'));
    await test(`${part.name}: actual source path reaches the asserted terminal boundary`,()=>{
        assert.ok(witness.length>0);assert.ok(witness.every(s=>!s.gameover));
        if(index<2){
            assert.ok(witness.some(s=>s.holder?.name===(index===0?'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789':'Bob')&&s.holder.hp>0));
            assert.ok(witness.some(s=>Object.values(s.timers).every(n=>n>0)&&s.sickType===3));
            assert.ok(witness.some(s=>s.top.includes('held by')));
            if(index===0){
                assert.ok(witness.some(s=>s.top.endsWith('...89.')));
                assert.ok(witness.every(s=>s.top.length===255),'wrapping replaces spaces with single newlines');
            }else assert.ok(witness.some(s=>s.top.endsWith('Bob.')));
        }else if(index===2){assert.ok(witness.every(s=>!s.holder));assert.ok(witness.some(s=>s.top.endsWith('AC 10.')));}
    });
    observed.segments.push({steps:out.screens.map(screen=>({screen}))});
    reports.push({name:part.name,boundaries:out.screens.length,calls:out.rng.length,
        frames:out.frames.flat().length,hashes:hashes(out),plainHashes:hashes(plain),deferredHashes:hashes(late),witness});
}
await test('four recipe assertions use registered coverage tags and actual terminal text',()=>{
    const tags=JSON.parse(fs.readFileSync(new URL('gen-sessions/coverage-requirements.json',import.meta.url)));
    assert.ok(recipe.coverage.every(c=>tags.requirements.some(r=>r.id===c)));
    assert.deepEqual(branchAssertionErrors(recipe),[]);assert.deepEqual(branchAssertionErrors(recipe,observed),[]);
    if(input.segments.every(s=>s.steps?.length))assert.deepEqual(branchAssertionErrors(recipe,input),[]);
});
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify({
    evidence:'JS ordinary-input and observer/deferred checks; C recording pending. Query clipping is constructed only.',reports},null,2)+'\n');
