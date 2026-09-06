#!/usr/bin/env node
// Native observations and C-derived state controls. Constructed states earn no C coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {GameMap} from '../js/game.js';
import {InMemoryStorage} from '../js/storage.js';
import {gamestate_encode,gamestate_decode,dosave0,dorecover} from '../js/save.js';
import {decodeScreen} from './gen-sessions/screen-decode.mjs';
import {resetInputState,pushKeys} from '../js/input.js';
import {initRng} from '../js/rng.js';
import {lev_by_name,depth,init_mapseen,recalc_mapseen,update_lastseentyp} from '../js/dungeon.js';
import {magic_map_background} from '../js/display.js';
import {show_map_spot} from '../js/detect.js';
import {donamelevel} from '../js/do_name.js';
import {cmap_names} from '../js/drawing_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {Upolyd,OBJ_INVENT,OBJ_FLOOR,OBJ_MINVENT,OBJ_CONTAINED,OROOM,ROOM,STONE,FOUNTAIN,SINK,THRONE,GRAVE,TREE,ALTAR,DBWALL,DRAWBRIDGE_DOWN,DRAWBRIDGE_UP,DB_MOAT,MOAT,AM_NEUTRAL,AM_LAWFUL,AM_CHAOTIC,SVALL,M_AP_FURNITURE,SHOPBASE,TEMPLE,DELPHI,ROOMOFFSET,VIBRATING_SQUARE,IN_SIGHT} from '../js/const.js';

const names=['level-names','level-annotations','level-visits','map-knowledge','level-name-save'];
const read=(part,name)=>JSON.parse(fs.readFileSync(new URL('gen-sessions/'+part+'/'+name+'.json',import.meta.url)));
let nativeReplays=0,inventoryObservations=0,featureObservations=0,restoreObservations=0,nameObservations=0;
for(const name of names){
 const recipe=read('recipes',name),native=read('generated',name+'.session'),storage=new InMemoryStorage();
 for(const[i,s]of recipe.segments.entries()){
  const label=name+':'+s.name,oracle=native.segments[i];
  const saved=storage.getItem('save:'+(name==='level-name-save'&&i>=6?'Silko':'wizard'));
  const snapshot=saved?gamestate_decode(JSON.parse(saved)):null;
  const requestStart=Math.max(s.moves.lastIndexOf('\x16'),s.moves.lastIndexOf('rc '));
  const requestEnd=requestStart<0?-1:s.moves.indexOf('\r',requestStart+1);
  const request=requestEnd<0?'':s.moves.slice(requestStart+(s.moves[requestStart]==='\x16'?1:3),requestEnd);
  let observedName=false;
  if(/^[a-z]/i.test(request))globalThis.__step_snapshot={step:requestEnd,cb:()=>{
   const response=decodeScreen(oracle.steps[requestEnd+1].screen)[0];
   assert.equal(lev_by_name(request)!==0,!response.startsWith('To what level do you want to teleport?'),label+': C accepted named destination');
   observedName=true;nameObservations++;
  }};
  try{await runSegment({...s,storage});}finally{delete globalThis.__step_snapshot;}nativeReplays++;
  if(/^[a-z]/i.test(request))assert.ok(observedName,label+': named lookup observed');
  assert.deepEqual(game.impossible_log||[],[],label);assert.deepEqual(game.rc.errors,[],label);
  const final=decodeScreen(oracle.steps.at(-1).screen).join('\n'),hp=final.match(/HP:(\d+)\(\d+\)/);
  if(hp)assert.equal(Math.max(0,Upolyd(game.u)?game.u.mh:game.u.uhp),+hp[1],label+': native hero HP');
  const dlvl=final.match(/Dlvl:(\d+)/);if(dlvl)assert.equal(depth(game.u.uz),+dlvl[1],label+': native depth');
  const home=final.match(/Home:(\d+)/);if(home)assert.equal(game.u.uz.dlevel,+home[1],label+': native quest depth');
  const inventory=s.moves.lastIndexOf('i ')+1;
  if(inventory>0){const expected=new Map();for(const t of oracle.steps.slice(inventory))for(const row of decodeScreen(t.screen)){const m=row.match(/ ([$a-zA-Z]) [^\s] ((?:\d+|an?|the)\b.*)/);if(m)expected.set(m[1],/^\d+/.test(m[2])?parseInt(m[2],10):1);}assert.deepEqual((game.invent||[]).map(o=>[o.invlet,o.quan]).sort(),[...expected].sort(),label+': native inventory');inventoryObservations+=expected.size;}
  const seen=new Set();function walk(list,where,parent){for(const o of list||[]){assert.ok(!seen.has(o.o_id),label+': duplicate ownership');seen.add(o.o_id);assert.equal(o.where,where,label);if(where===OBJ_CONTAINED)assert.equal(o.ocontainer,parent,label);if(where===OBJ_MINVENT)assert.equal(o.ocarry,parent,label);walk(o.cobj,OBJ_CONTAINED,o);}}
  walk(game.invent,OBJ_INVENT);walk(game.level.objects,OBJ_FLOOR);for(const mon of game.level.monsters)walk(mon.minvent,OBJ_MINVENT,mon);
  const m=game.mapseen[`${game.u.uz.dnum}:${game.u.uz.dlevel}`],overview=s.moves.lastIndexOf('#overview\r');
  if(overview>=0){const rows=decodeScreen(oracle.steps[overview+10].screen),here=rows.find(row=>row.includes('<- You are here.'));assert.ok(here,label);assert.equal(m.custom||'',here.match(/"(.*)"/)?.[1]||'',label+': native annotation');
   if(name==='map-knowledge'){const text=rows.slice(0,rows.findIndex(row=>row.includes('(end)'))).join(' ').toLowerCase();for(const[field,word]of Object.entries({nfount:'fountain',nsink:'sink',nthrone:'throne',ngrave:'grave',ntree:'tree',naltar:'altar'})){const a=text.match(new RegExp('\\b(a|an|some|many) '+word+'s?\\b'));assert.equal(m.feat[field],a?({a:1,an:1,some:2,many:3}[a[1]]):0,label+': native '+field);featureObservations++;}}
  }
  if(name==='level-name-save'){
   if(snapshot){assert.deepEqual([game.quest_ldrgend,game.quest_nemgend],[snapshot.quest_ldrgend,snapshot.quest_nemgend],label+': saved quest genders');restoreObservations++;}
   if(s.name==='debug-restore-keep'){assert.ok(storage.getItem('save:wizard'),label);const kept=gamestate_decode(JSON.parse(storage.getItem('save:wizard')));assert.equal(kept.mapseen['0:1'].custom,'Base camp');assert.equal(m.custom,'Temporary camp');assert.equal(game.wizard,true);}
   if(s.name==='explore-restore-delete'){assert.equal(storage.getItem('save:wizard'),null);assert.equal(game.discover,true);assert.equal(game.wizard,false);assert.ok(game.visited_ledgers.has('0:1'));assert.equal(lev_by_name('Base camp'),1);}
   if(s.name==='fresh-after-delete'){assert.equal(game.u.ulevel,1);assert.equal(m.custom,undefined);}
   if(s.name.startsWith('deferred-explore-')){assert.equal(!!game.discover,s.name.endsWith('-y'));assert.equal(storage.getItem('save:Silko'),null);}
  }
 }
}
assert.equal(nativeReplays,103);assert.equal(featureObservations,180);assert.equal(restoreObservations,5);
console.log(`${nativeReplays} native replays, ${inventoryObservations} inventory, ${featureObservations} feature, ${restoreObservations} restore, ${nameObservations} name observations PASS`);

const base=read('recipes','level-names').segments[0],pre=base.moves.slice(0,base.moves.lastIndexOf('\x16'));
let groups=0;
async function setup(){
 resetInputState();await runSegment({...base,moves:pre,storage:new InMemoryStorage()});game.level=new GameMap();game.mapseen={};game.u.ux=40;game.u.uy=10;game.u.urooms='';game.u.uz={dnum:0,dlevel:1};game.u.ublind=false;game.u.intrinsic.HLevitation=0;game.quest_status={};game.u.uevent={};game._preNhgetchHook=null;game._toplin=0;game._pending_message='';game._win_stop=false;resetInputState();pushKeys(' '.repeat(100));init_mapseen(game.u.uz);groups++;
}
const mseen=()=>game.mapseen[`${game.u.uz.dnum}:${game.u.uz.dlevel}`];
function at(typ,x=10,y=10,remembered=typ){const loc=game.level.at(x,y);Object.assign(loc,{typ,lastseentyp:remembered,seenv:SVALL});return loc;}
function visit(lev){game.visited_ledgers.add(`${lev.dnum}:${lev.dlevel}`);}
function relocate(lev){game.u.uz={...lev};init_mapseen(lev);}

// Named lookup gives custom labels priority before normalization, and follows
// the C chain's sorted order when two levels have the same label.
await setup();game.wizard=false;game.visited_ledgers=new Set();mseen().custom='oracle';assert.equal(lev_by_name('oracle'),0);visit(game.u.uz);assert.equal(lev_by_name('ORACLE'),1);mseen().custom='the oracle level';assert.equal(lev_by_name('the oracle level'),1);assert.equal(lev_by_name('oracle'),0);
await setup();game.wizard=true;const oracle=game.sp_levchn.find(s=>s.proto==='oracle').dlevel;for(const name of['oracle','delphi','the Delphi level'])assert.equal(lev_by_name(name),depth(oracle));assert.equal(lev_by_name('oracle level level'),0);assert.equal(lev_by_name('not a level'),0);
await setup();game.mapseen={'0:2':{dnum:0,dlevel:2,custom:'Camp'},'0:1':{dnum:0,dlevel:1,custom:'camp'}};assert.equal(lev_by_name('CAMP'),1);
for(const [a,b,want]of[[false,false,0],[true,false,0],[false,true,0],[true,true,2]]){
 await setup();game.wizard=false;game.visited_ledgers=new Set();const branch=game.branches.find(b=>game.dungeons[b.end2.dnum].dname==='The Gnomish Mines');if(a)visit(branch.end1);if(b)visit(branch.end2);assert.equal(lev_by_name('stairs to Gnomish Mines'),want);relocate(branch.end2);assert.equal(lev_by_name('The Gnomish Mines'),a&&b?depth(branch.end2):0);assert.equal(lev_by_name('oracle'),0);
}
await setup();game.wizard=false;game.visited_ledgers=new Set();assert.equal(lev_by_name('Fort Ludios'),0);
await setup();game.wizard=true;relocate(game.valley_level);assert.equal(lev_by_name('oracle'),depth(game.sp_levchn.find(s=>s.proto==='oracle').dlevel));
await setup();game.wizard=true;relocate({dnum:game.tower_dnum,dlevel:1});const tower=game.branches.find(b=>b.end2.dnum===game.tower_dnum);assert.equal(lev_by_name('hell'),depth(tower.end2));assert.equal(lev_by_name('gehennom'),depth(tower.end2));

// Edits are visible immediately; saving preserves both names and VISITED.
await setup();resetInputState();pushKeys('New camp\r');await donamelevel();assert.equal(mseen().custom,'New camp');resetInputState();pushKeys('   \r');await donamelevel();assert.equal(mseen().custom,null);
await setup();game.visited_ledgers=new Set();mseen().custom='Saved camp';assert.equal(dosave0(),true);assert.ok(game.visited_ledgers.has('0:1'));const snap=gamestate_decode(gamestate_encode(game));assert.ok(snap.visited_ledgers instanceof Set);assert.equal(snap.mapseen['0:1'].custom,'Saved camp');game.mapseen={};assert.equal(dorecover(),true);assert.equal(lev_by_name('Saved camp'),1);
for(const gender of[0,1]){await setup();game.quest_nemgend=gender;assert.equal(dosave0(),true);initRng(1);assert.equal(dorecover(),true);assert.equal(game.quest_nemgend,gender,'saved quest gender overrides fresh initialization');}

// Feature counters have two bits. Unknown or changed terrain must not replace
// remembered terrain, except for the square the hero can feel underfoot.
for(const[field,typ]of Object.entries({nfount:FOUNTAIN,nsink:SINK,nthrone:THRONE,ngrave:GRAVE,ntree:TREE,naltar:ALTAR}))for(const count of[0,1,2,3,4]){
 await setup();for(let i=0;i<count;i++)at(typ,10+i).altarmask=AM_NEUTRAL;recalc_mapseen();assert.equal(mseen().feat[field],Math.min(count,3));
}
await setup();at(ROOM,10,10,FOUNTAIN);at(FOUNTAIN,11,10,STONE);recalc_mapseen();assert.equal(mseen().feat.nfount,1);
for(const levitating of[false,true]){await setup();game.u.intrinsic.HLevitation=+levitating;at(FOUNTAIN,40,10,STONE);recalc_mapseen();assert.equal(mseen().feat.nfount,levitating?0:1);}
for(const[masks,want]of[[[AM_NEUTRAL],2],[[AM_LAWFUL],3],[[AM_CHAOTIC],1],[[0],0],[[AM_NEUTRAL,AM_NEUTRAL],2],[[AM_NEUTRAL,AM_LAWFUL],0]]){await setup();masks.forEach((mask,i)=>at(ALTAR,10+i).altarmask=mask);recalc_mapseen();assert.equal(mseen().feat.msalign,want);}
for(const seenv of[1,SVALL]){await setup();relocate({dnum:game.astral_level.dnum,dlevel:1});Object.assign(at(ALTAR),{altarmask:AM_LAWFUL,seenv});recalc_mapseen();assert.equal(mseen().feat.msalign,seenv===SVALL?3:0);}
for(const show of[0,1]){await setup();at(FOUNTAIN,10,10,STONE);magic_map_background(10,10,show);assert.equal(game.level.at(10,10).lastseentyp,FOUNTAIN);}
await setup();game.level.rooms=[{rtype:TEMPLE}];Object.assign(at(ROOM),{roomno:ROOMOFFSET});show_map_spot(10,10,false);assert.ok(game.level._mapseen_rooms.includes(0));assert.equal(mseen().feat.ntemple,1);
await setup();game.level.rooms=[{rtype:TEMPLE}];Object.assign(at(ROOM),{roomno:ROOMOFFSET});show_map_spot(10,10,true);assert.ok(!game.level._mapseen_rooms?.includes(0));
await setup();at(DRAWBRIDGE_UP).drawbridgemask=DB_MOAT;update_lastseentyp(10,10);assert.equal(game.level.at(10,10).lastseentyp,MOAT);
await setup();at(ROOM);game.level.monsters=[{m_id:1,mhp:5,mnum:P.PM_SMALL_MIMIC,data:game.mons[P.PM_SMALL_MIMIC],mx:10,my:10,m_ap_type:M_AP_FURNITURE,mappearance:cmap_names.S_fountain}];game.level.monAt=new Map([['10,10',game.level.monsters[0]]]);game.viz_array[10][10]=IN_SIGHT;update_lastseentyp(10,10);assert.equal(game.level.at(10,10).lastseentyp,FOUNTAIN);

// Room memory includes subrooms and missing attendants; leaving a room keeps
// the last attendance observation until it is entered again.
for(const typ of[SHOPBASE,TEMPLE]){await setup();game.level.rooms=[{rtype:typ}];game.u.urooms=String.fromCharCode(ROOMOFFSET);recalc_mapseen();assert.equal(mseen().msrooms[0].untended,true);assert.equal(mseen().feat[typ===SHOPBASE?'nshop':'ntemple'],1);if(typ===SHOPBASE)assert.equal(mseen().feat.shoptype,SHOPBASE-1);}
await setup();game.level.subrooms=[{roomnoidx:40,rtype:TEMPLE}];game.level._mapseen_rooms=[40];recalc_mapseen();assert.equal(mseen().feat.ntemple,1);
await setup();game.level.rooms=Array.from({length:4},()=>({rtype:TEMPLE}));game.level._mapseen_rooms=[0,1,2,3];recalc_mapseen();assert.equal(mseen().feat.ntemple,3);
await setup();game.level.rooms=[{rtype:OROOM,orig_rtype:DELPHI}];game.level._mapseen_rooms=[0];recalc_mapseen();assert.equal(mseen().flags.oracle,true);
for(const types of[[SHOPBASE,SHOPBASE],[SHOPBASE,SHOPBASE+1]]){await setup();game.level.rooms=types.map(rtype=>({rtype}));mseen().msrooms=types.map(()=>({seen:true,untended:false}));recalc_mapseen();assert.equal(mseen().feat.shoptype,types[0]===types[1]?SHOPBASE:0);}

// Resettable flags, retained discoveries, and cross-level annotations.
await setup();mseen().flags={notreachable:true,knownbones:true,oracle:true,castletune:true,castle:true,valley:true,forgot:true};recalc_mapseen();for(const f of['notreachable','knownbones','oracle','castletune','forgot'])assert.equal(mseen().flags[f],false);assert.equal(mseen().flags.castle,true);assert.equal(mseen().flags.valley,true);
for(const forgot of[false,true]){await setup();game.u.ublind=true;mseen().flags={bigroom:true,forgot};recalc_mapseen();assert.equal(mseen().flags.bigroom,!forgot);}
await setup();relocate(game.bigroom_level);recalc_mapseen();assert.equal(mseen().flags.bigroom,true);
await setup();relocate(game.rogue_level);recalc_mapseen();assert.equal(mseen().flags.roguelevel,true);
for(const rules of[false,true]){await setup();relocate({dnum:game.sokoban_dnum,dlevel:1});game.level.flags.sokoban_rules=rules;recalc_mapseen();assert.equal(mseen().flags.sokosolved,!rules);}
for(const typ of[DBWALL,DRAWBRIDGE_DOWN]){await setup();relocate(game.stronghold_level);at(typ);recalc_mapseen();assert.equal(mseen().flags.castle,true);assert.equal(mseen().flags.castletune,true);}
await setup();relocate(game.qstart_level);mseen().flags={notreachable:true};const other={dnum:game.u.uz.dnum,dlevel:2};init_mapseen(other);game.mapseen[`${other.dnum}:2`].flags={notreachable:true};game.quest_status.got_quest=true;recalc_mapseen();assert.equal(mseen().flags.questing,true);assert.equal(game.mapseen[`${other.dnum}:2`].flags.notreachable,false);
for(const stopped of['none','qcompleted','qexpelled','leader_is_dead']){await setup();const branch=game.branches.find(b=>game.dungeons[b.end2.dnum].dname==='The Quest');relocate(branch.end1);game.u.uevent.qcalled=true;if(stopped==='leader_is_dead')game.quest_status.leader_is_dead=true;else if(stopped!=='none')game.u.uevent[stopped]=true;recalc_mapseen();assert.equal(mseen().flags.quest_summons,stopped==='none');}
await setup();relocate(game.valley_level);at(ALTAR).altarmask=0;recalc_mapseen();assert.equal(mseen().flags.valley,true);at(ROOM);recalc_mapseen();assert.equal(mseen().flags.valley,true);
for(const known of[false,true]){await setup();relocate({dnum:game.sanctum_level.dnum,dlevel:game.sanctum_level.dlevel-1});game.level.traps=[{ttyp:VIBRATING_SQUARE,tseen:known}];recalc_mapseen();assert.equal(mseen().flags.vibrating_square,known);}
await setup();const invocation={dnum:game.sanctum_level.dnum,dlevel:game.sanctum_level.dlevel-1};relocate(invocation);recalc_mapseen();assert.equal(mseen().flags.vibrating_square,true);relocate(game.sanctum_level);at(ALTAR);recalc_mapseen();assert.equal(mseen().flags.msanctum,true);assert.equal(game.mapseen[`${invocation.dnum}:${invocation.dlevel}`].flags.vibrating_square,false);
await setup();game.level.bonesinfo={who:'Past hero',frpx:10,frpy:10,next:{who:'Other hero',frpx:11,frpy:10,next:null}};at(ROOM);recalc_mapseen();assert.notEqual(mseen().final_resting_place,game.level.bonesinfo);assert.notEqual(mseen().final_resting_place.next,game.level.bonesinfo.next);assert.equal(mseen().flags.knownbones,true);assert.equal(mseen().final_resting_place.bonesknown,true);assert.ok(!mseen().final_resting_place.next.bonesknown);game.level.bonesinfo.who='Changed';assert.equal(mseen().final_resting_place.who,'Past hero');
await setup();game.mapseen={};recalc_mapseen();assert.deepEqual(game.mapseen,{});
console.log(`${groups} constructed groups PASS`);
