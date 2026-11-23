#!/usr/bin/env node
// Separate C-derived Rogue color checks. Pet highlighting is disabled.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import * as C from '../js/const.js';
import {PMNAMES as PM} from '../js/monst_data.js';
import {CLR_YELLOW,CLR_WHITE,NO_COLOR} from '../js/terminal.js';
import {show_glyph_cell,gbuf_at,row_refresh,reset_glyphmap,glyphmap} from '../js/display.js';
import {gs_symset,gc_currentgraphics,H_IBM,H_UNK} from '../js/symbols.js';
const input=JSON.parse(readFileSync(new URL('gen-sessions/recipes/class-glyph-startup.json',import.meta.url)));
const x=4,y=2;
const offsets={normal:[C.GLYPH_MON_MALE_OFF,C.GLYPH_MON_FEM_OFF],
    pet:[C.GLYPH_PET_MALE_OFF,C.GLYPH_PET_FEM_OFF],
    detected:[C.GLYPH_DETECT_MALE_OFF,C.GLYPH_DETECT_FEM_OFF],
    ridden:[C.GLYPH_RIDDEN_MALE_OFF,C.GLYPH_RIDDEN_FEM_OFF]};
async function setup() {
    await runSegment({...input.segments[0],moves:' ',storage:new InMemoryStorage()});
    game.rogue_level={...game.u.uz};game.flags.color=true;game.flags.hilite_pet=false;
    gc_currentgraphics.set=C.ROGUESET;
    gs_symset[C.ROGUESET].handling=H_IBM;gs_symset[C.ROGUESET].nocolor=false;
    reset_glyphmap(C.gm_levelchange);game.gbuf=[];
}
for(const range of Object.keys(offsets))for(const female of [false,true])for(const hallu of [false,true]) {
    test(`Rogue ${range} ${female?'female':'male'}, hallucination ${hallu}: captured range controls color`,async()=>{
        await setup();game.u.uprops.HALLUC=hallu?100:0;
        const glyphnum=PM.PM_GNOME+offsets[range][+female];
        // The live values contradict the captured range/gender deliberately.
        const mon={mnum:PM.PM_GNOME,data:game.mons[PM.PM_GNOME],mtame:range==='normal'?7:0,female:+!female};
        const desc={kind:'mon',mon,glyphnum,mnum:PM.PM_GNOME,female};
        const expected=range==='normal'&&!female?CLR_YELLOW:NO_COLOR;
        const before={core:structuredClone(game.coreCtx),display:structuredClone(game.dispCtx)};
        assert.equal(glyphmap()[glyphnum].sym.color,expected,'existing glyphmap source control');
        show_glyph_cell(x,y,'g',CLR_WHITE,false,0,desc);row_refresh(x,x,y);
        assert.equal(gbuf_at(x,y).disp_color,expected);
        assert.equal(game.nhDisplay.grid[y+1][x-1].color,expected);
        mon.mtame=mon.mtame?0:5;mon.female=!mon.female;
        show_glyph_cell(x,y,'g',CLR_WHITE,false,0,desc);row_refresh(x,x,y);
        assert.equal(game.nhDisplay.grid[y+1][x-1].color,expected);
        assert.deepEqual({core:game.coreCtx,display:game.dispCtx},before);
    });
}
for(const variant of ['nocolor','non-IBM','color disabled']) test(`Rogue gate: ${variant}`,async()=>{
    await setup();
    if(variant==='nocolor')gs_symset[C.ROGUESET].nocolor=true;
    if(variant==='non-IBM')gs_symset[C.ROGUESET].handling=H_UNK;
    if(variant==='color disabled')game.flags.color=false;
    show_glyph_cell(x,y,'g',CLR_WHITE,false,0,{kind:'mon',glyphnum:PM.PM_GNOME+C.GLYPH_MON_MALE_OFF});
    row_refresh(x,x,y);assert.equal(game.nhDisplay.grid[y+1][x-1].color,NO_COLOR);
});
