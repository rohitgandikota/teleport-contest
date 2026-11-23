#!/usr/bin/env node
// Source-state controls for glyphs.c:581 and :647. Not a native oracle.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {glyphmap} from '../js/display.js';
import * as glyphs from '../js/glyphs.js';
import {GLYPH_OBJ_OFF, GLYPH_OBJ_PILETOP_OFF, NH_BASIC_COLOR,
        do_custom_colors, do_custom_symbols} from '../js/const.js';
import {NUM_OBJECTS, ONAMES} from '../js/objects_data.js';
import {getRngLog} from '../js/rng.js';
import {gs_symset, gc_currentgraphics, H_UTF8} from '../js/symbols.js';
import {reset_customsymbols} from '../js/utf8map.js';
import {reset_customcolors} from '../js/glyphs.js';
import {CLR_RED} from '../js/terminal.js';

const input = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/class-glyph-startup.json', import.meta.url))).segments[0];
const offsets = [GLYPH_OBJ_OFF, GLYPH_OBJ_PILETOP_OFF];
const empty = {u:null, customcolor:0, color256idx:0};
function metadata(index) {
    const {u,customcolor,color256idx} = glyphmap()[index];
    return {u,customcolor,color256idx};
}
function prepare() {
    for (let i=0;i<NUM_OBJECTS;i++) {
        game.objects[i].oc_descr_idx = i;
        for (const offset of offsets)
            Object.assign(glyphmap()[offset+i], empty);
    }
    game.iflags.pending_customizations = true;
}
async function setup() {
    await runSegment({...input,moves:' ',storage:new InMemoryStorage()});
    prepare();
}
function shuffle() {
    const rng = (getRngLog() || []).length;
    glyphs.maybe_shuffle_customizations();
    assert.equal((getRngLog() || []).length,rng,'shuffle consumes no RNG');
}

test('object and pile customizations follow a three-way description permutation',async()=>{
    await setup();
    game.objects[20].oc_descr_idx=21;
    game.objects[21].oc_descr_idx=22;
    game.objects[22].oc_descr_idx=20;
    const expected=[];
    for (const [j,offset] of offsets.entries()) {
        const a={u:{utf32ch:65+j,utf8str:[65+j]},customcolor:0x123456+j,color256idx:40+j};
        const b={u:null,customcolor:0x654321+j,color256idx:70+j};
        Object.assign(glyphmap()[offset+20],a);
        Object.assign(glyphmap()[offset+21],b);
        expected.push([b,empty,a]);
    }
    shuffle();
    for (const [j,offset] of offsets.entries())
        assert.deepEqual([20,21,22].map(i=>metadata(offset+i)),expected[j]);
    assert.equal(game.iflags.pending_customizations,false);
});

test('duplicate descriptions own separate Unicode records and byte arrays',async()=>{
    await setup();
    game.objects[21].oc_descr_idx=20;
    game.objects[22].oc_descr_idx=20;
    for (const offset of offsets)
        Object.assign(glyphmap()[offset+20],{u:{utf32ch:0x2603,utf8str:[226,152,131]},customcolor:0x123456,color256idx:42});
    shuffle();
    for (const offset of offsets) {
        const [a,b,c]=[20,21,22].map(i=>glyphmap()[offset+i]);
        assert.deepEqual(metadata(offset+21),metadata(offset+20));
        assert.deepEqual(metadata(offset+22),metadata(offset+20));
        assert.notEqual(a.u,b.u);assert.notEqual(b.u,c.u);
        assert.notEqual(a.u.utf8str,b.u.utf8str);
        b.u.utf8str[0]=0;
        assert.deepEqual(a.u.utf8str,[226,152,131]);
        assert.deepEqual(c.u.utf8str,[226,152,131]);
    }
});

test('duplicating a representation with null bytes preserves its code point',async()=>{
    await setup();
    game.objects[21].oc_descr_idx=20;
    for (const offset of offsets)
        glyphmap()[offset+20].u={utf32ch:0xd800,utf8str:null};
    shuffle();
    for (const offset of offsets) {
        assert.deepEqual(glyphmap()[offset+21].u,{utf32ch:0xd800,utf8str:null});
        assert.notEqual(glyphmap()[offset+20].u,glyphmap()[offset+21].u);
    }
});

test('color-only duplicate descriptions retain both custom color fields',async()=>{
    await setup();
    game.objects[21].oc_descr_idx=20;
    for (const offset of offsets)
        Object.assign(glyphmap()[offset+20],{u:null,customcolor:0xabcdef,color256idx:23});
    shuffle();
    for (const offset of offsets)
        assert.deepEqual(metadata(offset+21),{u:null,customcolor:0xabcdef,color256idx:23});
});

test('unused source descriptions are discarded and unrelated glyph fields survive',async()=>{
    await setup();
    game.objects[21].oc_descr_idx=20;
    for (const offset of offsets) {
        Object.assign(glyphmap()[offset+21],{u:{utf32ch:65,utf8str:[65]},customcolor:0x123456,color256idx:17});
        glyphmap()[offset+21].color=12;
    }
    shuffle();
    for (const offset of offsets) {
        assert.deepEqual(metadata(offset+21),empty);
        assert.equal(glyphmap()[offset+21].color,12);
    }
});

test('an isolated color index is copied even without a color or Unicode value',async()=>{
    await setup();
    game.objects[21].oc_descr_idx=20;
    for (const offset of offsets)
        glyphmap()[offset+20].color256idx=103;
    shuffle();
    for (const offset of offsets)
        for (const i of [20,21])
            assert.deepEqual(metadata(offset+i),{u:null,customcolor:0,color256idx:103});
});

test('the pending flag prevents a second permutation and gates unused calls',async()=>{
    await setup();
    game.objects[20].oc_descr_idx=21;
    game.objects[21].oc_descr_idx=20;
    glyphmap()[GLYPH_OBJ_OFF+20].customcolor=0x123456;
    game.iflags.pending_customizations=false;
    shuffle();
    assert.equal(glyphmap()[GLYPH_OBJ_OFF+20].customcolor,0x123456);
    game.iflags.pending_customizations=true;
    shuffle();
    assert.equal(glyphmap()[GLYPH_OBJ_OFF+21].customcolor,0x123456);
    shuffle();
    assert.equal(glyphmap()[GLYPH_OBJ_OFF+21].customcolor,0x123456);
});

test('the real move loop applies pending customizations before the next command',async()=>{
    let injected=false,checked=false;
    globalThis.__step_snapshot={step:'*',cb:(_game,step)=>{
        if(step===1) {
            prepare();
            game.objects[20].oc_descr_idx=21;
            game.objects[21].oc_descr_idx=20;
            glyphmap()[GLYPH_OBJ_OFF+20].customcolor=0x123456;
            injected=true;
        } else if(step===2) {
            assert.equal(glyphmap()[GLYPH_OBJ_OFF+21].customcolor,0x123456);
            assert.equal(game.iflags.pending_customizations,false);
            checked=true;
        }
    }};
    try {
        await runSegment({...input,moves:' ..',storage:new InMemoryStorage()});
        assert.ok(injected);assert.ok(checked);
    } finally {delete globalThis.__step_snapshot;}
});

for (const resetSymbols of [false,true]) {
    test(`parsed object customization survives a ${resetSymbols ? 'symbol' : 'color'} reset and reshuffle`,async()=>{
        await setup();
        const from=ONAMES.POT_HEALING, to=ONAMES.POT_GAIN_ENERGY;
        game.objects[from].oc_descr_idx=to;
        game.objects[to].oc_descr_idx=from;
        gs_symset[gc_currentgraphics.set].handling=H_UTF8;
        assert.equal(glyphs.glyphrep_to_custom_map_entries('G_potion_of_healing:U+2603/red'),1);
        assert.equal(glyphs.glyphrep_to_custom_map_entries('G_piletop_potion_of_healing:U+2603/red'),1);
        glyphs.apply_customizations(gc_currentgraphics.set,do_custom_colors|do_custom_symbols);
        shuffle();
        for (const offset of offsets) {
            assert.equal(glyphmap()[offset+to].u?.utf32ch,0x2603);
            assert.equal(glyphmap()[offset+to].customcolor,NH_BASIC_COLOR|CLR_RED);
        }
        // C resets only the requested channel, then shuffles all channels.
        // The unchanged channel is permuted a second time by this reset.
        if(resetSymbols) reset_customsymbols();
        else reset_customcolors();
        shuffle();
        for (const offset of offsets) {
            const target=glyphmap()[offset+to], source=glyphmap()[offset+from];
            assert.equal(target.u?.utf32ch ?? null,resetSymbols ? 0x2603 : null);
            assert.equal(source.u?.utf32ch ?? null,resetSymbols ? null : 0x2603);
            assert.equal(target.customcolor,resetSymbols ? 0 : NH_BASIC_COLOR|CLR_RED);
            assert.equal(source.customcolor,resetSymbols ? NH_BASIC_COLOR|CLR_RED : 0);
        }
    });
}
