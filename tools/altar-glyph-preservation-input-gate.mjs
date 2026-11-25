// Ordinary keys, read-only observations, and source-derived glyph identities.
// Native recording, when supplied, proves input integrity and terrain setup.
// Usage: node tools/altar-glyph-preservation-input-gate.mjs [input.json] [report.json]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {NethackGame, runSegment} from '../js/jsmain.js';
import {GameDisplay} from '../js/game_display.js';
import {moveloop_core} from '../js/allmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {cansee} from '../js/vision.js';
import {gbuf_at, glyph_at, terrain_glyph} from '../js/display.js';
import {ALTAR, ROOM, GLYPH_ALTAR_OFF, GLYPH_CMAP_A_OFF} from '../js/const.js';
import {cmap_names} from '../js/drawing_data.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/altar-glyph-preservation.json', import.meta.url)));
const input = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2])) : recipe;
assert.equal(input.segments.length, 4);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const collections = run => ({screens:run.getScreens(), cursors:run.getCursors(),
    rng:run.getRngLog(), slices:run.getRngSlices(), frames:run.getAnimationFramesByStep()});
const hashes = data => Object.fromEntries(Object.entries(data).map(([k,v]) => [k,hash(v)]));
async function delayed(part) {
    const run=new NethackGame({...part,storage:new InMemoryStorage()});
    const display=new GameDisplay(null), end=new Error('Input queue empty');
    let used=0;
    display.onEmptyQueue=async()=>{
        await setImmediate();
        if(used===part.moves.length)throw end;
        return part.moves.charCodeAt(used++);
    };
    run._pendingDisplay=display;
    try {
        await run.start();
        for(let i=0;i<1024&&!game.program_state?.gameover;i++)await moveloop_core();
    } catch(error) {
        if(error!==end)throw error;
    }
    assert.equal(used,part.moves.length);
    return run;
}
const reports = [], observed = {segments:[]};
for (const [index, part] of input.segments.entries()) {
    for (const key of ['name','seed','datetime','nethackrc','moves']) {
        assert.equal(Object.hasOwn(part,key), Object.hasOwn(recipe.segments[index],key));
        assert.deepEqual(part[key], recipe.segments[index][key]);
    }
    if (part.steps?.length) {
        assert.equal(input.source,'c'); assert.equal(input.version,5);
        assert.deepEqual(part.steps.map(s => s.key),[null,...part.moves]);
        assert.deepEqual(recordingIntegrityErrors({segments:[part]}),[]);
    }
    const prior = Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states = [];
    const x=index===3?9:8, y=12;
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g,step) {
            const loc=g.level.at(x,y), buffer=gbuf_at(x,y);
            states.push({step,hero:[g.u.ux,g.u.uy],typ:loc.typ,mask:loc.altarmask,
                visible:!!cansee(x,y),heroMemory:!!g.level.flags.hero_memory,
                objects:g.level.objectsAt(x,y).length,
                monster:!!g.level.monAt.get(`${x},${y}`),
                sourceGlyph:structuredClone(terrain_glyph(loc,x,y).glyph),
                glyph:structuredClone(glyph_at(x,y)),number:buffer?.disp_glyphnum,
                metadata:buffer ? {customcolor:buffer.disp_customcolor,
                    flags:buffer.disp_glyphflags,tile:buffer.disp_tileidx}:null,
                memory:structuredClone(loc.remembered_glyph ?? null),
                cell:{...g.nhDisplay.grid[y+1][x-1]}});
        }};
        run = await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if (prior) Object.defineProperty(globalThis,'__step_snapshot',prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const output=collections(run), actualHashes=hashes(output);
    const plain=collections(await runSegment({...part,storage:new InMemoryStorage()}));
    const deferred=collections(await delayed(part));
    const wished=states[part.moves.indexOf('\r')+1];
    const departed=states.at(-2), redrawn=states.at(-1);
    const expected=index<3 ? GLYPH_ALTAR_OFF+[3,1,2][index]
        : GLYPH_CMAP_A_OFF+cmap_names.S_room-cmap_names.S_ndoor;
    await test(`${part.name}: complete inputs, observer transparency and delayed keys`,()=>{
        for(const key of ['screens','cursors','slices','frames'])
            assert.equal(output[key].length,part.moves.length+1,key);
        assert.deepEqual(actualHashes,hashes(plain));
        assert.deepEqual(actualHashes,hashes(deferred));
        assert.deepEqual(output.slices.flat(),output.rng);
        assert.ok(output.rng.every(s=>/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(s)));
        assert.equal(output.frames.flat().length,0);
    });
    await test(`${part.name}: real wish and movement reach bare visible terrain`,()=>{
        assert.deepEqual(wished.hero,[x,y]);
        assert.equal(wished.typ,index<3?ALTAR:ROOM);
        if(index<3) assert.equal(wished.mask,[4,1,2][index]);
        assert.equal(wished.memory.glyph.glyphnum,expected,
            'hero-square mapping already preserves the producer identity');
        for(const s of [departed,redrawn]) {
            assert.deepEqual(s.hero,[index===3?x-1:x+1,y]);
            assert.equal(s.visible,true); assert.equal(s.heroMemory,true);
            assert.equal(s.objects,0); assert.equal(s.monster,false);
            assert.equal(s.sourceGlyph.glyphnum,expected);
            assert.equal(s.cell.ch,index<3?'_':'.');
            assert.equal(s.metadata.customcolor,0,'plain symbols, no configured glyph colors');
        }
    });
    await test(`${part.name}: departure and Ctrl-R retain source glyph and memory`,()=>{
        for(const s of [departed,redrawn]) {
            assert.equal(s.number,expected);
            assert.deepEqual(s.glyph,s.sourceGlyph);
            assert.deepEqual(s.memory.glyph,s.sourceGlyph);
        }
        assert.deepEqual(departed.cell,redrawn.cell);
    });
    observed.segments.push({steps:output.screens.map(screen=>({screen}))});
    reports.push({name:part.name,boundaries:output.screens.length,calls:output.rng.length,
        frames:output.frames.flat().length,hashes:actualHashes,
        plainHashes:hashes(plain),deferredHashes:hashes(deferred),states});
}
await test('recipe categories and four terrain setup assertions',()=>{
    const requirements=JSON.parse(fs.readFileSync(new URL(
        'gen-sessions/coverage-requirements.json',import.meta.url)));
    const known=new Set(requirements.requirements.map(r=>r.id));
    assert.ok(recipe.coverage.every(id=>known.has(id)));
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    assert.deepEqual(branchAssertionErrors(recipe,observed),[]);
    if(input.segments.every(s=>s.steps?.length))
        assert.deepEqual(branchAssertionErrors(recipe,input),[]);
});
if(process.argv[3]) fs.writeFileSync(process.argv[3],JSON.stringify({
    evidence:'JS real-input state proof, not a native glyph-number or score claim',reports},null,2)+'\n');
