// Full ordinary keyboard runs, normal imports and read-only observations.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {setImmediate} from 'node:timers/promises';
import {NethackGame,runSegment} from '../js/jsmain.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {PMNAMES as P} from '../js/monst_data.js';
import {glyph_at} from '../js/display.js';
import {GameDisplay} from '../js/game_display.js';
import {InMemoryStorage} from '../js/storage.js';
import {moveloop_core} from '../js/allmain.js';
import {game} from '../js/gstate.js';
import {Levitation,Flying} from '../js/youprop.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/slime-timeout-setter.json',import.meta.url)));
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
        states.push({step,moves:g.moves,aptype:g.youmonst.m_ap_type,appearance:g.youmonst.mappearance,
            form:g.u.umonnum,glyph:{...glyph_at(g.u.ux,g.u.uy)},botl:!!g.disp.botl,xy:[g.u.ux,g.u.uy],hLev:g.u.intrinsic?.HLevitation||0,
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
    await check('source timeout, status, killer and appearance postconditions',()=>{
        const name=part.name,last=states.at(-1),first=states.find(s=>s.slimed>0);
        const text=out.screens.map(screen=>decodeScreen(screen).map(row=>row.map(renderCell).join('')).join('\n')).join('\n');
        const capped=['oversize-zero-low','oversize-short-low','signed-int-maximum','timeout-limit-negative'];
        if(capped.includes(name)){
            assert.equal(first.slimed,C.TIMEOUT);assert.equal(last.slimed,C.TIMEOUT-1);
            assert.ok(text.split('\n').some(l=>l.includes(' - becoming slime')&&l.trimEnd().endsWith('['+(C.TIMEOUT-1)+']')));
            assert.ok(states.every(s=>!(s.slimed&~C.TIMEOUT)));assert.equal(last.mortality,0);
        }else if(name==='ordinary-timeout-negative'||name==='already-slimed-no-extension-negative'){
            assert.equal(first.slimed,100);assert.equal(last.slimed,99);
            assert.ok(states.every(s=>s.slimed<=100));assert.equal(last.mortality,0);
        }else if(name==='absent-negative'){
            assert.ok(states.every(s=>s.slimed===0));assert.equal(last.mortality,0);
        }else if(name==='amulet-cure-negative'||name==='unrelated-delayed-killer-negative'){
            assert.equal(first.slimed,100);assert.equal(last.slimed,0);assert.equal(last.mortality,0);
            assert.ok(last.inventory.some(o=>o.typ===O.AMULET_OF_UNCHANGING&&o.mask===C.W_AMUL));
            if(name==='unrelated-delayed-killer-negative'){
                assert.ok(last.stoned>0);assert.deepEqual(last.killers,[{id:C.STONED,format:C.KILLED_BY,name:'#wizintrinsic'}]);
            }else assert.deepEqual(last.killers,[]);
        }else if(name==='expiry-glyph-negative'){
            assert.equal(first.slimed,1);assert.equal(last.slimed,0);assert.equal(last.mortality,1);
            // C slimed_to_death calls polymon before done_timeout/Die?.
            const dying=states.find(s=>s.slimed===C.I_SPECIAL&&out.screens[s.step].includes('Die?'));
            assert.ok(dying,'real done_timeout pending decision after polymon');
            assert.ok(dying.step>first.step);assert.equal(dying.mortality,1);
            assert.equal(dying.form,P.PM_GREEN_SLIME);
            assert.equal(dying.aptype,C.M_AP_NOTHING);assert.equal(dying.appearance,0);
            assert.equal(dying.glyph.glyphnum,P.PM_GREEN_SLIME+C.GLYPH_MON_MALE_OFF);
            assert.deepEqual(dying.killers,[]);assert.ok(out.screens[dying.step].includes('Slime'));
            assert.ok(dying.top.includes('You turn into a green slime!'));
            assert.ok(states.some(s=>s.step>dying.step&&s.slimed===0&&s.mortality===1
                &&s.top.includes("OK, so you don't die.")));
            assert.equal(last.form,P.PM_GREEN_SLIME);
            assert.equal(last.glyph.glyphnum,P.PM_GREEN_SLIME+C.GLYPH_MON_MALE_OFF);
            assert.equal(last.aptype,C.M_AP_NOTHING);assert.equal(last.appearance,0);
            assert.ok(text.includes("OK, so you don't die."));
        }else{
            assert.equal(name,'lava-burn-negative');assert.equal(first.slimed,2);assert.equal(last.slimed,0);
            assert.ok(last.trap>0);assert.equal(last.mortality,0);
            const pending=states.find(s=>s.top==='You sink deeper into the lava.'&&s.slimed===0&&out.screens[s.step].includes('--More--'));
            assert.ok(pending);assert.equal(part.moves[pending.step],' ');
            assert.ok(out.screens[pending.step+1].includes('The slime that covers you is burned away!'));
        }
        if(last.slimed)assert.ok(out.screens.at(-1).includes('Slime'));
    });
    observed.segments.push({steps:out.screens.map(screen=>({screen}))});outputs.push({name:part.name,...out});reports.push(report);
}
await test('executable source assertions and registered coverage',()=>{
    const tags=JSON.parse(fs.readFileSync(new URL('gen-sessions/coverage-requirements.json',import.meta.url)));
    assert.ok(recipe.coverage.every(c=>tags.requirements.some(r=>r.id===c)));
    assert.deepEqual(branchAssertionErrors(recipe),[]);assert.deepEqual(branchAssertionErrors(recipe,observed),[]);
    if(input.segments.every(s=>s.steps?.length)){
        // Recipe text describes visible rows; C may encode spaces with cursor moves.
        const rendered={segments:input.segments.map(part=>({steps:part.steps.map(step=>({
            ...step,screen:decodeScreen(step.screen).map(row=>row.map(renderCell).join('')).join('\n')
        }))}))};
        assert.deepEqual(branchAssertionErrors(recipe,rendered),[]);
    }
});
if(process.argv[3]){
    fs.writeFileSync(process.argv[3],JSON.stringify({evidence:'Ordinary JS reach and all-five neutrality; not native parity',reports},null,2)+'\n');
    fs.writeFileSync(process.argv[3]+'.outputs.json.gz',gzipSync(JSON.stringify(outputs)));
}
