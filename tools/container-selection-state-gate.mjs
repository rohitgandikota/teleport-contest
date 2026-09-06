#!/usr/bin/env node

// C pickup.c:75..263,1544..1802,2488..3480, invent.c:3580,
// mkobj.c:457 and shk.c:186. Constructed controls earn no native coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {pushKeys,resetInputState} from '../js/input.js';
import {initRng,rn2} from '../js/rng.js';
import {mksobj,splitobj,unsplitobj,add_to_container,start_corpse_timeout} from '../js/mkobj.js';
import {weight,tally_BUCX} from '../js/invent.js';
import {query_classes,add_valid_menu_class,menu_class_present,in_container,
    out_container,removed_from_icebox,delta_cwt,observe_quantum_cat,use_container} from '../js/pickup.js';
import {container_contents} from '../js/end.js';
import {money2u} from '../js/shk.js';
import {ONAMES as N,OCLASSES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {OBJ_INVENT,OBJ_FLOOR,OBJ_MINVENT,OBJ_CONTAINED,OBJ_FREE,
    OBJ_BURIED,OBJ_MIGRATING,OBJ_ONBILL,OBJ_LUAFREE,MENU_TRADITIONAL,
    MENU_FULL,W_ARM,W_WEP,W_QUIVER,ROT_CORPSE,REVIVE_MON} from '../js/const.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/'+name+'.json',import.meta.url)));
const names=['container-selection','container-capacity','container-transfers','container-contents-order'];
const quantity=(list,type)=>list.filter(o=>o.otyp===type).reduce((n,o)=>n+o.quan,0);
function owners(label) {
    const seen=new Set();
    function walk(list,where,parent) {
        for(const o of list||[]) {
            assert.ok(!seen.has(o),label+': each live object has one owner');seen.add(o);
            assert.equal(o.where,where,label+': owner matches where');
            assert.ok(o.quan>0,label+': positive live quantity');
            if(where===OBJ_CONTAINED)assert.equal(o.ocontainer,parent,label+': container pointer');
            if(where===OBJ_MINVENT)assert.equal(o.ocarry,parent,label+': monster pointer');
            walk(o.cobj,OBJ_CONTAINED,o);
        }
    }
    walk(game.invent,OBJ_INVENT);walk(game.level.objects,OBJ_FLOOR);
    for(const mon of game.level.monsters)walk(mon.minvent,OBJ_MINVENT,mon);
}
let replays=0;
for(const name of names)for(const s of read(name).segments) {
    resetInputState();await runSegment({...s,storage:new InMemoryStorage()});
    const label=name+':'+s.name;
    owners(label);
    assert.ok(!game.current_container,label+': container context cleared');
    assert.ok(!game.context.bypasses,label+': bypass iteration finished');
    assert.equal(game.u.umortality||0,0,label+': no setup death');
    const box=game.invent.find(o=>[N.SACK,N.BAG_OF_HOLDING,N.ICE_BOX].includes(o.otyp));
    const contents=box?.cobj||[],hero=t=>quantity(game.invent,t),bag=t=>quantity(contents,t);
    const appleCounts={
        'in-count-zero':3,'in-count-one':2,'in-count-excess':0,'in-reverse-class':0,
        'in-duplicate-class':0,'in-class-unknown':0,'in-class-uncursed-absent':3,
        'in-filter-look-retry':3,'in-unknown':0,'in-picked':0,'in-quit':3,
        'in-cancel':3,'in-inventory-retry':0,'in-look-retry':0,'in-menu-look-retry':0,
        'out-count-zero':0,'out-count-one':1,'out-count-excess':3,
        'out-quit':0,'out-cancel':0,'out-look-retry':3,'out-reverse-class':3,
        'stash-count-one':2,'stash-self':3,'both-out-first':0,'both-in-first':3,
        'full-justpicked-1':2,'full-justpicked-2':1,'full-justpicked-multiple':0,
        'combination-count-out':1,'partial-count-out':1,'full-count-out':1
    };
    if(Object.hasOwn(appleCounts,s.name)) {
        assert.equal(hero(N.APPLE),appleCounts[s.name],label+': C apple remainder');
        assert.equal(hero(N.APPLE)+bag(N.APPLE),3,label+': apple conservation');
    }
    if(['worn-armor','worn-blindfold','worn-ring-completed','icebox-worn'].includes(s.name)) {
        assert.ok(game.invent.find(o=>o.invlet==='f').owornmask,label+': refused gear stays worn');
    }
    if(['wielded','swap','quivered'].includes(s.name)) {
        assert.equal(hero(N.DAGGER),0,label);assert.equal(bag(N.DAGGER),1,label);
        assert.ok(!game.u.uwep&&!game.u.uswapwep&&!game.u.uquiver,label+': equipment slots cleared');
        assert.equal(contents.find(o=>o.otyp===N.DAGGER).owornmask,0,label);
    }
    if(s.name.includes('loadstone')) {
        assert.equal(hero(N.LOADSTONE),3,label);assert.equal(bag(N.LOADSTONE),0,label);
        assert.ok(game.invent.find(o=>o.otyp===N.LOADSTONE).bknown,label);
    }
    if(s.name==='welded-count')assert.equal(game.u.uwep.quan,3,label);
    if(s.name.startsWith('lit-')) {
        const lamp=contents.find(o=>o.otyp===(s.name==='lit-candle'?N.TALLOW_CANDLE:N.OIL_LAMP));
        assert.ok(lamp,label);assert.ok(!lamp.lamplit,label);
        assert.ok(!game.light_sources.some(l=>l.id===lamp.o_id),label+': snuffed light source');
    }
    if(s.name==='icebox-corpse') {
        const corpse=game.invent.find(o=>o.otyp===N.CORPSE);
        assert.ok(corpse.norevive,label);assert.ok(corpse.timed,label+': rot timer restored');
    }
    if(s.name.includes('explosion')||s.name==='bag-both-holding') {
        assert.equal(hero(N.BAG_OF_HOLDING),0,label);assert.equal(hero(N.WAN_CANCELLATION),0,label);
    }
    if(s.name==='bag-cancellation-empty')assert.equal(bag(N.WAN_CANCELLATION),1,label);
    if(s.name==='traditional-coins-count') {
        assert.equal(hero(N.GOLD_PIECE),90,label);assert.equal(bag(N.GOLD_PIECE),10,label);
    }
    if(s.name==='traditional-coins-goldX')assert.equal(bag(N.GOLD_PIECE),100,label);
    if(s.name==='priest-buc')assert.ok(contents.find(o=>o.otyp===N.APPLE).blessed,label);
    if(s.name.startsWith('contents-')) {
        assert.equal(bag(N.APPLE),3,label);assert.equal(bag(N.DAGGER),3,label);
        assert.equal(bag(N.POT_HEALING),1,label);assert.ok(box.cknown,label);
    }
    if(s.name.startsWith('holding-')) {
        const n=Number(s.name.split('-')[1]),type=s.name.includes('coins')?N.GOLD_PIECE:N.DAGGER;
        assert.equal(hero(type)+bag(type),n,label+': total conserved');
        if(s.name==='holding-240000-coins')assert.equal(hero(type),208449,label+': C capacity boundary');
    }
    if(s.name.startsWith('out-split-')) {
        const accepted=s.name.endsWith('-y');
        assert.equal(hero(N.DAGGER),accepted?120:0,label+': transferred count');
        assert.equal(bag(N.DAGGER),accepted?120:240,label+': refused split restored');
        assert.deepEqual(contents.map(o=>o.quan).sort((a,b)=>a-b),accepted?[30,90]:[30,210],label);
    }
    if(s.name==='floor-container-heavy') {
        assert.equal(hero(N.DAGGER),209,label);
        const floorBox=game.level.objects.find(o=>o.otyp===N.BAG_OF_HOLDING);
        assert.equal(quantity(floorBox.cobj,N.DAGGER),31,label);
    }
    replays++;
}
assert.equal(replays,114);
console.log(`container selection: ${replays} native replays, ownership and quantity checks`);

let checks=0;
async function setup(keys='') {
    resetInputState();await runSegment({...read(names[0]).segments[0],moves:' ',storage:new InMemoryStorage()});
    game._preNhgetchHook=null;game._toplin=0;game._win_stop=false;
    game.invent=[];game.u.uwep=game.u.uswapwep=game.u.uquiver=null;
    game.flags.menu_style=MENU_TRADITIONAL;
    resetInputState();pushKeys(keys+' '.repeat(30));add_valid_menu_class(0);checks++;
}
const obj=(type=N.DAGGER,fields={})=>Object.assign(mksobj(type,false,false),{where:OBJ_INVENT,invlet:'a'},fields);
for(const where of [OBJ_INVENT,OBJ_FLOOR,OBJ_MINVENT,OBJ_CONTAINED,OBJ_MIGRATING,OBJ_BURIED,OBJ_ONBILL]) {
    await setup();const a=obj(N.DAGGER,{quan:5,where,pickup_prev:1,lua_ref_cnt:2,owornmask:W_QUIVER}),chain=[a];
    const box=obj(N.SACK,{cobj:chain}),mon={minvent:chain};
    if(where===OBJ_INVENT)game.invent=chain;
    if(where===OBJ_FLOOR)game.level.objects=chain;
    if(where===OBJ_MINVENT)a.ocarry=mon;
    if(where===OBJ_CONTAINED)a.ocontainer=box;
    if(where===OBJ_MIGRATING)game.migrating_objs=chain;
    if(where===OBJ_BURIED)game.level.buriedobjs=chain;
    if(where===OBJ_ONBILL)game.billobjs=chain;
    a.owt=weight(a);const child=splitobj(a,2);
    assert.deepEqual(chain,[a,child]);assert.equal(a.quan,3);assert.equal(child.quan,2);
    assert.equal(child.lua_ref_cnt,0);assert.equal(child.pickup_prev,0);assert.equal(child.owornmask,0);
    assert.notEqual(child.o_id,a.o_id);
    if([OBJ_INVENT,OBJ_MINVENT,OBJ_CONTAINED].includes(where)) {
        assert.equal(await unsplitobj(child),a);assert.deepEqual(chain,[a]);assert.equal(a.quan,5);
    }
}
await setup();let a=obj(N.DAGGER,{quan:3,where:OBJ_LUAFREE,oname:'Archive',oextra:{omid:42}});
const child=splitobj(a,1);assert.equal(child.where,OBJ_FREE);assert.equal(child.oname,'Archive');
assert.ok(!child.oextra?.omid);assert.equal(a.oextra.omid,42);
assert.throws(()=>splitobj(a,0));assert.throws(()=>splitobj(a,2));

await setup();game.urole={...game.urole,name:{m:'Priest',f:'Priestess'},mnum:P.PM_CLERIC};
a=obj(N.APPLE,{blessed:1,bknown:0,pickup_prev:1});
let b=obj(N.DAGGER,{cursed:1,bknown:0}),coin=obj(N.GOLD_PIECE,{bknown:1});
for(const goldX of [false,true]) {
    game.flags.goldX=goldX;const refs=Array.from({length:6},()=>({v:99}));
    tally_BUCX([a,b,coin],false,...refs);
    assert.deepEqual(refs.map(r=>r.v),[1,Number(!goldX),1,Number(goldX),0,1]);
    assert.ok(a.bknown&&b.bknown);assert.equal(coin.bknown,0);
}

for(const [keys,wanted]of [['m\r',-2],['%m\r',-3],['%%\r',0],['\x1b',0]]) {
    await setup(keys);a=obj(N.APPLE);game.invent=[a];const classes=[],one={v:false},all={v:false},menu={v:0};
    const result=await query_classes(classes,one,all,'put in',game.invent,false,menu);
    assert.equal(menu.v,wanted);
    if(keys==='%%\r'){assert.ok(result);assert.deepEqual(classes,[O.FOOD_CLASS,O.FOOD_CLASS]);}
    if(wanted===-3)assert.ok(menu_class_present(O.FOOD_CLASS));
}

await setup();a=obj(N.SACK);b=obj(N.LEASH,{leashmon:17});game.invent=[a,b];game.current_container=a;
assert.equal(await in_container(b),0);assert.ok(game.invent.includes(b));
await setup();a=obj(N.ICE_BOX);b=obj(N.CORPSE,{corpsenm:P.PM_ICE_TROLL,age:3,
    oextra:{omonst:{data:game.mons[P.PM_ICE_TROLL],mnum:P.PM_ICE_TROLL,mcan:1}}});
game.invent=[a,b];game.current_container=a;game.moves=100;
start_corpse_timeout(b);assert.ok(b.timed);
assert.equal(await in_container(b),1);assert.equal(b.age,97);assert.equal(b.oextra.omonst.mcan,0);
assert.ok(!game.timer_base.some(t=>t.arg===b&&[ROT_CORPSE,REVIVE_MON].includes(t.func_index)));
game.moves=110;await removed_from_icebox(b);assert.equal(b.age,13);assert.equal(b.norevive,0);

for(const [blessed,cursed,want]of [[0,0,20],[1,0,10],[0,1,80]]) {
    await setup();a=obj(N.BAG_OF_HOLDING,{blessed,cursed,cobj:[]});b=obj(N.DAGGER,{quan:4,where:OBJ_FREE});
    b.owt=weight(b);add_to_container(a,b);a.owt=weight(a);const old=a.owt;
    assert.equal(delta_cwt(a,b),want);assert.equal(a.owt,old);assert.deepEqual(a.cobj,[b]);
}

await setup();a=obj(N.GOLD_PIECE,{quan:100,where:OBJ_MINVENT});const mon={minvent:[a]};a.ocarry=mon;
await money2u(mon,40);assert.equal(a.quan,60);assert.deepEqual(mon.minvent,[a]);assert.equal(quantity(game.invent,N.GOLD_PIECE),40);
await money2u(mon,60);assert.equal(mon.minvent.length,0);assert.equal(quantity(game.invent,N.GOLD_PIECE),100);

// The live/dead branch seeds are selected by the RNG API, not output stubs.
const seeds=[0,1].map(want=>{for(let seed=1;;seed++){initRng(seed);if(rn2(2)===want)return seed;}});
for(const [alive,makecat]of [[true,false],[true,true],[false,false]]) {
    await setup();a=obj(N.LARGE_BOX,{spe:1,cobj:[]});b=obj(N.CORPSE,{where:OBJ_FREE,corpsenm:P.PM_HOUSECAT});
    add_to_container(a,b);a.owt=weight(a);game.invent=[a];game.context.mon_moving=true;
    game.mvitals[P.PM_HOUSECAT].mvflags=0;game.iflags.debug_mongen=false;
    initRng(seeds[alive?0:1]);await observe_quantum_cat(a,makecat,false);
    if(alive&&!makecat){assert.equal(a.spe,1);assert.equal(a.cobj[0],b);}
    else if(alive){assert.equal(a.spe,0);assert.equal(a.cobj.length,0);assert.ok(game.level.monsters.some(m=>m.mgivenname==="Schroedinger's Cat"&&m.mpeaceful));}
    else{assert.equal(a.spe,0);assert.equal(b.oname,"Schroedinger's Cat");assert.ok(b.timed);}
}

await setup();a=obj(N.SACK,{cobj:[]});b=obj(N.SACK,{where:OBJ_FREE,cobj:[]});const inner=obj(N.APPLE,{where:OBJ_FREE});
add_to_container(b,inner);add_to_container(a,b);game.invent=[a];
await container_contents([a],true,true,true);assert.ok(a.cknown&&a.lknown&&b.cknown&&b.lknown);
assert.ok(inner.bknown&&inner.dknown&&inner.known&&inner.rknown);
for(const keys of ['\r','\x1b']) {
    await setup(keys);a=obj(N.SACK,{cknown:1,cobj:[]});game.invent=[a,obj(N.APPLE,{invlet:'b'})];game.flags.menu_style=MENU_FULL;
    const p={o:a};await use_container(p,true,true);
    assert.equal(game.abort_looting,keys==='\x1b');assert.equal(p.o,a);
}
console.log(`container selection: ${checks} constructed control groups`);
