#!/usr/bin/env node

// Native observations and persistent-state controls for C untrapping.
// Constructed states earn no C reachability or coverage credit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen} from './gen-sessions/screen-decode.mjs';
import {PMNAMES as P} from '../js/monst_data.js';
import {OBJ_INVENT,OBJ_CONTAINED,OBJ_FLOOR,OBJ_MINVENT,Upolyd,OBJ_FREE,ROOM,STONE,DOOR,D_CLOSED,D_TRAPPED,BEAR_TRAP,WEB,LANDMINE,ARROW_TRAP,DART_TRAP,SQKY_BOARD,PIT,TT_WEB,W_WEP,W_SWAPWEP,ECMD_OK,ECMD_TIME,ECMD_CANCEL,A_LAWFUL,W_ARMG,MM_NOMSG,TIMEOUT,FROMOUTSIDE} from '../js/const.js';
import {resetInputState,pushKeys} from '../js/input.js';
import {initRng,rnd,enableRngLog,getRngLog} from '../js/rng.js';
import {mksobj,place_object,add_to_minv} from '../js/mkobj.js';
import {makemon} from '../js/makemon.js';
import {maketrap} from '../js/mklev.js';
import {t_at} from '../js/mon.js';
import {weight,GETOBJ_EXCLUDE,GETOBJ_SUGGEST,GETOBJ_DOWNPLAY} from '../js/invent.js';
import {untrap_prob,try_disarm,disarm_holdingtrap,disarm_landmine,disarm_shooting_trap,disarm_squeaky_board,unsqueak_ok,try_lift,help_monster_out,reward_untrap,untrap,dountrap,closeholdingtrap,set_utrap,reset_utrap,b_trapped,float_up} from '../js/trap.js';
import {invoke_untrap} from '../js/artifact.js';
import {bot_conditions} from '../js/botl.js';
import {Levitation,Flying} from '../js/youprop.js';
import {ONAMES as N} from '../js/objects_data.js';
import {ART_STING as STING,ART_FIRE_BRAND as FIRE} from '../js/artilist_data.js';
import {do_screen_description} from '../js/pager.js';
import {newsym} from '../js/display.js';
import {vision_recalc,unblock_point,cansee} from '../js/vision.js';

const cache=new Map();
function read(base,kind){const key=base+'.'+kind;if(!cache.has(key))cache.set(key,JSON.parse(fs.readFileSync(new URL('gen-sessions/'+(kind==='input'?'recipes/':'generated/')+base+(kind==='input'?'':'.session')+'.json',import.meta.url))).segments);return cache.get(key);}
let replays=0,hp=0,inventory=0,traps=0,monsters=0,mortality=0,charges=0;
for(const base of ['untrapping-floor','untrapping-containers','untrapping-doors','untrapping-tools','untrapping-rescue','untrapping-flight']){
 for(const [index,s] of read(base,'input').entries()){
 const native=read(base,'session')[index],name=base+':'+s.name;
 const observed=new Set();
 const messages=native.steps.map(t=>decodeScreen(t.screen).slice(0,2).join(' '));
 globalThis.__step_snapshot={step:'*',cb:(state,j)=>{
  const line=messages[j]||'';
  if(line.includes('while trapped')&&!observed.has('hero-trapped')){assert.ok(state.u.utrap,name+': native trapped refusal');observed.add('hero-trapped');traps++;}
  const rules=[[/You extract the (.*?) from (?:the|your) (?:bear trap|web)/,'free'],[/The (.*?) is grateful/,'grateful'],[/The (.*?) remains entangled/,'trapped'],[/The (.*?) is too heavy for you to lift/,'trapped'],[/You try to grab the (.*?), but cannot get a firm grasp/,'trapped']];
  for(const [pattern,kind] of rules){const m=line.match(pattern);if(!m)continue;const key=kind+':'+m[1];if(observed.has(key))continue;observed.add(key);
   const num=P['PM_'+m[1].replaceAll(' ','_').toUpperCase()];assert.ok(Number.isInteger(num),name+': native species '+m[1]);
   const mon=state.level.monsters.find(m=>m.mnum===num&&m.mhp>0);assert.ok(mon,name+': native captive exists');
   if(kind==='grateful')assert.equal(!!mon.mpeaceful,true,name+': gratitude');else assert.equal(!!mon.mtrapped,kind==='trapped',name+': captive state');monsters++;
  }
 }};
 try{await runSegment({...s,storage:new InMemoryStorage()});}finally{delete globalThis.__step_snapshot;}replays++;
 if(s.name==='repair-identified-oil')assert.ok(game.objects[N.POT_OIL].oc_name_known,name+': oil permanently identified');
 if(s.name==='repair-lit-oil')assert.ok(game.invent.some(o=>o.otyp===N.POT_OIL&&o.lamplit),name+': failed attempt leaves oil burning');
 assert.deepEqual(game.impossible_log||[],[],name);assert.deepEqual(game.rc.errors,[],name);
 const seen=new Set();
 function walk(list,where,parent){for(const o of list||[]){assert.ok(!seen.has(o.o_id),name+': duplicate object '+o.o_id);seen.add(o.o_id);assert.equal(o.where,where,name);if(where===OBJ_CONTAINED)assert.equal(o.ocontainer,parent,name);if(where===OBJ_MINVENT)assert.equal(o.ocarry,parent,name);walk(o.cobj,OBJ_CONTAINED,o);}}
 walk(game.invent,OBJ_INVENT);walk(game.level.objects,OBJ_FLOOR);for(const m of game.level.monsters)walk(m.minvent,OBJ_MINVENT,m);
 const last=decodeScreen(native.steps.at(-1).screen).join('\n'),h=last.match(/HP:(\d+)\(\d+\)/);
 assert.ok(h,name+': final HP exists');hp++;assert.equal(Math.max(0,Upolyd(game.u)?game.u.mh:game.u.uhp),Number(h[1]),name+': native HP');
 const invStart=s.moves.lastIndexOf('i ')+1,expected=new Map(),chargeCounts=new Map();assert.ok(invStart>0,name);
 for(const t of native.steps.slice(invStart))for(const row of decodeScreen(t.screen)){
  const m=row.match(/ ([$a-zA-Z]) [^\s] ((?:\d+|an?|the)\b.*)/);
  if(m){expected.set(m[1],/^\d+/.test(m[2])?parseInt(m[2],10):1);const c=m[2].match(/\((\d+):(-?\d+)\)/);if(c)chargeCounts.set(m[1],[Number(c[1]),Number(c[2])]);}
 }
 assert.deepEqual(game.invent.map(o=>[o.invlet,o.quan]).sort(),[...expected].sort(),name+': native inventory');inventory+=expected.size;
 for(const [letter,[recharged,spe]] of chargeCounts){const o=game.invent.find(o=>o.invlet===letter);assert.ok(o,name+': charged item');assert.equal(o.recharged||0,recharged,name+': recharges');assert.equal(o.spe,spe,name+': native charges');charges++;}
 let deaths=0,wasPrompt=false;
 for(const j of native.steps.keys()){
  const prompt=messages[j].includes('Die?');
  if(prompt&&!wasPrompt&&j<s.moves.length)deaths++;
  wasPrompt=prompt;
 }
 assert.equal(game.u.umortality||0,deaths,name+': native death attempts');mortality+=deaths;
}
}
assert.equal(replays,284);console.log('untrapping native observations:',{replays,hp,inventory,traps,monsters,mortality,charges});

{
const base=read('untrapping-floor','input')[0],pre=base.moves.slice(0,base.moves.indexOf('#untrap'));
let groups=0,snapshots=[];const rows=()=>game.nhDisplay.grid.map(r=>r.map(c=>c.ch).join(''));const text=()=>[...snapshots.flat(),...rows()].join('\n');
async function setup(keys='\x1b'){
 resetInputState();await runSegment({...base,moves:pre,storage:new InMemoryStorage()});
 game.invent=[];game.level.objects=[];game.level.monsters=[];game.level.monAt=new Map();game.level.traps=[];
 for(let x=game.u.ux-1;x<=game.u.ux+1;x++)for(let y=game.u.uy-1;y<=game.u.uy+1;y++)game.level.at(x,y).typ=ROOM;
 game.u.dx=1;game.u.dy=0;game.u.dz=0;game.flags.autounlock=0;
 game._toplin=0;game._pending_message='';game._win_stop=false;snapshots=[];
 game._preNhgetchHook=()=>snapshots.push(rows());resetInputState();pushKeys(keys+' '.repeat(100));groups++;
}
function item(type=N.APPLE,fields={},floor=false,x=game.u.ux,y=game.u.uy){const o=Object.assign(mksobj(type,false,false),{quan:1,invlet:'b',where:OBJ_FREE,bknown:1,cobj:[]},fields);o.owt=weight(o);if(floor)place_object(o,x,y);else{o.where=OBJ_INVENT;game.invent.push(o);}return o;}
function trap(type=BEAR_TRAP,fields={},here=false){const t=maketrap(game.u.ux+(here?0:1),game.u.uy,type);Object.assign(t,{tseen:1},fields);return t;}
function monster(t,fields={},type=t.ttyp===BEAR_TRAP?P.PM_HOBGOBLIN:P.PM_GOBLIN){const m=makemon(game.mons[type],t.tx,t.ty,MM_NOMSG);Object.assign(m,{mtrapped:1,mpeaceful:0,mcanmove:1,mfrozen:0,msleeping:0},fields);return m;}
function seed(n=1){initRng(n);enableRngLog();}const calls=()=>getRngLog().map(r=>r.split('=')[0]);

// C's probability bounds, with each status or role varied separately.
for(const [condition,bound]of [['normal',3],['confused',4],['hallucinating',4],['blind',4],['stunned',5],['fumbling',6],['own',2],['web',7],['blade',3],['Sting',1],['Fire',1],['Ranger-web',6]]){
 await setup();const t=trap(['web','blade','Sting','Fire','Ranger-web'].includes(condition)?WEB:BEAR_TRAP);
 if(condition==='confused')game.u.intrinsic.HConfusion=10;
 if(condition==='hallucinating')game.u.uprops.HALLUC=10;
 if(condition==='blind')game.u.ublind=1;
 if(condition==='stunned')game.u.intrinsic.HStun=10;
 if(condition==='fumbling')game.u.intrinsic.HFumbling=10;
 if(condition==='own')t.madeby_u=1;
 if(condition==='Ranger-web')game.urole={...game.urole,mnum:P.PM_RANGER};
 if(['blade','Sting','Fire'].includes(condition))game.u.uwep=item(condition==='Sting'?N.ELVEN_DAGGER:condition==='Fire'?N.LONG_SWORD:N.DAGGER,{owornmask:W_WEP,oartifact:condition==='Sting'?STING:condition==='Fire'?FIRE:0});
 seed();const r=untrap_prob(t);assert.ok(r>=0&&r<bound,condition);assert.deepEqual(calls(),['rn2('+bound+')'],condition);
}
await setup();game.urole={...game.urole,mnum:P.PM_RANGER};const rangerTrap=trap();seed();assert.equal(untrap_prob(rangerTrap),0);assert.deepEqual(calls(),[]);
await setup();game.urole={...game.urole,mnum:P.PM_ROGUE};game.u.uhave={questart:true};const rogueTrap=trap();seed();untrap_prob(rogueTrap);assert.equal(calls()[0],'rn2(60)');assert.ok(['rn2(1)','rn2(2)'].includes(calls()[1]));
await setup();const web=trap(WEB);game.urole={...game.urole,mnum:P.PM_SAMURAI};game.u.uwep=item(N.MACE,{owornmask:W_WEP});game.u.uswapwep=item(N.DAGGER,{owornmask:W_SWAPWEP});game.u.twoweap=true;seed();untrap_prob(web);assert.deepEqual(calls(),['rn2(3)']);

// Early refusals leave the trap and RNG untouched.
for(const why of ['monster','boulder','diagonal','levitation']){
 await setup();const t=trap();
 if(why==='monster')monster(t,{mtrapped:0});
 if(why==='boulder')item(N.BOULDER,{},true,t.tx,t.ty);
 if(why==='diagonal'){game.u.dy=1;t.ty++;game.level.at(game.u.ux,t.ty).typ=STONE;game.level.at(t.tx,game.u.uy).typ=STONE;item(N.LOADSTONE,{quan:50});}
 if(why==='levitation')game.u.intrinsic.HLevitation=10;
 seed();assert.equal(await try_disarm(t,false),0,why);assert.deepEqual(calls(),[],why);assert.ok(game.level.traps.includes(t));
}
await setup();const pass=trap();item(N.BOULDER,{},true,pass.tx,pass.ty);game.u.uprops.PASSES_WALLS=1;seed();assert.equal(await try_disarm(pass,false),2);
await setup();const missed=trap();seed(5);assert.equal(await try_disarm(missed,false),1);assert.match(text(),/difficult to disarm/);assert.equal(!!game.u.utrap,false);

// Disarming converts trap material or frees its captive, preserving ownership.
for(const type of [BEAR_TRAP,LANDMINE,ARROW_TRAP,DART_TRAP,WEB]){
 await setup();const t=trap(type);seed(1);
 const res=type===BEAR_TRAP||type===WEB?await disarm_holdingtrap(t):type===LANDMINE?await disarm_landmine(t):await disarm_shooting_trap(t,type===ARROW_TRAP?N.ARROW:N.DART);
 // An unarmed web has a different chance. Pick its own deterministic success below.
 if(type===WEB){assert.equal(res,1);continue;}
 assert.equal(res,1);assert.ok(!game.level.traps.includes(t));const o=game.level.objects.find(o=>o.ox===t.tx&&o.oy===t.ty);assert.ok(o);assert.equal(o.where,OBJ_FLOOR);assert.equal(o.owt,weight(o));
 if(type===ARROW_TRAP||type===DART_TRAP)assert.ok(o.quan>=1&&o.quan<=50);else assert.equal(o.quan,1);
 if(type!==DART_TRAP)assert.equal(o.opoisoned,0);
}
for(const own of [false,true]){
 await setup();const t=trap(BEAR_TRAP,{madeby_u:+own}),m=monster(t);game.urole={...game.urole,mnum:P.PM_RANGER};seed();assert.equal(await disarm_holdingtrap(t),1);assert.equal(m.mtrapped,0);assert.ok(game.level.traps.includes(t));assert.equal(game.level.objects.length,0);assert.match(text(),/extract the hobgoblin/);
}
await setup();const stingWeb=trap(WEB);game.u.uwep=item(N.ELVEN_DAGGER,{oartifact:STING,owornmask:W_WEP});seed();assert.equal(await disarm_holdingtrap(stingWeb),1);assert.ok(!game.level.traps.includes(stingWeb));assert.match(text(),/Sting cuts through/);

await setup();assert.equal(unsqueak_ok(null),GETOBJ_EXCLUDE);assert.equal(unsqueak_ok(item()),GETOBJ_EXCLUDE);assert.equal(unsqueak_ok(item(N.CAN_OF_GREASE)),GETOBJ_SUGGEST);const oil=item(N.POT_OIL,{dknown:1});game.objects[N.POT_OIL].oc_name_known=false;assert.equal(unsqueak_ok(oil),GETOBJ_DOWNPLAY);game.objects[N.POT_OIL].oc_name_known=true;assert.equal(unsqueak_ok(oil),GETOBJ_SUGGEST);assert.equal(unsqueak_ok(item(N.POT_WATER)),GETOBJ_DOWNPLAY);
for(const type of [N.CAN_OF_GREASE,N.POT_OIL]){
 await setup('b');const t=trap(SQKY_BOARD),o=item(type,{spe:3}),xp=game.u.uexp;seed();assert.equal(await disarm_squeaky_board(t),1);assert.ok(!game.level.traps.includes(t));assert.equal(game.u.uexp,xp+1);
 if(type===N.CAN_OF_GREASE){assert.equal(o.spe,2);assert.ok(game.invent.includes(o));}else{assert.ok(!game.invent.includes(o));assert.ok(game.objects[N.POT_OIL].oc_name_known);}
}
await setup('b');const badBoard=trap(SQKY_BOARD),emptyGrease=item(N.CAN_OF_GREASE,{spe:0});seed();assert.equal(await disarm_squeaky_board(badBoard),1);assert.ok(game.level.traps.includes(badBoard));assert.equal(emptyGrease.spe,0);assert.ok(game.invent.includes(emptyGrease));

for(const stuff of [false,true]){
 await setup();const t=trap(PIT,{madeby_u:1}),m=monster(t);seed();assert.equal(await try_lift(m,t,5000,stuff),0);assert.equal(m.mtrapped,1);assert.equal(m.mpeaceful,0);assert.match(text(),stuff?/carrying too much/:/too heavy/);
}
for(const asleep of [false,true]){
 await setup();const t=trap(PIT),m=monster(t,{msleeping:+asleep,mpeaceful:1});seed();assert.equal(await help_monster_out(m,t),1);assert.equal(m.mtrapped,0);assert.equal(m.msleeping,0);assert.ok(game.level.traps.includes(t));assert.match(text(),/pull the goblin out of the pit/);
}
await setup();const heavyPit=trap(PIT),heavyMon=monster(heavyPit,{msleeping:1,mpeaceful:1});const load=mksobj(N.LOADSTONE,false,false);load.quan=50;load.owt=weight(load);add_to_minv(heavyMon,load);seed();assert.equal(await help_monster_out(heavyMon,heavyPit),1);assert.equal(heavyMon.mtrapped,1);assert.equal(heavyMon.msleeping,0);assert.match(text(),/carrying too much/);
await setup();const sleepyPit=trap(PIT),sleepyMon=monster(sleepyPit,{msleeping:1});seed(2);assert.equal(await help_monster_out(sleepyMon,sleepyPit),1);assert.equal(sleepyMon.mtrapped,1);assert.equal(sleepyMon.msleeping,0);assert.match(text(),/cannot get a firm grasp/);
await setup();const scepticPit=trap(PIT),sceptic=monster(scepticPit);seed(2);assert.equal(await help_monster_out(sceptic,scepticPit),1);assert.equal(sceptic.mtrapped,1);assert.match(text(),/backs away skeptically/);
await setup();const ownPit=trap(PIT,{madeby_u:1}),ownMon=monster(ownPit);game.u.ualign.type=A_LAWFUL;const alignment=game.u.ualign.record;seed();await reward_untrap(ownPit,ownMon);assert.deepEqual(calls(),[]);assert.equal(ownMon.mpeaceful,0);assert.equal(game.u.ualign.record,alignment);

// Dispatch: unseen traps, inaccessible floor, known boxes, invocation refund.
await setup('.');const unseen=trap(BEAR_TRAP,{tseen:0},true);seed();assert.equal(await untrap(false,0,0,null),0);assert.ok(game.level.traps.includes(unseen));assert.deepEqual(calls(),[]);assert.match(text(),/know of no traps/);
await setup('.');const aloft=trap(WEB,{},true);item(N.LARGE_BOX,{},true);game.u.intrinsic.HLevitation=10;seed();assert.equal(await untrap(false,0,0,null),0);assert.match(text(),/a web and a container here but you can't reach them/);assert.deepEqual(calls(),[]);
await setup('y');const known=item(N.LARGE_BOX,{tknown:1,dknown:1,otrapped:0},true);resetInputState();pushKeys('.y'+' '.repeat(30));seed();assert.equal(await untrap(false,0,0,null),1);assert.equal(known.tknown,0);assert.match(text(),/was not trapped/);
await setup(' y');const door=game.level.at(game.u.ux+1,game.u.uy);door.typ=DOOR;door.doormask=D_CLOSED|D_TRAPPED;game.u.intrinsic.HLevitation=10;seed();assert.equal(await untrap(true,game.u.ux+1,game.u.uy,null),1);assert.equal(door.doormask,D_CLOSED);assert.match(text(),/disarm it/);
await setup();const invokeObj=item(N.SKELETON_KEY,{age:99});assert.equal(await invoke_untrap(invokeObj),ECMD_CANCEL);assert.equal(invokeObj.age,0);
await setup();const closed=trap(WEB),captive=monster(closed),noticed={v:false};assert.equal(await closeholdingtrap(captive,noticed),false);assert.equal(noticed.v,false);captive.mtrapped=0;seed();assert.equal(await closeholdingtrap(captive,noticed),true);assert.equal(captive.mtrapped,1);assert.equal(noticed.v,true);

await setup();game.u.intrinsic.HLevitation=10;set_utrap(3,TT_WEB);assert.equal(Levitation(),false);assert.ok(!bot_conditions().includes(' Lev'));await reset_utrap(false);assert.equal(Levitation(),true);assert.ok(bot_conditions().includes(' Lev'));
await setup();game.u.intrinsic.HFlying=10;set_utrap(3,TT_WEB);assert.equal(Flying(),false);assert.ok(!bot_conditions().includes(' Fly'));await reset_utrap(false);assert.equal(Flying(),true);assert.ok(bot_conditions().includes(' Fly'));

// C halves explosion HP damage, while stun retains the full damage roll.
for(const half of [false,true]){
 await setup();game.u.uprops.HALF_PHDAM=half?1:0;game.u.intrinsic.HStun=FROMOUTSIDE|7;const hp=game.u.uhp;seed();const damage=rnd(6);seed();await b_trapped('door',0);assert.equal(hp-game.u.uhp,half?Math.trunc((damage+1)/2):damage);assert.equal(game.u.intrinsic.HStun&TIMEOUT,7+damage);assert.equal(game.u.intrinsic.HStun&~TIMEOUT,FROMOUTSIDE);
}
// Combined modifiers, captive webs and minimum chance.
await setup();const combined=trap(BEAR_TRAP,{madeby_u:1});Object.assign(game.u.intrinsic,{HConfusion:10,HStun:10,HFumbling:10});game.u.ublind=1;game.u.uprops.HALLUC=10;seed();untrap_prob(combined);assert.deepEqual(calls(),['rn2(13)']);
await setup();const occupiedWeb=trap(WEB);monster(occupiedWeb);game.u.uwep=item(N.DAGGER,{owornmask:W_WEP});seed();untrap_prob(occupiedWeb);assert.deepEqual(calls(),['rn2(7)']);
await setup();const ownSting=trap(WEB,{madeby_u:1});game.u.uwep=item(N.ELVEN_DAGGER,{oartifact:STING,owornmask:W_WEP});seed();assert.equal(untrap_prob(ownSting),0);assert.deepEqual(calls(),['rn2(1)']);

// Gratitude changes peacefulness and alignment, not just its message.
for(const own of [false,true]){
 await setup();const t=trap(PIT,{madeby_u:+own}),m=monster(t);game.u.ualign.type=A_LAWFUL;const before=game.u.ualign.record;seed(3);await reward_untrap(t,m);assert.equal(m.mpeaceful,own?0:1);assert.equal(game.u.ualign.record,before+(own?0:1));assert.equal(text().includes('grateful'),!own);assert.equal(text().includes('right thing'),!own);
}
for(const own of [false,true]){
 await setup();const t=trap(PIT,{madeby_u:+own}),m=monster(t);seed(3);assert.equal(await try_lift(m,t,5000,false),0);assert.equal(m.mtrapped,1);assert.equal(m.mpeaceful,own?0:1);assert.equal(text().includes('nice of you to try'),!own);
}
// Forced failures injure captives; spreading webs cannot overwrite other traps.
for(const hp of [8,2]){
 await setup();const t=trap(),m=monster(t,{mhp:hp});seed(2);assert.equal(await try_disarm(t,true),1);assert.equal(m.mhp,Math.max(0,hp-3));assert.equal(game.level.monsters.includes(m),hp>3);assert.ok(game.level.traps.includes(t));
}
for(const existing of [0,WEB,PIT]){
 await setup();const t=trap(WEB),m=monster(t);const under=existing?trap(existing,{},true):null;seed(2);assert.equal(await try_disarm(t,true),1);assert.equal(m.mtrapped,1);const result=t_at(game.u.ux,game.u.uy);assert.equal(result.ttyp,existing||WEB);if(under)assert.equal(result,under);assert.equal(!!game.u.utrap,existing!==PIT);assert.equal(text().includes("You're caught too"),existing!==PIT);
}
// Gloves and resistance prevent fatal direct contact during a pit rescue.
for(const protection of ['none','gloves','resistance']){
 await setup('n');const t=trap(PIT),m=monster(t,{mpeaceful:1},P.PM_COCKATRICE);if(protection==='gloves')game.u.uarmg=item(N.LEATHER_GLOVES,{owornmask:W_ARMG});if(protection==='resistance')game.u.uprops.STONE_RES=1;seed(1);assert.equal(await help_monster_out(m,t),1);assert.equal(game.u.umortality||0,protection==='none'?1:0);assert.equal(m.mtrapped,protection==='none'?1:0);
}
// Looking at a visible captive reveals holding traps but no unrelated traps.
for(const type of [BEAR_TRAP,WEB,PIT,ARROW_TRAP]){
 await setup();const t=trap(type,{tseen:0}),m=monster(t);unblock_point(t.tx,t.ty);vision_recalc(0);newsym(t.tx,t.ty);assert.ok(cansee(t.tx,t.ty));t.tseen=0;const result=do_screen_description({x:t.tx,y:t.ty},true,null);assert.equal(result.out_str.includes('trapped in'),type!==ARROW_TRAP);assert.equal(t.tseen,type===ARROW_TRAP?0:1);
}
await setup('.');seed();assert.equal(await dountrap(),ECMD_OK);assert.deepEqual(calls(),[]);
await setup('.');const entryTrap=trap(BEAR_TRAP,{},true);seed();assert.equal(await dountrap(),ECMD_TIME);assert.ok(!game.level.traps.includes(entryTrap));
await setup();set_utrap(3,TT_WEB);game.u.intrinsic.HLevitation=10;await float_up();assert.match(text(),/your leg is still stuck/);assert.equal(Levitation(),false);
console.log(`untrapping: ${groups} constructed groups PASS`);
}
