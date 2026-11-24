#!/usr/bin/env node
// Source-derived controls for C's projectile delay and flush boundaries.
// These run the complete caller bodies with world interactions stubbed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import * as C from '../js/const.js';
import {ONAMES} from '../js/objects_data.js';

function extract(source, name) {
    const re = new RegExp(`(?:export )?(?:async )?function ${name}\\([\\s\\S]*?^\\}`, 'm');
    const match = source.match(re);
    assert.ok(match, name);
    return match[0].replace(/^export /, '');
}
function body(file, name) {
    const source = readFileSync(new URL(`../js/${file}.js`, import.meta.url), 'utf8');
    return extract(source, name).replace(/import\('([^']+)'\)/g,
        (_, path) => `Promise.resolve(__imports[${JSON.stringify(path)}])`);
}
const tmpBody = extract(readFileSync(new URL('../js/display.js', import.meta.url), 'utf8'), 'tmp_at');

function setup(visible, {animation = true} = {}) {
    const events = [], frames = [], buffer = new Map(), physical = new Map();
    const obj = {otyp:ONAMES.BOULDER, quan:1, ox:4, oy:6};
    const floor = [obj];
    let samples = 0;
    const game = {u:{ux:1,uy:6}, iflags:{}, level:{at:()=>({typ:C.ROOM})},
        nhDisplay:{setCursor:(x,y)=>events.push(['cursor',x,y])}};
    if (animation) game.animationFrame=async()=>{
        frames.push([...physical]); events.push(['delay']);
    };
    const context = vm.createContext({
        ...C, ONAMES, game,
        __imports:{'./dokick.js':{down_gate:()=>-1}, './do.js':{flooreffects:async()=>false}},
        cansee:(x,y)=>visible.includes(x),
        sobj_at:(otyp,x,y)=>floor.find(o=>o.otyp===otyp && o.ox===x && o.oy===y),
        obj_extract_self:o=>floor.splice(floor.indexOf(o),1),
        place_object:(o,x,y)=>{o.ox=x;o.oy=y;floor.unshift(o);},
        newsym:(x,y)=>{buffer.set(`${x},${y}`,'.');events.push(['restore',x,y]);},
        temporary_object_glyph:()=>{samples++;return {ch:'`',color:8,dec:false,glyph:{kind:'obj',otyp:ONAMES.BOULDER}};},
        show_glyph_cell:(x,y,ch)=>{buffer.set(`${x},${y}`,ch);events.push(['show',x,y]);},
        display_object_at:(_obj,x,y,g)=>{buffer.set(`${x},${y}`,g.ch);events.push(['show',x,y]);},
        flush_screen:async()=>{for(const [k,v] of buffer)physical.set(k,v);events.push(['flush']);},
        isok:(x,y)=>x>=1&&x<C.COLNO&&y>=0&&y<C.ROWNO,
        m_at:()=>null,t_at:()=>null,closed_door:()=>false,
        maybe_unhide_at:()=>{},
        digging_context:()=>({pos:{x:0,y:0}}),
        clear_digging_context:()=>{throw Error('unmatched digging context reset');},
        flooreffects:async()=>false,
        Hallucination:()=>false,Deaf:()=>false,
        You_see:async()=>{},You_hear:async()=>{},pline:async()=>{},
        an:x=>x,xname:()=> 'boulder',distu:()=>9,
        rn2:()=>{throw Error('unexpected core RNG draw');},
        rn2_on_display_rng:()=>{throw Error('unexpected display RNG draw');},
        is_pick:()=>false,glyph_at:()=>({kind:'cmap'}),glyph_is_invisible_at:()=>false,
        transient_light_cleanup:async()=>{},
    });
    vm.runInContext(tmpBody,context);
    vm.runInContext(body('trap','launch_drop_spot'),context);
    vm.runInContext(body('trap','launch_obj'),context);
    vm.runInContext(body('zap','bhit'),context);
    return {game,events,frames,buffer,physical,obj,floor,context,get samples(){return samples;}};
}

for(const [name,style,visible,count] of [
    ['rolling',C.ROLL,[4,5,6,7],8],
    ['known rolling',C.ROLL|C.LAUNCH_KNOWN,[4,5,6,7],8],
    ['unseen rolling flag',C.ROLL|C.LAUNCH_UNSEEN,[4,5,6,7],8],
    ['partly visible rolling',C.ROLL,[5,6],4],
    ['hidden rolling',C.ROLL,[],0],
    ['ordinary launch',0,[4,5,6,7],4],
]) {
    test(`${name}: C delay count, captured glyph and final object`,async()=>{
        const s=setup(visible);
        assert.equal(await s.context.launch_obj(ONAMES.BOULDER,4,6,8,6,style),1);
        assert.equal(s.frames.length,count);
        assert.equal(s.samples,1);
        assert.equal(s.floor.length,1);
        assert.equal(s.obj.ox,8);assert.equal(s.obj.oy,6);assert.equal(s.obj.otrapped,0);
        assert.equal(s.game.tmp_glyph,undefined);
        const frameX=s.frames.map(frame=>Number(frame.find(([,ch])=>ch==='`')[0].split(',')[0]));
        assert.deepEqual(frameX,visible.flatMap(x=>Array(style&C.ROLL?2:1).fill(x)));
        const cursor=s.events.filter(e=>e[0]==='cursor');
        assert.deepEqual(cursor,visible.includes(4)?[]:[['cursor',0,7]]);
    });
}

test('launch without animation callback still restores its glyph and lands',async()=>{
    const s=setup([4,5,6,7],{animation:false});
    assert.equal(await s.context.launch_obj(ONAMES.BOULDER,4,6,8,6,C.ROLL),1);
    assert.equal(s.samples,1);assert.equal(s.obj.ox,8);
    assert.equal(s.game.tmp_glyph,undefined);
});

for(const [name,visible,expected] of [
    ['visible then hidden',[2], [['`',null,null],['`',null,null],['`',null,null]]],
    ['hidden then visible',[4], [[null,null,null],[null,null,null],[null,null,'`']]],
    ['visible after a hidden square',[2,4], [['`',null,null],['`',null,null],['.',null,'`']]],
    ['all visible',[2,3,4], [['`',null,null],['.','`',null],['.','.','`']]],
    ['all hidden',[], [[null,null,null],[null,null,null],[null,null,null]]],
]) {
    test(`bhit ${name}: delay observes C's physical screen`,async()=>{
        const s=setup(visible), obj={otyp:ONAMES.FLINT,quan:1};
        assert.equal(await s.context.bhit(1,0,3,C.THROWN_WEAPON,null,null,{obj}),null);
        assert.deepEqual(s.frames.map(frame=>{const grid=new Map(frame);return [2,3,4].map(x=>grid.get(`${x},6`)??null);}),expected);
        assert.equal(s.samples,1);
        assert.equal(s.frames.length,3);
    });
}

test('bhit without animation callback still flushes visible missile glyphs',async()=>{
    const s=setup([2],{animation:false}),obj={otyp:ONAMES.FLINT,quan:1};
    await s.context.bhit(1,0,1,C.THROWN_WEAPON,null,null,{obj});
    assert.equal(s.physical.get('2,6'),'`');
    assert.equal(s.buffer.get('2,6'),'.');
});
