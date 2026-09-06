#!/usr/bin/env node
// Source-derived state controls. Constructed states earn no native coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen} from './gen-sessions/screen-decode.mjs';
import {Upolyd,OBJ_CONTAINED} from '../js/const.js';
import {resetInputState,pushKeys} from '../js/input.js';
import {initRng,rn2,enableRngLog,getRngLog} from '../js/rng.js';
import {mksobj,place_object} from '../js/mkobj.js';
import {makemon} from '../js/makemon.js';
import {weight} from '../js/invent.js';
import {autokey,pick_lock,picklock,forcelock,doforce,doclose,reset_pick,picking_lock,picking_at,boxlock,doorlock,maybe_reset_pick} from '../js/lock.js';
import {maybe_absorb_item} from '../js/steal.js';
import {watch_on_duty,m_canseeu,can_ooze} from '../js/monmove.js';
import {cmdq_add_dir,cmdq_add_key,getdir,cmdq_pop} from '../js/cmd.js';
import {vision_recalc,unblock_point} from '../js/vision.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as N} from '../js/objects_data.js';
import {ART_MASTER_KEY_OF_THIEVERY as KEY} from '../js/artilist_data.js';
import {OBJ_FREE,OBJ_INVENT,OBJ_FLOOR,OBJ_MINVENT,ROOM,DOOR,D_LOCKED,D_CLOSED,D_TRAPPED,D_NODOOR,D_ISOPEN,D_BROKEN,D_WARNED,ECMD_OK,ECMD_TIME,CQ_CANNED,CQ_REPEAT,W_WEP,MM_NOMSG,A_STR,A_DEX,A_CON} from '../js/const.js';
// Messages and final inventory/HP are independent observations from C.
let nativeReplays=0,inventoryObservations=0,disarmObservations=0,absorptionObservations=0;
for(const name of ['lock-magic-key','lock-operations','lock-passage']){
 const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/'+name+'.json',import.meta.url)));
 const native=JSON.parse(fs.readFileSync(new URL('gen-sessions/generated/'+name+'.session.json',import.meta.url)));
 for(const [i,s] of recipe.segments.entries()){
  const oracle=native.segments[i],label=name+':'+s.name,messages=oracle.steps.map(t=>decodeScreen(t.screen).slice(0,2).join(' ')),observed=new Set();
  globalThis.__step_snapshot={step:'*',cb:(state,j)=>{
   const line=messages[j]||'',match=line.match(/The (door|box|chest) is still (un)?locked/);
   if(match&&!observed.has('disarm')){
    observed.add('disarm');const o=match[1]==='door'?state.xlock.door:state.xlock.box;assert.ok(o,label+': disarmed target');
    assert.equal(!!(match[1]==='door'?o.doormask&D_TRAPPED:o.otrapped),false,label+': native trap removed');
    assert.equal(!!(match[1]==='door'?o.doormask&D_LOCKED:o.olocked),!match[2],label+': native lock preserved');
    if(match[1]!=='door')assert.equal(o.tknown,0,label+': trap knowledge cleared');disarmObservations++;
   }
  }};
  try{await runSegment({...s,storage:new InMemoryStorage()});}finally{delete globalThis.__step_snapshot;}
  nativeReplays++;assert.deepEqual(game.impossible_log||[],[],label);assert.deepEqual(game.rc.errors,[],label);
  const last=decodeScreen(oracle.steps.at(-1).screen).join('\n'),hp=last.match(/HP:(\d+)\(\d+\)/);assert.ok(hp,label+': native HP');
  assert.equal(Math.max(0,Upolyd(game.u)?game.u.mh:game.u.uhp),Number(hp[1]),label+': native HP');
  const start=s.moves.lastIndexOf('i ')+1,expected=new Map();assert.ok(start>0,label+': inventory query');
  for(const t of oracle.steps.slice(start))for(const row of decodeScreen(t.screen)){
   const m=row.match(/ ([$a-zA-Z]) [^\s] ((?:\d+|an?|the)\b.*)/);if(m)expected.set(m[1],/^\d+/.test(m[2])?parseInt(m[2],10):1);
  }
  assert.deepEqual(game.invent.map(o=>[o.invlet,o.quan]).sort(),[...expected].sort(),label+': native inventory');inventoryObservations+=expected.size;
  const seen=new Set();function walk(list,where,parent){for(const o of list||[]){assert.ok(!seen.has(o.o_id),label+': duplicate ownership');seen.add(o.o_id);assert.equal(o.where,where,label);if(where===OBJ_CONTAINED)assert.equal(o.ocontainer,parent,label);if(where===OBJ_MINVENT)assert.equal(o.ocarry,parent,label);walk(o.cobj,OBJ_CONTAINED,o);}}
  walk(game.invent,OBJ_INVENT);walk(game.level.objects,OBJ_FLOOR);for(const m of game.level.monsters)walk(m.minvent,OBJ_MINVENT,m);
  if(messages.some(m=>/pulls your key away from you and absorbs it/.test(m))){
   if(messages.some(m=>/You kill the small mimic/.test(m))){assert.ok(messages.some(m=>/You see here a key/.test(m)),label+': native dropped key');assert.ok([...game.invent,...game.level.objects].some(o=>o.otyp===N.SKELETON_KEY),label+': absorbed key survives owner death');}
   else{const owner=game.level.monsters.find(m=>m.mnum===P.PM_SMALL_MIMIC&&m.minvent?.some(o=>o.otyp===N.SKELETON_KEY));assert.ok(owner,label+': native mimic owns key');assert.equal(owner.msleeping,0,label+': mimic woke');}
   absorptionObservations++;
  }
 }
}
assert.equal(nativeReplays,157);assert.equal(disarmObservations,6);assert.equal(absorptionObservations,2);
console.log(nativeReplays+' native replays, '+inventoryObservations+' inventory observations, '+disarmObservations+' disarms, '+absorptionObservations+' mimic acquisitions PASS');

const base=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/untrapping-floor.json',import.meta.url))).segments[0],pre=base.moves.slice(0,base.moves.indexOf('#untrap'));
let groups=0,snapshots=[];
const rows=()=>game.nhDisplay.grid.map(r=>r.map(c=>c.ch).join(''));
const text=()=>[...snapshots.flat(),...rows()].join('\n');
async function setup(keys='\x1b'){
 resetInputState();await runSegment({...base,moves:pre,storage:new InMemoryStorage()});
 game.invent=[];game.level.objects=[];game.level.monsters=[];game.level.monAt=new Map();game.level.traps=[];
 for(let x=game.u.ux-1;x<=game.u.ux+1;x++)for(let y=game.u.uy-1;y<=game.u.uy+1;y++){game.level.at(x,y).typ=ROOM;unblock_point(x,y);}
 game.u.dx=1;game.u.dy=game.u.dz=0;game.flags.autounlock=0;game.command_queue=[];game.in_doagain=false;game.occupation=null;reset_pick();
 game._toplin=0;game._pending_message='';game._win_stop=false;snapshots=[];
 game._preNhgetchHook=()=>snapshots.push(rows());resetInputState();pushKeys(keys+' '.repeat(150));vision_recalc(0);groups++;
}
function item(type=N.SKELETON_KEY,fields={},floor=false){const o=Object.assign(mksobj(type,false,false),{quan:1,invlet:'b',where:OBJ_FREE,bknown:1,cobj:[]},fields);o.owt=weight(o);if(floor)place_object(o,game.u.ux,game.u.uy);else{o.where=OBJ_INVENT;game.invent.push(o);}return o;}
function box(fields={}){return item(N.LARGE_BOX,{olocked:1,...fields},true);}
function door(mask=D_LOCKED){const d=game.level.at(game.u.ux+game.u.dx,game.u.uy+game.u.dy);d.typ=DOOR;d.doormask=mask;return d;}
function form(type){game.youmonst.data=game.mons[type];game.u.umonnum=type;}
async function mon(type=P.PM_SMALL_MIMIC,fields={}){const m=await makemon(game.mons[type],game.u.ux,game.u.uy-1,MM_NOMSG);Object.assign(m,{mpeaceful:1,mcansee:1},fields);return m;}
function seed(n=1){initRng(n);enableRngLog();}
const calls=()=>getRngLog().map(s=>s.split('=')[0]);
function findSeed(bound,predicate){for(let n=1;n<10000;n++){initRng(n);if(predicate(rn2(bound)))return n;}throw Error('seed search');}

// Tool selection prefers ordinary tools over another role's quest artifact.
for(const role of [P.PM_WIZARD,P.PM_ROGUE])for(const buc of ['blessed','uncursed','cursed']){
 await setup();game.urole={...game.urole,mnum:role,questarti:role===P.PM_ROGUE?KEY:game.urole.questarti};const k=item(N.SKELETON_KEY,{oartifact:KEY,blessed:buc==='blessed',cursed:buc==='cursed'}),p=item(N.LOCK_PICK,{invlet:'c'}),c=item(N.CREDIT_CARD,{invlet:'d'});
 assert.equal(autokey(true),role===P.PM_ROGUE?k:p);assert.equal(autokey(false),role===P.PM_ROGUE?k:p);
 game.invent=[k,c];assert.equal(autokey(true),role===P.PM_ROGUE?k:c);assert.equal(autokey(false),k);
 game.invent=[c];assert.equal(autokey(false),null);
}
await setup();game.urole={...game.urole,mnum:P.PM_ROGUE,questarti:KEY};const key1=item(),magic=item(N.SKELETON_KEY,{oartifact:KEY}),key2=item();assert.equal(autokey(true),magic);magic.cursed=1;assert.equal(autokey(true),key1);game.invent=[key2,key1];assert.equal(autokey(true),key2);

// Interrupted lock occupations recheck hands, reach, and the current tool.
for(const condition of ['nohands','swallowed','levitation','normal']){
 await setup();const b=box(),k=item();Object.assign(game.xlock,{box:b,usedtime:2,picktyp:N.SKELETON_KEY,chance:70});
 if(condition==='nohands')form(P.PM_FOG_CLOUD);if(condition==='swallowed')game.u.uswallow=1;if(condition==='levitation')game.u.intrinsic.HLevitation=10;
 seed();assert.equal(await pick_lock(k,0,0,null),condition==='normal'?1:-1);assert.deepEqual(calls(),[]);
 if(condition==='normal')assert.equal(game.occupation,picklock);else{assert.equal(game.xlock.box,null);assert.equal(game.xlock.usedtime,0);assert.match(text(),/no longer (hold|reach)/);}
}
for(const target of ['box','door'])for(const condition of ['moved','nohands','timeout','failure']){
 await setup();const b=target==='box'?box():null,d=target==='door'?door():null;Object.assign(game.xlock,{box:b,door:d,usedtime:condition==='timeout'?50:0,picktyp:N.LOCK_PICK,chance:0});
 if(condition==='moved'){if(b)b.where=OBJ_INVENT;else game.u.dx=0;}if(condition==='nohands')form(P.PM_FOG_CLOUD);
 seed();assert.equal(await picklock(),condition==='failure'?1:0);assert.equal(game.xlock.usedtime,condition==='failure'?1:0);
 assert.equal(b?b.olocked:!!(d.doormask&D_LOCKED),b?1:true);if(condition==='moved')assert.deepEqual(calls(),[]);
}
for(const kind of ['box','chest','door'])for(const locked of [false,true])for(const answer of ['y','n']){
 await setup(kind==='door'?answer:' '+answer);const b=kind==='door'?null:box({otyp:kind==='chest'?N.CHEST:N.LARGE_BOX,olocked:+locked,otrapped:1,tknown:0}),d=kind==='door'?door((locked?D_LOCKED:D_CLOSED)|D_TRAPPED):null;
 Object.assign(game.xlock,{box:b,door:d,usedtime:0,picktyp:N.SKELETON_KEY,chance:100,magic_key:true});seed();assert.equal(await picklock(),0);assert.equal(game.xlock.chance,120);assert.equal(game.xlock.usedtime,0);
 assert.equal(!!(b?b.olocked:d.doormask&D_LOCKED),locked);assert.equal(!!(b?b.otrapped:d.doormask&D_TRAPPED),answer==='n');if(b)assert.equal(!!b.tknown,answer==='n');
 assert.match(text(),answer==='y'?new RegExp('The '+kind+' is still '+(locked?'':'un')+'locked'):/You stop/);
}
await setup();const lockedBox=box();Object.assign(game.xlock,{box:lockedBox,usedtime:0,picktyp:N.SKELETON_KEY,chance:100});seed();await picklock();assert.equal(!!lockedBox.olocked,false);assert.equal(lockedBox.lknown,1);
for(const mask of [D_NODOOR,D_ISOPEN,D_BROKEN]){await setup();const d=door(mask);Object.assign(game.xlock,{door:d,usedtime:3,picktyp:N.SKELETON_KEY,chance:100});seed();assert.equal(await picklock(),0);assert.deepEqual(calls(),[]);assert.equal(d.doormask,mask);}

// Forcing cannot continue without hands or a weapon. Existing erosion still
// weakens a proofed blade, as it does in C's greatest_erosion macro.
for(const condition of ['nohands','no-weapon','timeout','erosion-proof']){
 await setup();const b=box();game.u.uwep=item(N.DAGGER,{owornmask:W_WEP,oerodeproof:1,oeroded:2,spe:0});Object.assign(game.xlock,{box:b,usedtime:condition==='timeout'?50:1,picktyp:1,chance:0});
 if(condition==='nohands')form(P.PM_FOG_CLOUD);if(condition==='no-weapon')game.u.uwep=null;
 seed(condition==='erosion-proof'?findSeed(1000,n=>n>972&&n<=992):1);assert.equal(await forcelock(),0);assert.equal(game.xlock.usedtime,0);assert.equal(b.olocked,1);
 if(condition==='erosion-proof'){assert.equal(game.u.uwep,null);assert.match(text(),/dagger broke/);}else if(condition!=='timeout')assert.deepEqual(calls(),[]);
}
await setup();game.u.uwep=item(N.LONG_SWORD,{owornmask:W_WEP});game.u.intrinsic.HLevitation=10;seed();assert.equal(await doforce(),ECMD_OK);assert.deepEqual(calls(),[]);assert.match(text(),/can't reach/);

// C truncates the average before comparing it to the closing roll.
await setup('l');const openDoor=door(D_ISOPEN);for(const [a,n]of [[A_STR,10],[A_DEX,10],[A_CON,11]])game.u.acurr.a[a]=n;
seed(findSeed(25,n=>n===10));assert.equal(await doclose(),ECMD_TIME);assert.equal(openDoor.doormask,D_ISOPEN);assert.match(text(),/door resists/);

// A mimic acquires the same object and ownership, including wielded items.
for(const condition of ['visible','blind','wielded','rock','ball','chain','resisted']){
 await setup();const m=await mon(),o=item(condition==='rock'?N.BOULDER:condition==='ball'?N.HEAVY_IRON_BALL:condition==='chain'?N.IRON_CHAIN:N.SKELETON_KEY);
 if(condition==='blind'){game.u.ublind=1;vision_recalc(0);}if(condition==='wielded'){o.owornmask=W_WEP;game.u.uwep=o;}if(condition==='ball')game.u.uball=o;if(condition==='chain')game.u.uchain=o;
 seed();await maybe_absorb_item(m,o,condition==='resisted'?0:100,100);const blocked=['rock','ball','chain','resisted'].includes(condition);
 assert.equal(game.invent.includes(o),blocked);assert.equal(o.where,blocked?OBJ_INVENT:OBJ_MINVENT);if(!blocked){assert.equal(o.ocarry,m);assert.ok(m.minvent.includes(o));if(condition==='wielded'){assert.equal(game.u.uwep,null);assert.equal(o.owornmask,0);}assert.match(text(),condition==='blind'?/pulled from your hand/:/absorbs it/);}
}

// Direction queue entries are consumed without a live prompt or repeat entry.
for(const [dx,dy,dz] of [[1,0,0],[-1,1,0],[0,0,1],[0,0,-1]]){
 await setup();cmdq_add_dir(CQ_CANNED,dx,dy,dz);seed();assert.equal(await getdir(null),true);assert.deepEqual([game.u.dx,game.u.dy,game.u.dz],[dx,dy,dz]);assert.equal(cmdq_pop(),null);assert.ok(!game.command_queue[CQ_REPEAT]?.length);assert.deepEqual(calls(),[]);assert.ok(!text().includes('In what direction?'));
}
await setup();cmdq_add_key(CQ_CANNED,'u');form(P.PM_GRID_BUG);seed();assert.equal(await getdir(null),false);assert.deepEqual([game.u.dx,game.u.dy],[0,0]);assert.match(text(),/orient yourself/);

// Occupation identity drives both cancellation by magic and town warnings.
await setup();const cc={x:9,y:9};assert.equal(picking_lock(cc),false);assert.deepEqual(cc,{x:0,y:0});const d=door();game.occupation=picklock;game.xlock.door=d;assert.equal(picking_lock(cc),true);assert.equal(picking_at(cc.x,cc.y),true);game.occtxt='unlocking the door';await doorlock(item(N.WAN_OPENING),cc.x,cc.y);assert.equal(game.occupation,null);assert.equal(game.xlock.door,null);assert.equal(d.doormask,D_CLOSED);
await setup();const b=box();game.xlock.box=b;game.xlock.usedtime=5;boxlock(b,item(N.WAN_POLYMORPH));assert.equal(game.xlock.box,null);game.xlock.box=b;b.where=OBJ_INVENT;maybe_reset_pick(null);assert.equal(game.xlock.box,b);maybe_reset_pick(b);assert.equal(game.xlock.box,null);
for(const warned of [false,true]){
 await setup();game.level.flags.has_town=true;game.level.rooms=[];const d=door();d.looted=warned?D_WARNED:0;game.xlock.door=d;game.occupation=picklock;game.occtxt='unlocking the door';const m=await mon(P.PM_WATCHMAN);vision_recalc(0);assert.ok(m_canseeu(m),JSON.stringify({x:m.mx,y:m.my,ux:game.u.ux,uy:game.u.uy,blind:game.u.ublind,invis:game.u.uprops?.INVIS,underwater:game.u.uinwater,uinvis:game.u.intrinsic?.HInvis}));seed(findSeed(3,n=>n===0));await watch_on_duty(m);assert.equal(game.occupation,null);assert.ok(d.looted&D_WARNED);assert.equal(!!m.mpeaceful,!warned);assert.match(text(),warned?/under arrest/:/stop picking that lock/);
}
// The hero's own inventory, including container contents, can block ooze.
for(const kind of ['empty','key','sword','empty-sack','full-sack']){
 await setup();form(P.PM_FOG_CLOUD);
 if(kind==='key')item();if(kind==='sword')item(N.LONG_SWORD);
 if(kind.includes('sack')){const sack=item(N.SACK);if(kind==='full-sack'){const apple=item(N.APPLE);game.invent=game.invent.filter(o=>o!==apple);apple.where=OBJ_CONTAINED;apple.ocontainer=sack;sack.cobj=[apple];}}
 seed();assert.equal(can_ooze(game.youmonst),!['sword','full-sack'].includes(kind),kind);assert.deepEqual(calls(),[]);
}
for(const kind of ['invisible','underwater']){
 await setup();game.level.flags.has_town=true;game.level.rooms=[];game.xlock.door=door();game.occupation=picklock;const guard=await mon(P.PM_WATCHMAN);vision_recalc(0);assert.ok(m_canseeu(guard));
 if(kind==='invisible')game.u.intrinsic.HInvis=10;else game.u.uinwater=1;
 seed();assert.equal(m_canseeu(guard),false,kind);await watch_on_duty(guard);assert.equal(game.occupation,picklock);assert.deepEqual(calls(),[]);
}
console.log(groups+' constructed groups PASS');
