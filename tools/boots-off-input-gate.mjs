// Ordinary keys only. Observers read state without changing game behavior.
// Usage: node tools/boots-off-input-gate.mjs [source-c-v5.json] [report.json]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {setImmediate} from 'node:timers/promises';
import {NethackGame,runSegment} from '../js/jsmain.js';
import {GameDisplay} from '../js/game_display.js';
import {InMemoryStorage} from '../js/storage.js';
import {moveloop_core} from '../js/allmain.js';
import {game} from '../js/gstate.js';
import {TT_LAVA,TT_WEB,I_SPECIAL,POOL,LAVAPOOL} from '../js/const.js';
import {ONAMES as O} from '../js/objects_data.js';
import {Levitation,Flying} from '../js/youprop.js';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/boots-off.json',import.meta.url)));
const input=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2])):recipe;
const collect=run=>({screens:run.getScreens(),cursors:run.getCursors(),rng:run.getRngLog(),
    slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
const hashes=data=>Object.fromEntries(Object.entries(data).map(([key,value])=>
    [key,createHash('sha256').update(JSON.stringify(value)).digest('hex')]));
async function deferred(part){
    const run=new NethackGame({...part,storage:new InMemoryStorage()});
    const display=new GameDisplay(null),end=new Error('End of supplied keys');let used=0;
    display.onEmptyQueue=async()=>{
        await setImmediate();if(used===part.moves.length)throw end;
        return part.moves.charCodeAt(used++);
    };
    run._pendingDisplay=display;
    try{await run.start();for(let i=0;i<1024&&!game.program_state?.gameover;i++)await moveloop_core();}
    catch(error){if(error!==end)throw error;}
    assert.equal(used,part.moves.length);return run;
}
const reports=[],outputs=[],observed={segments:[]};
assert.equal(input.segments.length,recipe.segments.length);
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
            states.push({step,msg:g._prevmsg,top:g._toplines,
                boots:g.u.uarmf?.otyp||null,levitating:Levitation(),flying:Flying(),
                eLev:g.u.uprops?.LEVITATION||0,bLev:g.u.blocked?.LEVITATION||0,bFly:g.u.blocked?.FLYING||0,
                walking:g.u.uprops?.WWALKING||0,underwater:!!g.u.uinwater,
                terrain:g.level.at(g.u.ux,g.u.uy).typ,trap:g.u.utrap||0,traptype:g.u.utraptype||0,hp:g.u.uhp,
                fire:g.u.uprops?.FIRE_RES||g.u.intrinsic?.HFire_resistance||0,
                breath:g.u.uprops?.MAGICAL_BREATHING||0,form:g.u.umonnum,
                fumbling:g.u.intrinsic?.HFumbling||g.u.uprops?.FUMBLING||0,
                waterBootsKnown:g.objects[O.WATER_WALKING_BOOTS].oc_name_known||0,
                gameover:!!g.program_state?.gameover,
                inventory:(g.invent||[]).map(o=>({letter:o.invlet,typ:o.otyp,mask:o.owornmask||0,
                    known:g.objects[o.otyp].oc_name_known||0,proof:!!o.oerodeproof}))});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const out=collect(run),outHashes=hashes(out);
    const plain=collect(await runSegment({...part,storage:new InMemoryStorage()}));
    const late=collect(await deferred(part));
    const report={name:part.name,boundaries:out.screens.length,calls:out.rng.length,
        frames:out.frames.flat().length,hashes:outHashes,plainHashes:hashes(plain),
        deferredHashes:hashes(late),states,checks:[]};
    async function check(label,fn){await test(`${part.name}: ${label}`,()=>{
        const result={label};try{fn();result.pass=true;}
        catch(error){result.pass=false;result.error=error.message;throw error;}
        finally{report.checks.push(result);}
    });}
    await check('observer and deferred keys preserve all five full outputs',()=>{
        for(const key of ['screens','cursors','slices','frames'])assert.equal(out[key].length,part.moves.length+1,key);
        assert.deepEqual(out.slices.flat(),out.rng);
        assert.ok(out.rng.every(s=>/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(s)));
        assert.deepEqual(outHashes,report.plainHashes);assert.deepEqual(outHashes,report.deferredHashes);
        assert.ok(states.every(s=>!s.gameover));
    });
    await check('normal producers establish the source branch',()=>{
        assert.ok(states.some(s=>s.boots),'normally worn boots');
        if(part.name.startsWith('water-'))assert.ok(states.some(s=>s.boots===O.WATER_WALKING_BOOTS&&s.walking));
        if(['water-pool','water-lava','water-levitation-guard','water-flight-guard','water-clinger-guard'].includes(part.name)){
            const typ=part.name==='water-lava'?LAVAPOOL:POOL;
            assert.ok(states.some(s=>s.boots===O.WATER_WALKING_BOOTS&&s.terrain===typ&&!s.underwater&&!s.trap));
        }
        if(part.name.includes('lava'))assert.ok(states.some(s=>s.fire>0));
        if(part.name==='levitation-web')assert.ok(states.some(s=>s.boots===O.LEVITATION_BOOTS&&s.traptype===TT_WEB&&s.trap>0&&s.bLev===I_SPECIAL));
        if(part.name.startsWith('levitation-'))assert.ok(states.some(s=>s.boots===O.LEVITATION_BOOTS));
        if(part.name==='water-levitation-guard')assert.ok(states.some(s=>s.walking&&s.terrain===POOL&&s.levitating));
        if(part.name==='water-flight-guard')assert.ok(states.some(s=>s.walking&&s.terrain===POOL&&s.flying));
    });
    await check('source-defined removal or unchanged negative',()=>{
        const last=states.at(-1);assert.equal(last.boots,null);
        if(part.name==='water-pool'){
            assert.equal(last.underwater,true);assert.equal(last.waterBootsKnown,1);
        }else if(part.name==='water-lava'){
            assert.equal(last.traptype,TT_LAVA);assert.ok(last.trap);assert.equal(last.waterBootsKnown,1);
        }else if(part.name==='water-lava-burn'){
            assert.equal(last.traptype,TT_LAVA);assert.ok(last.trap);assert.equal(last.waterBootsKnown,0);
            assert.ok(!last.inventory.some(o=>o.typ===O.WATER_WALKING_BOOTS));
        }else if(part.name.startsWith('water-')){
            assert.equal(last.waterBootsKnown,0);
            // polymon subsequently invokes its own spoteffects; only Boots_off skips it.
            if(part.name!=='water-clinger-guard')assert.equal(last.underwater,false);
        }else if(part.name==='levitation-web'){
            assert.equal(last.traptype,TT_WEB);assert.ok(last.trap);assert.equal(last.bLev&I_SPECIAL,0);
            assert.ok(states.some(s=>(s.msg||'').includes('no longer trying to float up from the web')));
        }else if(part.name==='levitation-other-ring')assert.ok(last.levitating&&last.eLev);
        else if(part.name==='levitation-flight')assert.ok(last.flying&&!last.levitating);
        else if(part.name==='levitation-floor')assert.equal(last.levitating,false);
        else if(part.name==='fumble-boots')assert.equal(last.fumbling,0);
        if(part.name==='water-levitation-guard')assert.ok(last.levitating);
        if(part.name==='water-flight-guard')assert.ok(last.flying);
    });
    observed.segments.push({steps:out.screens.map(screen=>({screen}))});
    outputs.push({name:part.name,...out});reports.push(report);
}
await test('source-defined branch assertions and registered coverage',()=>{
    const tags=JSON.parse(fs.readFileSync(new URL('gen-sessions/coverage-requirements.json',import.meta.url)));
    assert.ok(recipe.coverage.every(c=>tags.requirements.some(r=>r.id===c)));
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    assert.deepEqual(branchAssertionErrors(recipe,observed),[]);
    if(input.segments.every(s=>s.steps?.length))assert.deepEqual(branchAssertionErrors(recipe,input),[]);
});
if(process.argv[3]){
    fs.writeFileSync(process.argv[3],JSON.stringify({evidence:'JS ordinary-input reach and all-five neutrality; no native parity claim',reports},null,2)+'\n');
    fs.writeFileSync(process.argv[3]+'.outputs.json.gz',gzipSync(JSON.stringify(outputs)));
}
