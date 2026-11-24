// Constructed source controls for hack.c:4295. Native parity is checked separately.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {weight_cap, inv_weight, near_capacity, acurr, acurrstr} from '../js/attrib.js';
import {mksobj} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {setworn} from '../js/worn.js';
import {accessory_or_armor_on, Boots_on, Ring_on} from '../js/do_wear.js';
import {float_vs_flight, polymon} from '../js/polyself.js';
import {unmul, switch_terrain} from '../js/hack.js';
import {teleds, TELEDS_NO_FLAGS} from '../js/teleport.js';
import {set_utrap, reset_utrap} from '../js/trap.js';
import {set_wounded_legs} from '../js/do.js';
import {set_levltyp} from '../js/mkmaze.js';
import {peffects} from '../js/potion.js';
import {Levitation, Flying, Stealth} from '../js/youprop.js';
import {makemon} from '../js/makemon.js';
import {tamedog} from '../js/dog.js';
import {put_saddle_on_mon, mount_steed} from '../js/steed.js';
import {strongmonst} from '../js/mondata.js';
import {resetInputState} from '../js/input.js';
import {enableRngLog, getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {W_ARMF, W_RINGL, LEFT_SIDE, RIGHT_SIDE, BOTH_SIDES, I_SPECIAL,
    FROMOUTSIDE, TT_WEB, TT_PIT, TT_BEARTRAP, ROOM, STONE, A_CON,
    NO_MINVENT, MM_NOGRP, MM_NOWAIT, MM_NOMSG, Is_airlevel} from '../js/const.js';

const fixture=JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/weight-capacity-boundaries.json',import.meta.url))).segments[0];

async function start() {
    const run=await runSegment({...fixture,moves:' ',storage:new InMemoryStorage()});
    game._preNhgetchHook=null;
    resetInputState();
    let reads=0;
    run._display.onEmptyQueue=async()=>{
        assert.ok(++reads<60,'bounded real-helper feedback');
        await setImmediate();
        return 32;
    };
    assert.deepEqual([acurrstr(),acurr(A_CON)],[10,14]);
    return run;
}
function flags() {
    return {e:game.u.uprops.LEVITATION||0,b:game.u.blocked.LEVITATION||0,
        f:game.u.blocked.FLYING||0,s:game.u.blocked.STEALTH||0,
        h:game.u.intrinsic.HLevitation||0,hf:game.u.intrinsic.HFlying||0,
        trap:game.u.utrap,type:game.u.utraptype,legs:game.u.EWounded_legs||0,
        lev:Levitation(),fly:Flying(),stealth:Stealth()};
}
function check(expected) {
    const before=flags(),after=game.afternmv,multi=game.multi;
    const props=game.u.uprops,blocked=game.u.blocked;
    enableRngLog();
    for(let i=0;i<3;i++)assert.equal(weight_cap(),expected);
    assert.deepEqual(getRngLog(),[],'capacity consumes no RNG');
    assert.deepEqual(flags(),before,'source and blocker masks restored');
    assert.equal(game.u.uprops,props);assert.equal(game.u.blocked,blocked);
    assert.equal(game.afternmv,after);assert.equal(game.multi,multi);
}
function object(type) {return addinv(mksobj(type,false,false));}
async function boots(type=O.LEVITATION_BOOTS) {
    const obj=object(type);
    await accessory_or_armor_on(obj);
    assert.equal(game.u.uarmf,obj);
    assert.equal(game.afternmv,Boots_on);
    assert.ok(game.multi<0);
    float_vs_flight();
    return obj;
}
async function ring() {
    const obj=object(O.RIN_LEVITATION);
    await setworn(obj,W_RINGL);
    await Ring_on(obj);
    float_vs_flight();
    return obj;
}
async function potion() {
    await peffects(mksobj(O.POT_LEVITATION,false,false));
    assert.ok(game.u.intrinsic.HLevitation>0);
}
async function form(id) {
    assert.equal(await polymon(id),1);
    assert.equal(game.u.umonnum,id);
}
async function terrain(type) {
    // The starting stair cannot be overwritten by set_levltyp.
    assert.equal(set_levltyp(game.u.ux+1,game.u.uy,ROOM),true);
    await teleds(game.u.ux+1,game.u.uy,TELEDS_NO_FLAGS);
    assert.equal(set_levltyp(game.u.ux,game.u.uy,type),true);
    await switch_terrain();
}
async function mount(id) {
    const {ux,uy}=game.u;
    assert.equal(set_levltyp(ux+1,uy,ROOM),true);
    const mon=await makemon(game.mons[id],ux+1,uy,NO_MINVENT|MM_NOGRP|MM_NOWAIT|MM_NOMSG);
    assert.ok(mon&&await tamedog(mon,null,false));
    put_saddle_on_mon(mksobj(O.SADDLE,false,false),mon);
    assert.equal(await mount_steed(mon,true),true);
    assert.equal(game.u.usteed,mon);
    return mon;
}

await test('human capacity uses the real rolled attributes without RNG or flag changes',async()=>{
    await start();check(650);
});
await test('unfinished levitation boots defer only their carrying benefit',async()=>{
    await start();await boots();
    assert.equal(game.u.uprops.LEVITATION,W_ARMF);assert.equal(Levitation(),true);
    game.disp.botl=false;
    check(650);
    assert.equal(game.disp.botl,true,'real float_vs_flight restoration dirties status');
});
await test('real unmul clears Boots_on before its completed carrying benefit',async()=>{
    await start();await boots();await unmul('');
    assert.equal(game.afternmv,null);check(1000);
});
await test('pending ordinary boots confer no levitation capacity',async()=>{
    await start();await boots(O.LOW_BOOTS);assert.equal(Levitation(),false);check(650);
});
await test('another real dressing callback does not defer already-worn levitation boots',async()=>{
    await start();await boots();await unmul('');
    await accessory_or_armor_on(object(O.HELMET));
    assert.equal(game.afternmv.name,'Helmet_on');assert.notEqual(game.afternmv,Boots_on);check(1000);
});
await test('callback identity, not the name Boots_on, controls the temporary override',async()=>{
    await start();await boots();
    // A different callback reference with the same name; it is never invoked.
    const different=new Proxy(Boots_on,{});
    assert.equal(different.name,Boots_on.name);assert.notEqual(different,Boots_on);
    game.afternmv=different;check(1000);
});
await test('a worn levitation ring independently grants capacity',async()=>{
    await start();await ring();assert.equal(game.u.uprops.LEVITATION,W_RINGL);check(1000);
});
await test('unfinished boots preserve another worn levitation source',async()=>{
    await start();await ring();await boots();
    assert.equal(game.u.uprops.LEVITATION,W_RINGL|W_ARMF);check(1000);
});
await test('unfinished boots preserve levitation from a real potion',async()=>{
    await start();await potion();await boots();check(1000);
});
await test('ordinary delayed boots do not mask a worn levitation ring',async()=>{
    await start();await ring();await boots(O.LOW_BOOTS);
    assert.equal(game.u.uprops.LEVITATION,W_RINGL);check(1000);
});
for(const [name,type] of [['web',TT_WEB],['bear trap',TT_BEARTRAP]]) {
    await test(`${name}: floor-blocked levitation still grants capacity and restores its block`,async()=>{
        await start();await ring();set_utrap(5,type);
        assert.equal(Levitation(),false);assert.equal(game.u.blocked.LEVITATION,I_SPECIAL);
        check(1000);
        await reset_utrap(false);assert.equal(Levitation(),true);check(1000);
    });
}
await test('pit trapping does not produce the floor levitation blocker',async()=>{
    await start();await ring();set_utrap(5,TT_PIT);
    assert.equal(game.u.blocked.LEVITATION||0,0);check(1000);
});
await test('solid terrain keeps FROMOUTSIDE blocking capacity',async()=>{
    await start();await ring();await terrain(STONE);
    assert.equal(game.u.blocked.LEVITATION,FROMOUTSIDE);check(650);
});
await test('combined floor and terrain blockers retain FROMOUTSIDE',async()=>{
    await start();await ring();await terrain(STONE);set_utrap(5,TT_WEB);
    assert.equal(game.u.blocked.LEVITATION,I_SPECIAL|FROMOUTSIDE);check(650);
});
await test('unfinished boots provide no floor-blocked bonus until dressing finishes',async()=>{
    await start();await boots();set_utrap(5,TT_WEB);check(650);
    await unmul('');assert.equal(Levitation(),false);check(1000);
});
for(const side of [LEFT_SIDE,RIGHT_SIDE,BOTH_SIDES]) {
    await test(`real wounded-leg side mask ${side} reduces grounded capacity`,async()=>{
        await start();await set_wounded_legs(side,12);
        assert.equal(game.u.EWounded_legs,side);
        check(side===BOTH_SIDES?450:550);
    });
}
await test('real flying form suppresses both wounded-leg penalties',async()=>{
    await start();await form(P.PM_WINGED_GARGOYLE);
    assert.deepEqual([acurrstr(),acurr(A_CON)],[21,14]);
    assert.equal(Flying(),true);await set_wounded_legs(BOTH_SIDES,12);check(925);
});
await test('floor-blocked flight does not suppress wounded-leg penalties',async()=>{
    await start();await form(P.PM_WINGED_GARGOYLE);set_utrap(5,TT_WEB);
    assert.equal(Flying(),false);await set_wounded_legs(BOTH_SIDES,12);check(725);
});
await test('terrain-blocked flight does not suppress wounded-leg penalties',async()=>{
    await start();await form(P.PM_WINGED_GARGOYLE);await terrain(STONE);
    assert.equal(Flying(),false);await set_wounded_legs(BOTH_SIDES,12);check(725);
});
await test('temporarily removing unfinished boots permits real flight and restores blocking',async()=>{
    await start();await form(P.PM_WINGED_GARGOYLE);await set_wounded_legs(BOTH_SIDES,12);
    await boots();assert.equal(Flying(),false);check(925);assert.equal(Flying(),false);
});
for(const [name,id,expected,blocked] of [
    ['nymph maximum',P.PM_WATER_NYMPH,1000],
    ['weightless small form with terrain-blocked levitation',P.PM_YELLOW_LIGHT,325,true],
    ['weightless large form capped',P.PM_FOG_CLOUD,1000],
    ['non-strong weight scaling',P.PM_GNOME,291],
    ['strong smaller body is not scaled down',P.PM_WINGED_GARGOYLE,925],
    ['strong heavier body is scaled and capped',P.PM_GIANT,1000],
]) {
    await test(name,async()=>{
        await start();await form(id);
        if(blocked){await terrain(STONE);assert.equal(Levitation(),false);}
        check(expected);
    });
}
await test('tiny wounded form clamps capacity to one',async()=>{
    await start();await form(P.PM_GIANT_ANT);check(4);
    await set_wounded_legs(BOTH_SIDES,12);check(1);
});
await test('actual floating-eye form retains its intrinsic levitation override',async()=>{
    await start();await form(P.PM_FLOATING_EYE);
    assert.equal(Levitation(),true);check(1000);
});
for(const [id,strong] of [[P.PM_PONY,true],[P.PM_ROTHE,false]]) {
    await test(`${strong?'strong':'ordinary'} real mount sets the capacity override`,async()=>{
        await start();const mon=await mount(id);assert.equal(!!strongmonst(mon.data),strong);
        check(strong?1000:650);
        await set_wounded_legs(BOTH_SIDES,12);check(strong?1000:450);
    });
}
await test('Air-level identity overrides form scaling and leg penalties',async()=>{
    await start();await form(P.PM_GIANT_ANT);await set_wounded_legs(BOTH_SIDES,12);
    assert.ok(game.air_level);
    // Constructed level identity, without generating or claiming an Air replay.
    game.u.uz={...game.air_level};assert.equal(Is_airlevel(game.u.uz),true);check(1000);
});
await test('temporary boot suppression restores real mounted stealth blocking',async()=>{
    await start();await mount(P.PM_PONY);
    const stealth=object(O.RIN_STEALTH);
    await setworn(stealth,W_RINGL);await Ring_on(stealth);
    assert.equal(Stealth(),false);assert.ok(game.u.blocked.STEALTH&FROMOUTSIDE);
    await boots();assert.equal(Stealth(),true);
    check(1000);assert.equal(game.u.blocked.STEALTH&FROMOUTSIDE,0);
});
await test('inventory capacity callers consume the delayed result synchronously',async()=>{
    await start();object(O.HEAVY_IRON_BALL);object(O.HEAVY_IRON_BALL);await boots();
    const total=game.invent.reduce((n,o)=>n+o.owt,0);
    enableRngLog();assert.equal(inv_weight(),total-650);assert.equal(game.wc,650);
    assert.equal(near_capacity(),2);assert.deepEqual(getRngLog(),[]);
    await unmul('');assert.equal(inv_weight(),total-1000);assert.equal(game.wc,1000);
    assert.equal(near_capacity(),0);
});
