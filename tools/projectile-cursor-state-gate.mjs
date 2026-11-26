#!/usr/bin/env node
// Source-derived caller controls, not a native recording or compiled C oracle.
// C: zap.c:3861-3868; dothrow.c:1442-1455; display.c:1194;
// win/tty/wintty.c:1077-1087; win/tty/termcap.c:1022.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import * as C from '../js/const.js';
import * as D from '../js/display.js';
import * as T from '../js/terminal.js';
import {ONAMES,OCLASSES} from '../js/objects_data.js';
import {cmap_names} from '../js/drawing_data.js';

const input=JSON.parse(readFileSync(new URL('gen-sessions/recipes/class-glyph-startup.json',import.meta.url)));
const cursor=()=>[game.nhDisplay.cursorCol,game.nhDisplay.cursorRow];
const rng=()=>({core:structuredClone(game.coreCtx),display:structuredClone(game.dispCtx)});
function body(file,name) {
    const source=readFileSync(new URL(`../js/${file}.js`,import.meta.url),'utf8');
    const match=source.match(new RegExp(`(?:export )?(?:async )?function ${name}\\([\\s\\S]*?^\\}`,'m'));
    assert.ok(match,name);
    return match[0].replace(/^export /,'').replace(/import\('([^']+)'\)/g,
        (_,path)=>`Promise.resolve(__imports[${JSON.stringify(path)}])`);
}
async function setup(visible=()=>true) {
    await runSegment({...input.segments[0],moves:' ',storage:new InMemoryStorage()});
    game.gbuf=[];
    game.disp={botl:0,botlx:0,time_botl:0};
    game._flush_cursor_override=game._map_cursor=null;
    game._delay_flushing=false;
    game._toplin=D.TOPLINE_NON_EMPTY;
    game._pending_message='In what direction?';
    game._topline_physical_prefix='';
    game.u.ux=8;game.u.uy=4;game.u.dx=-1;game.u.dy=0;
    game.iflags.returning_missile=null;
    game.nhDisplay.setCursor(19,0);
    const cells=new Map();
    game.level={objects:[],at:(x,y)=>{
        const key=`${x},${y}`;
        if(!cells.has(key))cells.set(key,{typ:C.ROOM});
        return cells.get(key);
    }};
    const events=[],frames=[];
    const obj={otyp:ONAMES.FLINT,quan:1};
    const showFloor=(x,y)=>D.show_glyph_cell(x,y,'.',T.NO_COLOR,false,0,
        {kind:'cmap',cmap:cmap_names.S_room});
    game.animationFrame=async()=>{frames.push({cursor:cursor(),grid:game.nhDisplay.terminal.serialize()});events.push('delay');};
    const context=vm.createContext({
        ...C,...T,game,ONAMES,OCLASSES,cmap_names,
        __imports:{'./dokick.js':{down_gate:()=>-1},'./do.js':{flooreffects:async()=>false}},
        cansee:visible,
        isok:(x,y)=>x>=1&&x<C.COLNO&&y>=0&&y<C.ROWNO,
        newsym:(x,y)=>{events.push('restore');showFloor(x,y);},
        temporary_object_glyph:()=>{
            events.push('capture');
            return {ch:'*',color:T.CLR_GRAY,dec:false,glyph:{kind:'effect',glyphnum:C.GLYPH_OBJ_OFF+ONAMES.FLINT}};
        },
        display_object_at:(...args)=>{events.push('show');D.display_object_at(...args);},
        display_cmap_at:(...args)=>{events.push('show');D.display_cmap_at(...args);},
        flush_screen:async mode=>{events.push('flush');await D.flush_screen(mode);},
        m_at:()=>null,t_at:()=>null,closed_door:()=>false,
        costly_spot:()=>false,ship_object:async()=>false,
        Blind:()=>false,Deaf:()=>false,is_pool_or_lava:()=>false,
        is_pick:()=>false,glyph_at:()=>({kind:'cmap'}),glyph_is_invisible_at:()=>false,
        show_transient_light:async()=>{},transient_light_cleanup:async()=>{},
        rn2:()=>{throw Error('unexpected core RNG draw');},
        rn2_on_display_rng:()=>{throw Error('unexpected display RNG draw');},
    });
    vm.runInContext(body('zap','bhit'),context);
    vm.runInContext(body('dothrow','sho_obj_return_to_u'),context);
    return {context,events,frames,obj,showFloor};
}

for(const [name,weapon,range,x,samples]of [
    ['thrown object',C.THROWN_WEAPON,1,7,1],
    ['kicked object',C.KICKED_WEAPON,2,6,1],
    ['tethered object',C.THROWN_TETHERED_WEAPON,1,7,1],
    ['camera flash',C.FLASHED_LIGHT,1,7,0],
]) test(`${name}: flush earlier map updates before the first flight glyph`,async()=>{
    const s=await setup();s.showFloor(13,4);const before=rng();
    await s.context.bhit(-1,0,range,weapon,null,null,{obj:s.obj});
    assert.equal(s.frames.length,1);
    assert.deepEqual(s.frames[0].cursor,[x,5]);
    assert.equal(D.gbuf_at(13,4).gnew,0);
    assert.equal(s.events.filter(e=>e==='capture').length,samples);
    assert.deepEqual(s.events.slice(0,samples+1),samples?['capture','flush']:['flush']);
    assert.deepEqual(rng(),before);
});

test('invisible thrown flight still flushes its opening buffer once',async()=>{
    const s=await setup(()=>false);s.showFloor(13,4);
    await s.context.bhit(-1,0,1,C.THROWN_WEAPON,null,null,{obj:s.obj});
    assert.deepEqual(s.frames.map(f=>f.cursor),[[13,5]]);
    assert.deepEqual(s.events,['capture','flush','delay']);
});

test('zero-range physical flight flushes before closing without a delay',async()=>{
    const s=await setup();s.showFloor(13,4);
    await s.context.bhit(-1,0,0,C.THROWN_WEAPON,null,null,{obj:s.obj});
    assert.deepEqual(cursor(),[13,5]);
    assert.equal(s.frames.length,0);
    assert.deepEqual(s.events,['capture','flush']);
});

for(const [name,weapon]of [['immediate wand',C.ZAPPED_WAND],['invisible beam',C.INVIS_BEAM]])
test(`${name}: no tmp_at opening and no extra flush`,async()=>{
    const s=await setup();s.showFloor(13,4);
    await s.context.bhit(-1,0,0,weapon,null,null,{obj:s.obj});
    assert.deepEqual(cursor(),[19,0]);
    assert.equal(D.gbuf_at(13,4).gnew,1);
    assert.deepEqual(s.events,[]);
});

test('return flight flushes outgoing cleanup before drawing the first return square',async()=>{
    const s=await setup();
    game.u.ux=5;game.u.dx=1;game.bhitpos={x:8,y:4};
    s.showFloor(8,4);const before=rng();
    await s.context.sho_obj_return_to_u(s.obj);
    assert.deepEqual(s.frames.map(f=>f.cursor),[[7,5],[7,5]]);
    assert.deepEqual(s.events.slice(0,5),['capture','flush','show','flush','delay']);
    assert.equal(s.events.filter(e=>e==='capture').length,1);
    assert.equal(D.gbuf_at(6,4).gnew,1); // Final restoration remains buffered.
    assert.deepEqual(rng(),before);
});

for(const [name,dx,dy,bx,by]of [['no direction',0,0,13,4],['already at hero',1,0,8,4]])
test(`return flight ${name}: early guard does not open or flush`,async()=>{
    const s=await setup();
    game.u.dx=dx;game.u.dy=dy;game.bhitpos={x:bx,y:by};s.showFloor(13,4);
    await s.context.sho_obj_return_to_u(s.obj);
    assert.deepEqual(cursor(),[19,0]);
    assert.deepEqual(s.events,[]);
    assert.equal(D.gbuf_at(13,4).gnew,1);
});

for(const state of [D.TOPLINE_NEED_MORE,D.TOPLINE_NON_EMPTY,D.TOPLINE_SPECIAL_PROMPT])
test(`clear message state ${state}: home before erasing, without RNG`,async()=>{
    await setup();game._toplin=state;
    game.nhDisplay.setCell(0,0,'X',T.NO_COLOR,0);
    const before=rng();
    await D.tty_clear_nhwindow_message(0);
    assert.deepEqual(cursor(),[0,0]);
    assert.equal(game._toplin,D.TOPLINE_EMPTY);
    assert.ok(game.nhDisplay.grid[0].every(c=>c.ch===' '));
    assert.deepEqual(rng(),before);
});

test('empty message guard leaves physical cursor and cells alone',async()=>{
    await setup();game._toplin=D.TOPLINE_EMPTY;
    game.nhDisplay.setCell(0,0,'X',T.NO_COLOR,0);
    await D.tty_clear_nhwindow_message(0);
    assert.deepEqual(cursor(),[19,0]);
    assert.equal(game.nhDisplay.grid[0][0].ch,'X');
});

test('wrapped message clear homes before restoring covered map rows',async()=>{
    const s=await setup();s.showFloor(6,0);
    const moves=[],display=game.nhDisplay,original=display.setCursor;
    display.setCursor=function(x,y){moves.push([x,y]);return original.call(this,x,y);};
    try{await D.tty_clear_nhwindow_message(1);}finally{display.setCursor=original;}
    assert.deepEqual(moves,[[0,0],[0,0],[0,1],[6,1]]);
    assert.deepEqual(cursor(),[6,1]);
});
