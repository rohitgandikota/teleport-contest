#!/usr/bin/env node
// Source-derived tty cursor and glyph-buffer controls, not native recordings.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import * as C from '../js/const.js';
import {PMNAMES} from '../js/monst_data.js';
import {glyphmap,show_glyph_cell,gbuf_at,glyph_at,row_refresh,flush_screen} from '../js/display.js';
import {gc_currentgraphics,gs_symset,H_UNK,H_DEC,H_IBM,H_UTF8} from '../js/symbols.js';
import {CLR_RED,CLR_WHITE,NO_COLOR,ATR_INVERSE} from '../js/terminal.js';

const input=JSON.parse(readFileSync(new URL('gen-sessions/recipes/class-glyph-startup.json',import.meta.url)));
const x=4,y=2,id=C.GLYPH_MON_MALE_OFF+PMNAMES.PM_HUMAN;
const unicode={utf32ch:0x2603,utf8str:[0xe2,0x98,0x83]};
const cursor=()=>[game.nhDisplay.cursorCol,game.nhDisplay.cursorRow];
async function setup() {
    await runSegment({...input.segments[0],moves:' ',storage:new InMemoryStorage()});
    game.gbuf=[];
    game.disp={botl:0,botlx:0,time_botl:0};
    game.nhDisplay.setCursor(2,1);
    gs_symset[gc_currentgraphics.set].handling=H_UNK;
    game.flags.eight_bit_tty=false;
    game.flags.color=true;
    game.iflags.use_background_glyph=false;
    game.iflags.colorcount=256;
}
function show({px=x,py=y,ch='Q',color=CLR_WHITE,dec=false,attr=0,glyphnum=id}={}) {
    show_glyph_cell(px,py,ch,color,dec,attr,{kind:'effect',glyphnum});
}
function paint(options={}) {show(options);row_refresh(options.px??x,options.px??x,options.py??y);}
function rng() {return {core:structuredClone(game.coreCtx),display:structuredClone(game.dispCtx)};}

test('generic setCell writes and absent map entries do not move the cursor',async()=>{
    await setup();
    game.nhDisplay.setCell(x-1,y+1,'X',CLR_RED,0);
    row_refresh(x,x,y);
    assert.deepEqual(cursor(),[2,1]);
});

for(const [name,ch,handling,eightBit,expected] of [
    ['ordinary byte','Q',H_UNK,false,'Q'],
    ['space',' ',H_UNK,false,' '],
    ['control byte','\n',H_UNK,false,'X'],
    ['NUL','\0',H_UNK,false,'X'],
    ['high-bit control','\x8a',H_UNK,false,'X'],
    ['DEC high-bit line','\xf1',H_DEC,false,'─'],
    ['DEC high-bit line with eight_bit_tty','\xf1',H_DEC,true,'─'],
    ['IBM high-bit line','\xf1',H_IBM,false,'q'],
    ['UTF8 raw high-bit line','\xf1',H_UTF8,false,'q'],
    ['ordinary eight-bit byte','\xc1',H_UNK,true,'A'],
]) {
    test(`tty glyph ${name}: one cursor column, correct nomux write`,async()=>{
        await setup();
        gs_symset[gc_currentgraphics.set].handling=handling;
        game.flags.eight_bit_tty=eightBit;
        game.nhDisplay.setCell(x-1,y+1,'X',CLR_RED,0);
        const before=rng();
        paint({ch});
        assert.equal(game.nhDisplay.grid[y+1][x-1].ch,expected);
        assert.deepEqual(cursor(),[x,y+1]);
        assert.deepEqual(rng(),before);
    });
}

test('Unicode bytes bypass nomux but advance one glyph column',async()=>{
    await setup();
    gs_symset[gc_currentgraphics.set].handling=H_UTF8;
    glyphmap()[id].u=unicode;
    game.nhDisplay.setCell(x-1,y+1,'X',CLR_RED,ATR_INVERSE);
    const cell=structuredClone(game.nhDisplay.grid[y+1][x-1]);
    paint();
    assert.deepEqual(game.nhDisplay.grid[y+1][x-1],cell);
    assert.deepEqual(cursor(),[x,y+1]);
});

test('Unicode metadata without UTF8 handling still prints the raw byte',async()=>{
    await setup();glyphmap()[id].u=unicode;
    paint();
    assert.equal(game.nhDisplay.grid[y+1][x-1].ch,'Q');
    assert.deepEqual(cursor(),[x,y+1]);
});

test('flush prints dirty cells in row order before optional hero cursor',async()=>{
    await setup();
    const before=rng();
    show({px:15,py:8});show({px:3,py:1});show({px:9,py:8});
    await flush_screen(0);
    assert.deepEqual(cursor(),[15,9]);
    await flush_screen(1);
    assert.deepEqual(cursor(),[game.u.ux-1,game.u.uy+1]);
    assert.deepEqual(rng(),before);
});

test('clean and repeated glyph writes leave the cursor and dirty flag alone',async()=>{
    await setup();show();await flush_screen(0);
    game.nhDisplay.setCursor(2,1);
    const entry=gbuf_at(x,y);
    show();
    assert.equal(gbuf_at(x,y),entry);
    assert.equal(entry.gnew,0);
    await flush_screen(0);
    assert.deepEqual(cursor(),[2,1]);
    show({ch:'R'});const pending=gbuf_at(x,y);
    show({ch:'R'});
    assert.equal(gbuf_at(x,y),pending);
    assert.equal(pending.gnew,1);
});

test('absent buffer entries already contain the default unexplored glyph',async()=>{
    await setup();
    show_glyph_cell(x,y,' ',NO_COLOR,false,0,{kind:'unexplored'});
    await flush_screen(0);
    assert.equal(gbuf_at(x,y),undefined);
    assert.deepEqual(cursor(),[2,1]);
});

for(const [name,change] of [
    ['glyph identity',()=>({glyphnum:id+1})],
    ['raw character',()=>({ch:'R'})],
    ['base color',()=>({color:CLR_RED})],
    ['graphics mode',()=>({dec:true})],
    ['display attribute',()=>({attr:ATR_INVERSE})],
    ['custom color',()=>{glyphmap()[id].customcolor=C.NH_BASIC_COLOR|CLR_RED;return {};}],
    ['glyph flags',()=>{glyphmap()[id].glyphflags^=C.MG_PET;return {};}],
    ['tile index',()=>{glyphmap()[id].tileidx=71;return {};}],
]) {
    test(`changed ${name} schedules a glyph write`,async()=>{
        await setup();show();await flush_screen(0);
        show(change());assert.equal(gbuf_at(x,y).gnew,1);
        await flush_screen(0);assert.deepEqual(cursor(),[x,y+1]);
    });
}

test('Unicode pointer and indexed color alone do not replace buffered glyph info',async()=>{
    await setup();
    const oldUnicode={utf32ch:0x2602,utf8str:[0xe2,0x98,0x82]};
    glyphmap()[id].u=oldUnicode;glyphmap()[id].color256idx=21;
    show();await flush_screen(0);
    const old=gbuf_at(x,y);
    glyphmap()[id].u=unicode;glyphmap()[id].color256idx=42;
    show();
    assert.equal(gbuf_at(x,y),old);
    assert.equal(old.disp_u,oldUnicode);assert.equal(old.disp_color256idx,21);
    assert.equal(old.gnew,0);
});

test('background glyph option forces otherwise unchanged glyph information',async()=>{
    await setup();show();await flush_screen(0);
    game.iflags.use_background_glyph=true;
    show();assert.equal(gbuf_at(x,y).gnew,1);
});

test('unresolved glyph identities retain conservative redraw behavior',async()=>{
    await setup();
    show_glyph_cell(x,y,'Q',CLR_WHITE,false,0,{kind:'effect'});
    await flush_screen(0);
    show_glyph_cell(x,y,'Q',CLR_WHITE,false,0,{kind:'effect'});
    assert.equal(gbuf_at(x,y).gnew,1);
});

for(const flag of ['saving','restoring','done_hup']) {
    test(`suppressed ${flag} flush leaves cursor and pending glyph unchanged`,async()=>{
        await setup();show();game.program_state[flag]=true;
        await flush_screen(1);
        assert.deepEqual(cursor(),[2,1]);assert.equal(gbuf_at(x,y).gnew,1);
        game.program_state[flag]=false;
        await flush_screen(0);assert.deepEqual(cursor(),[x,y+1]);
    });
}

test('delayed flush retains pending glyphs until resumed',async()=>{
    await setup();show();await flush_screen(-1);
    assert.deepEqual(cursor(),[2,1]);assert.equal(gbuf_at(x,y).gnew,1);
    await flush_screen(-1);
    assert.deepEqual(cursor(),[game.u.ux-1,game.u.uy+1]);
    assert.equal(gbuf_at(x,y).gnew,0);
});

// The port mirrors the global buffer identity in each level's locations.
// A repeated write still needs to synchronize that copy after a level change.
test('unchanged buffered glyph keeps the per-level displayed identity in sync',async()=>{
    await setup();show();await flush_screen(0);
    const entry=gbuf_at(x,y),loc=game.level.at(x,y);
    loc.disp_glyph={kind:'unexplored'};loc.disp_ch=' ';
    show();
    assert.equal(gbuf_at(x,y),entry);assert.equal(entry.gnew,0);
    assert.equal(glyph_at(x,y).glyphnum,id);
});
