#!/usr/bin/env node
// Constructed C-state probe, not a complete native gameplay recording.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {glyphmap} from '../js/display.js';
import * as glyphs from '../js/glyphs.js';
import {GLYPH_OBJ_OFF, GLYPH_OBJ_PILETOP_OFF} from '../js/const.js';
import {NUM_OBJECTS} from '../js/objects_data.js';

const root=fileURLToPath(new URL('../.cache/object-customization/',import.meta.url));
fs.mkdirSync(root,{recursive:true});
const source=fs.readFileSync(new URL('../nethack-c/recorder/src/glyphs.c',import.meta.url),'utf8');
const maybe=source.match(/void\nmaybe_shuffle_customizations\(void\)\n\{[\s\S]*?^\}/m)?.[0];
const active=source.slice(source.indexOf('#else',source.indexOf('maybe_shuffle_customizations(void)')));
const shuffle=active.match(/staticfn void\nshuffle_customizations\(void\)\n\{[\s\S]*?^\}/m)?.[0];
assert.ok(maybe && shuffle,'pinned C function bodies');
// Standalone state wrapper. Only the two object-range offsets are compacted;
// the function bodies below come directly from the pinned recorder source.
fs.writeFileSync(`${root}object-custom-shuffle-native.c`, `#define _POSIX_C_SOURCE 200809L
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define ENHANCED_SYMBOLS
#define staticfn static
#define SIZE(a) (sizeof(a) / sizeof((a)[0]))
#define alloc malloc
#define dupstr strdup
#define GLYPH_OBJ_OFF 0
#define GLYPH_OBJ_PILETOP_OFF NUM_OBJECTS
#ifndef NUM_OBJECTS
#error NUM_OBJECTS must match the pinned table
#endif
typedef uint32_t uint32;
typedef uint16_t uint16;
typedef unsigned char uint8;
struct unicode_representation { uint32 utf32ch; uint8 *utf8str; };
typedef struct { struct unicode_representation *u; uint32 customcolor; uint16 color256idx; } glyph_map;
static glyph_map glyphmap[2 * NUM_OBJECTS];
static struct { int oc_descr_idx; } objects[NUM_OBJECTS];
static struct { int pending_customizations; } iflags;
static void shuffle_customizations(void);
${maybe}
${shuffle}

int main(void) {
    int cases;
    if (scanf("%d", &cases) != 1) return 1;
    while (cases--) {
        if (scanf("%d", &iflags.pending_customizations) != 1) return 2;
        for (int i = 0; i < NUM_OBJECTS; i++)
            if (scanf("%d", &objects[i].oc_descr_idx) != 1) return 3;
        for (int i = 0; i < 2 * NUM_OBJECTS; i++) {
            unsigned present, point, color, index;
            int byte;
            if (scanf("%u %u %d %u %u", &present, &point, &byte, &color, &index) != 5) return 4;
            glyph_map *g = &glyphmap[i];
            g->customcolor = color; g->color256idx = index; g->u = NULL;
            if (present) {
                g->u = malloc(sizeof *g->u);
                g->u->utf32ch = point; g->u->utf8str = NULL;
                if (byte >= 0) {
                    g->u->utf8str = malloc(2);
                    g->u->utf8str[0] = byte; g->u->utf8str[1] = 0;
                }
            }
        }
        maybe_shuffle_customizations();
        printf("%d\\n", iflags.pending_customizations);
        for (int i = 0; i < 2 * NUM_OBJECTS; i++) {
            glyph_map *g = &glyphmap[i];
            printf("%d %u %d %u %u\\n", g->u != NULL, g->u ? g->u->utf32ch : 0,
                g->u && g->u->utf8str ? g->u->utf8str[0] : -1,
                g->customcolor, g->color256idx);
            if (g->u) { free(g->u->utf8str); free(g->u); }
        }
    }
    return 0;
}
`);
const compile=spawnSync('cc',['-std=c11','-O1',`-DNUM_OBJECTS=${NUM_OBJECTS}`,
    `${root}object-custom-shuffle-native.c`,'-o',`${root}object-custom-shuffle-native`],{encoding:'utf8'});
assert.equal(compile.status,0,compile.stderr);
let state=71931;
const rand=()=>state=(Math.imul(state,1664525)+1013904223)>>>0;
const cases=[];
for(let n=0;n<32;n++) {
    const descriptions=Array.from({length:NUM_OBJECTS},(_,i)=>n%3===0?i:rand()%NUM_OBJECTS);
    const values=Array.from({length:2*NUM_OBJECTS},()=>{
        const present=rand()%3===0,point=65+rand()%26,byte=rand()%4===0?-1:point;
        return [Number(present),present?point:0,present?byte:-1,rand()%3===0?rand()%0x2000000:0,rand()%256];
    });
    cases.push({pending:n%4!==0,descriptions,values});
}
const input=[cases.length,...cases.flatMap(c=>[
    Number(c.pending),c.descriptions.join(' '),...c.values.map(v=>v.join(' '))])].join('\n');
const native=spawnSync(`${root}object-custom-shuffle-native`,[],{input,encoding:'utf8',maxBuffer:4*1024*1024});
assert.equal(native.status,0,native.stderr);
const lines=native.stdout.trim().split('\n');
const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/class-glyph-startup.json',import.meta.url)));
await runSegment({...recipe.segments[0],moves:' ',storage:new InMemoryStorage()});
let line=0,checked=0;
const offsets=[GLYPH_OBJ_OFF,GLYPH_OBJ_PILETOP_OFF];
for (const [n,c] of cases.entries()) {
    game.iflags.pending_customizations=c.pending;
    c.descriptions.forEach((idx,i)=>game.objects[i].oc_descr_idx=idx);
    for (const [j,offset] of offsets.entries())
        for(let i=0;i<NUM_OBJECTS;i++) {
            const [present,point,byte,customcolor,color256idx]=c.values[j*NUM_OBJECTS+i];
            Object.assign(glyphmap()[offset+i],{customcolor,color256idx,
                u:present?{utf32ch:point,utf8str:byte<0?null:[byte]}:null});
        }
    glyphs.maybe_shuffle_customizations();
    assert.equal(Number(game.iflags.pending_customizations),Number(lines[line++]),`case ${n} flag`);
    for(const offset of offsets)
        for(let i=0;i<NUM_OBJECTS;i++) {
            const g=glyphmap()[offset+i];
            const actual=[Number(g.u!==null),g.u?.utf32ch??0,g.u?.utf8str?.[0]??-1,g.customcolor,g.color256idx];
            assert.deepEqual(actual,lines[line++].split(' ').map(Number),`case ${n} glyph ${offset+i}`);
            checked++;
        }
}
assert.equal(line,lines.length);
console.log(`Pinned C shuffle bodies match ${cases.length} constructed cases and ${checked} glyph entries.`);
