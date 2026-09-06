#!/usr/bin/env node
// Native observations and C-derived controls. Constructed states earn no C coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {GameMap} from '../js/game.js';
import {InMemoryStorage} from '../js/storage.js';
import {resetInputState,pushKeys} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {decodeScreen} from './gen-sessions/screen-decode.mjs';
import {init_mapseen,query_annotation,dooverview,show_overview,depth,ledger_no} from '../js/dungeon.js';
import {describe_level} from '../js/botl.js';
import {donamelevel} from '../js/do_name.js';
import {tty_create_nhwindow,tty_destroy_nhwindow,tty_get_nhwindow,NHW_MENU} from '../js/tty/wintty.js';
import {DIED,QUIT,ESCAPED,ASCENDED,BR_PORTAL,BR_NO_END1,BR_NO_END2,BR_STAIR,
    OBJ_INVENT,OBJ_FLOOR,OBJ_MINVENT,OBJ_CONTAINED,Upolyd} from '../js/const.js';

const read=(part,name)=>JSON.parse(fs.readFileSync(new URL('gen-sessions/'+part+'/'+name+'.json',import.meta.url)));
const normalize=lines=>lines.filter(s=>/^(rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(s)).map(s=>s.replace(/\s*@.*$/,''));
let replays=0,annotations=0,queries=0;
for(const name of['overview-annotations','overview-branches','overview-pages','overview-disclosure']){
    const recipe=read('recipes',name),native=read('generated',name+'.session'),storage=new InMemoryStorage();
    for(const [i,s] of recipe.segments.entries()){
        const label=name+':'+s.name,oracle=native.segments[i];
        const command=[...s.moves.matchAll(/m(?:#annotate\r|#overview\r|\x0f)/g)].at(-1);
        let heroBefore;
        if(command)globalThis.__step_snapshot={step:command.index+command[0].length,cb:()=>{heroBefore={...game.u.uz};queries++;}};
        let result;
        try{result=await runSegment({...s,storage});}finally{delete globalThis.__step_snapshot;}
        replays++;
        assert.deepEqual(normalize(result.getRngLog()),normalize(oracle.steps.flatMap(t=>t.rng||[])),label+': native RNG, including repeated game initialization');
        assert.deepEqual(game.impossible_log||[],[],label);
        assert.deepEqual(game.rc.errors,[],label);
        if(command){assert.ok(heroBefore,label);assert.deepEqual(game.u.uz,heroBefore,label+': annotation preserves hero level');assert.equal(game.iflags.menu_requested,false,label+': prefix consumed');}
        const final=decodeScreen(oracle.steps.at(-1).screen).join('\n'),hp=final.match(/HP:(\d+)\(\d+\)/);
        if(hp)assert.equal(Math.max(0,Upolyd(game.u)?game.u.mh:game.u.uhp),+hp[1],label+': native HP');
        const seen=new Set();
        function walk(list,where,parent){for(const o of list||[]){assert.ok(!seen.has(o.o_id),label+': unique ownership');seen.add(o.o_id);assert.equal(o.where,where,label);if(where===OBJ_CONTAINED)assert.equal(o.ocontainer,parent,label);if(where===OBJ_MINVENT)assert.equal(o.ocarry,parent,label);walk(o.cobj,OBJ_CONTAINED,o);}}
        walk(game.invent,OBJ_INVENT);walk(game.level.objects,OBJ_FLOOR);for(const mon of game.level.monsters)walk(mon.minvent,OBJ_MINVENT,mon);
        // Read annotation values from the native overview, including remote
        // levels. The menu's C branch heading determines the level key.
        const start=s.moves.lastIndexOf('#overview\r');
        if(start>=0){
            let dnum=-1,offset=0;const observed=new Set();
            for(const t of oracle.steps.slice(start+10,start+13))for(const row of decodeScreen(t.screen)){
                const header=game.dungeons.findIndex(d=>row.includes(d.dname+':'));
                if(header>=0){dnum=header;offset=row.indexOf(game.dungeons[header].dname);continue;}
                if(dnum<0)continue;
                const line=row.slice(offset).trim(),m=line.match(/^(Level (\d+)|Astral Plane|Plane of (Water|Fire|Air|Earth)):/);
                if(!m)continue;
                const dep=m[2]?+m[2]:m[1]==='Astral Plane'?-5:({Water:-4,Fire:-3,Air:-2,Earth:-1}[m[3]]);
                const depthstart=dnum===game.quest_dnum||dnum===game.knox_level.dnum?1:game.dungeons[dnum].depth_start;
                const key=dnum+':'+(dep-depthstart+1),entry=game.mapseen[key];
                assert.ok(entry,label+': C overview entry '+key);
                assert.equal(entry.custom||'',line.match(/"(.*)"/)?.[1]||'',label+': C annotation '+key);
                if(!observed.has(key)){annotations++;observed.add(key);}
            }
            assert.ok(observed.size,label+': native overview observed');
        }
        for(const entry of Object.values(game.mapseen))if(entry.custom)assert.equal(entry.custom_lth,entry.custom.length,label+': annotation length');
    }
}
assert.equal(replays,57);assert.equal(queries,50);
console.log(`${replays} native replays, ${queries} selection boundaries, ${annotations} annotation observations PASS`);

const base=read('recipes','level-names').segments[0],pre=base.moves.slice(0,base.moves.lastIndexOf('\x16'));
let groups=0;
async function setup(){
    resetInputState();await runSegment({...base,moves:pre,storage:new InMemoryStorage()});
    game.level=new GameMap();game.mapseen={};game.u.ux=40;game.u.uy=10;game.u.urooms='';game.u.uz={dnum:0,dlevel:1};game.u.ublind=false;game.u.intrinsic.HLevitation=0;game.u.uevent={};game.quest_status={};game._preNhgetchHook=null;game._toplin=0;game._pending_message='';game._win_stop=false;game.wizard=false;resetInputState();init_mapseen(game.u.uz);groups++;
}
const entry=(lev=game.u.uz,props={})=>{init_mapseen(lev);return Object.assign(game.mapseen[lev.dnum+':'+lev.dlevel],props);};
const remote=(props={})=>entry({dnum:0,dlevel:2},props);
async function menu(why=0,reason=0,keys=' ',command=null){
    const marker=tty_create_nhwindow(NHW_MENU);tty_destroy_nhwindow(marker);
    let items;const hero={...game.u.uz},rng=getRngLog().length;
    game._preNhgetchHook=()=>{const win=tty_get_nhwindow(marker+1);if(win?.mlist&&!items){items=[];for(let p=win.mlist;p;p=p.next)items.push({...p,next:undefined});}};
    resetInputState();pushKeys(keys);
    try{await (command?command():show_overview(why,reason));}finally{game._preNhgetchHook=null;}
    assert.ok(items,'menu reached input');assert.equal(tty_get_nhwindow(marker+1),undefined,'menu window released');assert.deepEqual(game.u.uz,hero,'selected annotation leaves hero level intact');assert.equal(getRngLog().length,rng,'overview and query do not draw RNG');
    return {items,text:items.map(i=>i.str).join('\n')};
}
async function query(lev,input){
    let prompt='',reads=0;game._preNhgetchHook=()=>{reads++;prompt ||= decodeScreen(game.nhDisplay.terminal.serialize())[0].trim();};
    resetInputState();pushKeys(input);const hero={...game.u.uz},rng=getRngLog().length;
    try{await query_annotation(lev);}finally{game._preNhgetchHook=null;}
    assert.deepEqual(game.u.uz,hero);assert.equal(getRngLog().length,rng);return {prompt,reads};
}

// C query_annotation: missing entries consume no input. Blank and escape
// preserve an existing name, spaces delete it, and mungspaces folds runs.
await setup();assert.equal((await query({dnum:0,dlevel:2},'')).reads,0);
for(const [input,want]of[['\r','Old camp'],['\x1b','Old camp'],['   \r',null],['  New    camp  \r','New camp']]){
    await setup();entry(game.u.uz,{custom:'Old camp',custom_lth:8});assert.match((await query(null,input)).prompt,/Replace annotation "Old camp" with\?/);assert.equal(entry().custom,want);assert.equal(entry().custom_lth,want?.length||0);
}
for(const n of[30,31,80]){await setup();entry(game.u.uz,{custom:'X'.repeat(n),custom_lth:n});const {prompt}=await query(null,'\r');assert.equal(prompt,`Replace annotation "${'X'.repeat(Math.min(n,30))}${n>30?'...':''}" with?`);assert.equal(entry().custom_lth,n);}
await setup();assert.equal((await query(null,'Camp\r')).prompt,'What do you want to call this dungeon level?');assert.equal(entry().custom,'Camp');
await setup();remote();assert.equal((await query({dnum:0,dlevel:2},'Camp\r')).prompt,'What do you want to call level 2?');assert.equal(remote().custom,'Camp');assert.equal(entry().custom,undefined);
for(const [field,expected]of[['qstart_level','Home 1, the Quest'],['knox_level','Fort Ludios'],['earth_level','Plane of Earth']]){
    await setup();entry(game[field]);assert.equal((await query(game[field],'Camp\r')).prompt,`What do you want to call ${expected}?`);assert.equal(entry(game[field]).custom,'Camp');
}

// Both the C describe_level buffer and integer return are observable.
await setup();
for(const [lev,short,long,special]of[
    [{dnum:0,dlevel:1},'Dlvl:1 ','level 1, the Dungeons of Doom',0],
    [{dnum:0,dlevel:12},'Dlvl:12','level 12, the Dungeons of Doom',0],
    [game.qstart_level,'Home 1','Home 1, the Quest',1],
    [game.knox_level,'Fort Ludios','Fort Ludios',1],
    [game.astral_level,'Astral Plane','Astral Plane',1],
    [game.earth_level,'Earth','Plane of Earth',1],
    [{dnum:game.tutorial_dnum,dlevel:1},'Tutorial:1 ','level 1, the Tutorial',0],
])for(let flags=0;flags<4;flags++){assert.deepEqual(describe_level(flags,lev),{text:(flags&2?long:short)+(flags&1?' ':''),special});groups++;}

// 'm' shows even uninteresting levels; ledger identifiers select a remote
// record, and all three command routes clear the prefix after the query.
for(const command of[dooverview,donamelevel]){
    await setup();remote();game.iflags.menu_requested=true;
    const {items}=await menu(-1,0,'bRemote camp\r',command);
    assert.deepEqual(items.filter(i=>i.identifier).map(i=>i.identifier),[ledger_no(game.u.uz)+1,ledger_no({dnum:0,dlevel:2})+1]);assert.equal(remote().custom,'Remote camp');assert.equal(entry().custom,undefined);assert.equal(game.iflags.menu_requested,false);
}
for(const keys of['\x1b','\r']){await setup();remote({custom:'Old camp',custom_lth:8});game.iflags.menu_requested=true;await menu(-1,0,keys,dooverview);assert.equal(remote().custom,'Old camp');assert.equal(game.iflags.menu_requested,false);}

// C interest_mapseen: current level wins, then reachability, tutorial,
// automatic annotations, Sokoban, endgame, features, bones, custom and depth.
await setup();remote();assert.doesNotMatch((await menu()).text,/Level 2:/);assert.match((await menu(-1,0,'\x1b')).text,/Level 2:/);
for(const flag of['oracle','bigroom','roguelevel','castle','valley','msanctum','vibrating_square','quest_summons','questing']){await setup();remote({flags:{[flag]:true}});assert.match((await menu()).text,/Level 2:/);}
for(const flag of['forgot','notreachable']){await setup();remote({custom:'Camp',flags:{[flag]:true}});assert.doesNotMatch((await menu()).text,/Level 2:/);entry(game.u.uz,{flags:{[flag]:true}});assert.match((await menu()).text,/Level 1:/);}
for(const field of['nfount','nsink','naltar','nthrone','ngrave','ntree','nshop','ntemple']){await setup();remote({feat:{[field]:1}});assert.match((await menu()).text,/Level 2:/);}
for(const props of[{custom:'Camp'},{br:{type:BR_PORTAL,end1:{dnum:0,dlevel:2},end2:{dnum:0,dlevel:3}}},{}]){await setup();remote(props);if(!Object.keys(props).length)game.dungeons[0].dunlev_ureached=2;assert.match((await menu()).text,/Level 2:/);}
await setup();entry({dnum:game.tutorial_dnum,dlevel:1},{custom:'Tutorial camp'});assert.doesNotMatch((await menu()).text,/The Tutorial/);game.u.uz={dnum:game.tutorial_dnum,dlevel:1};entry({dnum:game.tutorial_dnum,dlevel:2});assert.match((await menu()).text,/Level 2:/);assert.doesNotMatch((await menu()).text,/Dungeons of Doom/);
for(const solved of[false,true]){await setup();entry({dnum:game.sokoban_dnum,dlevel:2},{flags:{sokosolved:solved}});assert.equal((await menu()).text.includes('Sokoban:'),!solved);game.u.uz={dnum:game.sokoban_dnum,dlevel:1};entry();assert.match((await menu()).text,/Sokoban:/);}

// Final traversal lists all known levels, planes first only while in the
// endgame. A forgotten entry retains its title but hides the details.
await setup();remote({flags:{forgot:true,oracle:true},feat:{nfount:1},final_resting_place:{who:'Old hero',how:'killed by a rat',bonesknown:true}});const forgotten=(await menu(1,QUIT)).text;assert.match(forgotten,/Level 2:/);assert.doesNotMatch(forgotten,/fountain|Oracle|Old hero/);
await setup();entry(game.astral_level);entry(game.earth_level);assert.doesNotMatch((await menu(1,QUIT)).text,/Elemental Planes/);game.u.uz={...game.earth_level};assert.doesNotMatch((await menu()).text,/Dungeons of Doom/);const final=(await menu(1,QUIT)).text;assert.ok(final.indexOf('Elemental Planes')<final.indexOf('Dungeons of Doom'));assert.ok(final.indexOf('Astral Plane:')<final.indexOf('Plane of Earth:'));
for(const [why,reason,marker,resting]of[[0,0,'are',false],[-1,0,'are',false],[1,QUIT,'were',false],[1,ESCAPED,'left from',false],[1,ASCENDED,'are',false],[2,DIED,'were',true]]){
    await setup();game.killer={name:'killed himself with his spell',format:2};const {text}=await menu(why,reason,why===-1?'\x1b':' ');assert.ok(text.includes(`You ${marker} here.`));assert.equal(text.includes('Final resting place for'),resting);if(resting)assert.match(text,/you, killed yourself with your spell\./);
}

// Bones disclosure uses known entries during normal play and all entries
// for a wizard or final disclosure, with punctuation after the last entry.
for(const [known,wizard,why,visible]of[[false,false,0,false],[true,false,0,true],[false,true,0,true],[false,false,1,true]]){
    await setup();game.wizard=wizard;remote({flags:{knownbones:known},final_resting_place:{who:'Old hero',how:'killed by a rat',bonesknown:known}});const {text}=await menu(why,QUIT);assert.equal(text.includes('Old hero, killed by a rat.'),visible);
}
await setup();remote({custom:'Camp',final_resting_place:{who:'Hidden',how:'killed by a rat',bonesknown:false,next:{who:'Known',how:'killed by a fox',bonesknown:true}}});assert.match((await menu()).text,/Known, killed by a fox\./);assert.doesNotMatch((await menu()).text,/Hidden/);
await setup();entry(game.u.uz,{final_resting_place:{who:'Old hero',how:'killed by a rat',bonesknown:true,next:{who:'Older hero',how:'killed by a fox',bonesknown:false}}});game.killer={name:'a test',format:2};const dead=(await menu(2,DIED)).text;assert.match(dead,/you, a test,\n.*Old hero, killed by a rat,\n.*Older hero, killed by a fox\./);

// Branch wording, sealed Quest portals, and upward target depths.
for(const [type,up,want]of[[BR_PORTAL,false,'Portal'],[BR_NO_END1,false,'Connection'],[BR_NO_END2,false,'One way stairs down'],[BR_NO_END2,true,'One way stairs up'],[BR_STAIR,false,'Stairs down'],[BR_STAIR,true,'Stairs up'],[99,false,'(unknown)']]){
    await setup();remote({br:{type,end1_up:up,end1:{dnum:0,dlevel:2},end2:game.qstart_level}});const {text}=await menu();assert.ok(text.includes(`${want} to The Quest${up?', level '+depth(game.qstart_level):''}.`));
}
await setup();game.u.uevent.qexpelled=true;remote({br:{type:BR_PORTAL,end1:{dnum:0,dlevel:2},end2:game.qstart_level}});assert.match((await menu()).text,/Sealed portal to The Quest\./);
await setup();remote({br:{type:BR_STAIR,end1_up:true,end1:{dnum:0,dlevel:2},end2:game.earth_level}});assert.match((await menu()).text,/Stairs up to The Elemental Planes\./);
console.log(`${groups} constructed groups PASS`);
