#!/usr/bin/env node
// C-derived attribute controls. Native replay evidence is separate.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {register} from 'node:module';
import {game} from '../js/gstate.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
register('./monster-glyph-state-loader.mjs',import.meta.url);
const {runSegment}=await import('../js/jsmain.js');
const {InMemoryStorage}=await import('../js/storage.js');
const C=await import('../js/const.js');
const {PMNAMES:PM,NUMMONS}=await import('../js/monst_data.js');
const {CLR_WHITE,CLR_BROWN,CLR_YELLOW,NO_COLOR,ATR_BOLD,ATR_INVERSE,ATR_UNDERLINE}=await import('../js/terminal.js');
const {newsym,show_glyph_cell,gbuf_at,glyphmap,row_refresh}=await import('../js/display.js');
const {audit_map_monst}=await import('../js/detect.js');
const {rn2_on_display_rng}=await import('../js/rng.js');
const {IN_SIGHT,COULD_SEE}=await import('../js/vision.js');
const input=JSON.parse(readFileSync(new URL('gen-sessions/recipes/class-glyph-startup.json',import.meta.url)));
const x=4,y=2;
const ranges={normal:[C.GLYPH_MON_MALE_OFF,C.GLYPH_MON_FEM_OFF],
    pet:[C.GLYPH_PET_MALE_OFF,C.GLYPH_PET_FEM_OFF],
    detected:[C.GLYPH_DETECT_MALE_OFF,C.GLYPH_DETECT_FEM_OFF],
    ridden:[C.GLYPH_RIDDEN_MALE_OFF,C.GLYPH_RIDDEN_FEM_OFF]};
async function setup({female=false,tame=true,hallu=false,mnum=PM.PM_GNOME}={}) {
    const segment={...input.segments[0],moves:' ',storage:new InMemoryStorage()};
    segment.nethackrc=segment.nethackrc.replace(/SYMBOLS=.*\n/g,'');
    await runSegment(segment);
    game.flags.hilite_pet=true;game.flags.use_inverse=true;game.flags.color=true;
    game.iflags.wc2_petattr=1;
    game.u.uprops.HALLUC=hallu?100:0;
    game.u.uprops.DETECT_MONSTERS=0;
    game.u.uprops.TELEPAT=0;game.u.intrinsic.HTelepat=0;
    game.level.monAt.clear();game.level.monsters=[];
    game.level.objects=[];game.level.traps=[];game.level.engravings=[];game.regions=[];
    Object.assign(game.level.at(x,y),{typ:C.ROOM,seenv:255,lit:1,waslit:1,
        remembered_glyph:undefined,disp_glyph:undefined,disp_ch:undefined});
    game.viz_array[y][x]=IN_SIGHT|COULD_SEE;
    game.gbuf=[];
    const mon={mnum,data:game.mons[mnum],mx:x,my:y,mhp:20,mhpmax:20,
        female:+female,mtame:tame?5:0,minvis:0,m_ap_type:C.M_AP_NOTHING,
        wormno:0,mundetected:0};
    game.level.monAt.set(`${x},${y}`,mon);game.level.monsters.push(mon);
    return mon;
}
const streams=()=>({core:structuredClone(game.coreCtx),display:structuredClone(game.dispCtx)});
const paint=()=>{row_refresh(x,x,y);return game.nhDisplay.grid[y+1][x-1];};
function capture(mon,range,{attr=range==='detected'?ATR_INVERSE:0,withMon=true}={}) {
    const glyphnum=ranges[range][+!!mon.female]+mon.mnum;
    show_glyph_cell(x,y,'g',CLR_WHITE,false,attr,
        {kind:'mon',mon:withMon?mon:undefined,mnum:mon.mnum,female:!!mon.female,glyphnum});
    return glyphnum;
}

for(const range of Object.keys(ranges))for(const female of [false,true])for(const hallu of [false,true]) {
    test(`${range}, ${female?'female':'male'}, hallucination ${hallu}: stored flags govern repaint`,async()=>{
        const mon=await setup({female,hallu,tame:range==='pet'});
        const id=capture(mon,range),before=streams();
        assert.equal(!!(gbuf_at(x,y).disp_glyphflags&C.MG_PET),range==='pet');
        mon.mtame=range==='pet'?0:9;mon.female=!mon.female;
        mon.mnum=PM.PM_HUMAN;mon.data=game.mons[PM.PM_HUMAN];
        game.u.uprops.HALLUC=hallu?0:100;
        const expected=range==='pet'?ATR_BOLD:range==='detected'?ATR_INVERSE:0;
        assert.equal(paint().attr,expected);
        assert.equal(gbuf_at(x,y).disp_glyphnum,id);
        assert.deepEqual(streams(),before);
    });
}

for(const [name,nhattr,terminal] of [
    ['none',0,0],['bold',1,ATR_BOLD],['dim',2,0],['italic',3,0],
    ['underline',4,ATR_UNDERLINE],['blink',5,0],['inverse',7,ATR_INVERSE],
    ['default',undefined,ATR_INVERSE],
]) test(`petattr ${name}: tty attribute maps to recorder bits`,async()=>{
    const mon=await setup({tame:false});
    capture(mon,'pet');game.iflags.wc2_petattr=nhattr;
    assert.equal(paint().attr,terminal);
});

for(const [name,hilite,inverse,color,expected] of [
    ['highlight disabled',false,true,true,0],
    ['inverse disabled',true,false,true,ATR_INVERSE],
    ['color disabled',true,true,false,ATR_INVERSE],
    ['inverse and color disabled',true,false,false,ATR_INVERSE],
]) test(`pet option gate: ${name}`,async()=>{
    const mon=await setup({tame:false});capture(mon,'pet');
    game.flags.hilite_pet=hilite;game.flags.use_inverse=inverse;game.flags.color=color;
    game.iflags.wc2_petattr=7;
    assert.equal(paint().attr,expected);
});

test('pet highlighting and attribute changes take effect on buffered glyphs',async()=>{
    const mon=await setup({tame:false});capture(mon,'pet');const before=streams();
    assert.equal(paint().attr,ATR_BOLD);
    game.flags.hilite_pet=false;assert.equal(paint().attr,0);
    game.flags.hilite_pet=true;game.iflags.wc2_petattr=4;
    assert.equal(paint().attr,ATR_UNDERLINE);
    assert.deepEqual(streams(),before);
});

test('pet identity does not require a live monster pointer',async()=>{
    const mon=await setup();capture(mon,'pet',{withMon:false});
    assert.equal(paint().attr,ATR_BOLD);
});

test('glyphmap flag mutation does not change an already buffered pet',async()=>{
    const mon=await setup({tame:false}),id=capture(mon,'pet');
    const flags=gbuf_at(x,y).disp_glyphflags;
    glyphmap()[id].glyphflags&=~C.MG_PET;
    assert.equal(paint().attr,ATR_BOLD);
    assert.equal(gbuf_at(x,y).disp_glyphflags,flags);
});

for(const tame of [false,true]) test(`unresolved identity snapshots its legacy tame hint: ${tame}`,async()=>{
    const mon=await setup({tame});
    show_glyph_cell(x,y,'g',CLR_WHITE,false,0,{kind:'mon',mon});
    assert.equal(gbuf_at(x,y).disp_glyphnum,undefined);
    mon.mtame=tame?0:7;
    assert.equal(paint().attr,tame?ATR_BOLD:0);
});

for(const producer of ['newsym','map_monst'])for(const female of [false,true])for(const hallu of [false,true]) {
    test(`${producer}: ${female?'female':'male'} tame monster, hallucination ${hallu}`,async()=>{
        const mon=await setup({female,hallu});
        const before=streams();
        const selected=hallu?rn2_on_display_rng(NUMMONS):mon.mnum;
        const after=streams();game.dispCtx=before.display;
        if(producer==='newsym')newsym(x,y);else audit_map_monst(mon,false);
        const range=producer==='newsym'&&hallu?'normal':'pet';
        assert.equal(gbuf_at(x,y).disp_glyphnum,selected+ranges[range][+female]);
        assert.deepEqual(streams(),after);
        mon.mtame=range==='pet'?0:5;
        assert.equal(paint().attr,range==='pet'?ATR_BOLD:0);
        assert.deepEqual(streams(),after);
    });
}

for(const female of [false,true]) test(`tame ghost detection keeps detected ${female?'female':'male'} attributes`,async()=>{
    const mon=await setup({female,mnum:PM.PM_GHOST});
    audit_map_monst(mon,false);
    assert.equal(gbuf_at(x,y).disp_glyphnum,mon.mnum+ranges.detected[+female]);
    assert.equal(paint().attr,ATR_INVERSE); // no pet bold bit
});


test('native pet glyphs retain their recorded color and highlight attributes', () => {
    const fixture = JSON.parse(readFileSync(new URL(
        'gen-sessions/generated/pet-glyph-attributes.session.json', import.meta.url)));
    const samples = [
        [0, 30, 'G', CLR_BROWN, ATR_INVERSE],
        [1, 69, 'c', CLR_YELLOW, 0],
        [2, 32, 'G', CLR_BROWN, ATR_INVERSE],
        [3, 71, 'c', CLR_YELLOW, 0],
        [4, 32, 'G', CLR_BROWN, 0],
        [5, 62, ' ', NO_COLOR, 0],
        [5, 67, ' ', NO_COLOR, ATR_INVERSE],
    ];
    for (const [segment, step, ch, color, attr] of samples) {
        const cell = decodeScreen(fixture.segments[segment].steps[step].screen)[13][8];
        assert.deepEqual([cell.ch, cell.color, cell.attr], [ch, color, attr]);
    }
});
