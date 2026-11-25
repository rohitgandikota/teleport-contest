// Locked ordinary keyboard controls; native comparison belongs to parent.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url),mod=n=>import(new URL('js/'+n+'.js',root));
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const {runSegment,NethackGame}=await mod('jsmain'),{GameDisplay}=await mod('game_display');
const {InMemoryStorage}=await mod('storage'),{moveloop_core}=await mod('allmain');
const G=await mod('gstate'),C=await mod('const'),Y=await mod('youprop');
const {ONAMES:O}=await mod('objects_data'),{PMNAMES:P}=await mod('monst_data');
const {branchAssertionErrors,recordingIntegrityErrors}=await import(new URL('tools/gen-sessions/assertions.mjs',root));
const recipeBytes=fs.readFileSync(new URL('tools/gen-sessions/recipes/moverock-owner.json',root));
const input=JSON.parse(recipeBytes);
assert.equal(createHash('sha256').update(recipeBytes).digest('hex'),'46a85760942d97c5434aea341fb04e49a050f0a109a290bd999e3b3f21f93c3c');
assert.deepEqual(input.segments.map(s=>s.name),['level-migration','level-migration-later','plain-push','pit-fill','hole-fill','local-teleport','levitate','blind-known','soko-active','soko-finish-diagonal','soko-finish-giant','conjoined-pit-fill']);
assert.equal(input.requireBranchAssertions,true);assert.equal(input.branches.length,12);assert.equal(input.branchAssertions.length,12);
assert.deepEqual(branchAssertionErrors(input),[]);
assert.deepEqual(Object.keys(input.unchangedOutputHashes),['plain-push','pit-fill','hole-fill','local-teleport','levitate','blind-known','soko-active']);
// Mandatory canonical C lock before replay; this does not compare JS output to C.
const nativeBytes=fs.readFileSync(new URL('tools/gen-sessions/generated/moverock-owner.session.json',root));
assert.equal(createHash('sha256').update(nativeBytes).digest('hex'),'cb597ffbce6b3ca9d191c129f2eb75af6b5f58bda1d560bcd6c346fe7ce20edd');
assert.equal(nativeBytes.length,4018016);
const native=JSON.parse(nativeBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);
assert.deepEqual(recordingIntegrityErrors(native),[]);assert.deepEqual(branchAssertionErrors(input,native),[]);
assert.equal(native.segments.length,12);
for(let i=0;i<12;i++){
    const actual=native.segments[i],expected=input.segments[i];
    for(const field of ['name','seed','datetime','nethackrc','moves']){
        assert.equal(Object.hasOwn(expected,field),true);
        assert.equal(Object.hasOwn(actual,field),Object.hasOwn(expected,field),`input presence ${i} ${field}`);
        assert.deepEqual(actual[field],expected[field],`input value ${i} ${field}`);
    }
    assert.deepEqual(actual.steps.map(s=>s.key),[null,...expected.moves],`every supplied key ${i}`);
}
assert.equal(native.segments.reduce((n,s)=>n+s.steps.length,0),2081);
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
const deadline=setTimeout(()=>{console.error('55 second worker bound');process.exit(2);},55000),reports=[];
for(const [index,part] of input.segments.entries()){
    const states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let out,runError;
    try{globalThis.__step_snapshot={step:'*',cb(g,step){
        states.push({step,x:g.u.ux,y:g.u.uy,moves:g.moves,level:{...g.u.uz},rules:!!g.level.flags.sokoban_rules,
            hp:g.u.uhp,form:g.u.umonnum,luck:g.u.uluck,cheat:g.u.uconduct?.sokocheat||0,
            blind:!!Y.Blind(),levitating:!!Y.Levitation(),utrap:g.u.utrap,
            rocks:g.level.objects.filter(o=>o.otyp===O.BOULDER).map(o=>[o.ox,o.oy,o.next_boulder||0]),
            traps:g.level.traps.map(t=>[t.tx,t.ty,t.ttyp,t.conjoined||0,!!t.tseen]),
            migrating:(g.migrating_objs||[]).map(o=>[o.otyp,o.ox,o.oy,o.owornmask]),
            text:g._toplines||'',over:!!g.program_state?.gameover});
    }};out=collect(await runSegment({...part,storage:new InMemoryStorage()}));
    }catch(e){runError=e.message;}
    finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const n=part.name,last=states.at(-1),attempt=part.moves.length-(n.startsWith('soko-finish-')?7:5);
    const before=states.find(s=>s.step===attempt-1),after=states.find(s=>s.step===attempt);
    const r={name:n,keys:part.moves.length,boundaries:out?.screens.length,calls:out?.rng.length,frames:out?.frames.flat().length,
        error:runError,hashes:out&&hashes(out),before,after,last,checks:[]};
    const check=async(label,fn)=>{try{assert.ok(!runError,runError);await fn();r.checks.push({label,pass:true});}
        catch(e){r.checks.push({label,pass:false,error:e.message.slice(0,900)});process.exitCode=1;}};
    await check('observer, plain, deferred and exhausted input preserve five outputs',async()=>{
        r.plainHashes=hashes(collect(await runSegment({...part,storage:new InMemoryStorage()})));
        r.deferredHashes=hashes(collect(await deferred(part)));
        assert.deepEqual(r.hashes,r.plainHashes);assert.deepEqual(r.hashes,r.deferredHashes);
        for(const k of ['screens','cursors','slices','frames'])assert.equal(out[k].length,part.moves.length+1);
        assert.deepEqual(out.slices.flat(),out.rng);assert.ok(states.every(s=>!s.over));
    });
    await check('actual keyboard producers and C owner branch',()=>{
        assert.match(last.text,/MacOS NetHack Version 5.0.0/);assert.ok(last.hp>0);
        if(n.startsWith('level-migration')){
            assert.deepEqual(before.rocks,[[42,5,0]]);assert.ok(before.traps.some(t=>t[0]===43&&t[1]===5&&t[2]===C.LEVEL_TELEP));
            assert.deepEqual(last.migrating,[[O.BOULDER,0,n==='level-migration'?4:3,C.MIGR_RANDOM]]);
            assert.deepEqual(last.rocks,[]);assert.equal(last.x,42);assert.equal(last.y,5);
            assert.ok(last.traps.some(t=>t[2]===C.LEVEL_TELEP&&t[4]));
        }else if(n==='conjoined-pit-fill'){
            assert.ok(states.some(s=>s.traps.some(t=>t[0]===41&&t[2]===C.PIT&&(t[3]&(1<<C.DIR_E)))
                &&s.traps.some(t=>t[0]===42&&t[2]===C.PIT&&(t[3]&(1<<C.DIR_W)))));
            assert.equal(last.utrap,0);assert.equal(last.x,42);assert.equal(last.y,5);assert.deepEqual(last.rocks,[]);
            assert.ok(last.traps.some(t=>t[0]===41&&t[2]===C.PIT&&t[3]===0));assert.ok(!last.traps.some(t=>t[0]===42));
        }else if(n.startsWith('soko-finish-')){
            assert.ok(states.some(s=>s.rules&&s.traps.filter(t=>t[2]===C.PIT).length===9));
            const cleared=states.findIndex((s,i)=>i>0&&states[i-1].rules&&!s.rules);assert.ok(cleared>0);
            r.completion={before:states[cleared-1],after:states[cleared]};
            assert.equal(states[cleared-1].traps.filter(t=>t[2]===C.PIT).length,1);
            assert.match(states[cleared].text,/The boulder fills a pit/);
            assert.equal(last.rules,false);assert.equal(last.traps.filter(t=>t[2]===C.PIT||t[2]===C.HOLE).length,0);
            assert.equal(last.level.dnum,before.level.dnum);assert.equal(last.level.dlevel,4);
            assert.equal(last.cheat,4);assert.equal(last.luck,-4);
            if(n==='soko-finish-diagonal'){
                assert.equal(before.x,34);assert.equal(before.y,8);assert.equal(last.x,35);assert.equal(last.y,7);
                assert.ok(before.rocks.some(o=>o[0]===35&&o[1]===7));assert.ok(last.rocks.some(o=>o[0]===36&&o[1]===6));
                assert.ok(!states.slice(cleared).some(s=>s.text.includes("won't roll diagonally")));
            }else{
                assert.equal(before.form,P.PM_HILL_GIANT);assert.equal(last.form,P.PM_HILL_GIANT);
                assert.equal(last.x,42);assert.equal(last.y,15);
                assert.ok(states.slice(cleared).some(s=>s.text.includes('However, you maneuver over it and could pick it up.')));
            }
        }else if(n==='soko-active'){
            assert.equal(before.rules,true);assert.equal(last.rules,true);assert.equal(last.cheat,1);assert.equal(last.luck,-1);
            assert.equal(last.x,35);assert.equal(last.y,7);assert.ok(last.rocks.some(o=>o[0]===35&&o[1]===7));
        }else{
            assert.equal(last.y,5);assert.equal(last.rules,false);
            if(['plain-push','blind-known'].includes(n)){
                assert.deepEqual(before.rocks,[[41,5,0]]);assert.deepEqual(last.rocks,[[42,5,0]]);assert.equal(last.x,41);
                assert.equal(before.blind,n==='blind-known');
            }else if(['pit-fill','hole-fill'].includes(n)){
                assert.deepEqual(before.rocks,[[41,5,0]]);assert.deepEqual(last.rocks,[]);assert.equal(last.x,41);
                assert.ok(before.traps.some(t=>t[0]===42&&t[2]===(n==='pit-fill'?C.PIT:C.HOLE)));
                assert.ok(!last.traps.some(t=>t[0]===42));
            }else if(n==='levitate'){
                assert.equal(before.levitating,true);assert.equal(last.levitating,true);assert.equal(last.x,40);
                assert.deepEqual(last.rocks,[[41,5,0]]);
            }else if(n==='local-teleport'){
                assert.equal(last.x,42);assert.equal(last.rocks.length,1);assert.ok(last.rocks[0][0]!==42||last.rocks[0][1]!==5);
                assert.ok(last.traps.some(t=>t[2]===C.TELEP_TRAP&&t[4]));assert.deepEqual(last.migrating,[]);
            }else assert.fail('missing primary case '+n);
        }
    });
    await check('required visible branch and unaffected output hashes',()=>{
        const local={branches:[input.branches[index]],requireBranchAssertions:true,branchAssertions:[{...input.branchAssertions[index],segment:0}]};
        assert.deepEqual(branchAssertionErrors(local,{segments:[{steps:out.screens.map(screen=>({screen}))}]}),[]);
        if(input.unchangedOutputHashes[n])assert.deepEqual(r.hashes,input.unchangedOutputHashes[n]);
    });
    reports.push(r);console.log(n,r.checks.filter(c=>c.pass).length+'/3',runError||'');
}
clearTimeout(deadline);assert.equal(reports.length,12);
const report={evidence:'Locked normal debug-startup keyboard inputs, read-only observation; native pending parent',
    recipeSHA256:createHash('sha256').update(recipeBytes).digest('hex'),passed:reports.flatMap(r=>r.checks).filter(c=>c.pass).length,total:36,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));
