#!/usr/bin/env node

// C pickup.c:3688..4057 and mkobj.c:2847..2935.
// Constructed controls do not earn native source coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {resetInputState,pushKeys} from '../js/input.js';
import {initRng,rn2} from '../js/rng.js';
import {weight} from '../js/invent.js';
import {mksobj,add_to_container,hornoplenty} from '../js/mkobj.js';
import {tipcontainer_checks} from '../js/pickup.js';
import {stop_timer} from '../js/timeout.js';
import {ONAMES as N} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {OBJ_INVENT,OBJ_FLOOR,OBJ_MINVENT,OBJ_CONTAINED,OBJ_FREE,ROT_CORPSE} from '../js/const.js';
const read=(kind,name)=>JSON.parse(fs.readFileSync(new URL(`gen-sessions/${kind}/${name}${kind==='generated'?'.session':''}.json`,import.meta.url)));
const names=['container-tipping-transfers','container-tipping-guards','quantum-container-tipping','horn-container-tipping'];
const quantity=(list,type)=>list.filter(o=>o.otyp===type).reduce((n,o)=>n+o.quan,0);
function owners(label) {
    const found=[];
    function walk(list,where,parent) {
        for(const o of list||[]) {
            assert.ok(!found.includes(o),label+': unique live owner');found.push(o);
            assert.equal(o.where,where,label+': location');
            if(where===OBJ_MINVENT)assert.equal(o.ocarry,parent,label+': carrier');
            if(where===OBJ_CONTAINED)assert.equal(o.ocontainer,parent,label+': container');
            if(o.cobj)assert.equal(o.owt,weight(o),label+': container weight');
            walk(o.cobj,OBJ_CONTAINED,o);
        }
    }
    walk(game.invent,OBJ_INVENT);walk(game.level.objects,OBJ_FLOOR);
    for(const m of game.level.monsters)walk(m.minvent,OBJ_MINVENT,m);
    return found;
}
let count=0,lossChecks=0;
for(const name of names) {
    const recipe=read('recipes',name),oracle=read('generated',name);
    for(const [i,s]of recipe.segments.entries()) {
        const label=name+':'+s.name;let before;
        if(s.name.startsWith('cursed-loss')) {
            await runSegment({...s,moves:s.moves.slice(0,s.moves.indexOf('#tip')),storage:new InMemoryStorage()});
            before={bag:game.invent.find(o=>o.invlet==='b').cobj.map(o=>({otyp:o.otyp,quan:o.quan})),floor:game.level.objects.map(o=>({otyp:o.otyp,quan:o.quan}))};
        }
        resetInputState();const replay=await runSegment({...s,storage:new InMemoryStorage()});
        const rng=oracle.segments[i].steps.flatMap(t=>t.rng||[]);
        assert.equal(replay.getRngLog().length,rng.length,label+': native RNG total');
        const all=owners(label),b=game.invent.find(o=>o.invlet==='b');
        if(s.name==='cursed-retain-42') {
            // C wizweight reports 670 aum for this generated supply chest.
            const chest=game.level.objects.find(o=>o.otyp===N.CHEST&&o.ox===46&&o.oy===5);
            assert.equal(chest?.owt,670,label+': C supply chest weight');
        }
        assert.equal(game.u.umortality||0,0,label+': no setup death');
        assert.equal(game.iflags.suppress_price||0,0,label+': price suppression restored');
        if(before) {
            const rolls=oracle.segments[i].steps.slice(s.moves.indexOf('#tip')).flatMap(t=>t.rng||[]).filter(r=>r.includes('@ is_boh_item_gone'));
            assert.equal(rolls.length,before.bag.length,label+': one loss decision per item');
            const kept=before.bag.filter((o,j)=>!rolls[j].startsWith('rn2(13)=0'));
            assert.ok(kept.length<before.bag.length,label+': loss actually reached');
            for(const type of new Set(before.bag.map(o=>o.otyp)))
                assert.equal(quantity(game.level.objects,type)-quantity(before.floor,type),quantity(kept,type),label+': C survivors reach floor');
            assert.equal(b.cobj.length,0,label);lossChecks++;
        }
        if(s.name.startsWith('explosion-')&&!s.name.includes('empty-')) {
            assert.equal(quantity(b.cobj,N.APPLE),1,label+': stop leaves unprocessed apple in source');
            assert.ok(!game.invent.some(o=>o.invlet==='c'),label+': destination destroyed');
            assert.ok(!all.some(o=>o.otyp===N.WAN_CANCELLATION),label+': triggering wand removed');
        }
        if(s.name==='explosion-empty-cancellation') {
            assert.equal(b.cobj.length,0,label);
            const target=game.invent.find(o=>o.invlet==='c');
            assert.equal(quantity(target.cobj,N.APPLE),1,label);assert.equal(quantity(target.cobj,N.WAN_CANCELLATION),1,label);
        }
        if(s.name.startsWith('icebox-')) {
            assert.equal(b.cobj.length,0,label);const corpse=all.find(o=>o.otyp===N.CORPSE);
            assert.ok(corpse?.timed,label+': rotting resumed');
            assert.ok(game.timer_base.some(t=>t.arg===corpse&&t.func_index===ROT_CORPSE),label);
            assert.equal(corpse.where,s.name.endsWith('sack')?OBJ_CONTAINED:OBJ_FLOOR,label);
        }
        if(name==='quantum-container-tipping') {
            const box=game.level.objects.find(o=>o.otyp===N.LARGE_BOX);assert.ok(box,label);
            const roll=rng.find(r=>r.includes('@ observe_quantum_cat'));
            if(s.name.includes('tricks')) {
                assert.ok(!roll,label+': destination activated before source observation');assert.equal(box.spe,1,label);
                assert.equal(game.invent.find(o=>o.otyp===N.BAG_OF_TRICKS).spe,1,label);
                assert.equal(box.cobj[0].timed||0,0,label);
            }else {
                assert.ok(roll,label);assert.equal(box.spe,0,label);assert.equal(box.cobj.length,0,label);
                if(roll.startsWith('rn2(2)=0')) {
                    assert.ok(game.level.monsters.some(m=>m.mgivenname==="Schroedinger's Cat"&&m.mpeaceful),label);
                }else {
                    const corpse=all.find(o=>o.oname==="Schroedinger's Cat");assert.ok(corpse?.timed,label);
                    assert.equal(corpse.where,s.name.includes('-bag-')?OBJ_CONTAINED:OBJ_FLOOR,label);
                }
            }
        }
        if(s.name.startsWith('horn-target-'))assert.equal(b.spe,3,label+': rejected target consumes no charges');
        if(name==='horn-container-tipping') {
            const source=all.find(o=>o.otyp===(s.name==='shop-floor-bag-of-tricks'?N.BAG_OF_TRICKS:N.HORN_OF_PLENTY));
            assert.ok(source,label);assert.equal(source.spe,0,label);assert.ok(source.cknown,label);
        }
        if(s.name.includes('shop-horn-unpaid')||s.name==='shop-floor-bag-of-tricks') {
            const shk=game.level.monsters.find(m=>m.isshk).eshk;
            assert.equal(shk.debit,s.name==='shop-floor-bag-of-tricks'?133:67,label+': C quoted usage fee');
            assert.equal(shk.billct,s.name==='shop-floor-bag-of-tricks'?0:s.name.endsWith('sack')?4:1,label+': created items billed only while carried');
        }
        if(s.name==='shop-floor-sold-armor-sack')assert.ok(all.find(o=>o.otyp===N.LEATHER_ARMOR)?.unpaid,label);
        if(s.name==='shop-floor-sold-armor-floor')assert.ok(!all.find(o=>o.otyp===N.LEATHER_ARMOR)?.unpaid,label);
        if(s.name==='cancel-target')assert.equal(quantity(b.cobj,N.APPLE),1,label);
        if(s.name==='toggle-floor')assert.equal(quantity(game.level.objects,N.APPLE),1,label);
        count++;
    }
}
assert.equal(count,72);assert.equal(lossChecks,2);
console.log(`container tipping: ${count} native cases, ownership, timers, explosion order, cursed loss and billing`);

let checks=0;
async function setup() {
    resetInputState();await runSegment({...read('recipes',names[0]).segments[0],moves:' ',storage:new InMemoryStorage()});
    game._preNhgetchHook=null;game._toplin=0;game._win_stop=false;game.invent=[];
    resetInputState();pushKeys(' '.repeat(80));checks++;
}
const obj=(type,fields={})=>Object.assign(mksobj(type,false,false),{where:OBJ_INVENT,invlet:'a'},fields);
for(const [type,allowempty,want]of [[N.SACK,false,4],[N.SACK,true,0],[N.LARGE_BOX,false,1]]) {
    await setup();const box=obj(type,{cobj:[],olocked:type===N.LARGE_BOX?1:0});game.invent=[box];
    assert.equal(await tipcontainer_checks(box,null,allowempty),want);assert.ok(box.lknown);
}
const seeds=[0,1].map(want=>{for(let seed=1;;seed++){initRng(seed);if(rn2(2)===want)return seed;}});
for(const [alive,allowempty,want]of [[true,false,4],[true,true,0],[false,false,0],[false,true,0]]) {
    await setup();const box=obj(N.LARGE_BOX,{spe:1,cobj:[]}),corpse=obj(N.CORPSE,{where:OBJ_FREE,corpsenm:P.PM_HOUSECAT});
    add_to_container(box,corpse);stop_timer(ROT_CORPSE,corpse);box.owt=weight(box);game.invent=[box];
    initRng(seeds[alive?0:1]);assert.equal(await tipcontainer_checks(box,null,allowempty),want);
    assert.equal(box.spe,0);assert.ok(box.cknown);assert.equal(box.cobj.length,alive?0:1);
}
await setup();const source=obj(N.HORN_OF_PLENTY,{spe:2,blessed:1}),target=obj(N.SACK,{cobj:[],invlet:'b'});game.invent=[source,target];
assert.equal(await hornoplenty(source,true,target),1);assert.equal(source.spe,1);assert.equal(target.cobj.length,1);
assert.ok(target.cobj[0].blessed);assert.equal(target.cobj[0].ocontainer,target);assert.equal(target.owt,weight(target));
console.log(`container tipping: ${checks} constructed source controls`);
