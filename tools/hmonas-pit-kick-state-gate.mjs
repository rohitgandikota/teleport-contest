// C uhitm.c:5559 and mhitu.c:467. Constructed boundaries, real helpers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup,clearMessages,messages,seed,x,y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {polymon} from '../js/polyself.js';
import {makemon} from '../js/makemon.js';
import {maketrap} from '../js/mklev.js';
import {dotrap,reset_utrap,set_utrap,deltrap,mintrap} from '../js/trap.js';
import {mtrapped_in_pit} from '../js/mhitu.js';
import {hmonas} from '../js/uhitm.js';
import {christen_monst} from '../js/do_name.js';
import {mksobj} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {setworn} from '../js/worn.js';
import {setuwep} from '../js/wield.js';
import {Ring_on} from '../js/do_wear.js';
import {make_blinded,make_hallucinated} from '../js/potion.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P,ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function prepare(traptype=C.PIT,form=P.PM_WARHORSE) {
    const run=await setup();assert.equal(await polymon(form),1);
    assert.equal(game.youmonst.data,game.mons[form]);
    const ring=await addinv(mksobj(O.RIN_INCREASE_ACCURACY,false,false));ring.spe=30;
    await setworn(ring,C.W_RINGR);await Ring_on(ring);assert.equal(game.u.uhitinc,30);
    const trap=traptype===null?null:await maketrap(x,y,traptype);
    if(trap)await dotrap(trap,C.FORCETRAP);
    const mon=await makemon(game.mons[P.PM_RUST_MONSTER],x+1,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    Object.assign(mon,{mhp:1000,mhpmax:1000,msleeping:1,mpeaceful:0});
    Object.assign(game.u,{dx:1,dy:0});game.bhitpos={x:x+1,y};game.notonhead=false;
    clearMessages();seed(2);return {run,trap,mon};
}
const rolls=()=>getRngLog().filter(s=>/^rnd\(20\)=/.test(s));
const kickDice=()=>getRngLog().filter(s=>/^d\(1,10\)=/.test(s));
async function biteOnly(s) {
    assert.equal(mtrapped_in_pit(game.youmonst),true);
    assert.equal(await hmonas(s.mon),true);
    assert.equal(rolls().length,1);assert.equal(kickDice().length,0);
    assert.deepEqual(getRngLog(),['rnd(20)=14','d(1,4)=3','rn2(3)=2','rn2(3)=0','rn2(6)=3']);
    assert.equal(s.mon.mhp,997);assert.equal(s.mon.msleeping,0);
    assert.doesNotMatch(messages(),/You kick/);assert.match(messages(),/You bite/);
    assert.equal(game.twohits,0);
}
async function bothAttacks(s) {
    assert.equal(mtrapped_in_pit(game.youmonst),false);
    assert.equal(await hmonas(s.mon),true);
    assert.equal(rolls().length,2);assert.equal(kickDice().length,1);
    assert.equal(s.mon.mhp,996);assert.match(messages(),/You kick/);assert.match(messages(),/You bite/);
}

for(const type of [C.PIT,C.SPIKED_PIT])test(`real trap ${type} skips kick and retains the later bite`,async()=>{
    const s=await prepare(type);
    assert.deepEqual(game.youmonst.data.mattk.slice(0,2).map(a=>a[0]),[A.AT_KICK,A.AT_BITE]);
    assert.ok(game.u.utrap>0);assert.equal(game.u.utraptype,C.TT_PIT);
    await biteOnly(s);
});
test('untrapped warhorse retains kick and bite',async()=>{await bothAttacks(await prepare(null));});
test('real bear trap is not a pit and still allows the kick',async()=>{
    const s=await prepare(C.BEAR_TRAP);assert.ok(game.u.utrap>0);assert.equal(game.u.utraptype,C.TT_BEARTRAP);
    await bothAttacks(s);
});
test('pit square without the trapped state still permits kicking',async()=>{
    const s=await prepare();await reset_utrap(false);assert.ok(game.level.traps.includes(s.trap));
    clearMessages();seed(2);await bothAttacks(s);
});
test('a removed pit cannot satisfy the canonical helper while its flag remains',async()=>{
    const s=await prepare();deltrap(s.trap);assert.ok(game.u.utrap>0);
    clearMessages();seed(2);await bothAttacks(s);
});
test('TT_PIT requires a pit at the hero square, not an unrelated floor trap',async()=>{
    const s=await prepare();const trap=await maketrap(x,y,C.WEB);
    assert.equal(trap.ttyp,C.WEB);set_utrap(3,C.TT_PIT); // constructed mismatched-state boundary
    clearMessages();seed(2);await bothAttacks(s);
});
test('pit beneath the defender does not suppress a free hero kick',async()=>{
    const s=await prepare(null);await maketrap(s.mon.mx,s.mon.my,C.PIT);
    await mintrap(s.mon,C.FORCETRAP);assert.equal(!!s.mon.mtrapped,true);
    Object.assign(s.mon,{mhp:1000,mhpmax:1000,msleeping:1});clearMessages();seed(2);
    await bothAttacks(s);
});
test('a trapped wolf retains its non-kick natural attack',async()=>{
    const s=await prepare(C.PIT,P.PM_WOLF);
    assert.equal(game.youmonst.data.mattk.some(a=>a[0]===A.AT_KICK),false);
    await hmonas(s.mon);assert.equal(rolls().length,1);assert.ok(s.mon.mhp<1000);assert.match(messages(),/You bite/);
});
test('a trapped centaur retains its earlier real weapon attack',async()=>{
    const s=await prepare(C.PIT,P.PM_PLAINS_CENTAUR);
    const weapon=await addinv(mksobj(O.DAGGER,false,false));setuwep(weapon);
    assert.ok(game.youmonst.data.mattk.some(a=>a[0]===A.AT_KICK));clearMessages();seed(2);
    await hmonas(s.mon);assert.equal(rolls().length,1);assert.equal(game.u.uconduct.weaphit,1);
    assert.equal(weapon.oeroded,1);assert.doesNotMatch(messages(),/You kick/);
});
test('skipped kick never attempts to release a paralyzed defender',async()=>{
    const s=await prepare();Object.assign(s.mon,{mcanmove:0,mfrozen:5});
    await hmonas(s.mon);assert.equal(getRngLog().filter(s=>/^rn2\(10\)=/.test(s)).length,1);
    assert.equal(rolls().length,1);assert.equal(kickDice().length,0);
});
for(const condition of ['blind','hallucinating'])test(`pit guard is unchanged when ${condition}`,async()=>{
    const s=await prepare();
    if(condition==='blind')await make_blinded(100,false);else await make_hallucinated(100,false,0);
    clearMessages();seed(2);assert.equal(mtrapped_in_pit(game.youmonst),true);
    await hmonas(s.mon);assert.equal(rolls().length,1);assert.equal(kickDice().length,0);
    assert.ok(s.mon.mhp<1000);
});
test('releasing the real trap restores kicking on the next command',async()=>{
    const s=await prepare();await biteOnly(s);await reset_utrap(false);
    Object.assign(s.mon,{mhp:1000,msleeping:1});clearMessages();seed(2);await bothAttacks(s);
});
test('later bite feedback suspends and finishes after the kick was skipped',async()=>{
    const s=await prepare();
    christen_monst(s.mon,'a rather exceptionally long rust monster name');
    let entered,release,finished=false,timer;
    const waiting=new Promise(resolve=>{entered=resolve;});
    s.run._display.onEmptyQueue=()=>{entered();return new Promise(resolve=>{release=resolve;});};
    const operation=hmonas(s.mon).then(()=>{finished=true;});
    try{
        await Promise.race([waiting,operation.then(()=>{throw Error('no pending More');}),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('More timeout')),2000);})]);
        await setImmediate();assert.equal(finished,false);
        assert.equal(rolls().length,1);assert.equal(kickDice().length,0);
        assert.equal(mtrapped_in_pit(game.youmonst),true);
    }finally{
        clearTimeout(timer);s.run._display.onEmptyQueue=()=>32;if(release)release(32);await operation;
    }
    assert.equal(s.mon.mhp,997);assert.equal(game.twohits,0);assert.doesNotMatch(messages(),/You kick/);
});
