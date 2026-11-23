// Independent C invent.c:4181-4183 feature suppression controls.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { look_here, obj_extract_self } from '../js/invent.js';
import { set_uinwater } from '../js/hack.js';
import { Underwater } from '../js/youprop.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { ROOM, POOL, FOUNTAIN } from '../js/const.js';
import { TOPLINE_EMPTY } from '../js/display.js';
for (const [name,typ,underwater,message] of [
    ['dry pool',POOL,false,'There is a pool of water here.'],
    ['underwater pool',POOL,true,'You see no objects here.'],
    ['underwater empty floor',ROOM,true,'You see no objects here.'],
    ['underwater non-pool feature',FOUNTAIN,true,'There is a fountain here.'],
]) test(name,async()=>{
    const run=await runSegment({seed:6202,datetime:'20000110090000',moves:' ',storage:new InMemoryStorage(),
        nethackrc:'OPTIONS=role:Barbarian,race:human,gender:male,align:neutral,playmode:debug\n'
            +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'});
    run._display.onEmptyQueue=()=>32;
    game._preNhgetchHook=null;
    game.level.traps=[];
    for(const obj of [...game.level.objects])await obj_extract_self(obj);
    Object.assign(game.u,{ux:35,uy:10});
    game.level.at(game.u.ux,game.u.uy).typ=typ;
    await set_uinwater(+underwater);
    assert.equal(Underwater(),underwater);
    assert.equal(game.u.uprops?.UNDERWATER,undefined,'canonical producer has no raw alias');
    game._toplin=TOPLINE_EMPTY;game._prevmsg='';
    initRng(6202);enableRngLog();
    await look_here(0,0);
    assert.equal(game._prevmsg,message);
    assert.deepEqual(getRngLog(),[],'feature suppression has no core RNG');
});
