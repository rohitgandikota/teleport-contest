// Constructed source controls. Real imports/producers; no runtime mocks or exports.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url);
const {setup,clearMessages,messages,seed,x,y}=await import(new URL('tools/status-followup-test-setup.mjs',root));
const G=await import(new URL('js/gstate.js',root));
const {mhitm_ad_fire,mhitm_mgc_atk_negated,damageum}=await import(new URL('js/uhitm.js',root));
const {DEADMONSTER}=await import(new URL('js/monst.js',root));
const {makemon}=await import(new URL('js/makemon.js',root));
const {mdamagem}=await import(new URL('js/mhitm.js',root));
const {polymon}=await import(new URL('js/polyself.js',root));
const {cprefx}=await import(new URL('js/eat.js',root));
const {make_stoned,make_blinded,set_itimeout}=await import(new URL('js/potion.js',root));
const {getRngLog}=await import(new URL('js/rng.js',root));
const {mksobj}=await import(new URL('js/mkobj.js',root));
const {addinv}=await import(new URL('js/invent.js',root));
const {mpickobj}=await import(new URL('js/steal.js',root));
const {m_dowear}=await import(new URL('js/worn.js',root));
const {magic_negation}=await import(new URL('js/mhitu.js',root));
const {canseemon,bot,newsym,flush_screen,glyph_at}=await import(new URL('js/display.js',root));
const {PMNAMES:P,ATTKS:A}=await import(new URL('js/monst_data.js',root));
const {ONAMES:O}=await import(new URL('js/objects_data.js',root));
const C=await import(new URL('js/const.js',root));
const reports=[];
function state(magr,mdef,mhm){
    const g=G.game,killers=[];for(let k=g.killer?.next;k;k=k.next)killers.push({id:k.id,name:k.name,format:k.format});
    const mon=m=>({type:m.mnum,hp:m.mhp,max:m.mhpmax,level:m.m_lev,speed:m.mspeed,
        seen:m.seen_resistance||0,inventory:(m.minvent||[]).map(o=>({typ:o.otyp,quantity:o.quan,lit:!!o.lamplit}))});
    return {slimed:g.u.uprops.SLIMED||0,stoned:g.u.uprops.STONED||0,killers,
        hp:g.u.uhp,form:g.u.umonnum,poly:C.Upolyd(g.u),ap:g.youmonst.m_ap_type||0,
        appearance:g.youmonst.mappearance||0,glyph:glyph_at(g.u.ux,g.u.uy).glyphnum,
        botl:!!g.disp.botl,a11y:{...g.a11y.msg_loc},magr:mon(magr),mdef:mon(mdef),mhm:{...mhm},
        inventory:(g.invent||[]).map(o=>({typ:o.otyp,quantity:o.quan,lit:!!o.lamplit})),objects:g.level.objects.length};
}
async function monster(species,dx=1,options=0){
    const m=await makemon(G.game.mons[species],x+dx,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG|options);
    assert.ok(m);assert.equal(m.data,G.game.mons[m.mnum]);return m;
}
function fire(m){return m.data.mattk.find(a=>a[1]===A.AD_FIRE);}
function record(){return {damage:8,hitflags:C.M_ATTK_MISS,done:false,permdmg:0,specialdmg:0,indx:1};}
async function food(){await cprefx(P.PM_GREEN_SLIME);assert.equal(G.game.u.uprops.SLIMED,10);}
async function act(r,magr,mdef,mhm,fn=()=>mhitm_ad_fire(magr,fire(magr),mdef,mhm)){
    clearMessages();await bot();seed(2);r.before=state(magr,mdef,mhm);
    try{r.result=await fn();}
    finally{r.after=state(magr,mdef,mhm);r.text=messages();r.rng=getRngLog();}
}
async function check(name,fn){await test(name,{timeout:8000},async()=>{
    const r={name};try{await fn(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message;
        if(e.message.includes("undefined (reading 'includes')"))r.errorStack=e.stack.split('\n').slice(1,5);
        throw e;}
    finally{reports.push(r);}
});}

for(const resistant of [false,true])for(const level of [0,20])
await check(`hero slime cure, resistance ${resistant}, inventory gate level ${level}`,async r=>{
    await setup();const a=await monster(P.PM_FIRE_ANT);a.m_lev=level; // constructed gate bounds
    if(resistant)set_itimeout('HFire_resistance',100);
    const lamp=mksobj(O.OIL_LAMP,true,false);lamp.cursed=0;addinv(lamp);
    await food();await make_stoned(100,null,C.KILLED_BY_AN,'cockatrice');
    const mhm=record(),root=G.game.killer;await act(r,a,G.game.youmonst,mhm);
    assert.equal(mhm.damage,resistant?0:8);assert.equal(mhm.done,false);
    assert.equal(G.game.killer,root);assert.equal(r.after.slimed,0);assert.equal(r.after.stoned,100);
    assert.deepEqual(r.after.killers,[{id:C.STONED,name:'cockatrice',format:C.KILLED_BY_AN}]);
    assert.match(r.text,/The slime that covers you is burned away!/);
    assert.equal(!!lamp.lamplit,level===20);assert.equal(r.after.hp,r.before.hp);
    assert.equal(!!(a.seen_resistance&C.M_SEEN_FIRE),resistant);
    assert.equal(r.rng.filter(s=>s.startsWith('rn2(5)')).length,level===20?1:0);
});
for(const mode of ['healthy','cancelled','flagged','absent-stale','disguise'])
await check('hero fire boundary '+mode,async r=>{
    await setup();const a=await monster(P.PM_FIRE_ANT);a.m_lev=0;
    if(mode!=='healthy')await food();
    if(mode==='cancelled')a.mcan=1; // constructed cancellation, no RNG substitution
    if(mode==='flagged')G.game.u.uprops.SLIMED|=C.I_SPECIAL;
    if(mode==='absent-stale')G.game.u.uprops.SLIMED=0;
    if(mode==='disguise'){
        // Constructed late-timeout disguise. No ordinary overlap is claimed.
        G.game.youmonst.m_ap_type=C.M_AP_MONSTER|C.M_AP_F_DKNOWN;
        G.game.youmonst.mappearance=P.PM_GREEN_SLIME;
        newsym(x,y);await flush_screen(1);
    }
    const mhm=record();await act(r,a,G.game.youmonst,mhm);
    if(mode==='cancelled'){
        assert.equal(mhm.damage,0);assert.equal(r.after.slimed,10);assert.deepEqual(r.rng,[]);
        assert.deepEqual(r.after.killers,r.before.killers);assert.doesNotMatch(r.text,/burned away|on fire/);
    }else if(mode==='flagged'){
        assert.equal(r.after.slimed,C.I_SPECIAL);assert.deepEqual(r.after.killers,r.before.killers);
        assert.match(r.text,/burned away/); // C tests xtime versus old whole word for feedback
    }else if(mode==='absent-stale'){
        assert.deepEqual(r.after.killers,r.before.killers);assert.doesNotMatch(r.text,/burned away/);
    }else if(mode==='disguise'){
        assert.deepEqual([r.after.slimed,r.after.ap,r.after.appearance],[0,0,0]);assert.deepEqual(r.after.killers,[]);
    }else{
        assert.equal(mhm.damage,8);assert.equal(r.after.slimed,0);assert.doesNotMatch(r.text,/burned away/);
    }
});
await check('burn feedback is awaited between timer update and cause cleanup',async r=>{
    const run=await setup(),a=await monster(P.PM_FIRE_ANT),mhm=record();a.m_lev=0;await food();
    clearMessages();seed(2);let entered,release,timer,done=false;
    const ready=new Promise(resolve=>{entered=resolve;});
    run._display.onEmptyQueue=()=>{
        const s=state(a,G.game.youmonst,mhm);
        if(s.slimed===0&&s.killers.some(k=>k.id===C.SLIMED)){
            r.pending=s;entered();return new Promise(resolve=>{release=resolve;});
        }return 32;
    };
    const work=mhitm_ad_fire(a,fire(a),G.game.youmonst,mhm).then(()=>{done=true;});
    try{
        await Promise.race([ready,work.then(()=>{throw Error('no pending burn feedback boundary');}),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('pending feedback timeout')),2000);})]);
        await setImmediate();assert.equal(done,false);assert.ok(r.pending.killers.some(k=>k.id===C.SLIMED));
    }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;if(release)release(32);await work;}
    r.after=state(a,G.game.youmonst,mhm);r.text=messages();r.rng=getRngLog();
    assert.deepEqual(r.after.killers,[]);assert.match(r.text,/burned away/);
});

for(const accessible of [false,true])for(const species of [P.PM_GOBLIN,P.PM_PAPER_GOLEM,P.PM_STRAW_GOLEM,P.PM_IRON_GOLEM])
await check(`monster fire owner, target ${species}, accessible ${accessible}`,async r=>{
    await setup();const d=await monster(species),a=await monster(P.PM_FIRE_ANT,2),mhm=record();
    G.game.vis=true;G.game.flags.accessiblemsg=accessible;G.game.iflags.getpos_coords='m';
    const burns=species===P.PM_PAPER_GOLEM||species===P.PM_STRAW_GOLEM;
    if(species===P.PM_IRON_GOLEM)d.mhp=10;
    await act(r,a,d,mhm);assert.deepEqual(G.game.a11y.msg_loc,{x:0,y:0});
    if(accessible)assert.match(r.text,/<32,10>: The .* is /);else assert.doesNotMatch(r.text,/<32,10>/);
    if(burns){
        assert.ok(DEADMONSTER(d));assert.equal(mhm.done,true);assert.equal(mhm.hitflags,C.M_ATTK_DEF_DIED);
        assert.match(r.text,/burns completely!/);assert.doesNotMatch(r.text,/is destroyed!/);
        assert.equal(r.after.objects,r.before.objects);
    }else if(species===P.PM_IRON_GOLEM){assert.equal(d.mhp,18);assert.equal(mhm.damage,0);}
    else{assert.equal(d.mhp,r.before.mdef.hp);assert.equal(mhm.damage,8);assert.equal(mhm.done,false);}
});
for(const visible of [false,true])await check('cancelled monster fire retains target, visibility '+visible,async r=>{
    await setup();const d=await monster(P.PM_PAPER_GOLEM),a=await monster(P.PM_FIRE_ANT,2),mhm=record();
    a.mcan=1;G.game.vis=visible;await act(r,a,d,mhm);
    assert.equal(mhm.damage,0);assert.equal(mhm.done,false);assert.equal(d.mhp,r.before.mdef.hp);
    assert.equal(r.text.trim(),'');assert.deepEqual(r.rng,[]);
});
for(const mode of ['visible','hidden-combat','invisible','quiet'])await check('shared cancellation prerequisite '+mode,async r=>{
    await setup();const d=await monster(P.PM_HUMAN,1,mode==='invisible'?C.MM_MINVIS:0),a=await monster(P.PM_FIRE_ANT,2);
    const cloak=mksobj(O.CLOAK_OF_PROTECTION,false,false);await mpickobj(d,cloak);await m_dowear(d,true);
    assert.equal(magic_negation(d),3);G.game.vis=mode!=='hidden-combat';
    G.game.flags.accessiblemsg=true;G.game.iflags.getpos_coords='m';
    r.visible=!!canseemon(d);await act(r,a,d,record(),()=>mhitm_mgc_atk_negated(a,d,mode!=='quiet'));
    assert.equal(r.result,true);assert.equal(r.rng.length,1);
    if(mode==='visible')assert.match(r.text,/<32,10>: The human avoids harm\./);
    else assert.equal(r.text.trim(),'');
});
for(const blind of [false,true])await check('natural hero fire destroys golem, blind '+blind,async r=>{
    await setup();await polymon(P.PM_SALAMANDER);const d=await monster(P.PM_PAPER_GOLEM);G.game.vis=true;
    if(blind)await make_blinded(20,false);
    await act(r,G.game.youmonst,d,record(),()=>damageum(d,fire(G.game.youmonst),0));
    assert.equal(r.result,C.M_ATTK_DEF_DIED);assert.ok(DEADMONSTER(d));
    assert.match(r.text,blind?/You smell burning paper\./:/burns completely!/);
});
await check('monster fire on paper hero returns through real rehumanization',async r=>{
    await setup();await polymon(P.PM_PAPER_GOLEM);const a=await monster(P.PM_FIRE_ANT);await food();
    const mhm=record();await act(r,a,G.game.youmonst,mhm);
    assert.equal(r.after.poly,false);assert.equal(mhm.damage,8);assert.equal(r.after.slimed,10);
    assert.match(r.text,/go up in flames!/);assert.doesNotMatch(r.text,/burned away/);
});
await check('full monster damage caller respects immediate fire death',async r=>{
    await setup();const d=await monster(P.PM_STRAW_GOLEM),a=await monster(P.PM_FIRE_ANT,2);G.game.vis=true;
    await act(r,a,d,record(),()=>mdamagem(a,d,fire(a),null,1));
    assert.equal(r.result,C.M_ATTK_DEF_DIED);assert.ok(DEADMONSTER(d));
    assert.doesNotMatch(r.text,/is destroyed!/);assert.equal(r.after.objects,r.before.objects);
});

for(const heroAttacker of [false,true])for(const carriesItems of [false,true])
await check(`resistance preserves original item damage, hero attacker ${heroAttacker}, inventory ${carriesItems}`,async r=>{
    await setup();if(heroAttacker)await polymon(P.PM_SALAMANDER);
    const d=await monster(P.PM_IRON_GOLEM),a=heroAttacker?G.game.youmonst:await monster(P.PM_FIRE_ANT,2);
    d.mhp=10;G.game.vis=true;const mhm=record();let potion,lamp;
    if(carriesItems){
        potion=mksobj(O.POT_WATER,false,false);potion.quan=12;await mpickobj(d,potion);
        lamp=mksobj(O.OIL_LAMP,true,false);lamp.cursed=0;await mpickobj(d,lamp);
    }
    await act(r,a,d,mhm);assert.equal(d.mhp,18);assert.equal(mhm.done,false);
    assert.equal(r.rng.filter(s=>s.startsWith('rn2(5)')).length,1);
    if(carriesItems){
        assert.ok(potion.quan<12);assert.ok(mhm.damage>0&&mhm.damage<=6);assert.equal(!!lamp.lamplit,true);
        assert.match(r.text,/boil/);
    }else assert.equal(mhm.damage,0);
});

if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({
    evidence:'Constructed source controls using actual producers and owner/caller functions; not native or ordinary reach',reports},null,2)+'\n');
