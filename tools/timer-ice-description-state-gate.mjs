// node --test tools/timer-ice-description-state-gate.mjs
// pager.c:614 ice_descr(), invent.c:4069 dfeature_at(), timeout.h timer index.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {ice_descr} from '../js/pager.js';
import {dfeature_at} from '../js/invent.js';
import {start_timer,TIMER_LEVEL,MELT_ICE_AWAY} from '../js/timeout.js';
import {IN_SIGHT} from '../js/vision.js';
import {ICE,ROOM,DRAWBRIDGE_UP,DB_ICE,COLNO,ROWNO} from '../js/const.js';
import {initRng,enableRngLog,getRngLog} from '../js/rng.js';

async function setup(remaining, x=30, y=10) {
    await runSegment({seed:99812, datetime:'20000110090000', moves:' ',
        nethackrc:'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage:new InMemoryStorage()});
    game.moves=100; game.timer_base=[];
    Object.assign(game.u,{ux:30,uy:10,xray_range:0});
    game.u.uprops.LEVITATION=0;
    game.u.intrinsic.HLevitation=0;
    game.decor_levitate_override=false;
    game.viz_array=Array.from({length:ROWNO},()=>new Uint8Array(COLNO));
    game.viz_array[y][x]=IN_SIGHT;
    game.level.at(x,y).typ=ICE;
    if(remaining!==null) start_timer(remaining,TIMER_LEVEL,MELT_ICE_AWAY,(x<<16)|y);
    game.iflags.ice_rating=99;
    initRng(3); enableRngLog();
}
function check(x,y,description,rating) {
    const timers=game.timer_base.map(t=>({...t})), nextId=game.timer_id;
    assert.equal(ice_descr(x,y),description); assert.equal(game.iflags.ice_rating,rating);
    game.iflags.ice_rating=99;
    assert.equal(dfeature_at(x,y),description); assert.equal(game.iflags.ice_rating,rating);
    assert.deepEqual(game.timer_base,timers); assert.equal(game.timer_id,nextId);
    assert.deepEqual(getRngLog(),[]);
}

// Literal C boundaries, including !time_left at zero and the negative-time arm.
for(const [remaining,description,rating] of [
    [null,'solid ice',0], [0,'solid ice',0], [-1,'slushy ice',5],
    [1,'slushy ice',5], [14,'slushy ice',5], [15,'thin ice',4], [50,'thin ice',4],
    [51,'unsteady ice',3], [100,'unsteady ice',3], [101,'steady ice',2],
    [1000,'steady ice',2], [1001,'sturdy ice',1],
]) test(`ice description: ${remaining===null?'no timer':remaining+' turns'}`,async()=>{
    await setup(remaining); check(30,10,description,rating);
});
test('ice description: raised drawbridge delegates through the ice predicate',async()=>{
    await setup(14);
    Object.assign(game.level.at(30,10),{typ:DRAWBRIDGE_UP,drawbridgemask:DB_ICE});
    check(30,10,'slushy ice',5);
});
test('ice description: distant visible ice hides thickness',async()=>{
    await setup(100,33,10); check(33,10,'ice',-1);
});
test('ice description: xray range expands the exact near-distance formula',async()=>{
    await setup(100,33,12); game.u.xray_range=3; check(33,12,'unsteady ice',3);
});
test('ice description: xray still excludes squared distance sixteen at range three',async()=>{
    await setup(100,34,10); game.u.xray_range=3; check(34,10,'ice',-1);
});
test('ice description: unseen adjacent ice hides thickness',async()=>{
    await setup(100,31,10); game.viz_array[10][31]=0; check(31,10,'ice',-1);
});
test('ice description: grounded hero can feel unseen ice underfoot',async()=>{
    await setup(100); game.viz_array[10][30]=0; check(30,10,'unsteady ice',3);
});
test('ice description: levitating hero cannot feel unseen ice underfoot',async()=>{
    await setup(100); game.viz_array[10][30]=0; game.u.uprops.LEVITATION=1;
    check(30,10,'ice',-1);
});
test('ice description: decor override exposes distant unseen ice thickness',async()=>{
    await setup(100,34,10); game.viz_array[10][34]=0; game.decor_levitate_override=true;
    check(34,10,'unsteady ice',3);
});
test('ice description: other square timers do not select this square rating',async()=>{
    await setup(100); start_timer(1,TIMER_LEVEL,MELT_ICE_AWAY,(31<<16)|10);
    check(30,10,'unsteady ice',3);
});
test('ice description: non-ice keeps diagnostic and feature behavior',async()=>{
    await setup(100); game.level.at(30,10).typ=ROOM;
    assert.equal(ice_descr(30,10),`[ice:${ROOM}?]`);
    assert.equal(game.iflags.ice_rating,-1); assert.equal(dfeature_at(30,10),null);
    assert.deepEqual(getRngLog(),[]);
});
