// Ordinary keys and read-only observations. Native parity is checked separately.
// Usage: node tools/vision-dark-side-redraw-input-gate.mjs [input.json] [report.json]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {cansee, couldsee, __debug_arrays} from '../js/vision.js';
import {Blind, Hallucination, Stealth} from '../js/youprop.js';
import {sensemon, see_with_infrared} from '../js/display.js';
import {passes_walls} from '../js/mondata.js';
import {DOOR, ROOM, D_CLOSED} from '../js/const.js';
import {PMNAMES} from '../js/monst_data.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vision-dark-side-redraw.json', import.meta.url)));
const input = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2])) : recipe;
assert.equal(input.segments.length, 4);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs = run => ({screens: run.getScreens(), cursors: run.getCursors(),
    rng: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep()});
const hashes = output => Object.fromEntries(Object.entries(output).map(([k,v]) => [k,hash(v)]));
const reports = [], observed = {segments: []};

for (const [index, part] of input.segments.entries()) {
    for (const key of ['name','seed','datetime','nethackrc','moves']) {
        assert.equal(Object.hasOwn(part,key), Object.hasOwn(recipe.segments[index],key));
        assert.deepEqual(part[key], recipe.segments[index][key], `${part.name}: ${key}`);
    }
    if (part.steps?.length) {
        assert.equal(input.source,'c'); assert.equal(input.version,5);
        assert.deepEqual(part.steps.map(s => s.key),[null,...part.moves]);
        assert.deepEqual(recordingIntegrityErrors({segments:[part]}),[]);
    }
    const prior = Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states = [];
    let run;
    try {
        globalThis.__step_snapshot = {step:'*',cb(g,step) {
            const loc = g.level.at(11,13);
            const mon = g.level.monsters.find(m => m.mhp > 0 && m.mx===11 && m.my===13);
            const front = {x:11+Math.sign(g.u.ux-11),y:13+Math.sign(g.u.uy-13)};
            states.push({step,hero:[g.u.ux,g.u.uy],nv:g.u.nv_range,xray:g.u.xray_range,
                blind:Blind(),hallucination:Hallucination(),stealth:Stealth(),
                typ:loc.typ,mask:loc.doormask,lit:!!loc.lit,waslit:loc.waslit,
                front:{...front,lit:!!g.level.at(front.x,front.y).lit},
                clear:!!__debug_arrays().viz_clear[13][11],
                visible:!!cansee(11,13),couldSee:!!couldsee(11,13),
                cell:{...g.nhDisplay.grid[14][10]},
                memory:loc.remembered_glyph ? structuredClone(loc.remembered_glyph):null,
                mon:mon ? {id:mon.m_id,type:mon.mnum,sleep:!!mon.msleeping,
                    peaceful:!!mon.mpeaceful,passesWalls:passes_walls(mon.data),
                    sensed:sensemon(mon),infrared:see_with_infrared(mon),
                    indexed:g.level.monAt.get('11,13')===mon}:null});
        }};
        run = await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if (prior) Object.defineProperty(globalThis,'__step_snapshot',prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const output=outputs(run), actualHashes=hashes(output);
    const unobserved=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    observed.segments.push({steps:output.screens.map(screen=>({screen}))});
    const arrival=states.findLast(s=>s.hero[0]===12&&s.hero[1]===13);
    const departed=states.find(s=>s.hero[0]===14&&s.hero[1]===12);
    await test(`${part.name}: complete inputs and transparent observer`,()=>{
        for (const key of ['screens','cursors','slices','frames'])
            assert.equal(output[key].length,part.moves.length+1,key);
        assert.deepEqual(actualHashes,hashes(unobserved));
        assert.equal(output.rng.length,[2817,2817,2817,2789][index]);
        assert.deepEqual(output.slices.flat(),output.rng);
        assert.ok(output.rng.every(s=>/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(s)));
        assert.equal(output.frames.flat().length,0);
    });
    await test(`${part.name}: actual terrain, lighting and sleeping monster`,()=>{
        assert.ok(departed);
        assert.equal(departed.nv,1); assert.equal(departed.xray,-1);
        assert.equal(departed.blind,false); assert.equal(departed.hallucination,false);
        assert.equal(departed.stealth,true);
        assert.equal(departed.typ,index===2?ROOM:DOOR);
        if(index!==2) assert.equal(departed.mask,D_CLOSED);
        assert.equal(departed.lit,true);
        assert.equal(departed.front.lit,index===1);
        assert.equal(departed.clear,index===2);
        assert.equal(departed.mon.type,PMNAMES.PM_XORN);
        for(const key of ['sleep','peaceful','passesWalls','indexed'])assert.equal(departed.mon[key],true);
        assert.equal(departed.mon.sensed,false); assert.equal(departed.mon.infrared,false);
        assert.equal(departed.couldSee,true);
        assert.equal(departed.visible,index===1||index===2);
        if(index!==3) {
            assert.equal(arrival.visible,true); assert.equal(arrival.cell.ch,'X');
            assert.equal(arrival.mon.id,departed.mon.id);
        }
    });
    await test(`${part.name}: terminal consequence before Ctrl-R`,()=>{
        const expected=index===1||index===2?'X':'+';
        assert.equal(departed.cell.ch,expected);
        assert.equal(states.at(-2).cell.ch,expected);
        assert.equal(states.at(-1).cell.ch,expected);
        if(index===0) assert.deepEqual(departed.cell,{ch:'+',color:3,attr:0});
        if(index===3) assert.ok(states.filter(s=>s.step>=125).every(s=>!s.visible),
            'the negative never regains nearby sight after darkening');
    });
    reports.push({name:part.name,boundaries:output.screens.length,calls:output.rng.length,
        frames:output.frames.flat().length,hashes:actualHashes,
        screenHashes:output.screens.map(hash),states});
}
await test('recipe categories and four observable setup assertions',()=>{
    const requirements=JSON.parse(fs.readFileSync(new URL(
        'gen-sessions/coverage-requirements.json',import.meta.url)));
    const known=new Set(requirements.requirements.map(r=>r.id));
    assert.ok(recipe.coverage.every(id=>known.has(id)));
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    assert.deepEqual(branchAssertionErrors(recipe,observed),[]);
});
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify({
    evidence:'JS ordinary input reach; no native parity claim',reports},null,2)+'\n');
