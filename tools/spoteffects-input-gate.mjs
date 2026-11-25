// Normal keyboard proposals; normal runtime imports. Observers only read state.
// node tools/spoteffects-input-gate.mjs [source-c-v5.json] [report.json]
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
import {t_at} from '../js/mon.js';
import {spot_time_left,MELT_ICE_AWAY} from '../js/timeout.js';
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {PIT,FIRE_TRAP,ICE,POOL,TIMEOUT,I_SPECIAL,TT_PIT,TT_WEB} from '../js/const.js';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/spoteffects-owner.json',import.meta.url)));
const input=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2])):recipe;
const collect=run=>({screens:run.getScreens(),cursors:run.getCursors(),rng:run.getRngLog(),
    slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
const hashes=data=>Object.fromEntries(Object.entries(data).map(([k,v])=>
    [k,createHash('sha256').update(JSON.stringify(v)).digest('hex')]));
async function deferred(part){
    const run=new NethackGame({...part,storage:new InMemoryStorage()});
    const display=new GameDisplay(null),end=new Error('End of supplied keys');let used=0;
    display.onEmptyQueue=async()=>{await setImmediate();if(used===part.moves.length)throw end;
        return part.moves.charCodeAt(used++);};
    run._pendingDisplay=display;
    try{await run.start();for(let i=0;i<2048&&!game.program_state?.gameover;i++)await moveloop_core();}
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
        globalThis.__step_snapshot={step:'*',cb(g,step){states.push({step,moves:g.moves,
            xy:[g.u.ux,g.u.uy],hp:g.u.uhp,mh:g.u.mh||0,form:g.u.umonnum,
            hLev:g.u.intrinsic?.HLevitation||0,eLev:g.u.uprops?.LEVITATION||0,
            bLev:g.u.blocked?.LEVITATION||0,dismounting:!!g.in_steed_dismounting,
            eastTrap:t_at(g.u.ux+1,g.u.uy)?.ttyp||0,
            underwater:!!g.u.uinwater,terrain:g.level.at(g.u.ux,g.u.uy).typ,
            floortrap:t_at(g.u.ux,g.u.uy)?.ttyp||0,trap:g.u.utrap||0,traptype:g.u.utraptype||0,
            depth:g._spoteffects?.inspoteffects||0,activeTrap:g._spoteffects?.spottraptyp||0,
            lava:g.iflags.in_lava_effects||0,msg:g._prevmsg,top:g._toplines,
            iceTime:spot_time_left(g.u.ux,g.u.uy,MELT_ICE_AWAY),
            debugMongen:!!g.iflags.debug_mongen,debugHunger:!!g.iflags.debug_hunger,
            helmet:g.u.uarmh?.otyp||null,breathing:g.u.uprops?.MAGICAL_BREATHING||0,
            fire:g.u.uprops?.FIRE_RES||g.u.intrinsic?.HFire_resistance||0,
            objects:g.level.objectsAt(g.u.ux,g.u.uy).map(o=>o.otyp),
            monsters:g.level.monsters.map(m=>({typ:m.mnum,x:m.mx,y:m.my,
                hidden:!!m.mundetected,sleep:!!m.msleeping,tame:m.mtame||0,peace:!!m.mpeaceful})),
            inventory:(g.invent||[]).map(o=>({letter:o.invlet,typ:o.otyp,mask:o.owornmask||0})),
            gameover:!!g.program_state?.gameover});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const out=collect(run),plain=collect(await runSegment({...part,storage:new InMemoryStorage()})),
          late=collect(await deferred(part));
    const report={name:part.name,boundaries:out.screens.length,calls:out.rng.length,
        frames:out.frames.flat().length,hashes:hashes(out),plainHashes:hashes(plain),deferredHashes:hashes(late),states,checks:[]};
    async function check(label,fn){await test(`${part.name}: ${label}`,()=>{
        const result={label};try{fn();result.pass=true;}
        catch(error){result.pass=false;result.error=error.message;throw error;}
        finally{report.checks.push(result);}
    });}
    await check('all five full outputs are observer and deferred neutral',()=>{
        for(const key of ['screens','cursors','slices','frames'])assert.equal(out[key].length,part.moves.length+1,key);
        assert.deepEqual(out.slices.flat(),out.rng);
        assert.ok(out.rng.every(s=>/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(s)));
        assert.deepEqual(out,plain);assert.deepEqual(out,late);
        assert.ok(states.every(s=>!s.gameover));assert.equal(states.at(-1).depth,0);
        assert.equal(states.at(-1).lava,0);
    });
    await check('real producers reach the source branch and finish',()=>{
        const name=part.name,last=states.at(-1),text=states.map(s=>s.top).join('\n');
        if(name.startsWith('timeout-')){
            assert.ok(states.some(s=>(s.hLev&TIMEOUT)>2),'real potion timeout');
            assert.ok(states.some(s=>(s.hLev&TIMEOUT)===1));
            if(name==='timeout-early'||name==='timeout-deferred'){
                const entered=states.find(s=>s.xy[0]===9&&s.xy[1]===12&&s.moves>10&&s.floortrap===PIT);
                assert.ok(entered);
                assert.equal(entered.hLev&TIMEOUT,0);
                assert.equal(entered.trap>0,true);
                if(name==='timeout-deferred'){
                    // Historical name: pinned C hack.c:3364 takes the early arm.
                    const before=states.find(s=>s.step===entered.step-1);
                    assert.ok(before);
                    assert.equal(part.moves[entered.step-1],'l');
                    assert.deepEqual(before.xy,[entered.xy[0]-1,entered.xy[1]]);
                    assert.equal(before.eastTrap,PIT);
                    assert.equal(before.hLev&TIMEOUT,1);
                    assert.equal(before.hLev&~(I_SPECIAL|TIMEOUT),0);
                    assert.equal(before.eLev,0);assert.equal(before.bLev,0);
                    assert.equal(before.dismounting,false);assert.equal(before.trap,0);
                    assert.deepEqual([before.depth,before.activeTrap,before.lava],[0,0,0]);
                    assert.equal(entered.moves,before.moves+1);
                    assert.equal(entered.hLev,0);assert.equal(entered.eLev,0);
                    assert.equal(entered.bLev,0);assert.equal(entered.dismounting,false);
                    assert.equal(entered.trap,4);assert.equal(entered.traptype,TT_PIT);
                    assert.deepEqual([entered.depth,entered.activeTrap,entered.lava],[0,0,0]);
                    // Branch choice, pit duration/damage, then exercise, before end-turn work.
                    assert.deepEqual(out.slices[entered.step].slice(0,5),
                        ['rn2(2)=0','rn2(6)=2','rnd(6)=6','rn2(2)=1','rn2(2)=0']);
                    assert.equal(entered.top,'You float gently to the floor.  You fall into a pit!');
                    assert.equal(states.filter(s=>s.top.includes('You fall into a pit!')).length,1);
                    assert.equal(out.slices[entered.step].filter(r=>r.startsWith('rnd(6)=')).length,1);
                    assert.ok(!out.slices.slice(entered.step+1).flat().some(r=>r.startsWith('rnd(6)=')));
                    assert.equal(last.trap,entered.trap);
                }
                assert.equal(last.hLev&TIMEOUT,0);assert.ok(last.trap);assert.equal(last.traptype,TT_PIT);
            }else if(name==='timeout-two-turn-negative'){
                assert.equal(last.hLev&TIMEOUT,1);assert.equal(last.trap,0);
            }else{assert.equal(last.hLev&TIMEOUT,0);assert.equal(last.floortrap,0);}
        }else if(name==='extrinsic-ring-negative'){
            assert.ok(last.eLev);assert.equal(last.hLev,0);assert.equal(last.floortrap,PIT);assert.equal(last.trap,0);
        }else if(name==='rust-rehumanize'){
            assert.ok(states.some(s=>s.form===P.PM_IRON_GOLEM&&s.mh>0&&s.breathing));
            assert.notEqual(last.form,P.PM_IRON_GOLEM);assert.ok(last.underwater);
            assert.equal(states.filter((s,i)=>i&&states[i-1].form===P.PM_IRON_GOLEM&&s.form!==P.PM_IRON_GOLEM).length,1);
        }else if(name==='fire-ice-recursion'){
            assert.ok(states.some(s=>s.terrain===ICE&&s.floortrap===FIRE_TRAP&&s.fire&&s.breathing));
            assert.equal(last.terrain,POOL);assert.ok(last.underwater);assert.equal(last.floortrap,0);
        }else if(name.startsWith('lava-')){
            assert.ok(states.some(s=>s.inventory.some(o=>o.typ===O.AMULET_OF_LIFE_SAVING&&o.mask)));
            assert.ok(states.some(s=>s.lava>0));assert.ok(last.hp>0);
            assert.ok(!last.inventory.some(o=>o.typ===O.AMULET_OF_LIFE_SAVING));
            if(name==='lava-loot-rescue')assert.ok(last.objects.includes(O.APPLE));
        }else if(name==='ordinary-pit'){assert.ok(last.trap);assert.equal(last.traptype,TT_PIT);}
        else if(name==='ordinary-web'){assert.ok(last.trap);assert.equal(last.traptype,TT_WEB);}
        else if(name==='ordinary-landmine')assert.equal(last.floortrap,PIT);
        else if(name.startsWith('hidden-')){
            const typ=name==='hidden-helmet'||name==='hidden-leather'||name==='hidden-tame'?P.PM_ROCK_PIERCER:P.PM_LURKER_ABOVE;
            assert.ok(states.some(s=>s.monsters.some(m=>m.typ===typ&&m.hidden&&m.sleep)));
            const m=last.monsters.find(m=>m.typ===typ);assert.ok(m&&!m.hidden&&!m.sleep);
            assert.ok(m.x!==last.xy[0]||m.y!==last.xy[1]);
            if(name==='hidden-helmet'){assert.equal(last.helmet,O.HELMET);assert.match(text,/Its blow glances off your helm/);}
            if(name==='hidden-leather')assert.equal(last.helmet,O.ELVEN_LEATHER_HELM);
            if(name==='hidden-peaceful')assert.equal(m.peace,false);
        }else if(name==='ice-warning'){
            assert.ok(last.debugMongen&&last.debugHunger&&last.eLev);assert.equal(last.terrain,ICE);
            assert.ok(last.iceTime>0&&last.iceTime<5);assert.ok(last.hp>0);
        }else assert.equal(last.trap,0);
    });
    observed.segments.push({steps:out.screens.map(screen=>({screen}))});outputs.push({name:part.name,...out});reports.push(report);
}
await test('source branch assertions and registered coverage',()=>{
    const tags=JSON.parse(fs.readFileSync(new URL('gen-sessions/coverage-requirements.json',import.meta.url)));
    assert.ok(recipe.coverage.every(c=>tags.requirements.some(r=>r.id===c)));
    assert.deepEqual(branchAssertionErrors(recipe),[]);assert.deepEqual(branchAssertionErrors(recipe,observed),[]);
    if(input.segments.every(s=>s.steps?.length))assert.deepEqual(branchAssertionErrors(recipe,input),[]);
});
if(process.argv[3]){
    fs.writeFileSync(process.argv[3],JSON.stringify({evidence:'Ordinary JS source reach and all-five neutrality. Native parity not claimed.',reports},null,2)+'\n');
    fs.writeFileSync(process.argv[3]+'.outputs.json.gz',gzipSync(JSON.stringify(outputs)));
}
