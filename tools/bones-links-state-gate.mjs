#!/usr/bin/env node
// C restore.c:getlev branch repair, checked at real load and travel boundaries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {GameMap} from '../js/game.js';
import {InMemoryStorage} from '../js/storage.js';
import {resetInputState} from '../js/input.js';
import {getbones_load} from '../js/bones.js';
import {decodeScreen} from './gen-sessions/screen-decode.mjs';
import {BR_STAIR,BR_NO_END1,BR_NO_END2,BR_PORTAL,MAGIC_PORTAL,PIT} from '../js/const.js';

const read=(part,name)=>JSON.parse(fs.readFileSync(new URL(`gen-sessions/${part}/${name}.json`,import.meta.url)));
const normalize=lines=>lines.filter(s=>/^(rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(s)).map(s=>s.replace(/\s*@.*$/,''));
let replays=0,links=0,travels=0,groups=0;
for(const name of ['bones-branch-stairs','bones-quest-eligibility']){
    const recipe=read('recipes',name),native=read('generated',name+'.session'),storage=new InMemoryStorage();
    for(const[index,s]of recipe.segments.entries()){
        const label=name+':'+s.name,oracle=native.segments[index];let boneKey=null;
        const final=decodeScreen(oracle.steps.at(-1).screen).join('\n');
        const parent=final.match(/Level (\d+): <- You are here\./);
        globalThis.__step_snapshot={step:'*',cb:(_,step)=>{
            const top=decodeScreen(oracle.steps[step].screen)[0];
            if(top.includes('Save bones?'))boneKey=`bones:${game.u.uz.dnum}.${game.u.uz.dlevel}`;
            if(top.includes('Unlink bones?')){
                assert.ok(parent,label+': native final destination');
                assert.equal(game.u.uz.dlevel,1,label+': branch entry loaded');
                let stair=game.stairs;while(stair&&stair.tolev.dnum===game.u.uz.dnum)stair=stair.next;
                assert.ok(stair,label+': exit staircase');
                assert.deepEqual(stair.tolev,{dnum:0,dlevel:+parent[1]},label+': destination matches native return');
                assert.equal(game.oldfruit,null,label+': temporary fruit chain released');links++;
            }
            if(parent&&step===s.moves.lastIndexOf('<')+1){
                assert.deepEqual(game.u.uz,{dnum:0,dlevel:+parent[1]},label+': actual native stair travel');travels++;
            }
        }};
        let result;
        try{result=await runSegment({...s,storage});}finally{delete globalThis.__step_snapshot;}
        assert.deepEqual(normalize(result.getRngLog()),normalize(oracle.steps.flatMap(t=>t.rng||[])),label+': native RNG');
        assert.deepEqual(game.impossible_log||[],[],label);
        if(boneKey)assert.ok(storage.getItem(boneKey),label+': bones written');
        if(name==='bones-quest-eligibility'){
            assert.ok(oracle.steps.every(t=>!/(?:Save|Get|Unlink) bones\?/.test(decodeScreen(t.screen)[0])),label);
            assert.equal(storage.getItem(`bones:${game.u.uz.dnum}.${game.u.uz.dlevel}`),null,label+': Quest bones absent');
        }
        if(parent)assert.deepEqual(game.u.uz,{dnum:0,dlevel:+parent[1]},label+': native final level');
        replays++;
    }
}
assert.equal(replays,10);assert.equal(links,4);assert.equal(travels,4);
console.log(`${replays} native replays, ${links} restored stair destinations, ${travels} native return levels PASS`);

const base=read('recipes','bones-branch-stairs').segments[0];
async function setup(level={dnum:1,dlevel:1}){
    resetInputState();await runSegment({...base,moves:' ',storage:new InMemoryStorage()});
    game.level=new GameMap();game.invent=[];game.timer_base=[];game.light_sources=[];
    game.u.uz={...level};game.u.urooms='';game.u.ushops='';game.wizard=false;
    game._preNhgetchHook=null;game._toplin=0;game._pending_message='';game._win_stop=false;resetInputState();groups++;
}
async function load(stairs=[],traps=[]){
    game.storage.setItem(`bones:${game.u.uz.dnum}.${game.u.uz.dlevel}`,JSON.stringify({
        moves:game.moves,cells:game.level.locations,flags:{},rooms:[],objects:[],
        monsters:[],buried:[],stairs,traps,updest:{},dndest:{},bonesinfo:null}));
    return getbones_load();
}
const stair=tolev=>({sx:5,sy:5,up:true,isladder:false,u_traversed:false,tolev});
const portal=dst=>({tx:8,ty:8,ttyp:MAGIC_PORTAL,dst});
const destination={dnum:0,dlevel:7},obsolete={dnum:0,dlevel:2};

// All three staircase branch types, with either endpoint as the current level.
// Skip local stairs and change only the first staircase leading out.
for(const type of [BR_STAIR,BR_NO_END1,BR_NO_END2])for(const first of [false,true]){
    await setup();const local={...game.u.uz};
    game.branches=[{type,end1:first?local:{...destination},end2:first?{...destination}:local}];
    const original=structuredClone(game.branches);
    assert.equal(await load([stair({dnum:1,dlevel:2}),stair(obsolete),stair({dnum:2,dlevel:4})]),true);
    assert.deepEqual(game.stairs.tolev,{dnum:1,dlevel:2});
    assert.deepEqual(game.stairs.next.tolev,destination);
    assert.deepEqual(game.stairs.next.next.tolev,{dnum:2,dlevel:4});
    assert.deepEqual(game.branches,original,'repair must not mutate the branch record');
}
for(const first of [false,true]){
    await setup();const local={...game.u.uz};
    game.branches=[{type:BR_PORTAL,end1:first?local:{...destination},end2:first?{...destination}:local}];
    assert.equal(await load([], [{tx:3,ty:4,ttyp:PIT},portal(obsolete)]),true);
    assert.deepEqual(game.level.traps[1].dst,destination);
    assert.equal(game.level.traps[0].ttyp,PIT);
}
await setup();game.branches=[{type:BR_STAIR,end1:{...destination},end2:{...game.u.uz}}];
assert.equal(await load([stair({dnum:1,dlevel:2})]),true);
assert.deepEqual(game.stairs.tolev,{dnum:1,dlevel:2},'absent cross-branch staircase stays absent');

// A matching branch away from its first level does not enter either repair arm.
await setup({dnum:1,dlevel:2});game.branches=[{type:BR_STAIR,end1:{...destination},end2:{...game.u.uz}}];
assert.equal(await load([stair(obsolete)],[portal(obsolete)]),true);
assert.deepEqual(game.stairs.tolev,obsolete);
assert.equal(game.level.traps.length,1,'matching branch outside entry retains its portal');
assert.deepEqual(game.level.traps[0].dst,obsolete);

// No branch at this level: remove dangling portals and retain ordinary traps.
await setup();game.branches=[{type:BR_PORTAL,end1:{dnum:0,dlevel:12},end2:{dnum:3,dlevel:1}}];
assert.equal(await load([stair(obsolete)],[portal(obsolete),{tx:3,ty:4,ttyp:PIT}]),true);
assert.deepEqual(game.level.traps,[{tx:3,ty:4,ttyp:PIT}]);assert.deepEqual(game.stairs.tolev,obsolete);

// Diagnostic control for the explicit C panic, not a playable native state.
await setup();game.branches=[{type:BR_PORTAL,end1:{...destination},end2:{...game.u.uz}}];
await assert.rejects(load(),/getlev: need portal but none found/);
assert.equal(game.oldfruit,null,'getlev releases temporary fruits before branch repair');
console.log(`${groups} constructed C-derived groups PASS (including one diagnostic guard)`);
