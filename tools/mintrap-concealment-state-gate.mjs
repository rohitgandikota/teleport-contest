// C trap.c:3825-3837. Constructed states, real trap and concealment helpers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {GameMap} from '../js/game.js';
import {makemon,hideunder} from '../js/makemon.js';
import {mksobj,place_object} from '../js/mkobj.js';
import {maketrap} from '../js/mklev.js';
import {mintrap,closeholdingtrap,mon_learns_traps,
    Trap_Effect_Finished,Trap_Caught_Mon,Trap_Killed_Mon} from '../js/trap.js';
import {bhitm} from '../js/zap.js';
import {canseemon,canspotmon,pline,TOPLINE_EMPTY,TOPLINE_NEED_MORE} from '../js/display.js';
import {vision_reset,vision_recalc} from '../js/vision.js';
import {make_blinded} from '../js/potion.js';
import {resetInputState} from '../js/input.js';
import {initRng,enableRngLog,getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {ROOM,STONE,COLNO,ROWNO,NO_MINVENT,MM_NOGRP,MM_NOMSG,MM_MINVIS,
    BEAR_TRAP,WEB,PIT,FORCETRAP,NO_TRAP_FLAGS} from '../js/const.js';

const x=35,y=10;
function clearMessages() {
    game._toplin=TOPLINE_EMPTY;game._toplines='';game._prevmsg='';
    game._pending_message='';game._msg_history=[];
}
function resetRng() {initRng(14);enableRngLog();}
async function setup({species=P.PM_PIT_VIPER,trapType=BEAR_TRAP,hidden=true,invisible=false}={}) {
    const run=await runSegment({seed:7401,datetime:'20000112121000',moves:' ',
        storage:new InMemoryStorage(),
        nethackrc:'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'});
    game._preNhgetchHook=null;resetInputState();
    let acknowledgments=0;
    run._display.onEmptyQueue=()=>{assert.ok(++acknowledgments<=8);return 32;};
    game.level=new GameMap();game.worms={wheads:{},wtails:{},wgrowtime:{}};
    game.regions=[];game.timer_base=[];game.in_mklev=false;
    game.u.ux=30;game.u.uy=10;
    for(let xx=1;xx<COLNO;xx++)for(let yy=0;yy<ROWNO;yy++)
        Object.assign(game.level.at(xx,yy),{typ:xx>=28&&xx<=38&&yy>=8&&yy<=12?ROOM:STONE,
            lit:1,waslit:1,seenv:255,roomno:0});
    vision_reset();vision_recalc(0);
    const mon=await makemon(game.mons[species],x,y,
        NO_MINVENT|MM_NOGRP|MM_NOMSG|(invisible?MM_MINVIS:0));
    assert.ok(mon);mon.mhp=mon.mhpmax=60;
    mon.msleeping=1;mon.mpeaceful=0;
    const cover=mksobj(O.DAGGER,false,false);await place_object(cover,x,y);
    if(hidden)assert.equal(await hideunder(mon),true,'real hideunder establishes concealment before the trap');
    const trap=trapType===null?null:await maketrap(x,y,trapType);
    assert.equal(!!mon.mundetected,hidden,'placing the trap does not itself reveal the hider');
    assert.equal(!!mon.mtrapped,false);
    clearMessages();resetRng();
    return {mon,trap,cover,run};
}

for(const [label,type,draw] of [['bear trap',BEAR_TRAP,/^d\(2,4\)=/],
    ['web',WEB,null],['pit',PIT,/^rnd\(6\)=/]])test(`fresh ${label} reveals the living hider`,async()=>{
    const {mon}=await setup({trapType:type});
    assert.equal(canspotmon(mon),false);
    assert.equal(await mintrap(mon,FORCETRAP),Trap_Caught_Mon);
    assert.equal(mon.mundetected,0);assert.equal(mon.mtrapped,1);
    assert.equal(canseemon(mon),true);assert.equal(mon.msleeping,1,'mintrap does not wake the monster');
    assert.equal(game._prevmsg,'A pit viper appears.');
    const calls=getRngLog();assert.equal(calls.length,draw?1:0);
    if(draw)assert.match(calls[0],draw);
});

test('already sensed hider is revealed without an appearance message',async()=>{
    const {mon}=await setup();game.u.intrinsic.HDetect_monsters=30;
    assert.equal(canseemon(mon),false);assert.equal(canspotmon(mon),true);
    assert.equal(await mintrap(mon,FORCETRAP),Trap_Caught_Mon);
    assert.equal(mon.mundetected,0);assert.equal(canseemon(mon),true);
    assert.equal(game._prevmsg,'');
    assert.equal(getRngLog().length,1);
});
for(const mode of ['invisible','blind'])test(`${mode} hider loses cover without visible feedback`,async()=>{
    const {mon}=await setup({invisible:mode==='invisible'});
    if(mode==='blind')await make_blinded(20,false);
    clearMessages();resetRng();assert.equal(canspotmon(mon),false);
    assert.equal(await mintrap(mon,FORCETRAP),Trap_Caught_Mon);
    assert.equal(mon.mundetected,0);assert.equal(canseemon(mon),false);
    assert.equal(game._prevmsg,'');
});
test('visible target has trap feedback without appearing again',async()=>{
    const {mon}=await setup({hidden:false});assert.equal(canspotmon(mon),true);
    assert.equal(await mintrap(mon,FORCETRAP),Trap_Caught_Mon);
    assert.match(game._prevmsg,/is caught in a bear trap!/);
    assert.doesNotMatch(game._prevmsg,/appears/);assert.equal(!!mon.mundetected,false);
});
test('small hidden target evades the forced trap and stays hidden',async()=>{
    const {mon}=await setup({species:P.PM_GARTER_SNAKE});
    assert.equal(await mintrap(mon,FORCETRAP),Trap_Effect_Finished);
    assert.equal(mon.mundetected,1);assert.equal(!!mon.mtrapped,false);
    assert.equal(mon.mhp,60);assert.equal(game._prevmsg,'');assert.deepEqual(getRngLog(),[]);
});
test('fatal trap never announces a dead monster appearing',async()=>{
    const {mon}=await setup();mon.mhp=1;
    assert.equal(await mintrap(mon,FORCETRAP),Trap_Killed_Mon);
    assert.ok(mon.mhp<=0);assert.ok(!game.level.monsters.includes(mon));
    assert.doesNotMatch(game._prevmsg,/appears/);
});
test('no trap leaves an ordinary sheltered monster hidden',async()=>{
    const {mon}=await setup({trapType:null});
    assert.equal(await mintrap(mon,NO_TRAP_FLAGS),Trap_Effect_Finished);
    assert.equal(mon.mundetected,1);assert.equal(mon.mtrapped,0);
    assert.deepEqual(getRngLog(),[]);assert.equal(game._prevmsg,'');
});
test('remembered trap avoidance returns before concealment cleanup',async()=>{
    const {mon}=await setup();mon_learns_traps(mon,BEAR_TRAP);
    initRng(1);enableRngLog();
    assert.equal(await mintrap(mon,NO_TRAP_FLAGS),Trap_Effect_Finished);
    assert.equal(mon.mundetected,1);assert.equal(!!mon.mtrapped,false);
    assert.equal(getRngLog().length,1);assert.match(getRngLog()[0],/^rn2\(4\)=[123]$/);
    assert.equal(game._prevmsg,'');
});
test('already caught retry does not repeat the appearance message',async()=>{
    const {mon}=await setup({hidden:false});
    assert.equal(await mintrap(mon,FORCETRAP),Trap_Caught_Mon);
    clearMessages();resetRng();
    const result=await mintrap(mon,NO_TRAP_FLAGS);
    assert.equal(result,mon.mtrapped?Trap_Caught_Mon:Trap_Effect_Finished);
    assert.match(getRngLog()[0],/^rn2\(40\)=/);
    assert.doesNotMatch(game._prevmsg,/appears/);
});

for(const route of ['mintrap','closeholdingtrap','bhitm'])test(`${route} awaits the appearance message before completing`,async()=>{
    const {mon,run}=await setup();const wand=mksobj(O.WAN_LOCKING,false,false);
    const noticed={v:false};game.bhitpos={x,y};
    await pline('A prior message leaves too little room for another message.');
    assert.equal(game._toplin,TOPLINE_NEED_MORE);assert.equal(game._topl_cury,0);
    let entered,release,finished=false;
    const waiting=new Promise(resolve=>{entered=resolve;});
    run._display.onEmptyQueue=()=>{entered();return new Promise(resolve=>{release=resolve;});};
    resetRng();
    const operation=route==='mintrap'?mintrap(mon,FORCETRAP)
        :route==='closeholdingtrap'?closeholdingtrap(mon,noticed):bhitm(mon,wand);
    const pending=operation.then(value=>{finished=true;return value;});
    let timer;
    try {
        await Promise.race([waiting,pending.then(()=>{throw Error('completed before the appearance acknowledgment');}),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('More prompt not reached')),2000);})]);
        await setImmediate();
        assert.equal(finished,false);assert.equal(mon.mtrapped,1);assert.equal(mon.mundetected,0);
        assert.equal(mon.msleeping,1,'outer wand wakeup is still pending');
        assert.equal(game.nhDisplay.grid[y+1][x-1].ch,'S','unhidden snake is redrawn before feedback waits');
        assert.ok(game.nhDisplay.grid.some(row=>row.map(c=>c.ch).join('').includes('--More--')));
    } finally {
        clearTimeout(timer);run._display.onEmptyQueue=()=>32;release?.(32);await pending;
    }
    assert.equal(await pending,route==='mintrap'?Trap_Caught_Mon:route==='closeholdingtrap'?true:0);
    assert.equal(mon.msleeping,route==='bhitm'?0:1);
    if(route==='closeholdingtrap')assert.equal(noticed.v,true);
});
