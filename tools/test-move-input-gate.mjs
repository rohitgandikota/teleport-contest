// Locked ordinary keyboard proposals. Read-only observer, plain/deferred equality.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url),mod=n=>import(new URL('js/'+n+'.js',root));
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const {runSegment,NethackGame}=await mod('jsmain'),{GameDisplay}=await mod('game_display');
const {InMemoryStorage}=await mod('storage'),{moveloop_core}=await mod('allmain');
const G=await mod('gstate'),C=await mod('const'),{PMNAMES:P}=await mod('monst_data');
const {branchAssertionErrors,recordingIntegrityErrors}=await import(new URL('tools/gen-sessions/assertions.mjs',root));
const recipeBytes=fs.readFileSync(new URL('tools/gen-sessions/recipes/test-move-owner.json',root));
const input=JSON.parse(recipeBytes);
assert.equal(createHash('sha256').update(recipeBytes).digest('hex'),'5dad11fb5d6f706738e93a1e222cf53ba688d7076ed66ae7626f382be5ea13f3','locked nine-case recipe');
assert.deepEqual(Object.keys(input.unchangedOutputHashes).sort(),['autoopen-off','xorn-door','open-door-negative','plain-floor-negative'].sort());
// Mandatory canonical C raw and complete input identity, before any JS replay.
const nativeBytes=fs.readFileSync(new URL('tools/gen-sessions/generated/test-move-owner.session.json',root));
const nativeSHA256=createHash('sha256').update(nativeBytes).digest('hex');
assert.equal(nativeSHA256,'90e2af26397f417de65c0cf95e8fc640bf8c2263f189c58fea96d27c7c36d95e','locked canonical C raw');
const native=JSON.parse(nativeBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(input,native),[]);
assert.equal(input.segments.length,9);assert.equal(native.segments.length,9);
assert.equal(input.branches.length,9);assert.equal(input.branchAssertions.length,9);
assert.equal(input.requireBranchAssertions,true);
for(let i=0;i<9;i++){
    const expected=input.segments[i],actual=native.segments[i];
    for(const field of ['name','seed','datetime','nethackrc','moves']){
        assert.equal(Object.hasOwn(actual,field),Object.hasOwn(expected,field),`input field presence ${i} ${field}`);
        assert.equal(Object.hasOwn(expected,field),true);
        assert.deepEqual(actual[field],expected[field],`input field value ${i} ${field}`);
    }
    assert.deepEqual(actual.steps.map(s=>s.key),[null,...expected.moves],`every key ${i}`);
}
assert.equal(native.segments.reduce((n,s)=>n+s.steps.length,0),759);
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

const deadline=setTimeout(()=>{console.error('55 second worker bound');process.exit(2);},55000);
const reports=[];
assert.deepEqual(input.segments.map(p=>p.name),['door-open-enter','autoopen-off','pit-door-climb','pit-door-escape-open','web-door-climb','rock-mole-door','xorn-door','open-door-negative','plain-floor-negative']);
for(const [index,part] of input.segments.entries()){
    const states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let out;
    try{globalThis.__step_snapshot={step:'*',cb(g,step){
        const u=g.u;states.push({step,x:u.ux,y:u.uy,trap:u.utrap||0,type:u.utraptype,form:u.umonnum,
            door:g.level.at(42,5)?.typ,mask:g.level.at(42,5)?.doormask,food:u.uconduct.food,
            effort:g.context.digging?.effort,gameover:!!g.program_state?.gameover});
    }};out=collect(await runSegment({...part,storage:new InMemoryStorage()}));
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const last=states.at(-1),n=part.name;
    const r={name:n,evidence:'Canonical C input identity required; JS reach measured, native output comparison is parent work',
        keys:part.moves.length,boundaries:out.screens.length,calls:out.rng.length,frames:out.frames.flat().length,
        hashes:hashes(out),plainHashes:hashes(collect(await runSegment({...part,storage:new InMemoryStorage()}))),
        deferredHashes:hashes(collect(await deferred(part))),checks:[],last};
    const check=(label,fn)=>{try{fn();r.checks.push({label,pass:true});}catch(e){r.checks.push({label,pass:false,error:e.message});process.exitCode=1;}};
    check('observer, plain, deferred and exhausted input preserve all five outputs',()=>{
        assert.deepEqual(r.hashes,r.plainHashes);assert.deepEqual(r.hashes,r.deferredHashes);
        for(const k of ['screens','cursors','slices','frames'])assert.equal(out[k].length,part.moves.length+1);
        assert.deepEqual(out.slices.flat(),out.rng);assert.ok(states.every(s=>!s.gameover));
    });
    check('real producer and C movement state ordering',()=>{
        assert.equal(last.y,5);
        if(n!=='plain-floor-negative')assert.ok(states.some(s=>s.x===41&&s.door===C.DOOR&&s.mask===(n==='open-door-negative'?C.D_ISOPEN:C.D_CLOSED)));
        if(n.startsWith('pit-')||n.startsWith('web-')){
            const kind=n.startsWith('pit-')?C.TT_PIT:C.TT_WEB;
            assert.ok(states.some(s=>s.x===41&&s.trap>0&&s.type===kind&&s.mask===C.D_CLOSED));
            if(n==='pit-door-escape-open'){
                const escaped=states.find(s=>s.x===41&&s.trap===0&&s.type===C.TT_NONE&&s.mask===C.D_CLOSED);
                assert.ok(escaped);const opened=states.find(s=>s.step>escaped.step&&s.x===41&&s.mask===C.D_ISOPEN);
                assert.ok(opened);assert.ok(states.some(s=>s.step>opened.step&&s.x===42));assert.equal(last.x,42);
            }else {assert.equal(last.x,41);assert.equal(last.mask,C.D_CLOSED);assert.equal(last.trap,n.startsWith('pit-')?1:3);}
        }else if(n==='rock-mole-door'){
            assert.ok(states.some(s=>s.form===P.PM_ROCK_MOLE&&s.x===41&&s.effort===60));
            assert.ok(states.some(s=>s.form===P.PM_ROCK_MOLE&&s.x===41&&s.effort===90));
            assert.equal(last.x,42);assert.equal(last.mask,C.D_BROKEN);assert.equal(last.form,P.PM_ROCK_MOLE);assert.equal(last.food,1);
        }else if(n==='xorn-door'){
            assert.equal(last.form,P.PM_XORN);assert.equal(last.x,42);assert.equal(last.mask,C.D_CLOSED);
        }else if(n==='autoopen-off'){assert.equal(last.x,41);assert.equal(last.mask,C.D_CLOSED);}
        else if(n==='door-open-enter'){assert.equal(last.x,43);assert.equal(last.mask,C.D_ISOPEN);}
        else {assert.equal(last.x,42);if(n==='open-door-negative')assert.equal(last.mask,C.D_ISOPEN);}
    });
    check('visible branch requirements and unaffected output hashes',()=>{
        const local={branches:[input.branches[index]],requireBranchAssertions:true,branchAssertions:[{...input.branchAssertions[index],segment:0}]};
        assert.deepEqual(branchAssertionErrors(local,{segments:[{steps:out.screens.map(screen=>({screen}))}]}),[]);
        if(input.unchangedOutputHashes?.[n])assert.deepEqual(r.hashes,input.unchangedOutputHashes[n]);
    });
    reports.push(r);console.log(n,r.checks.filter(c=>c.pass).length+'/3');
}
clearTimeout(deadline);assert.equal(reports.length,9);
const report={evidence:'Canonical C raw/input integrity required; JS ordinary reach, native output comparison is parent work',
    recipeSHA256:createHash('sha256').update(recipeBytes).digest('hex'),nativeSHA256,
    passed:reports.flatMap(r=>r.checks).filter(c=>c.pass).length,total:27,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));
