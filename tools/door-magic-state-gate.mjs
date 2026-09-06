#!/usr/bin/env node
// C-observed state and source-derived controls. Constructed states earn no C coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen} from './gen-sessions/screen-decode.mjs';
import {resetInputState,pushKeys} from '../js/input.js';
import {initRng,rnd} from '../js/rng.js';
import {doorlock,boxlock,reset_pick} from '../js/lock.js';
import {mb_trapped} from '../js/monmove.js';
import {makemon} from '../js/makemon.js';
import {mksobj,place_object} from '../js/mkobj.js';
import {bot_conditions} from '../js/botl.js';
import {pline,pline_nohistory,pline_nohistory_no_cursor,urgent_pline} from '../js/display.js';
import {set_msg_xy,Norep} from '../js/pline.js';
import {parseoptions,handler_whatis_coord} from '../js/options.js';
import {vision_recalc,unblock_point} from '../js/vision.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as N} from '../js/objects_data.js';
import {Upolyd,OBJ_INVENT,OBJ_FLOOR,OBJ_MINVENT,OBJ_CONTAINED,OBJ_FREE,ROOM,DOOR,SDOOR,D_ISOPEN,D_CLOSED,D_LOCKED,D_BROKEN,D_NODOOR,D_TRAPPED,TRAPPED_DOOR,MM_NOMSG,M_AP_OBJECT,M_AP_FURNITURE} from '../js/const.js';
const names=['door-magic','door-magic-town','door-magic-monsters','message-locations','door-magic-obstructions','eyewear-feedback'];
let nativeReplays=0,inventoryObservations=0,healthObservations=0,feedbackObservations=0;
for(const name of names){
 const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/'+name+'.json',import.meta.url))),native=JSON.parse(fs.readFileSync(new URL('gen-sessions/generated/'+name+'.session.json',import.meta.url)));
 for(const[i,s]of recipe.segments.entries()){
  const label=name+':'+s.name,oracle=native.segments[i],messages=oracle.steps.map(t=>decodeScreen(t.screen).slice(0,2).map(s=>s.trim()).join(' ')),observed=new Set();
  globalThis.__step_snapshot={step:'*',cb:(state,j)=>{
   const text=messages[j]||'',m=text.match(/Status of the (xorn|black pudding|small mimic) .*Level (\d+)\s+HP (\d+)\((\d+)\)/);
   if(m&&!observed.has('health')){
    const type={xorn:P.PM_XORN,'black pudding':P.PM_BLACK_PUDDING,'small mimic':P.PM_SMALL_MIMIC}[m[1]],mon=state.level.monsters.find(o=>o.mnum===type&&o.mhp>0);
    assert.ok(mon,label+': native surviving monster');assert.equal(mon.m_lev,+m[2],label);assert.equal(mon.mhp,+m[3],label+': native HP');assert.equal(mon.mhpmax,+m[4],label+': native max HP');assert.equal(!!mon.mstun,text.includes(', stunned'),label+': native stun');healthObservations++;observed.add('health');
   }
  }};
  let result;try{result=await runSegment({...s,storage:new InMemoryStorage()});}finally{delete globalThis.__step_snapshot;}
  nativeReplays++;assert.deepEqual(game.impossible_log||[],[],label);assert.deepEqual(game.rc.errors,[],label);
  const final=decodeScreen(oracle.steps.at(-1).screen).join('\n'),hp=final.match(/HP:(\d+)\(\d+\)/);assert.ok(hp,label);assert.equal(Math.max(0,Upolyd(game.u)?game.u.mh:game.u.uhp),+hp[1],label+': hero HP');
  const start=s.moves.lastIndexOf('i ')+1,expected=new Map();assert.ok(start>0,label+': final inventory');
  for(const t of oracle.steps.slice(start))for(const row of decodeScreen(t.screen)){const m=row.match(/ ([$a-zA-Z]) [^\s] ((?:\d+|an?|the)\b.*)/);if(m)expected.set(m[1],/^\d+/.test(m[2])?parseInt(m[2],10):1);}
  assert.deepEqual(game.invent.map(o=>[o.invlet,o.quan]).sort(),[...expected].sort(),label+': native inventory');inventoryObservations+=expected.size;
  const seen=new Set();function walk(list,where,parent){for(const o of list||[]){assert.ok(!seen.has(o.o_id),label+': duplicate ownership');seen.add(o.o_id);assert.equal(o.where,where,label);if(where===OBJ_CONTAINED)assert.equal(o.ocontainer,parent,label);if(where===OBJ_MINVENT)assert.equal(o.ocarry,parent,label);walk(o.cobj,OBJ_CONTAINED,o);}}
  walk(game.invent,OBJ_INVENT);walk(game.level.objects,OBJ_FLOOR);for(const mon of game.level.monsters)walk(mon.minvent,OBJ_MINVENT,mon);
  for(const[j,text]of messages.entries())if(/^(?:You are now wearing|a - .*\(being worn\)\.|\([^)]*\):|<\d+,\d+>:|\[\d+,\d+\]:)|KABOOM|wakes up/.test(text)){
   assert.equal(decodeScreen(result.getScreens()[j]).slice(0,2).map(s=>s.trim()).join(' '),text,label+': native feedback step '+j);feedbackObservations++;
  }
 }
}
assert.equal(nativeReplays,174);assert.equal(healthObservations,3);assert.ok(feedbackObservations>0);
console.log(`${nativeReplays} native replays, ${inventoryObservations} inventory, ${healthObservations} monster health, ${feedbackObservations} feedback observations PASS`);

const base=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/untrapping-floor.json',import.meta.url))).segments[0],pre=base.moves.slice(0,base.moves.indexOf('#untrap'));
let groups=0;
async function setup(keys='\x1b'){
 resetInputState();await runSegment({...base,moves:pre,storage:new InMemoryStorage()});
 game.invent=[];game.level.objects=[];game.level.monsters=[];game.level.monAt=new Map();game.level.traps=[];game.occupation=null;reset_pick();game.flags.accessiblemsg=false;game.iflags.getpos_coords='n';
 for(let x=game.u.ux-1;x<=game.u.ux+1;x++)for(let y=game.u.uy-1;y<=game.u.uy+1;y++){game.level.at(x,y).typ=ROOM;unblock_point(x,y);}
 game.u.dx=1;game.u.dy=game.u.dz=0;game._toplin=0;game._pending_message='';game._win_stop=false;game._preNhgetchHook=null;game.a11y={msg_loc:{x:0,y:0}};resetInputState();pushKeys(keys+' '.repeat(120));vision_recalc(0);groups++;
}
const item=type=>Object.assign(mksobj(type,false,false),{quan:1,where:OBJ_FREE,cobj:[]});
const location=()=>[game.u.ux+1,game.u.uy];
function door(mask=D_ISOPEN,typ=DOOR){const d=game.level.at(...location());d.typ=typ;d.doormask=mask;return d;}
async function monster(fields={}){const m=await makemon(game.mons[P.PM_XORN],...location(),MM_NOMSG);Object.assign(m,{mhp:40,mhpmax:40,msleeping:0,mpeaceful:1,mtrapseen:0},fields);return m;}

// All four message paths consume a location once and use the selected formatter.
const labels={n:'(2north,3east)',c:'(2n,3e)',f:'(2north,3east)',m:'<43,8>',s:'[10,43]'};
for(const[mode,prefix]of Object.entries(labels))for(const print of [pline,pline_nohistory,pline_nohistory_no_cursor,urgent_pline]){
 await setup();game.u.ux=40;game.u.uy=10;game.flags.accessiblemsg=true;game.iflags.getpos_coords=mode;
 set_msg_xy(43,8);await print('An event.');assert.equal(game._prevmsg,prefix+': An event.');assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});await print('Another event.');assert.equal(game._prevmsg,'Another event.');
}
await setup();set_msg_xy(...location());await pline('Option off.');game.flags.accessiblemsg=true;await pline('Option on.');assert.equal(game._prevmsg,'Option on.');
await setup();game.flags.accessiblemsg=true;set_msg_xy(...location());await pline('');assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});await pline('After empty.');assert.equal(game._prevmsg,'After empty.');
await setup();game.flags.accessiblemsg=true;set_msg_xy(...location());await Norep('Repeated.');assert.equal(game._prevmsg,'(east): Repeated.');set_msg_xy(...location());await Norep('Repeated.');assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
for(const[option,want]of [['whatis_coord:none','n'],['whatis_coord:Compass','c'],['whatis_coord:full compass','f'],['whatis_coord:map','m'],['whatis_coord:screen','s'],['!whatis_coord','n'],['!whatis_coord:map','n']]){
 const r={opts:{getpos_coords:'s'},errors:[]};assert.equal(parseoptions(option,false,false,r),true);assert.equal(r.opts.getpos_coords,want);assert.deepEqual(r.errors,[]);groups++;
}
for(const option of ['whatis_coord:wrong','whatis_coord:','whatis_coord']){const r={opts:{getpos_coords:'s'},errors:[]};assert.equal(parseoptions(option,false,false,r),false);assert.equal(r.opts.getpos_coords,'s');groups++;}
for(const key of ['c','f','m','s','n','\x1b','\r']){await setup(key);await handler_whatis_coord();assert.equal(game.iflags.getpos_coords,'cfmsn'.includes(key)?key:'n');}
for(const source of ['none','intrinsic','extrinsic','conduct']){await setup();game.u.intrinsic.HDeaf=source==='intrinsic'?1:0;game.u.uprops.DEAF=source==='extrinsic'?1:0;game.u.uroleplay.deaf=source==='conduct';assert.equal(bot_conditions().includes(' Deaf'),source!=='none');}

// Lock effects preserve trapped state and expose their success/no-op returns.
for(const[typ,mask,wand,want,res]of [
 [DOOR,D_ISOPEN,N.WAN_LOCKING,D_LOCKED,true],
 [DOOR,D_CLOSED|D_TRAPPED,N.WAN_LOCKING,D_LOCKED|D_TRAPPED,true],
 [DOOR,D_BROKEN,N.WAN_LOCKING,D_LOCKED,true],
 [DOOR,D_NODOOR,N.WAN_LOCKING,D_LOCKED,true],
 [DOOR,D_LOCKED,N.WAN_LOCKING,D_LOCKED,false],
 [DOOR,D_LOCKED|D_TRAPPED,N.WAN_OPENING,D_CLOSED|D_TRAPPED,true],
 [DOOR,D_CLOSED,N.WAN_OPENING,D_CLOSED,false],
 [DOOR,D_CLOSED,N.WAN_STRIKING,D_BROKEN,true],
 [DOOR,D_CLOSED|D_TRAPPED,N.WAN_STRIKING,D_NODOOR,true],
 [SDOOR,D_LOCKED|D_TRAPPED,N.WAN_OPENING,D_CLOSED|D_TRAPPED,true],
 [SDOOR,D_LOCKED|D_TRAPPED,N.WAN_STRIKING,D_NODOOR,true],
 [SDOOR,D_NODOOR,N.WAN_LOCKING,D_NODOOR,false],
]){await setup();const d=door(mask,typ);assert.equal(await doorlock(item(wand),...location()),res);assert.equal(d.doormask,want);assert.equal(d.typ,typ===SDOOR&&wand===N.WAN_LOCKING?SDOOR:DOOR);}
for(const kind of ['object','monster','invisible','object-mimic','furniture-mimic'])for(const known of [false,true]){
 await setup();const d=door();
 if(kind==='object')place_object(item(N.ROCK),...location());else{await monster(kind==='invisible'?{minvis:1}:kind==='object-mimic'?{m_ap_type:M_AP_OBJECT,mappearance:N.ROCK}:kind==='furniture-mimic'?{m_ap_type:M_AP_FURNITURE}:{});}
 const wand=item(N.WAN_LOCKING);wand.dknown=+known;assert.equal(await doorlock(wand,...location()),kind==='furniture-mimic');assert.equal(d.doormask,kind==='furniture-mimic'?D_LOCKED:D_ISOPEN);
}
for(const wizard of [false,true])for(const locked of [false,true]){
 await setup();if(!wizard)game.urole={...game.urole,mnum:P.PM_ROGUE};const b=item(N.CHEST);Object.assign(b,{olocked:+locked,obroken:0,lknown:+!wizard});
 assert.equal(await boxlock(b,item(locked?N.WAN_OPENING:N.WAN_LOCKING)),1);assert.equal(!!b.olocked,!locked);assert.equal(!!b.lknown,wizard);
}
for(const hp of [1,40]){
 await setup();const m=await monster({mhp:hp});initRng(17);const damage=rnd(15);initRng(17);assert.equal(await mb_trapped(m,true),hp<=damage);assert.equal(m.mhp,Math.max(0,hp-damage));if(hp>damage){assert.equal(m.mstun,1);assert.ok(m.mtrapseen&(1<<(TRAPPED_DOOR-1)));}
}
console.log(`${groups} constructed groups PASS`);
