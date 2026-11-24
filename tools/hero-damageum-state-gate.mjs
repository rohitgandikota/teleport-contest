// C uhitm.c:4835 damageum and :2133 demonpet. Actual producers and helpers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup,clearMessages,messages,seed,x,y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {polymon} from '../js/polyself.js';
import {makemon} from '../js/makemon.js';
import {damageum,hmonas} from '../js/uhitm.js';
import {dokick} from '../js/dokick.js';
import {pushKeys} from '../js/input.js';
import {mksobj} from '../js/mkobj.js';
import {mpickobj} from '../js/steal.js';
import {addinv} from '../js/invent.js';
import {setuwep} from '../js/wield.js';
import {oname} from '../js/do_name.js';
import {tamedog} from '../js/dog.js';
import {m_dowear,which_armor} from '../js/worn.js';
import {make_blinded} from '../js/potion.js';
import {cansee} from '../js/vision.js';
import {set_levltyp} from '../js/mkmaze.js';
import {thick_skinned} from '../js/mondata.js';
import {pline} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P,ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {ART_TROLLSBANE} from '../js/artilist_data.js';
import * as C from '../js/const.js';

async function prepare(form, type, victim=P.PM_OGRE) {
    assert.equal(typeof victim,'number');
    const run=await setup();
    assert.equal(await polymon(form),1);
    assert.equal(game.youmonst.data,game.mons[form]);
    const attack=game.youmonst.data.mattk.find(a=>a[1]===type && a[0]!==A.AT_NONE);
    assert.ok(attack,'unchanged active species attack');
    const mon=await makemon(game.mons[victim],x+1,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(mon); assert.equal(mon.data,game.mons[victim]);
    Object.assign(mon,{mhp:100,mhpmax:100,msleeping:0,mpeaceful:0,mstrategy:C.STRAT_WAITFORU});
    game.flags.verbose=true; game.flags.monpolycontrol=false;
    Object.assign(game.u,{dx:1,dy:0}); // do_attack sets the attempted adjacent direction.
    game.u.udaminc=0; game.bhitpos={x:mon.mx,y:mon.my}; game.notonhead=false;
    clearMessages(); seed(19);
    return {run,mon,attack};
}
const hit=s=>damageum(s.mon,s.attack,0);
function rolled() {
    const match=/^d\(\d+,\d+\)=(\d+)$/.exec(getRngLog()[0]);
    assert.ok(match,'base dice first');return +match[1];
}
async function wield(type, name) {
    const obj=mksobj(type,false,false);
    if(name) await oname(obj,name,0);
    await addinv(obj); await setuwep(obj); assert.equal(game.u.uwep,obj);
    return obj;
}
async function pendingMore(run,invoke,inspect,accept=()=>true) {
    let enter,timer,done=false;const releases=[];
    const reached=new Promise(resolve=>{enter=resolve;});
    run._display.onEmptyQueue=()=>{
        if(!accept())return 32;
        enter();return new Promise(resolve=>releases.push(resolve));
    };
    const owner=invoke().then(value=>{done=true;return value;});
    try {
        await Promise.race([reached,owner.then(()=>{throw Error('completed before required More');}),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('More not reached')),2000);})]);
        await setImmediate();inspect({done,reads:releases.length});
    } finally {
        clearTimeout(timer);run._display.onEmptyQueue=()=>32;
        for(const release of releases)release(32);
        await owner;await setImmediate();
    }
    return owner;
}

for(const alreadySlow of [false,true]) test(`skeleton shared slow, already=${alreadySlow}`,async()=>{
    const s=await prepare(P.PM_SKELETON,A.AD_SLOW);
    if(alreadySlow)s.mon.mspeed=s.mon.permspeed=C.MSLOW;
    assert.equal(await hit(s),C.M_ATTK_HIT);
    assert.equal(s.mon.mspeed,C.MSLOW);assert.equal(s.mon.mhp,100-rolled());
    assert.equal(s.mon.mstrategy&C.STRAT_WAITFORU,0);
    assert.equal(messages().includes('slows down'),!alreadySlow);
    assert.deepEqual(getRngLog(),['d(1,6)=5','rn2(10)=6']);
});
test('xan uses physical shared handler and retains special damage',async()=>{
    const s=await prepare(P.PM_XAN,A.AD_LEGS);
    assert.equal(await damageum(s.mon,s.attack,7),C.M_ATTK_HIT);
    assert.equal(s.mon.mhp,100-rolled()-7);
});
for(const victim of [P.PM_OGRE,P.PM_BLUE_JELLY]) test(`raven blind handler, victim=${victim}`,async()=>{
    const s=await prepare(P.PM_RAVEN,A.AD_BLND,victim);
    assert.equal(await hit(s),C.M_ATTK_HIT);assert.equal(s.mon.mhp,100);
    assert.equal(!!s.mon.mcansee,victim===P.PM_BLUE_JELLY);
    assert.equal(s.mon.mblinded||0,victim===P.PM_BLUE_JELLY?0:rolled());
});
for(const victim of [P.PM_OGRE,P.PM_LARGE_MIMIC]) test(`large mimic sticking, victim=${victim}`,async()=>{
    const s=await prepare(P.PM_LARGE_MIMIC,A.AD_STCK,victim);
    assert.equal(await hit(s),C.M_ATTK_HIT);
    assert.equal(game.u.ustuck,victim===P.PM_OGRE?s.mon:null);
    assert.equal(s.mon.mhp,100-rolled());
});
for(const [form,type,item,field] of [
    [P.PM_RUST_MONSTER,A.AD_RUST,O.CHAIN_MAIL,'oeroded'],
    [P.PM_BROWN_PUDDING,A.AD_DCAY,O.LEATHER_ARMOR,'oeroded2'],
    [P.PM_BLACK_PUDDING,A.AD_CORR,O.CHAIN_MAIL,'oeroded2'],
])test(`real worn armor damage ${type}`,async()=>{
    const s=await prepare(form,type,P.PM_HUMAN);const armor=mksobj(item,false,false);
    await mpickobj(s.mon,armor);await m_dowear(s.mon,true);
    assert.equal(which_armor(s.mon,C.W_ARM),armor);clearMessages();seed(19);
    assert.equal(await hit(s),C.M_ATTK_HIT);assert.equal(armor[field],1);assert.equal(s.mon.mhp,100);
});
for(const verbose of [false,true]) test(`rust already killed target, verbose=${verbose}`,async()=>{
    const s=await prepare(P.PM_RUST_MONSTER,A.AD_RUST,P.PM_IRON_GOLEM);
    game.flags.verbose=verbose;const kills=game.u.uconduct.killer;
    assert.equal(await hit(s),C.M_ATTK_DEF_DIED);
    assert.equal(s.mon.mhp,0);assert.equal(game.u.uconduct.killer,kills+1);
    assert.match(messages(),/falls to pieces/);
    assert.equal(messages().includes('You destroy it!'),!verbose);
    assert.equal(messages().includes('You kill the iron golem'),false);
    assert.equal(!!game.mkcorpstat_norevive,false);
});
for(const verbose of [false,true]) test(`ordinary lethal tail, verbose=${verbose}`,async()=>{
    const s=await prepare(P.PM_DINGO,A.AD_PHYS);s.mon.mhp=1;game.flags.verbose=verbose;
    const kills=game.u.uconduct.killer;
    assert.equal(await hit(s),C.M_ATTK_DEF_DIED);assert.equal(game.u.uconduct.killer,kills+1);
    assert.match(messages(),verbose?/You kill the ogre!/:/You destroy it!/);
    assert.equal(!!game.mkcorpstat_norevive,false);
});
test('unseen pet takes embarrassment before one real death',async()=>{
    const s=await prepare(P.PM_DINGO,A.AD_PHYS);
    assert.equal(await tamedog(s.mon,null,false),true);
    await make_blinded(20,false);assert.equal(!!cansee(s.mon.mx,s.mon.my),false);
    s.mon.mhp=1;clearMessages();seed(19);const kills=game.u.uconduct.killer;
    assert.equal(await hit(s),C.M_ATTK_DEF_DIED);
    assert.equal(game.u.uconduct.killer,kills+1);assert.match(messages(),/embarrassed for a moment/);
    assert.equal(messages().includes('You kill'),false);assert.equal(s.mon.edog.killed_by_u,1);
});
test('real lifesaving completes, retaining C damageum return flag',async()=>{
    const s=await prepare(P.PM_DINGO,A.AD_PHYS);
    const amulet=mksobj(O.AMULET_OF_LIFE_SAVING,false,false);
    await mpickobj(s.mon,amulet);await m_dowear(s.mon,true);assert.equal(which_armor(s.mon,C.W_AMUL),amulet);
    s.mon.mhp=1;clearMessages();seed(19);
    assert.equal(await hit(s),C.M_ATTK_DEF_DIED,'C does not recheck death after xkilled');
    assert.ok(s.mon.mhp>0);assert.equal(s.mon.minvent.includes(amulet),false);
    assert.equal(!!game.mkcorpstat_norevive,false);
});
for(const artifact of [false,true]) test(`Trollsbane corpse flag, artifact=${artifact}`,async()=>{
    const s=await prepare(P.PM_XORN,A.AD_PHYS,P.PM_TROLL);
    const weapon=await wield(O.MORNING_STAR,artifact?'Trollsbane':null);
    assert.equal(weapon.oartifact||0,artifact?ART_TROLLSBANE:0);
    s.mon.mhp=1;clearMessages();seed(19);
    assert.equal(await hit(s),C.M_ATTK_DEF_DIED);
    const corpse=game.level.objects.find(o=>o.otyp===O.CORPSE&&o.corpsenm===P.PM_TROLL);
    assert.ok(corpse);assert.equal(!!corpse.norevive,artifact);assert.equal(!!game.mkcorpstat_norevive,false);
});
test('normal physical bite stays unchanged',async()=>{
    const s=await prepare(P.PM_DINGO,A.AD_PHYS);assert.equal(await hit(s),C.M_ATTK_HIT);
    assert.equal(s.mon.mhp,95);assert.deepEqual(getRngLog(),['d(1,6)=5']);assert.equal(messages(),'');
});
test('shade keeps only supplied special damage',async()=>{
    const s=await prepare(P.PM_XORN,A.AD_PHYS,P.PM_SHADE);
    assert.equal(await damageum(s.mon,s.attack,3),C.M_ATTK_HIT);assert.equal(s.mon.mhp,97);
});
for(const bonus of [-30,0,5]) test(`thick skin kick with bonus ${bonus}`,async()=>{
    const s=await prepare(P.PM_HORSE,A.AD_PHYS,P.PM_MASTODON);
    assert.ok(thick_skinned(s.mon.data));
    const kick=game.youmonst.data.mattk.find(a=>a[0]===A.AT_KICK);assert.ok(kick);
    game.u.udaminc=bonus;assert.equal(await damageum(s.mon,kick,0),C.M_ATTK_HIT);
    assert.equal(s.mon.mhp,100-Math.max(bonus,0));
});
for(const [name,form,armed] of [['ordinary',P.PM_DINGO,false],['weapon',P.PM_VROCK,true],
    ['amorous',P.PM_AMOROUS_DEMON,false],['balrog',P.PM_BALROG,false]])test(`demon guard exclusion ${name}`,async()=>{
    const s=await prepare(form,A.AD_PHYS);if(armed)await wield(O.CLUB);
    clearMessages();seed(name==='balrog'?1:13);const count=game.level.monsters.length;
    assert.equal(await hit(s),C.M_ATTK_HIT);assert.equal(game.level.monsters.length,count);
    assert.equal(getRngLog().filter(c=>c.startsWith('rn2(13)=')).length,name==='ordinary'?0:1);
    if(name!=='ordinary')assert.equal(getRngLog()[1],'rn2(13)=0','later guards must reject a successful roll');
    assert.equal(getRngLog().some(c=>c.startsWith('rn2(6)=')),false);
    assert.equal(messages().includes('hell-p'),false);
});
test('demon failed roll still deals its normal damage',async()=>{
    const s=await prepare(P.PM_VROCK,A.AD_PHYS);seed(19);
    assert.equal(await hit(s),C.M_ATTK_HIT);assert.equal(s.mon.mhp,100-rolled());
    assert.equal(getRngLog().length,2);assert.ok(getRngLog()[1].startsWith('rn2(13)='));
});
for(const summonSeed of [13,28]) test(`real demon summon, choice seed=${summonSeed}`,async()=>{
    const s=await prepare(P.PM_VROCK,A.AD_PHYS);const ids=new Set(game.level.monsters.map(m=>m.m_id));
    clearMessages();seed(summonSeed);assert.equal(await hit(s),C.M_ATTK_MISS);
    assert.equal(s.mon.mhp,100);assert.equal(s.mon.mstrategy,C.STRAT_WAITFORU);
    const pets=game.level.monsters.filter(m=>!ids.has(m.m_id));
    assert.ok(pets.length>0);assert.ok(pets.some(m=>m.mtame>0&&m.edog));
    assert.ok(pets.every(m=>m.data===game.mons[m.mnum]));assert.match(messages(),/Some hell-p has arrived!/);
    assert.equal(getRngLog()[1],'rn2(13)=0');assert.ok(getRngLog().at(-1).startsWith('rn2(19)='));
});
for(const caller of [false,true]) test(`slow pending More precedes damage, caller=${caller}`,async()=>{
    const s=await prepare(P.PM_SKELETON,A.AD_SLOW);
    await pline('A prior message occupies enough of the topline to require acknowledgment.');seed(19);
    let hp;
    const result=await pendingMore(s.run,()=>caller?hmonas(s.mon):hit(s),state=>{
        assert.equal(state.done,false);assert.equal(state.reads,1);hp=s.mon.mhp;
        assert.equal(s.mon.mspeed,C.MSLOW);
        if(!caller){assert.equal(hp,100);assert.equal(s.mon.mstrategy,C.STRAT_WAITFORU);}
    },()=>!caller||s.mon.mspeed===C.MSLOW);
    if(!caller){assert.equal(result,C.M_ATTK_HIT);assert.equal(s.mon.mhp,95);}
    else {assert.equal(result,true);assert.ok(s.mon.mhp<hp);assert.equal(game.twohits,0);}
});
test('demon More precedes selection, pet creation and wisdom exercise',async()=>{
    const s=await prepare(P.PM_VROCK,A.AD_PHYS);const count=game.level.monsters.length;
    await pline('A prior message occupies enough of the topline to require acknowledgment.');seed(13);
    assert.equal(await pendingMore(s.run,()=>hit(s),state=>{
        assert.equal(state.done,false);assert.equal(state.reads,1);
        assert.equal(game.level.monsters.length,count);assert.equal(s.mon.mhp,100);
        assert.deepEqual(getRngLog(),['d(1,4)=3','rn2(13)=0']);
    }),C.M_ATTK_MISS);
    assert.ok(game.level.monsters.length>count);
});
test('death More retains corpse flag until killed completes',async()=>{
    const s=await prepare(P.PM_XORN,A.AD_PHYS,P.PM_TROLL);
    await wield(O.MORNING_STAR,'Trollsbane');s.mon.mhp=1;
    clearMessages();await pline('A prior message occupies enough of the topline to require acknowledgment.');seed(19);
    await pendingMore(s.run,()=>hit(s),state=>{
        assert.equal(state.done,false);assert.equal(state.reads,1);
        assert.ok(s.mon.mhp<=0);assert.equal(game.mkcorpstat_norevive,true);
        assert.equal(game.level.objects.some(o=>o.otyp===O.CORPSE),false);
    });
    assert.equal(game.mkcorpstat_norevive,false);
    assert.ok(game.level.objects.some(o=>o.otyp===O.CORPSE&&o.norevive));
});
test('no legal map square still exercises wisdom and returns miss',async()=>{
    const s=await prepare(P.PM_VROCK,A.AD_PHYS);const count=game.level.monsters.length;
    game.iflags.debug_overwrite_stairs=true; // C CAN_OVERWRITE_TERRAIN guard.
    for(let xx=1;xx<C.COLNO;xx++)for(let yy=0;yy<C.ROWNO;yy++) {
        if((xx===x&&yy===y)||(xx===s.mon.mx&&yy===s.mon.my))continue;
        set_levltyp(xx,yy,C.STONE);
        assert.equal(game.level.at(xx,yy).typ,C.STONE);
    }
    clearMessages();seed(13);assert.equal(await hit(s),C.M_ATTK_MISS);
    assert.equal(game.level.monsters.length,count);assert.equal(s.mon.mhp,100);
    assert.equal(s.mon.mstrategy,C.STRAT_WAITFORU);
    assert.ok(getRngLog().at(-1).startsWith('rn2(19)='));
});
for(const cooldown of [false,true])test(`shared done bypasses damage and strategy, cooldown=${cooldown}`,async()=>{
    const s=await prepare(P.PM_GENETIC_ENGINEER,A.AD_POLY,P.PM_GRAY_DRAGON);
    game.youmonst.mspec_used=+cooldown;
    assert.equal(await hit(s),C.M_ATTK_HIT);
    assert.equal(s.mon.mhp,cooldown?100-rolled():100);
    assert.equal(s.mon.mstrategy,cooldown?0:C.STRAT_WAITFORU);
});
for(const value of [2,19])test(`ordinary kick command completes hit or miss, seed=${value}`,async()=>{
    const s=await prepare(P.PM_HORSE,A.AD_PHYS);
    const kick=game.youmonst.data.mattk.find(a=>a[0]===A.AT_KICK);assert.ok(kick);
    pushKeys('l');seed(value);
    assert.equal(await dokick(),C.ECMD_TIME);
    const rolls=getRngLog().filter(call=>call.startsWith(`d(${kick[2]},${kick[3]})=`));
    assert.equal(rolls.length,value===2?1:0);
    if(value===2){
        assert.equal(s.mon.mhp,100-Number(rolls[0].split('=')[1]));
        assert.match(messages(),/You kick the ogre\./);assert.equal(s.mon.mstrategy&C.STRAT_WAITFORU,0);
    }else{assert.equal(s.mon.mhp,100);assert.match(messages(),/You miss the ogre\./);}
});
