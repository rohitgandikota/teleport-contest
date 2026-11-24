// C monmove.c:1539-1619 and artifact.c:2772-2803.
// Constructed corridor, real monster, artifact, beatitude and inventory producers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {mksobj, bless, curse, unbless, uncurse} from '../js/mkobj.js';
import {oname} from '../js/do_name.js';
import {obj_extract_self} from '../js/invent.js';
import {mpickobj} from '../js/steal.js';
import {can_touch_safely} from '../js/mon.js';
import {has_magic_key} from '../js/artifact.js';
import {m_move} from '../js/monmove.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {resetInputState} from '../js/input.js';
import {vision_recalc} from '../js/vision.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {ART_MASTER_KEY_OF_THIEVERY} from '../js/artilist_data.js';
import {ROOM, STONE, DOOR, D_LOCKED, D_CLOSED, D_TRAPPED, D_ISOPEN, D_NODOOR,
    COLNO, ROWNO, NO_MINVENT, MM_NOMSG, MM_NOGRP, MM_NOCOUNTBIRTH,
    MMOVE_MOVED, ONAME_LEVEL_DEF, OBJ_MINVENT, TRAPPED_DOOR} from '../js/const.js';

async function setup({type=PMNAMES.PM_WIZARD, beatitude='blessed',
                      mask=D_LOCKED|D_TRAPPED, artifact=true, key=true, apple=false}={}) {
    const run = await runSegment({seed:99812, datetime:'20000110090000', moves:' ',
        nethackrc:'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage:new InMemoryStorage()});
    let acknowledgments=0;
    run._display.onEmptyQueue=()=>{assert.ok(++acknowledgments<=10);return 32;};
    game._preNhgetchHook=null;resetInputState();
    game.level.monsters=[];game.level.monAt.clear();
    for(const obj of [...game.level.objects]) await obj_extract_self(obj);
    game.level.traps=[];game.regions=[];game.timer_base=[];
    game.u.ux=31;game.u.uy=10;
    for(let x=1;x<COLNO;x++)for(let y=0;y<ROWNO;y++)
        Object.assign(game.level.at(x,y),{typ:y===10&&x>=31&&x<=34?ROOM:STONE,
            lit:1,waslit:1,seenv:255,roomno:0,doormask:0});
    const door=game.level.at(33,10);
    Object.assign(door,{typ:DOOR,doormask:mask});
    vision_recalc(0);
    const mon=await makemon(game.mons[type],34,10,
        NO_MINVENT|MM_NOMSG|MM_NOGRP|MM_NOCOUNTBIRTH);
    assert.ok(mon);mon.mpeaceful=mon.msleeping=0;
    mon.mux=game.u.ux;mon.muy=game.u.uy;
    let obj=null;
    if(key){
        obj=mksobj(ONAMES.SKELETON_KEY,false,false);
        if(artifact) oname(obj,'The Master Key of Thievery',ONAME_LEVEL_DEF);
        unbless(obj);uncurse(obj);
        if(beatitude==='blessed')bless(obj);
        if(beatitude==='cursed')await curse(obj);
        assert.equal(obj.oartifact||0,artifact?ART_MASTER_KEY_OF_THIEVERY:0);
        assert.ok(can_touch_safely(mon,obj));
        assert.equal(await mpickobj(mon,obj),0);
        assert.equal(obj.where,OBJ_MINVENT);assert.equal(obj.ocarry,mon);
        if(apple){
            const food=mksobj(ONAMES.APPLE,false,false);
            await mpickobj(mon,food);
            assert.equal(mon.minvent[0],food);
        }
    }
    game.context.mon_moving=true;
    game._toplin=0;game._toplines='';game._pending_message='';game._msg_history=[];
    initRng(14);enableRngLog();
    return {mon,door,obj,hp:mon.mhp};
}

async function moveAndCheck(state,disarm,opening='unlocks and opens a door') {
    const {mon,door,obj,hp}=state;
    assert.equal(has_magic_key(mon),disarm?obj:null);
    assert.equal(await m_move(mon,0),MMOVE_MOVED);
    assert.deepEqual([mon.mx,mon.my],[33,10]);
    assert.equal(door.doormask,disarm?D_ISOPEN:D_NODOOR);
    const blastDraws=getRngLog().filter(s=>/^rnd\(15\)=/.test(s));
    if(disarm){
        assert.equal(mon.mhp,hp);assert.equal(!!mon.mstun,false);
        assert.equal(mon.mtrapseen&(1<<(TRAPPED_DOOR-1)),0);
        assert.equal(blastDraws.length,0);assert.ok(game._toplines.includes(opening));
        assert.doesNotMatch(game._msg_history.join('\n'),/KABOOM|explosion|disarm/i);
    }else{
        assert.ok(mon.mhp<hp);assert.equal(!!mon.mstun,true);
        assert.ok(mon.mtrapseen&(1<<(TRAPPED_DOOR-1)));
        assert.equal(blastDraws.length,1);assert.match(game._toplines,/KABOOM/);
    }
    if(obj){assert.ok(mon.minvent.includes(obj));assert.equal(obj.ocarry,mon);}
}

for(const type of [PMNAMES.PM_ROGUE,PMNAMES.PM_WIZARD])
    for(const beatitude of ['blessed','uncursed','cursed'])
        test(`${type===PMNAMES.PM_ROGUE?'Rogue':'non-Rogue'} with ${beatitude} artifact key`,async()=>{
            const valid=type===PMNAMES.PM_ROGUE?beatitude!=='cursed':beatitude==='blessed';
            await moveAndCheck(await setup({type,beatitude}),valid);
        });

test('a blessed ordinary skeleton key unlocks but does not disarm',async()=>{
    await moveAndCheck(await setup({artifact:false}),false);
});
test('the artifact remains effective after a non-key inventory head',async()=>{
    await moveAndCheck(await setup({apple:true}),true);
});
test('disarming a trapped closed door enables the exact D_CLOSED opening arm',async()=>{
    await moveAndCheck(await setup({mask:D_CLOSED|D_TRAPPED}),true,'opens a door');
    assert.doesNotMatch(game._toplines,/unlocks/);
});
test('without a key, D_CLOSED|D_TRAPPED retains the C smashing/explosion path',async()=>{
    await moveAndCheck(await setup({key:false,mask:D_CLOSED|D_TRAPPED}),false);
});
test('an untrapped locked door keeps ordinary unlocking with the same key',async()=>{
    const state=await setup({mask:D_LOCKED});
    await moveAndCheck(state,true);
});
