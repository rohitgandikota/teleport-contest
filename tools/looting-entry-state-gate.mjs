#!/usr/bin/env node

// C looting entry, confused contributions, autounlock, box traps and magic keys.
// Constructed controls earn no native coverage credit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen} from '../tools/gen-sessions/screen-decode.mjs';
import {OBJ_INVENT,OBJ_CONTAINED,OBJ_FLOOR,OBJ_MINVENT,Upolyd,OBJ_FREE,ROOM,POOL,LAVAPOOL,THRONE,T_LOOTED,ECMD_OK,ECMD_TIME,W_WEP,W_QUIVER,AUTOUNLOCK_FORCE} from '../js/const.js';
import {resetInputState,pushKeys} from '../js/input.js';
import {mksobj,place_object} from '../js/mkobj.js';
import {weight} from '../js/invent.js';
import {able_to_loot,mon_beside,do_loot_cont,doloot_core,reverse_loot} from '../js/pickup.js';
import {could_untrap,disarm_box,untrap_box} from '../js/trap.js';
import {is_magic_key,has_magic_key} from '../js/artifact.js';
import {parseoptions,handler_autounlock} from '../js/options.js';
import {initRng,rn2,rnd,enableRngLog,getRngLog} from '../js/rng.js';
import {ONAMES as N} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ART_MASTER_KEY_OF_THIEVERY as KEY} from '../js/artilist_data.js';

const read=(name,kind)=>JSON.parse(fs.readFileSync(new URL('gen-sessions/'+(kind==='input'?'recipes/':'generated/')+name+(kind==='input'?'':'.session')+'.json',import.meta.url)));
let replays=0,gold=0,hp=0,observations=0;
for(const base of ['looting-entry','confused-looting','container-autounlock','autounlock-options','magic-key-looting']){
 const native=read(base,'session');
 for(const[i,s]of read(base,'input').segments.entries()){
  await runSegment({...s,storage:new InMemoryStorage()});replays++;
  assert.deepEqual(game.impossible_log||[],[],s.name);assert.deepEqual(game.rc.errors,[],s.name);
  const seen=new Set();
  function walk(list,where,parent){for(const o of list||[]){assert.ok(!seen.has(o.o_id),s.name+': duplicate object '+o.o_id);seen.add(o.o_id);assert.equal(o.where,where,s.name);if(where===OBJ_CONTAINED)assert.equal(o.ocontainer,parent,s.name);if(where===OBJ_MINVENT)assert.equal(o.ocarry,parent,s.name);walk(o.cobj,OBJ_CONTAINED,o);}}
  walk(game.invent,OBJ_INVENT);walk(game.level.objects,OBJ_FLOOR);for(const m of game.level.monsters)walk(m.minvent,OBJ_MINVENT,m);
  const rows=decodeScreen(native.segments[i].steps.at(-1).screen),text=rows.join('\n');
  const h=text.match(/HP:(\d+)\(\d+\)/);if(h){hp++;const u=game.u;assert.equal(Math.max(0,Upolyd(u)?u.mh:u.uhp),Number(h[1]),s.name+': native HP');}
  const start=s.moves.lastIndexOf('i ')+1,expected=new Map();
  for(const t of native.segments[i].steps.slice(start))for(const row of decodeScreen(t.screen)){
   const m=row.match(/ ([$a-zA-Z]) [^\s] ((?:\d+|an?|the)\b.*)/);
   if(m)expected.set(m[1],/^\d+/.test(m[2])?parseInt(m[2],10):1);
  }
  assert.deepEqual(game.invent.map(o=>[o.invlet,o.quan]).sort(),[...expected].sort(),s.name+': native inventory');
  if(expected.has('$'))gold++;observations+=expected.size;
 }
}
assert.equal(replays,144);console.log(`looting: ${replays} native replays, ${observations} inventory observations, ${hp} HP and ${gold} gold observations PASS`);

{

const base=read('looting-entry','input').segments.find(s=>s.name==='guard-empty');
const pre=base.moves.slice(0,base.moves.indexOf('#loot'));
let groups=0,snapshots=[];
const rows=()=>game.nhDisplay.grid.map(r=>r.map(c=>c.ch).join(''));
const text=()=>[...snapshots.flat(),...rows()].join('\n');
async function setup(keys='\x1b'){
 resetInputState();await runSegment({...base,moves:pre,storage:new InMemoryStorage()});
 game.invent=[];game.level.objects=[];game.level.monsters=[];game.level.monAt=new Map();game.level.traps=[];
 game.level.at(game.u.ux,game.u.uy).typ=ROOM;game.flags.autounlock=0;
 game._toplin=0;game._pending_message='';game._win_stop=false;snapshots=[];
 game._preNhgetchHook=()=>snapshots.push(rows());resetInputState();pushKeys(keys+' '.repeat(80));groups++;
}
function item(type=N.APPLE,fields={},floor=false){
 const o=Object.assign(mksobj(type,false,false),{quan:1,invlet:'b',where:OBJ_FREE,bknown:1,cobj:[],olocked:0},fields);
 o.owt=weight(o);if(floor)place_object(o,game.u.ux,game.u.uy);else{o.where=OBJ_INVENT;game.invent.push(o);}return o;
}
await setup();assert.equal(await do_loot_cont({o:null},1,1),ECMD_OK);
for(const half of [false,true]){
 await setup();const o=item(N.BAG_OF_TRICKS,{spe:3},true),before=game.u.uhp;
 game.u.uprops.HALF_PHDAM=half?1:0;initRng(31);const damage=rnd(10);initRng(31);
 assert.equal(await do_loot_cont({o},1,1),ECMD_TIME);assert.equal(before-game.u.uhp,half?Math.trunc((damage+1)/2):damage);
 assert.equal(o.spe,3);assert.equal(o.lknown,1);assert.ok(game.abort_looting);assert.ok(game.objects[o.otyp].oc_name_known);
 assert.match(text(),/huge set of teeth and bites you/);
}
for(const count of [1,2]){
 await setup();const o=item(N.LARGE_BOX,{olocked:1},true),w=item(N.DAGGER,{owornmask:W_WEP});game.u.uwep=w;game.flags.autounlock=AUTOUNLOCK_FORCE;
 const moves=game.moves;assert.equal(await do_loot_cont({o},1,count),ECMD_OK);assert.equal(game.moves,moves);assert.equal(o.lknown,1);
 assert.equal(!!game.abort_looting,count===1);
}
for(const [typ,under,allow]of [[ROOM,false,true],[POOL,false,false],[POOL,true,false],[LAVAPOOL,false,false]]){
 await setup();game.level.at(game.u.ux,game.u.uy).typ=typ;game.u.uinwater=under;
 assert.equal(await able_to_loot(game.u.ux,game.u.uy,true),allow);
 if(!allow)assert.match(text(),/cannot loot things that are deep/);
}
await setup();game.u.intrinsic.HLevitation=1;assert.equal(await able_to_loot(game.u.ux,game.u.uy,true),false);assert.match(text(),/can't reach/);
await setup();const sword=item(N.TWO_HANDED_SWORD,{cursed:1,owornmask:W_WEP});game.u.uwep=sword;
assert.equal(await able_to_loot(game.u.ux,game.u.uy,true),false);assert.match(text(),/Without a free hand/);
assert.equal(await could_untrap(true,true),0);assert.match(text(),/hands seem to be too busy/);
await setup();assert.equal(await could_untrap(false,true),1);game.u.ustuck={data:game.mons[P.PM_OWLBEAR]};assert.equal(await could_untrap(false,true),0);
await setup();game.u.intrinsic.HLevitation=1;assert.equal(await could_untrap(false,true),0);assert.equal(await could_untrap(false,false),1);
await setup();const x=game.u.ux,y=game.u.uy;assert.equal(mon_beside(x,y),false);
const mon={mhp:1};game.level.monAt.set(`${x+1},${y+1}`,mon);assert.equal(mon_beside(x,y),true);assert.equal(mon_beside(x-2,y),false);

// Find fixed RNG starts for each branch. These constructed runs earn no C credit.
let contributionSeed,allSeed,oldSeed;
for(let s=1;s<100;s++){
 initRng(s);const c=rn2(3);if(c){const q=rnd(5);if(q<5&&contributionSeed===undefined)contributionSeed=s;if(q===5&&allSeed===undefined)allSeed=s;}
 else if(rn2(2)===0&&oldSeed===undefined)oldSeed=s;
}
assert.ok([contributionSeed,allSeed,oldSeed].every(Number.isInteger));
for(const route of ['floor','preferred','nearest','looted'])for(const whole of [false,true]){
 await setup();const seed=whole?allSeed:contributionSeed;
 initRng(seed);rn2(3);const n=Math.trunc((rnd(5)*10+4)/5);
 const gold=item(N.GOLD_PIECE,{quan:10,invlet:'$',owornmask:W_QUIVER});game.u.uquiver=gold;
 let target,other;
 if(route!=='floor')game.level.at(game.u.ux,game.u.uy).typ=THRONE;
 if(route==='looted')game.level.at(game.u.ux,game.u.uy).looted=T_LOOTED;
 if(route==='preferred'||route==='nearest'){
  other=item(N.CHEST,{spe:0,cknown:1},true);other.ox=game.u.ux+1;
  target=item(N.CHEST,{spe:route==='preferred'?2:0,cknown:1},true);target.ox=game.u.ux+(route==='preferred'?3:0);
 }
 initRng(seed);assert.equal(await reverse_loot(),true);
 const carried=game.invent.find(o=>o.otyp===N.GOLD_PIECE),moved=(target?target.cobj:game.level.objects).find(o=>o.otyp===N.GOLD_PIECE);
 assert.equal(carried?.quan||0,10-n);assert.equal(moved.quan,n);assert.ok(!game.invent.includes(moved));assert.equal(moved.owornmask,0);
 if(whole)assert.equal(game.u.uquiver,null);else{assert.equal(game.u.uquiver,gold);assert.notEqual(moved.o_id,gold.o_id);}
 if(target){assert.equal(moved.ocontainer,target);assert.equal(target.owt,weight(target));assert.equal(target.cknown,0);assert.equal(target.olocked,1);assert.equal(other.cobj.length,0);}
 else assert.equal(moved.where,OBJ_FLOOR);
}
await setup();item();initRng(oldSeed);assert.equal(await reverse_loot(),true);assert.match(text(),/You find old loot:/);assert.equal(game.invent.length,1);
await setup();initRng(contributionSeed);assert.equal(await reverse_loot(),false);
await setup();const trapped=item(N.LARGE_BOX,{otrapped:1});const xp=game.u.uexp;enableRngLog();await disarm_box(trapped,true,true);
assert.equal(trapped.otrapped,0);assert.equal(trapped.tknown,1);assert.equal(game.u.uexp,xp+8);assert.ok(getRngLog().every(x=>!x.startsWith('rnd(')),'forced disarm skips the chance roll');
await setup();const safe=item(N.LARGE_BOX,{tknown:1});await disarm_box(safe,false,false);assert.equal(safe.tknown,0);assert.match(text(),/was not trapped/);
await setup();const plain=item(N.LARGE_BOX);await untrap_box(plain,false,false);assert.match(text(),/find no traps/);assert.equal(plain.tknown||0,0);
await setup('n');const danger=item(N.LARGE_BOX,{otrapped:1,tknown:1,dknown:1});await untrap_box(danger,true,false);
assert.equal(danger.otrapped,1);assert.equal(danger.tknown,1);assert.match(text(),/There's a trap/);

for(const rogue of [false,true])for(const blessed of [false,true])for(const cursed of [false,true]){
 await setup();
 const o=item(N.SKELETON_KEY,{oartifact:KEY,blessed:Number(blessed),cursed:Number(cursed)});
 const who={data:game.mons[rogue?P.PM_ROGUE:P.PM_WIZARD]};
 assert.equal(is_magic_key(who,o),rogue?!cursed:blessed);assert.equal(is_magic_key(null,o),blessed);
}
await setup();const nonkey=item(),bad=item(N.SKELETON_KEY,{oartifact:KEY,cursed:1}),good=item(N.SKELETON_KEY,{oartifact:KEY,blessed:1});
assert.equal(has_magic_key(null),good);good.blessed=0;assert.equal(has_magic_key(game.youmonst),null);assert.equal(is_magic_key(null,nonkey),false);
const wearer={minvent:[nonkey,bad,good],data:game.mons[P.PM_ROGUE]};for(const o of wearer.minvent){o.where=OBJ_MINVENT;o.ocarry=wearer;}game.invent=[];
assert.equal(has_magic_key(wearer),good);
for(const [value,bits]of [['autounlock',2],['!autounlock',0],['autounlock:NONE',0],['autounlock:u+a+k+f',15],['autounlock:untrap  apply_key kick force',15],['autounlock:apply key+force',10]]){
 const r={opts:{},errors:[]};assert.equal(parseoptions(value,false,false,r),true,value);assert.equal(r.opts.autounlock,bits,value);groups++;
}
for(const value of ['autounlock:Force','autounlock:none+force','!autounlock:force','autounlock:apply key force','autounlock:force+']){
 const r={opts:{autounlock:2},errors:[]};assert.equal(parseoptions(value,false,false,r),false,value);assert.equal(r.opts.autounlock,2,value);assert.equal(r.errors.length,1);groups++;
}
for(const [keys,want]of [['a\r',0],['f\r',10],['\x1b',2],[',\r',15]]){
 await setup(keys);game.flags.autounlock=2;await handler_autounlock();assert.equal(game.flags.autounlock,want);assert.ok(text().includes("Select 'autounlock' actions:"));
}
console.log(`looting: ${groups} constructed control groups PASS`);

}
