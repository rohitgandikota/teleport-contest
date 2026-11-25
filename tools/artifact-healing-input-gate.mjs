// Ordinary keyboard proposals with read-only observations. No native evidence.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';

const runtime=new URL(process.env.ARTIFACT_HEALING_RUNTIME
    ? '../../'+process.env.ARTIFACT_HEALING_RUNTIME+'/' : '../',import.meta.url);
const {NethackGame,runSegment}=await import(new URL('js/jsmain.js',runtime));
const {InMemoryStorage}=await import(new URL('js/storage.js',runtime));
const {GameDisplay}=await import(new URL('js/game_display.js',runtime));
const {moveloop_core}=await import(new URL('js/allmain.js',runtime));
const gstate=await import(new URL('js/gstate.js',runtime));
const {get_artifact}=await import(new URL('js/artifact.js',runtime));
const {Blind}=await import(new URL('js/youprop.js',runtime));
const C=await import(new URL('js/const.js',runtime));
const {branchAssertionErrors}=await import(new URL('tools/gen-sessions/assertions.mjs',runtime));
const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/artifact-healing-owner.json',import.meta.url)));
const input=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2])):recipe;
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const collect=run=>({screens:run.getScreens(),cursors:run.getCursors(),rng:run.getRngLog(),
    slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
const hashes=out=>Object.fromEntries(Object.entries(out).map(([key,value])=>[key,sha(value)]));
function state(g,step){
    const killers=[];for(let k=g.killer?.next;k;k=k.next)killers.push({id:k.id,format:k.format,name:k.name});
    const obj=(g.invent||[]).find(o=>get_artifact(o).inv_prop==='HEALING');
    return {step,moves:g.moves,hp:g.u.uhp,hpmax:g.u.uhpmax,mh:g.u.mh,mhmax:g.u.mhmax,
        poly:C.Upolyd(g.u),form:g.u.umonnum,slimed:g.u.uprops?.SLIMED||0,sick:g.u.uprops?.SICK||0,
        sicktype:g.u.usick_type||0,stoned:g.u.uprops?.STONED||0,hblind:g.u.intrinsic?.HBlinded||0,
        cream:g.u.ucreamed||0,blind:Blind(),killers,legacyKiller:g.delayed_killer||null,
        ap:g.youmonst.m_ap_type||0,appearance:g.youmonst.mappearance||0,age:obj?.age||0,
        mortality:g.u.umortality||0,gameover:!!g.program_state.gameover,
        inGetlin:!!g.program_state.in_getlin,top:g._toplines||''};
}
async function deferred(part){
    const run=new NethackGame({...part,storage:new InMemoryStorage()}),display=new GameDisplay(null);
    const end=new Error('End of supplied keys');let used=0;
    display.onEmptyQueue=async()=>{await setImmediate();if(used===part.moves.length)throw end;
        return part.moves.charCodeAt(used++);};run._pendingDisplay=display;
    try{await run.start();for(let i=0;i<2048&&!gstate.game.program_state.gameover;i++)await moveloop_core();}
    catch(error){if(error!==end)throw error;}
    assert.equal(used,part.moves.length);return run;
}
const reports=[];
assert.equal(input.segments.length,recipe.segments.length);
for(const [index,part] of input.segments.entries()){
    for(const key of ['name','seed','datetime','nethackrc','moves']){
        assert.equal(Object.hasOwn(part,key),Object.hasOwn(recipe.segments[index],key));
        assert.deepEqual(part[key],recipe.segments[index][key]);
    }
    assert.deepEqual(part.steps,[],'These are unrecorded proposals');
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),states=[];let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){states.push(state(g,step));}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    const out=collect(run),plain=collect(await runSegment({...part,storage:new InMemoryStorage()})),late=collect(await deferred(part));
    const selections=[];for(const match of part.moves.matchAll(/#invoke\r/g))selections.push(match.index+match[0].length);
    const start=states.find(s=>s.step===selections.at(-1)),last=states.at(-1);
    const after=states.find(s=>s.step>start.step&&(s.hp!==start.hp||s.mh!==start.mh
        ||s.slimed!==start.slimed||s.hblind!==start.hblind||s.sick!==start.sick||s.age!==start.age));
    const report={name:part.name,boundaries:out.screens.length,calls:out.rng.length,frames:out.frames.flat().length,
        hashes:hashes(out),plainHashes:hashes(plain),deferredHashes:hashes(late),
        before:start,firstChange:after,after:last,checks:[]};
    async function check(label,fn){await test(part.name+': '+label,()=>{
        const result={label};try{fn();result.pass=true;}catch(error){result.pass=false;result.error=error.message;throw error;}
        finally{report.checks.push(result);}
    });}
    await check('all five outputs are observer and deferred neutral; finite keys complete',()=>{
        for(const key of ['screens','cursors','slices','frames'])assert.equal(out[key].length,part.moves.length+1,key);
        assert.deepEqual(out.slices.flat(),out.rng);assert.deepEqual(out,plain);assert.deepEqual(out,late);
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
        assert.ok(states.every(s=>!s.gameover));assert.equal(last.inGetlin,false);assert.equal(last.mortality,0);
        assert.ok(!out.screens.at(-1).includes('--More--'));assert.ok(!out.screens.at(-1).includes('Die?'));
    });
    await check('healing owner and unaffected state postconditions',()=>{
        const name=part.name;
        assert.ok(start,'ordinary invocation selection boundary');
        if(name.includes('polymorphed')){
            assert.equal(start.poly,true);assert.equal(last.poly,true);
            if(name==='polymorphed-full-inactive-human-injured')assert.ok(start.hp<start.hpmax,'inactive human HP deficit');
            const amount=Math.trunc((start.mhmax+1-start.mh)/2);
            assert.equal(last.hp,start.hp);assert.equal(last.mh,start.mh+amount);
            assert.equal(amount>0,name==='polymorphed-injured-pool');
        }else if(name==='human-healing-negative'){
            assert.ok(start.hp<start.hpmax);assert.equal(last.hp,start.hp+Math.trunc((start.hpmax+1-start.hp)/2));
        }
        if(name==='food-slime-cure'||name==='food-slime-stone-retained'){
            assert.ok(start.slimed>0);assert.ok(start.killers.some(k=>k.id===C.SLIMED));
            assert.equal(last.slimed,0);assert.ok(!last.killers.some(k=>k.id===C.SLIMED));
            if(name==='food-slime-stone-retained'){
                assert.ok(last.stoned>0);assert.deepEqual(last.killers,start.killers.filter(k=>k.id===C.STONED));
            }else assert.deepEqual(last.killers,[]);
        }else if(name==='wizard-slime-cure-negative'){
            assert.ok(start.slimed>0);assert.equal(last.slimed,0);assert.deepEqual(start.killers,[]);assert.deepEqual(last.killers,[]);
        }else if(name==='sickness-cure-negative'){
            assert.ok(start.sick>0);assert.ok(start.sicktype>0);
            assert.deepEqual([last.sick,last.sicktype,last.legacyKiller],[0,0,null]);
        }else if(name.includes('blindness')||name.includes('cream')){
            assert.equal(last.hblind&C.TIMEOUT,last.cream);
            // src/timeout.c:649: ordinary invocation consumes a turn of cream.
            assert.equal(last.cream,Math.max(0,start.cream-(last.moves-start.moves)));
            assert.equal(last.hblind&~C.TIMEOUT,start.hblind&~C.TIMEOUT);
            assert.equal(last.blind,name.includes('permanent')||name.includes('cream'));
        }else if(name==='cooldown-retains-slime-negative'||name==='cancelled-invoke-retains-slime-negative'){
            assert.ok(start.slimed>0);assert.ok(last.slimed>0);assert.deepEqual(last.killers,start.killers);
            if(name.startsWith('cooldown'))assert.ok(last.age>start.age);else assert.equal(last.age,start.age);
        }
        assert.equal(last.hpmax,start.hpmax);assert.equal(last.mhmax,start.mhmax);
        assert.deepEqual([last.ap,last.appearance],[0,0]);
    });
    await check('source-derived branch messages reached',()=>{
        const local={...recipe,segments:[recipe.segments[index]],
            branchAssertions:recipe.branchAssertions.filter(a=>a.segment===index).map(a=>({...a,segment:0}))};
        local.branches=local.branchAssertions.map(a=>a.branch);
        assert.deepEqual(branchAssertionErrors(local,{segments:[{steps:out.screens.map(screen=>({screen}))}]}),[]);
    });
    reports.push(report);
}
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify({
    evidence:'Ordinary JS keyboard reach and all-five output neutrality; unrecorded proposals, no native parity',
    reports},null,2)+'\n');
