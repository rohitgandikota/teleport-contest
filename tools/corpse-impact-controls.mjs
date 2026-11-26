// Constructed C states on actual keyboard, item, monster and combat producers.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game as g} from '../js/gstate.js';
import {resetInputState} from '../js/input.js';
import {hmon,known_hitum} from '../js/uhitm.js';
import {minstapetrify} from '../js/trap.js';
import {munstone} from '../js/muse.js';
import {mksobj,set_corpsenm} from '../js/mkobj.js';
import {weight} from '../js/invent.js';
import {mpickobj} from '../js/steal.js';
import {makemon} from '../js/makemon.js';
import {m_dowear,mon_adjust_speed} from '../js/worn.js';
import {newcham,dmonsfree} from '../js/mon.js';
import {resists_ston} from '../js/mondata.js';
import {corpse_xname} from '../js/objnam.js';
import {pline} from '../js/display.js';
import {make_hallucinated} from '../js/potion.js';
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES,ATTKS} from '../js/monst_data.js';
import {HMON_MELEE,MON_DETACH,NO_MINVENT,MM_NOMSG,NORMAL_SPEED,
    W_AMUL,NON_PM,CXN_ARTICLE,CXN_PFX_THE} from '../js/const.js';
import {hash} from './half-damage-reader-observe.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const recipe=JSON.parse(readFileSync(new URL('./gen-sessions/recipes/corpse-impact-owner.json',import.meta.url)));
const results=[],timer=setTimeout(()=>{console.error('55s source bound');process.exit(2);},55000);
async function fresh(){
    const run=await runSegment({...recipe.segments[1],storage:new InMemoryStorage()});
    let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<100);return 32;};
    g._preNhgetchHook=null;resetInputState();
    const keeper=g.level.monsters.find(m=>m.m_id===97),corpse=g.u.uwep;
    assert.ok(keeper&&keeper.mhp===46&&keeper.mpeaceful);
    assert.equal(corpse.otyp,ONAMES.CORPSE);assert.equal(corpse.corpsenm,PMNAMES.PM_COCKATRICE);
    assert.ok(g.u.uarmg);assert.equal(g.level.monAt.get('74,9'),keeper);
    return {run,keeper,corpse};
}
async function check(name,body){const r={name};try{await body(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,500);}results.push(r);}
const impact=(m,o)=>hmon(m,o,HMON_MELEE,1);
const statue=m=>g.level.objects.find(o=>o.otyp===ONAMES.STATUE&&o.oextra?.omonst?.m_id===m.m_id);
async function give(m,type,species,quantity=1){
    const obj=mksobj(type,false,false);
    if(species!==undefined)set_corpsenm(obj,species);
    obj.quan=quantity;obj.owt=weight(obj);
    await mpickobj(m,obj);assert.ok(m.minvent.includes(obj));return obj;
}
const newTarget=species=>makemon(g.mons[species],0,0,NO_MINVENT|MM_NOMSG);
function detached(m,before){
    assert.equal(m.mhp,0);assert.ok(![...g.level.monAt.values()].includes(m));
    assert.ok(g.level.monsters.includes(m));assert.ok(m.mstate&MON_DETACH);
    assert.equal(g.iflags.purge_monsters,before+1);
}
await check('ordinary producer reaches known corpse and living mapped keeper',async()=>{
    const {keeper,corpse}=await fresh();assert.equal(corpse.o_id,141);assert.equal(corpse.quan,1);
    assert.deepEqual(keeper.minvent.map(o=>o.o_id).sort((a,b)=>a-b),[99,101,103,105]);
    assert.equal(g.level.rooms[keeper.eshk.shoproom-3].resident,keeper);
});
await check('existing minstapetrify creates saved statue and defers list purge',async r=>{
    const {keeper}=await fresh(),items=keeper.minvent.map(o=>o.o_id).sort((a,b)=>a-b),before=g.iflags.purge_monsters||0;
    await minstapetrify(keeper,true);detached(keeper,before);
    const obj=statue(keeper);assert.ok(obj);assert.equal(obj.oextra.omonst.mhp,0);
    assert.deepEqual(obj.cobj.map(o=>o.o_id).sort((a,b)=>a-b),items);
    assert.equal(g.level.rooms[keeper.eshk.shoproom-3].resident,null);
    dmonsfree();assert.ok(!g.level.monsters.includes(keeper));assert.equal(g.iflags.purge_monsters,0);
    r.savedID=obj.oextra.omonst.m_id;
});
await check('corpse impact returns death before generic damage and saves real inventory',async r=>{
    const {keeper,corpse,run}=await fresh(),items=keeper.minvent.map(o=>o.o_id).sort((a,b)=>a-b),before=g.iflags.purge_monsters||0;
    const calls=run.getRngLog().length,kills=g.u.uconduct.killer||0;
    assert.equal(await impact(keeper,corpse),false);detached(keeper,before);
    const obj=statue(keeper);assert.ok(obj);assert.equal(obj.oextra.omonst.m_id,97);
    assert.deepEqual(obj.cobj.map(o=>o.o_id).sort((a,b)=>a-b),items);
    assert.equal(g.u.uwep,corpse);assert.ok(g.invent.includes(corpse));assert.equal(corpse.quan,1);
    assert.equal(g.u.uconduct.killer,kills+1);assert.equal(!!g.stoned,false);
    r.tailSHA256=hash(run.getRngLog().slice(calls));
});
await check('fatal known_hitum skips survivor RNG and preserves nonweapon conduct',async r=>{
    let f=await fresh(),start=f.run.getRngLog().length;await impact(f.keeper,f.corpse);
    const direct=f.run.getRngLog().slice(start);
    f=await fresh();start=f.run.getRngLog().length;const hit=[1],before=g.u.uconduct.weaphit||0;
    assert.equal(await known_hitum(f.keeper,f.corpse,hit,20,0,{aatyp:ATTKS.AT_WEAP,adtyp:ATTKS.AD_PHYS,damn:0,damd:0},1),false);
    assert.deepEqual(f.run.getRngLog().slice(start),direct);assert.equal(hit[0],1);assert.equal(g.u.uconduct.weaphit||0,before);
    r.tailSHA256=hash(direct);
});
await check('direct munstone consumes a real lizard and charges one movement',async()=>{
    const {keeper}=await fresh(),obj=await give(keeper,ONAMES.CORPSE,PMNAMES.PM_LIZARD),movement=keeper.movement;
    assert.equal(await munstone(keeper,true),true);assert.ok(!keeper.minvent.includes(obj));
    assert.equal(keeper.mhp,46);assert.equal(keeper.movement,movement-NORMAL_SPEED);assert.equal(keeper.mlstmv,g.moves);
});
for(const quantity of [1,2])await check(`lizard cure ${quantity} prevents stone and physical damage`,async()=>{
    const {keeper,corpse}=await fresh(),obj=await give(keeper,ONAMES.CORPSE,PMNAMES.PM_LIZARD,quantity),movement=keeper.movement;
    keeper.mconf=1;keeper.mstun=1;
    assert.equal(await impact(keeper,corpse),true);assert.equal(keeper.mhp,46);assert.ok(keeper.mpeaceful);
    assert.equal(!!statue(keeper),false);assert.equal(keeper.mconf,0);assert.equal(keeper.mstun,0);
    assert.equal(keeper.movement,movement-NORMAL_SPEED);assert.equal(keeper.mlstmv,g.moves);assert.ok(keeper.meating>0);
    if(quantity===1)assert.ok(!keeper.minvent.includes(obj));
    else{assert.ok(keeper.minvent.includes(obj));assert.equal(obj.quan,1);assert.equal(obj.owt,weight(obj));}
});
await check('surviving cure reaches known_hitum survivor RNG and hit-to-miss conversion',async r=>{
    const {keeper,corpse,run}=await fresh();await give(keeper,ONAMES.CORPSE,PMNAMES.PM_LIZARD);
    const start=run.getRngLog().length,hit=[1];
    assert.equal(await known_hitum(keeper,corpse,hit,20,0,{aatyp:ATTKS.AT_WEAP,adtyp:ATTKS.AD_PHYS,damn:0,damd:0},1),true);
    assert.equal(keeper.mhp,46);assert.equal(hit[0],0);
    const tail=run.getRngLog().slice(start);assert.match(tail.at(-1),/^rn2\(25\)/);r.tailSHA256=hash(tail);
});
await check('acid cure death returns false without statue or pacifism credit',async r=>{
    const {keeper,corpse,run}=await fresh(),obj=await give(keeper,ONAMES.POT_ACID),kills=g.u.uconduct.killer||0;
    keeper.mhp=1;const start=run.getRngLog().length;
    assert.equal(await impact(keeper,corpse),false);assert.equal(keeper.mhp,0);assert.equal(!!statue(keeper),false);
    assert.ok(!keeper.minvent.includes(obj));assert.equal(g.u.uconduct.killer||0,kills);
    const tail=run.getRngLog().slice(start);assert.equal(tail.filter(s=>/^rnd\(15\)/.test(s)).length,1);r.tailSHA256=hash(tail);
});
await check('worn lifesaving producer prevents statue and extra physical damage',async()=>{
    const {keeper,corpse}=await fresh(),amulet=await give(keeper,ONAMES.AMULET_OF_LIFE_SAVING);
    await m_dowear(keeper,true);assert.ok(amulet.owornmask&W_AMUL);keeper.mhp=12;
    assert.equal(await impact(keeper,corpse),true);assert.equal(keeper.mhp,keeper.mhpmax);
    assert.ok(!keeper.minvent.includes(amulet));assert.equal(!!statue(keeper),false);assert.equal(!!g.stoned,false);
    assert.equal(g.level.monAt.get(`${keeper.mx},${keeper.my}`),keeper);
});
for(const state of ['meating','helpless'])await check(`${state} excludes carried lizard cure`,async()=>{
    const {keeper,corpse}=await fresh(),obj=await give(keeper,ONAMES.CORPSE,PMNAMES.PM_LIZARD);
    if(state==='meating')keeper.meating=2;else{keeper.mcanmove=0;keeper.mfrozen=2;}
    assert.equal(await impact(keeper,corpse),false);assert.ok(statue(keeper).cobj.includes(obj));
});
await check('real speed producer is cleared by petrification cure',async()=>{
    const {keeper,corpse}=await fresh();await give(keeper,ONAMES.CORPSE,PMNAMES.PM_LIZARD);
    await mon_adjust_speed(keeper,1,null);assert.equal(keeper.permspeed,2);
    assert.equal(await impact(keeper,corpse),true);assert.equal(keeper.permspeed,0);assert.equal(keeper.mspeed,0);
});
await check('stone-resistant target retains physical impact damage',async()=>{
    const {corpse}=await fresh(),m=await newTarget(PMNAMES.PM_STONE_GOLEM),hp=m.mhp;
    assert.ok(resists_ston(m));assert.equal(await impact(m,corpse),true);assert.equal(m.mhp,hp-1);
    assert.equal(!!statue(m),false);
});
await check('golem transformation is rechecked before physical damage',async()=>{
    const {corpse}=await fresh(),m=await newTarget(PMNAMES.PM_FLESH_GOLEM);
    assert.ok(!resists_ston(m));assert.equal(await impact(m,corpse),true);
    assert.equal(m.mnum,PMNAMES.PM_STONE_GOLEM);assert.ok(resists_ston(m));assert.equal(m.mhp,m.mhpmax-1);
});
await check('real vampire shape producer reverts before corpse early return',async()=>{
    const {corpse}=await fresh(),m=await newTarget(PMNAMES.PM_VAMPIRE);
    await newcham(m,g.mons[PMNAMES.PM_VAMPIRE_BAT],0);assert.equal(m.cham,PMNAMES.PM_VAMPIRE);
    assert.equal(m.mnum,PMNAMES.PM_VAMPIRE_BAT);m.mhp=1;
    assert.equal(await impact(m,corpse),true);assert.equal(m.mnum,PMNAMES.PM_VAMPIRE);
    assert.equal(m.cham,NON_PM);assert.equal(m.mhp,m.mhpmax);assert.equal(!!statue(m),false);
});
await check('real sandestin shape producer gains stone resistance before damage',async()=>{
    const {corpse}=await fresh(),m=await newTarget(PMNAMES.PM_SANDESTIN);
    await newcham(m,g.mons[PMNAMES.PM_NEWT],0);assert.equal(m.cham,PMNAMES.PM_SANDESTIN);
    assert.equal(await impact(m,corpse),true);assert.equal(m.mnum,PMNAMES.PM_SANDESTIN);
    assert.ok(resists_ston(m));assert.equal(m.mhp,m.mhpmax-1);
});
for(const species of [PMNAMES.PM_NEWT,PMNAMES.PM_HUMAN,PMNAMES.PM_GRAY_DRAGON,NON_PM])await check(`nonpetrifying corpse damage uses size ${species}`,async r=>{
    const {keeper}=await fresh(),obj=mksobj(ONAMES.CORPSE,false,false);
    // NON_PM is the C paranoia state, not a valid timer producer species.
    if(species===NON_PM)obj.corpsenm=NON_PM;else set_corpsenm(obj,species);
    const expected=(g.mons[species]?.msize||0)+1;
    assert.equal(await impact(keeper,obj),true);assert.equal(keeper.mhp,46-expected);
    assert.equal(!!statue(keeper),false);r.damage=expected;
});
for(const known of [false,true])await check(`corpse naming and observation known=${known}`,async()=>{
    const {keeper,corpse}=await fresh();corpse.dknown=known;
    assert.equal(corpse_xname(corpse,null,known?CXN_PFX_THE:CXN_ARTICLE),`${known?'the':'a'} cockatrice corpse`);
    assert.equal(await impact(keeper,corpse),false);assert.ok(corpse.dknown);
});
await check('hallucination producer leaves unknown corpse unobserved',async()=>{
    const {keeper,corpse}=await fresh();await make_hallucinated(20,false,0);corpse.dknown=false;
    assert.equal(await impact(keeper,corpse),false);assert.equal(!!corpse.dknown,false);
});
await check('pending hit message precedes observation and fatal side effects',async r=>{
    const {keeper,corpse,run}=await fresh();corpse.dknown=false;
    await pline('The pending message fills this line before the next corpse impact is displayed.');
    let release,entered;const pending=new Promise(resolve=>{entered=resolve;});
    run._display.onEmptyQueue=()=>new Promise(resolve=>{release=resolve;entered();});
    let finished=false;const operation=impact(keeper,corpse).then(value=>{finished=true;return value;});
    try{
        await Promise.race([pending,operation]);assert.ok(release&&!finished,'real pending input reached');
        r.pending={hp:keeper.mhp,known:!!corpse.dknown,statue:!!statue(keeper)};
        assert.equal(keeper.mhp,46);assert.equal(!!corpse.dknown,false);assert.equal(!!statue(keeper),false);
    }finally{run._display.onEmptyQueue=()=>32;if(release)release(32);await operation;}
    assert.equal(keeper.mhp,0);assert.ok(corpse.dknown);assert.ok(statue(keeper));
});
clearTimeout(timer);
const report={classification:'constructed C states using real public producers and owners',nativeParityClaimed:false,
    total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
