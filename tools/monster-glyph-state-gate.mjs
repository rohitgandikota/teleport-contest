#!/usr/bin/env node
// Source-state controls, not native oracles. The test loader only exposes two
// private detect.js producers; all game, producer, RNG and painter code is real.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {register} from 'node:module';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {game} from '../js/gstate.js';

// Install the test exports before loading the game graph. Keep game as a
// live binding because runSegment replaces it at the start of each replay.
register('./monster-glyph-state-loader.mjs', import.meta.url);
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const C = await import('../js/const.js');
const {PMNAMES: PM, NUMMONS} = await import('../js/monst_data.js');
const {CLR_RED, CLR_GREEN, CLR_WHITE, CLR_BROWN, NO_COLOR} = await import('../js/terminal.js');
const {newsym, glyphmap, gbuf_at, show_glyph_cell, row_refresh} = await import('../js/display.js');
const {audit_mon_cell, audit_map_monst} = await import('../js/detect.js');
const {detect_wsegs} = await import('../js/worm.js');
const {rn2_on_display_rng} = await import('../js/rng.js');
const {IN_SIGHT, COULD_SEE} = await import('../js/vision.js');
const {gs_symset,gc_currentgraphics,H_UTF8,H_UNK,gs_showsyms} = await import('../js/symbols.js');

const input=JSON.parse(readFileSync(new URL('gen-sessions/recipes/class-glyph-startup.json',import.meta.url)));
const x=4,y=2;
async function setup({female=false,tame=false,hallu=false,visible=true,detected=false,mnum=PM.PM_GNOME}={}) {
    const segment={...input.segments[0],moves:' ',storage:new InMemoryStorage()};
    segment.nethackrc=segment.nethackrc.replace(/SYMBOLS=.*\n/g,'');
    await runSegment(segment);
    game.flags.color=true;
    game.flags.hilite_pet=false; // Attribute dispatch is a separately reported source gap.
    game.flags.use_inverse=true;
    game.iflags.colorcount=256;
    game.u.uprops.HALLUC=hallu?100:0;
    game.u.uprops.DETECT_MONSTERS=detected?100:0;
    game.u.uprops.SEE_INVIS=0;
    game.u.intrinsic.HSee_invisible=0;
    game.u.uprops.TELEPAT=0;
    game.u.intrinsic.HTelepat=0;
    game.level.monAt.clear();
    game.level.monsters=[];
    game.level.objects=[];
    game.level.objAt.clear();
    game.level.traps=[];
    game.level.engravings=[];
    game.regions=[];
    Object.assign(game.level.at(x,y),{typ:C.ROOM,seenv:255,lit:1,waslit:1,
        remembered_glyph:undefined,disp_glyph:undefined,disp_ch:undefined});
    game.viz_array[y][x]=visible?(IN_SIGHT|COULD_SEE):0;
    const mon={mnum,data:game.mons[mnum],mx:x,my:y,mhp:20,mhpmax:20,
        female:female?1:0,mtame:tame?5:0,minvis:detected?1:0,m_ap_type:C.M_AP_NOTHING,
        wormno:0,mundetected:0};
    game.level.monAt.set(`${x},${y}`,mon);
    game.level.monsters.push(mon);
    return mon;
}
function expectedDraw(hallu,normal) {
    const before=structuredClone(game.dispCtx);
    const mnum=hallu?rn2_on_display_rng(NUMMONS):normal;
    const after=structuredClone(game.dispCtx);
    game.dispCtx=before;
    return {mnum,after,core:structuredClone(game.coreCtx)};
}
function glyphnum(mnum,female,range) {
    const offsets={normal:[C.GLYPH_MON_MALE_OFF,C.GLYPH_MON_FEM_OFF],
        pet:[C.GLYPH_PET_MALE_OFF,C.GLYPH_PET_FEM_OFF],
        detected:[C.GLYPH_DETECT_MALE_OFF,C.GLYPH_DETECT_FEM_OFF]};
    return mnum+offsets[range][+!!female];
}
function markVariants(mnum,female,range) {
    for (const which of ['normal','pet','detected']) {
        glyphmap()[glyphnum(mnum,female,which)].customcolor=C.NH_BASIC_COLOR
            | (which===range?CLR_RED:CLR_WHITE);
    }
}
function checkBuffered(mon,expected,draw,px=x,py=y) {
    const cell=gbuf_at(px,py);
    assert.deepEqual(game.dispCtx,draw.after,'display RNG draw count/order');
    assert.deepEqual(game.coreCtx,draw.core,'core RNG unchanged');
    assert.equal(cell.disp_glyphnum,expected,'caller-selected glyph range and species');
    assert.equal(cell.disp_customcolor,C.NH_BASIC_COLOR|CLR_RED,'selected custom metadata');
    const desc=cell.disp_glyph;
    const mnum=desc.mnum, female=desc.female;
    mon.mnum=PM.PM_HUMAN; mon.data=game.mons[PM.PM_HUMAN];
    mon.female=!mon.female; mon.mtame=mon.mtame?0:7;
    glyphmap()[expected].customcolor=C.NH_BASIC_COLOR|CLR_GREEN;
    row_refresh(px,px,py);
    assert.equal(gbuf_at(px,py).disp_glyphnum,expected,'live monster mutation does not change ID');
    assert.equal(game.nhDisplay.grid[py+1][px-1].color,CLR_RED,'buffer retains metadata snapshot');
    assert.equal(desc.mnum,mnum); assert.equal(desc.female,female);
    show_glyph_cell(px,py,cell.disp_ch,cell.disp_color,cell.disp_decgfx,cell.disp_attr,desc);
    assert.equal(gbuf_at(px,py).disp_glyphnum,expected,'reusing descriptor preserves original range');
    row_refresh(px,px,py);
    assert.equal(game.nhDisplay.grid[py+1][px-1].color,CLR_GREEN,'new show reads new metadata');
    assert.deepEqual(game.dispCtx,draw.after,'repaint makes no display RNG draws');
    assert.deepEqual(game.coreCtx,draw.core,'repaint makes no core RNG draws');
}

const ordinary=[
    {name:'visible normal male'},
    {name:'visible normal female',female:true},
    {name:'visible pet female',tame:true,female:true},
    {name:'visible detected male',detected:true},
    {name:'visible detected female',detected:true,female:true},
    {name:'visible detected pet prefers pet range',detected:true,tame:true},
    {name:'unseen detected female',detected:true,visible:false,female:true},
    {name:'unseen detected pet prefers pet range',detected:true,visible:false,tame:true},
    {name:'unseen telepathic normal',visible:false,telepathy:true},
    {name:'unseen telepathic pet',visible:false,telepathy:true,tame:true},
    {name:'hallucinated visible normal',hallu:true},
    {name:'hallucinated visible pet uses normal range',hallu:true,tame:true},
    {name:'hallucinated detected pet uses detection range',hallu:true,tame:true,detected:true},
    {name:'hallucinated unseen pet uses detection range',hallu:true,tame:true,detected:true,visible:false},
    {name:'visible female worm tail',tail:true,female:true},
    {name:'visible pet worm tail',tail:true,tame:true},
    {name:'hallucinated pet worm tail uses normal range',tail:true,tame:true,hallu:true},
    {name:'visible monster disguise',disguise:true,female:true},
    {name:'tame monster disguise uses normal range',disguise:true,tame:true},
    {name:'hallucinated monster disguise',disguise:true,tame:true,hallu:true},
];
for (const sample of ordinary) test(`newsym: ${sample.name}`,async()=>{
    const mon=await setup(sample);
    if (sample.telepathy) {
        game.u.uprops.TELEPAT=100;
        game.u.unblind_telepat_range=10000;
    }
    if (sample.tail) Object.assign(mon,{mnum:PM.PM_LONG_WORM,data:game.mons[PM.PM_LONG_WORM],
        wormno:1,mx:x+2});
    if (sample.disguise) Object.assign(mon,{mnum:PM.PM_LARGE_MIMIC,data:game.mons[PM.PM_LARGE_MIMIC],
        m_ap_type:C.M_AP_MONSTER,mappearance:PM.PM_HUMAN});
    const normal=sample.tail?PM.PM_LONG_WORM_TAIL:sample.disguise?PM.PM_HUMAN:mon.mnum;
    const draw=expectedDraw(sample.hallu,normal);
    const range=sample.disguise?'normal':sample.tame&&!sample.hallu?'pet':sample.detected?'detected':'normal';
    const expected=glyphnum(draw.mnum,sample.female,range);
    markVariants(draw.mnum,sample.female,range);
    newsym(x,y);
    checkBuffered(mon,expected,draw);
});

const maps=[
    {name:'normal male'},
    {name:'normal female',female:true},
    {name:'pet female',tame:true,female:true},
    {name:'ghost uses detection range',mnum:PM.PM_GHOST},
    {name:'tame ghost still uses detection range',mnum:PM.PM_GHOST,tame:true},
    {name:'shade female uses detection range',mnum:PM.PM_SHADE,female:true},
    {name:'hallucinated normal',hallu:true},
    {name:'hallucinated pet retains pet range',hallu:true,tame:true},
    {name:'hallucinated ghost retains detection range',hallu:true,mnum:PM.PM_GHOST},
    {name:'ghost detection uses default class even with custom visible symbol',mnum:PM.PM_GHOST,override:'G'},
    {name:'active blank class does not select detection range',override:' '},
];
for (const sample of maps) test(`map_monst: ${sample.name}`,async()=>{
    const mon=await setup(sample);
    if (sample.override!==undefined) gs_showsyms.M[mon.data.mlet]=sample.override;
    const range=[PM.PM_GHOST,PM.PM_SHADE].includes(mon.mnum)?'detected':sample.tame?'pet':'normal';
    const draw=expectedDraw(sample.hallu,mon.mnum);
    const expected=glyphnum(draw.mnum,sample.female,range);
    markVariants(draw.mnum,sample.female,range);
    audit_map_monst(mon,false);
    checkBuffered(mon,expected,draw);
});

for (const sample of [
    {name:'normal female',female:true},
    {name:'pet still uses normal range',tame:true},
    {name:'monster-disguised mimic reveals real species',disguise:true},
    {name:'hallucinated female',female:true,hallu:true},
]) test(`mon_cell: ${sample.name}`,async()=>{
    const mon=await setup(sample);
    if (sample.disguise) Object.assign(mon,{mnum:PM.PM_LARGE_MIMIC,data:game.mons[PM.PM_LARGE_MIMIC],
        m_ap_type:C.M_AP_MONSTER,mappearance:PM.PM_HUMAN});
    const draw=expectedDraw(sample.hallu,mon.mnum);
    const expected=glyphnum(draw.mnum,sample.female,'normal');
    markVariants(draw.mnum,sample.female,'normal');
    const cell=audit_mon_cell(mon);
    show_glyph_cell(x,y,cell.ch,cell.color,cell.decgfx,0,cell.glyph);
    checkBuffered(mon,expected,draw);
});

for (const sample of [
    {name:'normal male'},
    {name:'normal female',female:true},
    {name:'pet female',female:true,tame:true},
    {name:'detected pet uses detection range',tame:true,detect:true},
    {name:'hallucinated normal uses one shared tail draw',hallu:true},
    {name:'hallucinated pet retains pet range',hallu:true,tame:true},
    {name:'hallucinated detected female retains detection range',hallu:true,detect:true,female:true},
]) test(`detect_wsegs: ${sample.name}`,async()=>{
    const mon=await setup({...sample,mnum:PM.PM_LONG_WORM});
    mon.wormno=1;
    const head={wx:x+3,wy:y,nseg:null};
    const second={wx:x+1,wy:y,nseg:head};
    const first={wx:x,wy:y,nseg:second};
    game.worms={wheads:{1:head},wtails:{1:first}};
    const draw=expectedDraw(sample.hallu,PM.PM_LONG_WORM_TAIL);
    const range=sample.detect?'detected':sample.tame?'pet':'normal';
    const expected=glyphnum(draw.mnum,sample.female,range);
    markVariants(draw.mnum,sample.female,range);
    detect_wsegs(mon,!!sample.detect);
    assert.equal(gbuf_at(x+1,y).disp_glyphnum,expected,'all tail segments share the sampled identity');
    checkBuffered(mon,expected,draw);
});

test('detect_wsegs consumes the hallucination draw for an empty tail',async()=>{
    const mon=await setup({hallu:true,mnum:PM.PM_LONG_WORM});
    mon.wormno=1;
    const head={wx:x,wy:y,nseg:null};
    game.worms={wheads:{1:head},wtails:{1:head}};
    const draw=expectedDraw(true,PM.PM_LONG_WORM_TAIL);
    detect_wsegs(mon,false);
    assert.deepEqual(game.dispCtx,draw.after);
    assert.deepEqual(game.coreCtx,draw.core);
});

test('ordinary pet Unicode uses the captured pet range through the actual painter',async()=>{
    const mon=await setup({tame:true,female:true});
    gs_symset[gc_currentgraphics.set].handling=H_UTF8;
    const expected=glyphnum(mon.mnum,true,'pet');
    glyphmap()[expected].u={utf32ch:0x2603,utf8str:[226,152,131]};
    const before={ch:'Q',color:CLR_RED,attr:0};
    game.nhDisplay.setCell(x-1,y+1,before.ch,before.color,before.attr);
    newsym(x,y);
    assert.equal(gbuf_at(x,y).disp_glyphnum,expected);
    mon.mtame=0; mon.female=0; mon.mnum=PM.PM_HUMAN;
    const core=structuredClone(game.coreCtx),display=structuredClone(game.dispCtx);
    row_refresh(x,x,y);
    const cell=game.nhDisplay.grid[y+1][x-1];
    assert.equal(cell.ch,before.ch); assert.equal(cell.color,before.color);
    assert.deepEqual(game.coreCtx,core); assert.deepEqual(game.dispCtx,display);
});

// Native controls establish that each override reaches the recorded output.
// The class selectors do not distinguish normal, pet and detected ranges.
test('native controls reach monster color, Unicode and detection attributes', () => {
    const fixture = JSON.parse(readFileSync(new URL(
        'gen-sessions/generated/monster-glyph-identities.session.json', import.meta.url)));
    const samples = [
        [0, 24, 8, 13, 'G', CLR_RED, 0],
        [1, 24, 8, 13, 'G', CLR_BROWN, 0],
        [2, 24, 8, 13, ' ', NO_COLOR, 0],
        [3, 24, 8, 13, 'G', CLR_BROWN, 0],
        [4, 57, 8, 13, ' ', CLR_RED, 1],
        [5, 57, 8, 13, ' ', NO_COLOR, 1],
        [4, 59, 8, 13, ' ', CLR_RED, 0],
        [5, 59, 8, 13, ' ', NO_COLOR, 0],
        [6, 73, 3, 15, '~', CLR_RED, 0],
        [6, 73, 4, 16, '~', CLR_RED, 0],
        [7, 73, 3, 15, '~', CLR_BROWN, 0],
        [7, 73, 4, 16, '~', CLR_BROWN, 0],
    ];
    for (const [segment, step, x, y, ch, color, attr] of samples) {
        const cell = decodeScreen(fixture.segments[segment].steps[step].screen)[y][x];
        assert.deepEqual([cell.ch, cell.color, cell.attr], [ch, color, attr],
            `segment ${segment}, step ${step}, cell ${x},${y}`);
    }
});
