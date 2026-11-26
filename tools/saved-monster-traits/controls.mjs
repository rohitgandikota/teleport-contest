// Public producers and owners; mutations below are labelled constructed C states.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../../js/jsmain.js';
import {InMemoryStorage} from '../../js/storage.js';
import {game as g} from '../../js/gstate.js';
import {resetInputState} from '../../js/input.js';
import {mkcorpstat,get_mtraits,copy_oextra} from '../../js/mkobj.js';
import {makemon} from '../../js/makemon.js';
import * as mon from '../../js/mon.js';
import * as shk from '../../js/shk.js';
import {montraits} from '../../js/zap.js';
import {mon_track_add} from '../../js/monmove.js';
import {ONAMES} from '../../js/objects_data.js';
import {PMNAMES} from '../../js/monst_data.js';
import {CORPSTAT_NONE,MON_DETACH,NO_MINVENT,MM_NOMSG,MM_NOTAIL,MM_EPRI,LS_MONSTER} from '../../js/const.js';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const results=[],timer=setTimeout(()=>{console.error('55s source bound');process.exit(2);},55000);
async function fresh(kind='keeper'){
    const name=kind==='dead'?'traits-proposal-02':'proposal-02';
    const part=JSON.parse(readFileSync(new URL(`../gen-sessions/evidence/saved-monster-traits-owner/${name}.json`,import.meta.url))).segments[0];
    if(kind==='billed')part.moves+=',  \x1b\x1b';
    const run=await runSegment({...part,storage:new InMemoryStorage()});
    let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<80);return 32;};
    g._preNhgetchHook=null;resetInputState();
    const keeper=g.level.monsters.find(m=>m.m_id===97);
    return {run,keeper,corpse:g.level.objects.find(o=>o.oextra?.omonst?.isshk)};
}
async function check(name,body){const r={name};try{await body(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,400);}results.push(r);}
const handle=m=>({oextra:{omonst:m}});
const save=m=>mkcorpstat(ONAMES.STATUE,m,m.data,m.mx,m.my,CORPSTAT_NONE).oextra.omonst;
await check('save_mtraits copies bill value but preserves active pointer',async()=>{
    const {keeper}=await fresh('billed'),e=keeper.eshk,saved=save(keeper);
    assert.equal(e.billct,1);assert.notEqual(saved.eshk,e);assert.notEqual(saved.eshk.bill,e.bill);
    assert.deepEqual(saved.eshk.bill,e.bill);assert.equal(saved.eshk.bill_p,e.bill_p);
});
await check('get_mtraits true copies live pointer fields without cloning their targets',async()=>{
    const {keeper,run}=await fresh('billed'),before=run.getRngLog().slice(),copy=get_mtraits(handle(keeper),true);
    assert.notEqual(copy,keeper);assert.notEqual(copy.mextra,keeper.mextra);
    assert.equal(copy.minvent,keeper.minvent);assert.equal(copy.mw,keeper.mw);assert.equal(copy.data,keeper.data);
    assert.equal(copy.eshk.bill_p,keeper.eshk.bill_p);assert.notEqual(copy.eshk.bill,keeper.eshk.bill);
    assert.deepEqual(run.getRngLog(),before,'pure copy consumes no RNG');
});
await check('get_mtraits false returns saved record and restores canonical data',async()=>{
    const {keeper}=await fresh(),saved=save(keeper),obj=handle(saved);
    assert.equal(saved.data,null);assert.equal(get_mtraits(obj,false),saved);assert.equal(saved.data,g.mons[saved.mnum]);
    assert.equal(get_mtraits({},true),null);assert.equal(get_mtraits({},false),null);
});
await check('save clears list inventory weapon pointers and detached state',async()=>{
    const {keeper}=await fresh();keeper.nmon=g.level.monsters.find(m=>m!==keeper);
    keeper.mstate|=MON_DETACH;keeper.wormno=3;const saved=save(keeper);
    assert.equal(saved.nmon,null);assert.equal(saved.data,null);assert.equal(saved.minvent,null);assert.equal(saved.mw,null);
    assert.equal(saved.wormno,0);assert.equal(saved.mstate&MON_DETACH,0);
});
await check('saved permanent species derives from data rather than cached mnum',async()=>{
    const {keeper}=await fresh(),actual=keeper.data.pmidx;keeper.mnum=PMNAMES.PM_NEWT;
    assert.equal(save(keeper).mnum,actual);
});
await check('save clamps drained and negative HP without changing original',async()=>{
    const {keeper}=await fresh();keeper.mhpmax=0;keeper.mhp=-7;const saved=save(keeper);
    assert.equal(saved.mhpmax,keeper.data.mlevel+1);assert.equal(saved.mhp,0);assert.equal(keeper.mhp,-7);assert.equal(keeper.mhpmax,0);
    keeper.mhp=900;assert.equal(save(keeper).mhp,keeper.data.mlevel+1);
});
await check('mtrack producer and mgoal are value copied by save and get',async()=>{
    const {keeper}=await fresh();mon_track_add(keeper,74,9);mon_track_add(keeper,74,8);keeper.mgoal={x:73,y:9};
    const saved=save(keeper),copy=get_mtraits(handle(saved),true);
    assert.deepEqual(copy.mtrack,keeper.mtrack);assert.deepEqual(copy.mgoal,keeper.mgoal);
    keeper.mtrack[0].x=4;keeper.mgoal.x=5;
    assert.equal(saved.mtrack[0].x,74);assert.equal(copy.mtrack[0].x,74);assert.equal(saved.mgoal.x,73);assert.equal(copy.mgoal.x,73);
    saved.mtrack[0].y=6;saved.mgoal.y=7;assert.equal(copy.mtrack[0].y,8);assert.equal(copy.mgoal.y,9);
});
for(const pointer of [null,-1000])await check(`saved copies preserve inactive bill pointer ${pointer}`,async()=>{
    const {keeper}=await fresh();keeper.eshk.bill_p=pointer;
    const saved=save(keeper),copy=get_mtraits(handle(saved),true);
    assert.equal(saved.eshk.bill_p,pointer);assert.equal(copy.eshk.bill_p,pointer);
    assert.notEqual(saved.eshk.bill,keeper.eshk.bill);assert.notEqual(copy.eshk.bill,saved.eshk.bill);
});
await check('copy_oextra retains two-stage saved-traits pointer semantics',async()=>{
    const {keeper}=await fresh('billed'),a=mkcorpstat(ONAMES.STATUE,keeper,keeper.data,keeper.mx,keeper.my,0),b={};
    copy_oextra(b,a);const copy=get_mtraits(b,true);
    assert.equal(copy.eshk.bill_p,keeper.eshk.bill_p);assert.notEqual(copy.eshk.bill,a.omonst.eshk.bill);
});
await check('priest entry timers reset before the saved copy',async()=>{
    await fresh();const priest=await makemon(g.mons[PMNAMES.PM_ALIGNED_CLERIC],0,0,NO_MINVENT|MM_NOMSG|MM_EPRI);
    assert.equal(priest.mnum,PMNAMES.PM_ALIGNED_CLERIC);
    priest.ispriest=1;priest.epri=priest.mextra.epri;
    Object.assign(priest.epri,{intone_time:10,enter_time:11,peaceful_time:12,hostile_time:13});
    const saved=save(priest);assert.notEqual(saved.epri,priest.epri);
    for(const key of ['intone_time','enter_time','peaceful_time','hostile_time'])assert.equal(saved.epri[key],0);
});
await check('ordinary dead keeper revival replaces residency and leaves corpse snapshot intact',async()=>{
    const {corpse}=await fresh('dead'),saved=corpse.omonst;
    assert.equal(saved.mhp,0);assert.equal(g.level.rooms[7].resident,null);
    const revived=await montraits(corpse,{x:corpse.ox,y:corpse.oy},false);
    assert.ok(revived&&revived.isshk&&revived.mrevived&&revived.mhp>0);assert.notEqual(revived,saved);
    assert.equal(saved.mhp,0);assert.equal(g.level.rooms[7].resident,revived);
    assert.equal(g.level.monAt.get(`${revived.mx},${revived.my}`),revived);assert.equal(g.level.monsters[0],revived);
});
await check('occupied exact-position revival fails without changing lists or saved record',async()=>{
    const {keeper}=await fresh(),obj=mkcorpstat(ONAMES.STATUE,keeper,keeper.data,keeper.mx,keeper.my,0);
    const before=g.level.monsters.slice(),saved=obj.omonst;
    assert.equal(await montraits(obj,{x:keeper.mx,y:keeper.my},false),null);
    assert.deepEqual(g.level.monsters,before);assert.equal(obj.omonst,saved);
});
await check('replacement transfers real inventory map list and remembered polearm target',async()=>{
    const {keeper,run}=await fresh(),copy=get_mtraits(handle(keeper),true),items=keeper.minvent.slice();
    assert.ok(items.length);assert.equal(typeof mon.replmon,'function');
    g.context.polearm={...g.context.polearm,hitmon:keeper};const rng=run.getRngLog().slice();
    await mon.replmon(keeper,copy);
    assert.equal(g.context.polearm.hitmon,copy);assert.equal(keeper.minvent,null);
    assert.ok(!g.level.monsters.includes(keeper));assert.equal(g.level.monsters[0],copy);
    assert.equal(g.level.monAt.get(`${copy.mx},${copy.my}`),copy);assert.ok(items.every(o=>o.ocarry===copy));
    assert.equal(g.level.rooms[7].resident,copy);assert.equal(copy.eshk.bill_p,copy.eshk.bill);
    assert.deepEqual(run.getRngLog(),rng);
});
await check('replacement releases a real held monster through relmon before final pointer check',async()=>{
    const {keeper}=await fresh(),copy=get_mtraits(handle(keeper),true);assert.equal(typeof mon.replmon,'function');
    mon.set_ustuck(keeper);await mon.replmon(keeper,copy);assert.equal(g.u.ustuck,null);assert.equal(g.u.uswallow,0);
});
await check('mounted map exclusion and steed reference survive replacement',async()=>{
    const part=JSON.parse(readFileSync(new URL('../gen-sessions/recipes/mounted-movement-owner.json',import.meta.url))).segments.find(s=>s.name==='mounted-wait-negative');
    const run=await runSegment({...part,storage:new InMemoryStorage()});
    run._display.onEmptyQueue=()=>32;g._preNhgetchHook=null;resetInputState();
    const old=g.u.usteed;assert.ok(old&&old.mhp>0);const copy=get_mtraits(handle(old),true);
    assert.equal(typeof mon.replmon,'function');await mon.replmon(old,copy);
    assert.equal(g.u.usteed,copy);assert.ok(![...g.level.monAt.values()].includes(copy));
    assert.ok(!g.level.monsters.includes(old)&&g.level.monsters.includes(copy));
});
await check('replacement preserves one luminous owner and fresh light flags under numeric IDs',async()=>{
    await fresh();const old=await makemon(g.mons[PMNAMES.PM_YELLOW_LIGHT],0,0,NO_MINVENT|MM_NOMSG),copy=get_mtraits(handle(old),true);
    const lights=g.light_sources.filter(s=>s.type===LS_MONSTER&&s.id===old.m_id);assert.equal(lights.length,1);
    lights[0].flags=1;const rest=g.light_sources.filter(s=>!lights.includes(s));
    assert.equal(typeof mon.replmon,'function');await mon.replmon(old,copy);
    const current=g.light_sources.filter(s=>s.type===LS_MONSTER&&s.id===copy.m_id);assert.equal(current.length,1);
    assert.equal(current[0].flags,0);assert.deepEqual(g.light_sources.filter(s=>!current.includes(s)),rest);
    assert.equal(g.level.monsters.find(m=>m.m_id===current[0].id),copy);
});
await check('long-worm revival uses a real fresh head without restoring saved tail',async()=>{
    await fresh();const old=await makemon(g.mons[PMNAMES.PM_LONG_WORM],0,0,NO_MINVENT|MM_NOMSG|MM_NOTAIL),obj=mkcorpstat(ONAMES.STATUE,old,old.data,old.mx,old.my,0);
    assert.ok(old.wormno);assert.equal(obj.omonst.wormno,0);
    await mon.mongone(old);mon.dmonsfree();const revived=await montraits(obj,{x:obj.ox,y:obj.oy},false);
    assert.ok(revived&&revived.wormno);assert.equal(g.level.monAt.get(`${revived.mx},${revived.my}`),revived);
    const w=g.worms;assert.equal(w.wtails[revived.wormno],w.wheads[revived.wormno]);
});
for(const shops of ['', 'x\n', '\n'])await check(`replshk uses first-shop predicate ${JSON.stringify(shops)}`,async()=>{
    const {keeper}=await fresh(),copy=get_mtraits(handle(keeper),true);copy.eshk.bill_p=-1000;g.u.ushops=shops;
    assert.equal(typeof shk.replshk,'function');shk.replshk(keeper,copy);assert.equal(g.level.rooms[7].resident,copy);
    assert.equal(copy.eshk.bill_p,shops==='\n'?copy.eshk.bill:-1000);
});
clearTimeout(timer);
const report={classification:'constructed C states on real public producers, separately from ordinary witnesses',nativeParityClaimed:false,
    total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error})),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
