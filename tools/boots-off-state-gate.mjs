// Constructed source controls. All runtime functions use ordinary imports.
// Equipment, timers, blockers and interruption come from real producers.
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
import {Boots_off, Boots_on, Ring_on, accessory_or_armor_on} from '../js/do_wear.js';
import {remove_worn_item} from '../js/steal.js';
import {unmul, spoteffects, switch_terrain, slippery_ice_fumbling} from '../js/hack.js';
import {set_levltyp} from '../js/mkmaze.js';
import {teleds} from '../js/teleport.js';
import {set_utrap, lava_effects} from '../js/trap.js';
import {peffects, set_itimeout} from '../js/potion.js';
import {nh_timeout} from '../js/timeout.js';
import {polymon} from '../js/polyself.js';
import {is_clinger} from '../js/mondata.js';
import {has_ceiling} from '../js/dungeon.js';
import {Levitation, Flying, Fumbling, Wwalking, Amphibious, Fire_resistance} from '../js/youprop.js';
import {Fast, Very_fast} from '../js/attrib.js';
import {pline, tty_clear_nhwindow_message} from '../js/display.js';
import {getRngLog, initRng, enableRngLog} from '../js/rng.js';
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import * as C from '../js/const.js';

const rc='OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
    +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist,!safe_wait,!debug_mongen\n'
    +'OPTIONS=suppress_alert:3.4.3\nOPTIONS=!eight_bit_tty\nOPTIONS=symset:plain\n';
const reports=[];
const messages=()=>[...(game._msg_history||[]),game._toplines,game._prevmsg].join('\n');
function state(){return {boots:game.u.uarmf?.otyp||null,mask:game.context_takeoff?.mask||0,
    cancelled:!!game.context_takeoff?.cancelled_don,underwater:!!game.u.uinwater,
    trap:game.u.utrap||0,traptype:game.u.utraptype||0,hp:game.u.uhp,
    levitating:Levitation(),flying:Flying(),walking:Wwalking(),fumbling:Fumbling(),
    bLev:game.u.blocked?.LEVITATION||0,bFly:game.u.blocked?.FLYING||0,
    hLev:game.u.intrinsic?.HLevitation||0,hFumble:game.u.intrinsic?.HFumbling||0,
    eLev:game.u.uprops?.LEVITATION||0,eFumble:game.u.uprops?.FUMBLING||0,
    lavaDepth:game.iflags?.in_lava_effects||0};}
function clear(){tty_clear_nhwindow_message(game._topl_cury||0);}
async function setup(){
    const run=await runSegment({seed:9770,datetime:'20000112093000',nethackrc:rc,
        moves:' #levelchange\r30\r'+' '.repeat(29),storage:new InMemoryStorage()});
    let reads=0;
    run._display.onEmptyQueue=()=>{assert.ok(++reads<60,'bounded More input');return 32;};
    const {ux,uy}=game.u;
    const target=[[ux+1,uy],[ux-1,uy],[ux,uy+1],[ux,uy-1]].find(([x,y])=>game.level.at(x,y).typ===C.ROOM);
    assert.ok(target,'adjacent ordinary floor');
    await teleds(...target,0);clear();
    return run;
}
async function item(name){return addinv(await readobjnam('uncursed '+name,null,false));}
async function wear(name,{ring=false,finish=true}={}){
    const obj=await item(name);
    if(ring){await setworn(obj,C.W_RINGR);await Ring_on(obj);}
    else {await accessory_or_armor_on(obj);if(finish&&game.afternmv)await unmul('');}
    assert.ok(obj.owornmask,'real wearing producer');clear();return obj;
}
function terrain(typ){assert.equal(set_levltyp(game.u.ux,game.u.uy,typ),true);}
function seed(){initRng(7);enableRngLog();}
async function remove(r,obj=game.u.uarmf){
    r.before=state();clear();seed();r.result=await Boots_off();r.after=state();
    assert.equal(game.u.uarmf,null);
    assert.equal(obj.owornmask&C.W_ARMF,0);assert.equal(r.after.cancelled,false);
}
async function check(name,body){await test(name,async()=>{
    const r={name};try{await body(r);r.pass=true;}
    catch(error){r.pass=false;r.error=error.message;throw error;}
    finally{r.final=state();r.messages=messages();r.rng=[...getRngLog()];reports.push(r);}
});}

for(const [name,typ] of [['low boots',O.LOW_BOOTS],['iron shoes',O.IRON_SHOES],
    ['high boots',O.HIGH_BOOTS],['jumping boots',O.JUMPING_BOOTS],['kicking boots',O.KICKING_BOOTS]])
await check(`${name}: ordinary removal`,async r=>{
    await setup();const obj=await wear(name);assert.equal(obj.otyp,typ);await remove(r,obj);
    assert.deepEqual(getRngLog(),[]);assert.equal(r.after.hp,r.before.hp);
    assert.equal(r.after.underwater,false);
    if(name==='low boots')assert.equal(r.result,0,'C return value');
});
for(const kind of ['none','other equipment','potion'])await check(`speed boots: ${kind}`,async r=>{
    await setup();if(kind==='other equipment')await wear('blue dragon scale mail');
    if(kind==='potion')await peffects(await item('potion of speed'));
    await wear('speed boots');const start=(game._msg_history||[]).length;
    await remove(r);
    if(kind==='none')assert.match(messages().slice(messages().indexOf('speed up')),/yourself slow down\./);
    else {assert.ok(Very_fast());assert.ok(!(game._msg_history||[]).slice(start).some(x=>x.includes('slow down')));}
});
for(const kind of ['none','other equipment'])await check(`elven boots: ${kind}`,async r=>{
    await setup();if(kind!=='none')await wear('elven cloak');
    await wear('elven boots');const start=(game._msg_history||[]).length;await remove(r);
    if(kind==='none')assert.match(messages(),/You sure are noisy\./);
    else assert.ok(!(game._msg_history||[]).slice(start).some(x=>x.includes('noisy')));
});
await check('speed boots: expired potion retains intrinsic speed',async r=>{
    await setup();await peffects(await item('potion of speed'));
    // Use the timeout setter and actual expiry owner; keep the potion's permanent source.
    set_itimeout('HFast',1);await nh_timeout();assert.ok(Fast()&&!Very_fast());
    await wear('speed boots');await remove(r);
    assert.ok(Fast()&&!Very_fast());assert.match(messages(),/yourself slow down a bit\./);
});
for(const kind of ['timer','other equipment','ice intrinsic'])await check(`fumble boots: ${kind}`,async r=>{
    await setup();if(kind==='other equipment')await wear('gauntlets of fumbling');
    if(kind==='ice intrinsic'){
        terrain(C.ICE);seed();
        for(let i=0;i<20&&!(game.u.intrinsic.HFumbling&C.FROMOUTSIDE);i++)slippery_ice_fumbling();
        assert.ok(game.u.intrinsic.HFumbling&C.FROMOUTSIDE);
    }
    await wear('fumble boots');assert.ok(Fumbling());await remove(r);
    if(kind==='timer'){assert.equal(Fumbling(),false);assert.equal(r.after.hFumble,0);}
    else {assert.ok(Fumbling());assert.equal(r.after.hFumble,r.before.hFumble);}
});
for(const ground of ['pool','lava'])await check(`water boots: ${ground} removal`,async r=>{
    await setup();
    if(ground==='pool'){await wear('amulet of magical breathing');assert.ok(Amphibious());}
    else {await wear('ring of fire resistance',{ring:true});assert.ok(Fire_resistance());}
    const obj=await wear('fireproof water walking boots');
    terrain(ground==='pool'?C.POOL:C.LAVAPOOL);await spoteffects(true);
    assert.ok(Wwalking());assert.ok(!game.u.uinwater&&!game.u.utrap);
    await remove(r,obj);assert.equal(game.objects[obj.otyp].oc_name_known,1);
    if(ground==='pool'){assert.equal(game.u.uinwater,1);assert.match(messages(),/You fall into the pool of water\./);}
    else {assert.ok(game.u.utrap);assert.equal(game.u.utraptype,C.TT_LAVA);assert.equal(game.u.uhp,r.before.hp-1);}
});
for(const kind of ['dry','levitation','flight'])await check(`water boots: ${kind} guard`,async r=>{
    await setup();
    if(kind==='levitation')await wear('ring of levitation',{ring:true});
    if(kind==='flight')await wear('amulet of flying');
    const obj=await wear('water walking boots');
    if(kind!=='dry'){terrain(C.POOL);await spoteffects(true);}
    const known=game.objects[obj.otyp].oc_name_known;await remove(r,obj);
    assert.equal(game.objects[obj.otyp].oc_name_known,known);
    assert.equal(!!game.u.uinwater,false);assert.deepEqual(getRngLog(),[]);
});
await check('water boots: actual lava caller burns boots once',async r=>{
    await setup();await wear('ring of fire resistance',{ring:true});
    const obj=await wear('water walking boots');terrain(C.LAVAPOOL);clear();seed();r.before=state();
    await spoteffects(true);
    assert.equal(game.u.uarmf,null);assert.ok(!game.invent.includes(obj));
    assert.equal(game.iflags.in_lava_effects,0);assert.equal(game.u.utraptype,C.TT_LAVA);
    assert.equal(game.u.uhp,r.before.hp-1);
    assert.equal(getRngLog().filter(x=>x.startsWith('d(6,6)')).length,1,'no recursive lava roll');
    assert.equal(game.objects[obj.otyp].oc_name_known,0,'recursive water guard skips discovery');
});
await check('water boots: real clinger polymorph removal skips discovery',async r=>{
    await setup();await wear('amulet of magical breathing');const obj=await wear('water walking boots');
    terrain(C.POOL);await spoteffects(true);r.before=state();
    assert.equal(await polymon(P.PM_LARGE_MIMIC),1);
    assert.ok(is_clinger(game.youmonst.data)&&has_ceiling(game.u.uz));
    assert.equal(game.u.uarmf,null);assert.equal(game.objects[obj.otyp].oc_name_known,0);
});
await check('levitation boots: source lava caller contract suppresses nested descent',async r=>{
    await setup();await wear('ring of fire resistance',{ring:true});
    const obj=await wear('levitation boots');terrain(C.LAVAPOOL);clear();seed();r.before=state();
    // Direct source-helper entry. This checks its Boots_off callback, not walking reach.
    await lava_effects();
    assert.equal(game.u.uarmf,null);assert.ok(!game.invent.includes(obj));
    assert.equal(game.iflags.in_lava_effects,0);assert.equal(game.u.utraptype,C.TT_LAVA);
    assert.equal(game.u.uhp,r.before.hp-1);assert.doesNotMatch(messages(),/float gently/);
    assert.equal(getRngLog().filter(x=>x.startsWith('d(6,6)')).length,1);
});
for(const kind of ['floor','web','water wall','other ring','potion','flight'])
await check(`levitation boots: ${kind}`,async r=>{
    await setup();
    if(kind==='other ring')await wear('ring of levitation',{ring:true});
    if(kind==='potion')await peffects(await item('potion of levitation'));
    if(kind==='flight')await wear('amulet of flying');
    if(kind==='water wall')await wear('amulet of magical breathing');
    if(kind==='web')set_utrap(10,C.TT_WEB);
    await wear('levitation boots');
    if(kind==='web')assert.equal(game.u.blocked.LEVITATION,C.I_SPECIAL);
    if(kind==='water wall'){terrain(C.WATER);await switch_terrain();await spoteffects(true);assert.ok(game.u.blocked.LEVITATION&C.FROMOUTSIDE);}
    await remove(r);
    if(kind==='web'){
        assert.equal(game.u.blocked.LEVITATION&C.I_SPECIAL,0);
        assert.equal(game.u.utrap,10);assert.match(messages(),/no longer trying to float up from the web/);
    }else if(kind==='water wall'){
        assert.ok(game.u.blocked.LEVITATION&C.FROMOUTSIDE);assert.equal(game.u.blocked.FLYING&C.I_SPECIAL,0);
    }else if(['other ring','potion'].includes(kind))assert.ok(Levitation());
    else if(kind==='flight'){assert.ok(Flying());assert.match(messages(),/stopped levitating and are now flying/);}
    else {assert.ok(!Levitation());assert.match(messages(),/float gently to the/);}
});
for(const name of ['speed boots','elven boots','water walking boots','levitation boots'])
await check(`${name}: actual interrupted donning`,async r=>{
    await setup();
    if(name==='levitation boots')set_utrap(10,C.TT_WEB);
    const obj=await wear(name,{finish:false});assert.equal(game.afternmv,Boots_on);
    if(name==='water walking boots')terrain(C.POOL);
    if(name==='levitation boots')set_utrap(10,C.TT_WEB);
    r.before=state();clear();seed();await remove_worn_item(obj,false);
    assert.equal(game.u.uarmf,null);assert.equal(game.afternmv,null);
    assert.equal(game.context_takeoff.cancelled_don,false);
    assert.equal(!!game.u.uinwater,false);assert.equal(game.u.blocked?.LEVITATION&C.I_SPECIAL,0);
    assert.equal(game.objects[obj.otyp].oc_name_known,0);
    assert.deepEqual(getRngLog(),[]);
});
for(const kind of ['pool','web'])await check(`${kind}: awaited More completes removal`,async r=>{
    const run=await setup();let obj;
    if(kind==='pool'){
        await wear('amulet of magical breathing');obj=await wear('water walking boots');
        terrain(C.POOL);await spoteffects(true);
    }else {set_utrap(10,C.TT_WEB);obj=await wear('levitation boots');}
    clear();await pline('An earlier message fills the line before the next source-owned action begins.');
    let release,paused,done=false;const atPause=new Promise(resolve=>{paused=resolve;});
    run._display.onEmptyQueue=()=>{paused('paused');return new Promise(resolve=>{release=resolve;});};
    seed();r.before=state();const action=Boots_off().then(value=>{done=true;return value;});
    try{
        assert.equal(await Promise.race([atPause,action.then(()=>'completed')]),'paused');
        await setImmediate();assert.equal(done,false);r.pending=state();
        assert.equal(game.u.uarmf,null);assert.equal(obj.owornmask&C.W_ARMF,0);
        assert.equal(!!game.u.uinwater,false);
        if(kind==='pool')assert.equal(game.objects[obj.otyp].oc_name_known,1);
        else assert.equal(game.u.blocked.LEVITATION&C.I_SPECIAL,0);
    }finally{
        let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<12);return 32;};
        release?.(32);r.result=await action;
    }
    assert.equal(done,true);assert.equal(r.result,0);assert.equal(game.context_takeoff.cancelled_don,false);
    if(kind==='pool')assert.equal(game.u.uinwater,1);
    else assert.equal(game.u.utrap,10);
});
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({evidence:'Constructed real-producer JS controls, not native parity',reports},null,2)+'\n');
