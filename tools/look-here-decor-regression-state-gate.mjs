// Retained source-derived regressions for pickup.c decor helpers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { make_blinded } from '../js/potion.js';
import { force_decor } from '../js/pickup.js';
import { look_here, obj_extract_self } from '../js/invent.js';
import { STONE, ROOM, ICE, DRAWBRIDGE_UP, DB_ICE } from '../js/const.js';
async function setup(typ) {
    const run=await runSegment({seed:6202,datetime:'20000110090000',moves:' ',storage:new InMemoryStorage(),
        nethackrc:'OPTIONS=role:Barbarian,race:human,gender:male,align:neutral,playmode:debug\n'
            +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'});
    run._display.onEmptyQueue=()=>32;game._preNhgetchHook=null;
    game.level.monsters=[];game.level.monAt.clear();game.level.traps=[];
    for(const obj of [...game.level.objects])await obj_extract_self(obj);
    Object.assign(game.u,{ux:35,uy:10});
    Object.assign(game.level.at(35,10),{typ,drawbridgemask:DB_ICE});
    await make_blinded(100,false);
    game.vision_full_recalc=0;
    Object.assign(game,{_toplin:0,_toplines:'',_prevmsg:'',_msg_history:[],_msg_maxrow:0,_msg_maxcol:0});
    game.flags.mention_decor=false;game.iflags.prev_decor=ROOM;
}
test('force_decor retains STONE prev_decor when mention_decor is off',async()=>{
    await setup(ICE);
    await force_decor(false);
    // C pickup.c:328,422,332: describe_decor leaves STONE; force_decor writes lastseentyp instead.
    assert.equal(game.iflags.prev_decor,STONE);
});
test('raised drawbridge ice uses the surface for decor grammar',async()=>{
    await setup(DRAWBRIDGE_UP);
    await look_here(0,0);
    const text=[...game._msg_history,game._toplines,game._prevmsg].join('\n');
    // C pickup.c:376,397 uses SURFACE_AT, suppressing the article on ICE.
    assert.match(text,/There is solid ice here\./);
    assert.doesNotMatch(text,/There is a solid ice here\./);
    assert.match(text,/You try to feel what is on it\./);
});
