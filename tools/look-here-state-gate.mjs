// Source-derived look_here controls. Real runtime helpers; no native oracle.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { look_here, dfeature_at, obj_extract_self } from '../js/invent.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { maketrap } from '../js/mklev.js';
import { make_blinded, make_hallucinated } from '../js/potion.js';
import { Blind } from '../js/youprop.js';
import { can_reach_floor } from '../js/pickup.js';
import { surface } from '../js/dungeon.js';
import { read_engr_at } from '../js/engrave.js';
import { pline, TOPLINE_EMPTY } from '../js/display.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { nh_timeout } from '../js/timeout.js';
import { ONAMES } from '../js/objects_data.js';
import { ROOM, ICE, POOL, FOUNTAIN, ALTAR, AM_LAWFUL, AM_SANCTUM, PIT, SPIKED_PIT,
    HOLE, TRAPDOOR, BEAR_TRAP, TT_PIT, FROMOUTSIDE, ECMD_OK, ECMD_TIME,
    LOOKHERE_PICKED_SOME, LOOKHERE_SKIP_DFEATURE, PLNMSG_ONE_ITEM_HERE } from '../js/const.js';

const x=35,y=10;
function clearMessages() {
    Object.assign(game,{_toplin:TOPLINE_EMPTY,_toplines:'',_prevmsg:'',_pending_message:'',
        _msg_history:[],_msg_maxrow:0,_msg_maxcol:0,_win_stop:false});
    game.iflags.last_msg=0;
}
function messages() { return [...game._msg_history,game._toplines,game._prevmsg].join('\n'); }
function resetRng() { initRng(6202);enableRngLog(); }
async function setup({blind=true,typ=ROOM}={}) {
    const run=await runSegment({seed:6202,datetime:'20000110090000',moves:' ',storage:new InMemoryStorage(),
        nethackrc:'OPTIONS=role:Barbarian,race:human,gender:male,align:neutral,playmode:debug\n'
            +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'});
    run._display.onEmptyQueue=()=>32;
    game._preNhgetchHook=null;
    game.level.monsters=[];game.level.monAt.clear();game.level.traps=[];
    for(const obj of [...game.level.objects])await obj_extract_self(obj);
    Object.assign(game.u,{ux:x,uy:y,uinwater:0,utrap:0,uundetected:0,uswallow:false,
        ustuck:null,usteed:null,uprops:{},intrinsic:{},blocked:{}});
    Object.assign(game.level.at(x,y),{typ,lit:1,waslit:1,altarmask:AM_LAWFUL});
    game.flags.mention_decor=true;game.flags.pile_limit=5;
    game.iflags.prev_decor=ROOM;
    await make_blinded(blind?100:0,false);
    assert.equal(Blind(),blind);
    game.vision_full_recalc=0;
    clearMessages();resetRng();
    return run;
}
async function object(type=ONAMES.DAGGER,fields={}) {
    const obj=mksobj(type,false,false);Object.assign(obj,fields);
    await place_object(obj,x,y);return obj;
}
async function look(count=0,flags=0) {
    resetRng();
    const result=await look_here(count,flags);
    assert.deepEqual(getRngLog(),[],'ordinary inspection spends no core RNG');
    return result;
}

for(const mode of ['ordinary altar','high altar','sighted altar'])test(mode,async()=>{
    await setup({typ:ALTAR,blind:mode!=='sighted altar'});
    if(mode==='high altar')game.level.at(x,y).altarmask|=AM_SANCTUM;
    assert.equal(await look(),mode==='sighted altar'?ECMD_OK:ECMD_TIME);
    const text=messages();
    assert.match(text,/There is (?:an altar|a high altar) to Mitra \(lawful\) here\./);
    if(mode==='ordinary altar'){
        assert.match(text,/You try to feel what is here\./);
        assert.doesNotMatch(text,/lying here on the altar/);
    }else if(mode==='high altar'){
        assert.match(text,/lying here on the altar/,'C prefix is exactly "altar ", not "high altar "');
    }else assert.doesNotMatch(text,/try to feel/);
});
for(const plane of ['ordinary','air','water'])for(const typ of [ROOM,FOUNTAIN])
    test(`${plane}: blind ${typ===ROOM?'floor':'fountain'}`,async()=>{
        await setup({typ});
        if(plane!=='ordinary')game[plane+'_level']={...game.u.uz};
        assert.equal(await look(),ECMD_TIME);
        const text=messages();
        if(plane==='ordinary'){
            assert.match(text,new RegExp('lying here on the '+(typ===ROOM?'floor':'fountain')));
            assert.doesNotMatch(text,/There is a fountain/,'ordinary matching surface is not repeated');
        }else{
            assert.match(text,/You try to feel what is floating here\./);
            assert.doesNotMatch(text,/lying here/);
            if(typ===FOUNTAIN)assert.match(text,/There is a fountain here\./,'drift does not suppress the feature');
        }
    });
for(const plane of ['air','water'])test(`${plane}: levitating drift remains reachable`,async()=>{
    await setup();game[plane+'_level']={...game.u.uz};game.u.intrinsic.HLevitation=FROMOUTSIDE;
    assert.equal(await look(),ECMD_TIME);
    assert.match(messages(),/floating here/);assert.doesNotMatch(messages(),/can't reach/);
});
test('drift still samples the discarded hallucinated surface',async()=>{
    await setup({typ:POOL});game.air_level={...game.u.uz};
    await make_hallucinated(100,false);clearMessages();
    const old=Object.getOwnPropertyDescriptor(globalThis,'__rng_log_disp');
    try{
        globalThis.__rng_log_disp=true;
        game.dispCtx=null;resetRng();dfeature_at(x,y);surface(x,y);
        await read_engr_at(x,y); // C engrave.c:321 samples surface even without an engraving.
        const expected=[...getRngLog()];assert.ok(expected.length>0);
        game.dispCtx=null;resetRng();
        assert.equal(await look_here(0,0),ECMD_TIME);
        assert.deepEqual(getRngLog(),expected,'C evaluates surface even when drift replaces the text');
        assert.match(messages(),/floating here/);
    }finally{
        if(old)Object.defineProperty(globalThis,'__rng_log_disp',old);else delete globalThis.__rng_log_disp;
    }
});
for(const mention of [false,true])for(const previous of [ROOM,ICE])
    test(`ice: mention=${mention}, previous=${previous===ICE?'ice':'floor'}`,async()=>{
        await setup({typ:ICE});game.flags.mention_decor=mention;game.iflags.prev_decor=previous;
        assert.equal(await look(),ECMD_TIME);
        const text=messages(),forced=!mention||previous===ICE;
        assert.equal(text.includes('There is solid ice here.'),forced);
        assert.match(text,/You try to feel what is on it\./);
        if(forced)assert.ok(text.indexOf('solid ice here')<text.indexOf('feel what is on it'));
    });
test('blind levitating ice describes plain ice before the reach failure',async()=>{
    await setup({typ:ICE});game.u.intrinsic.HLevitation=FROMOUTSIDE;game.iflags.prev_decor=ICE;
    assert.equal(await look(),ECMD_OK);
    const text=messages();
    assert.match(text,/There is ice here\./);assert.doesNotMatch(text,/solid ice/);
    assert.ok(text.indexOf('ice here')<text.indexOf('feel what is on it'));
    assert.match(text,/But you can't reach it!/);
});
for(const [name,ttyp,seen,trapped,blocked] of [
    ['unseen pit',PIT,false,false,false],['seen pit edge',PIT,true,false,true],
    ['inside seen pit',PIT,true,true,false],['seen spiked pit',SPIKED_PIT,true,false,true],
    ['seen hole',HOLE,true,false,false],['unseen hole',HOLE,false,false,false],
    ['seen trapdoor',TRAPDOOR,true,false,false],['bear trap',BEAR_TRAP,true,false,false],
])test(`reach: ${name}`,async()=>{
    await setup();const trap=maketrap(x,y,ttyp);assert.ok(trap);trap.tseen=+seen;
    if(trapped){game.u.utrap=3;game.u.utraptype=TT_PIT;}
    const preliminaryReach=can_reach_floor(true);
    assert.equal(await look(),blocked?ECMD_OK:ECMD_TIME);
    assert.equal(messages().includes("But you can't reach it!"),blocked);
    assert.equal(messages().includes('You feel no objects here.'),!blocked);
    if(seen&&(ttyp===HOLE||ttyp===TRAPDOOR)){
        assert.equal(preliminaryReach,false,'the descriptive first reach call still checks shafts');
        assert.match(messages(),/lying beneath you/);
    }
});
test('ordinary levitation still blocks floor inspection',async()=>{
    await setup();game.u.intrinsic.HLevitation=FROMOUTSIDE;
    assert.equal(await look(),ECMD_OK);assert.match(messages(),/But you can't reach it!/);
});
for(const blind of [false,true])for(const quantity of [1,3])
    test(`single local object: blind=${blind}, quantity=${quantity}`,async()=>{
        await setup({blind});const obj=await object(ONAMES.DAGGER,{quan:quantity});
        const chain=game.level.objectsAt(x,y);
        assert.equal(await look(),blind?ECMD_TIME:ECMD_OK);
        assert.equal(game.iflags.last_msg,PLNMSG_ONE_ITEM_HERE);
        assert.deepEqual(game.level.objectsAt(x,y),chain,'inspection preserves local order and identity');
        assert.equal(obj.quan,quantity);
    });
for(const [name,count,pileLimit,picked] of [
    ['empty',0,5,false],['two local objects',0,5,false],
    ['summarized single object',1,1,false],['summarized remainder',2,1,true],
])test(`one-item marker exclusion: ${name}`,async()=>{
    await setup({blind:false});game.flags.pile_limit=pileLimit;
    if(name!=='empty')await object();
    if(name==='two local objects'||picked)await object(ONAMES.APPLE);
    assert.equal(await look(count,picked?LOOKHERE_PICKED_SOME:0),ECMD_OK);
    assert.notEqual(game.iflags.last_msg,PLNMSG_ONE_ITEM_HERE);
    if(picked)assert.match(messages(),/There are two more objects here\./);
});
test('feature skip flag retains the one-item marker',async()=>{
    await setup({blind:false,typ:FOUNTAIN});await object();
    await look(0,LOOKHERE_SKIP_DFEATURE);
    assert.doesNotMatch(messages(),/There is a fountain/);
    assert.equal(game.iflags.last_msg,PLNMSG_ONE_ITEM_HERE);
});
test('one-item marker is assigned after the real More prompt completes',async()=>{
    const run=await setup({blind:false});await object();
    await pline('The previous message is long enough to require acknowledgment before this item.');
    game.iflags.last_msg=0;
    let entered,release,timer;
    const waiting=new Promise(resolve=>{entered=resolve;});
    run._display.onEmptyQueue=()=>{entered();return new Promise(resolve=>{release=resolve;});};
    const pending=look_here(0,0);
    try{
        await Promise.race([waiting,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('More not reached')),2000);})]);
        assert.equal(game.iflags.last_msg,0,'bookkeeping cannot lead the message');
    }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;release?.(32);}
    assert.equal(await pending,ECMD_OK);assert.equal(game.iflags.last_msg,PLNMSG_ONE_ITEM_HERE);
});
for(const quantity of [1,3])test(`public timeout uses the item pronoun: quantity=${quantity}`,async()=>{
    await setup({blind:false});await object(ONAMES.DAGGER,{quan:quantity});
    await look();
    game.u.intrinsic.HFumbling=1;game.u.umoved=true;resetRng();
    await nh_timeout();
    assert.match(messages(),new RegExp('You trip over '+(quantity===1?'it':'them')+'\\.'));
    assert.deepEqual(getRngLog(),[],'one-shot fumbling has no renewal draw');
    assert.equal(game.multi,-2);
});
