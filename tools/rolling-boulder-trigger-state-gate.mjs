// C trap.c:2661: constructed calls through real mintrap, launch and hiding owners.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {hide_monst,m_in_air} from '../js/mon.js';
import {maketrap} from '../js/mklev.js';
import {mintrap,seetrap,Trap_Effect_Finished,Trap_Killed_Mon} from '../js/trap.js';
import {obj_extract_self,obfree} from '../js/invent.js';
import {vision_recalc} from '../js/vision.js';
import {make_deaf} from '../js/potion.js';
import {pline} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';
import {setup as baseSetup,clearMessages,messages,seed} from './status-followup-test-setup.mjs';

async function setup(species=P.PM_NEWT,hidden=false) {
    const run=await baseSetup();
    Object.assign(game.u,{ux:31,uy:12,uhp:200,uhpmax:200});
    game.stairs=null;
    const trap=await maketrap(33,10,C.ROLLING_BOULDER_TRAP);
    assert.ok(trap);
    const ammo=game.level.objects.find(o=>o.otyp===O.BOULDER);
    assert.ok(ammo,'real trap construction creates ammunition');
    const mon=await makemon(game.mons[species],33,10,
        C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(mon);
    if(hidden) {
        for(let i=1;i<=20&&!mon.mundetected;i++) {
            seed(i);await hide_monst(mon);
        }
        assert.equal(mon.mundetected,1,'real hide_monst/restrap producer');
    }
    game.flags.accessiblemsg=false;
    game.iflags.getpos_coords='m';
    vision_recalc();clearMessages();seed(2);
    return {run,trap,ammo,mon};
}
const location=obj=>[obj.ox,obj.oy,obj.where];
const core=()=>getRngLog().filter(s=>!s.startsWith('~d'));

for(const [label,species,hidden,flags,air,launches] of [
    ['hidden piercer',P.PM_ROCK_PIERCER,true,0,true,false],
    ['forced hidden piercer',P.PM_ROCK_PIERCER,true,C.FORCETRAP,true,false],
    ['sitting hidden piercer',P.PM_ROCK_PIERCER,true,C.FORCETRAP|C.VIASITTING,true,false],
    ['forced bat',P.PM_BAT,false,C.FORCETRAP,true,false],
    ['plunging bat',P.PM_BAT,false,C.FORCETRAP|C.TOOKPLUNGE,true,false],
    ['sitting bat',P.PM_BAT,false,C.FORCETRAP|C.VIASITTING,true,false],
    ['sitting floater',P.PM_FLOATING_EYE,false,C.FORCETRAP|C.VIASITTING,true,false],
    ['forced hurtling newt',P.PM_NEWT,false,C.FORCETRAP|C.HURTLING,false,true],
    ['unforced hurtling newt',P.PM_NEWT,false,C.HURTLING,false,false],
    ['exposed piercer',P.PM_ROCK_PIERCER,false,C.FORCETRAP,false,true],
]) test(label,async()=>{
    const {trap,ammo,mon}=await setup(species,hidden);
    const origin=location(ammo),hp=mon.mhp;
    assert.equal(!!m_in_air(mon),air);
    assert.equal(await mintrap(mon,flags),Trap_Effect_Finished);
    assert.equal(!!mon.mundetected,hidden);
    if(launches) {
        assert.deepEqual(location(ammo),[trap.launch2.x,trap.launch2.y,C.OBJ_FLOOR]);
        assert.notDeepEqual(location(ammo),origin);
        assert.ok(trap.tseen);
        assert.match(core()[0],/^rnd\(20\)=/);
        assert.match(messages(),/triggers something\./);
    } else {
        assert.deepEqual(location(ammo),origin);
        assert.equal(mon.mhp,hp);assert.equal(!!trap.tseen,false);
        assert.deepEqual(core(),[]);assert.equal(messages(),'');
    }
    assert.equal(!!(mon.mtrapseen&(1<<(C.ROLLING_BOULDER_TRAP-1))),
        label!=='unforced hurtling newt');
});

for(const accessible of [false,true]) for(const deaf of [false,true])
for(const known of [false,true])
test(`trigger feedback: accessibility=${accessible}, deaf=${deaf}, known=${known}`,async()=>{
    const {trap,ammo,mon}=await setup();
    if(known)seetrap(trap);
    if(deaf)await make_deaf(20,false);
    game.flags.accessiblemsg=accessible;clearMessages();seed(2);
    assert.equal(await mintrap(mon,C.FORCETRAP),Trap_Effect_Finished);
    const expected=`${accessible?'<33,10>: ':''}${deaf?'':'Click!  '}The newt triggers ${known?'a rolling boulder trap':'something'}.`;
    assert.ok(messages().split('\n').some(s=>s.startsWith(expected)),messages());
    assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
    assert.deepEqual(location(ammo),[trap.launch2.x,trap.launch2.y,C.OBJ_FLOOR]);
    assert.equal(!!trap.tseen,true);
});

test('a visible trigger without ammunition does not mark the trap seen',async()=>{
    const {trap,ammo,mon}=await setup();
    obj_extract_self(ammo);await obfree(ammo,null);clearMessages();seed(2);
    assert.equal(await mintrap(mon,C.FORCETRAP),Trap_Effect_Finished);
    assert.equal(!!trap.tseen,false);
    assert.match(messages(),/The newt triggers something\./);
    assert.deepEqual(core(),[]);
});

test('a fatal launched hit returns the monster-death result',async()=>{
    const {trap,ammo,mon}=await setup();mon.mhp=1;
    assert.equal(await mintrap(mon,C.FORCETRAP),Trap_Killed_Mon);
    assert.ok(mon.mhp<=0);assert.equal(game.level.monsters.includes(mon),false);
    assert.equal(!!trap.tseen,true);
    assert.deepEqual(location(ammo),[trap.launch2.x,trap.launch2.y,C.OBJ_FLOOR]);
});

test('trigger feedback finishes before the real launch extracts ammunition',async()=>{
    const {run,trap,ammo,mon}=await setup();game.flags.accessiblemsg=true;
    await pline('An earlier message leaves too little room for the trigger message.');
    let enter,release,finished=false,timer;
    const waiting=new Promise(resolve=>{enter=resolve;});
    run._display.onEmptyQueue=()=>{enter();return new Promise(resolve=>{release=resolve;});};
    const origin=location(ammo);
    const pending=mintrap(mon,C.FORCETRAP).then(value=>{finished=true;return value;});
    try {
        await Promise.race([waiting,pending.then(()=>{throw Error('no pending trigger message');}),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('missing More prompt')),2000);})]);
        await setImmediate();assert.equal(finished,false);
        assert.deepEqual(location(ammo),origin);assert.equal(!!trap.tseen,false);
        assert.deepEqual(core(),[]);
    } finally {
        clearTimeout(timer);run._display.onEmptyQueue=()=>32;release?.(32);await pending;
    }
    assert.equal(await pending,Trap_Effect_Finished);
    assert.deepEqual(location(ammo),[trap.launch2.x,trap.launch2.y,C.OBJ_FLOOR]);
    assert.ok(messages().includes('<33,10>: Click!  The newt triggers something.'));
});
