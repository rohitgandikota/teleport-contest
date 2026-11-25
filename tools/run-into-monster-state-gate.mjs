// C hack.c:2712 domove_core, especially 2765-2773. Constructed public-owner controls.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {game as g} from '../js/gstate.js';
import * as C from '../js/const.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {domove,rhack} from '../js/cmd.js';
import {Blind,Protection_from_shape_changers,Detect_monsters} from '../js/youprop.js';
import {is_safemon,mon_visible,sensemon,newsym} from '../js/display.js';
import {set_itimeout,make_blinded,make_confused,dopotion} from '../js/potion.js';
import {makemon,set_mimic_sym,hideunder} from '../js/makemon.js';
import {tamedog} from '../js/dog.js';
import {mksobj,place_object} from '../js/mkobj.js';
import {addinv_nomerge} from '../js/invent.js';
import {oname} from '../js/do_name.js';
import {Blindf_on,Ring_on} from '../js/do_wear.js';
import {setworn,mon_set_minvis} from '../js/worn.js';
import {doapply} from '../js/apply.js';
import {M_AP_TYPE} from '../js/const.js';
import {set_levltyp} from '../js/mkmaze.js';
import {vision_reset,vision_recalc} from '../js/vision.js';
import {getRngLog} from '../js/rng.js';
import {setup,form,x,y,seed,clearMessages,messages} from './status-followup-test-setup.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const results=[],hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const bound=setTimeout(()=>{console.error('55 second source bound');process.exit(2);},55000);
const flags=C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG|C.MM_ANGRY;
function vision(){vision_reset();vision_recalc();}
function state(mon){return {blind:Blind(),cached:!!g.u.ublind,xy:[g.u.ux,g.u.uy],origin:[g.u.ux0,g.u.uy0],bhitpos:g.bhitpos,
    run:g.context.run,move:g.context.move,multi:g.multi,travel:g.context.travel,mv:g.context.mv,
    hp:g.u.uhp,mon:mon&&{hp:mon.mhp,xy:[mon.mx,mon.my],appearance:M_AP_TYPE(mon),hidden:!!mon.mundetected,
        peaceful:!!mon.mpeaceful,tame:!!mon.mtame,safe:is_safemon(mon),visible:mon_visible(mon),sense:sensemon(mon)},text:messages(),rng:[...getRngLog()]};}
async function fresh(){const run=await setup();g.flags.safe_dog=true;g.flags.runmode=C.RUN_TPORT;
    Object.assign(g.context,{run:0,move:1,travel:0,travel1:0,mv:0});g.multi=0;g.u.dx=-1;g.u.dy=0;
    await domove();assert.deepEqual([g.u.ux,g.u.uy,g.u.ux0,g.u.uy0],[x-1,y,x,y]);assert.deepEqual(g.bhitpos,{x:x-1,y});
    clearMessages();seed();return run;}
async function monster(pm=P.PM_NEWT){const mon=await makemon(g.mons[pm],x,y,flags);assert.ok(mon);assert.equal(g.level.monAt.get(`${x},${y}`),mon);return mon;}
async function ring(otyp){const obj=mksobj(otyp,false,false);await addinv_nomerge(obj);await setworn(obj,C.W_RINGL);await Ring_on(obj);return obj;}
async function blind(source,run){
    if(source==='setter'||source==='timeout-clear')await make_blinded(20,false);
    if(source==='timeout-set')set_itimeout('HBlinded',20);
    if(source==='timeout-clear')set_itimeout('HBlinded',0);
    if(source==='blindfold'){const obj=mksobj(O.BLINDFOLD,false,false);await addinv_nomerge(obj);await Blindf_on(obj);}
    if(source==='eyeless')form(P.PM_GRAY_OOZE);
    if(source==='cream-eyes'){
        const eyes=await oname(mksobj(O.LENSES,false,false),'The Eyes of the Overworld',0);await addinv_nomerge(eyes);await Blindf_on(eyes);
        const pie=mksobj(O.CREAM_PIE,false,false);await addinv_nomerge(pie);clearMessages();const keys=[pie.invlet.charCodeAt(0)];let reads=0;
        run._display.onEmptyQueue=()=>{assert.ok(++reads<20);return keys.shift()??32;};
        assert.equal(await doapply(),C.ECMD_OK);assert.ok(g.u.ucreamed>0);assert.ok(g.u.intrinsic.HBlinded>0);assert.equal(Blind(),false);
    }
    vision();
}
async function detect(){const obj=mksobj(O.POT_MONSTER_DETECTION,false,false);obj.blessed=1;await addinv_nomerge(obj);await dopotion(obj);assert.ok(Detect_monsters());}
function arm(run=3,nopick=false){Object.assign(g.context,{run,move:1,travel:0,travel1:0,mv:1,nopick:+nopick});g.multi=12;g.u.dx=1;g.u.dy=0;clearMessages();seed();}
async function drive(r,mon,stop,run=3,nopick=false,stopDraws=[]){
    vision();if(mon)newsym(mon.mx,mon.my);arm(run,nopick);r.before=state(mon);const hp=mon?.mhp;
    await domove();r.after=state(mon);
    assert.ok(g.u.uhp>0);assert.equal(g.u.umortality||0,0);
    if(stop){assert.deepEqual([g.u.ux,g.u.uy],[x-1,y]);assert.deepEqual([g.u.ux0,g.u.uy0],[x,y],'guard precedes movement origin');
        assert.deepEqual(g.bhitpos,{x:x-1,y},'guard precedes target recording');
        assert.equal(g.context.move,0);assert.equal(g.context.run,0);assert.equal(g.multi,0);assert.equal(g.context.mv,0);
        assert.equal(g.context.travel,0);assert.equal(g.context.travel1,0);assert.equal(mon?.mhp,hp);assert.equal(messages(),'');assert.deepEqual(getRngLog(),stopDraws);
    }else{assert.deepEqual([g.u.ux0,g.u.uy0],[x-1,y],'continue into ordinary bump/attack/movement');assert.deepEqual(g.bhitpos,{x,y});assert.equal(g.context.move,1);}
}
async function check(name,body){const r={name};try{await body(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,350);}
    if(r.after)r.after={...r.after,rng:r.after.rng.length,hash:hash(r.after)};results.push(r);}

for(const source of ['sighted','setter','timeout-set','timeout-clear','cream-eyes'])for(const run of [0,1,3])
await check(`canonical ${source} run ${run}`,async r=>{const runtime=await fresh();const mon=await monster();await blind(source,runtime);
    const shouldStop=run!==0&&['sighted','timeout-clear','cream-eyes'].includes(source);await drive(r,mon,shouldStop,run);});
for(const source of ['blindfold','eyeless'])await check(`${source} bypasses unsensed guard`,async r=>{const runtime=await fresh();const mon=await monster();await blind(source,runtime);assert.ok(Blind());await drive(r,mon,false);});
for(const mode of ['invisible','see-invisible','invisible-blind','sensed-invisible'])await check(`visibility ${mode}`,async r=>{
    const runtime=await fresh(),mon=await monster();mon_set_minvis(mon,false);assert.ok(mon.minvis);
    if(mode==='see-invisible')await ring(O.RIN_SEE_INVISIBLE);
    if(mode==='invisible-blind'||mode==='sensed-invisible')await blind('timeout-set',runtime);
    if(mode==='sensed-invisible')await detect();
    assert.equal(mon_visible(mon),mode==='see-invisible');assert.equal(sensemon(mon),mode==='sensed-invisible');
    await drive(r,mon,mode==='see-invisible'||mode==='sensed-invisible');
});
for(const source of ['sighted','setter','timeout-set','timeout-clear'])await check(`real detection overrides ${source}`,async r=>{
    const runtime=await fresh(),mon=await monster();await blind(source,runtime);await detect();assert.ok(sensemon(mon));await drive(r,mon,true);
});
for(const [source,mindless,stop]of [['setter',false,true],['timeout-set',false,true],['timeout-clear',false,true],['setter',true,false],['timeout-set',true,false]])
await check(`form telepathy ${source} mindless ${mindless}`,async r=>{
    const runtime=await fresh();form(P.PM_MIND_FLAYER);const mon=await monster(mindless?P.PM_ACID_BLOB:P.PM_NEWT);await blind(source,runtime);
    assert.equal(sensemon(mon),source!=='timeout-clear'&&!mindless);await drive(r,mon,stop);
});
await check('generic warning does not sense a blind target',async r=>{const runtime=await fresh();const mon=await monster();await ring(O.RIN_WARNING);await blind('timeout-set',runtime);assert.equal(sensemon(mon),false);await drive(r,mon,false);});
for(const detected of [false,true])await check(`real hidden snake detection ${detected}`,async r=>{
    await fresh();const obj=mksobj(O.LARGE_BOX,false,false);place_object(obj,x,y);const mon=await monster(P.PM_GARTER_SNAKE);assert.ok(await hideunder(mon));assert.ok(mon.mundetected);
    if(detected)await detect();assert.equal(mon_visible(mon),false);await drive(r,mon,detected);
});
for(const kind of ['object','furniture'])for(const mode of ['disguised','detected','ring-revealed','protected-disguise'])
await check(`mimic ${kind} ${mode}`,async r=>{
    await fresh();if(kind==='object')place_object(mksobj(O.LARGE_BOX,false,false),x,y);
    else {assert.ok(set_levltyp(x,y,C.DOOR));g.level.at(x,y).doormask=C.D_ISOPEN;}
    const mon=await monster(P.PM_SMALL_MIMIC);const appearance=kind==='object'?C.M_AP_OBJECT:C.M_AP_FURNITURE;assert.equal(M_AP_TYPE(mon),appearance);
    if(mode==='detected')await detect();
    let pendingRing;
    if(mode==='ring-revealed'){
        await ring(O.RIN_PROTECTION_FROM_SHAPE_CHAN);assert.ok(Protection_from_shape_changers());assert.equal(M_AP_TYPE(mon),C.M_AP_NOTHING);assert.ok(mon.msleeping);
        set_mimic_sym(mon);assert.equal(M_AP_TYPE(mon),C.M_AP_NOTHING,'protection prevents a new disguise');
    }else if(mode==='protected-disguise'){
        pendingRing=mksobj(O.RIN_PROTECTION_FROM_SHAPE_CHAN,false,false);await addinv_nomerge(pendingRing);await setworn(pendingRing,C.W_RINGL);
        assert.ok(Protection_from_shape_changers());assert.equal(M_AP_TYPE(mon),appearance);
        r.classification='constructed intermediate setworn-to-Ring_on state, not ordinary command reach';
    }
    await drive(r,mon,mode!=='disguised');
    if(pendingRing){await Ring_on(pendingRing);assert.equal(M_AP_TYPE(mon),C.M_AP_NOTHING);}
});
for(const mode of ['safe','confused','option-off','blind-unsensed','blind-detected'])await check(`real pet ${mode}`,async r=>{
    const runtime=await fresh(),mon=await monster(P.PM_LITTLE_DOG);assert.ok(await tamedog(mon,null,false));assert.ok(mon.mpeaceful&&mon.mtame);
    if(mode==='confused')await make_confused(20,false);
    if(mode==='option-off')g.flags.safe_dog=false;
    if(mode.startsWith('blind'))await blind('timeout-set',runtime);
    if(mode==='blind-detected')await detect();
    assert.equal(is_safemon(mon),mode==='safe'||mode==='blind-detected');
    // nopick causes the real bump/pardon path for safe pets, avoiding arbitrary swap RNG.
    await drive(r,mon,mode==='confused'||mode==='option-off',3,true,mode==='confused'?['rn2(5)=3']:[]);
});
await check('no monster continues movement',async r=>{await fresh();await drive(r,null,false);assert.deepEqual([g.u.ux,g.u.uy],[x,y]);});
for(const source of ['sighted','timeout-set','timeout-clear'])await check(`public keyboard prefix ${source}`,async r=>{
    const runtime=await fresh(),mon=await monster();await blind(source,runtime);clearMessages();seed();
    await rhack('G'.charCodeAt(0));assert.equal(g.context.run,3);r.before=state(mon);await rhack('l'.charCodeAt(0));r.after=state(mon);
    const stop=source!=='timeout-set';assert.deepEqual([g.u.ux0,g.u.uy0],stop?[x,y]:[x-1,y]);assert.equal(g.context.move,stop?0:1);
});
clearTimeout(bound);
const report={classification:'constructed public-owner controls with real producers',total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>r.name),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
