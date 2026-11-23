#!/usr/bin/env node
// Source-state controls for display_monster, newsym and feel_location.
// The loader observes overwritten glyphs and isolates corrupt-state diagnostics.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {register} from 'node:module';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {game} from '../js/gstate.js';

// Keep game as a live binding across runSegment's state resets.
register('./display-monster-state-loader.mjs', import.meta.url);
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const C = await import('../js/const.js');
const {PMNAMES: PM, NUMMONS} = await import('../js/monst_data.js');
const {ONAMES: O} = await import('../js/objects_data.js');
const {cmap_names: S} = await import('../js/drawing_data.js');
const {CLR_MAGENTA, CLR_BROWN, NO_COLOR} = await import('../js/terminal.js');
const {newsym, feel_location, gbuf_at} = await import('../js/display.js');
const {rn2_on_display_rng} = await import('../js/rng.js');
const {IN_SIGHT, COULD_SEE} = await import('../js/vision.js');

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
    game.u.ux=x+1; game.u.uy=y;
    mon.meverseen=0;
    return mon;
}
function monGlyph(mnum,female,range='normal') {
    const offsets={normal:[C.GLYPH_MON_MALE_OFF,C.GLYPH_MON_FEM_OFF],
        pet:[C.GLYPH_PET_MALE_OFF,C.GLYPH_PET_FEM_OFF],
        detected:[C.GLYPH_DETECT_MALE_OFF,C.GLYPH_DETECT_FEM_OFF]};
    return mnum+offsets[range][+!!female];
}
function applySense(mode) {
    if(mode==='detection') game.u.uprops.DETECT_MONSTERS=100;
    if(mode==='telepathy') {
        game.u.uprops.TELEPAT=100;
        game.u.intrinsic.HTelepat=100;
        game.u.unblind_telepat_range=10000;
    }
    if(mode==='protection') game.u.uprops.PROT_FROM_SHAPE_CHANGERS=100;
    if(mode==='warning') {
        game.u.intrinsic.HWarn_of_mon=100;
        game.context.warntype={species:PM.PM_LARGE_MIMIC};
    }
}
function fakeAppearance(mon,kind) {
    const types={furniture:C.M_AP_FURNITURE,object:C.M_AP_OBJECT,
        statue:C.M_AP_OBJECT,monster:C.M_AP_MONSTER};
    mon.m_ap_type=types[kind];
    mon.mappearance=kind==='furniture'?S.S_altar:kind==='object'?O.DAGGER
        :kind==='statue'?O.STATUE:PM.PM_HUMAN;
    mon.mcorpsenm=PM.PM_NEWT;
}
function randomObjectGlyph() {
    const otyp=rn2_on_display_rng(O.NUM_OBJECTS-O.FIRST_OBJECT)+O.FIRST_OBJECT;
    return otyp===O.CORPSE?C.GLYPH_BODY_OFF+rn2_on_display_rng(NUMMONS):C.GLYPH_OBJ_OFF+otyp;
}
function expectedMimic({kind,hallu,sensed,physicallySeen,female=true,memory=true,range='normal'}) {
    const before=structuredClone(game.dispCtx);
    const core=structuredClone(game.coreCtx);
    let remembered,appearance,final;
    const stages=[];
    if(physicallySeen) {
        if(kind==='furniture') {
            remembered=C.GLYPH_ALTAR_OFF+2;
            if(!sensed) stages.push(remembered);
        } else if(kind==='monster') {
            const mnum=hallu?rn2_on_display_rng(NUMMONS):PM.PM_HUMAN;
            appearance=monGlyph(mnum,female);
            stages.push(appearance);
        } else {
            if(kind==='statue') {
                if(hallu) {
                    const mnum=rn2_on_display_rng(NUMMONS),gender=rn2_on_display_rng(2);
                    appearance=monGlyph(mnum,gender);
                } else appearance=C.GLYPH_STATUE_MALE_OFF+PM.PM_NEWT;
            } else appearance=hallu?randomObjectGlyph():C.GLYPH_OBJ_OFF+O.DAGGER;
            if(memory) remembered=hallu&&kind==='statue'?randomObjectGlyph():appearance;
            if(!sensed) stages.push(appearance);
        }
    }
    if(sensed) {
        const mnum=hallu?rn2_on_display_rng(NUMMONS):PM.PM_LARGE_MIMIC;
        final=monGlyph(mnum,female,range);
        stages.push(final);
    } else final=stages.at(-1);
    const after=structuredClone(game.dispCtx);
    game.dispCtx=before;
    return {core,after,remembered,appearance,final,stages};
}
function beginTrace() { globalThis.__display_monster_cells=[]; }
function checkRng(expected) {
    assert.deepEqual(game.coreCtx,expected.core,'core RNG unchanged');
    assert.deepEqual(game.dispCtx,expected.after,'all C display draws occur in order');
}
function chosenStages() {
    return globalThis.__display_monster_cells.filter(c=>c.x===x&&c.y===y)
        .map(c=>c.glyph.glyphnum).filter(n=>n!==undefined);
}

for(const kind of ['furniture','object','statue','monster']) {
    for(const mode of ['none','detection','telepathy','protection']) {
        for(const hallu of [false,true]) test(`visible ${kind}, ${mode}, hallucination=${hallu}`,async()=>{
            const mon=await setup({mnum:PM.PM_LARGE_MIMIC,female:true,hallu});
            fakeAppearance(mon,kind); applySense(mode);
            const sensed=mode!=='none';
            const expected=expectedMimic({kind,hallu,sensed,physicallySeen:true});
            beginTrace(); newsym(x,y);
            checkRng(expected);
            assert.equal(gbuf_at(x,y).disp_glyphnum,expected.final);
            assert.deepEqual(chosenStages(),expected.stages,'overridden glyph is still produced');
            assert.equal(mon.meverseen,sensed?1:0,'only the real monster becomes seen');
            if(expected.remembered!==undefined)
                assert.equal(game.level.at(x,y).remembered_glyph.glyph.glyphnum,expected.remembered);
            if(kind==='furniture'&&!sensed)
                assert.equal(game.level.at(x,y).lastseentyp,C.ALTAR);
        });
    }
}
for(const kind of ['furniture','object','statue','monster']) {
    for(const mode of ['telepathy','detection']) test(`blind newsym ${kind}, ${mode}, hallucinating`,async()=>{
        const mon=await setup({mnum:PM.PM_LARGE_MIMIC,female:true,hallu:true,visible:false});
        game.u.intrinsic.HBlinded=100;
        fakeAppearance(mon,kind); applySense(mode);
        const expected=expectedMimic({kind,hallu:true,sensed:true,physicallySeen:false,
            range:mode==='detection'?'detected':'normal'});
        beginTrace(); newsym(x,y);
        checkRng(expected);
        assert.equal(gbuf_at(x,y).disp_glyphnum,expected.final);
        assert.deepEqual(chosenStages(),expected.stages,'blind redraw skips the disguise');
    });
}
for(const kind of ['furniture','object','statue','monster']) {
    for(const levitating of [false,true]) test(`blind touch ${kind}, telepathy, levitation=${levitating}`,async()=>{
        const mon=await setup({mnum:PM.PM_LARGE_MIMIC,female:true,hallu:true,visible:false});
        game.u.intrinsic.HBlinded=100;
        if(levitating) game.u.intrinsic.HLevitation=100;
        fakeAppearance(mon,kind); applySense('telepathy');
        const expected=expectedMimic({kind,hallu:true,sensed:true,physicallySeen:true});
        beginTrace(); feel_location(x,y);
        checkRng(expected);
        assert.equal(gbuf_at(x,y).disp_glyphnum,expected.final);
        if(kind==='monster') assert.deepEqual(chosenStages().slice(-2),expected.stages);
        if(expected.remembered!==undefined)
            assert.equal(game.level.at(x,y).remembered_glyph.glyph.glyphnum,expected.remembered);
    });
}
for(const kind of ['object','statue','monster']) test(`invisible detected ${kind} skips the disguise draw`,async()=>{
    const mon=await setup({mnum:PM.PM_LARGE_MIMIC,female:true,hallu:true,detected:true});
    fakeAppearance(mon,kind);
    const expected=expectedMimic({kind,hallu:true,sensed:true,physicallySeen:false,range:'detected'});
    beginTrace(); newsym(x,y);
    checkRng(expected);
    assert.equal(gbuf_at(x,y).disp_glyphnum,expected.final);
    assert.deepEqual(chosenStages(),expected.stages);
});
for(const kind of ['furniture','object','statue']) test(`${kind} memory with hero_memory disabled`,async()=>{
    const mon=await setup({mnum:PM.PM_LARGE_MIMIC,female:true,hallu:true});
    game.level.flags.hero_memory=false;
    fakeAppearance(mon,kind); applySense('protection');
    const expected=expectedMimic({kind,hallu:true,sensed:true,physicallySeen:true,memory:false});
    beginTrace(); newsym(x,y);
    checkRng(expected);
    assert.equal(gbuf_at(x,y).disp_glyphnum,expected.final);
    assert.equal(game.level.at(x,y).remembered_glyph?.glyph?.glyphnum,expected.remembered);
});

for(const mode of ['telepathy','detection','warning']) {
    for(const hallu of [false,true]) {
        for(const tame of [false,true]) test(`unseen worm tail: ${mode}, hallucination=${hallu}, tame=${tame}`,async()=>{
            const mon=await setup({mnum:PM.PM_LONG_WORM,visible:false,female:true,hallu,tame});
            mon.wormno=1; mon.mx=x+2;
            applySense(mode);
            if(mode==='warning') game.context.warntype.species=PM.PM_LONG_WORM;
            game.u.intrinsic.HBlinded=100;
            const before=structuredClone(game.dispCtx),core=structuredClone(game.coreCtx);
            const mnum=mode==='detection'?null:hallu?rn2_on_display_rng(NUMMONS):PM.PM_LONG_WORM_TAIL;
            const after=structuredClone(game.dispCtx); game.dispCtx=before;
            beginTrace(); newsym(x,y);
            assert.deepEqual(game.coreCtx,core);
            assert.deepEqual(game.dispCtx,after);
            if(mode==='detection') assert.notEqual(gbuf_at(x,y)?.disp_glyph?.kind,'mon');
            else assert.equal(gbuf_at(x,y).disp_glyphnum,monGlyph(mnum,true,tame&&!hallu?'pet':'normal'));
        });
    }
}
for(const tame of [false,true]) test(`blind touch detects worm tail, tame=${tame}`,async()=>{
    const mon=await setup({mnum:PM.PM_LONG_WORM,visible:false,female:true,tame});
    mon.wormno=1; mon.mx=x+2;
    game.u.intrinsic.HBlinded=100; applySense('detection');
    beginTrace(); feel_location(x,y);
    assert.equal(gbuf_at(x,y).disp_glyphnum,monGlyph(PM.PM_LONG_WORM_TAIL,true,tame?'pet':'detected'));
});

for(const mode of ['none','detection','telepathy']) test(`ordinary visible monster keeps ${mode} selection`,async()=>{
    const mon=await setup({mnum:PM.PM_GNOME,female:true,hallu:true,detected:mode==='detection'});
    applySense(mode);
    const before=structuredClone(game.dispCtx),core=structuredClone(game.coreCtx);
    const mnum=rn2_on_display_rng(NUMMONS),after=structuredClone(game.dispCtx); game.dispCtx=before;
    beginTrace(); newsym(x,y);
    assert.equal(gbuf_at(x,y).disp_glyphnum,monGlyph(mnum,true,mode==='detection'?'detected':'normal'));
    assert.deepEqual(game.dispCtx,after); assert.deepEqual(game.coreCtx,core);
});

test('specific warning reveals a furniture mimic while retaining the disguise in memory',async()=>{
    const mon=await setup({mnum:PM.PM_LARGE_MIMIC,female:true});
    fakeAppearance(mon,'furniture'); applySense('warning');
    newsym(x,y);
    assert.equal(gbuf_at(x,y).disp_glyphnum,monGlyph(PM.PM_LARGE_MIMIC,true));
    assert.equal(game.level.at(x,y).remembered_glyph.glyph.cmap,S.S_altar);
});

test('blind protection alone does not make an unseen mimic spottable',async()=>{
    const mon=await setup({mnum:PM.PM_LARGE_MIMIC,visible:false});
    game.u.intrinsic.HBlinded=100;
    fakeAppearance(mon,'monster'); applySense('protection');
    const before=structuredClone(game.dispCtx);
    newsym(x,y);
    assert.notEqual(gbuf_at(x,y)?.disp_glyph?.kind,'mon');
    assert.deepEqual(game.dispCtx,before);
});

for(const variant of ['missing','uninitialized','flat','nested']) test(`mimic corpse species: ${variant}`,async()=>{
    const mon=await setup({mnum:PM.PM_LARGE_MIMIC});
    mon.m_ap_type=C.M_AP_OBJECT; mon.mappearance=O.CORPSE;
    if(variant==='uninitialized')mon.mcorpsenm=-1;
    if(variant==='flat')mon.mcorpsenm=PM.PM_GIANT_ANT;
    if(variant==='nested')mon.mextra={mcorpsenm:PM.PM_NEWT};
    newsym(x,y);
    const mnum=variant==='flat'?PM.PM_GIANT_ANT:variant==='nested'?PM.PM_NEWT:PM.PM_TENGU;
    assert.equal(gbuf_at(x,y).disp_glyphnum,C.GLYPH_BODY_OFF+mnum);
});
for(const sensed of [false,true]) test(`invalid appearance reports diagnostic and falls through, sensed=${sensed}`,async()=>{
    const mon=await setup({mnum:PM.PM_LARGE_MIMIC,hallu:true});
    mon.m_ap_type=5;
    if(sensed)applySense('detection');
    const before=structuredClone(game.dispCtx),core=structuredClone(game.coreCtx);
    const stages=[monGlyph(rn2_on_display_rng(NUMMONS),false)];
    if(sensed)stages.push(monGlyph(rn2_on_display_rng(NUMMONS),false));
    const after=structuredClone(game.dispCtx); game.dispCtx=before;
    const diagnostics=[];
    // Only diagnostic I/O is replaced, so its text and fallthrough can be
    // checked without opening an impossible-message acknowledgement prompt.
    globalThis.__display_monster_impossible=text=>diagnostics.push(text);
    try {
        beginTrace(); newsym(x,y);
        assert.deepEqual(diagnostics,['display_monster:  bad m_ap_type value [ = 5 ]']);
        assert.deepEqual(chosenStages(),stages);
        assert.deepEqual(game.dispCtx,after); assert.deepEqual(game.coreCtx,core);
        assert.equal(mon.meverseen,sensed?1:0);
    } finally { delete globalThis.__display_monster_impossible; }
});

test('native controls distinguish sensed mimics, telepathic tails and detected heads', () => {
    const fixture = JSON.parse(readFileSync(new URL(
        'gen-sessions/generated/display-monster-sensing.session.json', import.meta.url)));
    for (const [segment, step, ch] of [[0, 53, 'm'], [1, 73, '@']]) {
        const cell = decodeScreen(fixture.segments[segment].steps[step].screen)[13][8];
        assert.deepEqual([cell.ch, cell.color, cell.attr], [ch, CLR_MAGENTA, 0]);
    }
    for (const [segment, step, sensedTail] of [[2, 83, true], [3, 71, false]]) {
        const grid = decodeScreen(fixture.segments[segment].steps[step].screen);
        for (const [x, y] of [[4, 14], [4, 15], [3, 16], [4, 16]]) {
            const cell = grid[y][x];
            assert.deepEqual([cell.ch, cell.color, cell.decgfx, cell.attr],
                ['~', sensedTail ? CLR_BROWN : NO_COLOR, sensedTail ? 0 : 1, 0]);
        }
        const head = grid[16][5];
        assert.deepEqual([head.ch, head.color, head.attr], ['w', CLR_BROWN, sensedTail ? 0 : 1]);
    }
});
