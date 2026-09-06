#!/usr/bin/env node

// C invent.c dotypeinv/dounpaid/find_unpaid, mkobj.c unknown containers,
// objnam.c distant_name. Constructed states earn no native coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {resetInputState,pushKeys} from '../js/input.js';
import {dotypeinv,dounpaid,find_unpaid,count_unpaid} from '../js/invent.js';
import {mksobj,unknwn_contnr_contents} from '../js/mkobj.js';
import {distant_name} from '../js/objnam.js';
import {ONAMES as N} from '../js/objects_data.js';
import {OBJ_INVENT,OBJ_CONTAINED,OBJ_FLOOR,OBJ_BURIED,OBJ_MINVENT,OBJ_FREE,
    MENU_TRADITIONAL,IN_SIGHT} from '../js/const.js';
import {decodeScreen} from './gen-sessions/screen-decode.mjs';

const read=(name,dir='recipes')=>JSON.parse(fs.readFileSync(new URL(
    `gen-sessions/${dir}/${name}${dir==='generated'?'.session':''}.json`,import.meta.url)));
function objects(list) {
    return (list||[]).map(o=>({id:o.o_id,type:o.otyp,quan:o.quan,where:o.where,
        unpaid:!!o.unpaid,worn:o.owornmask||0,parent:o.ocontainer?.o_id,
        contents:objects(o.cobj)}));
}
const bills=()=>game.level.monsters.filter(m=>m.isshk).map(m=>structuredClone(m.eshk.bill_p));
let replays=0,prices=0;
for(const name of ['inventory-type-queries','unpaid-inventory-display']) {
    const native=read(name,'generated');
    for(const[i,s]of read(name).segments.entries()) {
        const k=s.moves.lastIndexOf('I'),label=name+':'+s.name;assert.ok(k>=0,label);
        await runSegment({...s,moves:s.moves.slice(0,k),storage:new InMemoryStorage()});
        const before={items:objects(game.invent),bill:bills(),moves:game.moves};
        await runSegment({...s,storage:new InMemoryStorage()});replays++;
        assert.deepEqual(objects(game.invent),before.items,label+': query preserves ownership and quantities');
        assert.deepEqual(bills(),before.bill,label+': query preserves bills');
        assert.equal(game.moves,before.moves,label+': query spends no turns');
        assert.deepEqual(game.impossible_log||[],[],label);
        assert.deepEqual(game.rc.errors,[],label);
        assert.equal(game.this_type||0,0,label);assert.equal(game.this_title||null,null,label);
        assert.equal(game.iflags.suppress_price||0,0,label);
        assert.equal(game.distantname||0,0,label);
        if(name==='unpaid-inventory-display') {
            const rows=decodeScreen(native.segments[i].steps[k+2].screen);
            const amounts=rows.map(r=>r.match(/(?:[-] .*?) (\d+) zorkmids/)).filter(Boolean).map(m=>Number(m[1]));
            assert.ok(amounts.length,label);prices+=amounts.length;
            const costs=[];
            const walk=list=>{for(const o of list||[]){if(o.unpaid){const bp=bills().flat().find(b=>b.bo_id===o.o_id);assert.ok(bp,label);costs.push(bp.price*o.quan);}walk(o.cobj);}};
            walk(game.invent);
            const total=costs.reduce((a,b)=>a+b,0);
            const hasTotal=rows.some(r=>r.includes('Total:'));
            assert.deepEqual(amounts,hasTotal?[...costs,total]:costs,label+': prices observed in C');
        }
    }
}
assert.equal(replays,91);
console.log(`inventory types: ${replays} native queries preserve state; ${prices} C price observations PASS`);

const source=read('unpaid-inventory-display').segments.find(s=>s.name==='single-4');
const prefix=source.moves.slice(0,source.moves.lastIndexOf('I'));
let snapshots=[],keeper,groups=0;
const rows=()=>game.nhDisplay.grid.map(r=>r.map(c=>c.ch).join(''));
const text=()=>[...snapshots.flat(),...rows()].join('\n');
async function setup(keys='\x1b') {
    resetInputState();await runSegment({...source,moves:prefix,storage:new InMemoryStorage()});
    game._toplin=0;game._pending_message='';game._win_stop=false;
    snapshots=[];game._preNhgetchHook=()=>{snapshots.push(rows());};
    game.invent=[];keeper=game.level.monsters.find(m=>m.isshk);
    keeper.eshk.bill_p=[];keeper.eshk.billct=0;
    resetInputState();pushKeys(keys+' '.repeat(80));groups++;
}
function obj(type=N.APPLE,fields={},parent=null) {
    const o=Object.assign(mksobj(type,true,false),{quan:3,invlet:'a',where:OBJ_INVENT,bknown:0},fields);
    if(parent){o.where=OBJ_CONTAINED;o.ocontainer=parent;(parent.cobj||=[]).push(o);}
    else game.invent.push(o);
    return o;
}
function billed(type=N.APPLE,fields={},parent=null,price=7) {
    const o=obj(type,{...fields,unpaid:1},parent);
    keeper.eshk.bill_p.push({bo_id:o.o_id,bquan:o.quan,price,useup:0});keeper.eshk.billct++;
    return o;
}

await setup();const bag=obj(N.SACK,{quan:1,cknown:1,cobj:[]}),nested=obj(N.SACK,{quan:1,cknown:0,cobj:[]},bag);
const apple=billed(N.APPLE,{},nested),stone=billed(N.DIAMOND,{invlet:'b'});
let marker={v:null};assert.equal(find_unpaid(game.invent,marker),apple);
assert.equal(find_unpaid(game.invent,marker),stone);assert.equal(find_unpaid(game.invent,marker),null);
assert.equal(marker.v,null);assert.equal(find_unpaid(game.invent,marker),apple,'exhausted cursor restarts');
marker={v:{}};const missing=marker.v;assert.equal(find_unpaid(game.invent,marker),null);assert.equal(marker.v,missing);
assert.equal(unknwn_contnr_contents(apple),nested);bag.cknown=0;assert.equal(unknwn_contnr_contents(apple),bag);
nested.cknown=1;assert.equal(unknwn_contnr_contents(apple),bag);bag.cknown=1;assert.equal(unknwn_contnr_contents(apple),null);
assert.equal(unknwn_contnr_contents(stone),null);

await setup();billed();game.iflags.suppress_price=2;await dounpaid(1,0,0);
assert.match(text(),/a - 3 apples +21 zorkmids/);assert.doesNotMatch(text(),/Unpaid Comestibles|Total:/);
assert.equal(game.iflags.suppress_price,2);assert.equal(count_unpaid(game.invent),1);
for(const known of [false,true]) {
    await setup();const box=obj(N.SACK,{quan:1,cknown:Number(known),cobj:[]});billed(N.APPLE,{},box);
    await dounpaid(1,0,0);assert.equal(game.iflags.suppress_price||0,0);
    if(known){assert.match(text(),/> - 3 apples +21 zorkmids/);assert.doesNotMatch(text(),/Total:/);}
    else {assert.match(text(),/contents +21 zorkmids/);assert.match(text(),/Total: +21 zorkmids/);assert.doesNotMatch(text(),/3 apples/);}
}
for(const sortpack of [false,true]) {
    await setup();game.flags.sortpack=sortpack;billed();billed(N.DIAMOND,{invlet:'b',quan:2},null,11);
    const before=structuredClone(keeper.eshk.bill_p);await dounpaid(2,0,0);
    assert.match(text(),/Total: +43 zorkmids/);assert.equal(text().includes('Unpaid Comestibles'),sortpack);
    assert.deepEqual(keeper.eshk.bill_p,before);
}
for(const [floor,buried,where]of [[1,0,'on the floor'],[0,1,'under the floor'],[1,1,'on or under the floor']]) {
    for(const carry of [false,true]) {
        await setup();if(carry)billed();await dounpaid(carry?1:0,floor,buried);
        assert.ok(text().includes(where));assert.equal(text().includes('Total:'),carry);
        if(!carry)assert.match(text(),/aren't carrying any unpaid items but there/);
    }
}
await setup();const parent=billed(N.SACK,{quan:1,cobj:[],cknown:1},null,5);
billed(N.APPLE,{quan:2},parent,7);await dounpaid(2,0,0);assert.match(text(),/Total: +19 zorkmids/);
assert.match(text(),/Unpaid Bagged\/Boxed items/);

// Empty inventory is checked before floor-only debt. With inventory present,
// traditional u can report unpaid objects outside the inventory.
await setup('u');game.flags.menu_style=MENU_TRADITIONAL;
const floorobj=obj(N.APPLE,{where:OBJ_FLOOR,unpaid:1});game.invent=[];game.level.objects.push(floorobj);
await dotypeinv();assert.match(text(),/aren't carrying anything/);
await setup('u');game.flags.menu_style=MENU_TRADITIONAL;obj();
game.level.buriedobjs=[{where:OBJ_BURIED,unpaid:1}];await dotypeinv();assert.match(text(),/1 under the floor/);
await setup('U');game.flags.menu_style=MENU_TRADITIONAL;billed(N.APPLE,{bknown:0});
await dotypeinv();assert.match(text(),/a - 3 apples +21 zorkmids/);

// Resolve ownership and visibility separately from geometric distance.
for(const [where,dx,dy,xray,artifact,visible,want]of [
    [OBJ_INVENT,20,20,0,false,true,0],
    [OBJ_FLOOR,2,1,0,false,true,0],[OBJ_FLOOR,2,2,0,false,true,1],
    [OBJ_FLOOR,3,0,0,false,true,1],[OBJ_FLOOR,3,0,3,false,true,0],
    [OBJ_FLOOR,4,0,3,false,true,1],[OBJ_FLOOR,4,0,0,true,true,0],
    [OBJ_FLOOR,1,0,0,true,false,1],
    [OBJ_CONTAINED,0,0,0,false,true,1],[OBJ_BURIED,0,0,0,false,true,1],
    [OBJ_FREE,0,0,0,false,true,1],[OBJ_MINVENT,0,0,0,false,true,0],
]) {
    await setup();const x=game.u.ux+dx,y=game.u.uy+dy;
    game.u.xray_range=xray;
    if(where===OBJ_FLOOR)game.viz_array[y][x]=visible?IN_SIGHT:0;
    const o=obj(N.APPLE,{where,ox:x,oy:y,oartifact:artifact?1:0,ocarry:{mx:game.u.ux,my:game.u.uy}});
    assert.equal(distant_name(o,()=>game.distantname||0),want,JSON.stringify([where,dx,dy,xray,artifact,visible]));
    assert.equal(game.distantname||0,0);
}
await setup();const o=obj(),id=o.o_id;game.program_state.gameover=true;
assert.equal(distant_name(o,p=>p.o_id),0);assert.equal(o.o_id,id);
game.program_state.gameover=false;assert.equal(distant_name(o,p=>p.o_id),id);
game.distantname=2;o.where=OBJ_FREE;assert.equal(distant_name(o,()=>game.distantname),3);assert.equal(game.distantname,2);
assert.deepEqual(game.impossible_log||[],[]);
console.log(`inventory types: ${groups} constructed control groups PASS`);
