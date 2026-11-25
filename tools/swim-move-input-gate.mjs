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
const Y=await mod('youprop'),{grounded}=await mod('trap');
const {branchAssertionErrors,recordingIntegrityErrors}=await import(new URL('tools/gen-sessions/assertions.mjs',root));
const recipeBytes=fs.readFileSync(new URL('tools/gen-sessions/recipes/swim-move-danger.json',root));
const input=JSON.parse(recipeBytes);
assert.equal(createHash('sha256').update(recipeBytes).digest('hex'),'6b67edf29fd90780f5cbafd9d50bed15e97665bc700c21c9f7c2d1e281b68654','locked twelve-case recipe');
assert.deepEqual(Object.keys(input.unchangedOutputHashes).sort(),['pool-unknown','pool-bare','pool-m-prefix','known-floor','lava-unknown','lava-known-type-unknown-proof','lava-known-no-fire'].sort());
// Mandatory canonical C raw and complete input identity, before any JS replay.
const nativeBytes=fs.readFileSync(new URL('tools/gen-sessions/generated/swim-move-danger.session.json',root));
const nativeSHA256=createHash('sha256').update(nativeBytes).digest('hex');
assert.equal(nativeSHA256,'e787ca22b25aefc22966e02143d4be414854a64d14a9d7a92362f2ac856a8ae6','locked canonical C raw');
assert.equal(nativeBytes.length,2093999);
const native=JSON.parse(nativeBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(input,native),[]);
assert.equal(input.segments.length,12);assert.equal(native.segments.length,12);
assert.equal(input.branches.length,12);assert.equal(input.branchAssertions.length,12);
assert.equal(input.requireBranchAssertions,true);
for(let i=0;i<12;i++){
    const expected=input.segments[i],actual=native.segments[i];
    for(const field of ['name','seed','datetime','nethackrc','moves']){
        assert.equal(Object.hasOwn(actual,field),Object.hasOwn(expected,field),`input field presence ${i} ${field}`);
        assert.equal(Object.hasOwn(expected,field),true);
        assert.deepEqual(actual[field],expected[field],`input field value ${i} ${field}`);
    }
    assert.deepEqual(actual.steps.map(s=>s.key),[null,...expected.moves],`every key ${i}`);
}
assert.equal(native.segments.reduce((n,s)=>n+s.steps.length,0),1727);
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
assert.deepEqual(input.segments.map(p=>p.name),['pool-unknown','pool-known','pool-bare','pool-m-prefix','known-floor','lava-known-proof','lava-unknown','cobra-pool','blob-pool','clinger-breathing-pool','lava-known-type-unknown-proof','lava-known-no-fire']);
assert.equal(input.branches.length,12);assert.equal(input.branchAssertions.length,12);assert.equal(input.requireBranchAssertions,true);
assert.deepEqual(branchAssertionErrors(input),[]);
for(const [index,part] of input.segments.entries()){
    const states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let out;
    try{globalThis.__step_snapshot={step:'*',cb(g,step){
        const u=g.u,b=u.uarmf;states.push({step,x:u.ux,y:u.uy,moves:g.moves,form:u.umonnum,hp:u.uhp,mh:u.mh,
            water:!!u.uinwater,hidden:!!u.uundetected,grounded:grounded(g.youmonst.data),
            known:!!g.objects[O.WATER_WALKING_BOOTS].oc_name_known,
            boots:b?{type:b.otyp,letter:b.invlet,proof:!!b.oerodeproof,rknown:!!b.rknown}:null,
            fire:!!Y.Fire_resistance(),walking:!!Y.Wwalking(),breathing:!!Y.Breathless(),
            levitating:!!Y.Levitation(),flying:!!Y.Flying(),stunned:!!Y.Stunned(),confused:!!Y.Confusion(),
            fast:u.intrinsic?.HFast||0,target:g.level.at(42,5)?.typ,seen:!!g.level.at(42,5)?.seenv,tips:g.context.tips||0,
            breathingAmulet:!!(u.uamul?.otyp===O.AMULET_OF_MAGICAL_BREATHING),
            text:g._toplines||'',gameover:!!g.program_state?.gameover});
    }};out=collect(await runSegment({...part,storage:new InMemoryStorage()}));
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const last=states.at(-1),n=part.name,attemptStep=part.moves.length-5;
    const before=states.find(s=>s.step===attemptStep-1),after=states.find(s=>s.step===attemptStep);
    const r={name:n,evidence:'JS ordinary keyboard reach; native pending parent',keys:part.moves.length,
        boundaries:out.screens.length,calls:out.rng.length,frames:out.frames.flat().length,
        hashes:hashes(out),plainHashes:hashes(collect(await runSegment({...part,storage:new InMemoryStorage()}))),
        deferredHashes:hashes(collect(await deferred(part))),checks:[],before,after,last};
    const check=(label,fn)=>{try{fn();r.checks.push({label,pass:true});}catch(e){r.checks.push({label,pass:false,error:e.message});process.exitCode=1;}};
    check('observer, plain, deferred and exhausted input preserve all five outputs',()=>{
        assert.deepEqual(r.hashes,r.plainHashes);assert.deepEqual(r.hashes,r.deferredHashes);
        for(const k of ['screens','cursors','slices','frames'])assert.equal(out[k].length,part.moves.length+1);
        assert.deepEqual(out.slices.flat(),out.rng);assert.ok(states.every(s=>!s.gameover));
    });
    check('actual equipment/form producers and guard knowledge before liquid effects',()=>{
        assert.ok(before&&after);assert.match(last.text,/MacOS NetHack Version 5.0.0/);
        assert.equal(before.x,41);assert.equal(before.y,5);assert.equal(last.y,5);assert.equal(before.seen,true);
        assert.equal(before.target,n.startsWith('lava-')?C.LAVAPOOL:n==='known-floor'?C.FOUNTAIN:C.POOL);
        for(const k of ['levitating','flying','stunned','confused','water','hidden'])assert.equal(before[k],false,k);
        const form=n==='cobra-pool'?P.PM_COBRA:n==='blob-pool'?P.PM_ACID_BLOB:n==='clinger-breathing-pool'?P.PM_ROCK_PIERCER:P.PM_WIZARD;
        assert.equal(before.form,form);assert.equal(last.form,form);
        assert.equal(before.grounded,n!=='clinger-breathing-pool');
        const known=['pool-known','known-floor','lava-known-proof','lava-known-type-unknown-proof','lava-known-no-fire'].includes(n);
        assert.equal(before.known,known);
        if(['pool-bare','cobra-pool','blob-pool','clinger-breathing-pool'].includes(n)){
            assert.equal(before.boots,null);assert.equal(before.walking,false);
        }else{
            assert.equal(before.boots.type,O.WATER_WALKING_BOOTS);assert.equal(before.walking,true);
            assert.equal(before.boots.proof,true);
            assert.equal(before.boots.rknown,known&&n!=='lava-known-type-unknown-proof');
            assert.equal(before.boots.letter,n==='lava-known-type-unknown-proof'?'c':'a');
        }
        assert.equal(before.fire,n.startsWith('lava-')&&n!=='lava-known-no-fire');
        const permitted=['pool-known','pool-m-prefix','known-floor','lava-known-proof','clinger-breathing-pool'].includes(n);
        assert.equal(last.x,permitted?42:41);
        assert.equal(last.hp,before.hp);assert.equal(last.mh,before.mh);
        if(permitted){
            assert.ok(last.moves>before.moves);assert.ok(!states.some(s=>s.step>=attemptStep&&s.text.includes('You avoid ')));
        }else{
            assert.equal(last.moves,before.moves);
            const verb=n==='cobra-pool'?'slithering':n==='blob-pool'?'oozing':'stepping';
            const liquid=n.startsWith('lava-')?'molten lava':'pool of water';
            assert.ok(states.some(s=>s.step>=attemptStep&&s.text.includes(`You avoid ${verb} into the ${liquid}.`)));
        }
        if(n==='pool-m-prefix')assert.ok(last.tips&(1<<C.TIP_SWIM));
        if(n==='clinger-breathing-pool'){
            assert.equal(before.breathingAmulet,true);assert.equal(before.breathing,true);assert.ok(before.fast&C.TIMEOUT);
            assert.equal(last.hidden,false);assert.equal(last.water,true);
            assert.ok(states.some(s=>s.step>=attemptStep&&s.text.includes("But you aren't drowning.")));
        }else assert.equal(last.water,false);
    });
    check('visible branch requirements and unaffected output hashes',()=>{
        const local={branches:[input.branches[index]],requireBranchAssertions:true,branchAssertions:[{...input.branchAssertions[index],segment:0}]};
        assert.deepEqual(branchAssertionErrors(local,{segments:[{steps:out.screens.map(screen=>({screen}))}]}),[]);
        if(input.unchangedOutputHashes[n])assert.deepEqual(r.hashes,input.unchangedOutputHashes[n]);
    });
    reports.push(r);console.log(n,r.checks.filter(c=>c.pass).length+'/3');
}
clearTimeout(deadline);assert.equal(reports.length,12);
const report={evidence:'Canonical C raw/input integrity required; JS ordinary reach, native output comparison is parent work',
    recipeSHA256:createHash('sha256').update(recipeBytes).digest('hex'),nativeSHA256,
    passed:reports.flatMap(r=>r.checks).filter(c=>c.pass).length,total:36,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));
