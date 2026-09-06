#!/usr/bin/env node
// Native observations and independent C-derived state controls for remains.
// Constructed states do not earn native C coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {GameMap} from '../js/game.js';
import {InMemoryStorage} from '../js/storage.js';
import {getRngLog,initRng,enableRngLog} from '../js/rng.js';
import {resetInputState} from '../js/input.js';
import {decodeScreen} from './gen-sessions/screen-decode.mjs';
import {sanitize_name,resetobjs,bones_include_name,no_bones_level,
    can_make_bones,getbones_load,set_ghostly_objlist,fix_ghostly_obj} from '../js/bones.js';
import {savefruitchn} from '../js/save.js';
import {loadfruitchn,ghostfruit} from '../js/restore.js';
import {fruit_from_name,fruit_from_indx,doname} from '../js/objnam.js';
import {fruitadd,set_fruit_name} from '../js/options.js';
import {give_u_to_m_resistances} from '../js/mondata.js';
import {mksobj} from '../js/mkobj.js';
import {save_rooms,rest_rooms} from '../js/mkroom.js';
import {save_timers,restore_timers,relink_timers,obj_is_local} from '../js/timeout.js';
import {save_light_sources,restore_light_sources,relink_light_sources} from '../js/light.js';
import {save_engravings,rest_engravings,forget_engravings,sanitize_engravings} from '../js/engrave.js';
import {save_regions,rest_regions} from '../js/region.js';
import {formatkiller} from '../js/end.js';
import {exist_artifact} from '../js/artifact.js';
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {ART_EXCALIBUR} from '../js/artilist_data.js';
import {OBJ_INVENT,OBJ_FLOOR,OBJ_MINVENT,OBJ_CONTAINED,OBJ_BURIED,OBJ_MIGRATING,
    Upolyd,EBONES,EPRI,ESHK,INTRINSIC,FROMOUTSIDE,FROM_RACE,FROMEXPER,
    RANGE_LEVEL,RANGE_GLOBAL,TIMER_OBJECT,
    LS_OBJECT,ROT_CORPSE,BURN_OBJECT,NON_PM,LEAVESTATUE,
    REG_HERO_INSIDE,REG_NOT_HEROS,KILLED_BY,KILLED_BY_AN,
    NO_KILLER_PREFIX,DIED,MAGIC_PORTAL} from '../js/const.js';

const names=['bones-cemetery','bones-retain-delete','bones-statue','bones-statue-open',
    'bones-object-reset','bones-statue-lamp','bones-slime','bones-undead',
    'bones-level-eligibility','bones-special-restore','bones-burning-restore',
    'bones-long-replay','bones-engraving-restore','bones-fruit-remapping',
    'bones-weapon-adjustment','fruit-name-initialization'];
const read=(part,name)=>JSON.parse(fs.readFileSync(new URL('gen-sessions/'+part+'/'+name+'.json',import.meta.url)));
const normalize=lines=>lines.filter(s=>/^(rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(s)).map(s=>s.replace(/\s*@.*$/,''));
const key=()=>`bones:${game.u.uz.dnum}.${game.u.uz.dlevel}`;
let replays=0,saves=0,loads=0,inventory=0,fruits=0;
function ownership(label){
    const ids=new Set(),objects=[];
    function walk(list,where,parent){for(const o of list||[]){
        assert.ok(!ids.has(o.o_id),label+': object has one owner');ids.add(o.o_id);objects.push(o);
        assert.equal(o.where,where,label);
        if(where===OBJ_CONTAINED)assert.equal(o.ocontainer,parent,label);
        if(where===OBJ_MINVENT)assert.equal(o.ocarry,parent,label);
        walk(o.cobj,OBJ_CONTAINED,o);
    }}
    walk(game.invent,OBJ_INVENT);walk(game.level.objects,OBJ_FLOOR);walk(game.level.buriedobjs,OBJ_BURIED);
    for(const m of game.level.monsters||[]){
        assert.ok(!ids.has(m.m_id),label+': object/monster IDs are distinct');ids.add(m.m_id);
        walk(m.minvent,OBJ_MINVENT,m);
        if(m.mw)assert.ok(m.minvent.includes(m.mw),label+': weapon belongs to monster');
    }
    for(const t of game.timer_base||[])if(t.kind===TIMER_OBJECT){
        assert.ok(objects.includes(t.arg),label+': timer owner is live');assert.equal(t.needs_fixup||0,0,label);
    }
    for(const o of objects)assert.equal(o.timed||0,(game.timer_base||[]).filter(t=>t.kind===TIMER_OBJECT&&t.arg===o).length,label+': timer ownership count');
    for(const source of game.light_sources||[])if(source.type===LS_OBJECT&&source.id)
        assert.ok(objects.some(o=>o.o_id===source.id),label+': light owner is live');
}
const nativeNames=process.argv.includes('--constructed')?[]:names;
for(const name of nativeNames){
    const recipe=read('recipes',name),native=read('generated',name+'.session'),storage=new InMemoryStorage();
    for(const[index,s]of recipe.segments.entries()){
        const label=name+':'+s.name,oracle=native.segments[index];let saving,loading,loadKey,unlink;
        globalThis.__step_snapshot={step:'*',cb:(_,step)=>{
            const top=decodeScreen(oracle.steps[step].screen)[0];
            if(top.includes('Save bones?')&&s.moves[step]==='y')saving={
                key:key(),x:game.u.ux,y:game.u.uy,old:structuredClone(game.level.bonesinfo||null),
                who:[game.plname,game.urole.filecode,game.urace.filecode,game.flags.female?'Fem':'Mal',
                    game.u.ualign.type===1?'Law':game.u.ualign.type===-1?'Cha':'Neu'].join('-'),
                arise:game.u.ugrave_arise,hp:game.u.uhpmax,level:game.u.ulevel,
                wizard:!!game.wizard};
            if(top.includes('Get bones?')&&s.moves[step]==='y'){
                loadKey=key();loading=JSON.parse(storage.getItem(loadKey));assert.ok(loading,label+': persisted file exists');
            }
            if(top.includes('Unlink bones?')){
                assert.ok(loading,label+': loaded file observed');loads++;
                assert.equal(game.program_state.reading_bonesfile,0,label);
                assert.equal(game.u.uroleplay.numbones,1,label);
                assert.deepEqual(game.level.bonesinfo,loading.bonesinfo,label+': cemetery chain survived');
                assert.equal(game.level.nroom,loading.rooms.length,label+': restored room count');
                assert.equal(game.level.rooms[game.level.nroom].hx,-1,label+': room sentinel');
                assert.deepEqual(game.updest,loading.updest,label);assert.deepEqual(game.dndest,loading.dndest,label);
                for(const m of game.level.monsters){
                    if(m.isshk)assert.deepEqual(ESHK(m).shoplevel,game.u.uz,label+': shop level rebound');
                    if(m.ispriest)assert.deepEqual(EPRI(m).shrlevel,game.u.uz,label+': shrine level rebound');
                    for(const o of m.minvent||[])assert.equal(o.ghostly,1,label);
                }
                for(const o of [...game.level.objects,...(game.level.buriedobjs||[])])assert.equal(o.ghostly,1,label+': floor/buried provenance');
                ownership(label);unlink=s.moves[step];
            }
            // Read the restored fruit at the actual native pickup boundary.
            if(name==='bones-fruit-remapping'&&s.name.startsWith('fruit-load-')
                &&step===s.moves.lastIndexOf(',')+1){
                assert.ok(top.includes('Pick up what?'),label+': native pickup prompt');
                const descriptions=decodeScreen(oracle.steps[step].screen)
                    .map(row=>row.match(/\s[a-zA-Z] [-+] (.+?)\s*$/)?.[1]).filter(Boolean);
                const fruit=game.level.objects.filter(o=>o.otyp===ONAMES.SLIME_MOLD
                    &&o.ox===game.u.ux&&o.oy===game.u.uy);
                assert.equal(fruit.length,1,label+': one restored floor fruit');
                assert.ok(descriptions.includes(doname(fruit[0])),label+': native restored fruit identity');fruits++;
            }
            // Native inventory rows after the explicit final 'i' command.
            if(step===s.moves.lastIndexOf('i')+1){
                for(const row of decodeScreen(oracle.steps[step].screen)){
                    const match=row.trim().match(/^([a-zA-Z]) [-+] (.+)$/);if(!match)continue;
                    const o=(game.invent||[]).find(o=>o.invlet===match[1]);
                    assert.ok(o,label+': native inventory letter '+match[1]);
                    assert.equal(doname(o),match[2],label+': native inventory description');inventory++;
                }
            }
        }};
        let result;
        try{result=await runSegment({...s,storage});}finally{delete globalThis.__step_snapshot;}
        replays++;
        assert.deepEqual(normalize(result.getRngLog()),normalize(oracle.steps.flatMap(t=>t.rng||[])),label+': native RNG');
        assert.deepEqual(game.impossible_log||[],[],label);assert.deepEqual(game.rc.errors,[],label);
        if(saving){
            const snap=JSON.parse(storage.getItem(saving.key));assert.ok(snap,label+': bones actually written');saves++;
            assert.equal(snap.bonesinfo.who,saving.who,label);
            assert.equal(snap.bonesinfo.frpx,saving.x,label);assert.equal(snap.bonesinfo.frpy,saving.y,label);
            assert.equal(snap.bonesinfo.bonesknown,false,label);assert.deepEqual(snap.bonesinfo.next,saving.old,label);
            if(s.datetime)assert.equal(snap.bonesinfo.when,s.datetime,label+': fixed death timestamp');
            assert.equal(!!snap.flags.wizard_bones,saving.wizard,label);
            if(saving.arise!==LEAVESTATUE){
                const m=snap.monsters.find(m=>EBONES(m));assert.ok(m,label+': death monster metadata');
                // makemon() may immediately choose a vampire's alternate form.
                assert.equal(m.cham!==NON_PM?m.cham:m.mnum,saving.arise>=0?saving.arise:PMNAMES.PM_GHOST,label);
                assert.equal(m.mhp,saving.hp,label);assert.equal(m.mhpmax,saving.hp,label);
                assert.equal(m.m_lev,saving.level||1,label);assert.equal(m.msleeping,1,label);
            }
        }
        if(loading&&unlink==='y')assert.equal(storage.getItem(loadKey),null,label+': deletion accepted');
        if(loading&&unlink==='n')assert.ok(storage.getItem(loadKey),label+': file retained');
        const hp=decodeScreen(oracle.steps.at(-1).screen).join('\n').match(/HP:(\d+)\(\d+\)/);
        if(hp)assert.equal(Math.max(0,Upolyd(game.u)?game.u.mh:game.u.uhp),+hp[1],label+': native final HP');
    }
}
if(nativeNames.length){
    assert.equal(replays,91);assert.ok(saves>=25);assert.ok(loads>=25);assert.ok(inventory>=20);assert.equal(fruits,5);
    console.log(`${replays} native replays, ${saves} written bones, ${loads} load boundaries, ${inventory} inventory observations, ${fruits} fruit observations PASS`);
}

const base=read('recipes','fruit-name-initialization').segments[0];let groups=0;
async function setup(){
    resetInputState();await runSegment({...base,moves:' ',storage:new InMemoryStorage()});
    game.level=new GameMap();game.level.monAt=new Map();game.invent=[];game.timer_base=[];game.light_sources=[];
    game.u.ux=40;game.u.uy=10;game.u.urooms='';game.u.ushops='';game.u.uz={dnum:0,dlevel:1};
    game._preNhgetchHook=null;game._toplin=0;game._pending_message='';game._win_stop=false;resetInputState();groups++;
}
const obj=typ=>mksobj(typ,false,false);
const chain=rows=>rows.reduceRight((nextf,[fid,fname])=>({fid,fname,nextf}),null);
const entries=()=>{const result=[];for(let f=game.ffruit;f;f=f.nextf)result.push([f.fid,f.fname]);return result;};

// Byte sanitation distinguishes control bytes from printable high-bit bytes.
for(const eight of[false,true]){await setup();game.iflags.wc_eight_bit_input=eight;assert.equal(sanitize_name('A\x00\x1b\x7f\x80\x9f\xa0\xe9'),eight?'A.....\xa0\xe9':'A.....__');}
await setup();game.level.bonesinfo={who:'Ashen-Pri-Hum-Fem-Law',next:{who:'Ash-Wiz-Hum-Mal-Neu',next:null}};
for(const[name,want]of[['Ashen',true],['Ash',true],['Ashe',false],['ashen',false],['',false]])assert.equal(bones_include_name(name),want);

// Eligibility guards precede the depth draw; wizard mode still makes it.
for(const guard of['disabled','swallowed','portal','zero-ledger']){
    await setup();game.flags.bones=true;game.wizard=true;
    if(guard==='disabled')game.flags.bones=false;
    if(guard==='swallowed')game.u.uswallow=1;
    if(guard==='portal'){game.branches=[];game.level.traps=[{ttyp:MAGIC_PORTAL}];}
    if(guard==='zero-ledger')game.u.uz.dlevel=0;
    const mark=getRngLog().length;assert.equal(can_make_bones(),false,guard);assert.equal(getRngLog().length,mark,guard+': no depth draw');
}
await setup();game.flags.bones=true;game.wizard=true;let markEligibility=getRngLog().length;assert.equal(can_make_bones(),true);assert.match(getRngLog().slice(markEligibility).join('\n'),/rn2\(1\)=0/);
await setup();game.flags.bones=true;game.wizard=false;game.discover=true;game.u.uz.dlevel=6;let nonzero=false;
for(let seed=1;seed<=10;seed++){initRng(seed);enableRngLog();assert.equal(can_make_bones(),false);if(getRngLog().some(s=>/^rn2\(2\)=1/.test(s)))nonzero=true;}assert.equal(nonzero,true,'explore rejects even a nonzero depth draw');
await setup();const level={dnum:0,dlevel:1};game.save_dlevel={...game.medusa_level};assert.equal(no_bones_level(level),true);assert.deepEqual(level,game.medusa_level,'regenerated level overrides the test target');

// Names, knowledge, and unique invocation items are reset independently.
await setup();const sword=obj(ONAMES.LONG_SWORD);Object.assign(sword,{known:1,dknown:1,bknown:1,rknown:1,lknown:1,cknown:1,tknown:1,invlet:'z',no_charge:1,how_lost:7,oname:'Old name'});
const oldKnown=sword.known;await resetobjs([sword],false);
for(const key of['dknown','bknown','rknown','lknown','cknown','tknown','no_charge','how_lost'])assert.equal(sword[key],0,key);
assert.equal(sword.known,game.objects[sword.otyp].oc_uses_known?0:oldKnown);assert.equal(sword.invlet,'');assert.ok(!sword.oname);
for(const typ of[ONAMES.STATUE,ONAMES.SPE_NOVEL]){await setup();const o=obj(typ);o.oname='Kept name';await resetobjs([o],false);assert.equal(o.oname,'Kept name');}
for(const[from,to]of[[ONAMES.AMULET_OF_YENDOR,ONAMES.FAKE_AMULET_OF_YENDOR],[ONAMES.BELL_OF_OPENING,ONAMES.BELL],[ONAMES.SPE_BOOK_OF_THE_DEAD,ONAMES.SPE_BLANK_PAPER]]){
    await setup();const o=obj(from);await resetobjs([o],false);assert.equal(o.otyp,to);assert.equal(!!o.cursed,true);
}
for(const candles of[0,7]){await setup();const o=obj(ONAMES.CANDELABRUM_OF_INVOCATION);o.spe=candles;await resetobjs([o],false);assert.equal(o.otyp,ONAMES.WAX_CANDLE);assert.equal(o.age,50);assert.equal(o.spe,0);assert.equal(o.quan,candles||1);assert.equal(!!o.cursed,true);}
await setup();const egg=obj(ONAMES.EGG);egg.spe=1;const tin=obj(ONAMES.TIN);tin.corpsenm=PMNAMES.PM_MEDUSA;const ordinary=obj(ONAMES.TIN);ordinary.corpsenm=PMNAMES.PM_LIZARD;await resetobjs([egg,tin,ordinary],false);assert.equal(egg.spe,0);assert.equal(tin.corpsenm,NON_PM);assert.equal(ordinary.corpsenm,PMNAMES.PM_LIZARD);
await setup();const box=obj(ONAMES.LARGE_BOX),inside=obj(ONAMES.LONG_SWORD);inside.oname='Nested name';box.cobj=[inside];inside.where=OBJ_CONTAINED;inside.ocontainer=box;await resetobjs([box],false);assert.ok(!inside.oname);
await setup();const art=obj(ONAMES.LONG_SWORD);art.oartifact=ART_EXCALIBUR;art.oname='Excalibur';await resetobjs([art],true);assert.ok(exist_artifact(ONAMES.LONG_SWORD,'Excalibur'));const duplicate=obj(ONAMES.LONG_SWORD);duplicate.oartifact=ART_EXCALIBUR;duplicate.oname='Excalibur';await resetobjs([duplicate],true);assert.equal(duplicate.oartifact,0);assert.ok(!duplicate.oname);

// Only the permanent eight resistance bits survive into arisen remains.
const resistances=['HFire_resistance','HCold_resistance','HSleep_resistance','HDisint_resistance','HShock_resistance','HPoison_resistance','HAcid_resistance','HStone_resistance'];
for(let i=0;i<8;i++)for(const source of[1,FROMOUTSIDE,FROM_RACE,FROMEXPER]){
    await setup();game.u.intrinsic={};game.u.intrinsic[resistances[i]]=source;const m={mintrinsics:0};give_u_to_m_resistances(m);assert.equal(m.mintrinsics,source&INTRINSIC?1<<i:0);
}

// Fruit lookup retains C's exact, longest-prefix, and plural behavior.
for(const[query,exact,want]of[['pear',true,1],['Pear',true,null],['pear pie',false,2],['pear pie filling',false,2],['pearl',false,null],['pears',true,1],['pears in syrup',false,1],['pear pies in syrup',false,1],['pear pie filling',true,null]]){
    await setup();game.ffruit=chain([[1,'pear'],[2,'pear pie'],[3,'apple']]);const high={v:-1};assert.equal(fruit_from_name(query,exact,high)?.fid||null,want,query);if(!want)assert.equal(high.v,3);assert.equal(fruit_from_indx(2).fname,'pear pie');assert.equal(fruit_from_indx(9),null);
}
// An existing short prefix wins before C attempts singularizing a longer one.
await setup();game.ffruit=chain([[2,'pear pie']]);assert.equal(fruit_from_name('pear pies in syrup',false,null).fid,2);
await setup();game.ffruit=chain([[3,'unused'],[2,'plum'],[1,'pear']]);game.ffruit.fid=-3;const savedFruit=savefruitchn();assert.deepEqual(savedFruit,[{fname:'plum',fid:2},{fname:'pear',fid:1}]);game.ffruit=loadfruitchn(savedFruit);assert.deepEqual(entries(),[[1,'pear'],[2,'plum']]);
await setup();game.ffruit=chain([[1,'starfruit']]);game.context.current_fruit=1;game.oldfruit=chain([[1,'dragonberry']]);const fruit={spe:1};await ghostfruit(fruit);assert.equal(fruit.spe,2);assert.equal(fruit_from_indx(2).fname,'dragonberry');assert.equal(game.context.current_fruit,1);assert.equal(game.flags.made_fruit,true);
await setup();game.ffruit=chain([[1,'pear']]);game.context.current_fruit=1;assert.equal(fruitadd('pear pie',null),1);assert.equal(fruitadd('Pear',null),2);assert.equal(game.context.current_fruit,1);
await setup();game.ffruit=chain(Array.from({length:127},(_,i)=>[i+1,'fruit'+i]));game.context.current_fruit=7;const mark=getRngLog().length;const fallback=fruitadd('new fruit',null);assert.ok(fallback>=1&&fallback<=127);assert.equal(entries().length,127);assert.equal(game.context.current_fruit,7);assert.match(getRngLog().slice(mark).join('\n'),/rnd\(127\)/);
await setup();set_fruit_name('pear');const first=game.context.current_fruit;set_fruit_name('plum');assert.equal(game.context.current_fruit,first);assert.equal(entries().length,1);game.flags.made_fruit=true;set_fruit_name('peach');assert.equal(entries().length,2);assert.equal(fruit_from_indx(first).fname,'plum');
await setup();game.ffruit=chain(Array.from({length:100},(_,i)=>[i+1,'fruit'+i]));game.svp.pl_fruit='fruit0';game.context.current_fruit=1;game.flags.made_fruit=true;set_fruit_name('extra');assert.equal(entries().length,100);assert.equal(game.context.current_fruit,1);assert.deepEqual(game.rc.errors,["Doing that so many times isn't very fruitful."]);
await setup();set_fruit_name('  blessed    pears  ');assert.equal(game.svp.pl_fruit,'candied blessed pear');set_fruit_name('apple');assert.equal(game.svp.pl_fruit,'candied apple');

// Marking is deliberately nonrecursive. Uninteresting pickups still clear it.
await setup();const parent=obj(ONAMES.LARGE_BOX),child=obj(ONAMES.BOW);parent.cobj=[child];set_ghostly_objlist([parent]);assert.equal(parent.ghostly,1);assert.equal(child.ghostly||0,0);await fix_ghostly_obj(parent);assert.equal(parent.ghostly,0);
for(const handed of[0,1]){await setup();const o=obj(ONAMES.BOW);o.ghostly=1;game.u.uhandedness=handed;await fix_ghostly_obj(o);assert.equal(o.ghostly,0);const before=game.nhDisplay.terminal.serialize();await fix_ghostly_obj(o);assert.equal(game.nhDisplay.terminal.serialize(),before);}

// Room trees must shed resident cycles but preserve shared subroom identity.
await setup();const sub={lx:2,hx:3,ly:2,hy:3,sbrooms:[],resident:null};const room={lx:1,hx:8,ly:1,hy:8,sbrooms:[sub],resident:null};const shop={room};room.resident=shop;game.level.rooms=[room,{hx:-1}];game.level.nroom=1;const rooms=save_rooms();assert.equal(rooms.length,1);assert.equal(rooms[0].resident,null);assert.doesNotThrow(()=>JSON.stringify(rooms));rest_rooms(rooms);assert.equal(game.level.nroom,1);assert.equal(game.level.nsubroom,1);assert.equal(game.level.subrooms[0],game.level.rooms[0].sbrooms[0]);assert.equal(game.level.rooms[1].hx,-1);

// C restobjchn freezes only the immediate contents of an ice box. A nested
// ordinary container recursively starts a new, nonfrozen contents chain.
await setup();game.wizard=false;game.moves=100;
const aged=obj(ONAMES.LONG_SWORD),oil=obj(ONAMES.OIL_LAMP),ice=obj(ONAMES.ICE_BOX),cold=obj(ONAMES.CORPSE),sack=obj(ONAMES.SACK),deep=obj(ONAMES.DAGGER);
Object.assign(aged,{age:10,where:OBJ_FLOOR,ox:40,oy:10});Object.assign(oil,{age:500,where:OBJ_FLOOR,ox:40,oy:10});Object.assign(ice,{age:45,where:OBJ_FLOOR,ox:40,oy:10,cobj:[cold,sack]});Object.assign(cold,{age:35,where:OBJ_CONTAINED});Object.assign(sack,{age:30,where:OBJ_CONTAINED,cobj:[deep]});Object.assign(deep,{age:40,where:OBJ_CONTAINED});
const oldIds=[aged,oil,ice,cold,sack,deep].map(o=>o.o_id);
game.storage.setItem(key(),JSON.stringify({moves:10,cells:game.level.locations,flags:{},rooms:[],objects:[aged,oil,ice],monsters:[],buried:[],stairs:[],updest:{},dndest:{},bonesinfo:null}));
assert.equal(await getbones_load(),true);const loaded=game.level.objects;
assert.deepEqual(loaded.map(o=>o.age),[100,500,135]);assert.equal(loaded[2].cobj[0].age,35);assert.equal(loaded[2].cobj[1].age,30);assert.equal(loaded[2].cobj[1].cobj[0].age,130);assert.equal(loaded[2].cobj[0].ocontainer,loaded[2]);assert.equal(loaded[2].cobj[1].cobj[0].ocontainer,loaded[2].cobj[1]);assert.ok(loaded.every(o=>!oldIds.includes(o.o_id)));assert.equal(game.oldfruit,null);

// Local timers leave the active queue. Ties reverse on load, timestamps shift
// only for ghostly loads, and relinking does not start/count a second timer.
await setup();const floor=obj(ONAMES.CORPSE),held=obj(ONAMES.OIL_LAMP),nested=obj(ONAMES.EGG);floor.where=OBJ_FLOOR;held.where=OBJ_INVENT;nested.where=OBJ_CONTAINED;nested.ocontainer=held;game.level.objects=[floor];game.invent=[held];floor.timed=2;held.timed=1;
game.timer_id=91;game.timer_base=[{tid:1,kind:TIMER_OBJECT,arg:floor,func_index:ROT_CORPSE,timeout:100},{tid:2,kind:TIMER_OBJECT,arg:floor,func_index:BURN_OBJECT,timeout:100},{tid:3,kind:TIMER_OBJECT,arg:held,func_index:BURN_OBJECT,timeout:140}];
assert.equal(obj_is_local(floor),true);assert.equal(obj_is_local(nested),false);const timers=save_timers(RANGE_LEVEL,true);assert.deepEqual(timers.timers.map(t=>t.tid),[1,2]);assert.deepEqual(game.timer_base.map(t=>t.tid),[3]);assert.equal(floor.timed,2);assert.equal(timers.timers[0].arg,floor.o_id);assert.equal(timers.timers[0].needs_fixup,1);
const oldid=floor.o_id;floor.o_id=100000;restore_timers(timers,RANGE_LEVEL,true,25);relink_timers(true,new Map([[oldid,floor.o_id]]));assert.deepEqual(game.timer_base.map(t=>[t.tid,t.timeout]),[[2,125],[1,125],[3,140]]);assert.equal(game.timer_base[0].arg,floor);assert.equal(game.timer_id,91);assert.equal(floor.timed,2);
const globalTimers=save_timers(RANGE_GLOBAL);assert.equal(globalTimers.timer_id,91);assert.deepEqual(globalTimers.timers.map(t=>t.tid),[3]);
for(const[where,want]of[[OBJ_INVENT,false],[OBJ_MIGRATING,false],[OBJ_BURIED,true],[OBJ_FLOOR,true]]){await setup();assert.equal(obj_is_local({where}),want);}
for(const migrating of[false,true]){await setup();const m={};game.migrating_mons=migrating?[m]:[];assert.equal(obj_is_local({where:OBJ_MINVENT,ocarry:m}),!migrating);}

// Lights have a separate serialized chain and need the same fresh IDs.
await setup();const a=obj(ONAMES.OIL_LAMP),b=obj(ONAMES.OIL_LAMP);a.where=OBJ_FLOOR;b.where=OBJ_INVENT;game.level.objects=[a];game.invent=[b];game.light_sources=[{type:LS_OBJECT,id:a.o_id,x:1,y:2,range:3,flags:1},{type:LS_OBJECT,id:b.o_id,x:3,y:4,range:2,flags:0},{type:LS_OBJECT,id:0,x:3,y:4,range:0,flags:0}];const lights=save_light_sources(RANGE_LEVEL,true);assert.equal(lights.length,1);assert.equal(lights[0].flags,3);assert.equal(game.light_sources.length,1);const old=a.o_id;a.o_id=100001;restore_light_sources(lights);relink_light_sources(true,new Map([[old,a.o_id]]));assert.deepEqual(game.light_sources.map(s=>s.id),[a.o_id,b.o_id]);assert.equal(game.light_sources[0].flags,1);

// C keeps a base allocation even when its readable pointer skips spaces.
await setup();game.moves=30;game.level.lev_engr=[{engr_txt:'mark',engr_txt_offset:2,engr_txt_remembered:'known',engr_remembered_offset:1,engr_time:1,eread:1,erevealed:1},{engr_txt:'second',engr_time:2}];const eng=save_engravings();assert.equal(game.level.lev_engr[0].engr_txt,'  mark');assert.equal(eng[0].engr_txt_remembered,' known');rest_engravings(eng);assert.deepEqual(game.level.lev_engr.map(e=>e.engr_txt),['second','mark']);assert.equal(game.level.lev_engr[1].engr_txt_offset,2);assert.equal(game.level.lev_engr[1].engr_time,30);forget_engravings();assert.ok(game.level.lev_engr.every(e=>e.eread===0&&e.erevealed===0));game.level.lev_engr[1].engr_txt='a\x1bb';game.level.lev_engr[1].engr_txt_remembered='a\x1bb';sanitize_engravings();assert.equal(game.level.lev_engr[1].engr_txt,'a.b');assert.equal(game.level.lev_engr[1].engr_txt_remembered,'a\x1bb');

// Ghostly regions keep their remaining duration and forget the old hero.
await setup();game.moves=100;game.regions=[{ttl:12,player_flags:REG_HERO_INSIDE,monsters:[10,20,30],n_monst:3}];const region=save_regions();game.moves=110;rest_regions(region,true,new Map([[10,101],[30,303]]));assert.equal(game.regions[0].ttl,12);assert.equal(game.regions[0].player_flags&REG_HERO_INSIDE,0);assert.ok(game.regions[0].player_flags&REG_NOT_HEROS);assert.deepEqual(game.regions[0].monsters.slice(0,game.regions[0].n_monst),[101,303]);rest_regions(region,false,new Map());assert.equal(game.regions[0].ttl,2);

// Killer prefixes, delimiter sanitation, helpless suffix, and buffer bounds.
for(const[format,name,want]of[[KILLED_BY,'an arrow','killed by an arrow'],[KILLED_BY_AN,'arrow','killed by an arrow'],[NO_KILLER_PREFIX,'petrified by a corpse','petrified by a corpse']]){await setup();game.killer={format,name};game.multi=0;assert.equal(formatkiller(DIED,true),want);}
await setup();game.killer={format:KILLED_BY,name:'a,b=c\td'};game.multi=0;assert.equal(formatkiller(DIED,true),'killed by a;b_c d');
console.log(`${groups} constructed C-derived control groups PASS`);
