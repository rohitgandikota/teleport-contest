// Keyboard-only producers; the observer reads state and never changes it.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url);
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'),
    'Usage: node tools/pit-owner-input-gate.mjs [compact-report.json]');
const mod=name=>import(new URL('js/'+name+'.js',root));
const {runSegment,NethackGame}=await mod('jsmain');
const {GameDisplay}=await mod('game_display'),{InMemoryStorage}=await mod('storage');
const {moveloop_core}=await mod('allmain'),G=await mod('gstate'),C=await mod('const');
const {Half_physical_damage}=await mod('youprop');
const {ONAMES:O}=await mod('objects_data'),{PMNAMES:P}=await mod('monst_data');
const {branchAssertionErrors,recordingIntegrityErrors}=await import(new URL('tools/gen-sessions/assertions.mjs',root));
const input=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/pit-owner.json',import.meta.url)));
const native=JSON.parse(fs.readFileSync(new URL('gen-sessions/generated/pit-owner.session.json',import.meta.url)));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(k=>
    ({field:k,present:Object.hasOwn(s,k),value:s[k]}));
assert.equal(native.source,'c');assert.equal(native.version,5);
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(input,native),[]);
assert.deepEqual(native.segments.map(fields),input.segments.map(fields));
for(const s of native.segments)assert.deepEqual(s.steps.map(x=>x.key),[null,...s.moves]);
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
const deadline=setTimeout(()=>{console.error('55 second bounded worker limit');process.exit(2);},55000);
const reports=[];
assert.equal(input.segments.length,12);
for(const [index,part] of input.segments.entries()){
    const states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let out;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            const u=g.u,obj=o=>o?{type:o.otyp,where:o.where,x:o.ox,y:o.oy,corpse:o.corpsenm}:null;
            const trap=g.level.traps?.find(t=>t.tx===u.ux&&t.ty===u.uy);
            states.push({step,x:u.ux,y:u.uy,hp:u.uhp,max:u.uhpmax,mortality:u.umortality||0,
                trapped:u.utrap||0,traptype:u.utraptype,half:!!Half_physical_damage(),
                ball:obj(u.uball),chain:obj(u.uchain),weapon:obj(u.uwep),gloves:obj(u.uarmg),amulet:obj(u.uamul),
                steed:u.usteed?{type:u.usteed.mnum,hp:u.usteed.mhp}:null,
                role:g.urole.mnum,level:{...u.uz},qlocate:{...g.qlocate_level},once:trap?.once||0,
                gameover:!!g.program_state?.gameover});
        }};
        out=collect(await runSegment({...part,storage:new InMemoryStorage()}));
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    const r={name:part.name,keys:part.moves.length,boundaries:out.screens.length,calls:out.rng.length,
        frames:out.frames.flat().length,hashes:hashes(out),checks:[]};
    r.plainHashes=hashes(collect(await runSegment({...part,storage:new InMemoryStorage()})));
    r.deferredHashes=hashes(collect(await deferred(part)));
    const check=(label,fn)=>{try{fn();r.checks.push({label,pass:true});}
        catch(e){r.checks.push({label,pass:false,error:e.message});process.exitCode=1;}};
    const n=part.name,last=states.at(-1),fallen=states.find(s=>s.trapped>0&&s.traptype===C.TT_PIT);
    check('all five outputs preserve observer, deferred keys and a blocked final read',()=>{
        assert.deepEqual(r.hashes,r.plainHashes);assert.deepEqual(r.hashes,r.deferredHashes);
        if(input.unchangedOutputHashes[part.name])
            assert.deepEqual(r.hashes,input.unchangedOutputHashes[part.name]);
        for(const k of ['screens','cursors','slices','frames'])assert.equal(out[k].length,part.moves.length+1);
        assert.deepEqual(out.slices.flat(),out.rng);assert.ok(states.every(s=>!s.gameover));
    });
    check('normal producers establish the source branch',()=>{
        assert.ok(fallen,'pit entry reached');
        if(n.endsWith('-timed'))assert.equal(fallen.half,true);
        if(n.endsWith('-none'))assert.ok(states.every(s=>!s.half));
        if(n==='ball-behind'||n==='ball-impact')assert.ok(states.some(s=>!s.trapped&&s.ball
            &&s.ball.where===C.OBJ_FLOOR&&(s.ball.x!==s.x||s.ball.y!==s.y)));
        if(n==='ball-free-negative')assert.ok(states.every(s=>!s.ball));
        if(n.includes('selftouch'))assert.ok(states.some(s=>!s.trapped&&s.gloves?.type===O.LEATHER_GLOVES
            &&s.amulet?.type===O.AMULET_OF_LIFE_SAVING&&s.weapon?.type===
                (n==='corpse-selftouch'?O.CORPSE:O.LONG_SWORD)
            &&(n!=='corpse-selftouch'||s.weapon.corpse===P.PM_COCKATRICE)));
        if(n.startsWith('mounted'))assert.ok(states.some(s=>!s.trapped&&s.steed?.type===P.PM_PONY));
        if(n==='ranger-locate'){
            assert.equal(fallen.role,P.PM_RANGER);assert.deepEqual(fallen.level,fallen.qlocate);
        }
    });
    check('C source behavior and visible branch assertions',()=>{
        const local={branches:[input.branches[index]],requireBranchAssertions:true,
            branchAssertions:[{...input.branchAssertions[index],segment:0}]};
        assert.deepEqual(branchAssertionErrors(local,{segments:[{steps:out.screens.map(screen=>({screen}))}]}),[]);
        if(['spiked-pit-timed','spiked-pit-none','pit-timed','pit-none'].includes(n))
            assert.equal(last.max-last.hp,n.endsWith('timed')?1:2);
        if(n==='ball-behind'||n==='ball-impact'){
            assert.equal(last.ball.x,last.x);assert.equal(last.ball.y,last.y);
            assert.equal(last.chain.x,last.x);assert.equal(last.chain.y,last.y);
            assert.equal(last.max-last.hp,n==='ball-impact'?32:2);
        }
        if(n==='corpse-selftouch'){
            assert.equal(last.mortality,1);assert.equal(last.amulet,null);
            assert.equal(last.weapon?.corpse,P.PM_COCKATRICE);assert.equal(last.hp,last.max);
        }
        if(n==='weapon-selftouch-negative'){
            assert.equal(last.mortality,0);assert.equal(last.amulet?.type,O.AMULET_OF_LIFE_SAVING);
        }
        if(n.startsWith('mounted')){
            const mounted=states.find(s=>s.steed);assert.equal(last.hp,mounted.hp);
            assert.ok(last.steed.hp<mounted.steed.hp);
        }
        if(n==='ranger-locate')assert.equal(last.once,1);
    });
    reports.push(r);console.log(n,r.checks.filter(c=>c.pass).length+'/3');
}
clearTimeout(deadline);
const compact={evidence:'Keyboard-only JS reach controls; debug commands are inputs. Native comparison is separate.',
    passed:reports.flatMap(r=>r.checks).filter(c=>c.pass).length,
    total:reports.reduce((n,r)=>n+r.checks.length,0),reports};
assert.equal(reports.length,12);assert.equal(compact.total,36);
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(compact,null,2)+'\n');
console.log(JSON.stringify({passed:compact.passed,total:compact.total,cases:reports.length}));
