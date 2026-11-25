// Constructed C contracts through real public owners. These are not native evidence.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game as g} from '../js/gstate.js';
import {invocation_message,invocation_pos} from '../js/hack.js';
import {domove} from '../js/cmd.js';
import {u_on_newpos,teleds} from '../js/teleport.js';
import {mksobj,place_object} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {begin_burn} from '../js/timeout.js';
import {make_blinded,set_itimeout} from '../js/potion.js';
import {Blind,Levitation,Flying} from '../js/youprop.js';
import {stairway_add} from '../js/mklev.js';
import {makemon} from '../js/makemon.js';
import {tamedog} from '../js/dog.js';
import {put_saddle_on_mon,mount_steed} from '../js/steed.js';
import {resetInputState} from '../js/input.js';
import {pline} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import * as C from '../js/const.js';
import {clearMessages,messages,form,seed} from './status-followup-test-setup.mjs';
import {hash} from './half-damage-reader-observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
// BEGIN mandatory canonical C preflight. Metadata checks, not native replay.
const canonicalRoot = new URL('../', import.meta.url);
const canonicalSHA = bytes => createHash('sha256').update(bytes).digest('hex');
const canonicalRecipeBytes = readFileSync(new URL('tools/gen-sessions/recipes/invocation-message-owner.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalRecipeBytes), '4ff09eeee073ab87dcefb77a1fd5b1d5f76d209d06a5396ab77f6a801de8ed10', 'unchanged recording recipe');
const canonicalRecipe = JSON.parse(canonicalRecipeBytes);
const canonicalLockBytes = readFileSync(new URL('tools/gen-sessions/evidence/invocation-message-owner/input-lock.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalLockBytes), 'ca5b3e9408795be6a8953cf3588a2a82f158346cfdac43ae94aac8fd6c62c3ba', 'original final input lock');
const canonicalLock = JSON.parse(canonicalLockBytes);
assert.equal(canonicalLock.recipeSHA256, canonicalSHA(canonicalRecipeBytes));
assert.deepEqual(canonicalRecipe.segments, canonicalLock.segments);
assert.deepEqual(canonicalRecipe.branchRequirements, canonicalLock.branchRequirements);
assert.deepEqual(canonicalRecipe.unchangedOutputHashes, canonicalLock.negativeHashes);
const canonicalFields = ['name', 'seed', 'datetime', 'nethackrc', 'moves'];
const canonicalTuples = canonicalRecipe.segments.map(s => canonicalFields.map(field => ({field, present:Object.hasOwn(s,field), value:s[field]})));
assert.equal(canonicalSHA(JSON.stringify(canonicalTuples)), '7afc7e0665b98693f6d935340d0d17ee3b05c05dcc5411472ac418a309185feb');
assert.equal(canonicalLock.tupleSHA256, canonicalSHA(JSON.stringify(canonicalTuples)));
assert.equal(canonicalRecipe.requireBranchAssertions, true);
assert.equal(canonicalRecipe.branches.length, 4);
assert.deepEqual(canonicalRecipe.branchAssertions.map(a => a.segment), [0, 1, 2, 3]);
const canonicalBytes = readFileSync(new URL('tools/gen-sessions/generated/invocation-message-owner.session.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalBytes), 'a333e1d3d354f9f35c32c1fe6c8c2040eaf24b3a699e678ad996e9d6e4dda819', 'locked canonical C raw');
assert.equal(canonicalBytes.length, 2768201);
const canonicalNative = JSON.parse(canonicalBytes);
assert.equal(canonicalNative.source, 'c');
assert.equal(canonicalNative.version, 5);
assert.equal(canonicalNative.segments.length, 4);
assert.equal(canonicalRecipe.segments.length, 4);
assert.deepEqual(recordingIntegrityErrors(canonicalNative), [], 'canonical recording integrity');
assert.deepEqual(branchAssertionErrors(canonicalRecipe, canonicalNative), [], 'all four original primary branches');
for (let i = 0; i < 4; i++) {
    const actual = canonicalNative.segments[i], expected = canonicalRecipe.segments[i];
    for (const field of canonicalFields) {
        assert.ok(Object.hasOwn(expected, field), `recipe field presence ${i} ${field}`);
        assert.equal(Object.hasOwn(actual, field), Object.hasOwn(expected, field), `C field presence ${i} ${field}`);
        assert.deepEqual(actual[field], expected[field], `C field value ${i} ${field}`);
    }
    assert.deepEqual(actual.steps.map(step => step.key), [null, ...expected.moves], `every C key ${i}`);
}
assert.equal(canonicalRecipe.segments.reduce((n,s) => n + s.moves.length, 0), 171);
assert.equal(canonicalNative.segments.reduce((n,s) => n + s.steps.length, 0), 175);
// END mandatory canonical C preflight.
const original=JSON.parse(readFileSync(new URL('gen-sessions/recipes/invocation-message-owner.json',import.meta.url))).segments[0];
const approach=original.moves.slice(0,-3);
const results=[],bound=setTimeout(()=>process.exit(2),55000);
let run;
async function check(name,fn){const r={name};try{
    run=await runSegment({...original,moves:approach,storage:new InMemoryStorage()});
    let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<=12,'bounded feedback');return 32;};
    g._preNhgetchHook=null;resetInputState();clearMessages();seed();
    assert.deepEqual(g.invocation_pos,{x:65,y:13});assert.deepEqual([g.u.ux,g.u.uy],[66,13]);
    assert.equal(g.u.uevent?.uvibrated||0,0);await fn(r);r.pass=true;
}catch(e){r.pass=false;r.error=e.message.slice(0,500);}
    r.text=messages().slice(0,500);r.rngCalls=getRngLog().length;r.rngSHA256=hash(getRngLog());results.push(r);}
function atSquare(){u_on_newpos(65,13);assert.equal(invocation_pos(g.u.ux,g.u.uy),true);}
async function prepared(spe=7,lit=true,carried=true){const o=mksobj(O.CANDELABRUM_OF_INVOCATION,false,false);
    Object.assign(o,{spe,age:500,known:1});if(carried)addinv(o);else place_object(o,65,13);
    if(lit)await begin_burn(o,false);assert.equal(!!o.lamplit,lit);return o;}
async function clue(expected){clearMessages();seed();await invocation_message();assert.ok(messages().includes(expected));
    assert.equal(g.u.uevent.uvibrated,1);assert.deepEqual(getRngLog(),[]);}
async function step(dx,dy){g.u.dx=dx;g.u.dy=dy;g.u.umoved=false;g.domove_attempting=C.DOMOVE_WALK;await domove();}

await check('grounded human uses feet',async()=>{atSquare();await clue('a strange vibration under your feet.');});
for(const [name,id,text] of [['feline',P.PM_KITTEN,'rear paws'],['equine',P.PM_PONY,'rear hooves'],
    ['jelly',P.PM_BLUE_JELLY,'pseudopod roots'],['spider',P.PM_GIANT_SPIDER,'claws']])
    await check(name+' form uses actual body-part plural',async()=>{atSquare();form(id);await clue('a strange vibration under your '+text+'.');});
await check('timed levitation uses beneath you',async()=>{atSquare();set_itimeout('HLevitation',30);assert.ok(Levitation());await clue('a strange vibration beneath you.');});
await check('flying form uses beneath you',async()=>{atSquare();form(P.PM_WINGED_GARGOYLE);assert.ok(Flying());await clue('a strange vibration beneath you.');});
await check('actual mount uses steed name',async()=>{const m=await makemon(g.mons[P.PM_PONY],65,13,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(m);assert.ok(await tamedog(m,null,false));put_saddle_on_mon(mksobj(O.SADDLE,false,false),m);
    assert.equal(await mount_steed(m,true),true);assert.equal(g.u.usteed,m);await clue('a strange vibration beneath your pony.');});
await check('actual mount takes precedence over hero levitation',async()=>{const m=await makemon(g.mons[P.PM_PONY],65,13,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(m);assert.ok(await tamedog(m,null,false));put_saddle_on_mon(mksobj(O.SADDLE,false,false),m);
    assert.equal(await mount_steed(m,true),true);set_itimeout('HLevitation',30);await clue('a strange vibration beneath your pony.');});
await check('nomul clears positive run travel and multi state',async()=>{atSquare();Object.assign(g.context,{run:8,travel:1,travel1:1,mv:1});g.multi=9;
    g.u.usleep=7;g.u.uinvulnerable=true;await clue('under your feet.');assert.equal(g.multi,0);
    assert.deepEqual([g.context.run,g.context.travel,g.context.travel1,g.context.mv],[0,0,0,0]);assert.equal(g.u.usleep,0);assert.equal(g.u.uinvulnerable,false);});
await check('nomul retains longer helplessness',async()=>{atSquare();g.multi=-4;await clue('under your feet.');assert.equal(g.multi,-4);});
for(const [name,alter] of [
    ['off square',()=>{}],['other depth',()=>{atSquare();g.u.uz.dlevel--;}],
    ['non-hell dungeon',()=>{atSquare();g.u.uz.dnum=0;}],['no invocation position',()=>{atSquare();g.invocation_pos=null;}],
    ['stairs',()=>{atSquare();stairway_add(65,13,false,false,g.u.uz);}],
    ['ladder',()=>{atSquare();stairway_add(65,13,false,true,g.u.uz);}]
]) await check(name+' is inert',async()=>{alter();g.multi=7;g.context.run=3;clearMessages();seed();await invocation_message();
    assert.equal(messages(),'');assert.equal(g.u.uevent?.uvibrated||0,0);assert.equal(g.multi,7);assert.equal(g.context.run,3);assert.deepEqual(getRngLog(),[]);});
for(const [name,spe,lit,carried] of [['six candles',6,true,true],['unlit seven',7,false,true],['eight candles',8,true,true],['floor seven',7,true,false]])
    await check(name+' excludes second feedback',async()=>{atSquare();await prepared(spe,lit,carried);await clue('under your feet.');assert.doesNotMatch(messages(),/glows|throbs/);});
await check('seven lit carried candles glow when sighted',async()=>{atSquare();await prepared();await clue('glows with a strange light!');});
await check('ordinary blindness producer gives palpable feedback',async()=>{atSquare();await prepared();await make_blinded(30,false);assert.ok(Blind());await clue('throbs palpably!');});
await check('direct timeout setter is read before stale sighted cache',async r=>{atSquare();await prepared();set_itimeout('HBlinded',30);
    r.classification='constructed timeout/cache boundary, not ordinary reach';assert.ok(Blind());assert.equal(!!g.u.ublind,false);await clue('throbs palpably!');});
await check('timeout removal is read before stale blind cache',async r=>{atSquare();await prepared();await make_blinded(30,false);set_itimeout('HBlinded',0);
    r.classification='constructed timeout/cache boundary, not ordinary reach';assert.equal(Blind(),false);assert.equal(!!g.u.ublind,true);await clue('glows with a strange light!');});
await check('eyeless form preserves canonical palpable branch',async()=>{atSquare();await prepared();form(P.PM_BLUE_JELLY);assert.ok(Blind());await clue('throbs palpably!');});
await check('public movement arrives and invokes before returning',async()=>{await step(-1,0);assert.deepEqual([g.u.ux,g.u.uy],[65,13]);
    assert.equal(g.u.umoved,true);assert.equal(g.domove_succeeded,C.DOMOVE_WALK);assert.equal(g.u.uevent.uvibrated,1);assert.match(messages(),/under your feet/);});
await check('public movement away from square does not invoke',async()=>{atSquare();await step(1,0);assert.deepEqual([g.u.ux,g.u.uy],[66,13]);assert.equal(g.u.uevent?.uvibrated||0,0);assert.doesNotMatch(messages(),/strange vibration/);});
await check('failed movement while on square does not invoke',async()=>{atSquare();await step(-1,0);assert.deepEqual([g.u.ux,g.u.uy],[65,13]);assert.equal(g.u.umoved,false);assert.equal(g.u.uevent?.uvibrated||0,0);assert.doesNotMatch(messages(),/strange vibration/);});
await check('unchanged coordinates do not invoke',async()=>{atSquare();await step(0,0);assert.deepEqual([g.u.ux,g.u.uy],[65,13]);assert.equal(g.u.umoved,false);assert.equal(g.u.uevent?.uvibrated||0,0);assert.doesNotMatch(messages(),/strange vibration/);});
await check('teleport existing arrival caller still invokes',async()=>{await teleds(65,13,0);assert.equal(g.u.uevent.uvibrated,1);assert.match(messages(),/under your feet/);});
for(const second of [false,true]) await check((second?'second':'first')+' feedback holds movement before pickup',async r=>{
    if(second)await prepared();const coin=mksobj(O.GOLD_PIECE,false,false);coin.quan=1;place_object(coin,65,13);g.flags.autopickup=true;
    clearMessages();if(!second)await pline('A'.repeat(70));
    let release,ready,timer,finished=false;
    const atRead=new Promise(resolve=>{ready=resolve;});run._display.onEmptyQueue=()=>{ready();return new Promise(resolve=>{release=resolve;});};
    const work=step(-1,0).then(()=>{finished=true;});
    try{await Promise.race([atRead,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('feedback did not block')),1500);})]);
        await setImmediate();r.pending={finished,xy:[g.u.ux,g.u.uy],umoved:g.u.umoved,success:g.domove_succeeded,
            uvibrated:g.u.uevent?.uvibrated||0,where:coin.where};
    }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;release?.(32);await work;}
    assert.deepEqual(r.pending,{finished:false,xy:[65,13],umoved:true,success:C.DOMOVE_WALK,uvibrated:second?1:0,where:C.OBJ_FLOOR});
    assert.equal(g.u.uevent.uvibrated,1);assert.ok(g.invent.some(o=>o.otyp===O.GOLD_PIECE&&o.quan>=1));
});
clearTimeout(bound);const report={classification:'constructed source contracts on real generated invocation level; no native evidence',
    total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error}))}));
if(report.passed!==report.total)process.exitCode=1;
