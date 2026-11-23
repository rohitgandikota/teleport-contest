#!/usr/bin/env node
// Source-state controls, not a native gameplay oracle.
// Pinned C: zap.c:4828-4847,5022-5025; display.c:1174-1290,2031,2461;
// win/tty/topl.c:123-142,194-202,251-301,305-358.
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
import {ONAMES} from '../js/objects_data.js';
import {ATTKS} from '../js/monst_data.js';
import {cmap_names} from '../js/drawing_data.js';
import {update_topl,show_topl_nohistory} from '../js/tty/topl.js';

const input=JSON.parse(readFileSync(new URL('gen-sessions/recipes/class-glyph-startup.json',import.meta.url)));
const source=readFileSync(new URL('../js/zap.js',import.meta.url),'utf8');
const displaySource=readFileSync(new URL('../js/display.js',import.meta.url),'utf8');
function extract(text,name) {
    const match=text.match(new RegExp(`(?:export )?(?:async )?function ${name}\\([\\s\\S]*?^\\}`,'m'));
    assert.ok(match, name);
    return match[0].replace(/^export /,'');
}
const cursor=()=>[game.nhDisplay.cursorCol,game.nhDisplay.cursorRow];
const rng=()=>({core:structuredClone(game.coreCtx),display:structuredClone(game.dispCtx)});
async function setup() {
    await runSegment({...input.segments[0],moves:' ',storage:new InMemoryStorage()});
    game.gbuf=[];
    game.disp={botl:0,botlx:0,time_botl:0};
    game._pending_message=game._toplines=game._topline_physical_prefix='';
    game._toplin=D.TOPLINE_EMPTY;
    game._topl_curx=game._topl_cury=0;
    game._win_stop=game._win_nostop=false;
    game._delay_flushing=false;
    game._flush_cursor_override=game._map_cursor=null;
    game.nhDisplay.setCursor(7,7);
}

for (const [name,text,expected] of [
    ['ordinary message','A beam strikes.',[15,0]],
    ['wrapped message','A'.repeat(70)+' '+'B'.repeat(14),[14,1]],
]) test(`${name}: tty leaves its cursor after the painted text`,async()=>{
    await setup();
    game._toplin=D.TOPLINE_SPECIAL_PROMPT; // Avoid an input prompt after the wrapped text.
    const before=rng();
    await update_topl(text);
    assert.deepEqual(cursor(),expected);
    assert.deepEqual(rng(),before);
});

test('joined message advances past both messages and two spaces',async()=>{
    await setup();
    await update_topl('First.');
    game.nhDisplay.setCursor(7,7);
    await update_topl('Second.');
    assert.deepEqual(cursor(),['First.  Second.'.length,0]);
});

test('no-history prefix remains part of the physical joined message',async()=>{
    await setup();
    show_topl_nohistory('Prefix: ');
    await update_topl('A message.');
    assert.deepEqual(cursor(),['Prefix:   A message.'.length,0]);
});

test('suppressed message changes neither the cursor nor physical cells',async()=>{
    await setup();
    game._win_stop=true;
    const before=game.nhDisplay.terminal.serialize();
    await update_topl('A suppressed message.');
    assert.deepEqual(cursor(),[7,7]);
    assert.equal(game.nhDisplay.terminal.serialize(),before);
});

test('NOSTOP makes a suppressed message paint and advance the cursor',async()=>{
    await setup();
    game._win_stop=game._win_nostop=true;
    await update_topl('A message.');
    assert.deepEqual(cursor(),[10,0]);
});

test('empty top-line repaint homes the cursor without changing RNG',async()=>{
    await setup();
    const before=rng();
    D.paint_topline();
    assert.deepEqual(cursor(),[0,0]);
    assert.deepEqual(rng(),before);
});

// Run complete dobuzz/tmp_at bodies with only world interactions stubbed.
// The real glyph buffer, symbol lookup, map painter and flush remain active.
async function beam({range=1,visible=()=>true,wall=null,hallu=false,onUnmap=null}={}) {
    await setup();
    game.u.ux=30; game.u.uy=15; game.u.uswallow=0;
    game.bhitpos={x:3,y:2};
    game.tmp_glyph=undefined;
    const at=new Map();
    game.level={at:(x,y)=>{
        const key=`${x},${y}`;
        if (!at.has(key)) at.set(key,{typ:wall?.(x,y)?C.VWALL:C.ROOM});
        return at.get(key);
    }};
    const events=[],frames=[],calls=[];
    game.animationFrame=async()=>frames.push({cursor:cursor(),
        cells:structuredClone(game.gbuf),screen:game.nhDisplay.terminal.serialize()});
    const restore=(x,y)=>{
        events.push(['restore',x,y]);
        D.show_glyph_cell(x,y,'.',T.NO_COLOR,false,0,{kind:'cmap',cmap:cmap_names.S_room});
    };
    const context=vm.createContext({
        ...C, ...T, game, ONAMES, ATTKS, cmap_names,
        zap_colors:[C.HI_ZAP,T.CLR_ORANGE,T.CLR_WHITE,C.HI_ZAP,T.CLR_BLACK,T.CLR_WHITE,T.CLR_GREEN,T.CLR_YELLOW],
        ZT_SPELL:x=>10+x,
        Hallucination:()=>hallu,
        rn1:(a,b)=>{calls.push(['rn1',a,b]);return range;},
        rn2:n=>{calls.push(['rn2',n]);assert.equal(n,6);return 4;},
        m_at:()=>null,cansee:visible,canspotmon:()=>false,
        isok:(x,y)=>x>=1&&x<C.COLNO&&y>=0&&y<C.ROWNO,
        newsym:restore,map_invisible:()=>{},unmap_invisible:(x,y)=>onUnmap?.(x,y),
        zap_over_floor:async()=>0,closed_door:()=>false,
        In_mines:()=>false,Is_airlevel:()=>false,
        bounce_dir:(x,y,d)=>{events.push(['bounce',x,y]);d.dx=-d.dx;d.dy=-d.dy;},
        flash_str:()=> 'beam',
        pline_The:async text=>{await D.flush_screen(1);await update_topl('The '+text);},
        zapdir_to_glyph:D.zapdir_to_glyph,
        show_glyph_cell:D.show_glyph_cell,display_cmap_at:D.display_cmap_at,
        flush_screen:async mode=>{events.push(['flush',mode]);await D.flush_screen(mode);},
    });
    vm.runInContext(source.slice(source.indexOf('const MAGIC_COOKIE ='),
        source.indexOf('/* include/mondata.h:28')),context);
    for (const name of ['zaptype','zapdir_cmap','dobuzz'])
        vm.runInContext(extract(source,name),context);
    vm.runInContext(extract(displaySource,'tmp_at'),context);
    return {context,events,frames,calls,restore};
}

for (const [name,dx,dy,direction] of [
    ['vertical',0,1,0],['horizontal',1,0,1],['left slant',1,1,2],['right slant',1,-1,3],
]) test(`dobuzz ${name}: all eight damage types retain the numeric beam glyph`,async()=>{
    for (let type=0;type<8;type++) {
        const s=await beam(),before=rng();
        await s.context.dobuzz(type,6,10,4,dx,dy);
        assert.equal(s.frames.length,1);
        const cell=s.frames[0].cells[4+dy][10+dx];
        assert.equal(cell.disp_glyphnum,C.GLYPH_ZAP_OFF+(type<<2)+direction);
        assert.deepEqual(s.frames[0].cursor,[10+dx,5+dy]);
        assert.deepEqual(s.calls,[['rn1',7,7]]);
        assert.deepEqual(rng(),before);
    }
});

test('wall bounce revisits leave unchanged beam cells and the message cursor alone',async()=>{
    const s=await beam({range:7,wall:x=>x===13});
    await s.context.dobuzz(1,6,10,4,1,0);
    assert.equal(s.frames.length,6);
    assert.deepEqual(s.frames.map(f=>f.cursor),[[11,5],[12,5],[13,5],[17,0],[17,0],[10,5]]);
    assert.equal(s.frames[3].screen,s.frames[4].screen);
    assert.deepEqual(s.calls,[['rn1',7,7]]);
    assert.equal(game.tmp_glyph,undefined);
});

test('beam startup flushes pending map output even for wholly invisible flight',async()=>{
    const s=await beam({visible:()=>false});
    s.restore(60,17);
    await s.context.dobuzz(1,6,10,4,1,0);
    assert.equal(s.frames.length,0);
    assert.deepEqual(cursor(),[60,18]);
    assert.equal(D.gbuf_at(60,17).gnew,0);
});

test('visible obstruction after an unseen square delays without an extra flush',async()=>{
    const s=await beam({visible:x=>x===11,wall:x=>x===11,
        onUnmap:()=>s.restore(60,17)});
    await s.context.dobuzz(1,6,10,4,1,0);
    assert.equal(s.frames.length,1);
    assert.deepEqual(s.frames[0].cursor,[7,7]);
    assert.equal(D.gbuf_at(60,17).gnew,1);
});

test('beam cleanup restores the buffer without repainting the final physical frame',async()=>{
    const s=await beam();
    await s.context.dobuzz(1,6,10,4,1,0);
    assert.equal(D.gbuf_at(11,4).disp_glyph.kind,'cmap');
    assert.equal(D.gbuf_at(11,4).gnew,1);
    assert.equal(game.nhDisplay.terminal.serialize(),s.frames[0].screen);
    assert.deepEqual({...game.bhitpos},{x:3,y:2});
});

test('nested beam restores the existing tmp_at context',async()=>{
    const s=await beam();
    const outer={style:C.DISP_BEAM,saved:[],sidx:0,glyph:null,prev:null};
    game.tmp_glyph=outer;
    await s.context.dobuzz(1,6,10,4,1,0);
    assert.equal(game.tmp_glyph,outer);
});

test('hallucinated beam samples its type once and retains it across a bounce',async()=>{
    const s=await beam({range:7,wall:x=>x===13,hallu:true});
    await s.context.dobuzz(1,6,10,4,1,0);
    assert.deepEqual(s.calls,[['rn2',6],['rn1',7,7]]);
    assert.equal(s.frames[0].cells[4][11].disp_glyphnum,C.GLYPH_ZAP_OFF+(4<<2)+1);
    assert.equal(s.frames[4].cells[4][11].disp_glyphnum,C.GLYPH_ZAP_OFF+(4<<2)+1);
});


test('native reflection, bounce and unseen-hit prefixes reach exact cursor frames', () => {
    const native = JSON.parse(readFileSync(new URL(
        'gen-sessions/generated/beam-transient-cursors.session.json', import.meta.url)));
    const samples = [
        [0, 269, 5, [10, 0, 1]],
        [0, 552, 21, [34, 8, 1]],
        [1, 88, 4, [25, 0, 1]],
        [1, 88, 5, [25, 0, 1]],
        [1, 88, 6, [25, 0, 1]],
    ];
    for (const [segment, step, frame, expected] of samples)
        assert.deepEqual(native.segments[segment].steps[step].animation_frames[frame].cursor, expected);
});
