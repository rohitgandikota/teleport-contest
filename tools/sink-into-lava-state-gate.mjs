// Normal-import, real-producer source controls. These are not native evidence.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {readobjnam} from '../js/objnam.js';
import {addinv} from '../js/invent.js';
import {setworn} from '../js/worn.js';
import {Ring_on,Ring_off,accessory_or_armor_on} from '../js/do_wear.js';
import {peffects,make_slimed,make_stoned} from '../js/potion.js';
import {delayed_killer,find_delayed_killer} from '../js/end.js';
import {sink_into_lava,lava_effects,dotrap} from '../js/trap.js';
import {maketrap} from '../js/mklev.js';
import {set_levltyp} from '../js/mkmaze.js';
import {teleds} from '../js/teleport.js';
import {m_at,t_at} from '../js/mon.js';
import {trapmove,unmul} from '../js/hack.js';
import {dopray} from '../js/pray.js';
import {Levitation,Flying,Fire_resistance} from '../js/youprop.js';
import {pline,tty_clear_nhwindow_message} from '../js/display.js';
import {remember_topl} from '../js/tty/topl.js';
import {initRng,enableRngLog,getRngLog} from '../js/rng.js';
import * as C from '../js/const.js';

const rc='OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
    +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist,!safe_wait,!debug_mongen\n'
    +'OPTIONS=suppress_alert:3.4.3\nOPTIONS=!eight_bit_tty\nOPTIONS=symset:plain\n';
const reports=[];
const clear=()=>tty_clear_nhwindow_message(game._topl_cury||0);
const seed=()=>{initRng(7);enableRngLog();};
function killers(){const list=[];for(let k=game.killer?.next;k;k=k.next)list.push({id:k.id,format:k.format,name:k.name});return list;}
function state(){return {xy:[game.u.ux,game.u.uy],terrain:game.level.at(game.u.ux,game.u.uy).typ,
    trap:game.u.utrap||0,traptype:game.u.utraptype||0,hp:game.u.uhp,mortality:game.u.umortality||0,
    moved:!!game.u.umoved,invulnerable:!!game.u.uinvulnerable,slimed:game.u.uprops?.SLIMED||0,
    stoned:game.u.uprops?.STONED||0,hLev:game.u.intrinsic?.HLevitation||0,eLev:game.u.uprops?.LEVITATION||0,
    bLev:game.u.blocked?.LEVITATION||0,bFly:game.u.blocked?.FLYING||0,lev:Levitation(),fly:Flying(),
    killer:{id:game.killer?.id,format:game.killer?.format,name:game.killer?.name},killers:killers(),
    gameover:!!game.program_state.gameover,top:game._toplines||''};}
function since(start){const rows=game.iflags.msg_history||20,end=game._msg_maxrow||0;
    return [...Array((end-start+rows)%rows)].map((_,i)=>game._msg_history[(start+i)%rows])
        .concat(game._toplines||'').filter(Boolean);}
function adjacent(){const {ux,uy}=game.u;const pos=[[ux+1,uy],[ux-1,uy],[ux,uy+1],[ux,uy-1]]
    .find(([x,y])=>game.level.at(x,y).typ===C.ROOM&&!m_at(x,y)&&!t_at(x,y));assert.ok(pos);return pos;}
async function setup(){const run=await runSegment({seed:9770,datetime:'20000112093000',nethackrc:rc,
    moves:' #levelchange\r30\r'+' '.repeat(29),storage:new InMemoryStorage()});
    let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<500);return 32;};
    await teleds(...adjacent(),0);clear();return run;}
async function item(name){return addinv(await readobjnam(name,null,false));}
async function wear(name,ring=false){const o=await item('uncursed '+name);
    if(ring){await setworn(o,C.W_RINGR);await Ring_on(o);}
    else{await accessory_or_armor_on(o);if(game.afternmv)await unmul('');}
    assert.ok(o.owornmask);clear();return o;}
async function lava(){const ring=await wear('ring of fire resistance',true);
    assert.ok(set_levltyp(game.u.ux,game.u.uy,C.LAVAPOOL));await lava_effects();
    assert.ok(game.u.utrap>512);assert.equal(game.u.utraptype,C.TT_LAVA);clear();return ring;}
async function slime(amount){await make_slimed(amount,null);
    if(amount)delayed_killer(C.SLIMED,C.KILLED_BY_AN,'green slime');}
async function latent(kind){if(kind==='levitation')await peffects(await item('blessed potion of levitation'));
    else if(kind==='flight')await wear('amulet of flying');clear();
    if(kind==='levitation'){assert.ok(game.u.blocked.LEVITATION&C.I_SPECIAL);assert.ok(!Levitation());}
    if(kind==='flight'){assert.ok(game.u.blocked.FLYING&C.I_SPECIAL);assert.ok(!Flying());}}
async function nearFatal(){let n=0;while(game.u.utrap>=512){assert.ok(++n<20);clear();await sink_into_lava();}
    assert.ok(game.u.utrap>=256);clear();}
async function act(r){clear();remember_topl();seed();const start=game._msg_maxrow||0;
    r.before=state();const root=game.killer,display=game.nhDisplay,input=display.onEmptyQueue;r.waits=[];
    display.onEmptyQueue=(...args)=>{r.waits.push({...state(),screen:display.terminal.serialize()});return input(...args);};
    try{await sink_into_lava();}finally{display.onEmptyQueue=input;}r.after=state();
    r.rootPreserved=game.killer===root;r.messages=since(start);r.rng=[...getRngLog()];}
async function check(name,fn){await test(name,async()=>{const r={name};try{await fn(r);assert.ok(!game.program_state.gameover);r.pass=true;}
    catch(error){r.pass=false;r.error=error.stack;throw error;}finally{r.final=state();reports.push(r);}});}

for(const kind of ['no trap','other trap'])await check(`guard: ${kind}`,async r=>{
    await setup();if(kind==='other trap')await dotrap(await maketrap(game.u.ux,game.u.uy,C.WEB),C.FORCETRAP);
    await slime(1);await act(r);assert.equal(r.after.slimed,1);assert.equal(r.after.trap,r.before.trap);
    assert.deepEqual(r.rng,[]);assert.deepEqual(r.messages,[]);assert.ok(r.rootPreserved);
});
for(const amount of [0,1,10,100])await check(`stationary slime timeout ${amount}`,async r=>{
    await setup();await lava();await slime(amount);await act(r);
    assert.equal(r.rng.length,amount?2:1);assert.match(r.rng.at(-1),/^rnd\(4\)=/);
    if(amount)assert.match(r.rng[0],/^rnd\(9\)=/);
    assert.equal(r.after.slimed,amount===1?0:amount);
    assert.equal(r.after.trap,r.before.trap-256+Number(r.rng.at(-1).split('=')[1]));
    assert.equal(r.after.hp,r.before.hp);assert.ok(r.rootPreserved);
    assert.equal(!!find_delayed_killer(C.SLIMED),amount>1);
    if(amount===1)assert.ok(r.messages.join('\n').indexOf('sink deeper')<r.messages.join('\n').indexOf('burned away'));
});
for(const amount of [0,1,100])await check(`moving suppresses slime draw ${amount}`,async r=>{
    await setup();await lava();await slime(amount);await trapmove(...adjacent(),null);
    assert.ok(game.u.umoved);await act(r);assert.deepEqual(r.rng,[]);assert.deepEqual(r.messages,[]);
    assert.equal(r.after.trap,r.before.trap-256);assert.equal(r.after.slimed,amount);
});
for(const amount of [0,1])await check(`repeated sinking message, slime ${amount}`,async r=>{
    await setup();await lava();await slime(amount);clear();await pline('You sink deeper into the lava.');
    clear();remember_topl();seed();const start=game._msg_maxrow||0;r.before=state();await sink_into_lava();
    r.after=state();r.messages=since(start);r.rng=[...getRngLog()];
    if(amount){assert.ok(r.messages.some(s=>s.includes('You sink deeper into the lava.')));assert.equal(r.after.slimed,0);}
    else assert.deepEqual(r.messages,[]);
});
for(const kind of ['none','levitation','flight'])await check(`non-lava reset ${kind}`,async r=>{
    await setup();await lava();await latent(kind);set_levltyp(game.u.ux,game.u.uy,C.ROOM);await slime(1);await act(r);
    assert.equal(r.after.trap,0);assert.equal(r.after.traptype,C.TT_NONE);assert.equal(r.after.slimed,1);
    assert.deepEqual(r.rng,[]);assert.deepEqual(r.messages,[]);
    if(kind==='levitation'){assert.ok(r.after.lev);assert.equal(r.after.bLev,0);}
    if(kind==='flight'){assert.ok(r.after.fly);assert.equal(r.after.bFly,0);}
});
await check('successful prayer blocks sinking and slime',async r=>{
    const run=await setup();await lava();await slime(1);
    let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<30);
        return run._display.terminal.serialize().includes('--More--')?32:121;};
    await dopray();assert.ok(game.u.uinvulnerable);
    await act(r);assert.equal(r.after.trap,r.before.trap);assert.equal(r.after.slimed,1);
    assert.equal(r.after.hp,r.before.hp);assert.deepEqual(r.rng,[]);assert.deepEqual(r.messages,[]);
});
await check('lost fire resistance divides HP before sinking',async r=>{
    await setup();const ring=await lava();await Ring_off(ring);assert.ok(!Fire_resistance());
    await act(r);assert.equal(r.after.hp,Math.trunc((r.before.hp+2)/3));assert.equal(r.rng.length,1);
});
for(const kind of ['none','levitation','flight'])await check(`fatal survival and source restoration ${kind}`,async r=>{
    await setup();await lava();await nearFatal();
    if(kind!=='flight')await wear('amulet of life saving');
    if(kind==='levitation')await latent(kind);
    if(kind==='flight')await latent('flight'); // real wizard refusal of death
    await make_stoned(100,null,C.KILLED_BY_AN,'cockatrice');await slime(100);
    await act(r);assert.ok(r.rootPreserved);assert.equal(r.after.killer.id,0);
    assert.equal(r.after.slimed,0);assert.equal(r.after.stoned,100);assert.ok(find_delayed_killer(C.STONED));
    assert.ok(!find_delayed_killer(C.SLIMED));assert.equal(r.after.trap,0);assert.equal(r.after.mortality,1);
    const text=r.messages.join('\n');
    if(kind==='flight'){
        const burnWait=r.waits.find(s=>s.top.includes('sink below')&&!s.slimed&&s.killers.some(k=>k.id===C.SLIMED));
        const burnShown=r.waits.find(s=>s.screen.includes('The slime that covers you is burned away!--More--'));
        const decision=r.waits.find(s=>s.screen.includes('Die? [yn] (n)'));
        assert.ok(burnWait&&burnShown&&decision);
        assert.ok(r.waits.indexOf(burnWait)<r.waits.indexOf(burnShown));
        assert.ok(r.waits.indexOf(burnShown)<r.waits.indexOf(decision));
        assert.ok(burnWait.screen.includes('--More--'));assert.equal(burnWait.mortality,0);
        assert.equal(decision.slimed,0);assert.equal(decision.mortality,1);
        assert.deepEqual(decision.killers.map(k=>k.id),[C.STONED]);
        assert.match(text,/OK, so you don't die/);
    }else{
        assert.ok(text.indexOf('sink below')<text.indexOf('burned away'));
        assert.ok(text.indexOf('burned away')<text.indexOf('But wait'));
    }
    if(kind==='none')assert.notDeepEqual(r.after.xy,r.before.xy);
    else{assert.deepEqual(r.after.xy,r.before.xy);assert.ok(r.after.lev||r.after.fly);}
});
for(const fatal of [false,true])await check(`pending More orders burn and continuation, fatal ${fatal}`,async r=>{
    const run=await setup();await lava();if(fatal){await nearFatal();await wear('amulet of life saving');}
    await make_stoned(100,null,C.KILLED_BY_AN,'cockatrice');await slime(fatal?100:1);
    clear();await pline('An earlier message fills the line before the next source-owned action begins.');
    let release,paused,done=false;const atPause=new Promise(resolve=>{paused=resolve;});
    run._display.onEmptyQueue=()=>{paused('paused');return new Promise(resolve=>{release=resolve;});};
    seed();r.before=state();const root=game.killer,action=sink_into_lava().then(()=>{done=true;});
    try{assert.equal(await Promise.race([atPause,action.then(()=>'completed')]),'paused');await setImmediate();
        assert.equal(done,false);r.pending=state();r.pendingRng=[...getRngLog()];
        assert.equal(r.pending.trap,r.before.trap-256);assert.equal(r.pending.slimed,r.before.slimed);
        assert.equal(game.killer,root);assert.deepEqual(r.pending.killers,r.before.killers);
        if(fatal){assert.deepEqual(r.pendingRng,[]);assert.equal(r.pending.killer.name,'molten lava');assert.equal(r.pending.mortality,0);}
        else{assert.equal(r.pendingRng.length,1);assert.match(r.pendingRng[0],/^rnd\(9\)=/);}
    }finally{let reads=0;r.later=[];run._display.onEmptyQueue=async()=>{assert.ok(++reads<40);
        r.later.push({...state(),rng:[...getRngLog()]});await setImmediate();return 32;};release?.(32);await action;}
    r.after=state();r.rng=[...getRngLog()];assert.equal(r.after.slimed,0);assert.ok(find_delayed_killer(C.STONED));
    assert.ok(!find_delayed_killer(C.SLIMED));
    assert.ok(r.later.some(s=>!s.slimed&&s.killers.some(k=>k.id===C.SLIMED)&&s.mortality===0),
        'slime timer clears before burn feedback, delayed killer unlinks after the real More');
    if(!fatal)assert.equal(r.rng.length,2);
});
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({evidence:'Constructed real-producer source controls; not native parity',reports},null,2)+'\n');
