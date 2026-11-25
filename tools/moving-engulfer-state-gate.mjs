// C monmove.c:1648-1657. Constructed terrain, real public producers and owners.
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
import {makemon} from '../js/makemon.js';
import {gulpmu} from '../js/mhitu.js';
import {m_move,monflee} from '../js/monmove.js';
import {m_at,unstuck} from '../js/mon.js';
import {set_levltyp} from '../js/mkmaze.js';
import {mksobj,place_object} from '../js/mkobj.js';
import {obj_extract_self} from '../js/invent.js';
import {bury_objs} from '../js/dig.js';
import {Race_if} from '../js/u_init.js';
import {resetInputState} from '../js/input.js';
import {vision_reset,vision_recalc} from '../js/vision.js';
import {pline,gbuf_at,flush_screen} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {x,y,seed,clearMessages,messages} from './status-followup-test-setup.mjs';
import {hash} from './half-damage-reader-observe.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
// BEGIN mandatory canonical C preflight. Integrity is not a native replay.
const canonicalSHA=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonicalRecipeBytes=readFileSync(new URL('gen-sessions/recipes/moving-engulfer-owner.json',import.meta.url));
assert.equal(canonicalSHA(canonicalRecipeBytes),'e71b70f072fda3d65a8f0a1ba9eb872583537df6aeca8d1560b2ad3288646114','primary recipe bytes');
const canonicalRecipe=JSON.parse(canonicalRecipeBytes);
const canonicalOriginalBytes=readFileSync(new URL('gen-sessions/evidence/moving-engulfer-owner/recording-recipe.json',import.meta.url));
assert.equal(canonicalSHA(canonicalOriginalBytes),'30d516914e33451b429ef1d18a26b6f18b0ba80169f2104e0b36a2d8a610aeac','original recording recipe bytes');
const canonicalOriginal=JSON.parse(canonicalOriginalBytes);
const {requireBranchAssertions,branches,branchAssertions,...canonicalOriginalFields}=canonicalRecipe;
assert.deepEqual(canonicalOriginalFields,canonicalOriginal,'all original recipe fields, requirements and negative hashes');
assert.equal(hash({requireBranchAssertions,branches,branchAssertions}),'ccb188022c3d16db1ae90478efdcdfa30ee5f78959a061b2cf1907d57f48445c','primary branch metadata');
assert.equal(requireBranchAssertions,true);assert.equal(branches.length,4);assert.equal(branchAssertions.length,4);
assert.deepEqual(branches,canonicalRecipe.segments.map(s=>'moving-engulfer.'+s.name));
assert.deepEqual(branchAssertions.map(a=>[a.branch,a.segment]),branches.map((branch,i)=>[branch,i]));
const canonicalLockBytes=readFileSync(new URL('gen-sessions/evidence/moving-engulfer-owner/input-lock.json',import.meta.url));
assert.equal(canonicalSHA(canonicalLockBytes),'e7b3be5c07f6f5e25fb4b77bc457b9f31cec6c8850f1d5906d1ace457056ce3f','original input lock bytes');
const canonicalLock=JSON.parse(canonicalLockBytes);
assert.equal(canonicalLock.recipeSHA256,canonicalSHA(canonicalOriginalBytes));
const canonicalFields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
const canonicalTuples=canonicalRecipe.segments.map(canonicalFields);
assert.equal(canonicalRecipe.segments.length,4);assert.equal(canonicalLock.segments,4);
assert.equal(hash(canonicalTuples),'df719db22a119d8f79df03d788bdf220a91b77d6545d41aa790997536ff29060','all five fields and presence');
assert.equal(canonicalLock.fieldsPresenceSHA256,hash(canonicalTuples));
assert.equal(canonicalLock.branchRequirementsSHA256,hash(canonicalRecipe.branchRequirements));
assert.equal(canonicalLock.negativeHashesSHA256,hash(canonicalRecipe.unchangedOutputHashes));
assert.equal(canonicalLock.segmentsSHA256.length,4);
// Only this installed canonical recording is accepted. No alternate path or selector.
const canonicalRawBytes=readFileSync(new URL('gen-sessions/generated/moving-engulfer-owner.session.json',import.meta.url));
assert.equal(canonicalSHA(canonicalRawBytes),'a61a564baa15cbd43f63f8440c2420bbb8de671b8390a50d9bc76d299827f229','exact canonical C raw bytes');
assert.equal(canonicalRawBytes.length,470887);
const canonicalNative=JSON.parse(canonicalRawBytes);
assert.equal(canonicalNative.source,'c');assert.equal(canonicalNative.version,5);assert.equal(canonicalNative.segments.length,4);
assert.deepEqual(canonicalNative.segments.map(canonicalFields),canonicalTuples,'C input field presence and values');
for(const [i,part]of canonicalNative.segments.entries()){
    const input=canonicalRecipe.segments[i],locked=canonicalLock.segmentsSHA256[i];
    assert.equal(locked.name,input.name);assert.equal(locked.fieldsSHA256,hash(canonicalFields(input)));
    assert.equal(locked.movesSHA256,canonicalSHA(Buffer.from(input.moves,'utf8')),'exact key bytes');
    assert.ok(Array.isArray(part.steps)&&part.steps.length,'C boundaries are mandatory');
    assert.deepEqual(part.steps.map(step=>step.key),[null,...input.moves],'every recorded key and initial boundary');
}
assert.equal(canonicalLock.keys,204);assert.equal(canonicalLock.boundaries,208);
assert.equal(canonicalNative.segments.reduce((n,s)=>n+s.moves.length,0),204);
assert.equal(canonicalNative.segments.reduce((n,s)=>n+s.steps.length,0),208);
assert.deepEqual(recordingIntegrityErrors(canonicalNative),[],'canonical recording integrity');
assert.deepEqual(branchAssertionErrors(canonicalRecipe,canonicalNative),[],'all four primary C branches');
// END mandatory canonical C preflight.
const results=[],bound=setTimeout(()=>{console.error('55 second source bound');process.exit(2);},55000);
const rc=race=>`OPTIONS=name:Desired,role:Archeologist,race:${race},gender:male,align:lawful,playmode:debug\nOPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,!safe_wait,!debug_mongen,pauper,nudist\n`;
async function fresh(race='dwarf',dx=1,dy=0){
    const run=await runSegment({seed:7401,datetime:'20000110090000',moves:' ',storage:new InMemoryStorage(),nethackrc:rc(race)});
    let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<30);return 32;};
    g._preNhgetchHook=null;resetInputState();
    for(const obj of [...g.level.objects,...(g.level.buriedobjs||[])])await obj_extract_self(obj);
    g.level.monsters=[];g.level.monAt.clear();g.level.traps=[];g.regions=[];g.timer_base=[];
    Object.assign(g.u,{ux:x,uy:y,ux0:x,uy0:y,dx:0,dy:0,utrap:0,uswallow:false,ustuck:null,usteed:null});
    g.multi=0;
    for(let xx=x-3;xx<=x+3;xx++)for(let yy=y-3;yy<=y+3;yy++){
        assert.ok(set_levltyp(xx,yy,C.STONE));Object.assign(g.level.at(xx,yy),{lit:1,waslit:1,seenv:255,roomno:0});
    }
    assert.ok(set_levltyp(x,y,C.ROOM));assert.ok(set_levltyp(x+dx,y+dy,C.ROOM));
    vision_reset();vision_recalc();clearMessages();seed();
    assert.equal(Race_if(P.PM_DWARF),race==='dwarf');assert.equal(C.Upolyd(g.u),false);
    const mon=await makemon(g.mons[P.PM_DUST_VORTEX],x+dx,y+dy,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG|C.MM_MINVIS);
    assert.ok(mon&&mon.minvis&&!mon.mpeaceful);
    assert.equal(await gulpmu(mon,mon.data.mattk[0]),C.M_ATTK_HIT);
    assert.ok(g.u.uswallow);assert.equal(g.u.ustuck,mon);assert.equal(m_at(x,y),mon);
    assert.deepEqual([mon.mx,mon.my],[x,y]);
    await flush_screen(0);clearMessages();seed();return {run,mon};
}
function patch(run,xx,yy){return Array.from({length:3},(_,dy)=>Array.from({length:3},(_,dx)=>({...run._display.grid[yy+dy][xx+dx-2]})));}
function bufferPatch(xx,yy){return Array.from({length:3},(_,dy)=>Array.from({length:3},(_,dx)=>{const cell=gbuf_at(xx+dx-1,yy+dy-1);return {ch:cell.disp_ch,color:cell.disp_color,attr:cell.disp_attr,dec:cell.disp_decgfx,kind:cell.disp_glyph?.kind};}));}
function state(run,mon){return {xy:[g.u.ux,g.u.uy],oldXY:[g.u.ux0,g.u.uy0],monXY:[mon.mx,mon.my],swallowed:!!g.u.uswallow,holder:g.u.ustuck?.m_id??null,
    hp:g.u.uhp,monHp:mon.mhp,timer:g.u.uswldtim,text:messages(),rng:[...getRngLog()],mapSHA256:hash(run._display.grid.slice(1,22))};}
async function bury(xx=x+1,yy=y){const obj=mksobj(O.DAGGER,false,false);await place_object(obj,xx,yy);await bury_objs(xx,yy);
    assert.equal(obj.where,C.OBJ_BURIED);assert.ok(g.level.buriedobjs.includes(obj));return obj;}
async function check(name,body){const r={name};try{await body(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,450);}results.push(r);}
function moved(r,run,mon,xx=x+1,yy=y){
    r.after=state(run,mon);assert.deepEqual(r.after.monXY,[xx,yy]);assert.deepEqual(r.after.xy,[xx,yy],'hero follows actual engulfer move');
    assert.ok(r.after.swallowed);assert.equal(r.after.holder,mon.m_id);assert.equal(m_at(xx,yy),mon);
    assert.ok(g.level.monsters.includes(mon)&&r.after.hp>0&&r.after.monHp>0);
}
for(const [dx,dy]of [[1,0],[0,1],[1,1]])await check(`moving engulfer carries hero and translates stomach ${dx},${dy}`,async r=>{
    const {run,mon}=await fresh('dwarf',dx,dy),before=patch(run,x,y),buffer=bufferPatch(x,y);r.before=state(run,mon);
    r.result=await m_move(mon,0);moved(r,run,mon,x+dx,y+dy);
    assert.equal(r.result,C.MMOVE_MOVED);assert.deepEqual(r.after.oldXY,[x,y]);
    assert.deepEqual(bufferPatch(x+dx,y+dy),buffer,'swallowed queues the translated stomach before terminal flush');
    await flush_screen(0);assert.deepEqual(patch(run,x+dx,y+dy),before,'same styled stomach at new center after real flush');
    assert.equal(m_at(x,y),null);assert.deepEqual(r.after.rng,['rn2(1)=0']);
    for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++)if(Math.abs(xx-x-dx)>1||Math.abs(yy-y-dy)>1)
        assert.equal(run._display.grid[yy+1][xx-1].ch,' ','old stomach-only cells are erased');
});
await check('successive actual moves retain immediately previous hero position',async r=>{
    const {run,mon}=await fresh();await m_move(mon,0);assert.ok(set_levltyp(x,y,C.STONE));assert.ok(set_levltyp(x+2,y,C.ROOM));
    clearMessages();seed();r.result=await m_move(mon,0);moved(r,run,mon,x+2,y);assert.deepEqual(r.after.oldXY,[x+1,y]);assert.deepEqual(r.after.rng,['rn2(1)=0']);
});
await check('no legal move leaves hero and stomach unchanged',async r=>{
    const {run,mon}=await fresh();assert.ok(set_levltyp(x+1,y,C.STONE));r.before=state(run,mon);
    r.result=await m_move(mon,0);r.after=state(run,mon);assert.equal(r.result,C.MMOVE_NOMOVES);assert.deepEqual(r.after,r.before);
});
await check('real release permits monster movement without carrying hero',async r=>{
    const {run,mon}=await fresh();await unstuck(mon);clearMessages();seed();r.before=state(run,mon);
    r.result=await m_move(mon,0);r.after=state(run,mon);assert.equal(r.result,C.MMOVE_MOVED);assert.deepEqual(r.after.monXY,[x+1,y]);
    assert.deepEqual(r.after.xy,[x,y]);assert.deepEqual(r.after.oldXY,[x,y]);assert.equal(r.after.swallowed,false);assert.equal(r.after.holder,null);
});
await check('different fleeing monster moves while swallowed hero stays with holder',async r=>{
    const {run,mon}=await fresh();assert.ok(set_levltyp(x+2,y,C.ROOM));assert.ok(set_levltyp(x+3,y,C.ROOM));
    const other=await makemon(g.mons[P.PM_DUST_VORTEX],x+2,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    await monflee(other,10,false,false);assert.ok(other.mflee);clearMessages();seed();r.before=state(run,mon);
    r.result=await m_move(other,0);r.after=state(run,mon);r.otherXY=[other.mx,other.my];
    assert.equal(r.result,C.MMOVE_MOVED);assert.deepEqual(r.otherXY,[x+3,y]);assert.deepEqual(r.after.xy,r.before.xy);
    assert.equal(r.after.holder,mon.m_id);assert.equal(r.after.mapSHA256,r.before.mapSHA256);assert.deepEqual(r.after.oldXY,[x,y]);
});
for(const terrain of [C.ROOM,C.CORR])await check(`real buried object senses during engulfed arrival on ${terrain}`,async r=>{
    const {run,mon}=await fresh();const obj=await bury();assert.ok(set_levltyp(x+1,y,terrain));clearMessages();seed();
    r.result=await m_move(mon,0);moved(r,run,mon);assert.match(r.after.text,/You sense something below your feet\./);
    assert.ok(g.level.buriedobjs.includes(obj));assert.deepEqual(r.after.rng,['rn2(1)=0']);
});
for(const kind of ['human','floor-only','stairs'])await check(`engulfed arrival earth-sense exclusion ${kind}`,async r=>{
    const {run,mon}=await fresh(kind==='human'?'human':'dwarf');
    if(kind==='floor-only')await place_object(mksobj(O.DAGGER,false,false),x+1,y);else await bury();
    if(kind==='stairs')assert.ok(set_levltyp(x+1,y,C.STAIRS));clearMessages();seed();
    r.result=await m_move(mon,0);moved(r,run,mon);assert.ok(!r.after.text.includes('sense something below'));assert.deepEqual(r.after.rng,['rn2(1)=0']);
});
for(const race of ['dwarf','human'])await check(`pending prior feedback orders positioning before stomach redraw: ${race}`,async r=>{
    const {run,mon}=await fresh(race);await bury();clearMessages();seed();
    await pline('You pause to examine the floor carefully before taking another step.');
    const stomach=patch(run,x,y),buffer=bufferPatch(x,y);let release,waiting,reads=0,done=false;
    const pending=new Promise(resolve=>{waiting=resolve;});
    run._display.onEmptyQueue=()=>{assert.ok(++reads<12);if(reads===1)return new Promise(resolve=>{release=resolve;waiting('input');});return 32;};
    const operation=m_move(mon,0).then(value=>{done=true;return {value};});
    const outcome=await Promise.race([pending,operation]);r.pending={...state(run,mon),done,reads,stomach:patch(run,x,y),buffer:bufferPatch(x,y)};
    if(release)release(32);await operation;moved(r,run,mon);
    if(race==='dwarf'){
        assert.equal(outcome,'input');assert.equal(r.pending.done,false);assert.deepEqual(r.pending.xy,[x+1,y]);assert.deepEqual(r.pending.oldXY,[x,y]);
        assert.deepEqual(r.pending.stomach,stomach,'old stomach remains until pending earlier feedback is acknowledged');
        assert.deepEqual(r.pending.buffer,buffer,'swallowed has not queued its redraw before earth feedback completes');
        assert.ok(!r.pending.text.includes('sense something below'));assert.match(r.after.text,/You sense something below your feet\./);
    }else{assert.equal(r.pending.done,true);assert.equal(reads,0);assert.ok(!r.after.text.includes('sense something below'));}
    assert.deepEqual(bufferPatch(x+1,y),buffer);await flush_screen(0);
    assert.deepEqual(patch(run,x+1,y),stomach);assert.deepEqual(r.after.rng,['rn2(1)=0']);
});
clearTimeout(bound);
const report={classification:'constructed terrain; real startup, makemon, gulpmu, burial, release and flee producers; public m_move',nativeParityClaimed:false,total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error})),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
