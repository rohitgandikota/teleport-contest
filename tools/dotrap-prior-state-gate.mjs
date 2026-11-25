// Constructed caller states, real pit and connection producers, no mocks.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url),mod=n=>import(new URL('js/'+n+'.js',root));
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const {setup,clearMessages,messages,seed,x,y}=await import(new URL('tools/status-followup-test-setup.mjs',root));
const G=await mod('gstate'),T=await mod('trap'),C=await mod('const');
const {ONAMES:O}=await mod('objects_data');
const {maketrap}=await mod('mklev'),{mksobj}=await mod('mkobj');
const {addinv}=await mod('invent'),{setuwep}=await mod('wield');
const {use_pick_axe2}=await mod('dig'),{u_on_newpos}=await mod('teleport');
const {spoteffects}=await mod('hack'),{set_itimeout}=await mod('potion');
const {getRngLog}=await mod('rng'),{bot,pline}=await mod('display');
const reports=[],deadline=setTimeout(()=>{console.error('55 second worker bound');process.exit(2);},55000);
const state=()=>({hp:G.game.u.uhp,trapped:G.game.u.utrap,type:G.game.u.utraptype,
    x:G.game.u.ux,y:G.game.u.uy,oldx:G.game.u.ux0,oldy:G.game.u.uy0,
    rng:[...getRngLog()],text:messages()});
async function check(name,fn){const r={name};try{await fn(r);r.pass=true;}
    catch(e){r.pass=false;r.error=e.message;}reports.push(r);console.log(r.pass?'PASS':'FAIL',name,r.error||'');}
async function prior(spiked,joined){
    const run=await setup(),u=G.game.u;
    u.uhp=u.uhpmax=1000;u.ux0=x-1;u.uy0=y;u.dx=1;u.dy=u.dz=0;
    set_itimeout('HPoison_resistance',100);
    const old=maketrap(x,y,C.PIT),target=maketrap(x+1,y,spiked?C.SPIKED_PIT:C.PIT);
    T.seetrap(target);await T.dotrap(old,C.FORCETRAP);
    assert.ok(u.utrap>0);assert.equal(u.utraptype,C.TT_PIT);
    if(joined){
        const pick=mksobj(O.PICK_AXE,false,false);addinv(pick);setuwep(pick);
        await use_pick_axe2(pick);
        assert.ok(T.conjoined_pits(target,old,true));assert.match(messages(),/clear some debris/);
    }
    // Placement models a caller entering the target. This is not keyboard reach.
    u.ux0=u.ux;u.uy0=u.uy;u_on_newpos(x+1,y);
    clearMessages();await bot();seed(2);return {run,old,target};
}
for(const joined of [true,false])for(const spiked of [false,true])
await check(`real pit producer ${joined?'joined':'adjacent'}/${spiked?'spiked':'plain'}`,async r=>{
    const {old,target}=await prior(spiked,joined);r.before=state();r.bits=[old.conjoined,target.conjoined];
    await spoteffects(false);r.after=state();
    if(joined)assert.match(r.after.text,/move into an adjacent pit/);
    else assert.match(r.after.text,/stumble over debris/);
    const roll=r.after.rng.find(s=>s.startsWith(`rnd(${spiked?(joined?4:6):3})=`));
    if(joined&&!spiked){assert.equal(r.after.hp,r.before.hp);assert.ok(!r.after.rng.some(s=>s.startsWith('rnd(')));}
    else{assert.ok(roll);assert.equal(r.before.hp-r.after.hp,Number(roll.split('=')[1]));}
    assert.equal(r.after.type,C.TT_PIT);assert.ok(r.after.trapped>=2&&r.after.trapped<=7);
});
for(const mode of ['released','wrong-direction'])await check('relationship negative '+mode,async r=>{
    const {target}=await prior(false,false);
    if(mode==='released')await T.reset_utrap(true);else G.game.u.dx=G.game.u.dy=0;
    clearMessages();seed(2);r.before=state();await T.dotrap(target,C.FORCETRAP);r.after=state();
    assert.match(r.after.text,/You fall into a pit!/);assert.doesNotMatch(r.after.text,/adjacent pit|debris/);
    assert.ok(r.after.rng.some(s=>s.startsWith('rnd(6)=')));
});
for(const levitating of [false,true])await check('airborne early return '+levitating,async r=>{
    const {target}=await prior(false,false);
    set_itimeout(levitating?'HLevitation':'HFlying',100);
    r.before=state();await T.dotrap(target,C.NO_TRAP_FLAGS);r.after=state();
    assert.equal(r.after.trapped,r.before.trapped);assert.equal(r.after.type,r.before.type);
    assert.equal(r.after.hp,r.before.hp);assert.deepEqual(r.after.rng,[]);
});
await check('pending joined feedback preserves old state before owner reset',async r=>{
    const {run,target}=await prior(false,true);
    await pline('A long message keeps this line occupied before the next pit transition begins.');
    r.before=state();let ready,release,timer,finished=false;
    const pending=new Promise(resolve=>{ready=resolve;});
    run._display.onEmptyQueue=()=>{r.pending=state();ready();return new Promise(resolve=>{release=resolve;});};
    const work=T.dotrap(target,C.FORCETRAP).then(()=>{finished=true;});
    try{
        await Promise.race([pending,work.then(()=>{throw Error('no pending feedback');}),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('feedback timeout')),2000);})]);
        await setImmediate();assert.equal(finished,false);assert.equal(r.pending.trapped,r.before.trapped);
        assert.equal(r.pending.type,C.TT_PIT);assert.deepEqual(r.pending.rng,[]);
    }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;if(release)release(32);await work;}
    r.after=state();assert.equal(r.after.hp,r.before.hp);
});
clearTimeout(deadline);assert.equal(reports.length,9);
const report={evidence:'Constructed caller states with actual pit entry and pick-axe connection producers; no ordinary/native claim',
    passed:reports.filter(r=>r.pass).length,total:reports.length,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));if(report.passed!==report.total)process.exitCode=1;
