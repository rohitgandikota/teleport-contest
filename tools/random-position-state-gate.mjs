// Constructed source contracts through public owners and real keyboard producers.
// Region bounds and tower identity are fixtures; terrain, maps, helpers and RNG are unchanged.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game as g} from '../js/gstate.js';
import {u_on_rndspot,On_W_tower_level} from '../js/dungeon.js';
import {u_on_newpos} from '../js/teleport.js';
import {occupied} from '../js/mklev.js';
import {set_uinwater} from '../js/hack.js';
import {Levitation,Flying,Passes_walls} from '../js/youprop.js';
import {resetInputState} from '../js/input.js';
import {pline,tty_clear_nhwindow_message} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import * as C from '../js/const.js';
import {hash} from './half-damage-reader-observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
// BEGIN mandatory canonical C preflight. Metadata checks, not native replay.
const canonicalRoot = new URL('../', import.meta.url);
const canonicalSHA = bytes => createHash('sha256').update(bytes).digest('hex');
const canonicalRecipeBytes = readFileSync(new URL('tools/gen-sessions/recipes/random-position-owner.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalRecipeBytes), '7f7459f8941384ecdf004d80af7539d5f4beff769bbc3575d6535dd3d55500e7', 'unchanged recording recipe');
const canonicalRecipe = JSON.parse(canonicalRecipeBytes);
const canonicalLockBytes = readFileSync(new URL('tools/gen-sessions/evidence/random-position-owner/input-lock.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalLockBytes), '30c1155a1f95ba62b105df9c462420d67b1b7e8b2aa504fa1a1ec8cd7cd606e8', 'original final input lock');
const canonicalLock = JSON.parse(canonicalLockBytes);
assert.equal(canonicalLock.recipeSHA256, canonicalSHA(canonicalRecipeBytes));
assert.deepEqual(canonicalRecipe.segments, canonicalLock.segments);
const canonicalFields = ['name', 'seed', 'datetime', 'nethackrc', 'moves'];
assert.deepEqual(canonicalLock.tupleFields, canonicalFields);
const canonicalTuples = canonicalRecipe.segments.map(s => canonicalFields.map(field => ({field, present:Object.hasOwn(s,field), value:s[field]})));
assert.equal(canonicalSHA(JSON.stringify(canonicalTuples)), '158b7f3e5d8c524259ca0deb8d0a15fbdd2d6c2e46c23389546fab59e6a63d98');
assert.equal(canonicalLock.tupleSHA256, canonicalSHA(JSON.stringify(canonicalTuples)));
assert.equal(canonicalLock.cases, 7);
assert.equal(canonicalLock.keys, 517);
assert.equal(canonicalLock.boundaries, 524);
assert.equal(canonicalRecipe.requireBranchAssertions, true);
assert.equal(canonicalRecipe.branches.length, 7);
assert.equal(canonicalRecipe.branchAssertions.length, 7);
assert.deepEqual(canonicalRecipe.branchAssertions.map(a => a.segment), [0, 1, 2, 3, 4, 5, 6]);
const canonicalBytes = readFileSync(new URL('tools/gen-sessions/generated/random-position-owner.session.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalBytes), '1647efc2ac74c6d08288f86a494870c445fdf9f76491c5b329e51d26575c69ec', 'locked canonical C raw');
assert.equal(canonicalBytes.length, 1429971);
const canonicalNative = JSON.parse(canonicalBytes);
assert.equal(canonicalNative.source, 'c');
assert.equal(canonicalNative.version, 5);
assert.equal(canonicalNative.segments.length, 7);
assert.equal(canonicalRecipe.segments.length, 7);
assert.deepEqual(recordingIntegrityErrors(canonicalNative), [], 'canonical recording integrity');
assert.deepEqual(branchAssertionErrors(canonicalRecipe, canonicalNative), [], 'all seven original primary branches');
for (let i = 0; i < 7; i++) {
    const actual = canonicalNative.segments[i], expected = canonicalRecipe.segments[i];
    for (const field of canonicalFields) {
        assert.ok(Object.hasOwn(expected, field), `recipe field presence ${i} ${field}`);
        assert.equal(Object.hasOwn(actual, field), Object.hasOwn(expected, field), `C field presence ${i} ${field}`);
        assert.deepEqual(actual[field], expected[field], `C field value ${i} ${field}`);
    }
    assert.deepEqual(actual.steps.map(step => step.key), [null, ...expected.moves], `every C key ${i}`);
}
assert.equal(canonicalRecipe.segments.reduce((n,s) => n + s.moves.length, 0), 517);
assert.equal(canonicalNative.segments.reduce((n,s) => n + s.steps.length, 0), 524);
// END mandatory canonical C preflight.
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/random-position-owner.json',import.meta.url)));
const lev=recipe.segments[0],fly=recipe.segments[1];
const prefix=part=>part.moves.slice(0,part.moves.indexOf('#wizmakemap'));
const wallLev={...lev,moves:prefix(lev)},wallFly={...fly,moves:prefix(fly)};
const openLev={...lev,moves:prefix(recipe.segments[2])};
const openFly={...fly,moves:prefix(fly).slice(0,-5)};
const noAir={...lev,moves:' #polyself\rxorn\r  \x1b\x1bl  \x1b\x1b'};
const both={...lev,moves:openLev.moves+'\x17uncursed amulet of flying\r  \x1b\x1bPb  \x1b\x1bl  \x1b\x1b'};
const results=[],bound=setTimeout(()=>process.exit(2),55000);let run;
const xy=()=>[g.u.ux,g.u.uy];
const blocked=()=>[g.u.blocked?.LEVITATION||0,g.u.blocked?.FLYING||0];
const messages=()=>[...(g._msg_history||[]),g._toplines||''].join('\n');
async function boot(part){
    run=await runSegment({...part,storage:new InMemoryStorage()});
    let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<=20,'bounded feedback input');return 32;};
    g._preNhgetchHook=null;resetInputState();tty_clear_nhwindow_message(0);
}
async function check(name,part,fn){
    const r={name,classification:'constructed source contract; not ordinary or native evidence'};
    try{await boot(part);r.initial={xy:xy(),blocked:blocked(),lev:Levitation(),fly:Flying()};
        const start=getRngLog().length;await fn(r);r.additionalCalls=getRngLog().length-start;r.pass=true;
    }catch(e){r.pass=false;r.error=e.message.slice(0,650);}
    r.final={xy:xy(),blocked:blocked(),lev:Levitation(),fly:Flying()};r.rngSHA256=hash(getRngLog());results.push(r);
}
function regions(tower=false){
    const pts=[];
    for(let x=66;x>=1&&pts.length<3;x--){
        const loc=g.level.at(x,14);
        if(loc.typ===C.ROOM&&!occupied(x,14)&&!g.level.monAt.get(`${x},14`))pts.push([x,14]);
    }
    assert.equal(pts.length,3);
    const rect=([x,y])=>({lx:x,ly:y,hx:x,hy:y,nlx:0,nly:0,nhx:0,nhy:0});
    g.dndest=rect(pts[0]);g.updest=rect(pts[1]);
    Object.assign(g.dndest,{nlx:pts[2][0],nly:pts[2][1],nhx:pts[2][0],nhy:pts[2][1]});
    if(tower)g.wiz1_level={...g.u.uz};
    assert.equal(On_W_tower_level(g.u.uz),tower);
    return pts;
}
function actualWall(){assert.deepEqual(xy(),[68,14]);assert.ok(Passes_walls());
    assert.ok(C.IS_OBSTRUCTED(g.level.at(g.u.ux,g.u.uy).typ));
    assert.ok(blocked().every(b=>(b&C.FROMOUTSIDE)!==0));assert.equal(Levitation(),false);assert.equal(Flying(),false);}

for(const [flag,tower] of [[0,false],[1,false],[2,false],[3,false],[4,false],[2,true],[3,true]])
    await check(`levitation region dispatch flags=${flag} tower=${tower}`,wallLev,async r=>{
        actualWall();const pts=regions(tower),expected=pts[tower?2:(flag&1)?1:0];
        r.constructed={flag,tower,regions:pts};const before=getRngLog().length;
        await u_on_rndspot(flag);assert.deepEqual(xy(),expected);
        assert.equal(getRngLog().length-before,2,'one-cell real placement still draws x then y');
        assert.deepEqual(blocked(),[0,C.I_SPECIAL]);assert.equal(Levitation(),true);assert.equal(Flying(),false);
        assert.match(messages(),/You start to float in the air!/);
    });
for(const [flag,tower] of [[0,false],[1,false],[3,true]])
    await check(`flight region dispatch flags=${flag} tower=${tower}`,wallFly,async r=>{
        actualWall();const pts=regions(tower);r.constructed={flag,tower,regions:pts};
        await u_on_rndspot(flag);assert.deepEqual(xy(),pts[tower?2:flag&1?1:0]);
        assert.deepEqual(blocked(),[0,0]);assert.equal(Flying(),true);assert.equal(Levitation(),false);
        assert.match(messages(),/You start flying\./);
    });
await check('unspecified region places on real open floor then restores levitation',wallLev,async()=>{
    actualWall();assert.equal(g.dndest?.lx||0,0);await u_on_rndspot(0);
    assert.ok([C.ROOM,C.AIR,C.CORR].includes(g.level.at(g.u.ux,g.u.uy).typ));
    assert.equal(Levitation(),true);assert.deepEqual(blocked(),[0,C.I_SPECIAL]);
});
await check('terrain-only blocking clears without inventing airborne ability or feedback',noAir,async()=>{
    actualWall();regions();const before=messages();await u_on_rndspot(0);
    assert.deepEqual(blocked(),[0,0]);assert.equal(Levitation(),false);assert.equal(Flying(),false);
    assert.equal(messages(),before);
});
await check('actual ring and amulet restore levitation while flight remains specially blocked',both,async()=>{
    actualWall();assert.ok(g.u.uprops.LEVITATION&&g.u.uprops.FLYING);regions();await u_on_rndspot(0);
    assert.deepEqual(blocked(),[0,C.I_SPECIAL]);assert.equal(Levitation(),true);assert.equal(Flying(),false);
    assert.doesNotMatch(messages(),/You start flying\./);
});
for(const [name,part,wantLev,wantFly] of [['levitation',openLev,true,false],['flight',openFly,false,true],['grounded',{...lev,moves:' '},false,false]])
    await check(name+' unblocked arrival negative',part,async()=>{
        assert.equal(Levitation(),wantLev);assert.equal(Flying(),wantFly);regions();
        const before=messages();await u_on_rndspot(0);
        assert.equal(Levitation(),wantLev);assert.equal(Flying(),wantFly);assert.equal(messages(),before);
    });
for(const [name,part] of [['levitation',wallLev],['flight',wallFly]])
    await check(name+' restored arrival is idempotent',part,async()=>{
        actualWall();regions();await u_on_rndspot(0);
        const firstAbility=name==='levitation'?Levitation():Flying();
        const before=messages(),props=blocked();await u_on_rndspot(0);
        assert.equal(firstAbility,true);
        assert.equal(messages(),before);assert.deepEqual(blocked(),props);
    });
await check('dry set_uinwater is not a substitute for arrival terrain switching',wallLev,async()=>{
    actualWall();assert.equal(g.u.uinwater||0,0);const pts=regions();await u_on_newpos(...pts[0]);
    await set_uinwater(0);assert.equal(Levitation(),false);assert.ok(blocked()[0]&C.FROMOUTSIDE);
    await u_on_rndspot(0);assert.equal(Levitation(),true);
});
await check('position owner alone retains terrain blocks until random-arrival owner tail',wallFly,async()=>{
    actualWall();const pts=regions();await u_on_newpos(...pts[0]);
    assert.equal(Flying(),false);assert.ok(blocked()[1]&C.FROMOUTSIDE);
    await u_on_rndspot(0);assert.equal(Flying(),true);
});
await check('terrainstatus observes remembered destination terrain through the existing helper',wallLev,async r=>{
    actualWall();const pts=regions();const loc=g.level.at(...pts[0]);
    assert.equal(loc.lastseentyp,C.ROOM,'real seen room, no map edits');
    g.flags.terrainstatus=true;g.iflags.terrain_typ=C.MAX_TYPE;r.constructed='enable terrainstatus and dirty its cached classification';
    await u_on_rndspot(0);assert.equal(g.iflags.terrain_typ,C.xFLOOR);assert.equal(g.disp.botl,true);
});
for(const [name,part] of [['levitation',wallLev],['flight',wallFly]])
    await check(name+' arrival awaits real feedback after placement',part,async r=>{
        actualWall();const pts=regions();await pline('A'.repeat(70));
        let release,ready,timer,finished=false;
        const waiting=new Promise(resolve=>{ready=resolve;});
        run._display.onEmptyQueue=()=>{ready('input');return new Promise(resolve=>{release=resolve;});};
        const work=u_on_rndspot(0).then(()=>{finished=true;return 'finished';});
        try{
            const event=await Promise.race([waiting,work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('feedback wait timed out')),1500);})]);
            await setImmediate();r.pending={event,finished,xy:xy(),blocked:blocked(),lev:Levitation(),fly:Flying()};
        }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;release?.(32);await work;}
        assert.equal(r.pending.event,'input');assert.equal(r.pending.finished,false);assert.deepEqual(r.pending.xy,pts[0]);
        assert.equal(r.pending.blocked[0],0);
        if(name==='levitation'){
            assert.equal(r.pending.lev,true);assert.ok(r.pending.blocked[1]&C.FROMOUTSIDE,'flight cleanup follows float_up feedback');
            assert.deepEqual(blocked(),[0,C.I_SPECIAL]);
        }else{
            assert.equal(r.pending.fly,true);assert.deepEqual(r.pending.blocked,[0,0]);
        }
    });

clearTimeout(bound);const report={classification:'source contracts on generated maps; constructed region metadata and scheduling are not ordinary/native evidence',
    total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error}))}));
if(report.passed!==report.total)process.exitCode=1;
