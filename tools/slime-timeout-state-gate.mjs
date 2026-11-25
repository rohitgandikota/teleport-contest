// Normal imports. Boundary controls are labelled separately from ordinary inputs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {make_slimed,make_stoned,itimeout} from '../js/potion.js';
import {cprefx} from '../js/eat.js';
import {nh_timeout,burn_away_slime,fall_asleep} from '../js/timeout.js';
import {delayed_killer,find_delayed_killer} from '../js/end.js';
import {teleds} from '../js/teleport.js';
import {m_at,t_at} from '../js/mon.js';
import {getRngLog} from '../js/rng.js';
import {Unaware} from '../js/youprop.js';
import {pline,bot,newsym,glyph_at,tty_clear_nhwindow_message,flush_screen} from '../js/display.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import * as C from '../js/const.js';

const rc='OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
    +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist,!safe_wait,!debug_mongen\n'
    +'OPTIONS=suppress_alert:3.4.3\nOPTIONS=!eight_bit_tty\nOPTIONS=symset:plain\n';
const reports=[];
const clear=()=>tty_clear_nhwindow_message(game._topl_cury||0);
const text=s=>decodeScreen(s).map(row=>row.map(renderCell).join('')).join('\n');
function state(){const killers=[];for(let k=game.killer?.next;k;k=k.next)killers.push({id:k.id,format:k.format,name:k.name});
    return {slimed:game.u.uprops?.SLIMED||0,stoned:game.u.uprops?.STONED||0,
        ap:game.youmonst.m_ap_type||0,appearance:game.youmonst.mappearance||0,form:game.u.umonnum,
        glyph:{...glyph_at(game.u.ux,game.u.uy)},killers,botl:!!game.disp.botl,
        mortality:game.u.umortality||0,top:game._toplines||'',screen:game.nhDisplay.terminal.serialize()};}
async function setup(){const run=await runSegment({seed:9770,datetime:'20000112093000',nethackrc:rc,
    moves:' #levelchange\r30\r'+' '.repeat(29),storage:new InMemoryStorage()});
    let n=0;run._display.onEmptyQueue=()=>{assert.ok(++n<200);return 32;};
    const {ux,uy}=game.u,pos=[[ux+1,uy],[ux-1,uy],[ux,uy+1],[ux,uy-1]]
        .find(([x,y])=>game.level.at(x,y).typ===C.ROOM&&!m_at(x,y)&&!t_at(x,y));
    assert.ok(pos);await teleds(...pos,0);clear();await bot();return run;}
async function food(){await cprefx(P.PM_GREEN_SLIME);assert.equal(game.u.uprops.SLIMED,10);
    assert.deepEqual(state().killers,[{id:C.SLIMED,format:C.KILLED_BY_AN,name:''}]);clear();}
async function act(r,value,msg=null){await bot();assert.equal(!!game.disp.botl,false);r.before=state();
    const root=game.killer,start=getRngLog().length;await make_slimed(value,msg);r.after=state();
    r.rng=getRngLog().slice(start);assert.deepEqual(r.rng,[]);assert.equal(game.killer,root);}
async function pause(action,predicate){const display=game.nhDisplay,old=display.onEmptyQueue,waits=[];
    let resume,entered,settled=false;const ready=new Promise(resolve=>{entered=resolve;});
    display.onEmptyQueue=()=>{const s=state();waits.push(s);assert.ok(waits.length<100);
        if(predicate(s))return new Promise(resolve=>{resume=resolve;entered(s);});return 32;};
    const task=action().then(()=>{settled=true;});
    let pending;
    try{pending=await Promise.race([ready,task.then(()=>{throw new Error('expected real pending boundary');})]);}
    catch(error){display.onEmptyQueue=old;throw error;}
    await setImmediate();assert.equal(settled,false);
    return {pending,waits,async finish(key=32){display.onEmptyQueue=old;resume(key);await task;}};
}
async function check(name,fn){await test(name,async()=>{const r={name};try{await fn(r);r.pass=true;}
    catch(error){r.pass=false;r.error=error.stack;throw error;}finally{reports.push(r);}});}

for(const [value,expected] of [[-1,0],[0,0],[1,1],[10,10],[16777214,16777214],
    [16777215,16777215],[16777216,16777215],[2147483647,16777215]])
await check('immediate itimeout boundary '+value,async r=>{r.actual=itimeout(value);assert.equal(r.actual,expected);});

for(const old of [0,10])for(const [value,expected] of [[-1,0],[0,0],[1,1],[100,100],
    [16777215,16777215],[16777216,16777215],[2147483647,16777215]])
await check(`setter boundary old ${old}, argument ${value}`,async r=>{
    await setup();if(old)await food();await act(r,value);
    assert.equal(r.after.slimed,expected);
    // C tests the supplied argument, not the clamped result, for feedback/status.
    assert.equal(r.after.botl,(value!==0)!==(old!==0));
    assert.equal(!!find_delayed_killer(C.SLIMED),!!(old&&expected));
});

await check('real food producer and unrelated delayed killer cleanup',async r=>{
    await setup();await food();await make_stoned(100,null,C.KILLED_BY_AN,'cockatrice');
    await act(r,0);assert.equal(r.after.slimed,0);assert.equal(r.after.stoned,100);
    assert.deepEqual(r.after.killers,[{id:C.STONED,format:C.KILLED_BY_AN,name:'cockatrice'}]);
});
await check('stale delayed node cleanup when already absent',async r=>{
    await setup();delayed_killer(C.SLIMED,C.KILLED_BY_AN,'');
    await make_stoned(100,null,C.KILLED_BY_AN,'cockatrice');await act(r,0);
    assert.equal(r.after.botl,false);assert.equal(r.after.slimed,0);
    assert.deepEqual(r.after.killers,[{id:C.STONED,format:C.KILLED_BY_AN,name:'cockatrice'}]);
});
await check('nonzero retiming keeps cause and suppresses transition message',async r=>{
    await setup();await food();await act(r,20,'The slime disappears.');
    assert.equal(r.after.slimed,20);assert.equal(r.after.botl,false);
    assert.deepEqual(r.after.killers,r.before.killers);assert.equal(r.after.top,r.before.top);
});
await check('slime feedback is retained while unaware',async r=>{
    await setup();await food();await fall_asleep(-3,false);assert.ok(Unaware());clear();
    await act(r,0,'The slime disappears.');assert.ok(r.after.top.includes('The slime disappears.'));
    assert.equal(r.after.slimed,0);assert.deepEqual(r.after.killers,[]);
});

for(const stopping of [false,true])await check('pending More orders timer and cleanup, stopping '+stopping,async r=>{
    await setup();if(stopping){await food();await make_stoned(100,null,C.KILLED_BY_AN,'cockatrice');}
    await bot();clear();await pline('Existing feedback occupies the message row before the next slime feedback.');
    const start=getRngLog().length,root=game.killer;
    const hold=await pause(()=>stopping?burn_away_slime():make_slimed(100,'You are turning into slime.'),()=>true);
    r.pending=hold.pending;
    try{
        assert.ok(r.pending.screen.includes('--More--'));assert.equal(r.pending.slimed,stopping?0:100);
        assert.equal(!!find_delayed_killer(C.SLIMED),stopping);
        assert.equal(text(r.pending.screen).includes(' Slime'),!stopping);
    }finally{await hold.finish();}
    r.after=state();assert.equal(game.killer,root);assert.deepEqual(getRngLog().slice(start),[]);
    assert.ok(!find_delayed_killer(C.SLIMED));assert.equal(r.after.slimed,stopping?0:100);
    if(stopping)assert.deepEqual(r.after.killers,[{id:C.STONED,format:C.KILLED_BY_AN,name:'cockatrice'}]);
});

for(const flags of [false,true])await check('real slime appearance cleanup, constructed type flag '+flags,async r=>{
    await setup();await food();await make_slimed(1,null);clear();
    await pline('Existing feedback occupies the message row before the next slime feedback.');
    const hold=await pause(()=>nh_timeout(),s=>C.M_AP_TYPE({m_ap_type:s.ap})===C.M_AP_MONSTER&&s.appearance===P.PM_GREEN_SLIME);
    r.pending=hold.pending;
    try{
        assert.equal(r.pending.slimed,1);assert.equal(r.pending.mortality,0);
        assert.equal(r.pending.glyph.glyphnum,P.PM_GREEN_SLIME+C.GLYPH_MON_MALE_OFF);
        if(flags)game.youmonst.m_ap_type|=C.M_AP_F_DKNOWN; // explicit constructed header-bit boundary, not ordinary reach
        await act(r,0);assert.equal(r.after.ap,C.M_AP_NOTHING);assert.equal(r.after.appearance,0);
        assert.equal(r.after.slimed,0);assert.deepEqual(r.after.killers,[]);
        // make_slimed changes appearance fields, not the glyph buffer itself.
        assert.equal(r.after.glyph.glyphnum,r.pending.glyph.glyphnum);
        newsym(game.u.ux,game.u.uy);await flush_screen(1);r.redrawn=state();
        assert.equal(r.redrawn.glyph.glyphnum,game.u.umonnum+C.GLYPH_MON_MALE_OFF);
    }finally{await hold.finish();}
    assert.equal(game.u.umortality||0,0);
});

for(const value of [0,1,16777216])await check('real done_timeout flag, constructed setter call '+value,async r=>{
    await setup();await food();await make_slimed(1,null);clear();
    const hold=await pause(()=>nh_timeout(),s=>s.slimed===C.I_SPECIAL&&s.screen.includes('Die?'));
    r.pending=hold.pending;
    try{
        assert.equal(r.pending.form,P.PM_GREEN_SLIME);assert.equal(r.pending.mortality,1);
        // The flag is produced by done_timeout. These nested setter/cause calls
        // are constructed source boundaries, not a keyboard-reachable overlap.
        delayed_killer(C.SLIMED,C.KILLED_BY_AN,'');
        await make_stoned(100,null,C.KILLED_BY_AN,'cockatrice');await act(r,value);
        const expected=value===0?C.I_SPECIAL:value===1?C.I_SPECIAL|1:C.I_SPECIAL|C.TIMEOUT;
        assert.equal(r.after.slimed,expected);assert.ok(find_delayed_killer(C.SLIMED));
        assert.ok(find_delayed_killer(C.STONED));
    }finally{await hold.finish(110);}
    r.finished=state();assert.equal(r.finished.slimed,value===16777216?C.TIMEOUT:value);
});
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({evidence:'Real-producer constructed source controls; flagged and nested boundaries explicitly qualified',reports},null,2)+'\n');
