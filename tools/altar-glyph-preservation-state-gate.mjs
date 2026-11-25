// Constructed owner controls, booted with ordinary keys and real producers.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate,setTimeout} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {resetInputState} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {cansee} from '../js/vision.js';
import {make_blinded} from '../js/potion.js';
import {Blind} from '../js/youprop.js';
import {mksobj,place_object} from '../js/mkobj.js';
import {obj_extract_self} from '../js/invent.js';
import {t_at} from '../js/mon.js';
import {seetrap,deltrap} from '../js/trap.js';
import {make_engr_at,engr_at} from '../js/engrave.js';
import {ONAMES} from '../js/objects_data.js';
import {cmap_names as CM} from '../js/drawing_data.js';
import {ALTAR,DART_TRAP,BURN,GLYPH_ALTAR_OFF,GLYPH_CMAP_A_OFF} from '../js/const.js';
import {back_to_glyph,terrain_glyph,newsym,glyph_at,gbuf_at,glyphmap,
    map_background,flash_glyph_at,flush_screen,docrt,pline,
    display_nhwindow_message} from '../js/display.js';

const parts=JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/altar-glyph-preservation.json',import.meta.url))).segments;
const loc=()=>game.level.at(8,12);
const number=()=>gbuf_at(8,12).disp_glyphnum;
const cell=()=>({...game.nhDisplay.grid[13][7]});
async function boot(wish='lawful altar',hero=false) {
    const part={...parts[0],moves:' \x17'+wish+'\r'+(hero?'':'l\x12')};
    const run=await runSegment({...part,storage:new InMemoryStorage()});
    game._preNhgetchHook=null;
    resetInputState();
    run._display.onEmptyQueue=async()=>{await setImmediate();return 32;};
    await display_nhwindow_message();
    assert.deepEqual([game.u.ux,game.u.uy],[hero?8:9,12]);
    assert.equal(loc().typ,ALTAR);assert.ok(cansee(8,12));
    return run;
}
function expectedAltar(offset) {
    const expected=GLYPH_ALTAR_OFF+offset;
    assert.equal(number(),expected);
    assert.deepEqual(glyph_at(8,12),{kind:'cmap',cmap:CM.S_altar,glyphnum:expected});
    assert.deepEqual(loc().remembered_glyph.glyph,glyph_at(8,12));
}
async function trappedAltar() {
    const run=await runSegment({...parts[0],moves:' l\x17dart trap\r\x17lawful altar\rh\x12',
        storage:new InMemoryStorage()});
    game._preNhgetchHook=null;resetInputState();
    run._display.onEmptyQueue=async()=>{await setImmediate();return 32;};
    await display_nhwindow_message();
    assert.deepEqual([game.u.ux,game.u.uy],[8,12]);
    assert.equal(game.level.at(9,12).typ,ALTAR);
    const trap=t_at(9,12);assert.equal(trap?.ttyp,DART_TRAP);
    return trap;
}

for(const [alignment,mask,offset] of [
    ['unaligned',0,0],['chaotic',1,1],['neutral',2,2],['lawful',4,3],
]) {
    await test(`${alignment} wish preserves the terrain number and memory after departure`,async()=>{
        await boot(alignment+' altar');assert.equal(loc().altarmask,mask);
        const expected=GLYPH_ALTAR_OFF+offset;
        assert.equal(back_to_glyph(loc(),8,12).glyph.glyphnum,expected);
        assert.equal(terrain_glyph(loc(),8,12).glyph.glyphnum,expected);
        const rng=[...getRngLog()];assert.equal(newsym(8,12),undefined);
        expectedAltar(offset);assert.deepEqual(getRngLog(),rng);
        const g=gbuf_at(8,12),gm=glyphmap()[expected];
        assert.equal(g.disp_customcolor,gm.customcolor??0);
        assert.equal(g.disp_glyphflags,gm.glyphflags);
        assert.equal(g.disp_tileidx,gm.tileidx??0);
    });
}
await test('hero-square mapping already retains the lawful background beneath the hero',async()=>{
    await boot('lawful altar',true);
    const before=structuredClone(loc().remembered_glyph),rng=[...getRngLog()];
    assert.equal(newsym(8,12),undefined);
    assert.equal(loc().remembered_glyph.glyph.glyphnum,GLYPH_ALTAR_OFF+3);
    assert.deepEqual(loc().remembered_glyph,before);
    assert.notEqual(number(),GLYPH_ALTAR_OFF+3);assert.equal(cell().ch,'@');
    assert.deepEqual(getRngLog(),rng);
});
await test('map_background already preserves the exact terrain identity',async()=>{
    await boot();const rng=[...getRngLog()];
    assert.equal(map_background(8,12,true),undefined);
    expectedAltar(3);assert.equal(loc().lastseentyp,ALTAR);
    assert.deepEqual(getRngLog(),rng);
});
await test('newsym does not downgrade a real map_background glyph',async()=>{
    await boot();map_background(8,12,true);
    const memory=structuredClone(loc().remembered_glyph),rng=[...getRngLog()];
    assert.equal(newsym(8,12),undefined);
    expectedAltar(3);assert.deepEqual(loc().remembered_glyph,memory);
    assert.deepEqual(getRngLog(),rng);
});
await test('real blindness recalls the alignment learned while sighted',async()=>{
    await boot();const rng=[...getRngLog()];
    await make_blinded(100,false);await flush_screen(0);
    assert.equal(Blind(),true);assert.equal(!!cansee(8,12),false);
    assert.equal(newsym(8,12),undefined);await flush_screen(0);
    expectedAltar(3);assert.equal(cell().ch,'_');
    assert.deepEqual(getRngLog(),rng);
});
await test('repeated newsym leaves the already correct glyph buffer clean and consumes no RNG',async()=>{
    await boot();newsym(8,12);await flush_screen(0);
    const buffer=gbuf_at(8,12),memory=structuredClone(loc().remembered_glyph);
    const rng=[...getRngLog()];assert.equal(buffer.gnew,0);
    assert.equal(newsym(8,12),undefined);assert.equal(newsym(8,12),undefined);
    assert.equal(gbuf_at(8,12),buffer);assert.equal(buffer.gnew,0);
    assert.deepEqual(loc().remembered_glyph,memory);assert.deepEqual(getRngLog(),rng);
});
await test('real object placement keeps the object layer above the altar',async()=>{
    await boot();const rock=mksobj(ONAMES.ROCK,false,false);
    await place_object(rock,8,12);newsym(8,12);
    assert.equal(game.level.objAt.get('8,12'),rock);
    assert.equal(glyph_at(8,12).kind,'obj');
    assert.equal(glyph_at(8,12).otyp,ONAMES.ROCK);
    assert.equal(loc().remembered_glyph.glyph.kind,'obj');
    const before=number(),rng=[...getRngLog()];newsym(8,12);
    assert.equal(number(),before);assert.deepEqual(getRngLog(),rng);
});
await test('real object extraction reveals the original lawful altar',async()=>{
    await boot();const rock=mksobj(ONAMES.ROCK,false,false);
    await place_object(rock,8,12);newsym(8,12);
    assert.equal(glyph_at(8,12).kind,'obj');
    obj_extract_self(rock);assert.equal(game.level.objectsAt(8,12).length,0);
    const rng=[...getRngLog()];newsym(8,12);expectedAltar(3);
    assert.deepEqual(getRngLog(),rng);
});
await test('a real discovered trap retains priority over the altar',async()=>{
    const trap=await trappedAltar();seetrap(trap);assert.equal(trap.tseen,1);
    newsym(9,12);assert.equal(glyph_at(9,12).cmap,CM.S_dart_trap);
    assert.equal(game.level.at(9,12).remembered_glyph.glyph.cmap,CM.S_dart_trap);
    const rng=[...getRngLog()],before=gbuf_at(9,12).disp_glyphnum;newsym(9,12);
    assert.equal(gbuf_at(9,12).disp_glyphnum,before);assert.deepEqual(getRngLog(),rng);
});
await test('real trap deletion restores the altar identity',async()=>{
    const trap=await trappedAltar();seetrap(trap);
    deltrap(trap);assert.ok(!game.level.traps.includes(trap));
    const rng=[...getRngLog()];newsym(9,12);
    assert.equal(gbuf_at(9,12).disp_glyphnum,GLYPH_ALTAR_OFF+3);
    assert.equal(game.level.at(9,12).remembered_glyph.glyph.glyphnum,GLYPH_ALTAR_OFF+3);
    assert.deepEqual(getRngLog(),rng);
});
await test('the engraving fallback keeps its own symbol and number',async()=>{
    const run=await runSegment({...parts[3],storage:new InMemoryStorage()});
    game._preNhgetchHook=null;resetInputState();
    run._display.onEmptyQueue=async()=>{await setImmediate();return 32;};
    await display_nhwindow_message();
    make_engr_at(9,12,'marks','marks',game.moves,BURN);
    const rng=[...getRngLog()];assert.equal(newsym(9,12),undefined);
    assert.equal(engr_at(9,12).erevealed,1);
    assert.equal(glyph_at(9,12).cmap,CM.S_engroom);
    assert.equal(gbuf_at(9,12).disp_glyphnum,
        GLYPH_CMAP_A_OFF+CM.S_engroom-CM.S_ndoor);
    assert.deepEqual(game.level.at(9,12).remembered_glyph.glyph,glyph_at(9,12));
    assert.deepEqual(getRngLog(),rng);
});
await test('flash_glyph_at restores the learned alignment without a terrain recomputation',async()=>{
    const run=await boot();const before=run.getAnimationFramesByStep().flat().length;
    const rng=[...getRngLog()],floor=terrain_glyph(game.level.at(9,12),9,12);
    await flash_glyph_at(8,12,{...floor,decgfx:floor.dec},1);
    expectedAltar(3);assert.deepEqual(getRngLog(),rng);
    // Frames are pending until the next input boundary, not committed to a step.
    assert.equal(run.getAnimationFramesByStep().flat().length,before);
    assert.equal(run._pendingAnimFrames.length,2);
});
await test('pending More delays docrt; reentry is quiet and the final altar identity survives',async()=>{
    const run=await boot();await pline('A message waits before the altar redraw.');
    let release,settled=false,error;
    run._display.onEmptyQueue=()=>new Promise(resolve=>{release=resolve;});
    const action=docrt().then(()=>{settled=true;},e=>{error=e;settled=true;});
    try {
        for(let i=0;i<200&&!release&&!settled;i++)await setTimeout(1);
        assert.ok(release);assert.equal(settled,false);
        assert.equal(game.program_state.in_docrt,true);
        const screen=run._display.terminal.serialize(),rng=[...getRngLog()];
        await docrt();assert.equal(run._display.terminal.serialize(),screen);
        assert.deepEqual(getRngLog(),rng);
    } finally {
        run._display.onEmptyQueue=async()=>{await setImmediate();return 32;};
        release?.(32);await action;
    }
    if(error)throw error;
    assert.equal(game.program_state.in_docrt,false);expectedAltar(3);
});
