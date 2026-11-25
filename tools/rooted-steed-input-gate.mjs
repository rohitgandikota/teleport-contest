// Canonical C input lock; ordinary JS observer, plain and deferred controls.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url),mod=n=>import(new URL('js/'+n+'.js',root));
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const {runSegment,NethackGame}=await mod('jsmain'),{GameDisplay}=await mod('game_display');
const {InMemoryStorage}=await mod('storage'),{moveloop_core}=await mod('allmain');
const G=await mod('gstate'),C=await mod('const'),{PMNAMES:P}=await mod('monst_data'),{ONAMES:O}=await mod('objects_data');
const {branchAssertionErrors,recordingIntegrityErrors}=await import(new URL('tools/gen-sessions/assertions.mjs',root));
const recipeBytes=fs.readFileSync(new URL('tools/gen-sessions/recipes/rooted-steed-guards.json',root));
const input=JSON.parse(recipeBytes);
assert.equal(createHash('sha256').update(recipeBytes).digest('hex'),'18ee791a7635ffb35ee80c90917fdd1a88b70fbd9fe08bb3537b6254448408e6','locked nine-case recipe');
assert.deepEqual(Object.keys(input.unchangedOutputHashes).sort(),['mobile-lichen-negative','root-stairs-negative','steed-awake-negative','steed-saddle-negative'].sort());
// Mandatory canonical C raw and complete input identity, before any JS replay.
const nativeBytes=fs.readFileSync(new URL('tools/gen-sessions/generated/rooted-steed-guards.session.json',root));
const nativeSHA256=createHash('sha256').update(nativeBytes).digest('hex');
assert.equal(nativeSHA256,'ec633a96a3dea70319fb5e92d9cd93479804f8ca924a97ee4aa2b0bd78906f54','locked canonical C raw');
assert.equal(nativeBytes.length,1570583);
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
assert.equal(native.segments.reduce((n,s)=>n+s.steps.length,0),1240);
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
assert.deepEqual(input.segments.map(p=>p.name),['root-ground','root-door','root-levitating','steed-paralysis','steed-sleep','mobile-lichen-negative','root-stairs-negative','steed-awake-negative','steed-saddle-negative']);
assert.equal(input.branches.length,9);assert.equal(input.branchAssertions.length,9);assert.equal(input.requireBranchAssertions,true);
for(const [index,part] of input.segments.entries()){
    const states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let out;
    try{globalThis.__step_snapshot={step:'*',cb(g,step){
        const u=g.u,m=u.usteed;states.push({step,x:u.ux,y:u.uy,form:u.umonnum,moves:g.moves,
            fast:u.intrinsic?.HFast||0,lev:u.intrinsic?.HLevitation||0,text:g._toplines||'',
            door:g.level.at(42,5)?.typ,mask:g.level.at(42,5)?.doormask,
            freeRing:(g.invent||[]).some(o=>o.otyp===O.RIN_FREE_ACTION&&(o.owornmask&C.W_RING)),
            steed:m?{id:m.m_id,x:m.mx,y:m.my,mobile:!!m.mcanmove,frozen:m.mfrozen||0,sleep:!!m.msleeping,eating:m.meating||0}:null,
            gameover:!!g.program_state?.gameover});
    }};out=collect(await runSegment({...part,storage:new InMemoryStorage()}));
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const last=states.at(-1),n=part.name,attemptStep=part.moves.length-5;
    const before=states.find(s=>s.step===attemptStep-1),after=states.find(s=>s.step===attemptStep);
    const r={name:n,evidence:'Canonical C input identity required; JS reach measured, native output comparison is parent work',keys:part.moves.length,
        boundaries:out.screens.length,calls:out.rng.length,frames:out.frames.flat().length,
        hashes:hashes(out),plainHashes:hashes(collect(await runSegment({...part,storage:new InMemoryStorage()}))),
        deferredHashes:hashes(collect(await deferred(part))),checks:[],before,after,last};
    const check=(label,fn)=>{try{fn();r.checks.push({label,pass:true});}catch(e){r.checks.push({label,pass:false,error:e.message});process.exitCode=1;}};
    check('observer, plain, deferred and exhausted input preserve all five outputs',()=>{
        assert.deepEqual(r.hashes,r.plainHashes);assert.deepEqual(r.hashes,r.deferredHashes);
        for(const k of ['screens','cursors','slices','frames'])assert.equal(out[k].length,part.moves.length+1);
        assert.deepEqual(out.slices.flat(),out.rng);assert.ok(states.every(s=>!s.gameover));
    });
    check('actual form or mounted status producer and C guard ordering',()=>{
        assert.ok(before&&after);assert.match(last.text,/MacOS NetHack Version 5.0.0/);
        if(n.startsWith('root-')||n==='mobile-lichen-negative'){
            const pm=n==='root-door'?P.PM_BLUE_JELLY:n==='mobile-lichen-negative'?P.PM_LICHEN:P.PM_BROWN_MOLD;
            assert.equal(before.form,pm);assert.equal(last.form,pm);assert.equal(before.x,41);assert.equal(before.y,5);
            assert.ok(before.fast&C.TIMEOUT);assert.equal(last.y,5);
            if(n==='root-levitating')assert.ok(before.lev&C.TIMEOUT);
            assert.equal(last.x,n==='mobile-lichen-negative'?42:41);
            if(n==='root-door'){assert.equal(before.door,C.DOOR);assert.equal(before.mask,C.D_CLOSED);assert.equal(last.mask,C.D_CLOSED);}
            if(n!=='mobile-lichen-negative')assert.ok(states.some(s=>s.text.includes(n==='root-levitating'?'You are rooted in place.':'You are rooted to the ground.')));
        }else{
            assert.ok(before.steed);assert.equal(before.x,48);assert.equal(before.y,14);
            assert.ok(states.some(s=>s.steed?.id===before.steed.id&&s.steed.mobile));
            assert.equal(last.steed.id,before.steed.id);assert.equal(last.y,14);
            if(n==='steed-paralysis'||n==='steed-sleep'){
                assert.equal(before.freeRing,true);assert.equal(before.steed.mobile,false);assert.ok(before.steed.frozen>0);
                assert.equal(last.x,48);assert.equal(last.steed.x,48);
                assert.ok(states.some(s=>s.text.includes("Your pony won't move!")));
                assert.ok(after.moves>=before.moves); // guard consumes movement time; sleep may end during it
            }else{
                assert.equal(before.steed.mobile,true);assert.equal(before.steed.sleep,false);
                assert.equal(last.x,49);assert.equal(last.steed.x,49);
            }
        }
    });
    check('visible branch requirements and unaffected output hashes',()=>{
        const local={branches:[input.branches[index]],requireBranchAssertions:true,branchAssertions:[{...input.branchAssertions[index],segment:0}]};
        assert.deepEqual(branchAssertionErrors(local,{segments:[{steps:out.screens.map(screen=>({screen}))}]}),[]);
        if(input.unchangedOutputHashes[n])assert.deepEqual(r.hashes,input.unchangedOutputHashes[n]);
    });
    reports.push(r);console.log(n,r.checks.filter(c=>c.pass).length+'/3');
}
clearTimeout(deadline);assert.equal(reports.length,9);
const report={evidence:'Canonical C raw/input integrity required; JS ordinary reach, native output comparison is parent work',
    recipeSHA256:createHash('sha256').update(recipeBytes).digest('hex'),nativeSHA256,
    passed:reports.flatMap(r=>r.checks).filter(c=>c.pass).length,total:27,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));
