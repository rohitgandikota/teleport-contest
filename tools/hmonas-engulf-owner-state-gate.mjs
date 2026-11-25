// Unchanged owner contracts, C uhitm.c:4891-5196, 5762-5798.
// No species, attack, or status helper is replaced or normalized.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup,clearMessages,messages,seed,x,y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {hmonas,gulpum,explum} from '../js/uhitm.js';
import {polymon} from '../js/polyself.js';
import {makemon} from '../js/makemon.js';
import {newcham} from '../js/mon.js';
import {make_sick} from '../js/potion.js';
import {Sick_resistance} from '../js/youprop.js';
import {mksobj} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {setworn} from '../js/worn.js';
import {Ring_on} from '../js/do_wear.js';
import {getRngLog} from '../js/rng.js';
import {dosave0} from '../js/save.js';
import {dorecover} from '../js/restore.js';
import {PMNAMES as P,ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';
async function prepare(form,victim,{accuracy=false}={}){
    const run=await setup();
    if(accuracy){const ring=await addinv(mksobj(O.RIN_INCREASE_ACCURACY,false,false));ring.spe=30;await setworn(ring,C.W_RINGR);await Ring_on(ring);assert.equal(game.u.uhitinc,30);}
    assert.equal(await polymon(form),1);assert.equal(game.youmonst.data,game.mons[form]);assert.equal(game.youmonst.mnum,form);
    const mon=await makemon(game.mons[victim],x+1,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.equal(mon.data,game.mons[victim]);assert.equal(mon.mnum,victim);
    Object.assign(mon,{mhp:1000,mhpmax:1000,mpeaceful:0,msleeping:0});
    Object.assign(game.u,{dx:1,dy:0});game.bhitpos={x:x+1,y};game.notonhead=false;
    clearMessages();seed(2);return {run,mon,attack:game.youmonst.data.mattk.find(a=>a[0]===A.AT_ENGL||a[0]===A.AT_EXPL)};
}
for(const [victim,immune]of [[P.PM_FLESH_GOLEM,true],[P.PM_NEWT,true],[P.PM_FLAMING_SPHERE,false],[P.PM_GOBLIN,false]])
 test(`real fog form chooses moisture and immunity: victim ${victim}`,async()=>{
    const {mon,attack}=await prepare(P.PM_FOG_CLOUD,victim);
    assert.equal(await gulpum(mon,attack),C.M_ATTK_MISS);
    const damage=Number(getRngLog()[0].split('=')[1]);assert.ok(damage>0);
    assert.equal(mon.mhp,1000-(immune?0:damage));assert.match(messages(),/laden with your moisture/);
    assert.equal(messages().includes('seems unharmed.'),immune);assert.match(messages(),/You expel/);
    assert.equal(game.youmonst.data,game.mons[game.youmonst.mnum]);
 });
test('a real form change leaves fog-specific feedback behind',async()=>{
    const {mon}=await prepare(P.PM_FOG_CLOUD,P.PM_GOBLIN);
    assert.equal(await polymon(P.PM_AIR_ELEMENTAL),1);clearMessages();seed(2);
    const attack=game.youmonst.data.mattk.find(a=>a[0]===A.AT_ENGL);
    await gulpum(mon,attack);assert.equal(game.youmonst.mnum,P.PM_AIR_ELEMENTAL);
    assert.equal(game.youmonst.data,game.mons[P.PM_AIR_ELEMENTAL]);
    assert.match(messages(),/pummeled with your debris/);assert.doesNotMatch(messages(),/moisture/);
});
test('maker and polymorph keep shade identity coherent at the hmonas guard',async()=>{
    const {mon}=await prepare(P.PM_FOG_CLOUD,P.PM_GOBLIN,{accuracy:true});
    await newcham(mon,game.mons[P.PM_SHADE],C.NO_NC_FLAGS);
    assert.equal(mon.data,game.mons[P.PM_SHADE]);assert.equal(mon.mnum,P.PM_SHADE);
    const hp=mon.mhp;clearMessages();seed(2);await hmonas(mon);
    assert.equal(mon.mhp,hp);assert.match(messages(),/attempt to surround .* is harmless/);
    assert.ok(!getRngLog().some(c=>/^d\(1,6\)=/.test(c)),'gulpum damage dice never run');
});
for(const sick of [false,true])test(`real sickness producer controls post-engulf wording: sick=${sick}`,async()=>{
    const {mon}=await prepare(P.PM_PURPLE_WORM,P.PM_HUMAN_ZOMBIE,{accuracy:true});
    assert.equal(Sick_resistance(),false);game.u.uhunger=500;game.u.mh=game.u.mhmax=200;
    if(sick)await make_sick(100,'#wizintrinsic',false,C.SICK_ALL);
    assert.equal(!!game.u.uprops.SICK,sick);assert.equal(game.u.uprops[C.SICK],undefined,'numeric slot is not this port\'s sickness storage');
    const hp=game.u.mh;clearMessages();seed(3);await hmonas(mon);
    console.log(JSON.stringify({sick,hp,after:game.u.mh,calls:getRngLog(),text:messages()}));
    assert.ok(mon.mhp<=0);assert.match(messages(),sick?/You feel very sick\./:/You feel sick\./);
    const damage=getRngLog().find(c=>/^rnd\(8\)=/.test(c));assert.ok(damage);assert.equal(game.u.mh,hp-Number(damage.split('=')[1]));
    assert.equal(!!game.u.uprops.SICK,sick);assert.equal(game.mswallower,null);
});
test('curing actual sickness clears the same consumer field',async()=>{
    await setup();await make_sick(100,'#wizintrinsic',false,C.SICK_ALL);
    assert.ok(game.u.uprops.SICK);await make_sick(0,null,false,C.SICK_ALL);assert.equal(game.u.uprops.SICK,0);
});
for(const [form,victim,confused]of [[P.PM_BLACK_LIGHT,P.PM_GOBLIN,true],[P.PM_BLACK_LIGHT,P.PM_FOG_CLOUD,false]])
 test(`black light real eye guard: victim ${victim}`,async()=>{
    const {mon,attack}=await prepare(form,victim);assert.equal(await explum(mon,attack),C.M_ATTK_HIT);
    assert.equal(!!mon.mconf,confused);assert.equal(mon.mhp,1000);
    assert.ok(getRngLog()[0].startsWith('d(10,12)='));
 });
test('yellow light through hmonas wakes before flash and finishes rehumanization',async()=>{
    const {mon}=await prepare(P.PM_YELLOW_LIGHT,P.PM_GOBLIN);mon.msleeping=1;
    assert.equal(await hmonas(mon),true);assert.ok(mon.mblinded>0);assert.equal(mon.mcansee,0);
    assert.equal(mon.msleeping,0);assert.equal(game.u.umonnum,game.u.umonster);
    assert.equal(game.youmonst.data,game.mons[game.u.umonnum]);assert.equal(game.youmonst.mnum,game.u.umonnum);
    assert.match(messages(),/blinded by your flash of light/);assert.match(messages(),/return to human form/);
});
test('null-target explosion retains the initial roll and wake call without dereference',async()=>{
    const {mon,attack}=await prepare(P.PM_BLACK_LIGHT,P.PM_GOBLIN);mon.msleeping=1;
    assert.equal(await explum(null,attack),C.M_ATTK_HIT);assert.equal(mon.msleeping,0);
    assert.equal(!!mon.mconf,false);assert.ok(getRngLog()[0].startsWith('d(10,12)='));
});

test('full save/restore preserves fog and shade producer identity and sickness storage',async()=>{
    const {mon}=await prepare(P.PM_FOG_CLOUD,P.PM_SHADE);
    await make_sick(100,'#wizintrinsic',false,C.SICK_ALL);
    const id=mon.m_id;assert.equal(await dosave0(),true);assert.equal(await dorecover(),true);
    assert.equal(game.u.umonnum,P.PM_FOG_CLOUD);assert.equal(game.youmonst.mnum,P.PM_FOG_CLOUD);
    assert.equal(game.youmonst.data,game.mons[P.PM_FOG_CLOUD]);
    const restored=game.level.monsters.find(m=>m.m_id===id);assert.ok(restored);
    assert.equal(restored.mnum,P.PM_SHADE);assert.equal(restored.data,game.mons[P.PM_SHADE]);
    assert.equal(game.u.uprops.SICK,100);assert.equal(game.u.uprops[C.SICK],undefined);
});
