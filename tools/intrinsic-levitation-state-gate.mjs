// Real producers and normal owner imports. Constructed controls, not C recordings.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {wiz_intrinsic} from '../js/wizcmds.js';
import {peffects,make_confused,make_slimed,make_deaf,make_stunned,incr_itimeout} from '../js/potion.js';
import {readobjnam} from '../js/objnam.js';
import {addinv} from '../js/invent.js';
import {setworn} from '../js/worn.js';
import {Ring_on} from '../js/do_wear.js';
import {polymon} from '../js/polyself.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {dotrap} from '../js/trap.js';
import {maketrap} from '../js/mklev.js';
import {teleds} from '../js/teleport.js';
import {m_at,t_at} from '../js/mon.js';
import {nh_timeout} from '../js/timeout.js';
import {getRngLog} from '../js/rng.js';
import {Levitation} from '../js/youprop.js';
import {tty_clear_nhwindow_message} from '../js/display.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import * as C from '../js/const.js';

const rc='OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
    +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist,!safe_wait,!debug_mongen\n'
    +'OPTIONS=suppress_alert:3.4.3\nOPTIONS=!eight_bit_tty\nOPTIONS=symset:plain\n';
const reports=[];
const clear=()=>tty_clear_nhwindow_message(game._topl_cury||0);
const lines=s=>decodeScreen(s).map(row=>row.map(renderCell).join('').trimEnd());
function state(){return {h:game.u.intrinsic?.HLevitation||0,e:game.u.uprops?.LEVITATION||0,
    blocked:game.u.blocked?.LEVITATION||0,flyingBlocked:game.u.blocked?.FLYING||0,
    lev:Levitation(),trap:game.u.utrap||0,traptype:game.u.utraptype||0,
    fallback:game.u.wiz_intrinsic_timeouts?.LEVITATION??null,
    base:game.u.wiz_intrinsic_base_props?.LEVITATION??null,top:game._toplines||''};}
async function setup(){const run=await runSegment({seed:9770,datetime:'20000112093000',nethackrc:rc,
    moves:' #levelchange\r30\r'+' '.repeat(29),storage:new InMemoryStorage()});
    let n=0;run._display.onEmptyQueue=()=>{assert.ok(++n<100);return 32;};
    const {ux,uy}=game.u,pos=[[ux+1,uy],[ux-1,uy],[ux,uy+1],[ux,uy-1]]
        .find(([x,y])=>game.level.at(x,y).typ===C.ROOM&&!m_at(x,y)&&!t_at(x,y));
    assert.ok(pos);await teleds(...pos,0);clear();return run;}
async function item(name){return addinv(await readobjnam(name,null,false));}
async function potion(blessed=true){await peffects(await item((blessed?'blessed':'uncursed')+' potion of levitation'));clear();}
async function ring(){const obj=await item('uncursed ring of levitation');await setworn(obj,C.W_RINGL);await Ring_on(obj);clear();}
async function block(){await dotrap(await maketrap(game.u.ux,game.u.uy,C.WEB),C.FORCETRAP);clear();}
async function menu(keys,late=false){clear();const start=getRngLog().length,waits=[];let used=0;
    const display=game.nhDisplay,old=display.onEmptyQueue;
    display.onEmptyQueue=async()=>{waits.push({...state(),screen:display.terminal.serialize()});
        if(late)await setImmediate();
        if(used===keys.length){assert.ok(waits.length<=keys.length+3);
            assert.ok(display.terminal.serialize().includes('--More--'),'only actual More completion after menu');return 32;}
        return keys.charCodeAt(used++);};
    try{assert.equal(await wiz_intrinsic(),C.ECMD_OK);}finally{display.onEmptyQueue=old;}
    assert.equal(used,keys.length);return {waits,rng:getRngLog().slice(start),after:state()};}
function row(result,name){const page=result.waits.find(w=>lines(w.screen).some(l=>l.includes(' - '+name)));
    assert.ok(page,'real menu contains '+name);return lines(page.screen).find(l=>l.includes(' - '+name));}
async function check(name,fn){await test(name,async()=>{const r={name};try{await fn(r);r.pass=true;}
    catch(error){r.pass=false;r.error=error.stack;throw error;}finally{reports.push(r);}});}

for(const kind of ['none','blessed','uncursed','blocked','ring','form','potion and ring'])
await check('menu reads real '+kind+' producer',async r=>{
    await setup();if(kind==='blocked')await block();
    if(['blessed','blocked','potion and ring'].includes(kind))await potion();
    if(kind==='uncursed')await potion(false);
    if(kind==='ring'||kind==='potion and ring')await ring();
    if(kind==='form'){await polymon(P.PM_FLOATING_EYE);clear();}
    r.before=state();r.menu=await menu('\x1b');const text=row(r.menu,'levitating');
    const t=r.before.h&C.TIMEOUT;
    if(t)assert.ok(text.endsWith('['+t+']'),text);else assert.ok(!text.includes('['),text);
    assert.deepEqual({...r.menu.after,top:''},{...r.before,top:''});assert.deepEqual(r.menu.rng,[]);
    if(kind==='blocked'){assert.equal(r.before.blocked,C.I_SPECIAL);assert.equal(r.before.lev,false);}
    if(kind==='blessed')assert.ok(r.before.h&C.I_SPECIAL);
    if(kind==='form'){assert.ok(r.before.h&C.FROMFORM);assert.equal(t,0);}
    if(kind==='ring')assert.equal(r.before.e,C.W_RINGL);
});
for(const kind of ['fresh','blessed','blocked','ring','clamp'])
await check('selection updates canonical timer '+kind,async r=>{
    await setup();if(kind==='blocked')await block();
    if(['blessed','blocked','clamp'].includes(kind))await potion();if(kind==='ring')await ring();
    r.before=state();const amount=kind==='clamp'?C.TIMEOUT:7;
    r.menu=await menu(String(amount)+'q\r');r.after=state();
    const expected=Math.min(C.TIMEOUT,(r.before.h&C.TIMEOUT)+amount);
    assert.equal(r.after.h,(r.before.h&~C.TIMEOUT)|expected);
    assert.equal(r.after.e,r.before.e);assert.equal(r.after.fallback,null);assert.equal(r.after.base,null);
    assert.equal(r.after.blocked,kind==='blocked'?C.I_SPECIAL:0);
    assert.equal(r.after.flyingBlocked,C.I_SPECIAL);assert.deepEqual(r.menu.rng,[]);
    const completed=r.menu.waits.find(w=>w.screen.includes('--More--'));
    assert.ok(completed);assert.equal(completed.h,r.after.h);
    assert.equal(completed.flyingBlocked,C.I_SPECIAL);
    const text=r.menu.waits.map(w=>w.screen).join('')+r.after.top;
    assert.ok(text.includes('Timeout for levitating '+((r.before.h&C.TIMEOUT)?'increased by':'set to')+' '+amount+'.'));
    r.reopen=await menu('\x1b',true);assert.ok(row(r.reopen,'levitating').endsWith('['+expected+']'));
});
await check('selected timer expires through real nh_timeout',async r=>{
    await setup();r.menu=await menu('1q\r');assert.equal(game.u.intrinsic.HLevitation,1);
    clear();await nh_timeout();r.after=state();assert.equal(r.after.h,0);assert.equal(r.after.lev,false);
    assert.equal(r.after.flyingBlocked,0);assert.equal(r.after.fallback,null);assert.equal(r.after.e,0);
});
await check('pending menu and deferred cancel preserve real timer',async r=>{
    await setup();await potion();r.before=state();let release,entered;
    const waiting=new Promise(resolve=>{entered=resolve;}),display=game.nhDisplay,old=display.onEmptyQueue;
    let settled=false;display.onEmptyQueue=()=>new Promise(resolve=>{release=resolve;entered();});
    const start=getRngLog().length,action=wiz_intrinsic().then(()=>{settled=true;});
    await waiting;await setImmediate();r.pending={...state(),screen:display.terminal.serialize()};
    assert.equal(settled,false);assert.equal(r.pending.h,r.before.h);
    const expected='['+(r.before.h&C.TIMEOUT)+']';
    try{assert.ok(lines(r.pending.screen).some(l=>l.includes(' - levitating')&&l.endsWith(expected)));}
    finally{release(27);await action;display.onEmptyQueue=old;}
    r.after=state();assert.deepEqual({...r.after,top:''},{...r.before,top:''});assert.deepEqual(getRngLog().slice(start),[]);
});
for(const [name,produce] of [['confused',()=>make_confused(23,false)],['deafness',()=>make_deaf(23,false)],
    ['stunned',()=>make_stunned(23,false)],['becoming slime',()=>make_slimed(23,null)]])
await check('unchanged dedicated reader '+name,async r=>{
    await setup();await produce();r.menu=await menu('\x1b');assert.ok(row(r.menu,name).endsWith('[23]'));
    assert.deepEqual(r.menu.rng,[]);
});
for(const [name,key,letter] of [['acid resistance','HAcid_resistance','c'],['stoning resistance','HStone_resistance','d']]){
    await check('unchanged shared arm reader '+name,async r=>{
        await setup();incr_itimeout(key,23);r.menu=await menu('>\x1b');
        assert.ok(row(r.menu,name).endsWith('[23]'));assert.equal(game.u.intrinsic[key],23);assert.deepEqual(r.menu.rng,[]);
    });
    await check('unchanged shared arm selection '+name,async r=>{
        await setup();incr_itimeout(key,23);r.menu=await menu('>7'+letter+'\r');
        assert.equal(game.u.intrinsic[key],30);assert.deepEqual(r.menu.rng,[]);
    });
}
await check('unchanged fallback selection and display',async r=>{
    await setup();r.menu=await menu('7a\r');assert.equal(game.u.wiz_intrinsic_timeouts.INVULNERABLE,7);
    assert.equal(game.u.uprops.INVULNERABLE,7);r.reopen=await menu('\x1b');
    assert.ok(row(r.reopen,'invulnerable').endsWith('[7]'));assert.deepEqual(r.menu.rng,[]);
});
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({evidence:'Constructed source controls with real producers',reports},null,2)+'\n');
