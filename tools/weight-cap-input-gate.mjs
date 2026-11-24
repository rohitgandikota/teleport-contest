// Ordinary input reach and native branch assertions. Full parity has a separate gate.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {ONAMES as O} from '../js/objects_data.js';
import {W_ARMF} from '../js/const.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';

const bytes=fs.readFileSync(process.argv[2]||new URL(
    'gen-sessions/generated/weight-capacity-boundaries.session.json',import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),
    'a2f4e9ac9cf27b0f691656587cefa314b9d5b9651dd94cce545dd0357782eac3');
const raw=JSON.parse(bytes);
const recipe=JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/weight-capacity-boundaries.json',import.meta.url)));
assert.equal(raw.version,5);assert.equal(raw.source,'c');assert.equal(raw.segments.length,2);
const text=screen=>decodeScreen(screen).map(row=>row.map(cell=>cell.ch).join('')).join('\n');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

for(const [index,part] of raw.segments.entries()) {
    const rows=[];
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step){
            rows.push({step,wc:g.wc,oldcap:g.oldcap,after:g.afternmv?.name||null,
                lev:g.u.uprops.LEVITATION||0,boots:g.u.uarmf?.otyp,
                worn:g.u.uarmf?.owornmask||0,
                balls:(g.invent||[]).filter(o=>o.otyp===O.HEAVY_IRON_BALL).length});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);
        else delete globalThis.__step_snapshot;
    }
    const native=part.steps.map(s=>text(s.screen));
    const actual=run.getScreens().map(text);
    const finish=actual.findIndex(s=>s.includes('You finish your dressing maneuver.'));
    const unburden=actual.findIndex(s=>s.includes('Your movements are now unencumbered.'));
    const nativeFinish=native.findIndex(s=>s.includes('You finish your dressing maneuver.'));
    const nativeUnburden=native.findIndex(s=>s.includes('Your movements are now unencumbered.'));
    await test(`${part.name}: unchanged native tuple and every recorder key`,()=>{
        for(const key of ['name','seed','datetime','nethackrc','moves'])
            assert.deepEqual(part[key],recipe.segments[index][key],key);
        assert.equal(part.steps.length,part.moves.length+1);
        for(let step=1;step<part.steps.length;step++)assert.equal(part.steps[step].key,part.moves[step-1]);
    });
    await test(`${part.name}: actual wishes and wear create the load and boot source`,()=>{
        const before=rows.find(r=>r.balls===2&&!r.boots);
        const after=rows.find(r=>r.boots===(index===0?O.LEVITATION_BOOTS:O.LOW_BOOTS));
        assert.ok(before&&after);assert.equal(before.wc,650);
        assert.equal(after.balls,2);assert.ok(after.worn&W_ARMF);
        assert.equal(after.lev,index===0?W_ARMF:0);
        assert.equal(rows.at(-1).wc,index===0?1000:650);
        assert.equal(rows.at(-1).oldcap,index===0?0:1);
    });
    await test(`${part.name}: visible completion and capacity feedback retain native order`,()=>{
        assert.ok(finish>=0);
        if(index===0) {
            assert.ok(nativeFinish>=0&&nativeUnburden>nativeFinish);
            assert.ok(actual[finish].includes('You start to float in the air!'));
            assert.ok(unburden>finish);
            const beforeMessage=rows.find(r=>r.step===finish);
            const afterMessage=rows.find(r=>r.step===unburden);
            assert.equal(beforeMessage.oldcap,2);assert.equal(afterMessage.oldcap,0);
        } else {
            assert.equal(unburden,-1);
            assert.ok(!actual.some(s=>s.includes('You start to float in the air!')));
        }
        assert.equal(finish,nativeFinish);assert.equal(unburden,nativeUnburden);
    });
    await test(`${part.name}: paired recipe assertions hold in raw C and JS grids`,()=>{
        for(const screens of [native,actual]) {
            const all=screens.join('\n'),branch=recipe.branchAssertions[index];
            for(const needle of branch.screenIncludes)assert.ok(all.includes(needle),needle);
            for(const needle of branch.screenExcludes||[])assert.ok(!all.includes(needle),needle);
        }
    });
    await test(`${part.name}: all boundaries finish alive with the observer restored`,()=>{
        for(const output of [run.getScreens(),run.getCursors(),run.getRngSlices(),run.getAnimationFramesByStep()])
            assert.equal(output.length,part.steps.length);
        assert.equal(run._display.inputQueueLength,0);
        assert.ok(game.u.uhp>0&&!game.program_state.gameover);
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    });
    console.log(JSON.stringify({name:part.name,boundaries:run.getScreens().length,
        calls:run.getRngLog().length,frames:run.getAnimationFramesByStep().flat().length,
        finish,unburden,final:rows.at(-1),hashes:{screens:hash(run.getScreens()),
            cursors:hash(run.getCursors()),rng:hash(run.getRngLog()),
            slices:hash(run.getRngSlices()),animations:hash(run.getAnimationFramesByStep())}}));
}
