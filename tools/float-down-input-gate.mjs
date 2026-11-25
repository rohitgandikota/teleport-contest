// Ordinary keyboard inputs; complete outputs; read-only boundary observations.
// node tools/float-down-input-gate.mjs [source-c-v5.json] [report.json]
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
import {Levitation,Flying,Swimming,Wwalking,Fire_resistance} from '../js/youprop.js';
import {t_at} from '../js/mon.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/float-down-owner.json',import.meta.url)));
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
            xy:[g.u.ux,g.u.uy],level:{...g.u.uz},hLev:g.u.intrinsic?.HLevitation||0,
            eLev:g.u.uprops?.LEVITATION||0,bLev:g.u.blocked?.LEVITATION||0,
            bFly:g.u.blocked?.FLYING||0,lev:Levitation(),fly:Flying(),
            swimming:Swimming(),walking:Wwalking(),fire:Fire_resistance(),
            form:g.u.umonnum,hp:g.u.uhp,mh:g.u.mh,trap:g.u.utrap||0,traptype:g.u.utraptype||0,
            floortrap:t_at(g.u.ux,g.u.uy)?.ttyp||0,terrain:g.level.at(g.u.ux,g.u.uy).typ,
            underwater:!!g.u.uinwater,scheduled:g.u.utotype||0,depth:g._spoteffects?.inspoteffects||0,
            lava:g.iflags.in_lava_effects||0,gameover:!!g.program_state.gameover,top:g._toplines,
            inGetlin:!!g.program_state.in_getlin,
            inventory:(g.invent||[]).map(o=>({letter:o.invlet,typ:o.otyp,mask:o.owornmask||0}))});}};
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
        assert.ok(states.every(s=>!s.gameover));
        assert.deepEqual([states.at(-1).depth,states.at(-1).lava,states.at(-1).scheduled],[0,0,0]);
        assert.ok(!out.screens.at(-1).includes('--More--'));assert.equal(states.at(-1).inGetlin,false);
    });
    await check('real producers, branch conditions, ordering and completion',()=>{
        const name=part.name,last=states.at(-1),text=states.map(s=>s.top).join('\n');
        const equipment=name==='ring-removal-pit'||name==='boots-removal-pit';
        const at=part.moves.lastIndexOf(equipment?(name==='ring-removal-pit'?'Rb':'Tb'):'>');
        assert.ok(at>=0);const before=states.find(s=>s.step===at);assert.ok(before);
        const following=states.filter(s=>s.step>at);
        if(name==='ordinary-no-levitation-negative'){
            assert.ok(states.every(s=>!s.hLev&&!s.eLev&&!s.lev));assert.equal(last.trap,0);
            assert.match(text,/You can't go down here/);return;
        }
        if(equipment){assert.ok(before.eLev);assert.equal(before.hLev,0);assert.ok(before.lev);}
        else{assert.ok(before.hLev&C.I_SPECIAL);assert.ok(before.hLev&C.TIMEOUT);}
        if(name==='remaining-ring-negative'){
            assert.ok(before.eLev);assert.equal(last.eLev,before.eLev);assert.equal(last.hLev,0);
            assert.ok(last.lev);assert.equal(last.trap,0);assert.equal(last.floortrap,C.PIT);return;
        }
        if(name==='remaining-form-negative'){
            assert.equal(before.form,P.PM_FLOATING_EYE);assert.ok(before.hLev&C.FROMFORM);
            assert.equal(last.hLev,C.FROMFORM);assert.ok(last.lev);assert.equal(last.trap,0);return;
        }
        assert.equal(last.hLev,0);assert.equal(last.eLev,0);assert.equal(last.lev,false);
        if(name.startsWith('blocked-')){
            assert.equal(before.bLev,C.I_SPECIAL);assert.ok(before.trap);assert.equal(before.lev,false);
            assert.equal(last.bLev,0);assert.equal(last.trap,before.trap);assert.equal(last.traptype,before.traptype);
            const feedback=following.find(s=>s.top.includes('no longer trying to float up'));
            const latent=following.find(s=>s.top.includes('latent levitation ceases'));
            assert.ok(feedback&&latent&&feedback.step<latent.step);assert.equal(feedback.trap,before.trap);return;
        }
        assert.ok(before.lev);assert.equal(before.bLev,0);
        if(name==='flight-resumes'){
            assert.ok(before.bFly&C.I_SPECIAL);assert.equal(before.fly,false);
            assert.ok(last.fly);assert.equal(last.bFly,0);assert.equal(last.trap,0);
            assert.match(text,/stopped levitating and are now flying/);return;
        }
        if(name==='voluntary-pit'||name==='voluntary-spiked-pit'||equipment){
            assert.equal(before.floortrap,name==='voluntary-spiked-pit'?C.SPIKED_PIT:C.PIT);
            assert.equal(before.trap,0);assert.ok(last.trap);assert.equal(last.traptype,C.TT_PIT);
            assert.ok(text.indexOf('float gently')<text.indexOf('fall into a pit'));
            if(equipment){const type=name==='ring-removal-pit'?O.RIN_LEVITATION:O.LEVITATION_BOOTS;
                assert.ok(before.inventory.some(o=>o.typ===type&&o.mask));
                assert.ok(last.inventory.some(o=>o.typ===type&&!o.mask));}
        }else if(name==='voluntary-hole'){
            assert.equal(before.floortrap,C.HOLE);assert.deepEqual(last.level,before.level);
            assert.equal(last.trap,0);assert.match(text,/You escape a hole/);
        }else if(name==='voluntary-trapdoor'){
            assert.equal(before.floortrap,C.TRAPDOOR);assert.equal(last.level.dlevel,before.level.dlevel+1);
            assert.equal(last.level.dnum,before.level.dnum);assert.match(text,/A trap door opens up under you/);
        }else if(name.startsWith('pool-')){
            assert.equal(before.terrain,C.POOL);assert.equal(before.underwater,false);
            if(name==='pool-breathing'){
                assert.ok(before.inventory.some(o=>o.typ===O.AMULET_OF_MAGICAL_BREATHING&&o.mask));
                assert.ok(last.underwater);assert.ok(!text.includes('float gently'));
            }else if(name==='pool-swimming'){
                assert.ok(before.swimming);assert.equal(before.form,P.PM_GIANT_EEL);
                assert.ok(text.indexOf('float gently to the water')<text.indexOf('fall into the pool'));
                // display.more() paints --More-- before its real nhgetch;
                // this runtime does not set ttyDisplay.inmore there.
                const pending=following.find(s=>out.screens[s.step].includes('--More--')
                    &&s.top.includes('fall into the pool')&&!s.underwater);
                assert.ok(pending);assert.equal(pending.hLev,0);assert.ok(last.underwater);
                const resumed=states.find(s=>s.step===pending.step+1);assert.ok(resumed.underwater);
                assert.equal(part.moves[pending.step],' ');assert.equal(resumed.moves,pending.moves);
                assert.match(resumed.top,/But you aren't drowning\.  You touch bottom\./);
            }else if(name==='pool-walking'){
                assert.ok(before.walking);assert.ok(last.walking);assert.equal(last.underwater,false);
                assert.match(text,/float gently to the water/);
            }else{assert.notDeepEqual(last.xy,before.xy);assert.equal(last.underwater,false);
                assert.match(text,/try to crawl out/);assert.ok(!text.includes('float gently'));}
        }else if(name.startsWith('lava-')){
            assert.equal(before.terrain,C.LAVAPOOL);assert.ok(before.fire);assert.ok(!text.includes('float gently'));
            assert.equal(last.terrain,C.LAVAPOOL);
            if(name==='lava-resistant'){assert.ok(last.trap);assert.equal(last.traptype,C.TT_LAVA);}
            else{assert.equal(last.trap,0);if(name==='lava-walking')assert.ok(before.walking&&last.walking);
                else{assert.equal(before.form,P.PM_SALAMANDER);assert.equal(last.form,P.PM_SALAMANDER);}}
        }else{assert.equal(name,'voluntary-floor');assert.equal(last.trap,0);assert.match(text,/float gently to the floor/);}
    });
    observed.segments.push({steps:out.screens.map(screen=>({screen}))});outputs.push({name:part.name,...out});reports.push(report);
}
await test('source assertions and registered coverage',()=>{
    const tags=JSON.parse(fs.readFileSync(new URL('gen-sessions/coverage-requirements.json',import.meta.url)));
    assert.ok(recipe.coverage.every(c=>tags.requirements.some(r=>r.id===c)));
    assert.deepEqual(branchAssertionErrors(recipe),[]);assert.deepEqual(branchAssertionErrors(recipe,observed),[]);
    if(input.segments.every(s=>s.steps?.length))assert.deepEqual(branchAssertionErrors(recipe,input),[]);
});
if(process.argv[3]){
    fs.writeFileSync(process.argv[3],JSON.stringify({evidence:'Ordinary JS source reach and all-five neutrality. Native parity not claimed.',reports},null,2)+'\n');
    fs.writeFileSync(process.argv[3]+'.outputs.json.gz',gzipSync(JSON.stringify(outputs)));
}
