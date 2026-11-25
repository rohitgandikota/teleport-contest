// Constructed source contracts. All effects use normal runtime APIs.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup,seed,clearMessages,messages} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {mksobj,add_to_container,curse} from '../js/mkobj.js';
import {mpickobj} from '../js/steal.js';
import {addinv,weight} from '../js/invent.js';
import {mon_wield_item,select_hwep} from '../js/weapon.js';
import {setuwep,ready_weapon} from '../js/wield.js';
import {find_misc,use_misc,MUSE_BULLWHIP,MUSE_BAG,MUSE_POT_INVISIBILITY} from '../js/muse.js';
import {m_dowear} from '../js/worn.js';
import {maketrap} from '../js/mklev.js';
import {mintrap} from '../js/trap.js';
import {set_ustuck,mcalcdistress} from '../js/mon.js';
import {tamedog} from '../js/dog.js';
import {doapply} from '../js/apply.js';
import {oname} from '../js/do_name.js';
import {makeknown} from '../js/o_init.js';
import {make_hallucinated} from '../js/potion.js';
import {msgtype_parse_add} from '../js/options.js';
import {pline,more,gbuf_at} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function prepare(species=P.PM_ORC, x=32) {
    const run=await setup(); game.stairs=null;
    const mon=await makemon(game.mons[species],x,10,
        C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(mon);
    Object.assign(mon,{mux:game.u.ux,muy:game.u.uy,mpeaceful:0});
    game.flags.accessiblemsg=true; game.iflags.getpos_coords='m';
    clearMessages(); return {run,mon};
}
async function give(mon,type,fields={}) {
    const obj=Object.assign(mksobj(type,false,false),fields);
    obj.owt=weight(obj); await mpickobj(mon,obj);
    assert.equal(obj.where,C.OBJ_MINVENT);assert.equal(obj.ocarry,mon);
    return obj;
}
function select(mon,action,obj=null,rng=[]) {
    const result=find_misc(mon);
    assert.equal(typeof result,'boolean');assert.equal(result,!!action);
    assert.equal(game.m.has_misc,action);assert.equal(game.m.misc,obj);
    assert.deepEqual(getRngLog(),rng);
}
async function whip({species=P.PM_ORC,targetType=O.DAGGER,accessible=true}={}) {
    const pair=await prepare(species); const {mon}=pair;
    const weapon=await give(mon,O.BULLWHIP);
    assert.equal(select_hwep(mon),weapon);
    mon.weapon_check=C.NEED_HTH_WEAPON;assert.equal(await mon_wield_item(mon),1);
    const target=await addinv(mksobj(targetType,false,false));await setuwep(target);
    game.flags.accessiblemsg=accessible; clearMessages();
    return {...pair,weapon,target,oldinuse:target.in_use};
}
const destinationSeed=[7,21,1,0]; // rn2(5)=0 then rn2(4)=destination.
function selectWhip(mon,weapon,destination) {
    seed(destinationSeed[destination]);select(mon,MUSE_BULLWHIP,weapon,['rn2(5)=0']);
}

for(const species of [P.PM_LITTLE_DOG,P.PM_STONE_GOLEM]) test(`selector excludes ${species}`,async()=>{
    const {mon}=await prepare(species);await give(mon,O.POT_GAIN_LEVEL);
    game.m={misc:mon.minvent[0],has_misc:1};seed();select(mon,0);
});
test('selector clears stale selection when the perceived hero is beyond distance six',async()=>{
    const {mon}=await prepare();const obj=await give(mon,O.POT_SPEED);
    mon.mux=mon.mx+7;game.m={misc:obj,has_misc:6};seed();select(mon,0);
});
test('selector rejects the current swallower before inventory draws',async()=>{
    const {mon}=await prepare();await give(mon,O.POT_GAIN_LEVEL);
    set_ustuck(mon);game.u.uswallow=true;seed();select(mon,0);
});
test('last eligible item wins in real inventory order',async()=>{
    const {mon}=await prepare();const speed=await give(mon,O.POT_SPEED);
    await give(mon,O.POT_GAIN_LEVEL);seed();select(mon,6,speed);
});
test('container draw remains after an already selected potion',async()=>{
    const {mon}=await prepare();const bag=await give(mon,O.SACK);
    await add_to_container(bag,mksobj(O.DIAMOND,false,false));
    const potion=await give(mon,O.POT_GAIN_LEVEL);seed(2);
    select(mon,1,potion,['rn2(5)=3']);
});
for(const blocked of [false,true]) test(`real worn iron shoes block deliberate polymorph=${blocked}`,async()=>{
    const {mon}=await prepare();const trap=maketrap(mon.mx,mon.my,C.POLY_TRAP);
    const speed=await give(mon,O.POT_SPEED);
    if(blocked){const boots=await give(mon,O.IRON_SHOES);await m_dowear(mon,false);assert.ok(boots.owornmask&C.W_ARMF);}
    seed();select(mon,blocked?6:4,blocked?speed:null);
    if(!blocked)assert.deepEqual([game.trapx,game.trapy],[trap.tx,trap.ty]);
});
for(const fast of [false,true]) test(`speed selection respects effective speed=${fast}`,async()=>{
    const {mon}=await prepare();const potion=await give(mon,O.POT_SPEED);
    mon.mspeed=fast?C.MFAST:0;seed();select(mon,fast?0:6,fast?null:potion);
});
for(const see of [false,true]) test(`peaceful invisibility selection See_invisible=${see}`,async()=>{
    const {mon}=await prepare();mon.mpeaceful=1;
    const potion=await give(mon,O.POT_INVISIBILITY);
    game.u.intrinsic.HSee_invisible=see?C.FROMOUTSIDE:0;seed();select(mon,see?MUSE_POT_INVISIBILITY:0,see?potion:null);
});
test('welded main weapon is rejected by actual canletgo, which learns its curse',async()=>{
    const {mon,weapon,target}=await whip();await curse(target);target.bknown=0;
    seed(7);select(mon,0,null,['rn2(5)=0']);assert.equal(target.bknown,1);
    assert.equal(mon.mw,weapon);assert.equal(game.u.uwep,target);
});

for(const destination of [0,1,2,3]) test(`bullwhip real ownership transfer destination ${destination}`,async()=>{
    const {mon,weapon,target,oldinuse}=await whip();selectWhip(mon,weapon,destination);
    assert.equal(await use_misc(mon),1);
    assert.deepEqual(getRngLog(),['rn2(5)=0',`rn2(4)=${destination}`]);
    assert.equal(mon.mw,weapon);assert.equal(weapon.where,C.OBJ_MINVENT);
    if(destination===0){assert.equal(game.u.uwep,target);assert.equal(target.where,C.OBJ_INVENT);}
    else {
        assert.equal(game.u.uwep,null);assert.ok(!game.invent.includes(target));
        assert.equal(target.owornmask,0);assert.equal(target.in_use,oldinuse);
        if(destination===3){assert.equal(target.where,C.OBJ_MINVENT);assert.equal(target.ocarry,mon);}
        else {assert.equal(target.where,C.OBJ_FLOOR);assert.equal(game.level.objectAt(destination===1?32:31,10),target);}
    }
    assert.match(messages(),/<32,10>: The orc flicks a bullwhip towards your hand!/);
    if(destination)assert.match(messages(),/<32,10>: The orc (yanks|snatches)/);
});
test('silver-hating werewolf converts catch into hero-floor drop without another draw',async()=>{
    const {mon,weapon,target}=await whip({species:P.PM_HUMAN_WEREWOLF,targetType:O.SILVER_DAGGER});selectWhip(mon,weapon,3);
    await use_misc(mon);assert.equal(target.where,C.OBJ_FLOOR);assert.equal(target.ox,31);
    assert.match(messages(),/<32,10>: The werewolf yanks the silver dagger to the floor!/);
    assert.deepEqual(getRngLog(),['rn2(5)=0','rn2(4)=3']);
});
test('heavy iron ball fails before urgent wrapping or inventory removal',async()=>{
    const {mon,weapon,target}=await whip({targetType:O.HEAVY_IRON_BALL});selectWhip(mon,weapon,3);
    assert.equal(await use_misc(mon),1);assert.equal(game.u.uwep,target);
    assert.match(messages(),/fails to wrap around/);assert.doesNotMatch(messages(),/wraps around/);
    assert.deepEqual(getRngLog(),['rn2(5)=0','rn2(4)=3']);
});
for(const suppress of ['hide','escape']) test(`urgent wrapping overrides ${suppress} suppression`,async()=>{
    const {run,mon,weapon,target}=await whip({accessible:false});
    if(suppress==='hide')assert.ok(msgtype_parse_add('hide "wraps around"'));
    else {
        await pline('A real message before ESC.');
        run._display.onEmptyQueue=()=>27;
        await more();
        assert.equal(game._win_stop,true);run._display.onEmptyQueue=()=>32;
    }
    selectWhip(mon,weapon,0);await use_misc(mon);
    assert.match(messages(),/The bullwhip wraps around the dagger you're wielding!/);
    assert.equal(game._win_stop,false);assert.equal(game.u.uwep,target);
    assert.deepEqual(getRngLog(),['rn2(5)=0','rn2(4)=0']);
});

for(const accessible of [false,true]) test(`polymorph trap uses old location in feedback, accessible=${accessible}`,async()=>{
    const {mon}=await prepare();game.flags.accessiblemsg=accessible;
    const trap=maketrap(33,10,C.POLY_TRAP);seed();select(mon,4);
    const identity=mon.m_id;assert.equal(await use_misc(mon),2);
    assert.equal(mon.m_id,identity);assert.deepEqual([mon.mx,mon.my],[33,10]);assert.equal(trap.tseen,1);
    assert.ok(messages().includes(`${accessible?'<32,10>: ':''}The orc deliberately jumps onto a polymorph trap!`),messages());
});
for(const adjacent of [true,false]) test(`container removal location only on adjacent first item=${adjacent}`,async()=>{
    const {mon}=await prepare(P.PM_ORC,adjacent?32:33);const bag=await give(mon,O.SACK);
    const gem=mksobj(O.DIAMOND,false,false);await add_to_container(bag,gem);bag.owt=weight(bag);bag.cknown=1;
    seed(0);select(mon,MUSE_BAG,bag,['rn2(5)=0']);assert.equal(await use_misc(mon),2);
    assert.equal(gem.where,C.OBJ_MINVENT);assert.equal(gem.ocarry,mon);assert.equal(bag.cknown,0);
    assert.equal(bag.cobj.length,0);assert.equal(bag.owt,weight(bag));
    if(adjacent)assert.match(messages(),/<32,10>: The orc removes/);
    else {assert.match(messages(),/The orc rummages through/);assert.doesNotMatch(messages(),/<33,10>:/);}
});

async function gainLevel() {
    const pair=await prepare();game.u.uz.dlevel=2;
    const boots=await give(pair.mon,O.IRON_SHOES);await m_dowear(pair.mon,false);
    for(let i=0;pair.mon.mfrozen&&i<10;i++)await mcalcdistress();
    assert.equal(pair.mon.mcanmove,1);
    assert.ok(boots.owornmask&C.W_ARMF);
    const potion=await give(pair.mon,O.POT_GAIN_LEVEL,{cursed:1});makeknown(potion.otyp);
    clearMessages();seed(7);return {...pair,potion};
}
test('cursed gain-level clears a real bear trap and remembered polearm target before migration',async()=>{
    const {mon,potion}=await gainLevel();const trap=maketrap(mon.mx,mon.my,C.BEAR_TRAP);
    await mintrap(mon,C.FORCETRAP);assert.equal(mon.mtrapped,1);
    (game.context.polearm ||= {}).hitmon=mon;clearMessages();seed(7);assert.equal(find_misc(mon),true);assert.equal(game.m.misc,potion);
    assert.equal(await use_misc(mon),2);assert.equal(mon.mtrapped,0);
    assert.equal(game.context.polearm.hitmon,null);assert.ok(game.level.traps.includes(trap));
    assert.ok(game.migrating_mons.includes(mon));assert.ok(!game.level.monsters.includes(mon));
    assert.deepEqual([mon.mx,mon.my,mon.mux,mon.muy],[0,0,game.u.uz.dnum,1]);
    assert.equal(mon.minvent.includes(potion),false);
});
test('cursed gain-level releases a real leash before leaving and reduces tameness once',async()=>{
    const {run,mon,potion}=await gainLevel();assert.ok(await tamedog(mon,null,false));
    const leash=await addinv(mksobj(O.LEASH,false,false));
    const keys=[leash.invlet.charCodeAt(0),'l'.charCodeAt(0)];
    run._display.onEmptyQueue=()=>keys.length?keys.shift():32;
    await doapply();assert.equal(mon.mleashed,1);assert.equal(leash.leashmon,mon.m_id);
    run._display.onEmptyQueue=()=>32;const tame=mon.mtame;clearMessages();seed(7);
    assert.equal(find_misc(mon),true);assert.equal(game.m.misc,potion);assert.equal(await use_misc(mon),2);
    assert.equal(mon.mleashed,0);assert.equal(leash.leashmon,0);assert.equal(mon.mtame,tame-1);
    assert.match(messages(),/<32,10>: The orc pulls free of/);assert.ok(game.migrating_mons.includes(mon));
});
test('blocked rise consumes potion but stays on level and retains its bear trap',async()=>{
    const {mon,potion}=await gainLevel();game.u.uz.dlevel=1;maketrap(mon.mx,mon.my,C.BEAR_TRAP);
    await mintrap(mon,C.FORCETRAP);assert.equal(mon.mtrapped,1);clearMessages();seed(7);
    assert.equal(find_misc(mon),true);assert.equal(await use_misc(mon),2);
    assert.equal(mon.mtrapped,1);assert.ok(game.level.monsters.includes(mon));assert.ok(!mon.minvent.includes(potion));
    assert.match(messages(),/looks uneasy/);
});

async function pauseOn(run, pattern, action, inspect) {
    let release,entered,settled=false,timer;
    const waiting=new Promise(r=>entered=r);
    run._display.onEmptyQueue=()=>{
        if(pattern.test(game._toplines)) {entered();return new Promise(r=>release=r);}
        return 32;
    };
    const pending=action().then(value=>{settled=true;return value;});
    try {
        await Promise.race([waiting,pending.then(()=>{throw Error('action completed without the expected More');}),
            new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('pending More timeout')),2000))]);
        await setImmediate();assert.equal(settled,false);inspect();
    } finally {clearTimeout(timer);run._display.onEmptyQueue=()=>32;release?.(32);await pending;}
}
test('Sunsword removal holds in_use and weapon slot through the real stop-light More',async()=>{
    const {run,mon,weapon}=await whip();
    const sword=await addinv(mksobj(O.LONG_SWORD,false,false));await oname(sword,'Sunsword',C.ONAME_NO_FLAGS);
    await ready_weapon(sword);assert.equal(game.u.uwep,sword);assert.equal(sword.lamplit,1);
    const oldinuse=sword.in_use;
    assert.ok(msgtype_parse_add('stop "stops shining"'));clearMessages();selectWhip(mon,weapon,1);
    await pauseOn(run,/stops shining/,()=>use_misc(mon),()=>{
        assert.equal(sword.lamplit,0);assert.equal(sword.in_use,1);
        assert.equal(game.u.uwep,sword);assert.ok(sword.owornmask&C.W_WEP);assert.equal(sword.where,C.OBJ_INVENT);
    });
    assert.equal(sword.in_use,oldinuse);assert.equal(game.u.uwep,null);assert.equal(sword.where,C.OBJ_FLOOR);
});
test('ordinary whip waits at the real wrapping More before removing the item',async()=>{
    const {run,mon,weapon,target}=await whip();assert.ok(msgtype_parse_add('stop "wraps around"'));
    selectWhip(mon,weapon,1);
    await pauseOn(run,/wraps around/,()=>use_misc(mon),()=>{assert.equal(game.u.uwep,target);assert.equal(target.where,C.OBJ_INVENT);});
    assert.equal(target.where,C.OBJ_FLOOR);
});

test('floor-under-monster disarm does not redraw a hallucinated glyph after its last C message',async()=>{
    const {run,mon,weapon,target}=await whip({accessible:false});
    await make_hallucinated(100,false,0);clearMessages();
    assert.ok(msgtype_parse_add('stop "yanks.*from your"'));selectWhip(mon,weapon,1);
    let glyph;
    await pauseOn(run,/yanks.*from your/,()=>use_misc(mon),()=>{
        glyph=gbuf_at(mon.mx,mon.my).disp_glyphnum;
        assert.equal(typeof glyph,'number');assert.equal(target.where,C.OBJ_FREE);
    });
    assert.equal(target.where,C.OBJ_FLOOR);
    assert.equal(gbuf_at(mon.mx,mon.my).disp_glyphnum,glyph);
});
