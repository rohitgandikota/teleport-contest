// Constructed HP/countdown/attribute boundaries; real objects, owners and ISAAC.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test as nodeTest} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {resetInputState} from '../js/input.js';
import {display_nhwindow_message} from '../js/display.js';
import {initRng,getRngLog} from '../js/rng.js';
import {poisoned,ABASE,ACURR} from '../js/attrib.js';
import {make_stoned} from '../js/potion.js';
import {nh_timeout} from '../js/timeout.js';
import {delayed_killer,find_delayed_killer,formatkiller} from '../js/end.js';
import {mksobj} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {Amulet_on,Blindf_on,Armor_on,Ring_on} from '../js/do_wear.js';
import {setworn} from '../js/worn.js';
import {wet_a_towel} from '../js/weapon.js';
import {polymon} from '../js/polyself.js';
import {Poison_resistance,Half_gas_damage,Fixed_abil} from '../js/youprop.js';
import {the} from '../js/objnam.js';
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {A_STR,A_CON,A_CHA,STONED,SLIMED,SICK,POLYMORPH,STONING,POISONING,DIED,
    KILLED_BY_AN,KILLED_BY,W_AMUL,W_ARM,W_RINGL,Upolyd} from '../js/const.js';
const rc='OPTIONS=name:Poison,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
 +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist,!safe_wait,debug_mongen\nOPTIONS=symset:plain\n';
const results=[];let seen=[];
const deadline=setTimeout(()=>{console.error('55 second poisoned state limit');process.exit(1);},55000);deadline.unref();
async function test(name,fn){await nodeTest(name,async()=>{try{await fn();results.push({name,pass:true});}
 catch(e){results.push({name,pass:false,error:e.message.slice(0,1000)});throw e;}});}
function feed(run,refusal=false){let reads=0;seen=[];run._display.onEmptyQueue=async()=>{
 await setImmediate();assert.ok(reads++<128,'physical input limit');
 seen.push({text:game._toplines,pending:game._pending_message,killer:game.killer.name,format:game.killer.format,
    mortality:game.u.umortality||0,stone:formatkiller(STONING,false),poison:formatkiller(POISONING,false),died:formatkiller(DIED,false)});
 if(game._toplines.includes('Die?')){assert.ok(refusal,'actual life saving must not use wizard refusal');return 110;}
 return 32;};}
async function boot(){const run=await runSegment({seed:13001,datetime:'20000112093000',nethackrc:rc,moves:' ',storage:new InMemoryStorage()});
 resetInputState();feed(run);await display_nhwindow_message();feed(run);return run;}
async function settle(run,refusal=false){feed(run,refusal);await display_nhwindow_message();feed(run,refusal);}
function obj(type){const o=mksobj(type,true,false);addinv(o);return o;}
async function amulet(){const o=obj(O.AMULET_OF_LIFE_SAVING);await Amulet_on(o);assert.equal(game.u.uprops.LIFESAVED,W_AMUL);return o;}
async function stone(){await make_stoned(9,null,KILLED_BY_AN,'cockatrice egg');return find_delayed_killer(STONED);}
function saved(o){assert.equal(game.u.umortality,1);assert.ok(game.u.uhp>0);assert.equal(game.u.uamul,null);
 assert.ok(!game.u.uprops.LIFESAVED);assert.ok(!game.invent.includes(o));assert.equal(game.killer.name,'');
 assert.ok(!seen.some(s=>(s.text||'').includes("don't die")));}
async function directFatal(run,name='poisoned needle'){game.u.uhp=1;await settle(run);game.wizard=false;initRng(1);
 await poisoned('needle',A_CON,name,15,false);assert.deepEqual(getRngLog().slice(0,2),['rn2(15)=0','d(4,6)=12']);}
await test('direct fatal poison: actual amulet preserves head and produced stoning node',async()=>{
 const run=await boot(),o=await amulet(),node=await stone(),head=game.killer;
 await directFatal(run);saved(o);assert.equal(game.killer,head);assert.equal(find_delayed_killer(STONED),node);assert.equal(game.u.uprops.STONED,9);
});
await test('direct fatal poison: unrelated delayed nodes survive actual life saving',async()=>{
 const run=await boot(),o=await amulet();await stone();for(const id of [SICK,SLIMED,POLYMORPH])delayed_killer(id,KILLED_BY,`cause ${id}`);
 const ids=[STONED,SICK,SLIMED,POLYMORPH],nodes=ids.map(find_delayed_killer);await directFatal(run);saved(o);assert.deepEqual(ids.map(find_delayed_killer),nodes);
});
await test('after poison life saving: actual later expiry retains egg attribution',async()=>{
 const run=await boot(),o=await amulet();await stone();await directFatal(run);saved(o);
 game.wizard=true;await settle(run,true);await make_stoned(1,null,KILLED_BY_AN,null);await nh_timeout();
 assert.ok(seen.some(s=>s.stone==='petrified by a cockatrice egg'));assert.equal(find_delayed_killer(STONED),null);assert.equal(game.u.umortality,2);
});
await test('after poison life saving: cure removes only the target cause',async()=>{
 const run=await boot(),o=await amulet();await stone();delayed_killer(POLYMORPH,KILLED_BY,'self-genocide');const other=find_delayed_killer(POLYMORPH);
 await directFatal(run);saved(o);assert.equal(find_delayed_killer(STONED)?.name,'cockatrice egg');await make_stoned(0,null,KILLED_BY_AN,null);
 assert.equal(find_delayed_killer(STONED),null);assert.equal(find_delayed_killer(POLYMORPH),other);
});
await test('healthy direct poison death still consumes real amulet and restores HP',async()=>{
 const run=await boot(),o=await amulet();await directFatal(run);saved(o);assert.ok(!game.killer.next);
});
await test('fatal branch deliberately uses human HP while polymorphed',async()=>{
 const run=await boot();await polymon(P.PM_OGRE);game.u.mh=game.u.mhmax=60;const o=await amulet();await directFatal(run);saved(o);
});
for(const [name,hp,max,expect] of [['maximum HP clamp',40,40,[22,31]],['already injured',30,40,[12,31]]]){
 await test(`severe poison: ${name} accounts for damage exactly once`,async()=>{
  const run=await boot();game.u.uhp=hp;game.u.uhpmax=max;const con=ABASE(A_CON),str=ABASE(A_STR);await settle(run);initRng(1);
  await poisoned('spikes',A_STR,'poison spikes',15,false);assert.deepEqual([game.u.uhp,game.u.uhpmax],expect);
  assert.equal(ABASE(A_CON),con-1);assert.equal(ABASE(A_STR),str-3);assert.deepEqual(getRngLog(),['rn2(15)=0','d(4,6)=12']);
 });
}
await test('severe poison: actual polymorph uses adjuhploss monster pool quirk',async()=>{
 const run=await boot();await polymon(P.PM_OGRE);game.u.uhp=game.u.uhpmax=100;game.u.mh=game.u.mhmax=20;await settle(run);initRng(1);
 await poisoned('spikes',A_STR,'poison spikes',15,false);assert.ok(Upolyd(game.u));assert.deepEqual([game.u.uhp,game.u.uhpmax,game.u.mh],[91,91,19]);
 assert.deepEqual(getRngLog(),['rn2(15)=0','d(4,6)=12']);
});
await test('severe constitution poison reduces CON once by three',async()=>{
 const run=await boot();game.u.uhp=game.u.uhpmax=50;const con=ABASE(A_CON),str=ABASE(A_STR);await settle(run);initRng(1);
 await poisoned('needle',A_CON,'poisoned needle',15,false);assert.equal(ABASE(A_CON),con-3);assert.equal(ABASE(A_STR),str);assert.equal(game.u.uhp,32);
});
async function towel(wet,worn){const o=obj(O.TOWEL);o.spe=0;if(wet)await wet_a_towel(o,4,false);if(worn)await Blindf_on(o);assert.equal(Half_gas_damage(),wet&&worn);return o;}
for(const [name,reason,wet,worn,seed,loss] of [
 ['wet worn gas','gas cloud',true,true,2,4],['wet worn blast odd rounding','blast',true,true,4,7],
 ['dry worn gas','gas cloud',false,true,2,8],['wet carried gas','gas cloud',true,false,2,8],
 ['wet worn needle','needle',true,true,2,8],['wet worn spikes','spikes',true,true,2,8]]){
 await test(`HP poison: ${name}`,async()=>{const run=await boot();await towel(wet,worn);game.u.uhp=game.u.uhpmax=50;const str=ABASE(A_STR);
  await settle(run);initRng(seed);await poisoned(reason,A_STR,'cloud of poison gas',15,false);
  assert.equal(game.u.uhp,50-loss);assert.equal(game.u.uhpmax,50);assert.equal(ABASE(A_STR),str);assert.equal(game.u.umortality||0,0);
  assert.deepEqual(getRngLog(),seed===2?['rn2(15)=13','rn2(10)=2']:['rn2(15)=8','rn2(10)=7']);
 });
}
await test('constructed legacy HALF_GAS_DAMAGE flag cannot protect without towel',async()=>{
 const run=await boot();game.u.uprops.HALF_GAS_DAMAGE=1;game.u.uhp=game.u.uhpmax=50;await settle(run);initRng(2);
 await poisoned('gas cloud',A_STR,'cloud of poison gas',15,false);assert.equal(game.u.uhp,42);
});
await test('thrown missile HP branch uses reduced d6 and larger outcome bound',async()=>{
 const run=await boot();game.u.uhp=game.u.uhpmax=50;await settle(run);initRng(2);await poisoned('dart',A_CON,'little dart',10,true);
 assert.equal(game.u.uhp,49);assert.deepEqual(getRngLog(),['rn2(30)=13','rnd(6)=1']);
});
for(const thrown of [false,true])await test(`fatal zero limits ${thrown?'missile':'nonmissile'} to one attribute with no RNG`,async()=>{
 const run=await boot();game.u.uhp=game.u.uhpmax=50;const con=ABASE(A_CON);await settle(run);initRng(1);
 await poisoned('dart',A_CON,'little dart',0,thrown);assert.equal(game.u.uhp,50);assert.equal(ABASE(A_CON),con-1);assert.deepEqual(getRngLog(),[]);
});
await test('attribute poison uses d2+d2 and leaves HP alone',async()=>{
 const run=await boot();await towel(true,true);const con=ABASE(A_CON),hp=game.u.uhp;await settle(run);initRng(5);
 await poisoned('gas cloud',A_CON,'cloud of poison gas',15,false);assert.equal(ABASE(A_CON),con-2);assert.equal(game.u.uhp,hp);assert.deepEqual(getRngLog(),['rn2(15)=4','d(2,2)=2']);
});
await test('charisma zero outcome follows attribute arm rather than fatal poison',async()=>{
 const run=await boot();const cha=ABASE(A_CHA),hp=game.u.uhp;await settle(run);initRng(1);
 await poisoned('needle',A_CHA,'poisoned needle',15,false);assert.equal(ABASE(A_CHA),cha-2);assert.equal(game.u.uhp,hp);assert.deepEqual(getRngLog(),['rn2(15)=0','d(2,2)=2']);
});
await test('actual sustain ability ring blocks stat loss and poisontell feedback',async()=>{
 const run=await boot(),ring=obj(O.RIN_SUSTAIN_ABILITY);setworn(ring,W_RINGL);await Ring_on(ring);assert.ok(Fixed_abil());
 const attrs=[...game.u.acurr.a];await settle(run);initRng(5);await poisoned('needle',A_CON,'poisoned needle',15,false);
 assert.deepEqual(game.u.acurr.a,attrs);assert.ok(![game._toplines,...seen.map(s=>s.pending)].some(s=>s?.includes('very sick')));
 assert.deepEqual(getRngLog(),['rn2(15)=4','d(2,2)=2']);
});
for(const kind of ['armor','polymorph'])await test(`real ${kind} poison resistance returns before poison RNG and encumbrance`,async()=>{
 const run=await boot();if(kind==='armor'){const armor=obj(O.GREEN_DRAGON_SCALE_MAIL);setworn(armor,W_ARM);await Armor_on();}
 else await polymon(P.PM_GREEN_DRAGON);assert.ok(Poison_resistance());const hp=game.u.uhp,mh=game.u.mh,attrs=[...game.u.acurr.a];game.oldcap=4;
 await settle(run);initRng(1);await poisoned('blast',A_STR,'poisoned blast',15,false);
 assert.deepEqual([game.u.uhp,game.u.mh,game.u.acurr.a,game.oldcap],[hp,mh,attrs,4]);assert.deepEqual(getRngLog(),[]);assert.match(game._toplines,/poison doesn't seem to affect you/);
});
for(const [reason,expect] of [['needle','The needle was poisoned!'],['spikes','The spikes were poisoned!'],["Orcus's sting","Orcus's sting was poisoned!"],['poison dart',null],['blast',null]]){
 await test(`poison announcement: ${reason}`,async()=>{const run=await boot();await settle(run);initRng(5);await poisoned(reason,A_CON,'poisoned needle',15,false);
 const messages=[...seen.flatMap(s=>[s.text,s.pending]),game._toplines].filter(Boolean).join('\n');if(expect)assert.ok(messages.includes(expect));else assert.ok(!messages.includes('was poisoned!')&&!messages.includes('were poisoned!'));
 });
}
for(const [killer,name,format] of [['Chromatic Dragon','the Chromatic Dragon',KILLED_BY],['Norn','the Norn',KILLED_BY],['high priest','the high priest',KILLED_BY],
 ["Master of Thieves' ghost","the Master of Thieves' ghost",KILLED_BY],['Asmodeus','Asmodeus',KILLED_BY],['a snake','a snake',KILLED_BY],['little dart','little dart',KILLED_BY_AN]]){
 await test(`fatal killer naming: ${killer}`,async()=>{const run=await boot(),o=await amulet();await directFatal(run,killer);saved(o);
  assert.ok(seen.some(s=>s.killer===name&&s.format===format),JSON.stringify(seen));
 });
}
for(const [input,expected] of [["Norn's corpse","the Norn's corpse"],['Nornish','Nornish'],['norn','the norn'],['Asmodeus corpse','the Asmodeus corpse'],
 ['Mordor orc','the Mordor orc'],['Robe named Staff of Power','Robe named Staff of Power'],
 ['THE needle','tHE needle']]){
 await test(`required article helper: ${input}`,async()=>{await boot();assert.equal(the(input),expected);});
}
await test('required article helper: actual bogusmon type gets an article',async()=>{
 await boot();assert.equal(the('Luggage'),'the Luggage');assert.equal(the('Luggageish'),'Luggageish');
});
clearTimeout(deadline);const report={total:results.length,passed:results.filter(s=>s.pass).length,results};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed}));
