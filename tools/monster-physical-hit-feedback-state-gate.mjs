// C uhitm.c:3981-4200, constructed states through normal public APIs.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup, seed, form, clearMessages, messages} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {mhitm_ad_phys, hmonas} from '../js/uhitm.js';
import {mksobj, set_corpsenm} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {mpickobj} from '../js/steal.js';
import {mon_wield_item, select_hwep} from '../js/weapon.js';
import {oname} from '../js/do_name.js';
import {polymon} from '../js/polyself.js';
import {set_ustuck} from '../js/mon.js';
import {setworn} from '../js/worn.js';
import {Stone_resistance} from '../js/youprop.js';
import {make_stoned} from '../js/potion.js';
import {msgtype_parse_add} from '../js/options.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P, ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function create(species, x=32, y=10) {
    const mon = await makemon(game.mons[species], x, y,
        C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(mon); Object.assign(mon,{mpeaceful:0,mux:31,muy:10}); return mon;
}
async function prepare(species=P.PM_OWLBEAR) {
    const run=await setup(), mon=await create(species);
    game.flags.accessiblemsg=true; game.iflags.getpos_coords='m';
    clearMessages(); seed(0); return {run,mon};
}
function damage() { return {damage:3, hitflags:C.M_ATTK_MISS, done:false, indx:0, dieroll:10}; }
const hug = mon => mon.data.mattk.find(a=>a[0]===A.AT_HUGS);
async function wield(mon, obj) {
    await mpickobj(mon,obj); assert.equal(select_hwep(mon),obj);
    mon.weapon_check=C.NEED_HTH_WEAPON; assert.equal(await mon_wield_item(mon),1);
    assert.equal(mon.mw,obj); assert.equal(obj.where,C.OBJ_MINVENT);
    assert.ok(obj.owornmask&C.W_WEP); clearMessages(); seed(0); return obj;
}
async function corpse() {
    const pair=await prepare(P.PM_SKELETON), obj=mksobj(O.CORPSE,false,false);
    set_corpsenm(obj,P.PM_COCKATRICE); await wield(pair.mon,obj);
    return {...pair,obj};
}
async function artifact(name='Grimtooth') {
    const pair=await prepare(P.PM_ORC), target=await create(P.PM_NEWT,33);
    const type=name==='Grimtooth'?O.ORCISH_DAGGER:O.LONG_SWORD;
    const obj=await oname(mksobj(type,false,false),name,C.ONAME_NO_FLAGS);
    assert.ok(obj.oartifact); await wield(pair.mon,obj); game.vis=true;
    return {...pair,target,obj};
}

for (const accessible of [true,false]) for(const rngSeed of [0,4])
test(`grab location=${accessible}, selection draw seed=${rngSeed}`,async()=>{
    const {mon}=await prepare();game.flags.accessiblemsg=accessible;seed(rngSeed);
    const mhm=damage();await mhitm_ad_phys(mon,hug(mon),game.youmonst,mhm);
    const grabbed=rngSeed===0;
    assert.equal(game.u.ustuck,grabbed?mon:null);
    assert.equal(mhm.damage,3);assert.equal(mhm.done,false);
    assert.equal(mhm.hitflags,grabbed?C.M_ATTK_HIT:C.M_ATTK_MISS);
    assert.deepEqual(getRngLog(),[`rn2(2)=${grabbed?1:0}`]);
    if(grabbed)assert.ok(messages().includes(`${accessible?'<32,10>: ':''}The owlbear grabs you!`));
    else assert.equal(messages().trim(),'');
});
for(const species of [P.PM_OWLBEAR,P.PM_ROPE_GOLEM]) test(`existing holder ${species} uses continuation`,async()=>{
    const {mon}=await prepare(species);set_ustuck(mon);clearMessages();seed(0);
    const mhm=damage();await mhitm_ad_phys(mon,hug(mon),game.youmonst,mhm);
    assert.equal(game.u.ustuck,mon);assert.equal(mhm.hitflags,C.M_ATTK_MISS);
    assert.match(messages(),species===P.PM_ROPE_GOLEM?/You are being choked\./:/You are being crushed\./);
    assert.doesNotMatch(messages(),/grabs you/);
});
test('a different holder is not displaced by this hug',async()=>{
    const {mon}=await prepare(), other=await create(P.PM_ROPE_GOLEM,31,11);
    set_ustuck(other);clearMessages();seed(0);
    const mhm=damage();await mhitm_ad_phys(mon,hug(mon),game.youmonst,mhm);
    assert.equal(game.u.ustuck,other);assert.equal(mhm.hitflags,C.M_ATTK_MISS);
    assert.equal(messages().trim(),'');assert.deepEqual(getRngLog(),[]);
});
test('sticky hero takes the ordinary hit route without a grab draw',async()=>{
    const {mon}=await prepare();form(P.PM_LARGE_MIMIC);clearMessages();seed(0);
    const mhm=damage();await mhitm_ad_phys(mon,hug(mon),game.youmonst,mhm);
    assert.equal(game.u.ustuck,null);assert.equal(mhm.hitflags,C.M_ATTK_HIT);
    assert.match(messages(),/hits!/);assert.doesNotMatch(messages(),/grabs you/);
    assert.deepEqual(getRngLog(),[]);
});
test('real oilskin equipment rejects the grab before holder assignment',async()=>{
    const {mon}=await prepare();const cloak=await addinv(mksobj(O.OILSKIN_CLOAK,false,false));
    await setworn(cloak,C.W_ARMC);game.flags.accessiblemsg=false;
    clearMessages();seed(0);const mhm=damage();
    await mhitm_ad_phys(mon,hug(mon),game.youmonst,mhm);
    assert.equal(game.u.ustuck,null);assert.equal(mhm.damage,0);
    assert.equal(mhm.hitflags,C.M_ATTK_MISS);
    assert.match(messages(),/grabs you, but cannot hold onto/);
    assert.deepEqual(getRngLog(),['rn2(2)=1']);
});

for(const mode of ['unprotected','resistant','already stoned','plain']) test(`actual wielded petrifying corpse: ${mode}`,async()=>{
    const {mon,obj}=await corpse();
    if(mode==='resistant')form(P.PM_STONE_GOLEM);
    if(mode==='already stoned')await make_stoned(7,null,C.KILLED_BY_AN,'earlier cause');
    if(mode==='plain')game.flags.accessiblemsg=false;
    clearMessages();seed(0);const mhm=damage();
    await mhitm_ad_phys(mon,mon.data.mattk[0],game.youmonst,mhm);
    assert.ok(messages().includes(`${mode==='plain'?'':'<32,10>: '}The skeleton hits you with the cockatrice corpse.`));
    assert.equal(mon.mw,obj);assert.equal(obj.where,C.OBJ_MINVENT);assert.equal(obj.ocarry,mon);
    assert.equal(mhm.hitflags,C.M_ATTK_HIT);
    if(mode==='unprotected'||mode==='plain'){
        assert.equal((game.u.uprops?.STONED || 0),5);assert.equal(mhm.damage,1);assert.equal(mhm.done,1);
        assert.deepEqual(getRngLog(),[]);
    }else{
        assert.equal((game.u.uprops?.STONED || 0)||0,mode==='already stoned'?7:0);
        assert.equal(mhm.done,false);assert.ok(mhm.damage>=1);
        assert.match(messages(),/The skeleton hits!/);
    }
});
test('actual stone-golem conversion precedes continuation without a stoning timer',async()=>{
    const {mon}=await corpse();await polymon(P.PM_IRON_GOLEM);assert.equal(!!Stone_resistance(),false);
    clearMessages();seed(0);const mhm=damage();
    await mhitm_ad_phys(mon,mon.data.mattk[0],game.youmonst,mhm);
    assert.equal(game.u.umonnum,P.PM_STONE_GOLEM);assert.equal((game.u.uprops?.STONED || 0)||0,0);
    assert.equal(mhm.done,false);assert.equal(mhm.hitflags,C.M_ATTK_HIT);
});

for(const accessible of [true,false]) for(const visible of [true,false])
test(`real artifact fallback accessible=${accessible}, global visibility=${visible}`,async()=>{
    const {mon,target,obj}=await artifact();game.vis=visible;game.flags.accessiblemsg=accessible;
    const hp=target.mhp,mhm=damage();await mhitm_ad_phys(mon,mon.data.mattk[0],target,mhm);
    assert.equal(mhm.hitflags,C.M_ATTK_HIT);assert.equal(mhm.done,false);
    assert.ok(mhm.damage>3);assert.equal(target.mhp,hp,'owner computes damage; its caller applies it');
    assert.equal(mon.mw,obj);assert.equal(obj.where,C.OBJ_MINVENT);
    if(visible)assert.ok(messages().includes(`${accessible?'<32,10>: ':''}The orc hits the newt.`));
    else assert.equal(messages().trim(),'');
    assert.deepEqual(getRngLog().map(x=>x.replace(/=.*/,'')),['rnd(3)','rnd(6)','rn2(4)']);
});
test('artifact-handled hit suppresses the ordinary fallback',async()=>{
    const {mon,target}=await artifact('Fire Brand');const mhm=damage();
    await mhitm_ad_phys(mon,mon.data.mattk[0],target,mhm);
    assert.match(messages(),/The fiery blade burns the newt!/);
    assert.doesNotMatch(messages(),/The orc hits/);
    assert.equal(mhm.hitflags,C.M_ATTK_MISS,'handled artifact did not enter the fallback flag assignment');
});
test('nonartifact monster weapon has no owner fallback message',async()=>{
    const {mon}=await prepare(P.PM_ORC), target=await create(P.PM_NEWT,33);
    await wield(mon,mksobj(O.DAGGER,false,false));game.vis=true;
    const mhm=damage();await mhitm_ad_phys(mon,mon.data.mattk[0],target,mhm);
    assert.equal(messages().trim(),'');assert.equal(mhm.hitflags,C.M_ATTK_MISS);
});
test('stone-golem natural attacks reject a shade before physical damage',async()=>{
    const {mon}=await prepare(P.PM_SHADE);await polymon(P.PM_STONE_GOLEM);
    game.u.dx=1;game.u.dy=0;game.bhitpos={x:mon.mx,y:mon.my};
    const hp=mon.mhp;clearMessages();seed(0);await hmonas(mon);
    assert.equal(mon.mhp,hp);assert.match(messages(),/harmlessly through/);
    assert.doesNotMatch(messages(),/bad shade attack function flow/);
});

async function atMore(run,action,inspect){
    let entered,release,done=false,timer;
    const waiting=new Promise(resolve=>entered=resolve);
    run._display.onEmptyQueue=()=>{entered();return new Promise(resolve=>release=resolve);};
    const pending=action().then(value=>{done=true;return value;});
    try{
        await Promise.race([waiting,pending.then(()=>{throw Error('expected pending More');}),
            new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('More timeout')),2000))]);
        await setImmediate();assert.equal(done,false);inspect();
    }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;release?.(32);await pending;}
    assert.equal(done,true);
}
test('grab More retains holder assignment but delays hit flag',async()=>{
    const {run,mon}=await prepare();assert.ok(msgtype_parse_add('stop "grabs you"'));
    const mhm=damage();await atMore(run,()=>mhitm_ad_phys(mon,hug(mon),game.youmonst,mhm),()=>{
        assert.match(game._toplines,/<32,10>: The owlbear grabs you!/);
        assert.equal(game.u.ustuck,mon);assert.equal(mhm.hitflags,C.M_ATTK_MISS);
    });assert.equal(mhm.hitflags,C.M_ATTK_HIT);
});
test('corpse More precedes petrification and done flag',async()=>{
    const {run,mon,obj}=await corpse();assert.ok(msgtype_parse_add('stop "hits you with the cockatrice"'));
    const mhm=damage();await atMore(run,()=>mhitm_ad_phys(mon,mon.data.mattk[0],game.youmonst,mhm),()=>{
        assert.match(game._toplines,/<32,10>: The skeleton hits you with/);
        assert.equal((game.u.uprops?.STONED || 0)||0,0);assert.equal(mhm.damage,1);assert.equal(mhm.done,false);
        assert.equal(mhm.hitflags,C.M_ATTK_MISS);assert.equal(mon.mw,obj);
    });assert.equal((game.u.uprops?.STONED || 0),5);assert.equal(mhm.done,1);
});
test('artifact fallback More keeps computed bonus but delays hit flag',async()=>{
    const {run,mon,target}=await artifact();assert.ok(msgtype_parse_add('stop "The orc hits the newt"'));
    const mhm=damage(),hp=target.mhp;
    await atMore(run,()=>mhitm_ad_phys(mon,mon.data.mattk[0],target,mhm),()=>{
        assert.match(game._toplines,/<32,10>: The orc hits the newt\./);
        assert.ok(mhm.damage>3);assert.equal(mhm.hitflags,C.M_ATTK_MISS);
        assert.equal(target.mhp,hp);assert.equal(mhm.done,false);
        assert.deepEqual(getRngLog().map(x=>x.replace(/=.*/,'')),['rnd(3)','rnd(6)']);
    });assert.equal(mhm.hitflags,C.M_ATTK_HIT);
    assert.deepEqual(getRngLog().map(x=>x.replace(/=.*/,'')),['rnd(3)','rnd(6)','rn2(4)']);
});
