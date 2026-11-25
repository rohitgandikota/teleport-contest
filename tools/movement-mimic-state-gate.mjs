// Constructed C branch contracts through public owners on real generated maps.
// No terrain/monster-map injection, helper substitutes, private exports, or RNG reset.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game as g} from '../js/gstate.js';
import {domove} from '../js/cmd.js';
import {dohide,polymon} from '../js/polyself.js';
import {doapply,um_dist} from '../js/apply.js';
import {resetInputState} from '../js/input.js';
import {pline,tty_clear_nhwindow_message} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {defsyms} from '../js/drawing_data.js';
import * as C from '../js/const.js';
import {hash} from './half-damage-reader-observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
// BEGIN mandatory canonical C preflight. Metadata checks, not native replay.
const canonicalRoot = new URL('../', import.meta.url);
const canonicalSHA = bytes => createHash('sha256').update(bytes).digest('hex');
const canonicalRecipeBytes = readFileSync(new URL('tools/gen-sessions/recipes/movement-mimic-owner.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalRecipeBytes), 'aa9fc270ed88c59fd263e3472e7c7ca2206b1f7a286df10ebc4bb36b5ef465de', 'unchanged recording recipe');
const canonicalRecipe = JSON.parse(canonicalRecipeBytes);
const canonicalLockBytes = readFileSync(new URL('tools/gen-sessions/evidence/movement-mimic-owner/input-lock.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalLockBytes), 'e2d4a798c8e5748d7c66dc54e1d3f91501fdb892000831d2f2f22a04fd4f42a4', 'original final input lock');
const canonicalLock = JSON.parse(canonicalLockBytes);
assert.equal(canonicalLock.recipeSHA256, canonicalSHA(canonicalRecipeBytes));
assert.deepEqual(canonicalRecipe.segments, canonicalLock.segments);
assert.deepEqual(canonicalRecipe.branchRequirements, canonicalLock.branchRequirements);
assert.deepEqual(canonicalRecipe.unchangedOutputHashes, canonicalLock.negativeHashes);
const canonicalFields = ['name', 'seed', 'datetime', 'nethackrc', 'moves'];
const canonicalTuples = canonicalRecipe.segments.map(s => canonicalFields.map(field => ({field, present:Object.hasOwn(s,field), value:s[field]})));
assert.equal(canonicalSHA(JSON.stringify(canonicalTuples)), '693b1c294721626f8cef8261ea8bea799a8a7ea7e62a4753dd8b3fa238857ecf');
assert.equal(canonicalLock.tupleSHA256, canonicalSHA(JSON.stringify(canonicalTuples)));
assert.equal(canonicalRecipe.requireBranchAssertions, true);
assert.equal(canonicalRecipe.branches.length, 6);
assert.deepEqual(canonicalRecipe.branchAssertions.map(a => a.segment), [0, 1, 2, 3, 4, 5]);
const canonicalBytes = readFileSync(new URL('tools/gen-sessions/generated/movement-mimic-owner.session.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalBytes), '9e4d62808a0abe3042e54ad40866652252531ede8cddf38c56e29f5b95d1bcfa', 'locked canonical C raw');
assert.equal(canonicalBytes.length, 773661);
const canonicalNative = JSON.parse(canonicalBytes);
assert.equal(canonicalNative.source, 'c');
assert.equal(canonicalNative.version, 5);
assert.equal(canonicalNative.segments.length, 6);
assert.equal(canonicalRecipe.segments.length, 6);
assert.deepEqual(recordingIntegrityErrors(canonicalNative), [], 'canonical recording integrity');
assert.deepEqual(branchAssertionErrors(canonicalRecipe, canonicalNative), [], 'all six original primary branches');
for (let i = 0; i < 6; i++) {
    const actual = canonicalNative.segments[i], expected = canonicalRecipe.segments[i];
    for (const field of canonicalFields) {
        assert.ok(Object.hasOwn(expected, field), `recipe field presence ${i} ${field}`);
        assert.equal(Object.hasOwn(actual, field), Object.hasOwn(expected, field), `C field presence ${i} ${field}`);
        assert.deepEqual(actual[field], expected[field], `C field value ${i} ${field}`);
    }
    assert.deepEqual(actual.steps.map(step => step.key), [null, ...expected.moves], `every C key ${i}`);
}
assert.equal(canonicalRecipe.segments.reduce((n,s) => n + s.moves.length, 0), 216);
assert.equal(canonicalNative.segments.reduce((n,s) => n + s.steps.length, 0), 222);
// END mandatory canonical C preflight.
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/movement-mimic-owner.json',import.meta.url)));
const original=recipe.segments[0],prefix=original.moves.slice(0,-2);
const results=[],bound=setTimeout(()=>process.exit(2),55000);
let run;
async function boot(part={...original,moves:prefix}){
    run=await runSegment({...part,storage:new InMemoryStorage()});
    let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<=20,'bounded feedback input');return 32;};
    g._preNhgetchHook=null;resetInputState();
}
async function check(name,fn,part){const r={name,classification:'constructed source contract; not an ordinary/native claim'};
    try{await boot(part);const start=getRngLog().length;await fn(r);
        r.additionalCalls=getRngLog().length-start;r.pass=true;
    }catch(e){r.pass=false;r.error=e.message.slice(0,600);}
    r.final={xy:[g.u.ux,g.u.uy],ap:g.youmonst.m_ap_type||0,appearance:g.youmonst.mappearance,form:g.u.umonnum};
    r.rngSHA256=hash(getRngLog());results.push(r);
}
async function step(dx,dy){g.u.dx=dx;g.u.dy=dy;g.u.umoved=false;g.domove_attempting=C.DOMOVE_WALK;await domove();}
function actualDisguise(){assert.equal(g.u.umonnum,P.PM_SMALL_MIMIC);assert.equal(g.youmonst.m_ap_type,C.M_AP_OBJECT);
    assert.equal(g.youmonst.mappearance,O.STRANGE_OBJECT);assert.equal(g.u.uundetected||0,0);}

await check('ordinary polymorph and dohide produce object disguise',async()=>{actualDisguise();assert.deepEqual([g.u.ux,g.u.uy],[31,15]);});
for(const [name,dx,dy] of [['east',1,0],['south',0,1],['west',-1,0],['north',0,-1],['diagonal',1,1]])
    await check(name+' movement clears the real disguise',async()=>{
        actualDisguise();const appearance=g.youmonst.mappearance,hp=g.u.mh,start=getRngLog().length;
        await step(dx,dy);assert.deepEqual([g.u.ux,g.u.uy],[31+dx,15+dy]);
        assert.equal(g.youmonst.m_ap_type,C.M_AP_NOTHING);assert.equal(g.youmonst.mappearance,appearance);
        assert.equal(g.u.umonnum,P.PM_SMALL_MIMIC);assert.equal(g.u.mh,hp);assert.equal(g.u.uundetected||0,0);
        assert.equal(g.u.umoved,true);assert.equal(g.domove_succeeded,C.DOMOVE_WALK);
        assert.deepEqual(getRngLog().slice(start),[],'the ordinary unencumbered source move draws no RNG');
    });
const altar=defsyms.findIndex(s=>s.name==='S_altar');assert.ok(altar>=0);
for(const [name,raw,appearance,dx,dy,expected] of [
    ['object known flag',C.M_AP_OBJECT|C.M_AP_F_DKNOWN,O.GOLD_PIECE,1,0,C.M_AP_NOTHING],
    ['furniture',C.M_AP_FURNITURE,altar,1,0,C.M_AP_NOTHING],
    ['furniture known flag',C.M_AP_FURNITURE|C.M_AP_F_DKNOWN,altar,0,1,C.M_AP_NOTHING],
    ['monster negative',C.M_AP_MONSTER,P.PM_GREEN_SLIME,1,0,C.M_AP_MONSTER],
    ['monster flag negative',C.M_AP_MONSTER|C.M_AP_F_DKNOWN,P.PM_GREEN_SLIME,0,1,C.M_AP_MONSTER|C.M_AP_F_DKNOWN],
    ['nothing negative',C.M_AP_NOTHING,O.GOLD_PIECE,1,0,C.M_AP_NOTHING],
    ['nothing flag negative',C.M_AP_F_DKNOWN,O.GOLD_PIECE,1,0,C.M_AP_F_DKNOWN],
    ['zero direction object',C.M_AP_OBJECT|C.M_AP_F_DKNOWN,O.GOLD_PIECE,0,0,C.M_AP_OBJECT|C.M_AP_F_DKNOWN],
    ['zero direction furniture',C.M_AP_FURNITURE|C.M_AP_F_DKNOWN,altar,0,0,C.M_AP_FURNITURE|C.M_AP_F_DKNOWN],
]) await check(name+' respects the C direction/type contract',async r=>{
    actualDisguise();r.constructed={raw,appearance,direction:[dx,dy]};
    g.youmonst.m_ap_type=raw;g.youmonst.mappearance=appearance;
    await step(dx,dy);assert.equal(g.youmonst.m_ap_type,expected,'entire appearance field, not only low bits');
    assert.equal(g.youmonst.mappearance,appearance);assert.equal(g.u.umonnum,P.PM_SMALL_MIMIC);
    assert.deepEqual([g.u.ux,g.u.uy],[31+dx,15+dy]);
});
for(const raw of [C.M_AP_OBJECT,C.M_AP_FURNITURE|C.M_AP_F_DKNOWN])
    await check('early wall block retains appearance '+raw,async()=>{
        actualDisguise();g.youmonst.m_ap_type=raw;
        assert.equal(C.IS_OBSTRUCTED(g.level.at(68,14).typ),true);
        await step(1,0);assert.deepEqual([g.u.ux,g.u.uy],[67,14]);assert.equal(g.youmonst.m_ap_type,raw);
        assert.equal(g.u.umoved,false);assert.equal(g.domove_succeeded,0);
    },{...recipe.segments[4],moves:prefix});
await check('dohide without movement reports already and spends no action',async()=>{
    actualDisguise();assert.equal(await dohide(),C.ECMD_OK);assert.match(g._toplines,/already mimicking a strange object/);
});
await check('moving permits a new dohide action and fresh feedback',async()=>{
    actualDisguise();await step(1,0);assert.equal(await dohide(),C.ECMD_TIME);
    actualDisguise();assert.match(g._toplines,/now mimicking a strange object/);
});
await check('polymon nonmimic reset is an independent prior clear',async()=>{
    actualDisguise();await polymon(P.PM_KITTEN);assert.equal(g.youmonst.m_ap_type,C.M_AP_NOTHING);
    assert.equal(g.youmonst.mappearance,0);await step(1,0);assert.equal(g.youmonst.m_ap_type,C.M_AP_NOTHING);
});
await check('polymon mimic-to-mimic retains disguise until movement',async()=>{
    actualDisguise();await polymon(P.PM_LARGE_MIMIC);assert.equal(g.youmonst.m_ap_type,C.M_AP_OBJECT);
    await step(1,0);assert.equal(g.youmonst.m_ap_type,C.M_AP_NOTHING);assert.equal(g.u.umonnum,P.PM_LARGE_MIMIC);
});
await check('C clear does not require mimic species',async r=>{
    await polymon(P.PM_KITTEN);g.youmonst.m_ap_type=C.M_AP_OBJECT;g.youmonst.mappearance=O.GOLD_PIECE;
    r.constructed='nonmimic object disguise without the corpse immobilization; no ordinary reach claimed';
    await step(1,0);assert.equal(g.youmonst.m_ap_type,C.M_AP_NOTHING);assert.equal(g.youmonst.mappearance,O.GOLD_PIECE);
});

// Real startup pet, wished leash, and public apply producer. Direct owner calls
// deliberately omit pet turns, so the stretched attachment is source-only evidence.
await check('clear precedes held check_leash feedback and movement success marking',async r=>{
    const pet=g.level.monsters.find(m=>m.m_id===g.context.startingpet_mid);
    const leash=g.invent.find(o=>o.otyp===O.LEASH);assert.ok(pet&&pet.mtame&&leash);
    const dx=pet.mx-g.u.ux,dy=pet.my-g.u.uy;
    const dirs=[[1,0,'l'],[-1,0,'h'],[0,1,'j'],[0,-1,'k'],[1,1,'n'],[-1,1,'b'],[1,-1,'u'],[-1,-1,'y']];
    const key=dirs.find(d=>d[0]===dx&&d[1]===dy)?.[2];assert.ok(key,'generated pet is adjacent');
    tty_clear_nhwindow_message(0); // Finish the pending wished-item feedback before the new prompt.
    const answers=Array.from(leash.invlet+key,ch=>ch.charCodeAt(0)),feedback=run._display.onEmptyQueue;
    run._display.onEmptyQueue=()=>answers.length?answers.shift():feedback();
    r.applyResult=await doapply();run._display.onEmptyQueue=feedback;r.attach={invlet:leash.invlet,hero:[g.u.ux,g.u.uy],pet:[pet.mx,pet.my],key,text:[...g._msg_history,g._toplines].slice(-8)};assert.equal(leash.leashmon,pet.m_id);assert.equal(pet.mleashed,1);
    await polymon(P.PM_SMALL_MIMIC);
    const start=[g.u.ux,g.u.uy];let route;
    for(const [sx,sy] of dirs.slice(0,4)){
        let ok=true;
        for(let n=1;n<=5;n++){
            const x=start[0]+n*sx,y=start[1]+n*sy;
            if(g.level.at(x,y)?.typ!==C.ROOM||g.level.monAt.get(`${x},${y}`)||g.level.traps.some(t=>t.tx===x&&t.ty===y)){ok=false;break;}
            if(Math.max(Math.abs(x-pet.mx),Math.abs(y-pet.my))>3){if(ok)route={sx,sy,n};break;}
        }
        if(route)break;
    }
    assert.ok(route,'real generated floor supports a stretched leash');r.route=route;
    for(let n=1;n<route.n;n++)await step(route.sx,route.sy);
    assert.equal(um_dist(pet.mx,pet.my,3),false);await dohide();actualDisguise();
    await pline('A'.repeat(70));
    const old=[g.u.ux,g.u.uy];let release,ready,timer,finished=false;
    const atRead=new Promise(resolve=>{ready=resolve;});
    run._display.onEmptyQueue=()=>{ready();return new Promise(resolve=>{release=resolve;});};
    const work=step(route.sx,route.sy).then(()=>{finished=true;});
    try{
        await Promise.race([atRead,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('leash feedback did not block')),1500);})]);
        await setImmediate();r.pending={finished,ap:g.youmonst.m_ap_type,appearance:g.youmonst.mappearance,
            xy:[g.u.ux,g.u.uy],umoved:g.u.umoved,success:g.domove_succeeded,attached:leash.leashmon===pet.m_id};
    }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;release?.(32);await work;}
    assert.deepEqual(r.pending,{finished:false,ap:C.M_AP_NOTHING,appearance:O.STRANGE_OBJECT,
        xy:[old[0]+route.sx,old[1]+route.sy],umoved:false,success:0,attached:true});
    assert.equal(g.u.umoved,true);assert.equal(g.domove_succeeded,C.DOMOVE_WALK);
    assert.ok([...g._msg_history,g._toplines].join('\n').includes('pull on the leash'));
},{...original,nethackrc:original.nethackrc.replace('pettype:none','pettype:cat'),moves:' \x17uncursed leash\r '});

clearTimeout(bound);const report={classification:'constructed source branches on generated maps; ordinary/native reach is separate',
    total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error}))}));
if(report.passed!==report.total)process.exitCode=1;
