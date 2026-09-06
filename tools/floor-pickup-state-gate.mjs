#!/usr/bin/env node

// Native C replay state plus constructed controls for pickup.c, do.c,
// invent.c, mon.c, trap.c and youprop.h. Constructed states earn no C coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {pushKeys,resetInputState} from '../js/input.js';
import {mksobj,place_object} from '../js/mkobj.js';
import {let_to_name} from '../js/invent.js';
import {pickup_object,query_objlist,allow_all,reset_justpicked,loot_mon} from '../js/pickup.js';
import {pickup_checks} from '../js/hack.js';
import {engulfer_digests_food,dropz} from '../js/do.js';
import {newcham,set_ustuck} from '../js/mon.js';
import {makemon,remove_monster,place_monster} from '../js/makemon.js';
import {mpickobj} from '../js/steal.js';
import {maketrap} from '../js/mklev.js';
import {vision_recalc,cansee,couldsee} from '../js/vision.js';
import {Flying,Levitation} from '../js/youprop.js';
import {float_vs_flight} from '../js/polyself.js';
import {finesse_ahriman} from '../js/artifact.js';
import {punish} from '../js/read.js';
import {initRng} from '../js/rng.js';
import {ONAMES as N,OCLASSES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ART_HEART_OF_AHRIMAN} from '../js/artilist_data.js';
import {OBJ_FREE,OBJ_INVENT,OBJ_FLOOR,OBJ_MINVENT,OBJ_CONTAINED,OBJ_DELETED,
    MENU_FULL,AUTOSELECT_SINGLE,SIGNAL_NOMENU,SIGNAL_ESCAPE,
    INVORDER_SORT,USE_INVLET,INCLUDE_HERO,PICK_ANY,PICK_NONE,
    W_AMUL,W_SADDLE,W_RINGR,W_ARTI,FROMOUTSIDE,I_SPECIAL,TIMEOUT,
    MM_NOGRP,MM_NOMSG,NO_MINVENT,ROOM,POOL,LAVAPOOL,PIT,TT_PIT,
    NO_NC_FLAGS} from '../js/const.js';
const names=['floor-pickup-traditional','floor-pickup-menus','floor-pickup-safety',
    'engulfer-object-transfers','pickup-reach-guards'];
const read=n=>JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/'+n+'.json',import.meta.url)));
const qty=(list,type)=>list.filter(o=>o.otyp===type).reduce((n,o)=>n+o.quan,0);
const types=[N.DAGGER,N.POT_HEALING,N.RIN_PROTECTION,N.LEATHER_ARMOR];
const counts=list=>types.map(t=>qty(list,t));
const all=[3,1,1,1],none=[0,0,0,0],daggers=[3,0,0,0],two=[2,0,0,0];
const traditional=[all,all,daggers,[0,1,0,0],[3,1,1,0],all,[0,0,0,1],none,
    two,none,daggers,daggers,daggers,all,none,none,all,none,none,daggers,
    daggers,all,[2,1,1,1],all];
function owners(label) {
    const seen=new Set();
    function walk(list,where,parent) {
        for(const o of list||[]) {
            assert.ok(!seen.has(o),label+': unique object owner');seen.add(o);
            assert.equal(o.where,where,label+': owner matches where');
            assert.ok(o.quan>0,label+': positive live quantity');
            if(where===OBJ_MINVENT)assert.equal(o.ocarry,parent,label+': monster owner pointer');
            if(where===OBJ_CONTAINED)assert.equal(o.ocontainer,parent,label+': container owner pointer');
            walk(o.cobj,OBJ_CONTAINED,o);
        }
    }
    walk(game.invent,OBJ_INVENT);walk(game.level.objects,OBJ_FLOOR);
    for(const m of game.level.monsters)walk(m.minvent,OBJ_MINVENT,m);
}
let replays=0;
for(const name of names)for(const [index,s]of read(name).segments.entries()) {
    let engulfer,oldForm,oldMax,oldLevel;
    globalThis.__step_snapshot={step:'*',cb:g=>{
        if(g.u.ustuck&&!engulfer){engulfer=g.u.ustuck;oldForm=engulfer.mnum;
            oldMax=engulfer.mhpmax;oldLevel=engulfer.m_lev;}
    }};
    try {await runSegment({...s,storage:new InMemoryStorage()});}
    finally {delete globalThis.__step_snapshot;}
    const label=name+':'+s.name;owners(label);replays++;
    const death=['blind-corpse-bare','engulfer-regurgitation-after-drop',
        'empty-worm-blind-regurgitation'].includes(s.name)?1:0;
    assert.equal(game.u.umortality||0,death,label+': expected mortality');
    if(name==='floor-pickup-traditional'&&index<24) {
        assert.deepEqual(counts(game.invent),traditional[index],label+': C selected quantities');
        for(const o of game.invent)assert.equal(!!o.pickup_prev,index<21||o.otyp===N.DAGGER,label+': pickup marker');
        assert.deepEqual(counts([...game.invent,...game.level.objects]),all,label+': quantity conservation');
    }
    if(name==='floor-pickup-menus') {
        const expected=index<18?[all,daggers,two,none,two,none][index%6]
            :index<30?((index-18)%6<3?daggers:(index-18)%6===3?[0,0,0,1]:[0,0,1,0])
            :[daggers,[0,1,0,0],two,all,none][index-30];
        assert.deepEqual(counts(game.invent),expected,label+': C menu selection');
        assert.ok(game.invent.every(o=>o.pickup_prev),label+': selected objects marked');
        assert.deepEqual(counts([...game.invent,...game.level.objects]),index>=18&&index<30?[10,1,1,1]:all,label+': quantity conservation');
    }
    if(name==='floor-pickup-safety') {
        if(index<2)assert.deepEqual(counts(game.invent),all,label+': repeated count acquires final dagger');
        else {
            const safe=['blind-corpse-gloves','blind-corpse-resistant'].includes(s.name);
            assert.equal(qty(game.invent,N.CORPSE),safe?1:0,label);
            assert.equal(qty(game.invent,N.APPLE),safe?3:s.name==='blind-corpse-count'?2:0,label);
            assert.equal(qty([...game.invent,...game.level.objects],N.APPLE),3,label);
        }
    }
    if(name==='engulfer-object-transfers') {
        assert.ok(engulfer,label+': swallowed before object interaction');
        if(/(?:engulfer|vortex)-(one|count|many)$/.test(s.name)) {
            assert.ok(game.u.uswallow,label);assert.equal(qty(game.invent,N.DAGGER),s.name.endsWith('count')?2:3,label);
            assert.equal(qty(engulfer.minvent,N.DAGGER),s.name.endsWith('count')?1:0,label);
            if(s.name==='vortex-many')assert.equal(qty(game.invent,N.POT_HEALING),1,label);
        }
        if(s.name==='digest-apple')assert.equal(qty(engulfer.minvent,N.APPLE),1,label);
        if(s.name==='vortex-food')assert.equal(qty(engulfer.minvent,N.CORPSE),1,label);
        if(s.name.endsWith('-look'))assert.equal(qty(engulfer.minvent,N.POT_HEALING),1,label);
        if(s.name.startsWith('digest-')&&s.name!=='digest-apple') {
            assert.equal(game.invent.filter(o=>o.oclass===O.FOOD_CLASS).length,0,label+': food consumed');
            assert.equal((engulfer.minvent||[]).filter(o=>o.oclass===O.FOOD_CLASS).length,0,label);
        }
        if(s.name==='digest-wraith') {
            assert.ok(engulfer.m_lev>oldLevel&&engulfer.mhpmax>oldMax,label+': growth');
        }
        if(s.name==='digest-nurse-wish-drop')assert.equal(engulfer.mhp,engulfer.mhpmax,label+': healed');
        if(s.name==='digest-polymorph'||s.name==='digest-slime') {
            assert.ok(!game.u.uswallow&&!game.u.ustuck,label+': released after transformation');
            assert.notEqual(engulfer.mnum,oldForm,label);
            if(s.name==='digest-polymorph')assert.equal(engulfer.mhp,1,label+': solid breakout damage');
            else assert.equal(engulfer.mnum,P.PM_GREEN_SLIME,label);
        }
        if(s.name==='digest-petrify') {
            assert.ok(!game.u.uswallow,label);assert.ok(engulfer.mhp<=0,label);
            assert.ok(game.level.objects.some(o=>o.otyp===N.STATUE&&o.corpsenm===oldForm),label+': stone corpse');
        }
    }
    if(name==='pickup-reach-guards') {
        if(s.name.startsWith('levitation-')||s.name==='seen-pit-bottom') {
            assert.equal(qty(game.invent,N.DAGGER),0,label);assert.equal(qty(game.level.objects,N.DAGGER),3,label);
            assert.ok(Levitation(),label);
        }
        if(s.name==='mounted-unskilled') {
            assert.ok(game.u.usteed,label);assert.equal(qty(game.invent,N.DAGGER),0,label);
            assert.equal(qty(game.level.objects,N.DAGGER),6,label);
        }
    }
}
console.log(`floor pickup: ${replays} native replays, quantities, ownership and engulfer state`);

let checks=0;
async function setup(keys='') {
    resetInputState();await runSegment({...read(names[0]).segments[0],moves:' ',storage:new InMemoryStorage()});
    game._preNhgetchHook=null;game._toplin=0;game._win_stop=false;
    game.invent=[];game.u.uwep=game.u.uswapwep=game.u.uquiver=null;
    for(const m of game.level.monsters)remove_monster(m.mx,m.my);
    game.level.monsters=[];game.level.objects=[];
    game.level.at(game.u.ux,game.u.uy).typ=ROOM;game.flags.menu_style=MENU_FULL;
    resetInputState();pushKeys(keys+' '.repeat(120));checks++;
}
const obj=(type=N.DAGGER,fields={})=>Object.assign(mksobj(type,false,false),{where:OBJ_FREE,invlet:'a'},fields);
async function swallow(mnum=P.PM_PURPLE_WORM) {
    const m=await makemon(game.mons[mnum],game.u.ux,game.u.uy,MM_NOGRP|MM_NOMSG|NO_MINVENT);
    remove_monster(m.mx,m.my);place_monster(m,game.u.ux,game.u.uy);
    set_ustuck(m);game.u.uswallow=1;game.u.uswldtim=50;vision_recalc(2);return m;
}
await setup();let a=obj(),b=obj(N.APPLE);a.pickup_prev=b.pickup_prev=1;
reset_justpicked([a,b]);assert.equal(a.pickup_prev,0);assert.equal(b.pickup_prev,0);
assert.deepEqual(await query_objlist('Empty',[],SIGNAL_NOMENU,PICK_ANY,allow_all),[]);
assert.equal(await query_objlist('Filtered',[a],SIGNAL_NOMENU,PICK_ANY,()=>false),-1);
a.quan=5;let q=await query_objlist('Single',[a],AUTOSELECT_SINGLE,PICK_ANY,allow_all);
assert.deepEqual([...q],[a]);assert.equal(q.counts.get(a),5);
await setup('\x1b');a=obj();assert.equal(await query_objlist('Cancel',[a],SIGNAL_ESCAPE,PICK_ANY,allow_all),-2);
for(const keys of ['2a\r','9a\r']) {
    await setup(keys);a=obj(N.DAGGER,{quan:5});q=await query_objlist('Count',[a],INVORDER_SORT,PICK_ANY,allow_all);
    assert.equal(q.counts.get(a),keys.startsWith('2')?2:5);
}
await setup('a\r');let m=await swallow();a=obj(N.AMULET_OF_LIFE_SAVING,{owornmask:W_AMUL});await mpickobj(m,a);
q=await query_objlist('Worn',[a],AUTOSELECT_SINGLE,PICK_ANY,allow_all);assert.equal(q.length,0);assert.ok(m.minvent.includes(a));
await setup('>\r');m=await swallow();q=await query_objlist('Hero',[],INCLUDE_HERO,PICK_ANY,allow_all);assert.equal(q.length,0);
await setup();assert.equal(let_to_name(O.WEAPON_CLASS,false,true),"Weapons  (')')");
assert.equal(let_to_name(O.ARMOR_CLASS,true,false),'Unpaid Armor');

// Shared query counts clamp selection, but never change the object itself.
await setup('2a\r');a=obj(N.DAGGER,{quan:5,where:OBJ_INVENT});game.invent=[a];
q=await query_objlist('Inventory',[a],USE_INVLET,PICK_ANY,allow_all);
assert.equal(q.counts.get(a),2);assert.equal(a.quan,5);
await setup();a=obj(N.GOLD_PIECE,{quan:17});b=obj(N.DAGGER);
q=await query_objlist('View',[a,b],INVORDER_SORT,PICK_NONE,allow_all);assert.equal(q.length,0);
assert.equal(let_to_name('>',false,true),'Bagged/Boxed items');
assert.equal(let_to_name(-1,false,true),'Illegal objects');

// Independent reach states cover both the positive result and precedence.
for(const terrain of [POOL,LAVAPOOL]) {
    await setup();game.level.at(game.u.ux,game.u.uy).typ=terrain;
    assert.equal(await pickup_checks(),0);
    game.u.uinwater=terrain===POOL;
    game.youmonst.data=game.mons[terrain===POOL?P.PM_XORN:P.PM_SALAMANDER];
    a=obj();place_object(a,game.u.ux,game.u.uy);assert.equal(await pickup_checks(),-1);
}
await setup();a=obj();place_object(a,game.u.ux,game.u.uy);
const pit=maketrap(game.u.ux,game.u.uy,PIT);pit.tseen=1;
assert.equal(await pickup_checks(),0);game.u.utrap=3;game.u.utraptype=TT_PIT;
assert.equal(await pickup_checks(),-1);

// Empty engulfer pickup consumes time. A nonempty inventory routes to loot_mon.
for(const type of [P.PM_PURPLE_WORM,P.PM_ICE_VORTEX]) {
    await setup();m=await swallow(type);assert.equal(await pickup_checks(),1);
    a=obj(N.APPLE);await mpickobj(m,a);assert.equal(await pickup_checks(),-2);
    await loot_mon(m,{v:0},null);assert.ok(game.invent.includes(a));assert.equal(a.where,OBJ_INVENT);
}
for(const [answer,cursed,limbs,result]of [['y',false,true,1],['y',true,true,1],['y',false,false,0],['n',false,true,0],['q',false,true,0]]) {
    await setup(answer);m=await makemon(game.mons[P.PM_PONY],game.u.ux,game.u.uy,MM_NOGRP|MM_NOMSG|NO_MINVENT);
    a=obj(N.SADDLE,{cursed,owornmask:W_SADDLE});await mpickobj(m,a);m.misc_worn_check=W_SADDLE;
    if(!limbs)game.youmonst.data=game.mons[P.PM_ACID_BLOB];
    const passed={v:0},previous={v:false};initRng(1);const elapsed=await loot_mon(m,passed,previous);
    assert.equal(passed.v,1);assert.equal(elapsed>0,result>0);
    const acquired=answer==='y'&&!cursed&&limbs;assert.equal(previous.v,acquired);
    assert.equal(game.invent.includes(a),acquired);assert.equal(m.minvent.includes(a),!acquired);
    if(acquired){assert.equal(a.owornmask,0);assert.equal(m.misc_worn_check&W_SADDLE,0);}
}

// Punishment pieces stay attached to the hero inside an engulfer. They
// are addressed through the hero's worn slots, including after punish().
await setup();m=await swallow();await punish(null);a=game.u.uball;b=game.u.uchain;
assert.equal(a.where||0,OBJ_FREE);assert.equal(b.where||0,OBJ_FREE);
assert.deepEqual(game.impossible_log||[],[]);
await dropz(a,false);assert.ok(!m.minvent?.includes(a));assert.equal(a.where||0,OBJ_FREE);
assert.equal(await pickup_object(b,1,false),0);assert.equal(b.where||0,OBJ_FREE);
assert.deepEqual(game.impossible_log||[],[],'punishment pieces never reach invalid ownership calls');

// The helper's effects must change state even when no status message exposes it.
await setup();m=await swallow();m.mhp=3;m.mblinded=7;m.mcansee=0;
a=obj(N.CORPSE,{corpsenm:P.PM_NURSE});assert.ok(await engulfer_digests_food(a));
assert.equal(m.mhp,m.mhpmax);assert.equal(m.mblinded,0);assert.equal(m.mcansee,1);assert.equal(a.where,OBJ_DELETED);
await setup();m=await swallow(P.PM_ICE_VORTEX);a=obj(N.CORPSE,{corpsenm:P.PM_NURSE});
assert.equal(await engulfer_digests_food(a),false);assert.equal(a.where,OBJ_FREE);
await setup();m=await swallow();m.movement=12;const oldSpeed=m.data.mmove;
await newcham(m,game.mons[P.PM_GREEN_SLIME],NO_NC_FLAGS);
assert.ok(!game.u.uswallow&&!game.u.ustuck);assert.equal(m.movement,Math.trunc(12*m.data.mmove/oldSpeed));

// Swallowing clears both ordinary sight and x-ray sight while retaining the
// surrounding glyph display. Expulsion restores sight through normal redraw.
await setup();m=await swallow();game.u.xray_range=3;vision_recalc(0);
assert.equal(cansee(game.u.ux,game.u.uy),false);assert.equal(couldsee(game.u.ux,game.u.uy),false);
await setup();game.u.intrinsic.HFlying=FROMOUTSIDE;assert.ok(Flying());
game.u.blocked.FLYING=I_SPECIAL;assert.equal(Flying(),false);
game.u.blocked.FLYING=0;game.u.intrinsic.HLevitation=FROMOUTSIDE;float_vs_flight();
assert.ok(Levitation());assert.equal(Flying(),false);

await setup();a=obj(N.LUCKSTONE,{oartifact:ART_HEART_OF_AHRIMAN});
game.u.uprops.LEVITATION=W_ARTI;game.u.intrinsic.HLevitation=I_SPECIAL|17;
const before=JSON.stringify([game.u.intrinsic,game.u.uprops,game.u.blocked]);
assert.ok(finesse_ahriman(a));assert.equal(JSON.stringify([game.u.intrinsic,game.u.uprops,game.u.blocked]),before);
game.u.intrinsic.HLevitation|=FROMOUTSIDE;assert.equal(finesse_ahriman(a),false);
game.u.intrinsic.HLevitation=0;game.u.uprops.LEVITATION|=W_RINGR;assert.equal(finesse_ahriman(a),false);
assert.equal(finesse_ahriman(obj(N.APPLE)),false);
console.log(`floor pickup: ${checks} constructed control groups PASS`);
