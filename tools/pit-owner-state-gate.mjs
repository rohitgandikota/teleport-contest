// Constructed source controls through actual exported callers. No private exports or mocks.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url);
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'),
    'Usage: node tools/pit-owner-state-gate.mjs [compact-report.json]');
const mod=name=>import(new URL('js/'+name+'.js',root));
const {setup,clearMessages,messages,seed,x,y,mount}=await import(new URL('tools/status-followup-test-setup.mjs',root));
const G=await mod('gstate'),T=await mod('trap'),C=await mod('const'),YP=await mod('youprop');
const {PMNAMES:P}=await mod('monst_data'),{ONAMES:O}=await mod('objects_data');
const {set_itimeout,make_hallucinated}=await mod('potion');
const {maketrap}=await mod('mklev'),{makemon}=await mod('makemon');
const {mksobj,place_object}=await mod('mkobj'),{addinv,obj_extract_self}=await mod('invent');
const {setworn}=await mod('worn'),{setuwep}=await mod('wield');
const {punish}=await mod('read'),{polymon}=await mod('polyself');
const {getRngLog}=await mod('rng'),{bot}=await mod('display');
const {christen_monst}=await mod('do_name');
const {near_capacity,encumber_msg}=await mod('attrib');
const reports=[];
const deadline=setTimeout(()=>{console.error('55 second bounded worker limit');process.exit(2);},55000);
function state(t,m){
    const g=G.game,u=g.u,obj=o=>o?{type:o.otyp,x:o.ox,y:o.oy,where:o.where,worn:o.owornmask}:null;
    return {hp:u.uhp,max:u.uhpmax,mh:u.mh,mortality:u.umortality||0,strength:u.acurr?.[C.A_STR],
        trapped:u.utrap,traptype:u.utraptype,blocked:{...u.blocked},flying:YP.Flying(),levitating:YP.Levitation(),
        botl:!!g.disp.botl,vision:g.vision_full_recalc,ball:obj(u.uball),chain:obj(u.uchain),weapon:obj(u.uwep),
        amulet:obj(u.uamul),trap:t?{seen:t.tseen,once:t.once,conjoined:t.conjoined}:null,
        mon:m?{type:m.mnum,hp:m.mhp,trapped:m.mtrapped||0,x:m.mx,y:m.my}:null};
}
async function start(){
    const run=await setup(),u=G.game.u;
    Object.assign(u,{uhp:1000,uhpmax:1000,ux0:x-3,uy0:y,dx:0,dy:0});
    G.game.iflags.menu_requested=false;return run;
}
async function wear(type,mask){const o=mksobj(type,false,false);o.cursed=0;addinv(o);setworn(o,mask);return o;}
function pit(type=C.PIT,dx=0){const t=maketrap(x+dx,y,type);assert.ok(t);return t;}
async function act(r,t,fn=()=>T.dotrap(t,C.FORCETRAP),m=null,rngSeed=2){
    clearMessages();await bot();seed(rngSeed);r.before=state(t,m);
    try{r.result=await fn();}finally{r.after=state(t,m);r.text=messages();r.rng=[...getRngLog()];}
}
async function check(name,fn){const r={name};try{await fn(r);r.pass=true;}
    catch(e){r.pass=false;r.error=e.message;r.stack=e.stack?.split('\n').slice(1,4);}
    reports.push(r);console.log(r.pass?'PASS':'FAIL',name,r.pass?'':r.error.slice(0,180));}
for(const spiked of [false,true])for(const mode of ['none','timed','equipment','both','expired','wrong'])
await check(`canonical half damage ${spiked?'spiked':'plain'}/${mode}`,async r=>{
    await start();const u=G.game.u;set_itimeout('HPoison_resistance',100);
    if(mode==='timed'||mode==='both')set_itimeout('HHalf_physical_damage',50);
    if(mode==='equipment'||mode==='both')u.uprops.HALF_PHDAM=C.W_ART; // constructed real source bit
    if(mode==='expired'){set_itimeout('HHalf_physical_damage',1);set_itimeout('HHalf_physical_damage',0);}
    if(mode==='wrong')set_itimeout('HHalf_spell_damage',50);
    const t=pit(spiked?C.SPIKED_PIT:C.PIT);await act(r,t);
    const roll=Number(r.rng.find(s=>s.startsWith(`rnd(${spiked?10:6})=`)).split('=')[1]);
    assert.equal(r.before.hp-r.after.hp,['timed','equipment','both'].includes(mode)?Math.trunc((roll+1)/2):roll);
    assert.equal(r.after.traptype,C.TT_PIT);assert.ok(r.after.trapped>=2&&r.after.trapped<=7);
});
await check('pit schedules vision recalculation after the complete tail',async r=>{
    await start();const t=pit();await act(r,t);assert.equal(r.after.vision,1);assert.equal(r.after.botl,true);
});
for(const kind of ['Flying','Levitation'])await check('set_utrap releases floor block '+kind,async r=>{
    await start();set_itimeout('H'+kind,50);T.set_utrap(5,C.TT_WEB);
    assert.equal(YP[kind](),false);const t=pit();await act(r,t,()=>T.dotrap(t,C.FORCETRAP|C.TOOKPLUNGE));
    assert.equal(YP[kind](),true);assert.equal(r.after.traptype,C.TT_PIT);
    if(kind==='Flying')assert.equal(r.after.hp,r.before.hp);
});
for(const type of [O.IRON_SHOES,O.LOW_BOOTS])await check('spikes armor guard '+type,async r=>{
    await start();await wear(type,C.W_ARMF);set_itimeout('HPoison_resistance',100);
    const t=pit(C.SPIKED_PIT);await act(r,t);
    assert.ok(r.rng.some(s=>s.startsWith(`rnd(${type===O.IRON_SHOES?6:10})=`)));
    if(type===O.IRON_SHOES)assert.doesNotMatch(r.text,/land on|were poisoned/);
    else assert.match(r.text,/You land on a set of sharp iron spikes!/);
});
for(const mode of ['behind','same','carried'])await check('punishment tail '+mode,async r=>{
    await start();await punish(null);const b=G.game.u.uball;
    if(mode==='behind'){await obj_extract_self(b);place_object(b,x-1,y);}
    if(mode==='carried'){await obj_extract_self(b);addinv(b);}
    const t=pit();await act(r,t);
    if(mode==='behind'){
        assert.match(r.text,/iron ball falls on your head/);assert.equal(b.ox,x);assert.equal(b.oy,y);
        const ballRoll=Number(r.rng.find(s=>s.startsWith('rn2(7)=')).split('=')[1])+25;
        const fallRoll=Number(r.rng.find(s=>s.startsWith('rnd(6)=')).split('=')[1]);
        assert.equal(r.before.hp-r.after.hp,ballRoll+fallRoll);
    }else assert.doesNotMatch(r.text,/iron ball falls/);
    assert.equal(G.game.u.uchain.ox,x);assert.equal(G.game.u.uchain.oy,y);
    assert.equal(b.where,mode==='carried'?C.OBJ_INVENT:C.OBJ_FLOOR);
});
for(const mode of ['corpse','resistant','ordinary-weapon'])await check('self touch tail '+mode,async r=>{
    await start();const w=mksobj(mode==='ordinary-weapon'?O.LONG_SWORD:O.CORPSE,false,false);
    if(mode!=='ordinary-weapon')w.corpsenm=P.PM_COCKATRICE;
    addinv(w);setuwep(w); // constructed dangerous wield state, no normal wield reach claimed
    if(mode==='corpse')await wear(O.AMULET_OF_LIFE_SAVING,C.W_AMUL);
    if(mode==='resistant')set_itimeout('HStone_resistance',100);
    const t=pit();await act(r,t);
    if(mode==='corpse'){
        assert.match(r.text,/Falling, you touch the cockatrice corpse/);
        assert.equal(r.after.mortality,r.before.mortality+1);assert.equal(G.game.u.uwep,null);
    }else{assert.doesNotMatch(r.text,/Falling, you touch/);assert.equal(G.game.u.uwep,w);}
});
for(const mode of ['first','once','made','elsewhere','wrong-role','pit-form'])await check('Ranger quest guard '+mode,async r=>{
    await start();const g=G.game; // constructed role/level guards, ordinary quest reach separate
    if(mode!=='wrong-role')g.urole={...g.urole,mnum:P.PM_RANGER};
    g.u.uz={...g.qlocate_level};if(mode==='elsewhere')g.u.uz.dlevel++;
    if(mode==='pit-form')await polymon(P.PM_PIT_VIPER);
    const t=pit();if(mode==='once')t.once=1;if(mode==='made')t.madeby_u=1;
    await act(r,t);
    if(mode==='first'||mode==='pit-form'){
        assert.match(r.text,/Fortunately it has a bottom after all/);assert.equal(t.once,1);
        assert.doesNotMatch(r.text,/How pitiful/);
    }else assert.doesNotMatch(r.text,/Fortunately it has a bottom/);
});
for(const mode of ['unnamed','named','recursive','plain'])await check('mounted feedback '+mode,async r=>{
    await start();await mount();const m=G.game.u.usteed;m.mhp=m.mhpmax=1000;
    if(mode==='named')christen_monst(m,'Pebble');
    const t=pit(mode==='plain'?C.PIT:C.SPIKED_PIT);
    await act(r,t,()=>T.dotrap(t,C.FORCETRAP|(mode==='recursive'?C.RECURSIVETRAP:0)),m);
    assert.equal(r.after.hp,r.before.hp);assert.ok(m.mhp<1000);
    if(mode==='plain')assert.doesNotMatch(r.text,/sharp iron spikes/);
    else{assert.match(r.text,/poor (?:pony|Pebble) lands on a set of sharp iron spikes!/i);assert.doesNotMatch(r.text,/You land on a set/);}
    if(mode==='named')assert.doesNotMatch(r.text,/the (?:poor )?Pebble/i);
    if(mode==='recursive')assert.match(r.text,/You and the pony fall/);
});
for(const [species,accessible,force] of [[P.PM_GOBLIN,false,true],[P.PM_GOBLIN,true,true],
    [P.PM_BAT,true,true],[P.PM_BAT,true,false],[P.PM_XORN,true,true],[P.PM_PIT_VIPER,true,true]])
await check(`monster pit ${species}/${accessible}/${force}`,async r=>{
    await start();const m=await makemon(G.game.mons[species],x+1,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    m.mhp=m.mhpmax=1000;G.game.flags.accessiblemsg=accessible;G.game.iflags.getpos_coords='m';
    const t=pit(C.PIT,1);await act(r,t,()=>T.mintrap(m,force?C.FORCETRAP:0),m);
    if(species===P.PM_BAT){assert.equal(m.mhp,1000);assert.equal(m.mtrapped||0,0);
        if(force)assert.match(r.text,/<32,10>: The bat doesn't fall into the pit\./);
        else assert.equal(r.text.trim(),'');
    }else{
        assert.ok(m.mhp<1000);assert.equal(m.mtrapped||0,species===P.PM_XORN?0:1);
        if(accessible)assert.match(r.text,/<32,10>: The .* falls into a pit!/);
        if(species===P.PM_PIT_VIPER)assert.match(r.text,/How pitiful/);
    }
});
for(const conjoined of [true,false])await check('caller preserves prior pit '+(conjoined?'conjoined':'adjacent'),async r=>{
    await start();const old=pit(C.PIT,-1),t=pit();G.game.u.ux0=x-1;G.game.u.uy0=y;G.game.u.dx=1;
    T.set_utrap(5,C.TT_PIT);
    if(conjoined){old.conjoined=1<<4;t.conjoined=1<<0;assert.equal(T.conjoined_pits(t,old,true),true);}
    r.regressionTarget='baseline dotrap clears prior trap state before owner dispatch; C preserves it';await act(r,t);
    if(conjoined){assert.equal(r.after.hp,r.before.hp);assert.match(r.text,/move into an adjacent pit/);}
    else {assert.ok(r.rng.some(s=>s.startsWith('rnd(3)=')));assert.match(r.text,/stumble over debris/);}
});

await check('mounted spike feedback is awaited before trapping and damage',async r=>{
    const run=await start();await mount();const m=G.game.u.usteed;m.mhp=m.mhpmax=1000;
    const t=pit(C.SPIKED_PIT);clearMessages();await bot();seed(2);
    let ready,release,timer,finished=false;
    const pending=new Promise(resolve=>{ready=resolve;});
    run._display.onEmptyQueue=()=>{
        if(!G.game.u.utrap){r.pending=state(t,m);ready();return new Promise(resolve=>{release=resolve;});}
        return 32;
    };
    const work=T.dotrap(t,C.FORCETRAP).then(()=>{finished=true;});
    try{
        await Promise.race([pending,work.then(()=>{throw Error('no pending pre-impact feedback');}),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('feedback timeout')),2000);})]);
        await setImmediate();assert.equal(finished,false);assert.equal(m.mhp,1000);
    }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;if(release)release(32);await work;}
    r.after=state(t,m);r.text=messages();r.rng=[...getRngLog()];
    assert.match(r.text,/The poor pony lands on a set of sharp iron spikes!/);assert.ok(m.mhp<1000);
});

for(const changed of [true,false])await check('exercise encumbrance order '+(changed?'changed':'unchanged'),async r=>{
    const run=await start();addinv(mksobj(O.BOULDER,false,false));
    assert.ok(G.game.moves>0);assert.equal(near_capacity(),C.OVERLOADED);
    if(!changed)await encumber_msg();
    const oldcap=G.game.oldcap;
    set_itimeout('HPoison_resistance',100);
    const t=pit(C.SPIKED_PIT);clearMessages();await bot();seed(2);
    let ready,release,timer,finished=false;
    const pending=new Promise(resolve=>{ready=resolve;});
    run._display.onEmptyQueue=()=>{
        if(G.game.u.utrap&&changed){
            r.pendingRng=[...getRngLog()];ready();
            return new Promise(resolve=>{release=resolve;});
        }
        return 32;
    };
    const work=T.dotrap(t,C.FORCETRAP).then(()=>{finished=true;});
    try{
        if(changed){
            await Promise.race([pending,work.then(()=>{throw Error('no pending encumbrance feedback');}),
                new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('encumbrance timeout')),2000);})]);
            await setImmediate();assert.equal(finished,false);
            assert.equal(getRngLog().filter(s=>s.startsWith('rn2(2)=')).length,1);
            assert.equal(G.game.oldcap,oldcap);
        }else await work;
    }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;if(release)release(32);await work;await setImmediate();}
    r.after=state(t);r.text=messages();r.rng=[...getRngLog()];
    assert.equal(G.game.oldcap,C.OVERLOADED);
    assert.equal(r.rng.filter(s=>s.startsWith('rn2(2)=')).length,2);
    if(changed)assert.match(r.text,/can't even move a handspan with this load/);
    else assert.doesNotMatch(r.text,/handspan with this load/);
});

// Seed5 was locked after a bounded real-chain probe; no RNG replacement.
const poisonSeed=5;
for(const mode of ['life-saved','survives-impact','poison-resistant'])
await check('spike poison restriction '+mode,async r=>{
    await start();if(mode!=='survives-impact')G.game.u.uhp=1;
    await wear(O.AMULET_OF_LIFE_SAVING,C.W_AMUL);
    if(mode==='poison-resistant')set_itimeout('HPoison_resistance',100);
    const t=pit(C.SPIKED_PIT);r.seed=poisonSeed;await act(r,t,undefined,null,poisonSeed);
    assert.match(r.text,/The spikes were poisoned!/);
    if(mode!=='survives-impact')assert.equal(r.after.mortality,r.before.mortality+1);
    if(mode==='life-saved'){
        assert.ok(!r.rng.some(s=>s.startsWith('rn2(8)=')));
        assert.doesNotMatch(r.text,/poison was deadly/);
    }else if(mode==='survives-impact')assert.ok(r.rng.some(s=>s.startsWith('rn2(8)=')));
    else assert.match(r.text,/poison doesn't seem to affect you/);
});
clearTimeout(deadline);
assert.equal(reports.length,47);
const report={evidence:'Constructed source states through dotrap/mintrap and real helpers; no native or ordinary reach claim',
    passed:reports.filter(r=>r.pass).length,total:reports.length,poisonSeed,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total,poisonSeed}));
if(report.passed!==report.total)process.exitCode=1;
