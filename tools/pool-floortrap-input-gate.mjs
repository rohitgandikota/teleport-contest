// Locked C inputs and ordinary keyboard producers. Native comparison belongs to parent.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url),mod=n=>import(new URL('js/'+n+'.js',root));
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const {runSegment,NethackGame}=await mod('jsmain'),{GameDisplay}=await mod('game_display');
const {InMemoryStorage}=await mod('storage'),{moveloop_core}=await mod('allmain');
const G=await mod('gstate'),C=await mod('const'),Y=await mod('youprop'),{ONAMES:O}=await mod('objects_data');
const {branchAssertionErrors,recordingIntegrityErrors}=await import(new URL('tools/gen-sessions/assertions.mjs',root));
const bytes=fs.readFileSync(new URL('tools/gen-sessions/recipes/pool-floortrap.json',root));
const input=JSON.parse(bytes),recipeSHA256=createHash('sha256').update(bytes).digest('hex');
assert.equal(recipeSHA256,'4ac2b2343965e1311dcb656ddfb14ac0049fa74e9ba3f0c3779c57c6b852ff1a');
assert.deepEqual(input.segments.map(s=>s.name),['arrow-drop','pit-drop','web-drop','bear-levitation-drop','plain-push','blind-known']);
assert.equal(input.requireBranchAssertions,true);assert.equal(input.branches.length,6);assert.equal(input.branchAssertions.length,6);assert.deepEqual(branchAssertionErrors(input),[]);
// The maintained primary recipe carries the reviewed C terminal coordinates.
const requirements=input;
assert.deepEqual(Object.keys(input.unchangedOutputHashes),['plain-push','blind-known']);
const tuples=input.segments.map(s=>['name','seed','datetime','nethackrc','moves'].map(k=>{assert.ok(Object.hasOwn(s,k));return s[k];}));
assert.equal(createHash('sha256').update(JSON.stringify(tuples)).digest('hex'),'a560b8ae7f1c5e51251753c0edf340c4ca50f3b752b67028b54f0e6f32430e60');
// Mandatory canonical C lock before replay; no JS-to-C output comparison here.
const nativeBytes=fs.readFileSync(new URL('tools/gen-sessions/generated/pool-floortrap.session.json',root));
assert.equal(createHash('sha256').update(nativeBytes).digest('hex'),'92212252b87118670a9b0169152c57f827f53fb593127f04dba6c4551bfd0ece','locked canonical C raw');
assert.equal(nativeBytes.length,849472);
const native=JSON.parse(nativeBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);
assert.deepEqual(recordingIntegrityErrors(native),[]);assert.deepEqual(branchAssertionErrors(requirements,native),[]);
assert.equal(input.segments.length,6);assert.equal(native.segments.length,6);
for(let i=0;i<6;i++){
    const actual=native.segments[i],expected=input.segments[i];
    for(const field of ['name','seed','datetime','nethackrc','moves']){
        assert.equal(Object.hasOwn(expected,field),true);
        assert.equal(Object.hasOwn(actual,field),Object.hasOwn(expected,field),`input presence ${i} ${field}`);
        assert.deepEqual(actual[field],expected[field],`input value ${i} ${field}`);
    }
    assert.deepEqual(actual.steps.map(s=>s.key),[null,...expected.moves],`every supplied key ${i}`);
}
assert.equal(native.segments.reduce((n,s)=>n+s.steps.length,0),505);
assert.equal(input.segments.reduce((n,s)=>n+s.moves.length,0),499);
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
    try{globalThis.__step_snapshot={step:'*',cb(g,step){states.push({step,x:g.u.ux,y:g.u.uy,moves:g.moves,hp:g.u.uhp,
        utrap:g.u.utrap||0,ttype:g.u.utraptype||0,lev:!!Y.Levitation(),blind:!!Y.Blind(),
        terrain:g.level.at(41,5).typ,traps:g.level.traps.filter(t=>t.tx===41&&t.ty===5).map(t=>t.ttyp),
        ring:g.u.uleft?.otyp||null,rocks:g.level.objects.filter(o=>o.otyp===O.BOULDER).map(o=>[o.ox,o.oy,o.next_boulder||0]),
        text:g._toplines||'',over:!!g.program_state?.gameover});}};
        out=collect(await runSegment({...part,storage:new InMemoryStorage()}));
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const before=states.find(s=>s.step===part.moves.indexOf('\x17boulder\r')+8),last=states.at(-1);
    const r={name:part.name,keys:part.moves.length,boundaries:out.screens.length,calls:out.rng.length,frames:out.frames.flat().length,
        hashes:hashes(out),plainHashes:hashes(collect(await runSegment({...part,storage:new InMemoryStorage()}))),deferredHashes:hashes(collect(await deferred(part))),before,last,checks:[]};
    const check=(label,fn)=>{try{fn();r.checks.push({label,pass:true});}catch(e){r.checks.push({label,pass:false,error:e.message});process.exitCode=1;}};
    check('observer, plain and deferred EOF preserve all five outputs',()=>{
        assert.deepEqual(r.hashes,r.plainHashes);assert.deepEqual(r.hashes,r.deferredHashes);
        for(const k of ['screens','cursors','slices','frames'])assert.equal(out[k].length,part.moves.length+1);
        assert.deepEqual(out.slices.flat(),out.rng);assert.ok(states.every(s=>!s.over&&s.hp>0));
    });
    check('actual trap, liquid, dropped boulder and release producers',()=>{
        assert.equal(before.x,41);assert.equal(before.y,5);assert.equal(before.rocks.length,0);
        assert.match(last.text,/MacOS NetHack Version 5.0.0/);assert.equal(last.y,5);
        if(index<4){
            const typ=[C.ARROW_TRAP,C.PIT,C.WEB,C.BEAR_TRAP][index];
            assert.equal(before.terrain,C.POOL);assert.deepEqual(before.traps,[typ]);assert.equal(before.lev,false);
            if(index>0){assert.ok(before.utrap>0);assert.equal(before.ttype,[0,C.TT_PIT,C.TT_WEB,C.TT_BEARTRAP][index]);}
            if(index===3)assert.equal(before.ring,O.RIN_LEVITATION);
            assert.equal(last.terrain,C.ROOM);assert.equal(last.rocks.length,0);assert.equal(last.utrap,0);assert.equal(last.ttype,C.TT_NONE);
            assert.equal(last.x,index===0?41:40);assert.equal(last.lev,index===3);
            assert.deepEqual(last.traps,index===0?[C.ARROW_TRAP]:[]);
            assert.ok(states.some(s=>s.text.includes('There is a large splash as the boulder fills the pool of water.')));
            if(index===0)assert.ok(states.some(s=>s.text.includes('An arrow shoots out at you!')));
            if(index===3){
                const released=states.findIndex(s=>s.text.includes('You start to float in the air!'));
                const splashed=states.findIndex(s=>s.text.includes('There is a large splash'));
                assert.ok(released>=0&&splashed>released);assert.equal(states[released].utrap,0);assert.equal(states[released].lev,true);
            }
        }else{
            assert.equal(last.x,41);assert.equal(last.blind,index===5);assert.deepEqual(last.rocks,[[42,5,0]]);
            assert.ok(states.some(s=>s.text.includes('With great effort you move the boulder.')));
        }
    });
    check('mandatory branches and unchanged negative hashes',()=>{
        const local={branches:[requirements.branches[index]],requireBranchAssertions:true,branchAssertions:[{...requirements.branchAssertions[index],segment:0}]};
        assert.deepEqual(branchAssertionErrors(local,{segments:[{steps:out.screens.map(screen=>({screen}))}]}),[]);
        if(input.unchangedOutputHashes[part.name])assert.deepEqual(r.hashes,input.unchangedOutputHashes[part.name]);
    });
    reports.push(r);console.log(part.name,r.checks.filter(c=>c.pass).length+'/3');
}
clearTimeout(deadline);assert.equal(reports.length,6);
const report={evidence:'Normal debug-startup keyboard producers; native pending parent',recipeSHA256,passed:reports.flatMap(r=>r.checks).filter(c=>c.pass).length,total:18,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));
