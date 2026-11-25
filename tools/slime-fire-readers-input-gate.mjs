// Ordinary keys only. Observers read state without changing game behavior.
// Usage: node tools/slime-fire-readers-input-gate.mjs [source-c-v5.json] [report.json]
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
import {TT_LAVA} from '../js/const.js';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/slime-fire-readers.json',import.meta.url)));
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
            states.push({step,msg:g._prevmsg,top:g._toplines,slime:g.u.uprops?.SLIMED||0,
                alias:g.u.intrinsic?.HSlimed||0,hp:g.u.uhp,trap:g.u.utrap||0,
                traptype:g.u.utraptype||0,gameover:!!g.program_state?.gameover,
                inventory:(g.invent||[]).map(o=>({letter:o.invlet,art:o.oartifact||0,name:o.oname||null})),
                fireResistance:g.u.intrinsic?.HFire_resistance||g.u.uprops?.FIRE_RES||0,
                waterWalking:g.u.intrinsic?.HWwalking||g.u.uprops?.WWALKING||0});
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
        assert.ok(states.every(s=>!s.gameover&&s.alias===0));
    });
    await check('normal producers establish the source branch',()=>{
        const active=part.name.endsWith('slimed');
        if(active)assert.ok(states.some(s=>s.slime===100&&s.msg==='You are turning into slime.'));
        else assert.ok(states.every(s=>s.slime===0));
        if(part.name.startsWith('trapped'))assert.ok(states.some(s=>s.trap>0&&s.traptype===TT_LAVA&&s.fireResistance>0&&(!active||s.slime===100)));
        if(part.name.startsWith('surface'))assert.ok(states.some(s=>!s.trap&&s.waterWalking>0&&(!active||s.slime===100)));
        if(part.name.startsWith('fire'))assert.ok(states.some(s=>s.inventory.some(o=>o.name==='Fire Brand'&&o.art>0)));
        if(part.name==='fire-resistant-slimed')assert.ok(states.some(s=>s.slime===100&&s.fireResistance>0));
    });
    await check('source-defined cure or unchanged negative',()=>{
        const burns=['fire-slimed','trapped-lava-slimed','surface-lava-slimed','fire-resistant-slimed'].includes(part.name);
        const burnStates=states.filter(s=>(s.msg||'').includes('The slime that covers you is burned away!'));
        if(burns){assert.ok(burnStates.length>0);assert.ok(burnStates.every(s=>s.slime===0));assert.equal(states.at(-1).slime,0);}
        else {assert.equal(burnStates.length,0);assert.equal(states.at(-1).slime,part.name.endsWith('slimed')?99:0);}
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
