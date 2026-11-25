// Canonical C input lock; supplemental ordinary xname observer, plain and deferred controls.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url),mod=n=>import(new URL('js/'+n+'.js',root));
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const {runSegment,NethackGame}=await mod('jsmain'),{GameDisplay}=await mod('game_display');
const {InMemoryStorage}=await mod('storage'),{moveloop_core}=await mod('allmain');
const G=await mod('gstate'),{Blind}=await mod('youprop'),{ONAMES:O}=await mod('objects_data');
const {branchAssertionErrors,recordingIntegrityErrors}=await import(new URL('tools/gen-sessions/assertions.mjs',root));
const bytes=fs.readFileSync(new URL('tools/gen-sessions/recipes/moverock-next-boulder.json',root));
const input=JSON.parse(bytes),recipeSHA256=createHash('sha256').update(bytes).digest('hex');
assert.equal(recipeSHA256,'5e44e3ded22bcfd355415b31c16dd129a4e43c413c07d7157cf685434ce56a39');
assert.deepEqual(input.segments.map(s=>s.name),['two-boulders','two-boulders-blind','plain-push','blind-known']);
assert.equal(input.requireBranchAssertions,true);assert.equal(input.branches.length,4);assert.equal(input.branchAssertions.length,4);assert.deepEqual(branchAssertionErrors(input),[]);
assert.deepEqual(Object.keys(input.unchangedOutputHashes),['plain-push','blind-known']);
// Mandatory canonical C lock before replay; this does not compare JS output to C.
const nativeBytes=fs.readFileSync(new URL('tools/gen-sessions/generated/moverock-next-boulder.session.json',root));
assert.equal(createHash('sha256').update(nativeBytes).digest('hex'),'620dd1050d644f6c56b9818350d41a30114c953191a64df59fd8850ff040a354','locked canonical C raw');
assert.equal(nativeBytes.length,549886);
const native=JSON.parse(nativeBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);
assert.deepEqual(recordingIntegrityErrors(native),[]);assert.deepEqual(branchAssertionErrors(input,native),[]);
assert.equal(input.segments.length,4);assert.equal(native.segments.length,4);
for(let i=0;i<4;i++){
    const actual=native.segments[i],expected=input.segments[i];
    for(const field of ['name','seed','datetime','nethackrc','moves']){
        assert.equal(Object.hasOwn(expected,field),true);
        assert.equal(Object.hasOwn(actual,field),Object.hasOwn(expected,field),`input presence ${i} ${field}`);
        assert.deepEqual(actual[field],expected[field],`input value ${i} ${field}`);
    }
    assert.deepEqual(actual.steps.map(s=>s.key),[null,...expected.moves],`every supplied key ${i}`);
}
assert.equal(native.segments.reduce((n,s)=>n+s.steps.length,0),302);
assert.equal(input.segments.reduce((n,s)=>n+s.moves.length,0),298);
const collect=r=>({screens:r.getScreens(),cursors:r.getCursors(),rng:[...r.getRngLog()],slices:r.getRngSlices(),frames:r.getAnimationFramesByStep()});
const hashes=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,createHash('sha256').update(JSON.stringify(v)).digest('hex')]));
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
const reports=[],deadline=setTimeout(()=>{console.error('30 second bound');process.exit(2);},30000);
for(const [index,part] of input.segments.entries()){
    const states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let out;
    try{globalThis.__step_snapshot={step:'*',cb(g,step){states.push({step,x:g.u.ux,y:g.u.uy,moves:g.moves,blind:!!Blind(),
        rocks:g.level.objects.filter(o=>o.otyp===O.BOULDER).map(o=>[o.ox,o.oy,o.next_boulder||0]),text:g._toplines||'',over:!!g.program_state?.gameover});}};
        out=collect(await runSegment({...part,storage:new InMemoryStorage()}));
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const before=states.find(s=>s.step===part.moves.length-6),last=states.at(-1),multiple=index<2,blind=index===1||index===3;
    const r={name:part.name,keys:part.moves.length,boundaries:out.screens.length,calls:out.rng.length,frames:out.frames.flat().length,
        hashes:hashes(out),plainHashes:hashes(collect(await runSegment({...part,storage:new InMemoryStorage()}))),deferredHashes:hashes(collect(await deferred(part))),before,last,checks:[]};
    const check=(label,fn)=>{try{fn();r.checks.push({label,pass:true});}catch(e){r.checks.push({label,pass:false,error:e.message});process.exitCode=1;}};
    check('observer, plain and deferred EOF preserve all five outputs',()=>{
        assert.deepEqual(r.hashes,r.plainHashes);assert.deepEqual(r.hashes,r.deferredHashes);
        for(const k of ['screens','cursors','slices','frames'])assert.equal(out[k].length,part.moves.length+1);
        assert.deepEqual(out.slices.flat(),out.rng);assert.ok(states.every(s=>!s.over));
    });
    check('actual wished pile producer, single-use feedback and cleanup',()=>{
        assert.equal(before.x,40);assert.equal(before.y,5);assert.equal(before.blind,blind);
        assert.equal(before.rocks.length,multiple?2:1);assert.ok(before.rocks.every(o=>o[0]===41&&o[1]===5));
        assert.equal(last.rocks.length,multiple?2:1);assert.ok(last.rocks.every(o=>o[2]===0));
        assert.equal(last.x,multiple&&blind?40:41);assert.equal(last.y,5);
        assert.ok(last.rocks.some(o=>o[0]===42&&o[1]===5));
        if(multiple){assert.ok(last.rocks.some(o=>o[0]===41&&o[1]===5));
            assert.ok(states.some(s=>s.text.includes('You try to move the next boulder, but in vain.')));
            if(!blind)assert.ok(states.some(s=>s.text.includes('You see here a boulder.')));
        }else assert.ok(!states.some(s=>s.text.includes('next boulder')));
        assert.match(last.text,/MacOS NetHack Version 5.0.0/);
    });
    check('mandatory branches and unchanged negative hashes',()=>{
        const local={branches:[input.branches[index]],requireBranchAssertions:true,branchAssertions:[{...input.branchAssertions[index],segment:0}]};
        assert.deepEqual(branchAssertionErrors(local,{segments:[{steps:out.screens.map(screen=>({screen}))}]}),[]);
        if(input.unchangedOutputHashes[part.name])assert.deepEqual(r.hashes,input.unchangedOutputHashes[part.name]);
    });
    reports.push(r);console.log(part.name,r.checks.filter(c=>c.pass).length+'/3');
}
clearTimeout(deadline);assert.equal(reports.length,4);
const report={evidence:'Supplemental normal debug-startup keyboard inputs; native pending parent',recipeSHA256,passed:reports.flatMap(r=>r.checks).filter(c=>c.pass).length,total:12,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));
