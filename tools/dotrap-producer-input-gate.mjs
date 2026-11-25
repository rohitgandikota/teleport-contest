// Keyboard-only producers; the observer reads state and never changes it.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url);
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'),
    'Usage: node tools/dotrap-producer-input-gate.mjs [compact-report.json]');
const mod=name=>import(new URL('js/'+name+'.js',root));
const {runSegment,NethackGame}=await mod('jsmain');
const {GameDisplay}=await mod('game_display'),{InMemoryStorage}=await mod('storage');
const {moveloop_core}=await mod('allmain'),G=await mod('gstate'),C=await mod('const');
const {ONAMES:O}=await mod('objects_data');
const {branchAssertionErrors,recordingIntegrityErrors}=await import(new URL('tools/gen-sessions/assertions.mjs',root));
const recipeBytes=fs.readFileSync(new URL('gen-sessions/recipes/dotrap-prior-state-producers.json',import.meta.url));
const input=JSON.parse(recipeBytes);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const recipeSHA256=sha(recipeBytes);
assert.equal(recipeSHA256,'33f56c90f0917c8e45fdd1f2fc2dba8660a12f66c3080e3fb4bd4451855b3d6f','locked four-case recipe');
assert.deepEqual(input.segments.map(p=>p.name),['pick-producer','wand-producer','plain-entry-negative','pick-unjoined-negative']);
const fields=p=>['name','seed','datetime','nethackrc','moves'].map(field=>
    ({field,present:Object.hasOwn(p,field),value:p[field]}));
// Mandatory canonical C input checks. Absence or malformed evidence fails closed.
const nativeBytes=fs.readFileSync(new URL('gen-sessions/generated/dotrap-prior-state-producers.session.json',import.meta.url));
const native=JSON.parse(nativeBytes),nativeSHA256=sha(nativeBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(input,native),[]);
assert.deepEqual(native.segments.map(fields),input.segments.map(fields));
for(const part of native.segments){
    assert.ok(part.steps?.length);
    assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves]);
}
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
const reports=[];assert.equal(input.segments.length,4);
for(const [index,part] of input.segments.entries()){
    const states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let out;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            const u=g.u;states.push({step,x:u.ux,y:u.uy,oldx:u.ux0,oldy:u.uy0,
                hp:u.uhp,trapped:u.utrap||0,type:u.utraptype,weapon:u.uwep?.otyp,
                inventory:(g.invent||[]).map(o=>({type:o.otyp,spe:o.spe})),
                traps:(g.level?.traps||[]).filter(t=>Math.abs(t.tx-u.ux)<3&&Math.abs(t.ty-u.uy)<2)
                    .map(t=>({x:t.tx,y:t.ty,type:t.ttyp,seen:t.tseen,joined:t.conjoined||0})),
                gameover:!!g.program_state?.gameover});
        }};
        out=collect(await runSegment({...part,storage:new InMemoryStorage()}));
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const n=part.name,last=states.at(-1);
    const r={name:n,evidence:'Keyboard producer/negative with canonical C input identity; native output parity is separate',
        keys:part.moves.length,boundaries:out.screens.length,calls:out.rng.length,frames:out.frames.flat().length,
        hashes:hashes(out),plainHashes:hashes(collect(await runSegment({...part,storage:new InMemoryStorage()}))),
        deferredHashes:hashes(collect(await deferred(part))),checks:[]};
    const check=(label,fn)=>{try{fn();r.checks.push({label,pass:true});}
        catch(e){r.checks.push({label,pass:false,error:e.message});process.exitCode=1;}};
    check('observer, deferred keys and blocked final read preserve all five outputs',()=>{
        assert.deepEqual(r.hashes,r.plainHashes);assert.deepEqual(r.hashes,r.deferredHashes);
        for(const k of ['screens','cursors','slices','frames'])assert.equal(out[k].length,part.moves.length+1);
        assert.deepEqual(out.slices.flat(),out.rng);assert.ok(states.every(s=>!s.gameover));
    });
    check('normal pit and tool producers reach the preconditions',()=>{
        assert.ok(states.some(s=>s.trapped>0&&s.type===C.TT_PIT));
        if(n!=='plain-entry-negative')assert.ok(states.some(s=>s.traps.filter(t=>t.type===C.PIT&&t.seen).length===2));
        if(n.startsWith('pick-'))assert.ok(states.some(s=>s.weapon===O.PICK_AXE));
        if(n==='wand-producer')assert.ok(states.some(s=>s.inventory.some(o=>o.type===O.WAN_DIGGING)));
    });
    check('C producer contract and visible branch assertions',()=>{
        const local={branches:[input.branches[index]],requireBranchAssertions:true,
            branchAssertions:[{...input.branchAssertions[index],segment:0}]};
        assert.deepEqual(branchAssertionErrors(local,{segments:[{steps:out.screens.map(screen=>({screen}))}]}),[]);
        if(['pick-producer','wand-producer'].includes(n)){
            assert.equal(last.traps.find(t=>t.x===41&&t.y===5)?.joined,16);
            assert.equal(last.traps.find(t=>t.x===42&&t.y===5)?.joined,1);
        }else assert.ok(last.traps.every(t=>!t.joined));
        assert.equal(last.x,n==='plain-entry-negative'?41:42);
        assert.equal(last.type,C.TT_PIT);assert.ok(last.trapped>0);
    });
    reports.push(r);console.log(n,r.checks.filter(c=>c.pass).length+'/3');
}
clearTimeout(deadline);const report={evidence:'Four ordinary producer/negative controls; mandatory canonical C input and branch checks; native output parity is separate',
    recipeSHA256,nativeSHA256,inputSHA256:hash(input.segments.map(fields)),
    passed:reports.flatMap(r=>r.checks).filter(c=>c.pass).length,total:12,reports};
assert.equal(reports.length,4);assert.equal(reports.flatMap(r=>r.checks).length,12);
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));
