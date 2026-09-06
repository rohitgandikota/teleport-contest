#!/usr/bin/env node

// C eat.c:475,3362, do_wear.c:608..960 and mkobj.c:2270..2296.
// Constructed controls earn no native coverage credit.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {pushKeys,resetInputState} from '../js/input.js';
import {eatfood,eating_dangerous_corpse,newuhs} from '../js/eat.js';
import {Gloves_off,wielding_corpse} from '../js/do_wear.js';
import {mksobj,is_rottable,is_flammable} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {setworn} from '../js/worn.js';
import {condtests} from '../js/botl.js';
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {W_ARM,W_ARMG,W_ARMF,W_WEP,ACID_RES,STONE_RES,TIMEOUT,
    FROMOUTSIDE,A_DEX,NOT_HUNGRY,SATIATED,BUFSZ} from '../js/const.js';

const read=name=>JSON.parse(readFileSync(new URL(
    `gen-sessions/recipes/${name}.json`,import.meta.url)));
const secondary={black:'DRAIN_RES',blue:'FAST',green:'SICK_RES',
    red:'INFRAVISION',gold:'HALLUC_RES',orange:'FREE_ACTION',
    yellow:'STONE_RES',white:'SLOW_DIGESTION'};
let replays=0,acidExtensions=0,stoneExtensions=0;
for(const file of ['resistance-meals','protective-armor-loss','armor-secondary-effects']) {
    for(const s of read(file).segments) {
        const label=file+':'+s.name;
        let watching=false,armorSeen=false,propertySeen=false,slippery=false;
        globalThis.__step_snapshot={step:'*',cb:g=>{
            if(!watching) {
                watching=true;
                g.u.intrinsic=new Proxy(g.u.intrinsic,{set(target,key,value){
                    if(target[key]===0 && value===1 && g.occupation===eatfood) {
                        if(key==='HAcid_resistance' && eating_dangerous_corpse(ACID_RES))
                            acidExtensions++;
                        if(key==='HStone_resistance' && eating_dangerous_corpse(STONE_RES))
                            stoneExtensions++;
                    }
                    target[key]=value;
                    return true;
                }});
            }
            slippery ||= !!(g.u.intrinsic.HGlib & TIMEOUT);
            if(file==='armor-secondary-effects' && g.u.uarm) {
                armorSeen=true;
                const key=secondary[s.name.split('-')[0]];
                propertySeen ||= !key || !!(g.u.uprops[key] & W_ARM);
            }
        }};
        try {await runSegment({...s,storage:new InMemoryStorage()});}
        finally {delete globalThis.__step_snapshot;}
        if(file==='resistance-meals')assert.equal(game.u.umortality||0,0,label);
        if(file==='protective-armor-loss') {
            const spared=['gloves-refuse','slippery-gloves-destroyed'].includes(s.name);
            assert.equal(game.u.umortality||0,spared?0:1,label);
            if(s.name==='gloves-refuse') {
                assert.equal(game.u.uarmg.otyp,ONAMES.LEATHER_GLOVES,label);
                assert.equal(game.u.uwep.corpsenm,PMNAMES.PM_COCKATRICE,label);
            }else {
                assert.ok(!game.u.uarmg && !game.u.uarm,label);
                assert.notEqual(game.u.uwep?.corpsenm,PMNAMES.PM_COCKATRICE,label);
            }
            if(s.name==='slippery-gloves-destroyed') {
                assert.ok(slippery,label);
                assert.equal(game.u.intrinsic.HGlib||0,0,label);
            }
        }
        if(file==='armor-secondary-effects') {
            assert.ok(!game.u.uarm && !game.u.uarmg && !game.u.uarmc,label);
            if(/-(scales|mail)$/.test(s.name)) {
                assert.ok(armorSeen && propertySeen,label);
                const key=secondary[s.name.split('-')[0]];
                if(key)assert.equal((game.u.uprops[key]||0)&W_ARM,0,label);
            }
            if(s.name==='dexterity-3-off')
                assert.equal(game.u.abon.a[A_DEX],0,label);
            if(s.name==='fumbling-0-off')
                assert.equal(game.u.intrinsic.HFumbling||0,0,label);
        }
        replays++;
    }
}
assert.ok(acidExtensions>0,'native acid meals reach a one-turn renewal');
assert.ok(stoneExtensions>0,'native stone meals reach a one-turn renewal');

const source=read('protective-armor-loss').segments[0];
async function setup() {
    resetInputState();
    await runSegment({...source,moves:' ',storage:new InMemoryStorage()});
    game._preNhgetchHook=null;
    game.iflags.debug_mongen=false;
    pushKeys(' '.repeat(200));
}

for(const source of ['timeout','permanent','boots']) {
    await setup();
    const gloves=mksobj(ONAMES.GAUNTLETS_OF_FUMBLING,false,false);
    await addinv(gloves);
    setworn(gloves,W_ARMG);
    game.u.intrinsic.HFumbling=9|(source==='permanent'?FROMOUTSIDE:0);
    if(source==='boots')game.u.uprops.FUMBLING|=W_ARMF;
    game.context_takeoff={mask:W_ARM|W_ARMG,cancelled_don:true};
    await Gloves_off();
    assert.equal(game.u.intrinsic.HFumbling,source==='timeout'?0:9|(source==='permanent'?FROMOUTSIDE:0),source);
    assert.equal(game.u.uprops.FUMBLING||0,source==='boots'?W_ARMF:0,source);
    assert.equal(game.context_takeoff.mask,W_ARM,source);
    assert.equal(game.context_takeoff.cancelled_don,false,source);
}
await setup();
const dex=mksobj(ONAMES.GAUNTLETS_OF_DEXTERITY,false,false);
dex.spe=3;await addinv(dex);setworn(dex,W_ARMG);
game.u.abon={a:new Array(6).fill(0)};
game.context_takeoff={cancelled_don:true};
await Gloves_off();
assert.equal(game.u.abon.a[A_DEX],0,'cancelled donning has no dexterity bonus to undo');

await setup();
const gloves=mksobj(ONAMES.LEATHER_GLOVES,false,false);
await addinv(gloves);setworn(gloves,W_ARMG);
const bare=condtests.find(c=>c.id==='bl_bareh'),enabled=bare.enabled;
bare.enabled=true;game.disp.botl=false;
try {await Gloves_off();assert.equal(game.disp.botl,true);}
finally {bare.enabled=enabled;}

// Ending a meal restores the saved starting status before the comparison,
// even while victual.eating is still true. Starting another game resets it.
await setup();
game.u.uhs=NOT_HUNGRY;game.u.uhunger=1100;
game.force_save_hs=true;
await newuhs(false);
assert.equal(game.saved_hs,true);assert.equal(game.save_hs,NOT_HUNGRY);
game.force_save_hs=false;game.occupation=null;
game.context.victual={eating:true};game.disp.botl=false;
await newuhs(false);
assert.equal(game.saved_hs,false);assert.equal(game.u.uhs,SATIATED);
assert.match(game.nhDisplay.grid[23].map(c=>c.ch).join(''),/Satiated/);
game.saved_hs=true;
await setup();assert.ok(!game.saved_hs,'new game clears the saved hunger status');

// Both import paths share C's material predicates, including dragon hide.
assert.equal(is_rottable({otyp:ONAMES.YELLOW_DRAGON_SCALES}),true);
assert.equal(is_flammable({otyp:ONAMES.CLOAK_OF_INVISIBILITY}),true);
assert.equal(is_flammable({otyp:ONAMES.WAN_FIRE}),false);

// C strips user names from the death reason. This oversized constructed
// name verifies that it cannot leak into the bounded description.
await setup();
const corpse=mksobj(ONAMES.CORPSE,false,false);
corpse.corpsenm=PMNAMES.PM_COCKATRICE;corpse.oname='q'.repeat(400);
await addinv(corpse);setworn(corpse,W_WEP);
let reason='';
game._preNhgetchHook=()=>{if(game.killer?.name?.includes('while wielding'))reason=game.killer.name;};
await wielding_corpse(corpse,null,false);
game._preNhgetchHook=null;
assert.ok(reason.length<BUFSZ,'bounded corpse-contact death reason');
assert.equal(reason,'resistance timing out while wielding a cockatrice corpse');
assert.match(reason,/^resistance timing out while wielding /);
assert.ok(!game.u.uwep,'reprieve releases the corpse');
console.log(`resistance and armor state: ${replays} replays, ${acidExtensions} acid/${stoneExtensions} stone renewals and source controls passed`);
