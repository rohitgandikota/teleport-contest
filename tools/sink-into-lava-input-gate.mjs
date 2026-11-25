// Full ordinary keyboard runs, normal imports and read-only observations.
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
import {Levitation,Flying} from '../js/youprop.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/sink-into-lava-owner.json',import.meta.url)));
const input=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2])):recipe;
const collect=run=>({screens:run.getScreens(),cursors:run.getCursors(),rng:run.getRngLog(),
    slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
const hashes=data=>Object.fromEntries(Object.entries(data).map(([k,v])=>
    [k,createHash('sha256').update(JSON.stringify(v)).digest('hex')]));
async function deferred(part){
    const run=new NethackGame({...part,storage:new InMemoryStorage()}),display=new GameDisplay(null);
    const end=new Error('End of supplied keys');let used=0;
    display.onEmptyQueue=async()=>{await setImmediate();if(used===part.moves.length)throw end;
        return part.moves.charCodeAt(used++);};run._pendingDisplay=display;
    try{await run.start();for(let i=0;i<2048&&!game.program_state?.gameover;i++)await moveloop_core();}
    catch(error){if(error!==end)throw error;}assert.equal(used,part.moves.length);return run;
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
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),states=[];let run;
    try{globalThis.__step_snapshot={step:'*',cb(g,step){
        const killers=[];for(let k=g.killer?.next;k;k=k.next)killers.push({id:k.id,format:k.format,name:k.name});
        states.push({step,moves:g.moves,xy:[g.u.ux,g.u.uy],hLev:g.u.intrinsic?.HLevitation||0,
            eLev:g.u.uprops?.LEVITATION||0,bLev:g.u.blocked?.LEVITATION||0,bFly:g.u.blocked?.FLYING||0,
            lev:Levitation(),fly:Flying(),slimed:g.u.uprops?.SLIMED||0,stoned:g.u.uprops?.STONED||0,
            trap:g.u.utrap||0,traptype:g.u.utraptype||0,terrain:g.level.at(g.u.ux,g.u.uy).typ,
            hp:g.u.uhp,mortality:g.u.umortality||0,moved:!!g.u.umoved,invulnerable:!!g.u.uinvulnerable,
            killerId:g.killer?.id,killerName:g.killer?.name,killers,top:g._toplines,
            lava:g.iflags.in_lava_effects||0,depth:g._spoteffects?.inspoteffects||0,
            inGetlin:!!g.program_state.in_getlin,gameover:!!g.program_state.gameover,
            inventory:(g.invent||[]).map(o=>({letter:o.invlet,typ:o.otyp,mask:o.owornmask||0}))});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const out=collect(run),plain=collect(await runSegment({...part,storage:new InMemoryStorage()})),late=collect(await deferred(part));
    const report={name:part.name,boundaries:out.screens.length,calls:out.rng.length,frames:out.frames.flat().length,
        hashes:hashes(out),plainHashes:hashes(plain),deferredHashes:hashes(late),states,checks:[]};
    async function check(label,fn){await test(`${part.name}: ${label}`,()=>{
        const result={label};try{fn();result.pass=true;}catch(error){result.pass=false;result.error=error.message;throw error;}
        finally{report.checks.push(result);}
    });}
    await check('all five outputs are observer and deferred neutral, input completes',()=>{
        for(const key of ['screens','cursors','slices','frames'])assert.equal(out[key].length,part.moves.length+1,key);
        assert.deepEqual(out.slices.flat(),out.rng);assert.deepEqual(out,plain);assert.deepEqual(out,late);
        assert.ok(states.every(s=>!s.gameover));const last=states.at(-1);
        assert.deepEqual([last.lava,last.depth],[0,0]);assert.equal(last.inGetlin,false);
        assert.ok(!out.screens.at(-1).includes('--More--'));assert.ok(!out.screens.at(-1).includes('Die?'));
    });
    await check('real source producers, branch conditions and postconditions',()=>{
        const name=part.name,last=states.at(-1),text=states.map(s=>s.top).join('\n');
        const initial=states.find(s=>s.slimed>0),slimeCalls=initial?out.slices.slice(initial.step).flat().filter(c=>c.startsWith('rnd(9)=')):[];
        if(name!=='floor-slime-negative'){
            assert.ok(states.some(s=>s.trap>512&&s.traptype===C.TT_LAVA&&s.terrain===C.LAVAPOOL));
            assert.ok(states.some(s=>s.inventory.some(o=>o.typ===O.RIN_FIRE_RESISTANCE&&o.mask)));
        }
        if(name==='stationary-short-slime'){
            assert.equal(initial.slimed,2);assert.equal(slimeCalls.length,1);assert.equal(last.slimed,0);
            assert.ok(last.trap);assert.equal(last.mortality,0);
            const pending=states.find(s=>s.top==='You sink deeper into the lava.'&&s.slimed===0
                &&out.screens[s.step].includes('--More--'));
            assert.ok(pending);assert.equal(pending.mortality,0);assert.equal(part.moves[pending.step],' ');
            assert.ok(out.screens[pending.step+1].includes('The slime that covers you is burned away!'));
            const slice=out.slices[pending.step];assert.match(slice.at(-1),/^rnd\(9\)=/);
            assert.match(out.slices[pending.step+1][0],/^rnd\(4\)=/);
        }else if(name==='stationary-long-slime'){
            assert.equal(initial.slimed,100);assert.equal(last.slimed,97);assert.equal(slimeCalls.length,3);
            assert.ok(last.trap);assert.equal(last.mortality,0);assert.ok(!text.includes('burned away'));
        }else if(name.startsWith('fatal-')){
            const died=states.find(s=>s.mortality===1);assert.ok(died);assert.equal(last.mortality,1);
            assert.equal(last.trap,0);assert.ok(last.hp>0);assert.equal(last.slimed,0);
            if(name!=='fatal-no-slime-negative'){
                assert.equal(initial.slimed,100);assert.ok(slimeCalls.length>0);assert.equal(last.killerId,0);
                const deathScreen=out.screens.findIndex(s=>s.includes('You sink below the surface and die.'));
                const burnScreen=out.screens.findIndex(s=>s.includes('The slime that covers you is burned away!'));
                const savedScreen=out.screens.findIndex(s=>s.includes(name==='fatal-blocked-flight'?"OK, so you don't die":'But wait...'));
                assert.ok(deathScreen>=0&&deathScreen<burnScreen&&burnScreen<=savedScreen);
                const burning=states.find(s=>s.step===deathScreen);
                assert.equal(burning.slimed,0);assert.equal(burning.mortality,0);
                assert.ok(out.screens[deathScreen].includes('--More--'));
            }else{assert.ok(states.every(s=>s.slimed===0));assert.equal(slimeCalls.length,0);}
            if(name==='fatal-delayed-killer-chain'||name.startsWith('fatal-blocked-')){
                assert.ok(states.some(s=>s.stoned===100&&s.killers.some(k=>k.id===C.STONED)));
                assert.ok(last.stoned>0);assert.deepEqual(last.killers,[{id:C.STONED,format:C.KILLED_BY,name:'#wizintrinsic'}]);
            }
            if(name==='fatal-blocked-levitation'){
                assert.ok(states.some(s=>s.hLev>0&&s.bLev===C.I_SPECIAL&&s.trap>0&&!s.lev));
                assert.ok(last.lev);assert.equal(last.bLev,0);assert.deepEqual(last.xy,[9,12]);
            }else if(name==='fatal-blocked-flight'){
                assert.ok(states.some(s=>s.bFly===C.I_SPECIAL&&s.trap>0&&!s.fly));
                assert.ok(last.fly);assert.equal(last.bFly,0);assert.deepEqual(last.xy,[9,12]);
            }else assert.notDeepEqual(last.xy,[9,12]);
            if(name!=='fatal-blocked-flight'){
                assert.ok(states.some(s=>s.inventory.some(o=>o.typ===O.AMULET_OF_LIFE_SAVING&&o.mask)));
                assert.ok(!last.inventory.some(o=>o.typ===O.AMULET_OF_LIFE_SAVING));
            }
        }else if(name.startsWith('moving-')){
            const before=states.find(s=>s.step===part.moves.lastIndexOf('h'));assert.ok(before);
            assert.equal(last.trap,before.trap-257);assert.deepEqual(last.xy,before.xy);assert.equal(slimeCalls.length,0);
            assert.match(text,/You are stuck in the lava\./);assert.ok(!text.includes('You sink deeper'));
            assert.equal(last.slimed,name==='moving-slime-negative'?99:0);
        }else if(name==='stationary-no-slime-negative'){
            assert.ok(states.every(s=>s.slimed===0));assert.ok(last.trap);assert.equal(last.mortality,0);
            assert.match(text,/You sink deeper into the lava\./);
        }else{
            assert.equal(last.slimed,99);assert.equal(last.trap,0);assert.equal(last.terrain,C.ROOM);assert.equal(slimeCalls.length,0);
            if(name==='terrain-caller-reset-negative'){
                assert.ok(states.some(s=>s.bLev===C.I_SPECIAL&&s.trap>0));assert.ok(last.lev);assert.equal(last.bLev,0);
            }else assert.equal(name,'floor-slime-negative');
        }
    });
    observed.segments.push({steps:out.screens.map(screen=>({screen}))});outputs.push({name:part.name,...out});reports.push(report);
}
await test('executable source assertions and registered coverage',()=>{
    const tags=JSON.parse(fs.readFileSync(new URL('gen-sessions/coverage-requirements.json',import.meta.url)));
    assert.ok(recipe.coverage.every(c=>tags.requirements.some(r=>r.id===c)));
    assert.deepEqual(branchAssertionErrors(recipe),[]);assert.deepEqual(branchAssertionErrors(recipe,observed),[]);
    if(input.segments.every(s=>s.steps?.length))assert.deepEqual(branchAssertionErrors(recipe,input),[]);
});
if(process.argv[3]){
    fs.writeFileSync(process.argv[3],JSON.stringify({evidence:'Ordinary JS reach and all-five neutrality; not native parity',reports},null,2)+'\n');
    fs.writeFileSync(process.argv[3]+'.outputs.json.gz',gzipSync(JSON.stringify(outputs)));
}
