// C mon.c:4806-4826 through real synchronous helpers. No runtime mocks.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { hide_monst, seemimic } from '../js/mon.js';
import { makemon } from '../js/makemon.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { obj_extract_self } from '../js/invent.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { initRng, enableRngLog, getRngLog, rn2 } from '../js/rng.js';
import { COULD_SEE, IN_SIGHT, TEMP_LIT, cansee } from '../js/vision.js';
import { ROOM, CORR, POOL, NO_MINVENT, MM_NOGRP, MM_NOWAIT, M_AP_NOTHING,
    M_AP_OBJECT, PIT, BEAR_TRAP, FROMOUTSIDE } from '../js/const.js';

const initial = {seed:6202,datetime:'20000110090000',moves:' ',
    nethackrc:'OPTIONS=name:Control,role:Barbarian,race:human,gender:male,align:neutral,playmode:debug\n'
        +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'};
const mx=35, my=10;
function draws(seed,count) {
    initRng(seed); enableRngLog();
    const values=Array.from({length:count},()=>rn2(3));
    return {values,calls:[...getRngLog()]};
}
function branchSeed(check) {
    for (let seed=1;seed<=100;seed++) if (check(draws(seed,2).values)) return seed;
    throw Error('no deterministic branch seed');
}
const first=branchSeed(([a])=>a===0), second=branchSeed(([a,b])=>a!==0 && b===0);
const misses=branchSeed(([a,b])=>a!==0 && b!==0);
async function setup(species=PMNAMES.PM_SMALL_MIMIC,lit=true) {
    const run=await runSegment({...initial,storage:new InMemoryStorage()});
    run._display.onEmptyQueue=()=>27;
    game._preNhgetchHook=null;
    game.level.monsters=[]; game.level.monAt.clear(); game.level.traps=[];
    for (const obj of [...game.level.objects]) obj_extract_self(obj);
    game.u.ux=30; game.u.uy=10; game.u.intrinsic={}; game.u.uprops={}; game.u.blocked={};
    game.u.ublind=0; game.u.uinwater=0; game.u.uswallow=false; game.u.ustuck=null;
    game.u.usteed=null; game.in_mklev=false;
    for (let x=28;x<=38;x++) for (let y=7;y<=13;y++) {
        Object.assign(game.level.at(x,y),{typ:ROOM,lit:1,waslit:1,seenv:255,roomno:0});
        game.viz_array[y][x]=IN_SIGHT|COULD_SEE|TEMP_LIT;
    }
    const mon=await makemon(game.mons[species],mx,my,NO_MINVENT|MM_NOGRP|MM_NOWAIT);
    assert.ok(mon); seemimic(mon);
    Object.assign(mon,{mundetected:0,mcan:0,msleeping:0,mfrozen:0,mtrapped:0,mtame:0,mpeaceful:1});
    game.viz_array[my][mx]=(lit ? IN_SIGHT|COULD_SEE : 0)|TEMP_LIT;
    return mon;
}
async function shelter(cursed=false) {
    const obj=mksobj(ONAMES.DAGGER,false,false); obj.cursed=+cursed;
    await place_object(obj,mx,my); return obj;
}
function call(mon,seed,count) {
    const expected=draws(seed,count).calls;
    initRng(seed); enableRngLog();
    const vision=game.viz_array.map(row=>Array.from(row));
    assert.equal(hide_monst(mon),undefined,'synchronous void contract');
    assert.deepEqual(game.viz_array.map(row=>Array.from(row)),vision,'restore every vision bit and leave other squares unchanged');
    assert.deepEqual(getRngLog(),expected,'only the C restrap chance draws');
}

for (const lit of [true,false]) for (const [name,seed,count,hidden] of [
    ['first attempt',first,1,true],['second attempt',second,2,true],['both chances missed',misses,2,false],
]) test(`mimic ${lit?'visible':'unseen'}: ${name}`,async()=>{
    const mon=await setup(PMNAMES.PM_SMALL_MIMIC,lit); await shelter();
    assert.equal(cansee(mx,my),lit); call(mon,seed,count);
    assert.equal(mon.m_ap_type,hidden?M_AP_OBJECT:M_AP_NOTHING);
    assert.equal(mon.mappearance,hidden?ONAMES.DAGGER:0);
    assert.equal(mon.mundetected,0);
});
for (const lit of [true,false]) for (const [name,seed,hidden] of [
    ['successful first chance',first,1],['failed single chance',misses,0],
]) test(`trapper ${lit?'visible':'unseen'}: ${name}`,async()=>{
    const mon=await setup(PMNAMES.PM_TRAPPER,lit);
    call(mon,seed,1); assert.equal(mon.mundetected,hidden); assert.equal(mon.m_ap_type,M_AP_NOTHING);
});
for (const mode of ['ordinary monster','already hidden','already disguised','cancelled mimic','cancelled trapper']) {
    test(`guard: ${mode}`,async()=>{
        const mon=await setup(mode==='ordinary monster'?PMNAMES.PM_GOBLIN:
            mode==='cancelled trapper'?PMNAMES.PM_TRAPPER:PMNAMES.PM_SMALL_MIMIC);
        if (mode==='already hidden') mon.mundetected=1;
        if (mode==='already disguised') {mon.m_ap_type=M_AP_OBJECT;mon.mappearance=ONAMES.DAGGER;}
        if (mode.startsWith('cancelled')) mon.mcan=1;
        const before=[mon.mundetected,mon.m_ap_type,mon.mappearance];
        call(mon,first,0); assert.deepEqual([mon.mundetected,mon.m_ap_type,mon.mappearance],before);
    });
}
for (const field of ['msleeping','mfrozen']) test(`mimic ${field} retains both chance draws`,async()=>{
    const mon=await setup(); await shelter(); mon[field]=5;
    call(mon,first,2); assert.equal(mon.m_ap_type,M_AP_NOTHING); assert.equal(mon[field],5);
});
for (const mode of ['stuck','nonpit trap','pit','corridor','sensed adjacent']) test(`trapper late guard: ${mode}`,async()=>{
    const mon=await setup(PMNAMES.PM_TRAPPER);
    if (mode==='stuck') game.u.ustuck=mon;
    if (mode==='nonpit trap'||mode==='pit') {
        mon.mtrapped=1; game.level.traps.push({tx:mx,ty:my,ttyp:mode==='pit'?PIT:BEAR_TRAP});
    }
    if (mode==='corridor') game.level.at(mx,my).typ=CORR;
    if (mode==='sensed adjacent') {game.u.ux=mx-1;game.u.intrinsic.HDetect_monsters=FROMOUTSIDE;}
    call(mon,first,1); assert.equal(mon.mundetected,mode==='pit'?1:0);
});
test('snake shelter refresh sees the restored vision before hideunder returns',async()=>{
    const mon=await setup(PMNAMES.PM_GARTER_SNAKE); await shelter();
    game.level.at(mx,my).remembered_glyph=null;
    call(mon,first,0); assert.equal(mon.mundetected,1);
    assert.equal(game.level.at(mx,my).remembered_glyph?.glyph?.otyp,ONAMES.DAGGER);
});
test('snake without shelter stays visible',async()=>{
    const mon=await setup(PMNAMES.PM_GARTER_SNAKE);
    call(mon,first,0); assert.equal(mon.mundetected,0);
});
test('pet snake rejects a cursed shelter',async()=>{
    const mon=await setup(PMNAMES.PM_GARTER_SNAKE); await shelter(true);mon.mtame=10;
    call(mon,first,0); assert.equal(mon.mundetected,0);
});
for (const pool of [true,false]) test(`eel ${pool?'in pool':'on dry floor'} takes no restrap draw`,async()=>{
    const mon=await setup(PMNAMES.PM_GIANT_EEL);game.level.at(mx,my).typ=pool?POOL:ROOM;
    call(mon,first,0);assert.equal(mon.mundetected,pool?1:0);
});
