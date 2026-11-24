// C uhitm.c:5424-5862. Constructed boundaries through real game helpers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup,clearMessages,messages,seed,x,y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {polymon} from '../js/polyself.js';
import {makemon} from '../js/makemon.js';
import {hmonas} from '../js/uhitm.js';
import {mksobj,curse} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {setuwep,setuswapwep} from '../js/wield.js';
import {setworn} from '../js/worn.js';
import {Ring_on} from '../js/do_wear.js';
import {oname} from '../js/do_name.js';
import {m_at} from '../js/mon.js';
import {count_wsegs} from '../js/worm.js';
import {Hate_silver} from '../js/youprop.js';
import {getRngLog} from '../js/rng.js';
import {change_luck} from '../js/attrib.js';
import {PMNAMES as P,ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function item(type) {
    if(type===null)return null;
    const obj=mksobj(type,false,false);
    return await addinv(obj);
}
async function prepare({form=P.PM_ETTIN,primary=O.DAGGER,secondary=O.LONG_SWORD,
                        victim=P.PM_RUST_MONSTER,accuracy=30}={}) {
    const run=await setup();
    assert.equal(await polymon(form),1);
    assert.equal(game.youmonst.data,game.mons[form]);
    const ring=await item(O.RIN_INCREASE_ACCURACY);
    ring.spe=accuracy;await setworn(ring,C.W_RINGR);await Ring_on(ring);
    assert.equal(game.u.uhitinc,accuracy);
    const mon=await makemon(game.mons[victim],x+1,y,
        C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    Object.assign(mon,{mhp:1000,mhpmax:1000,msleeping:1,mpeaceful:0});
    Object.assign(game.u,{dx:1,dy:0});game.bhitpos={x:x+1,y};game.notonhead=false;
    const first=await item(primary),second=await item(secondary);
    await setuwep(first);setuswapwep(second);
    assert.equal(game.u.uwep,first);assert.equal(game.u.uswapwep,second);
    clearMessages();seed(2);
    return {run,mon,first,second};
}
const erosion=obj=>obj?.oeroded||0;
const rolls=()=>getRngLog().filter(s=>/^rnd\(20\)=/.test(s));
function slotsIntact(s) {
    assert.equal(game.u.uwep,s.first);assert.equal(game.u.uswapwep,s.second);
    assert.equal(game.twohits,0);
}
async function pendingMore(s,accept,inspect) {
    let reached,timer,done=false;const releases=[];
    const entered=new Promise(resolve=>{reached=resolve;});
    s.run._display.onEmptyQueue=()=>{
        if(!accept())return 32;
        reached();return new Promise(resolve=>releases.push(resolve));
    };
    const operation=hmonas(s.mon).then(value=>{done=true;return value;});
    try {
        await Promise.race([entered,operation.then(()=>{throw Error('owner finished before required More');}),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('required More not reached')),2000);})]);
        await setImmediate();assert.equal(done,false);inspect();
    }finally{
        clearTimeout(timer);s.run._display.onEmptyQueue=()=>32;
        for(const release of releases)release(32);
        await operation;
    }
}

test('two explicit weapon attacks select different slots without twoweap mode',async()=>{
    const s=await prepare();assert.equal(!!game.u.twoweap,false);
    assert.equal(game.youmonst.data.mattk.filter(a=>a[0]===A.AT_WEAP).length,2);
    assert.equal(await hmonas(s.mon),true);
    assert.deepEqual([erosion(s.first),erosion(s.second)],[1,1]);
    assert.equal(game.u.uconduct.weaphit,2);assert.equal(rolls().length,2);slotsIntact(s);
});
test('slot alternation starts at primary again on the next command',async()=>{
    const s=await prepare();await hmonas(s.mon);clearMessages();seed(2);await hmonas(s.mon);
    assert.deepEqual([erosion(s.first),erosion(s.second)],[2,2]);slotsIntact(s);
});
test('one-handed weapon-tool primary can enable the alternate',async()=>{
    const s=await prepare({primary:O.PICK_AXE});await hmonas(s.mon);
    assert.deepEqual([erosion(s.first),erosion(s.second)],[1,1]);slotsIntact(s);
});
test('one-handed weapon-tool secondary is eligible',async()=>{
    const s=await prepare({secondary:O.PICK_AXE});await hmonas(s.mon);
    assert.deepEqual([erosion(s.first),erosion(s.second)],[1,1]);slotsIntact(s);
});
for(const [label,type]of [['launcher',O.BOW],['ammunition',O.ARROW],['missile',O.DART],
                         ['two-handed',O.BATTLE_AXE],['nonweapon tool',O.TOWEL]])
 test(`${label} alternate stays unused`,async()=>{
    const s=await prepare({secondary:type});await hmonas(s.mon);
    assert.deepEqual([erosion(s.first),erosion(s.second)],[2,0]);
    assert.equal(rolls().length,2);slotsIntact(s);
});
test('shield excludes an otherwise eligible alternate',async()=>{
    const s=await prepare();const shield=await item(O.SMALL_SHIELD);await setworn(shield,C.W_ARMS);
    clearMessages();seed(2);await hmonas(s.mon);
    assert.deepEqual([erosion(s.first),erosion(s.second)],[2,0]);slotsIntact(s);
});
test('artifact alternate stays unused',async()=>{
    const s=await prepare();await oname(s.second,'Vorpal Blade');assert.ok(s.second.oartifact);
    clearMessages();seed(2);await hmonas(s.mon);
    assert.deepEqual([erosion(s.first),erosion(s.second)],[2,0]);slotsIntact(s);
});
test('artifact primary does not prohibit an ordinary alternate',async()=>{
    const s=await prepare({primary:O.LONG_SWORD,secondary:O.DAGGER});
    await oname(s.first,'Vorpal Blade');assert.ok(s.first.oartifact);
    clearMessages();seed(2);await hmonas(s.mon);
    assert.deepEqual([erosion(s.first),erosion(s.second)],[1,1]);slotsIntact(s);
});
test('nonweapon primary cannot enable the alternate',async()=>{
    const s=await prepare({primary:O.TOWEL});await hmonas(s.mon);
    assert.equal(erosion(s.second),0);assert.equal(game.u.uconduct.weaphit,0);
    assert.equal(rolls().length,2);slotsIntact(s);
});
test('silver-hating form excludes a silver alternate',async()=>{
    const s=await prepare({form:P.PM_MARILITH,secondary:O.SILVER_SABER});
    assert.equal(!!Hate_silver(),true);await curse(s.second);clearMessages();seed(2);
    await hmonas(s.mon);assert.equal(game.u.uswapwep,s.second);assert.ok(game.invent.includes(s.second));
    assert.doesNotMatch(messages(),/evades your grasp/);assert.equal(erosion(s.first),2);
});
test('a form that tolerates silver uses and drops its cursed silver alternate',async()=>{
    const s=await prepare({secondary:O.SILVER_SABER});assert.equal(!!Hate_silver(),false);
    await curse(s.second);clearMessages();seed(2);await hmonas(s.mon);
    assert.equal(game.u.uswapwep,null);assert.equal(s.second.where,C.OBJ_FLOOR);
    assert.match(messages(),/evades your grasp/);
});
test('successful preceding two-handed hit suppresses the second swing',async()=>{
    const s=await prepare({primary:O.TWO_HANDED_SWORD});await hmonas(s.mon);
    assert.equal(rolls().length,1);assert.equal(game.u.uconduct.weaphit,1);
    assert.deepEqual([erosion(s.first),erosion(s.second)],[1,0]);slotsIntact(s);
});
test('a preceding two-handed miss still permits another weapon attempt',async()=>{
    const s=await prepare({primary:O.TWO_HANDED_SWORD,accuracy:-50});await hmonas(s.mon);
    assert.equal(rolls().length,2);assert.equal(game.u.uconduct.weaphit,0);
    assert.deepEqual([erosion(s.first),erosion(s.second)],[0,0]);slotsIntact(s);
});
test('unarmed weapon attacks retain the glove slot for rust',async()=>{
    const s=await prepare({primary:null});const gloves=await item(O.GAUNTLETS_OF_POWER);
    await setworn(gloves,C.W_ARMG);clearMessages();seed(2);await hmonas(s.mon);
    assert.equal(erosion(gloves),2);assert.equal(erosion(s.second),0);slotsIntact(s);
});
test('no weapon or gloves leaves the alternate untouched',async()=>{
    const s=await prepare({primary:null});await hmonas(s.mon);
    assert.equal(erosion(s.second),0);assert.equal(rolls().length,2);slotsIntact(s);
});
test('cursed secondary drops only after its passive erosion and stops remaining claws',async()=>{
    const s=await prepare({form:P.PM_MARILITH});await curse(s.second);clearMessages();seed(2);
    await hmonas(s.mon);assert.deepEqual([erosion(s.first),erosion(s.second)],[1,1]);
    assert.equal(rolls().length,2);assert.equal(game.u.uswapwep,null);assert.equal(s.second.where,C.OBJ_FLOOR);
    assert.ok(game.level.objects.includes(s.second));assert.equal(game.invent.includes(s.second),false);
    assert.ok(messages().indexOf('long sword rusts')<messages().indexOf('evades your grasp'));assert.equal(game.twohits,0);
});
test('secondary still drops after it kills the defender',async()=>{
    const s=await prepare();s.mon.mhp=2;s.mon.mhpmax=2;await curse(s.second);clearMessages();seed(2);
    assert.equal(await hmonas(s.mon),false);assert.ok(s.mon.mhp<=0);
    assert.equal(erosion(s.second),1);assert.equal(game.u.uswapwep,null);assert.equal(s.second.where,C.OBJ_FLOOR);
});
test('cursed primary remains wielded and does not take the secondary-drop branch',async()=>{
    const s=await prepare();await curse(s.first);clearMessages();seed(2);await hmonas(s.mon);
    assert.deepEqual([erosion(s.first),erosion(s.second)],[1,1]);slotsIntact(s);
    assert.doesNotMatch(messages(),/evades your grasp/);
});
test('drop feedback suspends the owner before floor placement with second-hit count live',async()=>{
    const s=await prepare({form:P.PM_MARILITH});await curse(s.second);clearMessages();seed(2);
    await oname(s.second,'a long named secondary sword for observing the completion of its drop');
    clearMessages();seed(2);
    await pendingMore(s,()=>((game._pending_message||'')+messages()).includes('evades'),()=>{
        assert.equal(game.twohits,2);assert.deepEqual([erosion(s.first),erosion(s.second)],[1,1]);
        assert.equal(game.u.uswapwep,s.second);assert.ok(game.invent.includes(s.second));
        assert.equal(game.level.objects.includes(s.second),false);
    });
    assert.equal(s.second.where,C.OBJ_FLOOR);assert.equal(game.twohits,0);
});
test('single explicit weapon form leaves alternate and hit count unused',async()=>{
    const s=await prepare({form:P.PM_GNOME});await hmonas(s.mon);
    assert.deepEqual([erosion(s.first),erosion(s.second)],[1,0]);assert.equal(rolls().length,1);slotsIntact(s);
});


test('explicit hit count is live through first passive feedback and reset on completion',async()=>{
    const s=await prepare();
    await pendingMore(s,()=>game.twohits===1,()=>{
        assert.equal(game.twohits,1);assert.equal(game.u.uconduct.weaphit,1);
        assert.ok(s.mon.mhp<1000);assert.equal(erosion(s.second),0);
    });
    assert.equal(game.twohits,0);assert.equal(game.u.uconduct.weaphit,2);
});

test('destroyed primary reloads its empty slot, then uses the already-selected alternate',async()=>{
    const s=await prepare({primary:O.BOOMERANG});const gloves=await item(O.GAUNTLETS_OF_POWER);
    await setworn(gloves,C.W_ARMG);change_luck(-game.u.uluck);assert.equal(game.u.uluck,0);
    clearMessages();seed(19);await hmonas(s.mon);
    assert.ok(getRngLog().includes('rnl(4)=3'));assert.equal(s.first.where,C.OBJ_DELETED);
    assert.equal(game.u.uwep,null);assert.equal(erosion(gloves),0,'no fallback to gloves after destruction');
    assert.equal(erosion(s.second),1);assert.equal(game.u.uswapwep,s.second);
    assert.equal(game.u.uconduct.weaphit,2);assert.equal(game.twohits,0);
});

async function tailTarget() {
    const s=await prepare({victim:P.PM_LONG_WORM,primary:O.CLUB,secondary:O.DAGGER});
    const tail=game.worms.wtails[s.mon.wormno],tx=tail.wx,ty=tail.wy;
    assert.ok(count_wsegs(s.mon)>0);assert.notDeepEqual([tx,ty],[s.mon.mx,s.mon.my]);
    assert.equal(m_at(tx,ty),s.mon);
    const offset=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]
        .find(([dx,dy])=>!m_at(tx-dx,ty-dy)&&game.level.at(tx-dx,ty-dy).typ===C.ROOM);
    assert.ok(offset);const [dx,dy]=offset;
    Object.assign(game.u,{ux:tx-dx,uy:ty-dy,dx,dy});game.bhitpos={x:tx,y:ty};game.notonhead=true;
    await curse(s.second);clearMessages();seed(2);
    return {...s,tx,ty,count:count_wsegs(s.mon)};
}

test('secondary severs a real terminal worm segment and still drops, without passive draws',async()=>{
    const s=await tailTarget();assert.equal(await hmonas(s.mon),true);
    assert.notEqual(m_at(s.tx,s.ty),s.mon);assert.equal(count_wsegs(s.mon),s.count-1);
    assert.equal(game.u.uconduct.weaphit,2);assert.equal(s.second.where,C.OBJ_FLOOR);
    assert.equal(game.u.uswapwep,null);assert.equal(game.twohits,0);
    assert.deepEqual(getRngLog(),['rnd(20)=14','rnd(3)=1','rn2(25)=8','rnd(20)=12',
        'rn2(3)=0','rn2(3)=1','rn2(6)=0','rnd(20)=20','rnd(3)=3','rn2(25)=15','rnd(20)=12']);
});

test('a primary tail cut exits before using or dropping a cursed alternate',async()=>{
    const s=await tailTarget();seed(3);assert.equal(await hmonas(s.mon),true);
    assert.notEqual(m_at(s.tx,s.ty),s.mon);assert.equal(count_wsegs(s.mon),s.count-1);
    assert.equal(game.u.uconduct.weaphit,1);assert.equal(s.second.where,C.OBJ_INVENT);slotsIntact(s);
    assert.deepEqual(getRngLog(),['rnd(20)=12','rnd(3)=1','rn2(25)=1','rnd(20)=18']);
});

test('cut-tail drop waits for its own feedback before removing the secondary',async()=>{
    const s=await tailTarget();
    await oname(s.second,'a long named secondary dagger for observing the completion of its drop');
    clearMessages();seed(2);
    await pendingMore(s,()=>((game._pending_message||'')+messages()).includes('evades'),()=>{
        assert.notEqual(m_at(s.tx,s.ty),s.mon);assert.equal(count_wsegs(s.mon),s.count-1);
        assert.equal(game.twohits,2);assert.equal(game.u.uswapwep,s.second);
        assert.equal(s.second.where,C.OBJ_INVENT);
    });
    assert.equal(s.second.where,C.OBJ_FLOOR);assert.equal(game.twohits,0);
});
