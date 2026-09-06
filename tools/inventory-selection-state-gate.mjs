#!/usr/bin/env node

// C invent.c:2202..2537, pickup.c:469..660, worn.c:1055..1180.
// Constructed controls earn no native reachability or coverage credit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {pushKeys,resetInputState} from '../js/input.js';
import {ggetobj,askchain,count_buc,count_unpaid,fully_identify_obj,not_fully_identified,
    sortloot,unsortloot,is_worn,wearing_armor} from '../js/invent.js';
import {collect_obj_classes,add_valid_menu_class,menu_class_present,
    allow_category,count_justpicked,is_worn_by_type} from '../js/pickup.js';
import {bypass_obj,bypass_objlist,nxt_unbypassed_loot,
    nxt_unbypassed_obj,clear_bypasses} from '../js/worn.js';
import {mksobj} from '../js/mkobj.js';
import {ONAMES,OCLASSES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {OBJ_INVENT,OBJ_CONTAINED,OBJ_MINVENT,OBJ_FLOOR,
    BUC_BLESSED,BUC_UNCURSED,BUC_CURSED,BUC_UNKNOWN,
    MENU_TRADITIONAL,MENU_COMBINATION,ALL_FINISHED,PARANOID_AUTOALL,
    W_WEP,W_ARMS,W_ARM,W_SADDLE,SORTLOOT_INVLET,SORTLOOT_PACK,
    SORTLOOT_LOOT,SORTLOOT_INUSE,SORTLOOT_PETRIFY,NON_PM} from '../js/const.js';
import {decodeScreen} from './gen-sessions/screen-decode.mjs';
const read=(name,dir='recipes')=>JSON.parse(fs.readFileSync(new URL(
    `gen-sessions/${dir}/${name}${dir==='generated'?'.session':''}.json`,import.meta.url)));
const names=['traditional-identification','traditional-drop','traditional-takeoff'];
let replays=0,identified=0;
for(const name of names) {
    const oracle=read(name,'generated');
    for(const [i,s]of read(name).segments.entries()) {
        const label=name+':'+s.name;
        resetInputState();
        await runSegment({...s,storage:new InMemoryStorage()});
        assert.equal(game.u.umortality||0,0,label+': no death during setup');
        assert.ok(!game.context.bypasses,label+': iteration bypass state cleared');
        assert.ok(game.invent.every(o=>!o.bypass),label+': inventory bypass bits cleared');
        const quantity=type=>game.invent.filter(o=>o.otyp===type).reduce((n,o)=>n+o.quan,0);
        if(name==='traditional-identification') {
            const steps=oracle.segments[i].steps;
            const start=steps.findIndex(t=>decodeScreen(t.screen)[0].includes('What kinds'));
            assert.ok(start>=0,label+': native category prompt reached');
            const letters=new Set();
            for(const t of steps.slice(start)) {
                const text=decodeScreen(t.screen).slice(0,2).join(' ');
                for(const match of text.matchAll(/(?:^|  )([a-zA-Z]) - [^?.]*[.]/g))
                    letters.add(match[1]);
            }
            for(const letter of letters) {
                const o=game.invent.find(o=>o.invlet===letter);
                assert.ok(o,label+': identified object remains '+letter);
                assert.equal(not_fully_identified(o),false,label+': C identified '+letter);
                identified++;
            }
            if(s.name==='identify-quit')
                assert.ok(not_fully_identified(game.invent.find(o=>o.otyp===ONAMES.DAGGER)),label);
            if(s.name==='identify-scroll-partial-quit') {
                assert.ok(!not_fully_identified(game.invent.find(o=>o.otyp===ONAMES.DAGGER)),label);
                assert.ok(not_fully_identified(game.invent.find(o=>o.otyp===ONAMES.MACE)),label);
            }
        }
        if(s.name==='drop-number')assert.equal(quantity(ONAMES.DAGGER),2,label);
        if(['drop-zero','drop-quit','drop-default','drop-welded-stack'].includes(s.name))
            assert.equal(quantity(ONAMES.DAGGER),3,label);
        if(s.name==='drop-loadstone-completed') {
            assert.equal(quantity(ONAMES.LOADSTONE),3,label);
            assert.ok(game.invent.find(o=>o.otyp===ONAMES.LOADSTONE).bknown,label);
        }
        if(s.name.startsWith('drop-coins-count-'))assert.equal(quantity(ONAMES.GOLD_PIECE),80,label);
        if(s.name==='drop-reverse-classes-completed') {
            assert.equal(quantity(ONAMES.DAGGER),0,label);
            assert.equal(quantity(ONAMES.RIN_PROTECTION),0,label);
        }
        if(s.name==='drop-shop-live-unpaid-count') {
            assert.equal(quantity(ONAMES.APPLE),2,label);
            assert.ok(game.invent.find(o=>o.otyp===ONAMES.APPLE).unpaid,label);
        }
        if(s.name==='takeoff-reverse-classes'||s.name==='takeoff-all'||s.name==='takeoff-combo-all') {
            assert.ok(!game.u.uwep&&!game.u.uarm,label+': both equipment classes removed');
        }
        if(s.name==='takeoff-wielded-food'||s.name==='takeoff-wielded-gem')assert.ok(!game.u.uwep,label);
        replays++;
    }
}
assert.equal(replays,89);assert.ok(identified>=20);
console.log(`inventory selection: ${replays} native replays, ${identified} C identification observations`);

const source=read('traditional-identification').segments[0];
let checks=0;
async function setup(keys='') {
    resetInputState();
    await runSegment({...source,moves:' ',storage:new InMemoryStorage()});
    game._preNhgetchHook=null;
    game._toplin=0;game._win_stop=false;
    game.flags.menu_style=MENU_TRADITIONAL;
    resetInputState();pushKeys(keys+' '.repeat(20));
    add_valid_menu_class(0);
    checks++;
}
function obj(type=ONAMES.DAGGER,fields={}) {
    return Object.assign(mksobj(type,true,false),{where:OBJ_INVENT,invlet:'a'},fields);
}
const members=sorted=>sorted.filter(x=>x.obj).map(x=>x.obj);
await setup();
assert.equal(game.flags.menu_style,MENU_TRADITIONAL);
let feedback={v:99};
assert.equal(await ggetobj('drop',()=>1,0,true,feedback),0);
assert.equal(feedback.v,ALL_FINISHED);

await setup();
let a=obj();fully_identify_obj(a);game.invent=[a];
assert.equal(await ggetobj('identify',()=>1,2,false,null),-1);

for(const [keys,want]of [['m\r',-2],[')m\r',-3],['um\r',-3],['Xm\r',-3],[')am\r',-2],['\x1b',0]]) {
    await setup(keys);game.invent=[obj()];
    assert.equal(await ggetobj('drop',()=>{throw new Error('selection-only');},0,false,null),want,keys);
}
await setup(')\r');game.flags.menu_style=MENU_COMBINATION;game.invent=[obj()];feedback={v:99};
assert.equal(await ggetobj('drop',()=>{throw new Error('combination category collection');},0,true,feedback),0);
assert.equal(feedback.v,0);assert.ok(menu_class_present(OCLASSES.WEAPON_CLASS));
await setup('a\r');game.flags.menu_style=MENU_COMBINATION;game.invent=[obj()];feedback={v:99};
assert.equal(await ggetobj('drop',()=>1,0,true,feedback),1);
assert.equal(feedback.v,ALL_FINISHED);

await setup();
a=obj();let b=obj(ONAMES.MACE,{invlet:'b'}),c=obj(ONAMES.RIN_PROTECTION,{invlet:'c'});
game.invent=[a,b,c];const seen=[];
assert.equal(await askchain(game.invent,[OCLASSES.RING_CLASS,OCLASSES.WEAPON_CLASS],true,o=>{seen.push(o);return 1;},null,0,'drop'),3);
assert.deepEqual(seen,[c,a,b]);
assert.ok(game.invent.every(o=>!o.bypass));assert.equal(game.context.bypasses,false);

await setup();a=obj();b=obj(ONAMES.MACE,{invlet:'b'});c=obj(ONAMES.RIN_PROTECTION,{invlet:'c'});
game.invent=[a,b,c];const added=obj(ONAMES.ARROW,{invlet:'d'}),visited=[];
assert.equal(await askchain(game.invent,[],true,o=>{
    visited.push(o);
    if(o===a){game.invent.splice(1,1);game.invent.push(added);}
    return 1;
},null,0,'drop'),2);
assert.deepEqual(visited,[a,c],'removed and newly created objects are excluded');

await setup();a=obj();b=obj(ONAMES.MACE,{invlet:'b'});game.invent=[a,b];
let calls=0;
assert.equal(await askchain(game.invent,[],true,()=>{calls++;return 0;},null,1,'drop'),0);
assert.equal(calls,1,'mx counts attempted actions even when the callback returns zero');

await setup();game.invent=[obj(),obj(ONAMES.MACE,{invlet:'b'})];calls=0;
assert.equal(await askchain(game.invent,[],true,()=>{calls++;return -1;},null,0,'drop'),0);
assert.equal(calls,1);assert.ok(game.invent.every(o=>!o.bypass));

for(const [word,want]of [['identify',-1],['drop',0],['take off',0]]) {
    await setup('q');a=obj();a.owornmask=W_WEP;game.invent=[a];
    assert.equal(await askchain(game.invent,[],false,()=>{throw new Error('quit');},null,0,word),want);
}
for(const count of [0,1,3,9]) {
    await setup(count+'\r');a=obj(ONAMES.DAGGER,{quan:3});game.invent=[a];
    let selected;
    const result=await askchain(game.invent,[],false,o=>{selected=o;return 1;},null,0,'drop');
    assert.equal(result,count?1:0);
    if(count===1){assert.equal(a.quan,2);assert.equal(selected.quan,1);assert.notEqual(selected,a);}
    else if(count){assert.equal(selected,a);assert.equal(a.quan,3);}
    else assert.equal(a.quan,3);
}
await setup('1\r');a=obj(ONAMES.DAGGER,{quan:3});game.invent=[a];
assert.equal(await askchain(game.invent,[],false,o=>{assert.equal(o.quan,1);return 0;},null,0,'drop'),0);
assert.equal(game.invent.length,1);assert.equal(game.invent[0].quan,3,'refused split is recombined');

for(const type of [ONAMES.LOADSTONE,ONAMES.DAGGER]) {
    await setup('1\r');a=obj(type,{quan:3,cursed:1,blessed:0});game.invent=[a];
    if(type===ONAMES.DAGGER){game.u.uwep=a;a.owornmask=W_WEP;}
    assert.equal(await askchain(game.invent,[],false,o=>{assert.equal(o,a);return 0;},null,0,'drop'),0);
    assert.equal(a.quan,3);assert.equal(game.invent.length,1);
}

await setup();a=obj(ONAMES.DAGGER,{bknown:1,blessed:1,cursed:0});
b=obj(ONAMES.MACE,{bknown:1,blessed:0,cursed:0,invlet:'b'});
c=obj(ONAMES.POT_HEALING,{bknown:1,blessed:1,cursed:0,invlet:'c'});
game.invent=[a,b,c];add_valid_menu_class(OCLASSES.WEAPON_CLASS);add_valid_menu_class('B');
const filtered=[];
assert.equal(await askchain(game.invent,[],true,o=>{filtered.push(o);return 1;},null,0,'drop'),1);
assert.deepEqual(filtered,[a],'class and blessing filters intersect');

await setup();a=obj();b=obj(ONAMES.MACE);c=obj(ONAMES.ARROW);
const ilets=[],ic={v:0},filterCalls=[];
assert.equal(collect_obj_classes(ilets,[a,b,c],false,o=>{filterCalls.push(o);return o!==a;},ic),1);
assert.deepEqual(ilets,[')']);assert.equal(ic.v,3);assert.deepEqual(filterCalls,[a,b]);

await setup();game.urole={...game.urole,mnum:PMNAMES.PM_CLERIC,name:{m:'Priest'}};
a=obj(ONAMES.DAGGER,{bknown:0,blessed:1,cursed:0});b=obj(ONAMES.GOLD_PIECE,{bknown:1});
assert.equal(count_buc([a,b],BUC_BLESSED,o=>{assert.equal(o.bknown,o===a?1:0);return false;}),0);
assert.equal(a.bknown,1);assert.equal(b.bknown,0);
for(const goldX of [false,true]) {
    game.flags.goldX=goldX;
    assert.equal(count_buc([b],BUC_UNCURSED),goldX?0:1);
    assert.equal(count_buc([b],BUC_UNKNOWN),goldX?1:0);
}
assert.equal(count_buc([a],BUC_CURSED),0);
add_valid_menu_class(0);assert.equal(allow_category(a),false);
game.flags.paranoia_bits=PARANOID_AUTOALL;assert.equal(allow_category(a),true);
game.flags.paranoia_bits=0;add_valid_menu_class(OCLASSES.COIN_CLASS);add_valid_menu_class('B');add_valid_menu_class('u');
assert.equal(allow_category(b),true,'explicit coins bypass blessing and debt filters');
assert.equal(allow_category(a),false);

await setup();a=obj(ONAMES.SACK,{cobj:[obj(ONAMES.DAGGER,{unpaid:1,where:OBJ_CONTAINED})]});
b=obj(ONAMES.DAGGER,{pickup_prev:1});game.invent=[a,b];
assert.equal(count_unpaid(game.invent),1);assert.equal(count_justpicked(game.invent),1);
add_valid_menu_class('u');assert.ok(allow_category(a));assert.ok(!allow_category(b));
add_valid_menu_class(0);add_valid_menu_class('P');assert.ok(!allow_category(a));assert.ok(allow_category(b));
b.owornmask=W_SADDLE;assert.ok(is_worn(b));assert.ok(is_worn_by_type(b));
assert.equal(wearing_armor(),false);game.u.uarms=b;assert.ok(wearing_armor());

await setup();
const letters=['#','A','z','$','a','?', 'B'];
const list=letters.map(invlet=>obj(ONAMES.DAGGER,{invlet}));
let sorted=sortloot(list,SORTLOOT_INVLET,false,null);
assert.deepEqual(members(sorted).map(o=>o.invlet),['$','a','z','A','B','#','?']);
assert.deepEqual(list.map(o=>o.invlet),letters);assert.equal(sorted.at(-1).indx,-1);
unsortloot(sorted);assert.equal(sorted.length,0);
assert.deepEqual(members(sortloot(list,0,false,null)),list);

await setup();a=obj(ONAMES.DAGGER,{invlet:'a',bknown:1,blessed:0,cursed:0,dknown:1,known:1,spe:0});
game.objects[a.otyp].oc_name_known=1;
for(const [better,worse]of [[{blessed:1},{cursed:1}], [{greased:1},{greased:0}],
    [{oeroded:0},{oeroded:2}],[{rknown:1,oerodeproof:1},{rknown:1,oerodeproof:0}],
    [{spe:3},{spe:0}],[{known:1},{known:0}]]) {
    b={...a,...better};c={...a,...worse};
    assert.deepEqual(members(sortloot([c,b],SORTLOOT_PACK|SORTLOOT_LOOT,false,null)),[b,c]);
}
assert.deepEqual(members(sortloot([a,{...a}],SORTLOOT_PACK|SORTLOOT_LOOT,false,null)).map(o=>o.o_id),[a.o_id,a.o_id]);

await setup();
const towels=[0,1,3].map(spe=>obj(ONAMES.TOWEL,{spe,dknown:1,known:1,invlet:'a'}));
assert.deepEqual(members(sortloot(towels,SORTLOOT_LOOT,false,null)),[towels[2],towels[1],towels[0]]);
assert.deepEqual(towels.map(o=>o.spe),[0,1,3]);assert.ok(game.wizard);
await setup();a=obj(ONAMES.CORPSE,{corpsenm:PMNAMES.PM_COCKATRICE});b=obj(ONAMES.CORPSE,{corpsenm:PMNAMES.PM_NEWT});
assert.deepEqual(members(sortloot([a,b],SORTLOOT_PETRIFY,false,()=>false)),[a]);

await setup();a=obj(ONAMES.DAGGER,{owornmask:W_WEP});b=obj(ONAMES.LEATHER_ARMOR,{owornmask:W_ARM});c=obj(ONAMES.LEASH,{leashmon:12});
assert.deepEqual(members(sortloot([c,b,a],SORTLOOT_INUSE,false,null)),[a,b,c]);
sorted=sortloot([a,b,c],SORTLOOT_INVLET,false,null);
bypass_objlist([a,b,c],false);assert.equal(nxt_unbypassed_loot(sorted,[a,c]),a);
assert.equal(nxt_unbypassed_loot(sorted,[a,c]),c);assert.equal(nxt_unbypassed_loot(sorted,[a,c]),null);
bypass_objlist([a,b,c],true);assert.equal(nxt_unbypassed_obj([a,b,c]),null);
bypass_objlist([a,b,c],false);assert.equal(nxt_unbypassed_obj([a,b,c]),a);

await setup('y'.repeat(54));
game.flags.fixinv=false;
game.invent=Array.from({length:54},()=>obj());
const queried=[];
assert.equal(await askchain(game.invent,[],false,()=>{
    queried.push(game.safeq_xprn_ctx.let);return 1;
},null,0,'drop'),54);
assert.deepEqual([queried[25],queried[26],queried[51],queried[52],queried[53]],
    ['z','A','Z','#','$'],'C keeps incrementing after the overflow letter');

await setup();
const pools=['invent','migrating_objs','billobjs','objs_deleted'];const reset=[];
for(const p of pools){const o=obj(ONAMES.SACK,{cobj:[obj()]});game[p]=[o];reset.push(o,o.cobj[0]);}
game.level.objects=[obj()];game.level.buriedobjs=[obj()];reset.push(...game.level.objects,...game.level.buriedobjs);
const worm={data:game.mons[PMNAMES.PM_LONG_WORM],mhp:10,mextra:{mcorpsenm:PMNAMES.PM_LONG_WORM},minvent:[obj()]};
const dead={mhp:0,minvent:[obj()]};game.level.monsters=[worm,dead];
game.migrating_mons=[{minvent:[obj()]}];game.mydogs=[{minvent:[obj()]}];
game.u.uball=obj();game.u.uchain=obj();
reset.push(...worm.minvent,...game.migrating_mons[0].minvent,...game.mydogs[0].minvent,game.u.uball,game.u.uchain);
for(const o of [...reset,...dead.minvent])bypass_obj(o);
clear_bypasses();assert.ok(reset.every(o=>!o.bypass));assert.ok(dead.minvent[0].bypass);
assert.equal(worm.mextra.mcorpsenm,NON_PM);assert.equal(game.context.bypasses,false);
console.log(`inventory selection: ${checks} constructed source controls passed`);
