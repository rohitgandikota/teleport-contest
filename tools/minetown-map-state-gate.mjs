#!/usr/bin/env node
// C sp_lev.c:lspo_region classification and shknam.c:shtypes annotations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {GameMap} from '../js/game.js';
import {InMemoryStorage} from '../js/storage.js';
import {resetInputState,pushKeys} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {lspo_region_full,flip_level} from '../js/sp_lev.js';
import {get_level_extends} from '../js/mklev.js';
import {init_mapseen,show_overview} from '../js/dungeon.js';
import {tty_create_nhwindow,tty_destroy_nhwindow,tty_get_nhwindow,NHW_MENU} from '../js/tty/wintty.js';
import {ROOM,HWALL,SHOPBASE} from '../js/const.js';
import {decodeScreen} from './gen-sessions/screen-decode.mjs';

const read=part=>JSON.parse(fs.readFileSync(new URL(`gen-sessions/${part}/minetown-map-flags${part==='generated'?'.session':''}.json`,import.meta.url)));
const recipe=read('recipes'),native=read('generated');
const normalize=lines=>lines.filter(s=>/^(rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(s)).map(s=>s.replace(/\s*@.*$/,''));
let replays=0,stairs=0,groups=0;const variants=new Set(),orientations=new Set();
for(const [index,s]of recipe.segments.entries()){
    const oracle=native.segments[index],rng=oracle.steps.flatMap(t=>t.rng||[]);
    const variant=+rng.find(t=>t.includes('@ makemaz(mkmaze.c:1136)')).match(/=(\d+)/)[1];
    const flips=rng.filter(t=>t.includes('@ flip_level_rnd(')).map(t=>+t.match(/=(\d+)/)[1]);
    variants.add(variant);orientations.add(flips[0]+2*flips[1]);
    const result=await runSegment({...s,storage:new InMemoryStorage()});
    assert.deepEqual(normalize(result.getRngLog()),normalize(rng),s.name+': native RNG');
    assert.deepEqual(game.impossible_log||[],[],s.name);
    assert.deepEqual(game.rc.errors,[],s.name);
    // minetn-1 and -6 call mines initialization with joined+walled, which
    // mkmap classifies as cavernous. Only minetn-5 retains mazelevel;
    // minetn-2/3/4/7 keep create_des_coder's initial zero maze flag.
    const cave=variant===1||variant===6;
    assert.equal(!!game.level.flags.is_maze_lev,variant===5,s.name+': C classification');
    assert.equal(!!game.level.flags.is_cavernous_lev,cave,s.name+': C cavern flag');
    const mapped=decodeScreen(oracle.steps[s.moves.indexOf('#wizmap\r')+8].screen);
    for(let y=1;y<=21;y++)for(let x=0;x<80;x++)if('<>'.includes(mapped[y][x])){
        const up=mapped[y][x]==='<';let stair=game.stairs;
        while(stair&&!(stair.sx===x+1&&stair.sy===y-1&&!!stair.up===up))stair=stair.next;
        assert.ok(stair,s.name+': native mapped stair '+(x+1)+','+(y-1));stairs++;
    }
    replays++;
}
assert.equal(replays,25);assert.equal(stairs,50);assert.equal(variants.size,7);assert.equal(orientations.size,4);
console.log(`${replays} native replays, ${stairs} mapped stair positions, seven variants/four orientations PASS`);

async function setup(){
    resetInputState();await runSegment({...recipe.segments[0],moves:' ',storage:new InMemoryStorage()});
    game.level=new GameMap();game.stairs=null;game.xstart=game.ystart=0;game.coder=null;
    game.u.ux=40;game.u.uy=10;game.u.urooms='';game.u.ushops='';game.u.uz={dnum:0,dlevel:1};
    game._preNhgetchHook=null;game._toplin=0;game._pending_message='';game._win_stop=false;
    resetInputState();groups++;
}
// Preserve both incoming flags through the lighting, rectangle, irregular,
// and arrival-room forms. No constructed case earns native C coverage.
for(const maze of [false,true])for(const cavern of [false,true])for(const opts of [
    {area:[10,5,14,9],lit:1},
    {region:[10,5,14,9],lit:0},
    {region:[10,5,14,9],lit:1,type:'shop'},
    {region:[10,5,14,9],lit:1,type:'temple'},
    {region:[10,5,14,9],lit:1,irregular:true},
    {region:[10,5,14,9],lit:1,arrival_room:true},
]){
    await setup();Object.assign(game.level.flags,{is_maze_lev:maze,is_cavernous_lev:cavern});
    for(let x=10;x<=14;x++)for(let y=5;y<=9;y++)game.level.at(x,y).typ=ROOM;
    const count=getRngLog().length;lspo_region_full(opts);
    assert.equal(game.level.flags.is_maze_lev,maze,'region preserves maze flag');
    assert.equal(game.level.flags.is_cavernous_lev,cavern,'region preserves cavern flag');
    assert.equal(game.level.nroom,opts.type||opts.irregular||opts.arrival_room?1:0,'C room creation arm');
    assert.equal(getRngLog().length,count,'explicit lighting draws no RNG');
}
// C's wall-only edge gets padding on a non-maze map. An interior typed
// region must not change those bounds or the resulting mirror coordinates.
for(const maze of [false,true]){
    await setup();Object.assign(game.level.flags,{is_maze_lev:maze,is_cavernous_lev:!maze});
    for(let x=10;x<=20;x++)for(let y=5;y<=10;y++)game.level.at(x,y).typ=(x===10||x===20||y===5||y===10)?HWALL:ROOM;
    game.level.at(20,7).typ=ROOM;
    const expected=maze?{xmin:10,xmax:21,ymin:5,ymax:10}:{xmin:9,xmax:21,ymin:4,ymax:11};
    assert.deepEqual(get_level_extends(),expected);lspo_region_full({region:[12,6,16,8],type:'temple',lit:1});
    assert.deepEqual(get_level_extends(),expected,'region preserves C mirror boundary');
    const marked=structuredClone(game.level.at(12,7));
    flip_level(3,false);assert.deepEqual(game.level.at(maze?19:18,8),marked,'C mirrored terrain');
}

// Exercise the renderer with every C table entry, general-store fallback,
// and the special untended-shop label (shoptype zero).
const labels=['general store','armor shop','scroll shop','potion shop','weapon shop','food shop','ring shop','wand shop','tool shop','bookstore','vegetarian food shop','lighting shop'];
for(const [type,label]of [...labels.map((s,i)=>[SHOPBASE+i,s]),[0,'untended shop']]){
    await setup();game.mapseen={};game.wizard=false;init_mapseen({dnum:0,dlevel:2});
    game.mapseen['0:2'].feat={nshop:1,shoptype:type};
    const marker=tty_create_nhwindow(NHW_MENU);tty_destroy_nhwindow(marker);let items;
    game._preNhgetchHook=()=>{const win=tty_get_nhwindow(marker+1);if(win?.mlist&&!items){items=[];for(let p=win.mlist;p;p=p.next)items.push(p.str);}};
    const count=getRngLog().length;pushKeys(' ');
    try{await show_overview(0,0);}finally{game._preNhgetchHook=null;}
    assert.ok(items,'overview reached input');
    const article=/^[aeiou]/.test(label)?'An':'A';
    assert.ok(items.some(s=>s.trim()===`${article} ${label}.`),'C overview label: '+label);
    assert.equal(tty_get_nhwindow(marker+1),undefined);assert.equal(getRngLog().length,count);
}
console.log(`${groups} constructed C-derived groups PASS`);
