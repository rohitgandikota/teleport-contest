// Constructed C-source contracts using real owners and producers, not native evidence.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url),mod=n=>import(new URL('js/'+n+'.js',root));
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const {setup,seed,clearMessages,messages,form}=await import(new URL('tools/status-followup-test-setup.mjs',root));
const G=await mod('gstate'),C=await mod('const'),T=await mod('trap'),Y=await mod('youprop');
const {ONAMES:O}=await mod('objects_data'),{PMNAMES:P}=await mod('monst_data');
const {boulder_hits_pool}=await mod('do'),{mksobj,place_object}=await mod('mkobj');
const {maketrap}=await mod('mklev'),{set_levltyp}=await mod('mkmaze');
const {getRngLog,rn2}=await mod('rng'),{set_itimeout}=await mod('potion');
const {makemon}=await mod('makemon'),{set_uinwater}=await mod('hack');
const {obfree}=await mod('invent'),{pline}=await mod('display');
let g,x,y;
const reports=[],deadline=setTimeout(()=>{console.error('40 second bound');process.exit(2);},40000);
async function check(name,fn){const r={name};try{await fn(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,900);}
    reports.push(r);console.log(r.pass?'PASS':'FAIL',name,r.error||'');}
async function start(){const run=await setup();g=G.game;x=g.u.ux;y=g.u.uy;g.level.flags.sokoban_rules=0;return run;}
async function trap(type,xx=x,yy=y){const t=await maketrap(xx,yy,type);assert.ok(t);return t;}
function chance(r,predicate){for(let s=1;s<=80;s++){seed(s);const n=rn2(10);if(predicate(n)){r.seed=s;r.chance=n;seed(s);return;}}throw Error('bounded real seed search exhausted');}
async function hit(r,o,xx=x,yy=y,pushing=false){clearMessages();r.result=await boulder_hits_pool(o,xx,yy,pushing);r.text=messages();r.rng=[...getRngLog()];return r.result;}
const floor=['SQKY_BOARD','BEAR_TRAP','LANDMINE','FIRE_TRAP','PIT','SPIKED_PIT','HOLE','TRAPDOOR','TELEP_TRAP','LEVEL_TELEP','WEB','MAGIC_TRAP','ANTI_MAGIC'];
const nonfloor=['ARROW_TRAP','DART_TRAP','ROCKTRAP','ROLLING_BOULDER_TRAP','SLP_GAS_TRAP','RUST_TRAP','MAGIC_PORTAL','STATUE_TRAP','POLY_TRAP','VIBRATING_SQUARE'];
for(const name of floor)await check('delfloortrap removes '+name,async r=>{
    await start();const t=await trap(C[name]);T.set_utrap(5,C.TT_BEARTRAP);seed();
    r.result=await T.delfloortrap(t);assert.equal(r.result,true);assert.ok(!g.level.traps.includes(t));assert.equal(g.u.utrap,0);assert.equal(g.u.utraptype,C.TT_NONE);assert.deepEqual(getRngLog(),[]);
});
for(const name of nonfloor)await check('delfloortrap retains '+name,async r=>{
    await start();const t=await trap(C[name]);T.set_utrap(5,C.TT_BEARTRAP);seed();
    r.result=await T.delfloortrap(t);assert.equal(r.result,false);assert.ok(g.level.traps.includes(t));assert.equal(g.u.utrap,5);assert.deepEqual(getRngLog(),[]);
});
await check('delfloortrap null negative',async()=>{await start();seed();assert.equal(await T.delfloortrap(null),false);assert.deepEqual(getRngLog(),[]);});
for(const kind of ['null','rock'])await check('invalid '+kind+' diagnoses before returning false',async r=>{
    await start();const o=kind==='null'?null:mksobj(O.ROCK,false,false);seed();await hit(r,o);
    assert.equal(r.result,false);assert.deepEqual(r.rng,[]);assert.ok(g.impossible_log?.includes('Not a boulder?'));assert.equal(g.program_state.in_impossible,0);
    assert.match(r.text,/Program in disorder!/);if(o)assert.equal(o.where,C.OBJ_FREE);
});
await check('valid boulder on dry floor draws nothing',async r=>{await start();const o=mksobj(O.BOULDER,false,false);seed();await hit(r,o);assert.equal(r.result,false);assert.deepEqual(r.rng,[]);assert.equal(o.where,C.OBJ_FREE);assert.equal(r.text,'');});
for(const name of ['ARROW_TRAP','PIT','WEB','BEAR_TRAP'])await check('pool filling applies floor filter '+name,async r=>{
    await start();const t=await trap(C[name]);if(name!=='ARROW_TRAP')T.set_utrap(5,name==='PIT'?C.TT_PIT:C.TT_WEB);
    set_levltyp(x,y,C.POOL);const o=mksobj(O.BOULDER,false,false);chance(r,n=>n!==0);await hit(r,o);
    assert.equal(r.result,true);assert.equal(g.level.at(x,y).typ,C.ROOM);assert.equal(g.level.traps.includes(t),name==='ARROW_TRAP');assert.equal(g.u.utrap,0);assert.equal(o.where,C.OBJ_DELETED);assert.equal(o.next_boulder,0);
});
for(const name of ['ARROW_TRAP','PIT'])await check('sinking keeps trap and confinement '+name,async r=>{
    await start();const t=await trap(C[name]);T.set_utrap(5,C.TT_PIT);set_levltyp(x,y,C.POOL);
    const o=mksobj(O.BOULDER,false,false);chance(r,n=>n===0);await hit(r,o);
    assert.equal(g.level.at(x,y).typ,C.POOL);assert.ok(g.level.traps.includes(t));assert.equal(g.u.utrap,5);assert.match(r.text,/sinks without a trace/);assert.equal(o.where,C.OBJ_DELETED);
});
await check('buried-ball confinement survives floor trap deletion',async r=>{
    await start();const t=await trap(C.WEB);T.set_utrap(7,C.TT_BURIEDBALL);set_levltyp(x,y,C.POOL);
    const o=mksobj(O.BOULDER,false,false);chance(r,n=>n!==0);await hit(r,o);assert.ok(!g.level.traps.includes(t));assert.equal(g.u.utrap,7);assert.equal(g.u.utraptype,C.TT_BURIEDBALL);
});
for(const prop of ['HLevitation','HFlying'])await check('pool release resumes '+prop,async r=>{
    await start();await trap(C.WEB);set_itimeout(prop,50);T.set_utrap(5,C.TT_WEB);
    assert.equal(prop==='HLevitation'?!!Y.Levitation():!!Y.Flying(),false);set_levltyp(x,y,C.POOL);
    const o=mksobj(O.BOULDER,false,false);chance(r,n=>n!==0);await hit(r,o);assert.equal(g.u.utrap,0);
    assert.equal(prop==='HLevitation'?!!Y.Levitation():!!Y.Flying(),true);
    assert.match(r.text,prop==='HLevitation'?/start to float in the air/:/can fly/);
});
for(const [type,roll,filled] of [['POOL',0,false],['POOL',1,true],['MOAT',1,true],['WATER',4,true],['WATER',5,false],['LAVAPOOL',0,true],['LAVAPOOL',1,false],['LAVAWALL',0,true]])await check(type+' chance '+roll,async r=>{
    await start();const xx=x+3;set_levltyp(xx,y,C[type]);const o=mksobj(O.BOULDER,false,false);chance(r,n=>n===roll);await hit(r,o,xx,y);
    assert.equal(r.result,true);assert.equal(g.level.at(xx,y).typ,filled?C.ROOM:C[type]);assert.equal(o.where,C.OBJ_DELETED);assert.equal(r.rng.length,1);
});
for(const roll of [0,1])await check('water plane never fills chance '+roll,async r=>{
    await start();g.u.uz={...g.water_level};set_levltyp(x+3,y,C.POOL);const o=mksobj(O.BOULDER,false,false);
    chance(r,n=>n===roll);await hit(r,o,x+3,y);assert.equal(g.level.at(x+3,y).typ,C.POOL);assert.equal(o.where,C.OBJ_DELETED);assert.equal(r.rng.length,1);
});
for(const under of [C.DB_MOAT,C.DB_LAVA])await check('drawbridge under '+under+' mask retained',async r=>{
    await start();const xx=x+3;set_levltyp(xx,y,C.DRAWBRIDGE_UP);g.level.at(xx,y).drawbridgemask=C.DB_EAST|under;
    const o=mksobj(O.BOULDER,false,false);chance(r,n=>under===C.DB_LAVA?n===0:n!==0);await hit(r,o,xx,y);
    assert.equal(g.level.at(xx,y).typ,C.DRAWBRIDGE_UP);assert.equal(g.level.at(xx,y).drawbridgemask,C.DB_EAST|C.DB_FLOOR);
});
for(const floorTrap of [false,true])await check('airborne trapped monster floor '+floorTrap,async r=>{
    await start();const xx=x+3;const t=await trap(floorTrap?C.WEB:C.ARROW_TRAP,xx,y);
    const m=await makemon(g.mons[P.PM_BAT],xx,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOMSG);assert.ok(m);m.mtrapped=1;
    set_levltyp(xx,y,C.POOL);const o=mksobj(O.BOULDER,false,false);chance(r,n=>n!==0);await hit(r,o,xx,y);
    assert.ok(m.mhp>0);assert.equal(m.mtrapped,floorTrap?0:1);assert.equal(g.level.traps.includes(t),!floorTrap);
});
await check('already dead monster is not killed twice',async r=>{
    await start();const xx=x+3,m=await makemon(g.mons[P.PM_NEWT],xx,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOMSG);assert.ok(m);m.mhp=0;
    const pending=g.pending_purge;set_levltyp(xx,y,C.POOL);const o=mksobj(O.BOULDER,false,false);chance(r,n=>n!==0);await hit(r,o,xx,y);
    assert.equal(g.pending_purge,pending);assert.equal(r.rng.length,1);
});
await check('burial precedes splash and boulder disposal',async r=>{
    await start();const xx=x+3,item=mksobj(O.DAGGER,false,false);place_object(item,xx,y);set_levltyp(xx,y,C.POOL);
    const o=mksobj(O.BOULDER,false,false);chance(r,n=>n!==0);await hit(r,o,xx,y);
    assert.equal(item.where,C.OBJ_BURIED);assert.ok(!g.level.objects.includes(item));assert.equal(o.where,C.OBJ_DELETED);assert.match(r.text,/large splash/);
});
await check('underwater self returns to dry land',async r=>{
    await start();set_levltyp(x,y,C.POOL);await set_uinwater(1);const o=mksobj(O.BOULDER,false,false);chance(r,n=>n!==0);await hit(r,o);
    assert.equal(g.u.uinwater,0);assert.equal(g.vision_full_recalc,0); /* C pline.c266 consumes the recalc before feedback. */assert.match(r.text,/dry land again/);assert.ok(!r.text.includes('splash'));
});
for(const fill of [false,true])await check('pushed boulder consumed fill '+fill,async r=>{
    await start();const xx=x+2,o=mksobj(O.BOULDER,false,false);place_object(o,x+1,y);set_levltyp(xx,y,C.POOL);
    chance(r,n=>!!n===fill);await hit(r,o,xx,y,true);assert.equal(o.where,C.OBJ_DELETED);assert.ok(!g.level.objects.includes(o));assert.equal(r.text.includes('Now you can cross it!'),fill);assert.equal(r.text.includes('large splash'),!fill);
});
await check('pit deletion clears reciprocal bit and finishes Sokoban',async r=>{
    await start();const t=await trap(C.PIT),other=await trap(C.PIT,x+1,y);t.conjoined=1<<C.DIR_E;other.conjoined=1<<C.DIR_W;other.madeby_u=1;g.level.flags.sokoban_rules=1;
    set_levltyp(x,y,C.POOL);const o=mksobj(O.BOULDER,false,false);chance(r,n=>n!==0);await hit(r,o);assert.equal(other.conjoined,0);assert.equal(!!g.level.flags.sokoban_rules,false);
});
for(const kind of ['levitation before unlink','obfree diagnostic before return'])await check(kind,async r=>{
    const run=await start();let t,o=mksobj(O.BOULDER,false,false),xx=x;
    if(kind.startsWith('levitation')){t=await trap(C.WEB);set_itimeout('HLevitation',50);T.set_utrap(5,C.TT_WEB);set_levltyp(x,y,C.POOL);}
    else{await obfree(o);set_levltyp(x,y,C.POOL);await set_uinwater(1);xx=x+3;set_levltyp(xx,y,C.POOL);}
    chance(r,n=>n!==0);clearMessages();if(t)await pline('Previous message before the floor changes.');
    let arrived,release,timer,finished=false;
    const atRead=new Promise(resolve=>{arrived=resolve;});
    run._display.onEmptyQueue=()=>{r.pending={utrap:g.u.utrap,levitating:!!Y.Levitation(),trapPresent:t?g.level.traps.includes(t):null,inImpossible:g.program_state.in_impossible||0};arrived();return new Promise(resolve=>{release=resolve;});};
    const work=boulder_hits_pool(o,xx,y,false).then(v=>{finished=true;r.result=v;});
    try{await Promise.race([atRead,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('pending message not reached')),2000);})]);await setImmediate();r.returnedWhileBlocked=finished;}
    finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;release?.(32);await work;for(let n=0;n<20&&g.program_state.in_impossible;n++)await setImmediate();}
    assert.equal(r.returnedWhileBlocked,false);assert.equal(r.result,true);
    if(t){assert.equal(r.pending.utrap,0);assert.equal(r.pending.levitating,true);assert.equal(r.pending.trapPresent,true);assert.ok(!g.level.traps.includes(t));}
    else{assert.equal(r.pending.inImpossible,1);assert.equal(g.program_state.in_impossible,0);}
});
clearTimeout(deadline);
const report={evidence:'Constructed source contracts with real producers and RNG. No native or ordinary-reach claim.',passed:reports.filter(r=>r.pass).length,total:reports.length,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));if(report.passed!==report.total)process.exitCode=1;
