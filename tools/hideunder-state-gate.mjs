// Constructed C mon.c:4726-4801 controls using real producers and RNG.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { makemon, hideunder } from '../js/makemon.js';
import { hide_monst, maybe_unhide_at, seemimic } from '../js/mon.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { obj_extract_self } from '../js/invent.js';
import { set_mon_data } from '../js/mondata.js';
import { set_uinwater } from '../js/hack.js';
import { canseemon, pline, TOPLINE_EMPTY } from '../js/display.js';
import { y_monnam } from '../js/do_name.js';
import { Underwater, Stone_resistance } from '../js/youprop.js';
import { hatch_egg } from '../js/timeout.js';
import { make_blinded, make_hallucinated } from '../js/potion.js';
import { PMNAMES, MFLAGS } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { COULD_SEE, IN_SIGHT, TEMP_LIT } from '../js/vision.js';
import { ROOM, POOL, LAVAPOOL, PIT, BEAR_TRAP, TT_PIT, FROMOUTSIDE,
    NO_MINVENT, MM_NOGRP, MM_NOWAIT, PLNMSG_HIDE_UNDER } from '../js/const.js';
const x=35,y=10;
async function setup(species=PMNAMES.PM_GARTER_SNAKE) {
    const run=await runSegment({seed:6202,datetime:'20000110090000',moves:' ',storage:new InMemoryStorage(),
        nethackrc:'OPTIONS=role:Barbarian,race:human,gender:male,align:neutral,playmode:debug\n'
            +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'});
    run._display.onEmptyQueue=()=>32;
    game._preNhgetchHook=null;game.vision_full_recalc=0;
    game.level.monsters=[];game.level.monAt.clear();game.level.traps=[];
    for(const obj of [...game.level.objects]) await obj_extract_self(obj);
    Object.assign(game.u,{ux:30,uy:10,uinwater:0,utrap:0,uundetected:0,ublind:0,
        uswallow:false,ustuck:null,usteed:null,intrinsic:{},uprops:{},blocked:{}});
    game.in_mklev=false;
    for(let xx=28;xx<=38;xx++)for(let yy=8;yy<=12;yy++){
        Object.assign(game.level.at(xx,yy),{typ:ROOM,lit:1,waslit:1,seenv:255,roomno:0});
        game.viz_array[yy][xx]=IN_SIGHT|COULD_SEE|TEMP_LIT;
    }
    const mon=await makemon(game.mons[species],x,y,NO_MINVENT|MM_NOGRP|MM_NOWAIT);
    seemimic(mon);
    Object.assign(mon,{mundetected:0,mtrapped:0,mtame:0,mpeaceful:1,minvis:0,mburied:0});
    game._toplin=TOPLINE_EMPTY;game._prevmsg='';game.iflags.last_msg=0;
    (game.gl ||= {}).last_hider=-1;
    return {mon,run};
}
async function shelter(type=ONAMES.DAGGER,fields={}) {
    const obj=mksobj(type,false,false);Object.assign(obj,fields);
    await place_object(obj,x,y);return obj;
}
function resetRng() {initRng(6202);enableRngLog();}
async function check(mon,expected,feedback=false) {
    resetRng();
    const result=hideunder(mon);
    assert.equal(typeof result?.then,feedback?'function':'undefined','only monster feedback is pending');
    assert.equal(await result,expected,'C hiding result');
    assert.equal(mon.mundetected,+expected);
    assert.deepEqual(getRngLog(),[],'no core RNG in concealment or ordinary feedback');
    assert.equal(game.iflags.last_msg,feedback?PLNMSG_HIDE_UNDER:0);
    assert.equal(game.gl.last_hider,feedback?mon.m_id:-1);
}
test('visible snake announces hiding and remembers its covering object',async()=>{
    const {mon}=await setup();await shelter();assert.equal(canseemon(mon),true);
    game.level.at(x,y).remembered_glyph=null;
    await check(mon,true,true);
    assert.match(game._prevmsg,/^You see the garter snake slither under a dagger\.$/);
    assert.equal(game.level.at(x,y).remembered_glyph?.glyph?.otyp,ONAMES.DAGGER);
});
for(const mode of ['unseen','blind','invisible','level creation','already hidden'])
    test(`synchronous shelter: ${mode}`,async()=>{
        const {mon}=await setup();await shelter();
        if(mode==='unseen')game.viz_array[y][x]=TEMP_LIT;
        if(mode==='blind')await make_blinded(20,false);
        if(mode==='invisible')mon.minvis=1;
        if(mode==='level creation')game.in_mklev=true;
        if(mode==='already hidden')mon.mundetected=1;
        await check(mon,true);
    });
for(const mode of ['ordinary monster','no object','held','trapped','nonpit trap','small coins',
                   'pet cursed shelter','pet cursed lower object','pool','lava'])
    test(`rejected shelter: ${mode}`,async()=>{
        const {mon}=await setup(mode==='ordinary monster'?PMNAMES.PM_GOBLIN:PMNAMES.PM_GARTER_SNAKE);
        if(mode==='pet cursed lower object')await shelter(ONAMES.ROCK,{cursed:1});
        if(mode!=='no object')await shelter(mode==='small coins'?ONAMES.GOLD_PIECE:ONAMES.DAGGER,
            {quan:mode==='small coins'?9:1,cursed:mode==='pet cursed shelter'?1:0});
        if(mode==='held')game.u.ustuck=mon;
        if(mode==='trapped')mon.mtrapped=1;
        if(mode==='nonpit trap')game.level.traps.push({tx:x,ty:y,ttyp:BEAR_TRAP});
        if(mode.startsWith('pet'))mon.mtame=10;
        if(mode==='pool'||mode==='lava')game.level.at(x,y).typ=mode==='pool'?POOL:LAVAPOOL;
        await check(mon,false);
    });
for(const mode of ['pit','ten coins','nonpet cursed','pet uncursed'])
    test(`accepted shelter: ${mode}`,async()=>{
        const {mon}=await setup();
        await shelter(mode==='ten coins'?ONAMES.GOLD_PIECE:ONAMES.DAGGER,
            {quan:mode==='ten coins'?10:1,cursed:mode==='nonpet cursed'?1:0});
        if(mode==='pit')game.level.traps.push({tx:x,ty:y,ttyp:PIT});
        if(mode==='pet uncursed')mon.mtame=10;
        await check(mon,true,true);
    });
for(const mode of ['only petrifying corpse','corpse above dagger','stone resistant'])
    test(`corpse pile: ${mode}`,async()=>{
        const {mon}=await setup();
        if(mode==='corpse above dagger')await shelter();
        await shelter(ONAMES.CORPSE,{corpsenm:PMNAMES.PM_COCKATRICE});
        if(mode==='stone resistant')mon.mintrinsics|=MFLAGS.MR_STONE;
        const hides=mode!=='only petrifying corpse';
        await check(mon,hides,hides);
        if(hides)assert.match(game._prevmsg,/under a corpse\.$/,'message names original top object');
    });
for(const mode of ['dry','pool','water plane','underwater visible','underwater blocked'])
    test(`eel: ${mode}`,async()=>{
        const {mon}=await setup(PMNAMES.PM_GIANT_EEL);
        game.level.at(x,y).typ=mode==='dry'?ROOM:POOL;
        if(mode==='water plane')game.water_level={...game.u.uz};
        if(mode.startsWith('underwater')){
            await set_uinwater(1);
            assert.equal(Underwater(),true);
            assert.equal(game.u.uprops.UNDERWATER,undefined,'real water producer has no legacy alias');
            game.viz_array[y][x]=mode==='underwater blocked'?TEMP_LIT:IN_SIGHT|COULD_SEE|TEMP_LIT;
        }
        const hides=mode==='pool'||mode==='underwater blocked';
        await check(mon,hides,mode==='pool');
        if(mode==='pool')assert.match(game._prevmsg,/giant eel dive under the water\.$/);
    });
for(const mode of ['ordinary shelter','trapped pit','intrinsic stone resistance','extrinsic stone resistance','no stone resistance'])
    test(`hero: ${mode}`,async()=>{
        await setup();game.u.ux=x;game.u.uy=y;
        set_mon_data(game.youmonst,game.mons[PMNAMES.PM_GARTER_SNAKE]);
        Object.assign(game.youmonst,{mx:x,my:y,mundetected:0,mtrapped:0,mtame:0});
        const corpse=mode.includes('stone resistance');
        await shelter(corpse?ONAMES.CORPSE:ONAMES.DAGGER,{corpsenm:PMNAMES.PM_COCKATRICE});
        if(mode==='trapped pit'){
            game.u.utrap=5;game.u.utraptype=TT_PIT;game.level.traps.push({tx:x,ty:y,ttyp:PIT});
        }
        if(mode==='intrinsic stone resistance')game.u.intrinsic.HStone_resistance=FROMOUTSIDE;
        if(mode==='extrinsic stone resistance')game.u.uprops.STONE_RES=FROMOUTSIDE;
        if(corpse)assert.equal(Stone_resistance(),mode!=='no stone resistance');
        const hides=mode!=='trapped pit'&&mode!=='no stone resistance';
        resetRng();const result=hideunder(game.youmonst);
        assert.equal(result,hides,'hero retains a synchronous boolean');
        assert.equal(game.u.uundetected,+hides);
        assert.equal(game.youmonst.mundetected,0,'C writes only the hero hiding field');
        assert.equal(game.iflags.last_msg,0);assert.equal(game.gl.last_hider,-1);
        assert.deepEqual(getRngLog(),[]);
    });
for(const mode of ['ordinary monster','held snake','no shelter'])
    test(`hallucinated visible name still sampled on failure: ${mode}`,async()=>{
        const {mon}=await setup(mode==='ordinary monster'?PMNAMES.PM_GOBLIN:PMNAMES.PM_GARTER_SNAKE);
        if(mode==='held snake'){await shelter();game.u.ustuck=mon;}
        await make_hallucinated(100,false);
        const old=Object.getOwnPropertyDescriptor(globalThis,'__rng_log_disp');
        try{
            globalThis.__rng_log_disp=true;
            game.dispCtx=null;resetRng();y_monnam(mon);
            const expected=[...getRngLog()];assert.ok(expected.length);
            game.dispCtx=null;resetRng();assert.equal(hideunder(mon),false);
            assert.deepEqual(getRngLog(),expected,'C evaluates visible name even without feedback');
        }finally{if(old)Object.defineProperty(globalThis,'__rng_log_disp',old);else delete globalThis.__rng_log_disp;}
    });
for(const route of ['hideunder','hide_monst'])test(`${route}: More defers bookkeeping and redraw`,async()=>{
    const {mon,run}=await setup();await shelter();
    await pline('The previous message is long enough to require acknowledgment before hiding.');
    game.iflags.last_msg=0;game.gl.last_hider=-1;game.level.at(x,y).remembered_glyph=null;
    let entered,release;
    const waiting=new Promise(resolve=>{entered=resolve;});
    run._display.onEmptyQueue=()=>{entered();return new Promise(resolve=>{release=resolve;});};
    const vision=game.viz_array.map(row=>Array.from(row));resetRng();
    const pending=route==='hideunder'?hideunder(mon):hide_monst(mon);
    assert.equal(typeof pending?.then,'function');
    assert.equal(mon.mundetected,1,'hiding state changes before the message');
    let timer;
    try{
        await Promise.race([waiting,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('More not reached')),2000);})]);
        assert.equal(game.iflags.last_msg,0);assert.equal(game.gl.last_hider,-1);
        assert.equal(game.level.at(x,y).remembered_glyph,null,'newsym waits for the message');
        assert.deepEqual(game.viz_array.map(row=>Array.from(row)),vision,'vision restored before any input wait');
    }finally{clearTimeout(timer);release?.(32);}
    assert.equal(await pending,route==='hideunder'?true:undefined);
    assert.equal(game.iflags.last_msg,PLNMSG_HIDE_UNDER);assert.equal(game.gl.last_hider,mon.m_id);
    assert.equal(game.level.at(x,y).remembered_glyph?.glyph?.otyp,ONAMES.DAGGER);
    assert.deepEqual(getRngLog(),[]);
});
test('maybe_unhide_at: hidden cover loss stays synchronous',async()=>{
    const {mon}=await setup();mon.mundetected=1;resetRng();
    assert.equal(maybe_unhide_at(x,y),undefined);
    assert.equal(mon.mundetected,0);assert.equal(game.iflags.last_msg,0);
    assert.equal(game.gl.last_hider,-1);assert.deepEqual(getRngLog(),[]);
});
test('hatch_egg waits for the surviving shelter announcement',async()=>{
    const {mon,run}=await setup();await shelter();
    mon.mgivenname='Longnamed concealed snake';
    const egg=await shelter(ONAMES.EGG,{corpsenm:PMNAMES.PM_GARTER_SNAKE,quan:1});
    let entered,release,finished=false;
    const waiting=new Promise(resolve=>{entered=resolve;});
    run._display.onEmptyQueue=()=>{entered();return new Promise(resolve=>{release=resolve;});};
    const pending=hatch_egg(egg,game.moves).then(()=>{finished=true;});
    let timer;
    try{
        await Promise.race([waiting,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('hatch More not reached')),2000);})]);
        await new Promise(resolve=>setImmediate(resolve));
        assert.equal(finished,false,'timer does not resolve while concealment feedback is pending');
        assert.equal(mon.mundetected,1);
        assert.equal(game.gl.last_hider,-1);
    }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;release?.(32);await pending;}
    assert.equal(game.gl.last_hider,mon.m_id);assert.equal(game.iflags.last_msg,PLNMSG_HIDE_UNDER);
    assert.match(game._prevmsg,/slither under a dagger\.$/);
    assert.ok(!game.level.objects.includes(egg));
});
