// Keyboard-only producers; the observer reads state and never changes it.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url);
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'),
    'Usage: node tools/domove-trapmove-input-gate.mjs [compact-report.json]');
const mod=name=>import(new URL('js/'+name+'.js',root));
const {runSegment,NethackGame}=await mod('jsmain');
const {GameDisplay}=await mod('game_display'),{InMemoryStorage}=await mod('storage');
const {moveloop_core}=await mod('allmain'),G=await mod('gstate'),C=await mod('const');
const {ONAMES:O}=await mod('objects_data');
const {ART_STING}=await mod('artilist_data');
const {branchAssertionErrors,recordingIntegrityErrors}=await import(new URL('tools/gen-sessions/assertions.mjs',root));
const recipeBytes=fs.readFileSync(new URL('gen-sessions/recipes/domove-trapmove-owner.json',import.meta.url));
const input=JSON.parse(recipeBytes);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const recipeSHA256=sha(recipeBytes);
assert.equal(recipeSHA256,'a33e2419627552f8d03c3824e2bbcdc5405ad07407f2bdfff11f827ee455e3bb','locked nine-case recipe');
assert.deepEqual(Object.keys(input.unchangedOutputHashes).sort(),
    ['sting-carried','plain-wielded','plain-entry-negative','pick-unjoined-negative'].sort());
const fields=p=>['name','seed','datetime','nethackrc','moves'].map(field=>
    ({field,present:Object.hasOwn(p,field),value:p[field]}));
// Mandatory canonical C evidence and exact input identity. No comparison or skip mode.
const nativeBytes=fs.readFileSync(new URL('gen-sessions/generated/domove-trapmove-owner.session.json',import.meta.url));
const nativeSHA256=sha(nativeBytes),native=JSON.parse(nativeBytes);
assert.equal(nativeSHA256,'fa161dfbae8ec58932ba85dd7d06d1705a3e0232ba8e260cb64a87a1688ab92a','locked canonical C raw');
assert.equal(native.source,'c');assert.equal(native.version,5);
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(input,native),[]);
assert.deepEqual(native.segments.map(fields),input.segments.map(fields));
assert.equal(native.segments.length,9);
for(const part of native.segments){
    assert.ok(part.steps?.length);
    assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves]);
}
assert.equal(native.segments.reduce((n,s)=>n+s.steps.length,0),917);
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
const reports=[];assert.deepEqual(input.segments.map(p=>p.name),['joined-climb','adjacent-climb','joined-escape-next-step','adjacent-escape-next-step','sting-wielded','sting-carried','plain-wielded','plain-entry-negative','pick-unjoined-negative']);
for(const [index,part] of input.segments.entries()){
    const states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let out;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            const u=g.u;states.push({step,x:u.ux,y:u.uy,oldx:u.ux0,oldy:u.uy0,
                hp:u.uhp,trapped:u.utrap||0,type:u.utraptype,weapon:u.uwep?.otyp,artifact:u.uwep?.oartifact,
                inventory:(g.invent||[]).map(o=>({type:o.otyp,spe:o.spe,artifact:o.oartifact})),
                traps:(g.level?.traps||[]).filter(t=>Math.abs(t.tx-u.ux)<3&&Math.abs(t.ty-u.uy)<2)
                    .map(t=>({x:t.tx,y:t.ty,type:t.ttyp,seen:t.tseen,joined:t.conjoined||0})),
                gameover:!!g.program_state?.gameover});
        }};
        out=collect(await runSegment({...part,storage:new InMemoryStorage()}));
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const n=part.name,last=states.at(-1);
    const r={name:n,evidence:'Canonical C input identity required; JS reach measured, native output comparison is parent work',
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
    check('actual trapped state and ordinary producers reached',()=>{
        const web=['sting-wielded','sting-carried','plain-wielded'].includes(n);
        assert.ok(states.some(s=>s.trapped>0&&s.type===(web?C.TT_WEB:C.TT_PIT)));
        if(n.startsWith('joined-')||n==='pick-unjoined-negative')assert.ok(states.some(s=>s.weapon===O.PICK_AXE));
        if(n.startsWith('sting-'))assert.ok(states.some(s=>s.inventory.some(o=>o.artifact===ART_STING)));
        if(n==='sting-wielded')assert.ok(states.some(s=>s.artifact===ART_STING));
        if(n==='sting-carried')assert.ok(states.every(s=>s.artifact!==ART_STING));
        if(n==='plain-wielded')assert.ok(states.some(s=>s.weapon===O.ELVEN_DAGGER&&!s.artifact));
    });
    check('C escape/move state ordering and visible branch assertions',()=>{
        const local={branches:[input.branches[index]],requireBranchAssertions:true,
            branchAssertions:[{...input.branchAssertions[index],segment:0}]};
        assert.deepEqual(branchAssertionErrors(local,{segments:[{steps:out.screens.map(screen=>({screen}))}]}),[]);
        if(n.startsWith('joined-')){
            assert.equal(last.traps.find(t=>t.x===41&&t.y===5)?.joined,16);
            assert.equal(last.traps.find(t=>t.x===42&&t.y===5)?.joined,1);
        }else assert.ok(last.traps.every(t=>!t.joined));
        if(n.endsWith('-climb')){
            assert.equal(last.x,42);assert.equal(last.y,5);assert.equal(last.trapped,2);
            const prior=states.findLast(s=>s.x===42&&s.trapped===3&&s.type===C.TT_PIT);
            assert.ok(prior);assert.equal(last.hp,prior.hp);
        }else if(n.endsWith('-escape-next-step')){
            const escaped=states.find(s=>s.x===42&&s.type===C.TT_NONE&&s.trapped===0&&
                states.some(t=>t.step<s.step&&t.x===42&&t.trapped>0&&t.type===C.TT_PIT));
            assert.ok(escaped,'escape completes on the old tile');
            const entered=states.find(s=>s.step>escaped.step&&s.x===41&&s.trapped>0&&s.type===C.TT_PIT);
            assert.ok(entered,'a later input moves to the adjacent pit');
            assert.ok(entered.hp<escaped.hp,'fresh pit impact after escape');assert.equal(last.x,41);
        }else if(n==='sting-wielded'){
            assert.equal(last.x,41);assert.equal(last.trapped,0);assert.equal(last.type,C.TT_NONE);
            assert.ok(last.traps.some(t=>t.x===41&&t.type===C.WEB),'cutting frees hero but preserves web');
        }else{
            assert.equal(last.x,n==='pick-unjoined-negative'?42:41);assert.ok(last.trapped>0);
            assert.equal(last.type,['sting-carried','plain-wielded'].includes(n)?C.TT_WEB:C.TT_PIT);
        }
        if(input.unchangedOutputHashes?.[n])assert.deepEqual(r.hashes,input.unchangedOutputHashes[n]);
    });
    reports.push(r);console.log(n,r.checks.filter(c=>c.pass).length+'/3');
}
clearTimeout(deadline);const report={evidence:'Nine ordinary cases with mandatory canonical C raw/input checks; native output comparison is separate',
    recipeSHA256,nativeSHA256,inputSHA256:hash(input.segments.map(fields)),
    passed:reports.flatMap(r=>r.checks).filter(c=>c.pass).length,total:27,reports};
assert.equal(reports.length,9);assert.equal(reports.flatMap(r=>r.checks).length,27);
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));
