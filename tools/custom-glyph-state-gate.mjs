#!/usr/bin/env node
// Source-state checks. These are not native recordings.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import * as C from '../js/const.js';
import {PMNAMES, NUMMONS} from '../js/monst_data.js';
import {ONAMES, OCLASSES} from '../js/objects_data.js';
import {cmap_names as S} from '../js/drawing_data.js';
import {NO_COLOR, CLR_RED, CLR_GREEN, CLR_WHITE, CLR_BRIGHT_BLUE} from '../js/terminal.js';
import {glyphmap, show_glyph_cell, gbuf_at, row_refresh, terrain_glyph,
        temporary_object_glyph, mon_to_glyph, display_self} from '../js/display.js';
import {gs_symset, gc_currentgraphics, H_UTF8, H_UNK} from '../js/symbols.js';
import {rn2_on_display_rng} from '../js/rng.js';
import {free_all_glyphmap_u} from '../js/utf8map.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';

const input = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/class-glyph-startup.json', import.meta.url)));
const renderingRecipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/custom-glyph-rendering.json', import.meta.url)));
async function setup() {
    await runSegment({...input.segments[0], moves:' ', storage:new InMemoryStorage()});
    game.iflags.colorcount = 256;
    game.flags.color = true;
}
const x=4, y=2;
async function paint(desc, ch='Q', color=CLR_WHITE) {
    show_glyph_cell(x,y,ch,color,false,0,desc);
    await row_refresh(x,x,y);
    return game.nhDisplay.grid[y+1][x-1];
}
const unicode = {utf32ch:0x2603,utf8str:[226,152,131]};

// display.h partitions are distinct even when all entries print the same byte.
const variants = [
    ['male monster', C.GLYPH_MON_MALE_OFF + PMNAMES.PM_GNOME],
    ['female monster', C.GLYPH_MON_FEM_OFF + PMNAMES.PM_GNOME],
    ['male pet', C.GLYPH_PET_MALE_OFF + PMNAMES.PM_GNOME],
    ['female pet', C.GLYPH_PET_FEM_OFF + PMNAMES.PM_GNOME],
    ['male detected', C.GLYPH_DETECT_MALE_OFF + PMNAMES.PM_GNOME],
    ['female detected', C.GLYPH_DETECT_FEM_OFF + PMNAMES.PM_GNOME],
    ['male ridden', C.GLYPH_RIDDEN_MALE_OFF + PMNAMES.PM_GNOME],
    ['female ridden', C.GLYPH_RIDDEN_FEM_OFF + PMNAMES.PM_GNOME],
    ['object', C.GLYPH_OBJ_OFF + ONAMES.DAGGER],
    ['pile object', C.GLYPH_OBJ_PILETOP_OFF + ONAMES.DAGGER],
    ['body', C.GLYPH_BODY_OFF + PMNAMES.PM_NEWT],
    ['pile body', C.GLYPH_BODY_PILETOP_OFF + PMNAMES.PM_NEWT],
    ['male statue', C.GLYPH_STATUE_MALE_OFF + PMNAMES.PM_NEWT],
    ['female statue', C.GLYPH_STATUE_FEM_OFF + PMNAMES.PM_NEWT],
    ['pile female statue', C.GLYPH_STATUE_FEM_PILETOP_OFF + PMNAMES.PM_NEWT],
    ['mines wall', C.GLYPH_CMAP_MINES_OFF],
    ['lawful altar', C.GLYPH_ALTAR_OFF + 3],
    ['beam', C.GLYPH_ZAP_OFF + 6],
    ['swallow', C.GLYPH_SWALLOW_OFF + 8 * PMNAMES.PM_PURPLE_WORM],
    ['explosion', C.GLYPH_EXPLODE_FROSTY_OFF + 4],
    ['warning', C.GLYPH_WARNING_OFF + 3],
    ['invisible', C.GLYPH_INVIS_OFF],
    ['nothing', C.GLYPH_NOTHING_OFF],
    ['unexplored', C.GLYPH_UNEXPLORED_OFF],
];

test('numeric glyph lookup accepts Unicode in every glyph partition', async () => {
    await setup();
    gs_symset[gc_currentgraphics.set].handling = H_UTF8;
    for (const [name,glyphnum] of variants) {
        glyphmap()[glyphnum].u = unicode;
        game.nhDisplay.setCell(x-1,y+1,'X',CLR_RED,0);
        const before = structuredClone(game.nhDisplay.grid[y+1][x-1]);
        // kind effect deliberately leaves base-character handling alone. This
        // tests tty metadata, not the still-incomplete gameplay producers.
        await paint({kind:'effect',glyphnum});
        assert.deepEqual(game.nhDisplay.grid[y+1][x-1],before,name);
        glyphmap()[glyphnum].u = null;
    }
});

test('glyph variants retain independent basic colors', async () => {
    await setup();
    for (const [name,glyphnum] of variants) {
        glyphmap()[glyphnum].customcolor = C.NH_BASIC_COLOR | CLR_RED;
        assert.equal((await paint({kind:'effect',glyphnum})).color,CLR_RED,name);
        glyphmap()[glyphnum].customcolor = 0;
    }
});

test('loaded fountain Unicode is read without a preset cmap marker', async () => {
    const segment={...input.segments[0], moves:' ', storage:new InMemoryStorage()};
    segment.nethackrc=segment.nethackrc.replace('symset:plain','symset:Enhanced1');
    await runSegment(segment);
    const g=terrain_glyph({typ:C.FOUNTAIN},x,y);
    const glyphnum=C.GLYPH_CMAP_B_OFF + S.S_fountain - S.S_grave;
    assert.equal(glyphmap()[glyphnum].u.utf32ch,0x2320);
    game.nhDisplay.setCell(x-1,y+1,'X',CLR_RED,0);
    await paint(g.glyph ?? {kind:'cmap',cmap:g.cmap},g.ch,g.color);
    assert.equal(game.nhDisplay.grid[y+1][x-1].ch,'X');
});

test('Unicode requires UTF8 handling and a representation', async () => {
    await setup();
    const glyphnum=C.GLYPH_MON_MALE_OFF + PMNAMES.PM_HUMAN;
    glyphmap()[glyphnum].u=unicode;
    gs_symset[gc_currentgraphics.set].handling=H_UNK;
    assert.equal((await paint({kind:'effect',glyphnum})).ch,'Q');
    gs_symset[gc_currentgraphics.set].handling=H_UTF8;
    glyphmap()[glyphnum].u=null;
    assert.equal((await paint({kind:'effect',glyphnum},'R')).ch,'R');
});

test('custom color respects color and terminal color-count gates', async () => {
    await setup();
    const glyphnum=C.GLYPH_MON_MALE_OFF + PMNAMES.PM_HUMAN;
    glyphmap()[glyphnum].customcolor=C.NH_BASIC_COLOR | CLR_RED;
    game.iflags.colorcount=16;
    assert.equal((await paint({kind:'effect',glyphnum})).color,CLR_WHITE);
    game.iflags.colorcount=256;
    game.flags.color=false;
    assert.equal((await paint({kind:'effect',glyphnum})).color,NO_COLOR);
    game.flags.color=true;
    assert.equal((await paint({kind:'effect',glyphnum})).color,CLR_RED);
});

test('startup !color and bound toggle(color) gate custom hero color', async () => {
    for (const sample of [
        {name:'startup disabled', extra:'OPTIONS=!color\n',moves:' V',color:NO_COLOR},
        {name:'toggle off',extra:'',moves:' \x14 V',color:NO_COLOR},
        {name:'toggle off and on',extra:'',moves:' \x14 V\x14 V',color:CLR_RED},
    ]) {
        const segment={...renderingRecipe.segments[0],moves:sample.moves,
            storage:new InMemoryStorage()};
        segment.nethackrc += 'BIND=^T:toggle(color)\n' + sample.extra;
        await runSegment(segment);
        assert.equal(game.nhDisplay.grid[game.u.uy+1][game.u.ux-1].color,
            sample.color,sample.name);
    }
});

test('extra RGB output leaves nomux foreground at its reset value', async () => {
    await setup();
    const glyphnum=C.GLYPH_MON_MALE_OFF + PMNAMES.PM_HUMAN;
    glyphmap()[glyphnum].customcolor=0x123456;
    glyphmap()[glyphnum].color256idx=24;
    for (const colorcount of [256,16777216]) {
        game.iflags.colorcount=colorcount;
        assert.equal((await paint({kind:'effect',glyphnum})).color,NO_COLOR);
        assert.equal(gbuf_at(x,y).disp_color256idx,24);
    }
});

test('buffered custom metadata is retained until show_glyph updates it', async () => {
    await setup();
    const glyphnum=C.GLYPH_MON_MALE_OFF + PMNAMES.PM_HUMAN;
    const gm=glyphmap()[glyphnum];
    gm.customcolor=C.NH_BASIC_COLOR | CLR_RED;
    const core=structuredClone(game.coreCtx), display=structuredClone(game.dispCtx);
    show_glyph_cell(x,y,'Q',CLR_WHITE,false,0,{kind:'effect',glyphnum});
    gm.customcolor=C.NH_BASIC_COLOR | CLR_GREEN;
    await row_refresh(x,x,y);
    assert.equal(game.nhDisplay.grid[y+1][x-1].color,CLR_RED);
    assert.deepEqual(game.coreCtx,core);
    assert.deepEqual(game.dispCtx,display);
    assert.equal((await paint({kind:'effect',glyphnum})).color,CLR_GREEN);
});

test('object producers retain generic, body and statue identities', async () => {
    await setup();
    for (const [obj,expected] of [
        [{otyp:ONAMES.DAGGER,oclass:OCLASSES.WEAPON_CLASS,dknown:1},C.GLYPH_OBJ_OFF+ONAMES.DAGGER],
        [{otyp:ONAMES.POT_HEALING,oclass:OCLASSES.POTION_CLASS,dknown:0},C.GLYPH_OBJ_OFF+OCLASSES.POTION_CLASS],
        [{otyp:ONAMES.CORPSE,oclass:OCLASSES.FOOD_CLASS,dknown:1,corpsenm:PMNAMES.PM_NEWT},C.GLYPH_BODY_OFF+PMNAMES.PM_NEWT],
        [{otyp:ONAMES.STATUE,oclass:OCLASSES.ROCK_CLASS,dknown:1,corpsenm:PMNAMES.PM_NEWT,spe:C.CORPSTAT_FEMALE},C.GLYPH_STATUE_FEM_OFF+PMNAMES.PM_NEWT],
        [{otyp:ONAMES.STATUE,oclass:OCLASSES.ROCK_CLASS,dknown:1,corpsenm:PMNAMES.PM_NEWT,spe:0},C.GLYPH_STATUE_MALE_OFF+PMNAMES.PM_NEWT],
    ]) assert.equal(temporary_object_glyph(obj).glyph.glyphnum,expected);
});

test('hallucinated statue retains both draws without drawing again on repaint', async () => {
    await setup();
    game.u.uprops.HALLUC=100;
    const core=structuredClone(game.coreCtx), before=structuredClone(game.dispCtx);
    const mnum=rn2_on_display_rng(NUMMONS), female=rn2_on_display_rng(2);
    const after=structuredClone(game.dispCtx);
    game.dispCtx=before;
    const g=temporary_object_glyph({otyp:ONAMES.STATUE,oclass:OCLASSES.ROCK_CLASS,
        corpsenm:PMNAMES.PM_NEWT,spe:0,dknown:1});
    assert.equal(g.glyph.glyphnum,mnum+(female?C.GLYPH_MON_FEM_OFF:C.GLYPH_MON_MALE_OFF));
    assert.deepEqual(game.dispCtx,after);
    await paint(g.glyph,g.ch,g.color);
    await row_refresh(x,x,y);
    assert.deepEqual(game.dispCtx,after);
    assert.deepEqual(game.coreCtx,core);
});

test('mon_to_glyph retains sampled species and original gender', async () => {
    await setup();
    game.u.uprops.HALLUC=100;
    const mon={data:game.mons[PMNAMES.PM_GNOME],mnum:PMNAMES.PM_GNOME,female:1};
    let calls=0;
    const g=mon_to_glyph(mon, n=>{assert.equal(n,NUMMONS); calls++; return PMNAMES.PM_NEWT;});
    assert.equal(calls,1);
    assert.equal(g.glyph.mnum,PMNAMES.PM_NEWT);
    assert.equal(g.glyph.female,true);
    mon.mnum=PMNAMES.PM_HUMAN;
    mon.female=0;
    const core=structuredClone(game.coreCtx), display=structuredClone(game.dispCtx);
    glyphmap()[C.GLYPH_MON_FEM_OFF+PMNAMES.PM_NEWT].customcolor=C.NH_BASIC_COLOR | CLR_RED;
    assert.equal((await paint(g.glyph,g.ch,g.color)).color,CLR_RED);
    assert.equal(gbuf_at(x,y).disp_glyphnum,C.GLYPH_MON_FEM_OFF+PMNAMES.PM_NEWT);
    assert.deepEqual(game.coreCtx,core);
    assert.deepEqual(game.dispCtx,display);
});

test('terrain retains five wall ranges and five altar identities', async () => {
    await setup();
    const dnum=game.u.uz.dnum;
    const saved={mines:game.mines_dnum,soko:game.sokoban_dnum,knox:game.knox_level,
        flags:game.dungeons[dnum].flags};
    for (const [which,expected] of [
        ['main',C.GLYPH_CMAP_MAIN_OFF],['mines',C.GLYPH_CMAP_MINES_OFF],
        ['hell',C.GLYPH_CMAP_GEH_OFF],['knox',C.GLYPH_CMAP_KNOX_OFF],
        ['soko',C.GLYPH_CMAP_SOKO_OFF],
    ]) {
        game.mines_dnum=which==='mines'?dnum:-1;
        game.sokoban_dnum=which==='soko'?dnum:-1;
        game.knox_level=which==='knox'?{...game.u.uz}:null;
        game.dungeons[dnum].flags={hellish:which==='hell'};
        const g=terrain_glyph({typ:C.VWALL,seenv:0xff,wall_info:0},x,y);
        assert.equal(g.glyph.glyphnum,expected,which);
    }
    Object.assign(game,{mines_dnum:saved.mines,sokoban_dnum:saved.soko,knox_level:saved.knox});
    game.dungeons[dnum].flags=saved.flags;
    for (const [mask,index] of [[C.AM_NONE,0],[C.AM_CHAOTIC,1],[C.AM_NEUTRAL,2],
            [C.AM_LAWFUL,3],[C.AM_SANCTUM,4]]) {
        const g=terrain_glyph({typ:C.ALTAR,altarmask:mask},x,y);
        assert.equal(g.glyph.glyphnum,C.GLYPH_ALTAR_OFF+index);
    }
});

test('hero identity follows role, race display, and gender', async () => {
    await setup();
    for(const female of [false,true]) {
        game.flags.female=female;
        game.flags.showrace=false;
        display_self();
        assert.equal(gbuf_at(game.u.ux,game.u.uy).disp_glyphnum,
            game.u.umonnum+(female?C.GLYPH_MON_FEM_OFF:C.GLYPH_MON_MALE_OFF));
        game.flags.showrace=true;
        game.urace.mnum=PMNAMES.PM_ELF;
        display_self();
        assert.equal(gbuf_at(game.u.ux,game.u.uy).disp_glyphnum,
            PMNAMES.PM_ELF+(female?C.GLYPH_MON_FEM_OFF:C.GLYPH_MON_MALE_OFF));
    }
});


test('freeing Unicode metadata also clears buffered representations', async () => {
    await setup();
    gs_symset[gc_currentgraphics.set].handling = H_UTF8;
    const glyphnum = C.GLYPH_MON_MALE_OFF + PMNAMES.PM_HUMAN;
    glyphmap()[glyphnum].u = unicode;
    show_glyph_cell(x, y, 'Q', CLR_WHITE, false, 0, {kind: 'effect', glyphnum});
    assert.equal(gbuf_at(x, y).disp_u, unicode);
    free_all_glyphmap_u();
    assert.equal(glyphmap()[glyphnum].u, null);
    assert.equal(gbuf_at(x, y).disp_u, null);
    await row_refresh(x, x, y);
    assert.equal(game.nhDisplay.grid[y + 1][x - 1].ch, 'Q');
});

test('native controls reach basic colors, RGB and both option gates', () => {
    const fixture = JSON.parse(readFileSync(new URL(
        'gen-sessions/generated/custom-glyph-rendering.session.json', import.meta.url)));
    const samples = [
        ['hero-basic-color', 0, 13, CLR_RED],
        ['hero-basic-color-off', 0, 13, NO_COLOR],
        ['hero-customcolor-off', 0, 13, CLR_WHITE],
        ['hero-toggle-color', 3, 13, NO_COLOR],
        ['hero-toggle-color', 6, 13, CLR_RED],
        ['hero-extra-color', 0, 13, NO_COLOR],
        ['fountain-plain-control', 12, 13, CLR_BRIGHT_BLUE],
        ['fountain-unicode-off', 12, 13, NO_COLOR],
    ];
    for (const [name, step, row, color] of samples) {
        const segment = renderingRecipe.segments.findIndex(item => item.name === name);
        assert.ok(segment >= 0, name);
        const cells = decodeScreen(fixture.segments[segment].steps[step].screen);
        assert.equal(cells[row][7].color, color, name);
    }
});
