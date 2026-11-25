// Complete-owner source controls using normal imports and real state producers.
// Constructed states are not native parity evidence.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {readobjnam} from '../js/objnam.js';
import {addinv,obj_extract_self} from '../js/invent.js';
import {place_object} from '../js/mkobj.js';
import {peffects,make_hallucinated} from '../js/potion.js';
import {float_down,dotrap,lava_effects} from '../js/trap.js';
import {maketrap} from '../js/mklev.js';
import {set_levltyp} from '../js/mkmaze.js';
import {movobj,nomul,switch_terrain,unmul} from '../js/hack.js';
import {polymon} from '../js/polyself.js';
import {teleds} from '../js/teleport.js';
import {t_at,m_at,set_ustuck} from '../js/mon.js';
import {makemon} from '../js/makemon.js';
import {gulpmu} from '../js/mhitu.js';
import {punish} from '../js/read.js';
import {bury_objs} from '../js/dig.js';
import {zap_over_floor} from '../js/zap.js';
import {goto_level,deferred_goto,UTOTYPE_DEFERRED,UTOTYPE_FALLING} from '../js/do.js';
import {setworn} from '../js/worn.js';
import {Ring_on,accessory_or_armor_on} from '../js/do_wear.js';
import {encumber_msg,near_capacity,weight_cap} from '../js/attrib.js';
import {Levitation,Flying,Swimming,Fire_resistance,Fumbling} from '../js/youprop.js';
import {pline,tty_clear_nhwindow_message} from '../js/display.js';
import {remember_topl} from '../js/tty/topl.js';
import {initRng,enableRngLog,getRngLog} from '../js/rng.js';
import {PMNAMES as P,ATTKS} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

const rc='OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
    +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist,!safe_wait,!debug_mongen\n'
    +'OPTIONS=suppress_alert:3.4.3\nOPTIONS=!eight_bit_tty\nOPTIONS=symset:plain\n';
const reports=[];
const clear=()=>tty_clear_nhwindow_message(game._topl_cury||0);
const seed=()=>{initRng(7);enableRngLog();};
function state(){return {xy:[game.u.ux,game.u.uy],level:{...game.u.uz},hp:game.u.uhp,
    hLev:game.u.intrinsic?.HLevitation||0,eLev:game.u.uprops?.LEVITATION||0,
    bLev:game.u.blocked?.LEVITATION||0,bFly:game.u.blocked?.FLYING||0,
    lev:Levitation(),fly:Flying(),trap:game.u.utrap||0,traptype:game.u.utraptype||0,
    underwater:!!game.u.uinwater,swallowed:!!game.u.uswallow,held:game.u.ustuck?.m_id||0,
    multi:game.multi,oldcap:game.oldcap,lava:game.iflags.in_lava_effects||0,
    scheduled:game.u.utotype||0,destination:{...game.u.utolev},
    floor:(game.level.objectsAt(game.u.ux,game.u.uy)||[]).map(o=>o.o_id),
    invent:(game.invent||[]).map(o=>o.o_id),
    ball:game.u.uball?[game.u.uball.ox,game.u.uball.oy,game.u.uball.where]:null,
    chain:game.u.uchain?[game.u.uchain.ox,game.u.uchain.oy,game.u.uchain.where]:null};}
function since(start){const rows=game.iflags.msg_history||20,end=game._msg_maxrow||0;
    return [...Array((end-start+rows)%rows)].map((_,i)=>game._msg_history[(start+i)%rows])
        .concat(game._toplines||'').filter(Boolean);}
function adjacent(){const {ux,uy}=game.u;const pos=[[ux+1,uy],[ux-1,uy],[ux,uy+1],[ux,uy-1]]
    .find(([x,y])=>game.level.at(x,y).typ===C.ROOM&&!m_at(x,y)&&!t_at(x,y));
    assert.ok(pos,'ordinary adjacent room');return pos;}
async function setup(autopickup=false){const run=await runSegment({seed:9770,datetime:'20000112093000',
    nethackrc:rc+(autopickup?'OPTIONS=autopickup,pickup_types:%\n':''),
    moves:' #levelchange\r30\r'+' '.repeat(29),storage:new InMemoryStorage()});
    let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<200,'bounded More completion');return 32;};
    await teleds(...adjacent(),0);clear();return run;}
async function item(name){return addinv(await readobjnam(name,null,false));}
async function levitate(){await peffects(await item('blessed potion of levitation'));
    assert.ok(game.u.intrinsic.HLevitation&C.I_SPECIAL);clear();}
async function wear(name,ring=false){const o=await item('uncursed '+name);
    if(ring){await setworn(o,C.W_RINGR);await Ring_on(o);}
    else{await accessory_or_armor_on(o);if(game.afternmv)await unmul('');}
    assert.ok(o.owornmask);clear();return o;}
async function floor(name='uncursed apple',pos=[game.u.ux,game.u.uy]){
    const o=await readobjnam(name,null,false);await place_object(o,...pos);return o;}
async function trap(typ,pos=[game.u.ux,game.u.uy]){const t=await maketrap(...pos,typ);assert.ok(t);return t;}
function terrain(typ){assert.equal(set_levltyp(game.u.ux,game.u.uy,typ),true);}
async function act(r,hmask=C.I_SPECIAL|C.TIMEOUT,emask=0){clear();remember_topl();seed();
    const start=game._msg_maxrow||0;r.before=state();r.result=await float_down(hmask,emask);
    r.after=state();r.messages=since(start);r.rng=[...getRngLog()];}
async function check(name,fn){await test(name,async()=>{const r={name};
    try{await fn(r);assert.ok(!game.program_state.gameover);r.pass=true;}
    catch(error){r.pass=false;r.error=error.stack;throw error;}
    finally{r.final=state();reports.push(r);}
});}

for(const kind of ['floor','pit','spiked pit','statue'])await check(`descent: ${kind}`,async r=>{
    await setup();await levitate();if(kind!=='floor')await trap({pit:C.PIT,'spiked pit':C.SPIKED_PIT,statue:C.STATUE_TRAP}[kind]);
    await act(r);assert.equal(r.result,1);assert.equal(r.after.hLev,0);
    assert.match(r.messages.join('\n'),/float gently to the floor/);
    if(kind==='pit'||kind==='spiked pit'){assert.ok(r.after.trap);assert.equal(r.after.traptype,C.TT_PIT);
        assert.ok(r.messages.findIndex(x=>x.includes('float gently'))<=r.messages.findIndex(x=>x.includes('pit')));}
    else{assert.equal(r.after.trap,0);assert.deepEqual(r.rng,[]);}
});
for(const kind of ['empty mask','extrinsic ring','permanent form'])await check(`remaining source: ${kind}`,async r=>{
    await setup();if(kind==='extrinsic ring')await wear('ring of levitation',true);
    if(kind==='permanent form')await polymon(P.PM_FLOATING_EYE);
    await levitate();await trap(C.PIT);const apple=await floor();
    await act(r,kind==='empty mask'?0:C.I_SPECIAL|C.TIMEOUT);
    assert.equal(r.result,0);assert.ok(r.after.lev);assert.equal(r.after.trap,0);
    assert.deepEqual(r.rng,[]);assert.deepEqual(r.messages,[]);assert.ok(r.after.floor.includes(apple.o_id));
    if(kind==='permanent form')assert.ok(r.after.hLev&C.FROMFORM);
    if(kind==='extrinsic ring')assert.equal(r.after.eLev,r.before.eLev);
});
for(const [typ,phrase] of [[C.BEAR_TRAP,"trap's jaws"],[C.WEB,'web']])await check(`blocked by ${phrase}`,async r=>{
    await setup();await dotrap(await trap(typ),C.FORCETRAP);assert.ok(game.u.utrap);
    await levitate();assert.equal(game.u.blocked.LEVITATION,C.I_SPECIAL);await act(r);
    assert.equal(r.result,0);assert.equal(r.after.hLev,0);assert.equal(r.after.bLev,0);
    assert.equal(r.after.trap,r.before.trap);assert.ok(r.messages.some(x=>x.includes(`no longer trying to float up from the ${phrase}`)));
    assert.deepEqual(r.rng,[]);
});
for(const withTrap of [false,true])await check(`blocked rock, attempted web ${withTrap}`,async r=>{
    await setup();await polymon(P.PM_XORN);if(withTrap)await dotrap(await trap(C.WEB),C.FORCETRAP);
    assert.equal(game.u.utrap||0,0,'xorn passes through the web; this is a terrain-only block');
    terrain(C.STONE);await switch_terrain();await levitate();await act(r);
    assert.equal(r.result,0);assert.equal(r.after.hLev,0);assert.ok(r.after.bLev&C.FROMOUTSIDE);
    assert.deepEqual(r.messages,[]);assert.deepEqual(r.rng,[]);
});
await check('flight resumes before trap or pickup',async r=>{
    await setup();await polymon(P.PM_BAT);await levitate();await trap(C.PIT);const apple=await floor();
    assert.ok(!Flying()&&game.u.blocked.FLYING&C.I_SPECIAL);await act(r);
    assert.equal(r.result,1);assert.ok(r.after.fly);assert.equal(r.after.trap,0);
    assert.match(r.messages.join('\n'),/stopped levitating and are now flying/);
    assert.ok(r.after.floor.includes(apple.o_id));assert.deepEqual(r.rng,[]);
});
for(const typ of [P.PM_PURPLE_WORM,P.PM_FOG_CLOUD])await check(`real engulf producer ${typ}`,async r=>{
    await setup();await levitate();const mon=await makemon(game.mons[typ],...adjacent(),C.MM_NOINVENT);
    await gulpmu(mon,mon.data.mattk.find(a=>a[0]===ATTKS.AT_ENGL));assert.ok(game.u.uswallow);
    await act(r);assert.equal(r.result,1);assert.ok(r.after.swallowed);assert.equal(r.after.held,mon.m_id);
    assert.match(r.messages.join('\n'),typ===P.PM_PURPLE_WORM?/still swallowed/:/still engulfed/);assert.deepEqual(r.rng,[]);
});
for(const sticky of [false,true])await check(`release holder, sticky hero ${sticky}`,async r=>{
    await setup();if(sticky)await polymon(P.PM_LARGE_MIMIC);await levitate();
    const m=await makemon(game.mons[P.PM_LARGE_MIMIC],...adjacent(),C.MM_NOINVENT);set_ustuck(m);
    await act(r);assert.equal(r.result,1);assert.equal(r.after.held,0);
    assert.match(r.messages.join('\n'),sticky?/maintain your hold/:/can no longer hold you/);
    assert.ok(r.messages.findIndex(x=>x.includes(sticky?'maintain':'hold you'))<=r.messages.findIndex(x=>x.includes('float gently')));
});
for(const kind of ['breathing','swimming','walking','crawl'])await check(`pool: ${kind}`,async r=>{
    await setup();if(kind==='breathing')await wear('amulet of magical breathing');
    if(kind==='walking')await wear('water walking boots');
    if(kind==='swimming'){await polymon(P.PM_GIANT_EEL);assert.ok(Swimming());}
    await levitate();terrain(C.POOL);await act(r);assert.equal(r.result,1);
    if(kind==='breathing'){assert.ok(r.after.underwater);assert.ok(!r.messages.some(x=>x.includes('float gently')));}
    else if(kind==='crawl'){assert.notDeepEqual(r.after.xy,r.before.xy);assert.ok(!r.messages.some(x=>x.includes('float gently')));}
    else{assert.ok(!r.after.underwater);assert.match(r.messages.join('\n'),/float gently/);}
});
for(const kind of ['resistant','walking','likes lava','flying negative'])await check(`lava: ${kind}`,async r=>{
    await setup();if(kind==='likes lava')await polymon(P.PM_SALAMANDER);
    else if(kind==='flying negative')await polymon(P.PM_FIRE_ELEMENTAL);
    else{await wear('ring of fire resistance',true);if(kind==='walking')await wear('fireproof water walking boots');}
    assert.ok(Fire_resistance());await levitate();terrain(C.LAVAPOOL);await act(r);
    assert.equal(r.result,1);assert.equal(r.after.lava,0);assert.ok(!r.messages.some(x=>x.includes('float gently')));
    if(kind==='flying negative'){
        assert.ok(r.after.fly);assert.deepEqual(r.rng,[]);
        assert.match(r.messages.join('\n'),/stopped levitating and are now flying/);
    }else assert.ok(r.rng.some(x=>x.startsWith('d(6,6)=')));
    if(kind==='resistant'){assert.ok(r.after.trap);assert.equal(r.after.traptype,C.TT_LAVA);}
    else assert.equal(r.after.trap,0);
});
for(const kind of ['pit','web cache','pool','occupied pit','plain floor','carried'])await check(`punishment: ${kind}`,async r=>{
    await setup();await punish(null);if(kind==='pool')await wear('amulet of magical breathing');await levitate();
    const target=adjacent(),ball=game.u.uball;
    if(kind==='carried'){obj_extract_self(ball);addinv(ball);}
    else{await movobj(ball,...target);if(kind==='pit'||kind==='occupied pit')await trap(C.PIT,target);
        if(kind==='web cache')await trap(C.WEB,target);
        if(kind==='pool')set_levltyp(...target,C.POOL);
        if(kind==='occupied pit')await makemon(game.mons[P.PM_GRID_BUG],...target,C.MM_NOINVENT);}
    await act(r);assert.equal(r.result,1);
    if(kind==='pit'||kind==='pool'){
        assert.deepEqual(r.after.xy,target);assert.deepEqual(r.after.chain.slice(0,2),target);
        if(kind==='pit'){assert.equal(r.after.traptype,C.TT_PIT);assert.ok(r.after.trap);}
        else assert.ok(r.after.underwater);
    }else{assert.deepEqual(r.after.xy,r.before.xy);
        if(kind==='web cache'){assert.equal(r.after.traptype,C.TT_WEB);assert.ok(!r.messages.some(x=>x.includes('float gently')));}
        else assert.match(r.messages.join('\n'),/float gently/);}
});
await check('saddle mask suppresses descent feedback only',async r=>{
    await setup();await levitate();await trap(C.PIT);await act(r,C.I_SPECIAL|C.TIMEOUT,C.W_SADDLE);
    assert.equal(r.result,1);assert.ok(r.after.trap);assert.ok(!r.messages.some(x=>x.includes('float gently')));
});
for(const pool of [false,true])await check(`hallucinated descent, pool ${pool}`,async r=>{
    await setup();if(pool)await wear('water walking boots');await levitate();await make_hallucinated(40,false,0);
    if(pool)terrain(C.POOL);await act(r);assert.match(r.messages.join('\n'),pool?/splashed down/:/hit the ground/);
});
await check('descent preserves existing helplessness',async r=>{
    await setup();await levitate();nomul(-5);await act(r);assert.equal(r.result,1);assert.equal(r.after.multi,-5);
});
await check('seen hole escape precedes scheduling',async r=>{
    await setup();await levitate();const t=await trap(C.HOLE);assert.ok(t.tseen);await act(r);
    assert.equal(r.result,1);assert.deepEqual(r.after.level,r.before.level);assert.equal(r.after.hLev,0);
    assert.equal(r.after.scheduled,0);assert.deepEqual(r.rng,['rn2(5)=0']);
    assert.match(r.messages.join('\n'),/You escape a hole/);
});
for(const typ of [C.HOLE,C.TRAPDOOR])await check(`falling trap schedules then changes level: ${typ}`,async r=>{
    await setup();if(typ===C.HOLE){await wear('gauntlets of fumbling');assert.ok(Fumbling());}
    await levitate();const t=await trap(typ),destination={...t.dst};await act(r);
    assert.equal(r.result,1);assert.deepEqual(r.after.level,r.before.level);assert.equal(r.after.hLev,0);
    assert.equal(r.after.scheduled,UTOTYPE_DEFERRED|UTOTYPE_FALLING);
    assert.deepEqual(r.after.destination,destination);assert.deepEqual(r.rng,[]);
    await deferred_goto();r.completed=state();assert.deepEqual(r.completed.level,destination);
    assert.equal(r.completed.scheduled,0);
});
for(const pit of [false,true])await check(`autopickup after descent, pit ${pit}`,async r=>{
    await setup(true);await levitate();if(pit)await trap(C.PIT);const apple=await floor();await act(r);
    assert.equal(r.result,1);assert.ok(!r.after.floor.includes(apple.o_id));assert.ok(r.after.invent.includes(apple.o_id));
    if(pit)assert.ok(r.after.trap);
});
for(const kind of ['lava','solidified lava','buried ball'])await check(`blocked producer: ${kind}`,async r=>{
    await setup();if(kind==='buried ball'){
        await punish(null);await bury_objs(game.u.ux,game.u.uy);assert.equal(game.u.utraptype,C.TT_BURIEDBALL);
    }else{
        await wear('ring of fire resistance',true);terrain(C.LAVAPOOL);await lava_effects();
        assert.equal(game.u.utraptype,C.TT_LAVA);
        if(kind==='solidified lava'){
            // src/zap.c:45,55: ZT_WAND(ZT_COLD) is AD_COLD-1.
            await zap_over_floor(game.u.ux,game.u.uy,ATTKS.AD_COLD-1,{v:false},false,0);
            assert.equal(game.u.utraptype,C.TT_INFLOOR);
        }
    }
    await levitate();await act(r);assert.equal(r.result,0);assert.equal(r.after.hLev,0);
    assert.equal(r.after.trap,r.before.trap);assert.deepEqual(r.rng,[]);
    assert.ok(r.messages.some(s=>s.includes(`no longer trying to float up from the ${
        kind==='lava'?'lava':kind==='buried ball'?'chain':'ground'}`)));
});
for(const plane of ['air','water'])await check(`real generated plane: ${plane}`,async r=>{
    await setup();await levitate();await item('Amulet of Yendor');assert.ok(game.u.uhave.amulet);
    const dest={...game[plane+'_level']};await goto_level(dest,false,false,false);
    assert.deepEqual(game.u.uz,dest);
    if(plane==='water'){
        let bubble;for(let x=1;x<C.COLNO&&!bubble;x++)for(let y=0;y<C.ROWNO;y++)
            if(game.level.at(x,y).typ===C.AIR&&!m_at(x,y)){bubble=[x,y];break;}
        assert.ok(bubble);await teleds(...bubble,0);
    }
    const apple=await floor();await act(r);assert.equal(r.result,1);assert.ok(r.after.floor.includes(apple.o_id));
    assert.match(r.messages.join('\n'),plane==='air'?/begin to tumble in place/:/feel heavier/);
});
for(const heavy of [false,true])await check(`pending More precedes pit and pickup, heavy ${heavy}`,async r=>{
    const run=await setup();await levitate();await trap(C.PIT);const apple=await floor();
    if(heavy){const capacity=weight_cap();await item('uncursed heavy iron ball');await item('uncursed heavy iron ball');
        await item('uncursed heavy iron ball');assert.equal(capacity,1000);await encumber_msg();}
    clear();await pline('An earlier message fills the line before the next source-owned action begins.');
    let release,paused,done=false;const atPause=new Promise(resolve=>{paused=resolve;});
    run._display.onEmptyQueue=()=>{paused('paused');return new Promise(resolve=>{release=resolve;});};
    seed();r.before=state();const action=float_down(C.I_SPECIAL|C.TIMEOUT,0).then(v=>{done=true;r.result=v;});
    try{assert.equal(await Promise.race([atPause,action.then(()=>'completed')]),'paused');await setImmediate();
        assert.equal(done,false);r.pending=state();assert.equal(r.pending.hLev,0);assert.equal(r.pending.trap,0);
        assert.ok(r.pending.floor.includes(apple.o_id));assert.deepEqual(getRngLog(),[]);
    }finally{let reads=0;r.laterPending=[];run._display.onEmptyQueue=async()=>{assert.ok(++reads<30);
        r.laterPending.push({...state(),top:game._toplines,rng:[...getRngLog()]});await setImmediate();return 32;};release?.(32);await action;}
    r.after=state();r.rng=[...getRngLog()];assert.equal(r.result,1);assert.ok(r.after.trap);
    if(heavy){assert.ok(near_capacity()>0);assert.equal(game.oldcap,near_capacity());
        assert.ok(r.laterPending.some(s=>s.top.includes('float gently')&&s.oldcap===r.before.oldcap&&s.trap===0&&s.rng.length===0),
            'encumbrance message waits after descent feedback but before updating oldcap or springing pit');}
});
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({evidence:'Constructed real-producer source controls; not native parity',reports},null,2)+'\n');
