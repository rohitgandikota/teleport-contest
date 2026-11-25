// Real-producer source controls. Ordinary imports; no replaced runtime functions.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {readobjnam} from '../js/objnam.js';
import {addinv} from '../js/invent.js';
import {drop} from '../js/do.js';
import {place_object} from '../js/mkobj.js';
import {remember_topl} from '../js/tty/topl.js';
import {setworn} from '../js/worn.js';
import {Ring_on,accessory_or_armor_on} from '../js/do_wear.js';
import {unmul,spoteffects,losehp,switch_terrain} from '../js/hack.js';
import {set_levltyp} from '../js/mkmaze.js';
import {teleds,u_on_newpos} from '../js/teleport.js';
import {maketrap} from '../js/mklev.js';
import {t_at,m_at} from '../js/mon.js';
import {set_utrap,move_into_trap} from '../js/trap.js';
import {peffects,set_itimeout} from '../js/potion.js';
import {start_timer,TIMER_LEVEL,MELT_ICE_AWAY} from '../js/timeout.js';
import {polymon} from '../js/polyself.js';
import {makemon,remove_monster,place_monster} from '../js/makemon.js';
import {tamedog} from '../js/dog.js';
import {dosave0,gamestate_decode} from '../js/save.js';
import {Levitation,Flying,Fire_resistance,Amphibious} from '../js/youprop.js';
import {pline,tty_clear_nhwindow_message} from '../js/display.js';
import {getRngLog,initRng,enableRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import * as C from '../js/const.js';

const rc='OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
    +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist,!safe_wait,!debug_mongen\n'
    +'OPTIONS=suppress_alert:3.4.3\nOPTIONS=!eight_bit_tty\nOPTIONS=symset:plain\n';
const reports=[];
const history=()=>[...(game._msg_history||[])];
const messages=()=>[...history(),game._toplines||''].join('\n');
function since(start){
    const rows=game.iflags.msg_history||20,end=game._msg_maxrow||0;
    return [...Array((end-start+rows)%rows)].map((_,i)=>game._msg_history[(start+i)%rows])
        .concat(game._toplines||'').filter(Boolean);
}
function state(){return {xy:[game.u.ux,game.u.uy],terrain:game.level.at(game.u.ux,game.u.uy).typ,
    hp:game.u.uhp,mh:game.u.mh,form:game.u.umonnum,underwater:!!game.u.uinwater,
    trap:game.u.utrap||0,traptype:game.u.utraptype||0,floortrap:t_at(game.u.ux,game.u.uy)?.ttyp||0,
    hLev:game.u.intrinsic?.HLevitation||0,eLev:game.u.uprops?.LEVITATION||0,
    bLev:game.u.blocked?.LEVITATION||0,lev:Levitation(),fly:Flying(),
    lava:game.iflags?.in_lava_effects||0,
    spot:game._spoteffects?{depth:game._spoteffects.inspoteffects,
        xy:[game._spoteffects.spotloc.x,game._spoteffects.spotloc.y],
        terrain:game._spoteffects.spotterrain,trap:game._spoteffects.spottraptyp}:null};}
function clear(){tty_clear_nhwindow_message(game._topl_cury||0);}
function seed(n=7){initRng(n);enableRngLog();}
function terrain(typ){assert.equal(set_levltyp(game.u.ux,game.u.uy,typ),true);}
function clean(){
    if(game._spoteffects){assert.equal(game._spoteffects.inspoteffects,0);
        assert.deepEqual(game._spoteffects.spotloc,{x:0,y:0});
        assert.equal(game._spoteffects.spotterrain,C.STONE);
        assert.equal(game._spoteffects.spottrap,null);assert.equal(game._spoteffects.spottraptyp,C.NO_TRAP);}
}
async function setup(){
    const run=await runSegment({seed:9770,datetime:'20000112093000',nethackrc:rc,
        moves:' #levelchange\r30\r'+' '.repeat(29),storage:new InMemoryStorage()});
    let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<80,'bounded More input');return 32;};
    const {ux,uy}=game.u;
    const pos=[[ux+1,uy],[ux-1,uy],[ux,uy+1],[ux,uy-1]].find(([x,y])=>game.level.at(x,y).typ===C.ROOM&&!m_at(x,y));
    assert.ok(pos,'adjacent ordinary floor');await teleds(...pos,0);clear();return run;
}
async function item(name){return addinv(await readobjnam(name,null,false));}
async function wear(name,ring=false){
    const obj=await item('uncursed '+name);
    if(ring){await setworn(obj,C.W_RINGR);await Ring_on(obj);}
    else{await accessory_or_armor_on(obj);if(game.afternmv)await unmul('');}
    assert.ok(obj.owornmask);clear();return obj;
}
async function levitate(turns=1,blessed=false){
    await peffects(await item((blessed?'blessed':'uncursed')+' potion of levitation'));
    assert.ok(game.u.intrinsic.HLevitation&C.TIMEOUT);set_itimeout('HLevitation',turns);clear();
}
async function trap(typ){const t=await maketrap(game.u.ux,game.u.uy,typ);assert.ok(t);return t;}
async function act(r,pick=false,n=7){clear();remember_topl();seed(n);r.before=state();r.start=game._msg_maxrow||0;
    await spoteffects(pick);r.after=state();r.actionMessages=since(r.start);clean();}
async function check(name,body){await test(name,async()=>{
    const r={name};try{await body(r);r.pass=true;}
    catch(error){r.pass=false;r.error=error.message;throw error;}
    finally{r.final=state();r.messages=messages();r.rng=[...getRngLog()];reports.push(r);}
});}

for(const n of [4,7])for(const blessed of [false,true])
await check(`one-turn potion with pit: seed ${n}, blessed ${blessed}`,async r=>{
    await setup();await levitate(1,blessed);await trap(C.PIT);await act(r,true,n);
    assert.equal(getRngLog()[0],n===7?'rn2(2)=1':'rn2(2)=0');
    if(n===7){
        assert.equal(game.u.intrinsic.HLevitation&C.TIMEOUT,2);assert.ok(Levitation());
        assert.equal(game.u.utrap,0);r.arm='defer';
    }else{
        assert.equal(game.u.intrinsic.HLevitation&C.TIMEOUT,0);assert.ok(!Levitation());
        assert.equal(game.u.utraptype,C.TT_PIT);assert.ok(game.u.utrap);
        assert.equal(r.actionMessages.filter(s=>s.includes('fall into a pit')).length,1);r.arm='early';
    }
});
for(const kind of ['no trap','two turns','extrinsic ring','permanent form'])
await check(`levitation adjustment negative: ${kind}`,async r=>{
    await setup();await levitate(kind==='two turns'?2:1);
    if(kind==='extrinsic ring')await wear('ring of levitation',true);
    if(kind==='permanent form'){
        await polymon(P.PM_FLOATING_EYE);assert.ok(game.u.intrinsic.HLevitation&C.FROMFORM);
    }
    if(kind!=='no trap')await trap(C.PIT);await act(r,true);
    assert.equal(r.after.hLev,r.before.hLev);assert.equal(game.u.utrap,0);
    assert.deepEqual(getRngLog(),[]);
});
await check('blocked timeout early: float_down zero keeps trap processing',async r=>{
    await setup();await trap(C.WEB);set_utrap(10,C.TT_WEB);await levitate();
    assert.ok(game.u.blocked.LEVITATION&C.I_SPECIAL);await act(r,true,4);
    assert.equal(game.u.intrinsic.HLevitation&C.TIMEOUT,0);
    assert.ok(game.u.utrap);assert.equal(game.u.utraptype,C.TT_WEB);
    assert.ok(r.actionMessages.some(s=>s.includes('no longer trying to float up')));
    assert.ok(r.actionMessages.some(s=>s.includes('stumble into a spider web')));
});
for(const kind of ['floor','pit','web'])for(const pick of [false,true])
await check(`pickup ordering: ${kind}, pick ${pick}`,async r=>{
    await setup();const obj=await item('uncursed apple');await drop(obj);
    if(kind!=='floor')await trap(kind==='pit'?C.PIT:C.WEB);
    await act(r,pick);const text=r.actionMessages.join('\n');
    if(pick)assert.match(text,/apple/);else assert.doesNotMatch(text,/apple/);
    if(pick&&kind!=='floor'){
        const ti=text.indexOf(kind==='pit'?'fall into a pit':'stumble into a spider web');
        const oi=text.indexOf('apple');assert.ok(ti>=0);
        assert.ok(kind==='pit'?ti<oi:oi<ti);
    }
});
await check('same-terrain real recursion: rust rehumanizes once',async r=>{
    await setup();await wear('amulet of magical breathing');await polymon(P.PM_IRON_GOLEM);
    await losehp(game.u.mh-1,'source control damage',C.KILLED_BY);assert.equal(game.u.mh,1);
    terrain(C.POOL);await act(r,true);
    assert.ok(Amphibious());assert.equal(game.u.umonnum,game.u.umonster);assert.ok(game.u.uinwater);
    assert.equal(r.actionMessages.filter(s=>s.includes('fall into the pool')).length,1);
    assert.equal(r.actionMessages.filter(s=>s.includes('touch bottom')).length,1);
});
await check('changed-terrain real recursion: fire melts ice',async r=>{
    await setup();await wear('amulet of magical breathing');await wear('ring of fire resistance',true);
    terrain(C.ICE);await trap(C.FIRE_TRAP);await act(r,true);
    assert.ok(Fire_resistance());assert.equal(game.level.at(game.u.ux,game.u.uy).typ,C.MOAT);
    assert.ok(game.u.uinwater);assert.equal(t_at(game.u.ux,game.u.uy),null);
    assert.equal(r.actionMessages.filter(s=>s.includes('tower of flame')).length,1);
});
await check('changed-location real recursion: teleport trap',async r=>{
    const run=await setup();await trap(C.TELEP_TRAP);
    const keys=[108,46];run._display.onEmptyQueue=()=>keys.length?keys.shift():32;
    await act(r,true);
    assert.notDeepEqual(r.after.xy,r.before.xy);assert.equal(game.u.utrap,0);
});
await check('lava rescue: real life-saving and common cleanup',async r=>{
    await setup();const amulet=await wear('amulet of life saving');
    // Real floor-object producers make an erroneous pre-rescue pickup observable.
    for(let x=1;x<C.COLNO;x++)for(let y=0;y<C.ROWNO;y++)
        if([C.ROOM,C.CORR].includes(game.level.at(x,y).typ))
            place_object(await readobjnam('uncursed apple',null,false),x,y);
    terrain(C.LAVAPOOL);
    await act(r,true);assert.ok(!game.invent.includes(amulet));
    assert.notDeepEqual(r.after.xy,r.before.xy);assert.equal(game.iflags.in_lava_effects,0);
    assert.ok(r.actionMessages.some(s=>s.includes('find yourself on solid ground')));assert.ok(game.u.uhp>0);
    assert.doesNotMatch(r.actionMessages.join('\n'),/apple/,'landing effects wait until rescue and suppress pickup');
});
await check('one-turn levitation resumes real flight before trap',async r=>{
    await setup();await wear('amulet of flying');await levitate();await trap(C.PIT);
    await act(r,true,4);assert.ok(Flying()&&!Levitation());assert.equal(game.u.utrap,0);
    assert.equal(game.u.intrinsic.HLevitation&C.TIMEOUT,0);
    assert.match(r.actionMessages.join('\n'),/stopped levitating and are now flying/);
});
await check('sink is processed before one-turn trap adjustment',async r=>{
    await setup();await levitate();terrain(C.SINK);await act(r,true);
    assert.ok(!Levitation());assert.equal(game.u.intrinsic.HLevitation&C.TIMEOUT,0);
    assert.match(r.actionMessages.join('\n'),/crash to the floor/);
});
await check('landmine real helper changes the trap to a pit',async r=>{
    await setup();const t=await trap(C.LANDMINE);await act(r,true);
    assert.equal(t.ttyp,C.PIT);assert.equal(game.u.utrap,0);
    assert.match(r.actionMessages.join('\n'),/escape a pit/);
    assert.match(r.actionMessages.join('\n'),/KAABLAMM/);
});
await check('failed-untrap caller forces a levitating hero into a bear trap',async r=>{
    await setup();await wear('ring of levitation',true);
    const t=await trap(C.BEAR_TRAP),from=[game.u.ux-1,game.u.uy];
    await teleds(...from,0);clear();seed();r.before=state();await move_into_trap(t);
    assert.equal(game.u.utraptype,C.TT_BEARTRAP);assert.ok(game.u.utrap);
    assert.equal(game.iflags.failing_untrap,0);clean();
});
await check('private owner bookkeeping stays out of a real save',async r=>{
    await setup();await act(r,false);
    assert.equal(await dosave0(),true);
    const saved=gamestate_decode(JSON.parse(game.storage.getItem('save:'+game.plname)));
    assert.equal(Object.hasOwn(saved,'_spoteffects'),false);
});
for(const turns of [0,3,7,12,15])await check(`ice warning: ${turns} turns`,async r=>{
    await setup();await wear('ring of warning',true);terrain(C.ICE);
    if(turns)assert.ok(start_timer(turns,TIMER_LEVEL,MELT_ICE_AWAY,(game.u.ux<<16)|game.u.uy));
    await act(r,false);const text=r.actionMessages.join('\n');
    if(turns===3)assert.match(text,/gonna BREAK/);
    else if(turns===7)assert.match(text,/ice shift/);
    else if(turns===12)assert.match(text,/soft and slushy/);
    else assert.doesNotMatch(text,/ice/);
    assert.deepEqual(getRngLog(),[]);
});
for(const kind of ['iron','leather','none','tame'])await check(`piercer: ${kind} helmet control`,async r=>{
    await setup();if(kind==='iron')await wear('helmet');if(kind==='leather')await wear('leather hat');
    const m=makemon(game.mons[P.PM_ROCK_PIERCER],0,0,C.MM_NOINVENT);assert.ok(m);
    if(kind==='tame')await tamedog(m,null,false);
    remove_monster(m.mx,m.my);place_monster(m,game.u.ux,game.u.uy);
    await act(r,false);assert.notEqual(m_at(game.u.ux,game.u.uy),m);
    assert.equal(m.mundetected,0);assert.equal(m.msleeping,0);
    if(kind==='iron'){
        assert.equal(game.u.uhp,r.before.hp);assert.match(r.actionMessages.join('\n'),/blow glances off your/);
        assert.ok(!getRngLog().some(s=>s.startsWith('rnd(20)')));
    }else if(kind==='tame')assert.ok(!getRngLog().some(s=>s.startsWith('rnd(20)')));
    else assert.ok(getRngLog().some(s=>s.startsWith('rnd(20)')));
});
// Hold genuine message input, inspect active state, then finish the same action.
for(const kind of ['pool','pit'])await check(`pending More: ${kind} completes before cleanup`,async r=>{
    const run=await setup();
    if(kind==='pool'){await wear('amulet of magical breathing');terrain(C.POOL);}
    else await trap(C.PIT);
    clear();await pline('An earlier message fills the line before the next source-owned action begins.');
    let release,paused,done=false;const atPause=new Promise(resolve=>{paused=resolve;});
    run._display.onEmptyQueue=()=>{paused('paused');return new Promise(resolve=>{release=resolve;});};
    seed();r.before=state();const action=spoteffects(true).then(()=>{done=true;});
    try{
        assert.equal(await Promise.race([atPause,action.then(()=>'completed')]),'paused');
        await setImmediate();assert.equal(done,false);r.pending=state();
        assert.equal(game._spoteffects?.inspoteffects,1);
        assert.deepEqual([game._spoteffects.spotloc.x,game._spoteffects.spotloc.y],r.before.xy);
        if(kind==='pit')assert.equal(game._spoteffects.spottraptyp,C.PIT);
        // A direct helper entry while the real owner is active must be suppressed.
        const log=[...getRngLog()],msgs=history();await spoteffects(true);
        assert.deepEqual(getRngLog(),log);assert.deepEqual(history(),msgs);
    }finally{
        let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<15);return 32;};
        release?.(32);await action;
    }
    assert.ok(done);clean();if(kind==='pool')assert.ok(game.u.uinwater);else assert.ok(game.u.utrap);
});
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({evidence:'Constructed real-producer JS source controls; not native parity',reports},null,2)+'\n');
