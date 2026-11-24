// Source-derived SURFACE_AT/accessibility controls using real terrain producers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup,seed,x,y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {accessible,undesirable_disp} from '../js/monmove.js';
import {create_drawbridge,open_drawbridge,close_drawbridge,db_under_typ,is_ice} from '../js/dbridge.js';
import {zap_over_floor,melt_ice,BZ_U_WAND} from '../js/zap.js';
import {set_levltyp} from '../js/mkmaze.js';
import {makemon} from '../js/makemon.js';
import {mondied,is_pool,is_lava} from '../js/mon.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P,ATTKS} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

const bx=x+2,by=y;
function check(expected,xx=bx,yy=by) {
    const before=structuredClone(game.level.at(xx,yy));
    const calls=[...getRngLog()];
    const result=accessible(xx,yy);
    assert.equal(typeof result,'boolean','synchronous Boolean contract');
    assert.equal(result,expected);
    assert.deepEqual(getRngLog(),calls,'predicate consumes no RNG');
    assert.deepEqual(game.level.at(xx,yy),before,'predicate changes no terrain');
}
function bridge(dir=C.DB_EAST,lava=false,open=false) {
    const [dx,dy]=dir===C.DB_EAST?[1,0]:dir===C.DB_WEST?[-1,0]:dir===C.DB_NORTH?[0,-1]:[0,1];
    assert.ok(set_levltyp(bx,by,lava?C.LAVAPOOL:C.MOAT));
    assert.ok(set_levltyp(bx+dx,by+dy,C.HWALL));
    assert.equal(create_drawbridge(bx,by,dir,open),true);
    assert.equal(game.level.at(bx,by).drawbridgemask&C.DB_DIR,dir);
    return {x:bx+dx,y:by+dy};
}
async function freeze(xx=bx,yy=by) {
    const shopdamage={v:false};
    assert.equal(await zap_over_floor(xx,yy,BZ_U_WAND(ATTKS.AD_COLD - 1),shopdamage,true,O.STRANGE_OBJECT),-3);
    assert.equal(shopdamage.v,false);
}

// Direction bits must survive both the real cold-beam and thaw producers.
for(const dir of [C.DB_NORTH,C.DB_SOUTH,C.DB_EAST,C.DB_WEST]) {
    await test(`raised bridge freezes and thaws, direction ${dir}`,async()=>{
        await setup();bridge(dir);seed(2);
        assert.equal(is_pool(bx,by),true);check(false);
        await freeze();
        const lev=game.level.at(bx,by);
        assert.equal(lev.typ,C.DRAWBRIDGE_UP);
        assert.equal(lev.drawbridgemask&C.DB_UNDER,C.DB_ICE);
        assert.equal(lev.drawbridgemask&C.DB_DIR,dir);
        assert.equal(db_under_typ(lev.drawbridgemask),C.ICE);
        assert.equal(is_ice(bx,by),true);check(true);
        await melt_ice(bx,by,null);
        assert.equal(lev.typ,C.DRAWBRIDGE_UP);
        assert.equal(lev.drawbridgemask&C.DB_UNDER,C.DB_MOAT);
        assert.equal(lev.drawbridgemask&C.DB_DIR,dir);
        assert.equal(is_pool(bx,by),true);check(false);
    });
}

await test('raised lava cools to DB_FLOOR, whose C surface is stone',async()=>{
    await setup();bridge(C.DB_EAST,true);seed(2);
    assert.equal(is_lava(bx,by),true);check(false);
    await freeze();
    assert.equal(game.level.at(bx,by).drawbridgemask&C.DB_UNDER,C.DB_FLOOR);
    assert.equal(db_under_typ(game.level.at(bx,by).drawbridgemask),C.STONE);
    assert.equal(is_ice(bx,by),false);check(false);
});

await test('opening and closing selects span surface without treating the portcullis as ice',async()=>{
    await setup();const wall=bridge();seed(2);
    await freeze();check(true);check(false,wall.x,wall.y);
    await open_drawbridge(bx,by);
    assert.equal(game.level.at(bx,by).typ,C.DRAWBRIDGE_DOWN);
    check(true);check(true,wall.x,wall.y);
    await close_drawbridge(bx,by);
    assert.equal(game.level.at(bx,by).typ,C.DRAWBRIDGE_UP);
    assert.equal(game.level.at(bx,by).drawbridgemask&C.DB_UNDER,C.DB_ICE);
    check(true);check(false,wall.x,wall.y);
});

for(const type of [C.POOL,C.MOAT]) {
    await test(`ordinary water ${type} freezes to ordinary accessible ice`,async()=>{
        await setup();set_levltyp(bx,by,type);seed(2);check(false);
        await freeze();
        assert.equal(game.level.at(bx,by).typ,C.ICE);check(true);
    });
}

// Constructed door boundaries use the actual terrain structure and C masks.
for(const [name,mask,expected]of [
    ['empty',C.D_NODOOR,true],['open',C.D_ISOPEN,true],['broken',C.D_BROKEN,true],
    ['closed',C.D_CLOSED,false],['locked',C.D_LOCKED,false],
])await test(`${name} door retains its original accessibility`,async()=>{
    await setup();assert.ok(set_levltyp(bx,by,C.DOOR));
    game.level.at(bx,by).doormask=mask;seed(2);check(expected);
});

await test('real displacement consumer accepts ice and retains the two-pool exception',async()=>{
    await setup();bridge();
    const mon=await makemon(game.mons[P.PM_TROLL],x,y+1,
        C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(mon);seed(2);
    assert.equal(undesirable_disp(mon,bx,by),true,'land monster avoids water target');
    await freeze();
    seed(2);assert.equal(undesirable_disp(mon,bx,by),false);
    assert.deepEqual(getRngLog(),[]);
    await melt_ice(bx,by,null);
    assert.ok(set_levltyp(mon.mx,mon.my,C.POOL));
    seed(2);assert.equal(undesirable_disp(mon,bx,by),false);
    assert.deepEqual(getRngLog(),[]);
});

await test('sealed mondied consumer leaves remains on cold-created bridge ice',async()=>{
    await setup();
    const mon=await makemon(game.mons[P.PM_TROLL],bx,by,
        C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(mon);bridge();await freeze();seed(2);
    await mondied(mon);
    const corpses=game.level.objectsAt(bx,by).filter(o=>o.otyp===O.CORPSE);
    assert.equal(corpses.length,1);
    assert.equal(corpses[0].corpsenm,P.PM_TROLL);
    assert.equal(mon.mhp,0);
});
