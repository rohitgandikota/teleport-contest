// C mon.c:5680-5710. Real helper calls; constructed state boundaries.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup,clearMessages,messages,seed,x,y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {golemeffects,hmonas} from '../js/uhitm.js';
import {polymon} from '../js/polyself.js';
import {newcham} from '../js/mon.js';
import {mon_adjust_speed,m_dowear} from '../js/worn.js';
import {mksobj} from '../js/mkobj.js';
import {mpickobj} from '../js/steal.js';
import {canseemon,pline} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P,ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';
async function prepare(species=P.PM_FLESH_GOLEM,{accessible=true,invisible=false}={}) {
    const run=await setup();
    const mon=await makemon(game.mons[species],x+1,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG|(invisible?C.MM_MINVIS:0));
    assert.equal(mon.data,game.mons[species]);assert.equal(mon.mnum,species);
    Object.assign(mon,{mhp:20,mhpmax:100,mpeaceful:0,msleeping:0});
    game.flags.accessiblemsg=accessible;game.iflags.getpos_coords='m';
    assert.equal(!!canseemon(mon),!invisible);
    clearMessages();seed(2);return {run,mon};
}
for(const [species,type,label,slower,heal]of [
    [P.PM_FLESH_GOLEM,A.AD_FIRE,'flesh fire',true,0],
    [P.PM_FLESH_GOLEM,A.AD_COLD,'flesh cold',true,0],
    [P.PM_FLESH_GOLEM,A.AD_ELEC,'flesh electric',false,2],
    [P.PM_IRON_GOLEM,A.AD_ELEC,'iron electric',true,0],
    [P.PM_IRON_GOLEM,A.AD_FIRE,'iron fire',false,9],
])test(`real elemental effect carries its location: ${label}`,async()=>{
    const {mon}=await prepare(species);await golemeffects(mon,type,9);
    assert.equal(mon.mhp,20+heal);assert.equal(mon.mhpmax,100);
    assert.equal(mon.mspeed,slower?C.MSLOW:0);assert.equal(mon.permspeed,mon.mspeed);
    assert.match(messages(),slower?/<32,10>: The .* golem seems to be moving slower\./:/<32,10>: The .* golem seems healthier\./);
    assert.deepEqual(getRngLog(),[]);assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
});
for(const [species,type]of [[P.PM_GOBLIN,A.AD_FIRE],[P.PM_IRON_GOLEM,A.AD_COLD],[P.PM_FLESH_GOLEM,A.AD_PHYS]])
 test(`unrelated body/damage pair remains unchanged: ${species}/${type}`,async()=>{
    const {mon}=await prepare(species);const before=[mon.mhp,mon.mhpmax,mon.mspeed,mon.permspeed];
    await golemeffects(mon,type,9);assert.deepEqual([mon.mhp,mon.mhpmax,mon.mspeed,mon.permspeed],before);
    assert.equal(messages().trim(),'');assert.deepEqual(getRngLog(),[]);
 });
test('plain feedback keeps its text and no RNG',async()=>{
    const {mon}=await prepare(P.PM_FLESH_GOLEM,{accessible:false});await golemeffects(mon,A.AD_COLD,9);
    assert.match(messages(),/The flesh golem seems to be moving slower\./);assert.doesNotMatch(messages(),/<32,10>/);
    assert.deepEqual(getRngLog(),[]);
});
test('initially fast golem loses one permanent speed tier',async()=>{
    const {mon}=await prepare();assert.equal(mon_adjust_speed(mon,2,null),undefined);clearMessages();
    await golemeffects(mon,A.AD_FIRE,9);assert.equal(mon.permspeed,0);assert.equal(mon.mspeed,0);
    assert.match(messages(),/<32,10>: The flesh golem seems to be moving slower\./);
});
test('already slow golem emits nothing',async()=>{
    const {mon}=await prepare();await mon_adjust_speed(mon,-1,null);clearMessages();seed(2);
    await golemeffects(mon,A.AD_FIRE,9);assert.equal(mon.mspeed,C.MSLOW);assert.equal(messages().trim(),'');assert.deepEqual(getRngLog(),[]);
});
test('real speed boots preserve actual speed while permanent speed decreases',async()=>{
    const {mon}=await prepare(P.PM_OGRE);const boots=mksobj(O.SPEED_BOOTS,false,false);
    await mpickobj(mon,boots);await m_dowear(mon,true);assert.ok(boots.owornmask&C.W_ARMF);assert.equal(mon.mspeed,C.MFAST);
    await newcham(mon,game.mons[P.PM_FLESH_GOLEM],C.NO_NC_FLAGS);
    assert.equal(mon.data,game.mons[P.PM_FLESH_GOLEM]);assert.ok(boots.owornmask&C.W_ARMF);
    clearMessages();seed(2);await golemeffects(mon,A.AD_COLD,9);
    assert.equal(mon.permspeed,C.MSLOW);assert.equal(mon.mspeed,C.MFAST);assert.equal(messages().trim(),'');assert.deepEqual(getRngLog(),[]);
});
for(const guard of ['generation','asleep','frozen','invisible'])test(`slowing feedback guard: ${guard}`,async()=>{
    const {mon}=await prepare(P.PM_FLESH_GOLEM,{invisible:guard==='invisible'});
    if(guard==='generation')game.in_mklev=true;
    if(guard==='asleep')mon.msleeping=1;
    if(guard==='frozen')mon.mfrozen=5;
    try{await golemeffects(mon,A.AD_FIRE,9);}finally{game.in_mklev=false;}
    assert.equal(mon.mspeed,C.MSLOW);assert.equal(mon.permspeed,C.MSLOW);assert.equal(mon.mhp,20);
    assert.equal(messages().trim(),'');assert.deepEqual(getRngLog(),[]);
});
test('full health suppresses healing feedback',async()=>{
    const {mon}=await prepare();mon.mhp=mon.mhpmax;await golemeffects(mon,A.AD_ELEC,9);
    assert.equal(mon.mhp,100);assert.equal(messages().trim(),'');assert.deepEqual(getRngLog(),[]);
});
for(const effect of ['slow','heal'])test(`pending More preserves mutation and caller completion: ${effect}`,async()=>{
    const {run,mon}=await prepare();await pline('An earlier message leaves no room for another complete feedback line.');
    let entered,release,completed=false,timer;const waiting=new Promise(resolve=>{entered=resolve;});
    run._display.onEmptyQueue=()=>{entered();return new Promise(resolve=>{release=resolve;});};
    const operation=golemeffects(mon,effect==='slow'?A.AD_FIRE:A.AD_ELEC,9).then(()=>{completed=true;});
    try{
        await Promise.race([waiting,operation.then(()=>{throw Error('no pending More');}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('More timeout')),2000);})]);
        await setImmediate();assert.equal(completed,false);
        assert.equal(mon.mhp,effect==='heal'?22:20);assert.equal(mon.mspeed,effect==='slow'?C.MSLOW:0);
        assert.deepEqual(getRngLog(),[]);
    }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;if(release)release(32);await operation;}
    assert.match(messages(),/<32,10>: The flesh golem seems/);assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
});
test('full natural explosion reaches the speed helper and finishes human',async()=>{
    const {mon}=await prepare();await polymon(P.PM_FREEZING_SPHERE);
    assert.equal(game.youmonst.data,game.mons[P.PM_FREEZING_SPHERE]);
    Object.assign(game.u,{dx:1,dy:0});game.bhitpos={x:x+1,y};game.notonhead=false;
    mon.mhp=mon.mhpmax=100;clearMessages();seed(2);await hmonas(mon);
    assert.equal(mon.mhp,100);assert.equal(mon.mspeed,C.MSLOW);
    assert.equal(game.u.umonnum,game.u.umonster);assert.equal(game.youmonst.data,game.mons[game.u.umonster]);
    assert.match(messages(),/<32,10>: The flesh golem seems to be moving slower\./);
    assert.ok(getRngLog().some(c=>/^d\(4,6\)=/.test(c)));assert.equal(game.twohits,0);
});
