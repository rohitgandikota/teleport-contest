// C mhitu.c:310-444. Constructed source boundaries using real game helpers.
// Prepared during the full804 hold, then verified under the recorded release.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup,clearMessages,messages,seed,x,y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {adjalign} from '../js/attrib.js';
import {getmattk,mattacku} from '../js/mhitu.js';
import {mattackm} from '../js/mhitm.js';
import {set_apparxy} from '../js/monmove.js';
import {makemon} from '../js/makemon.js';
import {cancel_monst,bhitm} from '../js/zap.js';
import {mksobj,mkcorpstat} from '../js/mkobj.js';
import {addinv,obj_extract_self} from '../js/invent.js';
import {mpickobj} from '../js/steal.js';
import {mon_wield_item,select_hwep} from '../js/weapon.js';
import {MON_WEP} from '../js/monst.js';
import {oname} from '../js/do_name.js';
import {m_dowear,which_armor} from '../js/worn.js';
import {setuwep} from '../js/wield.js';
import {polymon} from '../js/polyself.js';
import {pline} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P,ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

const slots=()=>Array(C.NATTK).fill(C.M_ATTK_MISS);
async function prepare(pm=P.PM_BARROW_WIGHT,naturalInventory=false) {
    const run=await setup();
    const mon=await makemon(game.mons[pm],x+1,y,
        C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG|(naturalInventory?0:C.NO_MINVENT));
    assert.equal(mon.data,game.mons[pm]);
    Object.assign(mon,{msleeping:0,mpeaceful:0,mhp:1000,mhpmax:1000});
    Object.assign(game.u,{uhp:1000,uhpmax:1000,dx:1,dy:0});
    set_apparxy(mon); // dochug does this before calling mattacku.
    assert.deepEqual([mon.mux,mon.muy],[game.u.ux,game.u.uy]);
    game.bhitpos={x:mon.mx,y:mon.my};game.notonhead=false;
    clearMessages();seed(2);
    return {run,mon};
}
async function cancel(mon) {
    const wand=mksobj(O.WAN_CANCELLATION,false,false);
    const inventory=(mon.minvent||[]).map(o=>[o.o_id,o.spe,o.otyp,o.oartifact]);
    // Repeated real resistance attempts, not a direct write to mcan.
    let attempts=0;
    while(!mon.mcan && attempts++<64)
        await cancel_monst(mon,wand,true,true,false);
    assert.equal(mon.mcan,1,'real cancellation must succeed');
    assert.deepEqual((mon.minvent||[]).map(o=>[o.o_id,o.spe,o.otyp,o.oartifact]),inventory);
    clearMessages();seed(2);
    return wand;
}
async function wield(mon,obj=mksobj(O.LONG_SWORD,false,false)) {
    await mpickobj(mon,obj);
    mon.weapon_check=C.NEED_HTH_WEAPON;
    assert.equal(await mon_wield_item(mon),1);
    assert.equal(MON_WEP(mon),obj);
    assert.ok((obj.owornmask&C.W_WEP)!==0);
    clearMessages();seed(2);
    return obj;
}
function selected(mon,def=game.youmonst,index=0) {
    const rng=getRngLog().slice();
    const result=getmattk(mon,def,index,slots());
    assert.ok(Array.isArray(result));
    assert.equal(result.then,undefined,'selector retains scalar return');
    assert.deepEqual(getRngLog(),rng,'selector does not draw RNG');
    return result;
}
function expectPhysical(mon,def=game.youmonst) {
    const original=mon.data.mattk[0],copy=[...original];
    const attack=selected(mon,def);
    assert.notEqual(attack,original);
    assert.deepEqual([...attack],[A.AT_WEAP,A.AD_PHYS,copy[2],copy[3]]);
    assert.equal(attack.getmattk_alternate,true);
    assert.deepEqual([...original],copy,'live species attack must not change');
    return attack;
}
for(const pm of [P.PM_BARROW_WIGHT,P.PM_NAZGUL,P.PM_ERINYS]) {
    test(`cancel_monst selects physical first weapon for species ${pm}`,async()=>{
        const {mon}=await prepare(pm);await wield(mon);await cancel(mon);
        expectPhysical(mon);
    });
    test(`uncancelled ordinary weapon retains species ${pm} attack`,async()=>{
        const {mon}=await prepare(pm);await wield(mon);
        assert.equal(mon.mcan||0,0);assert.equal(selected(mon),mon.data.mattk[0]);
    });
}
for(const pm of [P.PM_WRAITH,P.PM_GOBLIN])
 test(`cancelled nonweapon or physical species ${pm} is unchanged`,async()=>{
    const {mon}=await prepare(pm);await cancel(mon);
    assert.equal(selected(mon),mon.data.mattk[0]);
});
test('cancellation substitutes even with no wielded weapon',async()=>{
    const {mon}=await prepare();assert.equal(MON_WEP(mon),null);await cancel(mon);
    expectPhysical(mon);
});
test('alignment-abuse second erinys weapon stays poisonous while the first becomes physical',async()=>{
    const {mon}=await prepare(P.PM_ERINYS);await adjalign(-36);await cancel(mon);
    assert.deepEqual(mon.data.mattk[0],[A.AT_WEAP,A.AD_DRST,3,4]);
    assert.deepEqual(mon.data.mattk[1],[A.AT_WEAP,A.AD_DRST,3,4]);
    expectPhysical(mon);assert.equal(selected(mon,game.youmonst,1),mon.data.mattk[1]);
});
test('Master Assassin physical second weapon excludes cancelled first poison weapon',async()=>{
    const {mon}=await prepare(P.PM_MASTER_ASSASSIN);await cancel(mon);
    assert.deepEqual(mon.data.mattk.slice(0,2).map(a=>a.slice(0,2)),
        [[A.AT_WEAP,A.AD_DRST],[A.AT_WEAP,A.AD_PHYS]]);
    assert.equal(selected(mon),mon.data.mattk[0]);
});
test('Yeenoghu nonphysical second weapon stays unchanged after cancellation',async()=>{
    const {mon}=await prepare(P.PM_YEENOGHU);await cancel(mon);
    assert.deepEqual(mon.data.mattk[1].slice(0,2),[A.AT_WEAP,A.AD_CONF]);
    assert.equal(selected(mon,game.youmonst,1),mon.data.mattk[1]);
});
test('uncancelled Stormbringer wielder selects physical without changing the table',async()=>{
    const {mon}=await prepare();
    const obj=await oname(mksobj(O.RUNESWORD,false,false),'Stormbringer',C.ONAME_NO_FLAGS);
    assert.ok(obj.oartifact);await wield(mon,obj);assert.equal(mon.mcan||0,0);
    expectPhysical(mon);
});
test('an unwielded Stormbringer does not replace an attack',async()=>{
    const {mon}=await prepare();
    const obj=await oname(mksobj(O.RUNESWORD,false,false),'Stormbringer',C.ONAME_NO_FLAGS);
    assert.ok(obj.oartifact);await mpickobj(mon,obj);
    assert.equal(MON_WEP(mon),null);assert.equal(selected(mon),mon.data.mattk[0]);
});
test('unrelated wielded Sting does not replace the special attack',async()=>{
    const {mon}=await prepare();
    const obj=await oname(mksobj(O.ELVEN_DAGGER,false,false),'Sting',C.ONAME_NO_FLAGS);
    assert.ok(obj.oartifact);await wield(mon,obj);
    assert.equal(selected(mon),mon.data.mattk[0]);
});
test('neutral Vorpal Blade is refused by an ordinary chaotic barrow wight',async()=>{
    const {mon}=await prepare();
    const obj=await oname(mksobj(O.LONG_SWORD,false,false),'Vorpal Blade',C.ONAME_NO_FLAGS);
    assert.ok(obj.oartifact);await mpickobj(mon,obj);
    assert.equal(select_hwep(mon),null);
    mon.weapon_check=C.NEED_HTH_WEAPON;assert.equal(await mon_wield_item(mon),0);
    assert.equal(MON_WEP(mon),null);assert.equal(selected(mon),mon.data.mattk[0]);
});
test('covetous Master Assassin can wield Vorpal but the second weapon guard still wins',async()=>{
    const {mon}=await prepare(P.PM_MASTER_ASSASSIN);
    const obj=await oname(mksobj(O.LONG_SWORD,false,false),'Vorpal Blade',C.ONAME_NO_FLAGS);
    assert.ok(obj.oartifact);await wield(mon,obj);
    assert.equal(selected(mon),mon.data.mattk[0]);
});
test('gloved cockatrice corpse wielder selects physical through the real weapon producer',async()=>{
    const {mon}=await prepare();
    const gloves=mksobj(O.LEATHER_GLOVES,false,false);await mpickobj(mon,gloves);
    await m_dowear(mon,true);assert.equal(which_armor(mon,C.W_ARMG),gloves);
    const corpse=mkcorpstat(O.CORPSE,null,game.mons[P.PM_COCKATRICE],x+2,y,0);
    await obj_extract_self(corpse);await wield(mon,corpse);
    assert.equal(corpse.corpsenm,P.PM_COCKATRICE);expectPhysical(mon);
});
test('ordinary corpse is not selected as a weapon',async()=>{
    const {mon}=await prepare();
    const corpse=mkcorpstat(O.CORPSE,null,game.mons[P.PM_LIZARD],x+2,y,0);
    await obj_extract_self(corpse);await mpickobj(mon,corpse);
    assert.equal(select_hwep(mon),null);assert.equal(MON_WEP(mon),null);
    assert.equal(selected(mon),mon.data.mattk[0]);
});
test('real hero barrow wight wielding Stormbringer retains its life-drain attack',async()=>{
    const {mon}=await prepare(P.PM_OGRE);assert.equal(await polymon(P.PM_BARROW_WIGHT),1);
    const obj=await oname(mksobj(O.RUNESWORD,false,false),'Stormbringer',C.ONAME_NO_FLAGS);
    await addinv(obj);await setuwep(obj);assert.equal(game.u.uwep,obj);
    clearMessages();seed(2);
    const attack=selected(game.youmonst,mon);
    assert.equal(attack,game.youmonst.data.mattk[0]);assert.equal(attack[1],A.AD_DRLI);
});
test('natural wight inventory supplies a long sword before actual wand impact',async()=>{
    const {mon}=await prepare(P.PM_BARROW_WIGHT,true);
    assert.ok(mon.minvent.some(o=>o.otyp===O.KNIFE));
    assert.ok(mon.minvent.some(o=>o.otyp===O.LONG_SWORD));
    mon.weapon_check=C.NEED_HTH_WEAPON;await mon_wield_item(mon);
    assert.equal(MON_WEP(mon)?.otyp,O.LONG_SWORD);
    const wand=mksobj(O.WAN_CANCELLATION,false,false);mon.msleeping=1;
    let attempts=0;
    while(!mon.mcan && attempts++<64) await bhitm(mon,wand);
    assert.equal(mon.mcan,1);assert.equal(mon.msleeping,0);
    expectPhysical(mon);
});
async function armedErinys() {
    const s=await prepare(P.PM_ERINYS);
    const weapon=mksobj(O.LONG_SWORD,false,false);
    // Constructed high enchantment guarantees a landed, nonfatal weapon hit.
    weapon.spe=30;await wield(s.mon,weapon);await cancel(s.mon);
    return s;
}
test('mattacku applies weapon damage after the cancelled erinys selector',async()=>{
    const {mon}=await armedErinys(),hp=game.u.uhp;
    assert.equal(await mattacku(mon),0);
    assert.ok(hp-game.u.uhp>8,'weapon damage exceeds the original 2d4 attack');
    assert.match(messages(),/hits/);assert.equal(game.u.ulevel,1);
});
test('mattackm consumes the selected physical weapon attack',async()=>{
    const {mon}=await armedErinys();
    const target=await makemon(game.mons[P.PM_OGRE],x+2,y,
        C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    Object.assign(target,{mhp:1000,mhpmax:1000,msleeping:0});
    game.bhitpos={x:target.mx,y:target.my};clearMessages();seed(2);
    assert.equal(await mattackm(mon,target),C.M_ATTK_HIT);
    assert.ok(1000-target.mhp>8,'shared monster caller applies wielded damage');
});
test('mattacku remains pending at real More before weapon damage is applied',async()=>{
    const {run,mon}=await armedErinys();await pline('A'.repeat(79));
    let enter,timer,done=false;const releases=[];
    const reached=new Promise(resolve=>{enter=resolve;});
    run._display.onEmptyQueue=()=>{enter();return new Promise(resolve=>releases.push(resolve));};
    const hp=game.u.uhp;
    const owner=mattacku(mon).then(result=>{done=true;return result;});
    try {
        await Promise.race([reached,owner.then(()=>{throw Error('completed before More');}),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('More not reached')),2000);})]);
        await setImmediate();assert.equal(done,false);assert.equal(game.u.uhp,hp);
        assert.equal(mon.mcan,1);assert.equal(selected(mon)[1],A.AD_PHYS);
    } finally {
        clearTimeout(timer);run._display.onEmptyQueue=()=>32;
        for(const release of releases)release(32);
        await owner;
    }
    assert.ok(hp-game.u.uhp>8);assert.equal(done,true);
});
