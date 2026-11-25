// Constructed C contract controls through the real public movement caller.
// Usage: node tools/forcefight-state-gate.mjs [compact-report.json]
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {setImmediate} from 'node:timers/promises';
import {setup,clearMessages,messages,seed,form,mount,x,y} from './status-followup-test-setup.mjs';
import {game as g} from '../js/gstate.js';
import * as C from '../js/const.js';
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {domove} from '../js/cmd.js';
import {mksobj,place_object} from '../js/mkobj.js';
import {addinv_nomerge,weight} from '../js/invent.js';
import {setuwep_with_feedback,setuswapwep} from '../js/wield.js';
import {artifact_exists} from '../js/artifact.js';
import {makeknown} from '../js/o_init.js';
import {maketrap} from '../js/mklev.js';
import {seetrap,set_utrap} from '../js/trap.js';
import {set_levltyp} from '../js/mkmaze.js';
import {set_itimeout,make_blinded} from '../js/potion.js';
import {makemon} from '../js/makemon.js';
import {sleep_monst} from '../js/mhitm.js';
import {t_at} from '../js/mon.js';
import {getRngLog} from '../js/rng.js';
import {use_skill,add_weapon_skill,uwep_skill_type} from '../js/weapon.js';
import {bot,pline,newsym,map_invisible,glyph_is_invisible_at,glyph_at} from '../js/display.js';
import {hash} from './half-damage-reader-observe.mjs';

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const results=[],timer=setTimeout(()=>{console.error('55 second source-worker bound');process.exit(2);},55000);
const snap=()=>({xy:[g.u.ux,g.u.uy],move:g.context.move,moved:!!g.u.umoved,
    success:g.domove_succeeded||0,trap:t_at(x+1,y)?.ttyp||0,
    terrain:g.level.at(x+1,y).typ,practice:g.u.weapon_skills[uwep_skill_type()]?.advance,
    wield:g.u.uwep?.otyp??null,quan:g.u.uwep?.quan??0,conduct:g.u.uconduct?.weaphit||0,
    rng:[...getRngLog()],text:messages()});
async function check(name,body){const r={name};try{await body(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,850);}
    results.push(r);}
async function start(){const run=await setup();g.flags.paranoia_bits=0;g.context.run=0;
    g.u.uhp=g.u.uhpmax=1000;g.u.umoved=false;g.u.dx=1;g.u.dy=g.u.dz=0;
    g.u.acurr.a[C.A_STR]=18;g.u.atemp.a[C.A_STR]=0;return run;}
async function item(type,{quan=1,spe=0,artifact=null,secondary=false}={}){
    const obj=mksobj(type,false,false);Object.assign(obj,{quan,spe});obj.owt=weight(obj);
    if(artifact)artifact_exists(obj,artifact,true,C.ONAME_WISH);
    await addinv_nomerge(obj);if(secondary)await setuswapwep(obj);else await setuwep_with_feedback(obj);return obj;
}
function web(seen=true,type=C.WEB){const t=maketrap(x+1,y,type);assert.ok(t);if(seen)seetrap(t);newsym(x+1,y);return t;}
function bars(){assert.equal(set_levltyp(x+1,y,C.IRONBARS),true);newsym(x+1,y);}
function skill(level=C.P_BASIC){const k=uwep_skill_type();Object.assign(g.u.weapon_skills[k],{skill:level,max:C.P_GRAND_MASTER,advance:0});return k;}
async function walk({force=true,rng=2,clear=true}={}){if(clear)clearMessages();seed(rng);
    g.context.forcefight=force;g.domove_attempting=C.DOMOVE_WALK;g.context.move=1;await domove();}
function stayed(r){r.after=snap();assert.deepEqual(r.after.xy,[x,y]);assert.equal(r.after.move,1);assert.equal(r.after.moved,false);}

for(const quan of [1,3])await check(quan===1?'bars singleton mirror':'bars legal potion stack split',async r=>{
    await start();bars();makeknown(O.POT_WATER);const obj=await item(quan===1?O.MIRROR:O.POT_WATER,{quan});const luck=g.u.uluck;await walk();stayed(r);
    assert.equal(g.u.uluck,luck-(quan===1?2:0));assert.equal(g.u.uwep,quan===1?null:obj);
    assert.equal(g.invent.includes(obj),quan>1);if(quan>1){assert.equal(obj.quan,2);assert.ok(obj.owornmask&C.W_WEP);}
    assert.deepEqual(r.after.rng,quan===1?['rn2(100)=33','rn2(100)=82']:['rn2(100)=33','rnd(2)=1','rn2(100)=8']);
    assert.match(r.after.text,quan===1?/shatters into a thousand pieces/:/potion of water shatters/);
});
await check('bars resistance preserves singleton',async r=>{
    await start();bars();const obj=await item(O.MIRROR);const luck=g.u.uluck;await walk({rng:167});stayed(r);
    assert.equal(g.u.uwep,obj);assert.ok(g.invent.includes(obj));assert.equal(g.u.uluck,luck);
    assert.deepEqual(r.after.rng,['rn2(100)=0']);assert.match(r.after.text,/Clonk!/);
});
for(const type of [O.DAGGER,O.TOWEL,O.GOLD_PIECE])await check('bars nonbreakable sound '+type,async r=>{
    await start();bars();const obj=await item(type);await walk();stayed(r);assert.equal(g.u.uwep,obj);
    assert.deepEqual(r.after.rng,['rn2(100)=33']);assert.match(r.after.text,type===O.TOWEL?/Whap!/:type===O.GOLD_PIECE?/Clink!/:/Clonk!/);
});
for(const rng of [2,4])await check('bars hammer melee floor chance '+rng,async r=>{
    await start();bars();await item(O.WAR_HAMMER,{spe:100});await walk({rng});stayed(r);
    assert.deepEqual(r.after.rng,rng===2?['rn2(100)=33','rn2(2)=0']:['rn2(100)=58','rn2(2)=1']);
    assert.equal(r.after.terrain===C.IRONBARS,rng===4);assert.equal(r.after.text.includes('break the bars apart'),rng===2);
});
await check('bars ball uses weight not enchantment',async r=>{
    await start();bars();await item(O.HEAVY_IRON_BALL,{spe:100});await walk();stayed(r);
    assert.match(r.after.rng[1],/^rn2\(19\)=/);assert.equal(r.after.rng.length,2);assert.match(r.after.text,/Whang!/);
});
for(const nondig of [false,true])await check('bars acid dissolution '+nondig,async r=>{
    await start();bars();if(nondig)g.level.at(x+1,y).wall_info|=C.W_NONDIGGABLE;
    makeknown(O.POT_ACID);await item(O.POT_ACID);await walk();stayed(r);assert.equal(g.u.uwep,null);
    assert.equal(r.after.terrain===C.IRONBARS,nondig);assert.equal(r.after.rng.filter(s=>s.startsWith('rn2(100)')).length,2);
    assert.match(r.after.text,nondig?/hissing noise/:/iron bars are dissolved/);
});
for(const deaf of [false,true])await check('bars sound wakes actual sleeping monster '+deaf,async r=>{
    await start();bars();await item(O.DAGGER);
    const m=await makemon(g.mons[P.PM_GRID_BUG],x+2,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(m);assert.equal(await sleep_monst(m,0,-1),1);if(deaf)set_itimeout('HDeaf',20);
    await walk();stayed(r);assert.equal(m.msleeping,0);assert.equal(r.after.text.includes('Clonk!'),!deaf);
    assert.deepEqual(r.after.rng,['rn2(100)=33']);
});
await check('bars blind break feedback',async r=>{
    await start();bars();await item(O.MIRROR);await make_blinded(20,false);await walk();stayed(r);
    assert.match(r.after.text,/hear something shatter/);assert.equal(g.u.uwep,null);
});
await check('bars protected invocation object skips resistance draw',async r=>{
    await start();bars();const obj=await item(O.BELL_OF_OPENING);await walk();stayed(r);
    assert.equal(g.u.uwep,obj);assert.ok(g.invent.includes(obj));assert.deepEqual(r.after.rng,[]);assert.match(r.after.text,/Clink!/);
});
for(const rng of [2,12])await check('bars crackable armor resistance '+rng,async r=>{
    await start();bars();const obj=await item(O.CRYSTAL_PLATE_MAIL);await walk({rng});stayed(r);
    assert.equal(g.u.uwep,rng===2?obj:null);assert.equal(g.invent.includes(obj),rng===2);
    assert.equal(obj.oeroded||0,rng===2?0:1);assert.deepEqual(r.after.rng,[rng===2?'rn2(100)=33':'rn2(100)=93']);
    if(rng===12){assert.equal(obj.where,C.OBJ_FREE);assert.match(r.after.text,/cracks!/);assert.match(r.after.text,/Clonk!/);}
});

for(const [level,bound,roll] of [[0,50,33],[1,50,33],[2,45,43],[3,40,13],[4,35,8],[5,30,13],[6,25,8]])
    for(const str of [3,125])await check(`web bare skill ${level} strength ${str}`,async r=>{
        await start();web();skill(level);g.u.acurr.a[C.A_STR]=str;await walk();stayed(r);
        const success=str===125&&roll<=23;
        assert.equal(!!t_at(x+1,y),!success);assert.equal(r.after.practice,success&&level?1:0);
        assert.deepEqual(r.after.rng,[`rn2(${bound})=${roll}`]);assert.equal(r.after.conduct,0);
        assert.match(r.after.text,success?/punch through the web/:/thrash ineffectually/);
    });
for(const str of [14,15,16])await check('web blade threshold strength '+str,async r=>{
    await start();web();await item(O.DAGGER);skill();g.u.acurr.a[C.A_STR]=str;await walk();stayed(r);
    assert.equal(!!t_at(x+1,y),str===14);assert.equal(r.after.practice,str===14?0:1);
    assert.deepEqual(r.after.rng,['rn2(20)=13']);assert.equal(r.after.conduct,0);
});
for(const spe of [-1,0,1])await check('web enchantment threshold '+spe,async r=>{
    await start();web();await item(O.DAGGER,{spe});skill();g.u.acurr.a[C.A_STR]=15;await walk();stayed(r);
    assert.equal(!!t_at(x+1,y),spe<0);assert.equal(r.after.practice,spe<0?0:1);assert.deepEqual(r.after.rng,['rn2(20)=13']);
});
for(const [str,spe,success] of [[18,-4,false],[19,-4,true],[49,-5,false],[50,-5,true],
    [99,-6,false],[100,-6,true],[121,-7,false],[122,-7,true],[125,-10,true]])await check(`web encoded strength ${str} enchantment ${spe}`,async r=>{
    await start();web();await item(O.DAGGER,{spe});skill();g.u.acurr.a[C.A_STR]=str;
    await walk();stayed(r);assert.equal(!!t_at(x+1,y),!success);assert.deepEqual(r.after.rng,['rn2(20)=13']);
});
for(const type of [O.AXE,O.DWARVISH_MATTOCK])await check('web actual C blade macro includes '+type,async r=>{
    await start();web();await item(type);skill();await walk();stayed(r);
    assert.equal(t_at(x+1,y),null);assert.equal(r.after.practice,1);assert.match(r.after.text,/cut through the web/);
    assert.deepEqual(r.after.rng,['rn2(20)=13']);
});
for(const [type,artifact,verb] of [[O.ELVEN_DAGGER,'Sting','cuts'],[O.LONG_SWORD,'Fire Brand','burns']])await check('web artifact '+artifact,async r=>{
    await start();web();const obj=await item(type,{artifact,spe:-100});assert.ok(obj.oartifact);skill(0);
    g.u.acurr.a[C.A_STR]=3;await walk();stayed(r);assert.equal(t_at(x+1,y),null);assert.equal(r.after.practice,0);
    assert.deepEqual(r.after.rng,['rn2(20)=13']);assert.match(r.after.text,new RegExp(artifact+' '+verb+' through the web!'));
});
for(const [type,quan,word] of [[O.MACE,1,'a mace'],[O.MACE,3,'maces'],[O.PARTISAN,1,'a polearm'],
    [O.LEATHER_ARMOR,1,'armor'],[O.FOOD_RATION,1,'food'],[O.ACID_VENOM,1,'venom'],[O.PICK_AXE,1,'a pick-axe']])
    await check('web nonblade '+type+' quantity '+quan,async r=>{
        await start();web();await item(type,{quan});await walk();stayed(r);
        assert.ok(t_at(x+1,y));assert.deepEqual(r.after.rng,['rn2(20)=13']);assert.equal(r.after.text,`You can't cut a web with ${word}!`);
    });
for(const second of [O.MACE,O.CLUB,O.DAGGER])await check('web two weapons '+second,async r=>{
    await start();web();await item(O.MACE);await item(second,{secondary:true});g.u.twoweap=true;skill();
    await walk();stayed(r);assert.deepEqual(r.after.rng,['rn2(20)=13']);assert.equal(r.after.conduct,0);
    if(second===O.DAGGER){assert.equal(t_at(x+1,y),null);assert.equal(r.after.practice,1);}
    else {assert.ok(t_at(x+1,y));assert.match(r.after.text,second===O.MACE?/with maces!/:/with a mace or a club!/);}
});
await check('web two weapons uses primary enchantment',async r=>{
    await start();web();await item(O.MACE,{spe:-100});await item(O.DAGGER,{secondary:true,spe:100});g.u.twoweap=true;skill();
    await walk();stayed(r);assert.ok(t_at(x+1,y));assert.equal(r.after.practice,0);assert.match(r.after.text,/hack ineffectually/);
});
await check('web distinct secondary plural',async r=>{
    await start();web();await item(O.MACE);await item(O.CLUB,{quan:2,secondary:true});g.u.twoweap=true;skill();
    await walk();stayed(r);assert.ok(t_at(x+1,y));assert.equal(r.after.text,"You can't cut a web with a mace or clubs!");
    assert.deepEqual(r.after.rng,['rn2(20)=13']);
});
await check('web actual practice crosses skill threshold',async r=>{
    await start();web();await item(O.DAGGER);const k=skill();await add_weapon_skill(1);await use_skill(k,79);
    assert.equal(g.u.weapon_skills[k].advance,79);await walk();stayed(r);
    assert.equal(r.after.practice,80);assert.equal(t_at(x+1,y),null);assert.match(r.after.text,/more confident in your weapon skills/);
    assert.deepEqual(r.after.rng,['rn2(20)=13']);
});
await check('web success redraws formerly visible trap',async r=>{
    await start();web();await item(O.DAGGER);skill();r.beforeGlyph=structuredClone(glyph_at(x+1,y));
    await walk();stayed(r);r.afterGlyph=structuredClone(glyph_at(x+1,y));
    assert.equal(t_at(x+1,y),null);assert.notDeepEqual(r.afterGlyph,r.beforeGlyph);
});
for(const kind of ['unseen','pit','none'])await check('web gate '+kind,async r=>{
    await start();if(kind!=='none')web(kind!=='unseen',kind==='pit'?C.PIT:C.WEB);await item(O.DAGGER);
    await walk();stayed(r);assert.deepEqual(r.after.rng,[]);assert.match(r.after.text,/attack thin air/);
    assert.equal(!!t_at(x+1,y),kind!=='none');
});
await check('web no force uses actual trap movement',async r=>{
    await start();web();await item(O.DAGGER);await walk({force:false});r.after=snap();assert.deepEqual(r.after.xy,[x+1,y]);
    assert.ok(g.u.utrap);assert.ok(t_at(x+1,y));assert.doesNotMatch(r.after.text,/cut through the web/);
});
await check('bars no force leaves wielded mirror',async r=>{
    await start();bars();const obj=await item(O.MIRROR);await walk({force:false});r.after=snap();
    assert.deepEqual(r.after.xy,[x,y]);assert.equal(g.u.uwep,obj);assert.deepEqual(r.after.rng,[]);
});
await check('bars no weapon uses empty owner',async r=>{
    await start();bars();await walk();stayed(r);assert.match(r.after.text,/harmlessly attack the iron bars/);assert.deepEqual(r.after.rng,[]);
});
await check('bars precede web',async r=>{
    await start();bars();web();await item(O.DAGGER);await walk();stayed(r);assert.ok(t_at(x+1,y));
    assert.deepEqual(r.after.rng,['rn2(100)=33']);assert.match(r.after.text,/Clonk!/);
});
for(const kind of ['rooted','steed','current-pit','current-web'])await check('web precedes movement guard '+kind,async r=>{
    await start();if(kind==='rooted'){form(P.PM_BLUE_JELLY);g.u.mh=g.u.mhmax=100;}
    if(kind==='steed'){await mount();g.u.ux=x;g.u.usteed.mx=x;await sleep_monst(g.u.usteed,0,-1);}
    if(kind.startsWith('current-')){maketrap(x,y,kind==='current-pit'?C.PIT:C.WEB);set_utrap(3,kind==='current-pit'?C.TT_PIT:C.TT_WEB);}
    web();await item(O.ELVEN_DAGGER,{artifact:'Sting'});await walk();stayed(r);assert.equal(t_at(x+1,y),null);
    assert.doesNotMatch(r.after.text,/rooted|won't move|still in a pit|stuck to the web/);if(kind.startsWith('current-'))assert.equal(g.u.utrap,3);
});
await check('attack precedes web',async r=>{
    await start();web();await item(O.DAGGER);const m=await makemon(g.mons[P.PM_GRID_BUG],x+1,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(m);await walk();stayed(r);assert.ok(t_at(x+1,y));assert.doesNotMatch(r.after.text,/through the web|ineffectually/);
    assert.ok(r.after.rng.length>1);assert.ok(r.after.conduct>0);
});
await check('actual displacer bypasses terrain owners',async r=>{
    await start();web();await item(O.DAGGER);const m=await makemon(g.mons[P.PM_DISPLACER_BEAST],x+1,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(m);m.mux=x;m.muy=y;await walk({rng:4});r.after=snap();assert.deepEqual(r.after.xy,[x+1,y]);
    assert.equal(m.mx,x);assert.ok(t_at(x+1,y));assert.match(r.after.text,/swaps places with you/);assert.doesNotMatch(r.after.text,/cut through the web/);
});
for(const nopick of [false,true])await check('empty stale memory '+nopick,async r=>{
    await start();map_invisible(x+1,y);g.context.nopick=nopick;await walk({force:false});r.after=snap();
    assert.equal(g.u.ux,x+(nopick?1:0));assert.equal(glyph_is_invisible_at(x+1,y),false);
    assert.equal(r.after.text.includes('attack thin air'),!nopick);assert.deepEqual(r.after.rng,[]);
});
await check('web return precedes invisible cleanup',async r=>{
    await start();web();await item(O.ELVEN_DAGGER,{artifact:'Sting'});map_invisible(x+1,y);await walk();stayed(r);
    assert.equal(t_at(x+1,y),null);assert.ok(glyph_is_invisible_at(x+1,y));assert.deepEqual(r.after.rng,['rn2(20)=13']);
});
await check('empty pick dispatch retains real digging occupation',async r=>{
    await start();await item(O.PICK_AXE);const b=mksobj(O.BOULDER,false,false);place_object(b,x+1,y);newsym(x+1,y);
    await walk();stayed(r);assert.equal(typeof g.occupation,'function');assert.match(r.after.text,/start hitting the boulder/);assert.deepEqual(r.after.rng,[]);
});
await check('empty no weapon preserves boulder mapping',async r=>{
    await start();const b=mksobj(O.BOULDER,false,false);place_object(b,x+1,y);newsym(x+1,y);
    await walk();stayed(r);assert.ok(g.level.objects.includes(b));assert.equal(glyph_at(x+1,y).kind,'obj');
    assert.match(r.after.text,/harmlessly attack a boulder/);assert.deepEqual(r.after.rng,[]);
});

for(const phase of ['cut-message','skill-threshold','bars-break'])await check('pending '+phase,async r=>{
    const run=await start();let trap,obj,k;
    if(phase==='bars-break'){bars();obj=await item(O.MIRROR);}
    else {trap=web();await item(O.DAGGER);k=skill();if(phase==='skill-threshold'){await add_weapon_skill(1);await use_skill(k,79);}}
    clearMessages();await bot();if(phase!=='skill-threshold')await pline('A long message keeps this line occupied before the next movement attempt.');
    let reached,release,finished=false,guard;const pending=new Promise(resolve=>{reached=resolve;});
    run._display.onEmptyQueue=()=>{r.pending=snap();reached();return new Promise(resolve=>{release=resolve;});};
    const work=walk({clear:false}).then(()=>{finished=true;});
    try {await Promise.race([pending,work.then(()=>{throw Error('no pending feedback');}),
        new Promise((_,reject)=>{guard=setTimeout(()=>reject(Error('feedback timeout')),1500);})]);
        await setImmediate();assert.equal(finished,false);
        if(phase==='bars-break'){assert.equal(g.u.uwep,null);assert.equal(g.invent.includes(obj),false);}
        else {assert.equal(t_at(x+1,y),trap);assert.equal(r.pending.practice,phase==='skill-threshold'?80:0);}
    } finally {clearTimeout(guard);run._display.onEmptyQueue=()=>32;if(release)release(32);await work;}
    stayed(r);if(phase!=='bars-break')assert.equal(t_at(x+1,y),null);
});

clearTimeout(timer);
assert.equal(results.length,85);
const report={evidence:'constructed public-owner controls with real producers; no native claim',
    total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,evidenceSHA256:hash(results),firstFailure:results.find(r=>!r.pass)||null}));
if(report.passed!==report.total)process.exitCode=1;
