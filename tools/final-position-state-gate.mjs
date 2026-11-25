// C dungeon.c:1548-1601. Constructed public-owner controls with real producers.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game as g} from '../js/gstate.js';
import * as C from '../js/const.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {Race_if} from '../js/u_init.js';
import {u_on_newpos,teleds,TELEDS_TELEPORT} from '../js/teleport.js';
import {domove} from '../js/cmd.js';
import {hurtle_step} from '../js/dothrow.js';
import {move_into_trap} from '../js/trap.js';
import {set_levltyp,place_lregion as mazePlace,LR_UPTELE} from '../js/mkmaze.js';
import {place_lregion as startupPlace,u_on_upstairs,maketrap} from '../js/mklev.js';
import {mksobj,place_object} from '../js/mkobj.js';
import {obj_extract_self} from '../js/invent.js';
import {bury_objs} from '../js/dig.js';
import {Blind,Flying,Levitation,Hallucination} from '../js/youprop.js';
import {set_itimeout,make_blinded,make_hallucinated} from '../js/potion.js';
import {set_uasmon,body_part} from '../js/polyself.js';
import {makeplural} from '../js/objnam.js';
import {setworn} from '../js/worn.js';
import {resetInputState} from '../js/input.js';
import {vision_reset,vision_recalc,cansee} from '../js/vision.js';
import {pline} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {x,y,mount,seed,clearMessages,messages} from './status-followup-test-setup.mjs';
import {hash} from './half-damage-reader-observe.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
// BEGIN mandatory canonical C preflight. Integrity is not a native replay.
const canonicalSHA=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonicalRecipeBytes=readFileSync(new URL('gen-sessions/recipes/final-position-owner.json',import.meta.url));
assert.equal(canonicalSHA(canonicalRecipeBytes),'8df9da30140b5624d432d7d5d9ef0a2bb1f5bc6debe0ebec0e3b753970608fe4','primary recipe bytes');
const canonicalRecipe=JSON.parse(canonicalRecipeBytes);
const canonicalOriginalBytes=readFileSync(new URL('gen-sessions/evidence/final-position-owner/recording-recipe.json',import.meta.url));
assert.equal(canonicalSHA(canonicalOriginalBytes),'a93452f8a5dae84a6b8dd468379fbc700abef9d5a4dc1adf1e40e079726bf22b','original recording recipe bytes');
const canonicalOriginal=JSON.parse(canonicalOriginalBytes);
const {requireBranchAssertions,branches,branchAssertions,...canonicalOriginalFields}=canonicalRecipe;
assert.deepEqual(canonicalOriginalFields,canonicalOriginal,'all original recipe fields, requirements and negative hashes');
assert.equal(hash({requireBranchAssertions,branches,branchAssertions}),'64fffae40f90de2a08452d335fba51414168b8929f4cafa3bd7005287c0a4aaf','primary branch metadata');
assert.equal(requireBranchAssertions,true);assert.equal(branches.length,7);assert.equal(branchAssertions.length,7);
assert.deepEqual(branches,canonicalRecipe.segments.map(s=>'final-position.'+s.name));
assert.deepEqual(branchAssertions.map(a=>[a.branch,a.segment]),branches.map((branch,i)=>[branch,i]));
const canonicalLockBytes=readFileSync(new URL('gen-sessions/evidence/final-position-owner/input-lock.json',import.meta.url));
assert.equal(canonicalSHA(canonicalLockBytes),'9f32f80de8a5612729558b362ffdcd29373d37b3efc3e34fc5888d058a236806','original input lock bytes');
const canonicalLock=JSON.parse(canonicalLockBytes);
assert.equal(canonicalLock.recipeSHA256,canonicalSHA(canonicalOriginalBytes));
const canonicalFields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
const canonicalTuples=canonicalRecipe.segments.map(canonicalFields);
assert.equal(canonicalRecipe.segments.length,7);assert.equal(canonicalLock.segments,7);
assert.equal(hash(canonicalTuples),'c46a13f8ec0391788fe193ccd6a8212e12e6dfa81cf34bfd0d05bd1c4c0bd5c1','all five fields and presence');
assert.equal(canonicalLock.fieldsPresenceSHA256,hash(canonicalTuples));
assert.equal(canonicalLock.branchRequirementsSHA256,hash(canonicalRecipe.branchRequirements));
assert.equal(canonicalLock.negativeHashesSHA256,hash(canonicalRecipe.unchangedOutputHashes));
assert.equal(canonicalLock.segmentsSHA256.length,7);
// Only this installed canonical recording is accepted. No alternate path or selector.
const canonicalRawBytes=readFileSync(new URL('gen-sessions/generated/final-position-owner.session.json',import.meta.url));
assert.equal(canonicalSHA(canonicalRawBytes),'b4ea635ce22af1f8a9a5d3637385fefa82fb0ea8160c49e6cfe85ef22e51363c','exact canonical C raw bytes');
assert.equal(canonicalRawBytes.length,766372);
const canonicalNative=JSON.parse(canonicalRawBytes);
assert.equal(canonicalNative.source,'c');assert.equal(canonicalNative.version,5);assert.equal(canonicalNative.segments.length,7);
assert.deepEqual(canonicalNative.segments.map(canonicalFields),canonicalTuples,'C input field presence and values');
for(const [i,part]of canonicalNative.segments.entries()){
    const input=canonicalRecipe.segments[i],locked=canonicalLock.segmentsSHA256[i];
    assert.equal(locked.name,input.name);assert.equal(locked.fieldsSHA256,hash(canonicalFields(input)));
    assert.equal(locked.movesSHA256,canonicalSHA(Buffer.from(input.moves,'utf8')),'exact key bytes');
    assert.ok(Array.isArray(part.steps)&&part.steps.length,'C boundaries are mandatory');
    assert.deepEqual(part.steps.map(step=>step.key),[null,...input.moves],'every recorded key and initial boundary');
}
assert.equal(canonicalLock.keys,334);assert.equal(canonicalLock.boundaries,341);
assert.equal(canonicalNative.segments.reduce((n,s)=>n+s.moves.length,0),334);
assert.equal(canonicalNative.segments.reduce((n,s)=>n+s.steps.length,0),341);
assert.deepEqual(recordingIntegrityErrors(canonicalNative),[],'canonical recording integrity');
assert.deepEqual(branchAssertionErrors(canonicalRecipe,canonicalNative),[],'all seven primary C branches');
// END mandatory canonical C preflight.
const results=[],bound=setTimeout(()=>{console.error('55 second source bound');process.exit(2);},55000);
async function fresh(race='dwarf') {
    const run=await runSegment({seed:7401,datetime:'20000110090000',moves:' ',storage:new InMemoryStorage(),
        nethackrc:`OPTIONS=name:Desired,role:Archeologist,race:${race},gender:male,align:lawful,playmode:debug\nOPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,!safe_wait,!debug_mongen,pauper,nudist\n`});
    let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<30);return 32;};
    g._preNhgetchHook=null;resetInputState();
    for(const obj of [...g.level.objects,...(g.level.buriedobjs||[])])await obj_extract_self(obj);
    g.level.monsters=[];g.level.monAt.clear();g.level.traps=[];g.regions=[];g.timer_base=[];
    Object.assign(g.u,{ux:x,uy:y,ux0:x,uy0:y,dx:0,dy:0,utrap:0,umoved:false,uswallow:false,ustuck:null,usteed:null});
    g.multi=0;Object.assign(g.context,{run:0,move:1,travel:0,travel1:0,mv:0,nopick:0,forcefight:0});
    g.flags.runmode=C.RUN_TPORT;
    for(let xx=x-4;xx<=x+4;xx++)for(let yy=y-4;yy<=y+4;yy++){
        assert.ok(set_levltyp(xx,yy,C.ROOM));Object.assign(g.level.at(xx,yy),{lit:1,waslit:1,seenv:255,roomno:0});
    }
    vision_reset();vision_recalc();clearMessages();seed();
    assert.equal(Race_if(P.PM_DWARF),race==='dwarf');assert.equal(C.Upolyd(g.u),false);
    return run;
}
async function object(typ=O.DAGGER,xx=x+1,yy=y){const obj=mksobj(typ,false,false);await place_object(obj,xx,yy);assert.equal(obj.where,C.OBJ_FLOOR);return obj;}
async function bury(xx=x+1,yy=y,typ=O.DAGGER){const obj=await object(typ,xx,yy);await bury_objs(xx,yy);
    assert.equal(obj.where,C.OBJ_BURIED);assert.ok(g.level.buriedobjs.includes(obj));assert.notEqual(g.level.objectAt(xx,yy),obj);return obj;}
function state(){return {xy:[g.u.ux,g.u.uy],origin:[g.u.ux0,g.u.uy0],umoved:!!g.u.umoved,hidden:!!g.u.uundetected,
    blind:!!Blind(),cached:!!g.u.ublind,flying:!!Flying(),levitation:!!Levitation(),polymorphed:C.Upolyd(g.u),
    terrain:g.iflags.terrain_typ,lastSeen:g.level.at(g.u.ux,g.u.uy).lastseentyp,
    steed:g.u.usteed&&[g.u.usteed.mx,g.u.usteed.my],hp:g.u.uhp,text:messages(),rng:[...getRngLog()]};}
async function check(name,body){const r={name};try{await body(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,450);}results.push(r);}
function sense(r,expected=true){r.after=state();assert.equal(r.after.text.includes('You sense something below your feet.'),expected);assert.deepEqual(r.after.rng,[]);}
for(const terrain of [C.ROOM,C.CORR])await check(`buried object on terrain ${terrain}`,async r=>{
    await fresh();const obj=await bury();assert.ok(set_levltyp(x+1,y,terrain));clearMessages();seed();
    await u_on_newpos(x+1,y);sense(r);assert.deepEqual(r.after.xy,[x+1,y]);assert.ok(g.level.buriedobjs.includes(obj));
});
for(const terrain of [C.STAIRS,C.ICE,C.POOL,C.AIR,C.STONE])await check(`excluded terrain ${terrain}`,async r=>{
    await fresh();await bury();assert.ok(set_levltyp(x+1,y,terrain));clearMessages();seed();await u_on_newpos(x+1,y);sense(r,false);
});
for(const kind of ['none','floor-only','buried-neighbor'])await check(`no buried object underfoot: ${kind}`,async r=>{
    await fresh();if(kind==='floor-only')await object();if(kind==='buried-neighbor')await bury(x+2,y);clearMessages();seed();await u_on_newpos(x+1,y);sense(r,false);
});
await check('real human race excludes earth sense',async r=>{await fresh('human');await bury();clearMessages();seed();await u_on_newpos(x+1,y);sense(r,false);});
await check('multiple buried objects emit one message after scanning wrong-position head',async r=>{
    await fresh();await bury();await bury(x+1,y,O.KNIFE);await bury(x+2,y);assert.equal(g.level.buriedobjs.length,3);
    clearMessages();seed();await u_on_newpos(x+1,y);sense(r);assert.equal((r.after.text.match(/sense something below/g)||[]).length,1);
});
await check('same-position call still senses buried object',async r=>{await fresh();await bury(x,y);clearMessages();seed();await u_on_newpos(x,y);sense(r);});
for(const [name,typ,mask,predicate]of [['flight',O.AMULET_OF_FLYING,C.W_AMUL,Flying],['levitation',O.RIN_LEVITATION,C.W_RINGL,Levitation]]){
    await check(`real worn ${name} excludes then removal restores earth sense`,async r=>{
        await fresh();await bury();const item=mksobj(typ,false,false);await setworn(item,mask);assert.ok(predicate());
        clearMessages();seed();await u_on_newpos(x+1,y);sense(r,false);r.excluded=r.after;
        await setworn(null,mask);assert.equal(!!predicate(),false);clearMessages();seed();await u_on_newpos(x+1,y);sense(r);
    });
}
await check('real saddled mount excludes earth sense and stays positioned',async r=>{
    await fresh();await mount();await bury(x+2,y);clearMessages();seed();await u_on_newpos(x+2,y);sense(r,false);assert.deepEqual(r.after.steed,r.after.xy);
});
await check('dwarf polymorph is still Upolyd and excludes racial sense',async r=>{
    await fresh();await bury();g.u.umonnum=P.PM_DWARF;set_uasmon();assert.ok(C.Upolyd(g.u)&&Race_if(P.PM_DWARF));
    clearMessages();seed();await u_on_newpos(x+1,y);sense(r,false);
});
await check('blindness does not exclude earth sense',async r=>{
    await fresh();await bury();await make_blinded(20,false);assert.ok(Blind());clearMessages();seed();await u_on_newpos(x+1,y);sense(r);
});
await check('canonical body-part and plural helpers produce feet',async r=>{await fresh();assert.equal(body_part(C.FOOT),'foot');assert.equal(makeplural(body_part(C.FOOT)),'feet');r.after=state();});
for(const kind of ['sighted','stale-sighted-cache','stale-blind-cache','blind','hallucinating','swallowed'])await check(`nearby object observation ${kind}`,async r=>{
    await fresh('human');
    if(kind==='blind'||kind==='stale-blind-cache')await make_blinded(20,false);
    if(kind==='stale-blind-cache'){set_itimeout('HBlinded',0);vision_reset();vision_recalc();}
    if(kind==='hallucinating')await make_hallucinated(20,false,0);
    if(kind==='swallowed')g.u.uswallow=true;
    const obj=await object(O.POT_HEALING,x+1,y);assert.equal(!!obj.dknown,false);
    if(kind==='stale-sighted-cache')set_itimeout('HBlinded',20);
    clearMessages();seed();r.before={...state(),visible:cansee(x+1,y),dknown:!!obj.dknown,hallucinating:!!Hallucination()};
    await u_on_newpos(x,y);r.after={...state(),dknown:!!obj.dknown};
    assert.equal(r.after.dknown,kind==='sighted'||kind==='stale-blind-cache');
    assert.deepEqual(r.after.rng,[]);assert.equal(r.after.text,'');
});
await check('new level updates origin and terrain before earth sense',async r=>{
    await fresh();await bury();g.u.uz0={dnum:0,dlevel:2};g.u.uundetected=1;clearMessages();seed();
    await u_on_newpos(x+1,y);sense(r);assert.deepEqual(r.after.origin,r.after.xy);assert.equal(r.after.terrain,C.MAX_TYPE);assert.equal(r.after.lastSeen,C.ROOM);assert.equal(r.after.hidden,false);
});
for(const caller of ['u_on_newpos','domove','teleds','hurtle_step','move_into_trap','maze-place','startup-place','startup-upstairs'])await check(`pending earth feedback holds ${caller}`,async r=>{
    const run=await fresh();await bury();let trap,range={range:2};
    if(caller==='move_into_trap'){trap=maketrap(x+1,y,C.VIBRATING_SQUARE);trap.tseen=1;}
    if(caller==='startup-upstairs'){
        // Constructed saved stair record on ROOM tests the wrapper's await;
        // ordinary stairs are excluded from earth sense by terrain.
        g.stairs={sx:x+1,sy:y,up:true,tolev:{...g.u.uz},next:null};
    }
    clearMessages();seed();await pline('You pause to examine the floor carefully before taking another step.');
    let release,waiting,reads=0,done=false;const pending=new Promise(resolve=>{waiting=resolve;});
    run._display.onEmptyQueue=()=>{assert.ok(++reads<12);if(reads===1)return new Promise(resolve=>{release=resolve;waiting('input');});return 32;};
    const action=async()=>{
        if(caller==='u_on_newpos')return await u_on_newpos(x+1,y);
        if(caller==='domove'){g.u.dx=1;g.u.dy=0;return await domove();}
        if(caller==='teleds')return await teleds(x+1,y,TELEDS_TELEPORT);
        if(caller==='hurtle_step')return await hurtle_step(range,x+1,y);
        if(caller==='move_into_trap')return await move_into_trap(trap);
        if(caller==='maze-place')return await mazePlace(x+1,y,x+1,y,0,0,0,0,LR_UPTELE,null);
        if(caller==='startup-place')return await startupPlace(x+1,y,x+1,y,0,0,0,0,LR_UPTELE,null);
        return await u_on_upstairs();
    };
    const operation=action().then(value=>{done=true;return {value};});
    const outcome=await Promise.race([pending,operation]);r.pending={...state(),done,range:range.range,trapSeen:trap?.tseen};
    if(release)release(32);await operation;r.after={...state(),range:range.range};
    assert.equal(outcome,'input');assert.equal(r.pending.done,false);assert.deepEqual(r.pending.xy,[x+1,y]);
    assert.ok(!r.pending.text.includes('sense something below'),'old message is pending before new feedback');assert.match(r.after.text,/You sense something below your feet\./);
    if(caller==='hurtle_step'){assert.equal(r.pending.range,2);assert.equal(r.after.range,1);}
    if(caller==='move_into_trap'){assert.equal(r.pending.umoved,false);assert.equal(r.pending.trapSeen,1);assert.equal(r.after.umoved,true);}
    if(caller==='teleds')assert.ok(r.after.text.indexOf('sense something below')<r.after.text.indexOf('materialize'));
    assert.deepEqual(r.pending.rng,caller.endsWith('-place')?['rn2(1)=0','rn2(1)=0']:[]);
});
clearTimeout(bound);
const report={classification:'constructed fixtures, public owners and real startup/burial/equipment/form producers',nativeParityClaimed:false,total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error})),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
