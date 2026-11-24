// Constructed source controls, real launch_obj and real world helpers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {game} from '../js/gstate.js';
import * as trap from '../js/trap.js';
import {mksobj, place_object} from '../js/mkobj.js';
import {maketrap} from '../js/mklev.js';
import {makemon, hideunder} from '../js/makemon.js';
import {digging_context} from '../js/dig.js';
import {set_occupation} from '../js/allmain.js';
import {dosearch} from '../js/detect.js';
import {make_blinded, make_deaf} from '../js/potion.js';
import {vision_recalc, cansee} from '../js/vision.js';
import {initRng, enableRngLog, getRngLog, rn2, rnd} from '../js/rng.js';
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import * as C from '../js/const.js';
import {setup as baseSetup, clearMessages, messages} from './status-followup-test-setup.mjs';

const sx = 29, sy = 10, tx = 33;
const core = () => getRngLog().filter(s => !s.startsWith('~d'));
function seed(n = 2) {initRng(n); enableRngLog();}
function firstSeed(n, predicate) {
    for (let s = 1; s <= 100; s++) {
        initRng(s);
        if (predicate(rn2(n))) return s;
    }
    throw Error('no seed in bounded search');
}
async function setup() {
    const run = await baseSetup();
    Object.assign(game.u, {ux:31, uy:12, uhp:200, uhpmax:200, uac:100});
    game.stairs = null;
    game.launchplace = {obj:null, x:0, y:0};
    vision_recalc(); clearMessages();
    return run;
}
async function object(type = O.BOULDER, x = sx, y = sy, quan = 1) {
    const obj = mksobj(type, false, false);
    Object.assign(obj, {quan, spe:0, cursed:false, blessed:false});
    await place_object(obj, x, y);
    return obj;
}
async function launch(type = O.BOULDER, style = C.ROLL, end = tx) {
    return trap.launch_obj(type, sx, sy, end, sy, style);
}
function cleared() {assert.deepEqual(game.launchplace, {obj:null, x:0, y:0});}

test('no ammunition returns zero without clearing an unrelated digging task', async () => {
    await setup(); digging_context().effort = 19; seed();
    assert.equal(await launch(), 0); assert.equal(digging_context().effort, 19);
    assert.deepEqual(core(), []); cleared();
});

for (const quantity of [1, 2]) test(`real hiding producer, launch quantity ${quantity}`, async () => {
    await setup();
    const mon = await makemon(game.mons[P.PM_GARTER_SNAKE], sx, sy,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    assert.ok(mon);
    await object(O.BOULDER, sx, sy, quantity);
    assert.equal(await hideunder(mon), true); assert.equal(mon.mundetected, 1);
    clearMessages(); seed();
    assert.equal(await launch(), 1);
    assert.equal(mon.mundetected, quantity === 1 ? 0 : 1);
    assert.equal(game.level.objectsAt(sx, sy).length, quantity - 1);
    if (quantity === 1) assert.deepEqual(core(), []);
    else assert.deepEqual(core(), ['rnd(2)=2']); // splitobj -> next_ident
    cleared();
});

for (const [label, type, x] of [
    ['matching boulder', O.BOULDER, sx], ['matching statue', O.STATUE, sx],
    ['different position', O.BOULDER, sx - 1], ['other type', O.FLINT, sx],
]) test(`digging reset: ${label}`, async () => {
    await setup(); await object(type);
    const context = digging_context();
    Object.assign(context, {pos:{x,y:sy}, level:{dnum:0,dlevel:1}, effort:27,
        down:true, chew:true, warned:true, quiet:true, lastdigtime:123});
    const before = structuredClone(context); seed();
    assert.equal(await launch(type), 1);
    assert.deepEqual(context, label.startsWith('matching')
        ? {pos:{x:0,y:0},level:null,effort:0,down:false,chew:false,warned:false,
           quiet:false,lastdigtime:0} : before);
    assert.deepEqual(core(), []); cleared();
});

test('opposite-side ammunition uses the actual launch origin and clears the marker', async () => {
    await setup(); const obj = await object(O.BOULDER, tx);
    const seen = [], animate = game.animationFrame;
    game.animationFrame = async () => {
        seen.push({obj:game.launchplace?.obj, x:game.launchplace?.x,
            y:game.launchplace?.y, where:obj.where, trapped:obj.otrapped});
        await animate();
    };
    seed(); assert.equal(await launch(O.BOULDER, C.ROLL | C.LAUNCH_KNOWN), 1);
    assert.ok(seen.length);
    for (const s of seen) assert.deepEqual(s, {obj,x:tx,y:sy,where:C.OBJ_FREE,trapped:1});
    assert.deepEqual([obj.ox,obj.oy,obj.otrapped,obj.where], [sx,sy,0,C.OBJ_FLOOR]);
    assert.deepEqual(core(), []); cleared();
});

test('forced bones placement keeps the launch origin and intentionally retains its marker', async () => {
    await setup(); const obj = mksobj(O.BOULDER, false, false); obj.otrapped = 1;
    assert.equal(typeof trap.launch_in_progress, 'function');
    assert.equal(trap.launch_in_progress(), false);
    assert.equal(trap.force_launch_placement(), undefined);
    game.launchplace = {obj,x:sx,y:sy}; seed();
    assert.equal(trap.launch_in_progress(), true);
    await trap.force_launch_placement();
    assert.equal(obj.where,C.OBJ_FLOOR); assert.equal(obj.otrapped,0);
    assert.deepEqual([obj.ox,obj.oy],[sx,sy]); assert.equal(trap.launch_in_progress(),true);
    assert.deepEqual(core(),[]);
});

for (const half of ['none','intrinsic','extrinsic']) for (const hit of [true,false])
test(`hero ${hit?'hit':'miss'}, half physical ${half}`, async () => {
    await setup(); await object(); game.u.ux = sx + 1; game.u.uy = sy;
    game.u.uac = hit ? 100 : -100;
    game.u.intrinsic.HHalf_physical_damage = half === 'intrinsic' ? C.FROMOUTSIDE : 0;
    game.u.uprops.HALF_PHDAM = half === 'extrinsic' ? C.W_ART : 0;
    set_occupation(dosearch,'searching',0);
    // For an ordinary human and an unenchanted boulder, dmgval is one
    // object-table damage draw, followed by thitu's hit roll and exercise.
    seed(17); const damage = rnd(game.objects[O.BOULDER].oc_wsdam);
    rnd(20); if (hit) rn2(2); const expected = [...core()];
    seed(17); assert.equal(await launch(),1);
    assert.equal(game.u.uhp,200 - (hit ? (half === 'none' ? damage : Math.trunc((damage+1)/2)) : 0));
    assert.equal(!!game.occupation,!hit);
    assert.equal(messages().includes('You stop searching.'),hit);
    assert.deepEqual(core(),expected); cleared();
});

for (const fire of [false,true]) test(`landmine ${fire?'detonates':'does not fire'}, real fracture/scatter`, async () => {
    await setup(); const obj=await object(); const mine=await maketrap(sx+1,sy,C.LANDMINE);
    seed(firstSeed(10,n => (n > 2) === fire));
    const result = await launch(); const draws=core();
    assert.match(draws[0],/^rn2\(10\)=/);
    assert.equal(game.level.traps.includes(mine),!fire);
    assert.equal(messages().includes('KAABLAMM!!!'),fire);
    if (fire) {
        assert.equal(result,2); assert.equal(obj.otyp,O.ROCK);
        assert.match(draws[1],/^rn2\(60\)=/); // rn1(60,7)
        assert.ok(game.level.objects.some(o=>o.otyp===O.ROCK));
        assert.equal(game.level.objects.some(o=>o.otyp===O.BOULDER),false);
    } else {
        assert.equal(result,1); assert.deepEqual([obj.ox,obj.oy],[tx,sy]);
        assert.equal(draws.length,1);
    }
    cleared();
});

for (const same of [false,true]) test(`level teleport ${same?'stays':'migrates'}, draw before destination`, async () => {
    await setup(); const obj=await object(); obj.no_charge=1;
    const t=await maketrap(sx+1,sy,C.LEVEL_TELEP); assert.ok(t);
    seed(firstSeed(5,n=>(n===0)===same));
    const result=await launch(); const draws=core();
    assert.match(draws[0],/^rn2\(5\)=/);
    if (same) {
        assert.equal(result,1); assert.equal(obj.where,C.OBJ_FLOOR);
        assert.deepEqual([obj.ox,obj.oy],[tx,sy]); assert.equal(draws.length,1);
        assert.equal(!!t.tseen,false); assert.equal(messages().includes('disappears'),false);
    } else {
        assert.equal(result,2); assert.equal(obj.where,C.OBJ_MIGRATING);
        assert.equal(game.migrating_objs[0],obj); assert.equal(obj.owornmask,C.MIGR_RANDOM);
        assert.equal(obj.ox,game.u.uz.dnum); assert.notEqual(obj.oy,game.u.uz.dlevel);
        assert.deepEqual([obj.omigr_from_dnum,obj.omigr_from_dlevel],[game.u.uz.dnum,game.u.uz.dlevel]);
        assert.equal(obj.no_charge,0); assert.equal(obj.otrapped,0); assert.equal(t.tseen,1);
        assert.match(draws[1],/^rn2\(3\)=/); assert.equal(draws.length,2);
    }
    cleared();
});

for (const [blind,deaf] of [[false,false],[true,false],[true,true]])
test(`local teleport feedback blind=${blind} deaf=${deaf}`, async () => {
    await setup(); const obj=await object(); const t=await maketrap(sx+1,sy,C.TELEP_TRAP);
    if (blind) await make_blinded(100,false);
    await make_deaf(deaf?100:0,false);
    clearMessages(); seed(42);
    assert.equal(cansee(sx+1,sy),!blind);
    assert.equal(await launch(),2);
    assert.equal(obj.where,C.OBJ_FLOOR); assert.equal(t.tseen,1); assert.equal(obj.otrapped,0);
    assert.notDeepEqual([obj.ox,obj.oy],[tx,sy]);
    assert.equal(messages().includes('Suddenly the rolling boulder disappears!'),!blind);
    assert.equal(messages().includes('a rumbling stop abruptly.'),blind&&!deaf);
    assert.match(core()[0],/^rn2\(77\)=/); assert.match(core()[1],/^rn2\(21\)=/);
    cleared();
});

for (const type of [C.PIT,C.SPIKED_PIT,C.HOLE,C.TRAPDOOR])
test(`pit or hole ${type} consumes at the trap and stops`, async () => {
    await setup(); const obj=await object(); const t=await maketrap(sx+1,sy,type);
    seed(5); assert.equal(await launch(),2);
    assert.equal(game.level.traps.includes(t),false); assert.equal(obj.where,C.OBJ_DELETED);
    assert.equal(game.level.objectsAt(tx,sy).length,0); cleared();
    // Only a seen hole reaches shipping. useupf -> delobj also samples
    // obj_resists, even though an ordinary boulder cannot resist deletion.
    const ranges=core().map(s=>s.match(/^rn2\((\d+)\)/)?.[1]);
    assert.deepEqual(ranges,type===C.HOLE?['3','100']:['100']);
});

test('a normal launch bypasses the rolling-only landmine switch', async () => {
    await setup(); const obj=await object(); const mine=await maketrap(sx+1,sy,C.LANDMINE);
    seed(); assert.equal(await launch(O.BOULDER,0),1);
    assert.equal(game.level.traps.includes(mine),true); assert.equal(obj.otyp,O.BOULDER);
    assert.deepEqual(core(),[]); cleared();
});

test('real giant catch consumes the launch without losing monster ownership', async () => {
    await setup(); const obj=await object();
    const mon=await makemon(game.mons[P.PM_HILL_GIANT],sx+1,sy,
        C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    seed(firstSeed(3,n=>n!==0));
    assert.equal(await launch(O.BOULDER,C.ROLL|C.LAUNCH_KNOWN),2);
    assert.equal(obj.where,C.OBJ_MINVENT); assert.equal(obj.ocarry,mon);
    assert.equal(obj.otrapped,0); assert.equal(game.level.objects.includes(obj),false);
    assert.match(core()[0],/^rn2\(3\)=/); cleared();
});

test('boulder handoff retains C original-object launch marker until normal completion', async () => {
    await setup(); const first=await object(), second=await object(O.BOULDER,sx+1);
    const seen=[], animate=game.animationFrame;
    game.animationFrame=async()=>{seen.push(game.launchplace?.obj); await animate();};
    seed(); assert.equal(await launch(O.BOULDER,C.ROLL|C.LAUNCH_KNOWN),1);
    assert.ok(seen.length); assert.ok(seen.every(o=>o===first));
    assert.deepEqual([first.ox,second.ox,first.otrapped,second.otrapped],[sx+1,tx,0,0]);
    assert.deepEqual(core(),[]); cleared();
});

for (const bones of [false,true]) test(`fatal hero hit, bones eligibility ${bones}`, async () => {
    await setup(); const obj=await object();
    Object.assign(game.u,{ux:sx+1,uy:sy,uhp:1,uac:100});
    game.u.uz.dlevel=5; game.wizard=false; game.discover=false;
    game.flags.bones=bones; game.done_stopprint=1;
    game.flags.disclose='none'; game.flags.tombstone=false;
    // At depth five, can_make_bones samples rn2(2) after damage and hit.
    let chosen;
    for(let s=1;s<=100;s++) {
        initRng(s); const damage=rnd(game.objects[O.BOULDER].oc_wsdam);
        rnd(20); const allowed=rn2(2);
        if(damage>1&&allowed) {chosen=s;break;}
    }
    assert.ok(chosen); seed(chosen);
    await assert.rejects(launch(O.BOULDER,C.ROLL|C.LAUNCH_KNOWN),e=>e.__nh_gameover===true);
    assert.equal(game.program_state_gameover,true);
    assert.equal(obj.where,bones?C.OBJ_FLOOR:C.OBJ_FREE);
    if(bones) {
        assert.deepEqual([obj.ox,obj.oy,obj.otrapped],[sx,sy,0]);
        assert.ok(game.level.objects.includes(obj));
        const saved=JSON.parse(game.storage.getItem('bones:0.5'));
        const retained=saved.objects.find(o=>o.o_id===obj.o_id);
        assert.ok(retained,'the real bones writer retains the launched object');
        assert.deepEqual([retained.ox,retained.oy,retained.otrapped],[sx,sy,0]);
    } else assert.equal(game.storage.getItem('bones:0.5'),null);
});

test('a down ladder ships before a trap can act, with no nodrop draw', async () => {
    await setup(); const obj=await object();
    game.stairs={sx:sx+1,sy,up:false,isladder:true,tolev:{dnum:0,dlevel:2},next:null};
    const mine=await maketrap(sx+1,sy,C.LANDMINE); assert.ok(mine);
    seed(); assert.equal(await launch(O.BOULDER,C.ROLL|C.LAUNCH_KNOWN),2);
    assert.equal(obj.where,C.OBJ_MIGRATING); assert.equal(obj.owornmask,C.MIGR_LADDER_UP);
    assert.equal(obj.otrapped,0); assert.equal(game.level.traps.includes(mine),true);
    assert.equal(core().some(s=>s.startsWith('rn2(10)=')),false); cleared();
});

test('a landmine message suspends before deletion or fracture and resumes through real helpers', async () => {
    const run=await setup(); const obj=await object();
    const mine=await maketrap(sx+1,sy,C.LANDMINE);
    const {pline}=await import('../js/display.js');
    await pline('A previous message requires acknowledgment.');
    // This is the input boundary itself, not a replacement for any gameplay helper.
    let paused=false;
    run._display.onEmptyQueue=()=>{
        if(!paused) {
            paused=true;
            assert.equal(game.level.traps.includes(mine),true);
            assert.equal(obj.otyp,O.BOULDER); assert.equal(obj.where,C.OBJ_FREE);
            assert.equal(game.launchplace.obj,obj);
        }
        return 32;
    };
    seed(firstSeed(10,n=>n>2));
    assert.equal(await launch(),2); assert.equal(paused,true);
    assert.equal(game.level.traps.includes(mine),false); assert.equal(obj.otyp,O.ROCK);
    cleared();
});
