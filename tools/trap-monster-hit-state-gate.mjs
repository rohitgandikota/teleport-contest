// Constructed source boundaries through public mintrap and real helpers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup as baseSetup,mount,seed,clearMessages,messages,x,y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {maketrap} from '../js/mklev.js';
import {mksobj} from '../js/mkobj.js';
import {weight} from '../js/invent.js';
import {mintrap,steedintrap,Trap_Effect_Finished,Trap_Killed_Mon} from '../js/trap.js';
import {dmgval} from '../js/weapon.js';
import {find_mac} from '../js/worn.js';
import {make_blinded} from '../js/potion.js';
import {rnd,rn2,d,getRngLog} from '../js/rng.js';
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import * as C from '../js/const.js';

async function setup(species,type,accessible=true,blind=false) {
    await baseSetup();
    const mon=await makemon(game.mons[species],x+1,y,
        C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(mon);
    mon.mhp=mon.mhpmax=100;
    const trap=await maketrap(mon.mx,mon.my,type);
    assert.ok(trap);
    trap.madeby_u=0;
    game.flags.accessiblemsg=accessible;
    game.iflags.getpos_coords=C.GPCOORDS_NONE;
    game.objs_deleted=[];
    if(blind)await make_blinded(10,false);
    clearMessages();seed(2);
    return {mon,trap};
}

function missile(type,trap) {
    const obj=mksobj(type,true,false);
    obj.quan=1;obj.owt=weight(obj);obj.opoisoned=0;
    obj.ox=trap.tx;obj.oy=trap.ty;
    return obj;
}

// Predict only the C caller's explicit draws with real RNG/object/damage helpers.
// The selected seed controls the test, never the runtime branch.
function missileExpectation(mon,trap,type,wantHit) {
    for(let value=1;value<=64;value++) {
        seed(value);
        const obj=missile(type,trap);
        if(type===O.DART && !rn2(6))obj.opoisoned=1;
        const hit=find_mac(mon)+(type===O.ARROW?8:7)+obj.spe<=rnd(20);
        const damage=hit?Math.max(1,dmgval(obj,mon)):0;
        if(hit===wantHit)return {value,damage,calls:[...getRngLog()]};
    }
    assert.fail('bounded seeds must reach the requested accuracy boundary');
}

for(const [label,species,harmless,accessible,blind] of [
    ['solid xorn',P.PM_XORN,true,true,false],
    ['ordinary cat',P.PM_LARGE_CAT,false,false,false],
    ['unsolid ghost',P.PM_GHOST,false,true,false],
    ['blind xorn',P.PM_XORN,true,true,true],
]) test(`falling rock: ${label}`,async()=>{
    const {mon,trap}=await setup(species,C.ROCKTRAP,accessible,blind);
    missile(O.ROCK,trap);const damage=d(2,6),expected=[...getRngLog()];
    seed(2);
    assert.equal(await mintrap(mon,C.FORCETRAP),Trap_Effect_Finished);
    assert.equal(mon.mhp,100-(harmless?0:damage));
    assert.deepEqual(getRngLog(),expected,'forced damage skips accuracy and dmgval draws');
    const rocks=game.level.objectsAt(mon.mx,mon.my).filter(o=>o.otyp===O.ROCK);
    assert.equal(rocks.length,1);assert.equal(rocks[0].quan,1);
    assert.equal(rocks[0].where,C.OBJ_FLOOR);assert.equal(game.objs_deleted.length,0);
    if(blind)assert.equal(messages().trim(),'');
    else {
        assert.equal(messages().includes('but is not harmed.'),harmless);
        assert.equal(messages().includes('(east):'),accessible);
    }
});

for(const accessible of [false,true])for(const hit of [false,true])
test(`arrow ${hit?'hit':'miss'}, accessible=${accessible}`,async()=>{
    const {mon,trap}=await setup(P.PM_XORN,C.ARROW_TRAP,accessible);
    const expected=missileExpectation(mon,trap,O.ARROW,hit);
    seed(expected.value);
    assert.equal(await mintrap(mon,C.FORCETRAP),Trap_Effect_Finished);
    assert.equal(mon.mhp,100-expected.damage);
    assert.deepEqual(getRngLog(),expected.calls);
    assert.equal(messages().includes('almost hit'),!hit);
    assert.equal(messages().includes('(east):'),accessible);
    assert.ok(!messages().includes('not harmed'),'wooden arrow is not a stone missile');
    const arrows=game.level.objectsAt(mon.mx,mon.my).filter(o=>o.otyp===O.ARROW);
    assert.equal(arrows.length,hit?0:1);
    assert.equal(game.objs_deleted.length,hit?1:0);
    if(hit)assert.equal(game.objs_deleted[0].where,C.OBJ_DELETED);
    else assert.equal(arrows[0].where,C.OBJ_FLOOR);
    assert.deepEqual(game.a11y?.msg_loc,{x:0,y:0},'location consumed even with option off');
});

test('dart poison draw precedes accuracy and damage, spent dart is deleted',async()=>{
    const {mon,trap}=await setup(P.PM_XORN,C.DART_TRAP);
    const expected=missileExpectation(mon,trap,O.DART,true);
    seed(expected.value);
    await mintrap(mon,C.FORCETRAP);
    assert.equal(mon.mhp,100-expected.damage);
    assert.deepEqual(getRngLog(),expected.calls);
    assert.equal(game.objs_deleted.length,1);
    assert.equal(game.objs_deleted[0].otyp,O.DART);
    assert.equal(game.objs_deleted[0].where,C.OBJ_DELETED);
    assert.match(messages(),/\(east\):.*hit by/);
});

test('paper golem fire trap selects complete immolation',async()=>{
    const {mon}=await setup(P.PM_PAPER_GOLEM,C.FIRE_TRAP,false);
    assert.equal(await mintrap(mon,C.FORCETRAP),Trap_Killed_Mon);
    assert.ok(mon.mhp<=0);
    assert.equal(game.disintegested,true);
    assert.equal(game.level.monsters.includes(mon),false);
    assert.equal(game.level.objectsAt(mon.mx,mon.my).length,0);
    assert.match(getRngLog()[0],/^d\(2,4\)=/);
    assert.ok(!getRngLog().some(c=>c.startsWith('rnd(20)=')));
});

test('ordinary lethal falling rock retains its missile and allows a corpse',async()=>{
    const {mon}=await setup(P.PM_TROLL,C.ROCKTRAP,false);
    mon.mhp=1;
    assert.equal(await mintrap(mon,C.FORCETRAP),Trap_Killed_Mon);
    assert.equal(game.disintegested,false);
    assert.equal(game.level.monsters.includes(mon),false);
    const objects=game.level.objectsAt(mon.mx,mon.my);
    assert.ok(objects.some(o=>o.otyp===O.ROCK));
    assert.ok(objects.some(o=>o.otyp===O.CORPSE && o.corpsenm===P.PM_TROLL));
});

test('real mounted steed receives located missile feedback and completed ownership',async()=>{
    await baseSetup();await mount();
    const mon=game.u.usteed;mon.mhp=mon.mhpmax=100;
    const trap=await maketrap(game.u.ux,game.u.uy,C.ARROW_TRAP);
    const obj=missile(O.ARROW,trap);
    game.flags.accessiblemsg=true;game.iflags.getpos_coords=C.GPCOORDS_NONE;
    seed(2);
    const hit=find_mac(mon)+8+obj.spe<=rnd(20);
    const damage=hit?Math.max(1,dmgval(obj,mon)):0;
    const expected=[...getRngLog()];
    clearMessages();seed(2);
    assert.equal(await steedintrap(trap,obj),1);
    assert.equal(mon.mhp,100-damage);
    assert.equal(game.u.usteed,mon);
    assert.equal(obj.where,hit?C.OBJ_DELETED:C.OBJ_FLOOR);
    assert.deepEqual(getRngLog(),expected);
    assert.match(messages(),/^\(here\):/);
});
