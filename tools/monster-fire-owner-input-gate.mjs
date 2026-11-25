// Ordinary keyboard input with read-only observations. No runtime mutation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
// Install under tools/; runtime imports resolve to this repository root.
const root=new URL('../',import.meta.url);
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'),
    'Usage: node tools/monster-fire-owner-input-gate.mjs [compact-report.json]');
const {runSegment,NethackGame}=await import(new URL('js/jsmain.js',root));
const {GameDisplay}=await import(new URL('js/game_display.js',root));
const {InMemoryStorage}=await import(new URL('js/storage.js',root));
const {moveloop_core}=await import(new URL('js/allmain.js',root));
const G=await import(new URL('js/gstate.js',root));
const {PMNAMES:P}=await import(new URL('js/monst_data.js',root));
const {branchAssertionErrors,recordingIntegrityErrors}=await import(new URL('tools/gen-sessions/assertions.mjs',root));
const input=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/monster-fire-owner.json',import.meta.url)));
const native=JSON.parse(fs.readFileSync(new URL('gen-sessions/generated/monster-fire-owner.session.json',import.meta.url)));
const inputFields=part=>['name','seed','datetime','nethackrc','moves'].map(key=>
    [key,Object.hasOwn(part,key),part[key]]);
assert.equal(native.source,'c');assert.equal(native.version,5);
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(input,native),[]);
assert.deepEqual(input.segments.map(inputFields),native.segments.map(inputFields));
for(const part of native.segments)
    assert.deepEqual(part.steps.map(step=>step.key),[null,...part.moves]);
const collect=r=>({screens:r.getScreens(),cursors:r.getCursors(),rng:[...r.getRngLog()],
    slices:r.getRngSlices(),frames:r.getAnimationFramesByStep()});
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const hashes=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,hash(v)]));
async function deferred(part){
    const r=new NethackGame({...part,storage:new InMemoryStorage()});
    const d=new GameDisplay(null),end=new Error('supplied keys ended');let used=0;
    let signalEnd,release,timer,settled=false;
    const atEnd=new Promise(resolve=>{signalEnd=resolve;});
    d.onEmptyQueue=async()=>{await setImmediate();if(used===part.moves.length){
        signalEnd();return new Promise((_,reject)=>{release=()=>reject(end);});}
        return part.moves.charCodeAt(used++);};r._pendingDisplay=d;
    const work=(async()=>{
        try{await r.start();for(let i=0;i<2048&&!G.game.program_state?.gameover;i++)await moveloop_core();}
        catch(e){if(e!==end)throw e;}finally{settled=true;}
    })();
    try{
        await Promise.race([atEnd,work.then(()=>{throw Error('ended before the final blocked read');}),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('final read timeout')),3000);})]);
        await setImmediate();assert.equal(settled,false);
    }finally{clearTimeout(timer);if(release)release();await work;}
    assert.equal(used,part.moves.length);return r;
}
const reports=[];
assert.equal(input.segments.length,11);
for(const part of input.segments){
    const messages=new Set(),states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let out;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            for(const s of [...(g._msg_history||[]),g._prevmsg||'',g._toplines||''])messages.add(s);
            const killers=[];for(let k=g.killer?.next;k;k=k.next)killers.push({id:k.id,name:k.name});
            states.push({step,slime:g.u.uprops?.SLIMED||0,killers,hp:g.u.uhp,
                fireResistance:g.u.intrinsic?.HFire_resistance||g.u.uprops?.FIRE_RES||0,
                msg:g._prevmsg||'',top:g._toplines||'',gameover:!!g.program_state?.gameover,
                monsters:(g.level?.monsters||[]).map(m=>({id:m.m_id,type:m.mnum,hp:m.mhp,max:m.mhpmax,tame:m.mtame||0}))});
        }};
        out=collect(await runSegment({...part,storage:new InMemoryStorage()}));
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    const events=states.filter((s,i)=>/fire|burn|slime|flames|hot|destroyed/.test(s.msg+' '+s.top)
        && (!i||s.msg!==states[i-1].msg||s.slime!==states[i-1].slime));
    const r={name:part.name,keys:part.moves.length,boundaries:out.screens.length,calls:out.rng.length,
        frames:out.frames.flat().length,hashes:hashes(out),messages:[...messages].filter(s=>/fire|burn|slime|flame|hot|destroyed/.test(s)&&!s.startsWith('Create what')),
        events:events.map(({step,slime,killers,hp,msg,top,fireResistance})=>({step,slime,killers,hp,msg,top,fireResistance})),
        final:states.at(-1),checks:[]};
    r.plainHashes=hashes(collect(await runSegment({...part,storage:new InMemoryStorage()})));
    r.deferredHashes=hashes(collect(await deferred(part)));
    const check=(label,fn)=>{try{fn();r.checks.push({label,pass:true});}
        catch(e){r.checks.push({label,pass:false,error:e.message});process.exitCode=1;}};
    check('all five outputs preserve observer, deferred keys and a blocked final read',()=>{
        assert.deepEqual(r.hashes,r.plainHashes);assert.deepEqual(r.hashes,r.deferredHashes);
        if(input.unchangedOutputHashes[part.name])
            assert.deepEqual(r.hashes,input.unchangedOutputHashes[part.name]);
        for(const k of ['screens','cursors','slices','frames'])assert.equal(out[k].length,part.moves.length+1);
        assert.deepEqual(out.slices.flat(),out.rng);assert.ok(states.every(s=>!s.gameover));
    });
    check('normal producers establish the source branch',()=>{
        const n=part.name;
        const seen=type=>states.some(s=>s.monsters.some(m=>m.type===type&&m.hp>0));
        if(n==='hero-food-slime')assert.ok(states.some(s=>s.slime>0&&s.killers.some(k=>k.id===22)));
        else if(n.startsWith('hero-')&&n!=='hero-healthy')assert.ok(states.some(s=>s.slime===100));
        if(n==='hero-resistant-slime')assert.ok(states.some(s=>s.slime>0&&s.fireResistance>0));
        if(n==='hero-physical-slime')assert.ok(seen(P.PM_GIANT_ANT));
        else if(n!=='hero-slime-alone')assert.ok(seen(P.PM_FIRE_ANT));
        if(n.startsWith('pet-')){
            assert.ok(states.some(s=>s.monsters.some(m=>m.type===P.PM_FIRE_ANT&&m.tame>0)));
            const target=n.includes('paper')?P.PM_PAPER_GOLEM:n.includes('straw')?P.PM_STRAW_GOLEM:P.PM_JACKAL;
            assert.ok(seen(target));assert.ok(!states.at(-1).monsters.some(m=>m.type===target&&m.hp>0));
        }
    });
    check('C source behavior and visible branch assertions',()=>{
        const index=input.segments.indexOf(part),n=part.name;
        const local={branches:[input.branches[index]],requireBranchAssertions:true,
            branchAssertions:[{...input.branchAssertions[index],segment:0}]};
        assert.deepEqual(branchAssertionErrors(local,{segments:[{steps:out.screens.map(screen=>({screen}))}]}),[]);
        if(['hero-food-slime','hero-wizard-slime','hero-resistant-slime'].includes(n)){
            assert.equal(states.at(-1).slime,0);assert.ok(!states.at(-1).killers.some(k=>k.id===22));
        }else if(n==='hero-healthy')assert.ok(states.every(s=>s.slime===0));
        else if(n==='hero-slime-alone'||n==='hero-physical-slime')assert.equal(states.at(-1).slime,94);
    });
    reports.push(r);console.log(part.name, r.boundaries,r.calls,JSON.stringify(r.checks));
}
const compact={evidence:'JS ordinary-input controls; native comparison is separate',
    passed:reports.flatMap(r=>r.checks).filter(c=>c.pass).length,
    total:reports.reduce((n,r)=>n+r.checks.length,0),
    reports:reports.map(({name,keys,boundaries,calls,frames,hashes,plainHashes,deferredHashes,checks})=>
        ({name,keys,boundaries,calls,frames,hashes,plainHashes,deferredHashes,checks}))};
assert.equal(reports.length,11);assert.equal(compact.total,33);
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(compact,null,2)+'\n');
console.log(JSON.stringify({passed:compact.passed,total:compact.total,cases:reports.length}));
