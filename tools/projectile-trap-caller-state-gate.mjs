// Constructed C boundaries through public trap dispatch and real producers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup,seed,mount,clearMessages,messages,x,y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {maketrap} from '../js/mklev.js';
import {makemon} from '../js/makemon.js';
import {mksobj} from '../js/mkobj.js';
import {addinv,freeinv,weight} from '../js/invent.js';
import {artifact_exists} from '../js/artifact.js';
import {ABASE} from '../js/attrib.js';
import {dotrap,mintrap,Trap_Effect_Finished,Trap_Is_Gone} from '../js/trap.js';
import {dmgval} from '../js/weapon.js';
import {find_mac} from '../js/worn.js';
import {make_blinded,make_deaf} from '../js/potion.js';
import {Amulet_on} from '../js/do_wear.js';
import {Blind,Half_physical_damage} from '../js/youprop.js';
import {rn2,rnd,getRngLog} from '../js/rng.js';
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import * as C from '../js/const.js';

const kinds=[['arrow',C.ARROW_TRAP,O.ARROW,8],['dart',C.DART_TRAP,O.DART,7]];
async function carryOrb() {
    const orb=mksobj(O.CRYSTAL_BALL,false,false);
    artifact_exists(orb,'The Orb of Fate',true,C.ONAME_WISH);
    assert.ok(orb.oartifact);
    await addinv(orb);
    assert.ok(game.invent.includes(orb));
    assert.equal(game.u.uprops.HALF_PHDAM,C.W_ART);
    assert.ok(!game.u.intrinsic.HHalf_physical_damage);
    return orb;
}
async function hero(type,half=false) {
    await setup();
    if(half)await carryOrb();
    assert.equal(Half_physical_damage(),half);
    game.u.uhp=game.u.uhpmax=200;
    game.u.uac=20; // Constructed accuracy boundary; no claimed native setup.
    game.objs_deleted=[];
    const trap=await maketrap(x,y,type);
    assert.ok(trap);trap.madeby_u=0;
    clearMessages();
    return trap;
}
function missile(otyp) {
    const obj=mksobj(otyp,true,false);
    obj.quan=1;obj.owt=weight(obj);obj.opoisoned=0;obj.ox=x;obj.oy=y;
    return obj;
}
// C trap.c:1208-1213,1272-1278. These are real object/damage/RNG helpers;
// the oracle supplies only the owner's explicit order and integer halving.
function shot(otyp,value,hit=true) {
    seed(value);
    const obj=missile(otyp);
    if(otyp===O.DART&&!rn2(6))obj.opoisoned=1;
    const damage=dmgval(obj,game.youmonst);
    const roll=rnd(20);
    if(hit)rn2(2); // thitu -> exercise(A_STR,FALSE), ordinary human body.
    return {damage,roll,poison:obj.opoisoned,calls:[...getRngLog()]};
}
function deleted(otyp) {
    assert.equal(game.objs_deleted.length,1);
    const obj=game.objs_deleted[0];
    assert.equal(obj.otyp,otyp);assert.equal(obj.where,C.OBJ_DELETED);
    assert.equal(obj.quan,1);assert.equal(obj.owt,weight(obj));
    assert.equal(obj.owornmask||0,0);assert.ok(!obj.unpaid);
    assert.ok(!(game.invent||[]).includes(obj));
    assert.ok(!game.level.objects.includes(obj));
    return obj;
}

test('real carried artifact applies and removes only its extrinsic source',async()=>{
    await setup();
    const ordinary=mksobj(O.CRYSTAL_BALL,false,false);await addinv(ordinary);
    assert.equal(Half_physical_damage(),false);
    const orb=await carryOrb();
    await freeinv(orb);
    assert.equal(Half_physical_damage(),false);
    assert.ok(game.invent.includes(ordinary));
});

for(const [label,type,otyp] of kinds)for(const half of [false,true])
for(const [parity,value] of [['even',1],['odd',otyp===O.ARROW?5:3]])
test(`${label} hit: ${parity} damage, carried half physical=${half}`,async()=>{
    const trap=await hero(type,half),expected=shot(otyp,value);
    assert.equal(expected.damage%2,parity==='odd'?1:0);assert.equal(expected.poison,0);
    seed(value);
    assert.equal(await dotrap(trap,C.FORCETRAP),Trap_Effect_Finished);
    assert.equal(game.u.uhp,200-(half?Math.trunc((expected.damage+1)/2):expected.damage));
    assert.deepEqual(getRngLog(),expected.calls,'halving spends no extra RNG');
    assert.equal(game.u.umortality||0,0);
    assert.equal(trap.once,1);assert.ok(trap.tseen);
    deleted(otyp);
    assert.match(messages(),/You are hit by/);
});

for(const [label,type,otyp] of kinds)for(const blind of [false,true])
test(`${label} misses: floor ownership and blind=${blind} observation`,async()=>{
    const trap=await hero(type,true);
    if(blind)await make_blinded(10,false);
    assert.equal(Blind(),blind);assert.equal(!!game.u.ublind,blind);
    game.u.uac=-30;
    const expected=shot(otyp,1,false);seed(1);clearMessages();
    await dotrap(trap,C.FORCETRAP);
    assert.equal(game.u.uhp,200);assert.deepEqual(getRngLog(),expected.calls);
    assert.equal(game.objs_deleted.length,0);
    const objects=game.level.objectsAt(x,y).filter(o=>o.otyp===otyp);
    assert.equal(objects.length,1);assert.equal(objects[0].where,C.OBJ_FLOOR);
    assert.equal(objects[0].quan,1);assert.equal(!!objects[0].dknown,!blind);
    assert.match(messages(),blind?/It misses\./:/misses you\./);
});

function depletionSeed() {
    for(let value=1;value<=64;value++) {seed(value);if(rn2(15)===0)return value;}
    assert.fail('bounded seed search did not reach depletion');
}
for(const [label,type] of kinds)for(const deaf of [false,true])
test(`${label} hero depletion: deaf=${deaf}, no missile or damage draws`,async()=>{
    const trap=await hero(type);trap.once=1;trap.tseen=1;
    if(deaf)await make_deaf(10,false);
    const value=depletionSeed();seed(value);clearMessages();
    assert.equal(await dotrap(trap,C.FORCETRAP),Trap_Is_Gone);
    assert.deepEqual(getRngLog(),['rn2(15)=0']);
    assert.equal(game.u.uhp,200);assert.equal(game.objs_deleted.length,0);
    assert.equal(game.level.traps.includes(trap),false);
    assert.equal(messages().includes('click'),!deaf);
});

for(const [label,type] of kinds)for(const [accessible,blind] of [[true,false],[false,false],[true,true]])
test(`${label} monster depletion: accessible=${accessible}, blind=${blind}`,async()=>{
    await setup();
    const mon=await makemon(game.mons[P.PM_LARGE_CAT],x+1,y,
        C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    const trap=await maketrap(mon.mx,mon.my,type);
    trap.once=1;trap.tseen=1;
    game.flags.accessiblemsg=accessible;game.iflags.getpos_coords=C.GPCOORDS_NONE;
    if(blind)await make_blinded(10,false);
    const hp=mon.mhp,value=depletionSeed();seed(value);clearMessages();
    assert.equal(await mintrap(mon,C.FORCETRAP),Trap_Is_Gone);
    assert.equal(mon.mhp,hp);assert.deepEqual(getRngLog(),['rn2(15)=0']);
    assert.equal(game.level.traps.includes(trap),false);
    if(blind)assert.equal(messages().trim(),'');
    else {
        assert.match(messages(),/triggers a trap but nothing happens\./);
        assert.equal(messages().includes('(east):'),accessible);
        assert.deepEqual(game.a11y?.msg_loc,{x:0,y:0});
    }
});

for(const [label,type,otyp] of kinds)
test(`${label} unseen used trap does not sample depletion`,async()=>{
    const trap=await hero(type);trap.once=1;trap.tseen=0;
    const expected=shot(otyp,1);seed(1);
    await dotrap(trap,C.FORCETRAP);
    assert.deepEqual(getRngLog(),expected.calls);
    assert.ok(!getRngLog().some(call=>call.startsWith('rn2(15)')));
    deleted(otyp);
});

for(const [label,type,otyp,tlev] of kinds)for(const intercepted of [false,true])
test(`${label} mounted dispatch: intercepted=${intercepted}`,async()=>{
    await hero(type,true);await mount();
    const mon=game.u.usteed;mon.mhp=mon.mhpmax=100;
    const trap=await maketrap(game.u.ux,game.u.uy,type);
    let expected;
    for(let value=1;value<=32;value++) {
        seed(value);const obj=missile(otyp);
        if(otyp===O.DART&&!rn2(6))obj.opoisoned=1;
        const heroDamage=dmgval(obj,game.youmonst);
        const steedSelected=rn2(2)===0;
        if(steedSelected!==intercepted||obj.opoisoned)continue;
        let steedDamage=0,hit;
        if(intercepted) {
            hit=find_mac(mon)+tlev+obj.spe<=rnd(20);
            if(hit)steedDamage=Math.max(1,dmgval(obj,mon));
        } else {rnd(20);rn2(2);hit=true;}
        expected={value,hit,heroDamage,steedDamage,calls:[...getRngLog()]};break;
    }
    assert.ok(expected);seed(expected.value);clearMessages();game.objs_deleted=[];
    assert.equal(await dotrap(trap,C.FORCETRAP),Trap_Effect_Finished);
    assert.equal(game.u.usteed,mon);
    assert.equal(game.u.uhp,200-(intercepted?0:Math.trunc((expected.heroDamage+1)/2)));
    assert.equal(mon.mhp,100-expected.steedDamage,'hero artifact does not halve steed damage');
    assert.deepEqual(getRngLog(),expected.calls);
    if(expected.hit)deleted(otyp);
    else assert.equal(game.level.objectsAt(game.u.ux,game.u.uy).filter(o=>o.otyp===otyp).length,1);
});

for(const half of [false,true])test(`poisoned dart preserves physical/poison draw order, half=${half}`,async()=>{
    const trap=await hero(C.DART_TRAP,half),expected=shot(O.DART,2);
    assert.equal(expected.poison,1);assert.equal(rn2(30),1);
    const calls=[...getRngLog()],oldCon=ABASE(C.A_CON);
    seed(2);clearMessages();await dotrap(trap,C.FORCETRAP);
    assert.equal(game.u.uhp,200-(half?2:3));
    assert.equal(ABASE(C.A_CON),oldCon-1);
    assert.deepEqual(getRngLog(),calls);
    assert.match(messages(),/The dart was poisoned!/);assert.match(messages(),/very sick/);
    assert.ok(deleted(O.DART).opoisoned);
});

test('real poison-resistance amulet prevents the poison outcome draw, not physical damage',async()=>{
    const trap=await hero(C.DART_TRAP,true);
    const amulet=mksobj(O.AMULET_VERSUS_POISON,false,false);
    await addinv(amulet);await Amulet_on(amulet);
    assert.equal(game.u.uprops.POISON_RES,C.W_AMUL);
    const expected=shot(O.DART,2),oldCon=ABASE(C.A_CON);
    seed(2);clearMessages();await dotrap(trap,C.FORCETRAP);
    assert.equal(game.u.uhp,198);assert.equal(ABASE(C.A_CON),oldCon);
    assert.deepEqual(getRngLog(),expected.calls);
    assert.match(messages(),/poison doesn't seem to affect you/);
    assert.ok(deleted(O.DART).opoisoned);
});

test('physical-hit lifesaving completes before dart poison is limited to attribute loss',async()=>{
    const trap=await hero(C.DART_TRAP,true);
    const amulet=mksobj(O.AMULET_OF_LIFE_SAVING,false,false);
    await addinv(amulet);await Amulet_on(amulet);
    assert.equal(game.u.uprops.LIFESAVED,C.W_AMUL);
    const oldCon=ABASE(C.A_CON),expected=shot(O.DART,2,false);
    rn2(19); // done -> makeknown(life saving) -> discover_object -> exercise(WIS,TRUE).
    rn2(2); // thitu resumes and abuses STR after savelife finishes.
    const calls=[...getRngLog()];
    assert.equal(expected.poison,1);
    game.u.uhp=1;game.objs_deleted=[];seed(2);clearMessages();
    await dotrap(trap,C.FORCETRAP);
    assert.equal(game.u.umortality,1);
    assert.equal(game.u.uhp,Math.min(200,50+10*Math.trunc((oldCon-1)/2)));
    assert.equal(ABASE(C.A_CON),oldCon-2,'one loss from lifesaving, one from poison');
    assert.deepEqual(getRngLog(),calls,'fatal=0 spends no rn2(30) poison draw');
    assert.ok(!game.u.uamul);assert.ok(!game.u.uprops.LIFESAVED);
    assert.equal(amulet.where,C.OBJ_DELETED);
    assert.deepEqual(game.objs_deleted.map(o=>o.otyp),[O.DART,O.AMULET_OF_LIFE_SAVING]);
    assert.ok(game.objs_deleted[0].opoisoned);
    assert.match(messages(),/medallion crumbles to dust/);assert.match(messages(),/dart was poisoned/);
    assert.doesNotMatch(messages(),/Die\?|OK, so you don't die/);
});
