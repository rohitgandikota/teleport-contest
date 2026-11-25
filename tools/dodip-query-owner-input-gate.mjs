// Ordinary keyboard witnesses. The observer only copies state; it never
// supplies inventory, terrain, status, command queues or random results.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { NethackGame, runSegment } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { InMemoryStorage } from '../js/storage.js';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { Levitation, Wwalking } from '../js/youprop.js';
import { can_reach_floor } from '../js/pickup.js';
import { branchAssertionErrors } from './gen-sessions/assertions.mjs';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import { ONAMES } from '../js/objects_data.js';
import { CQ_CANNED, CQ_REPEAT, CMDQ_KEY, FOUNTAIN, POOL,
    W_ARM, W_ARMC, W_ARMU, W_ARMG, W_RINGL } from '../js/const.js';

const recipePath = new URL('gen-sessions/recipes/dodip-query-owner.json', import.meta.url);
const recipe = JSON.parse(fs.readFileSync(recipePath));
const bytes = fs.readFileSync(process.argv[2] || recipePath), input = JSON.parse(bytes);
const output = process.argv[3];
const collect = run => ({ screens:run.getScreens(), cursors:run.getCursors(),
    rng:[...run.getRngLog()], slices:run.getRngSlices(), frames:run.getAnimationFramesByStep() });
const hashes = v => Object.fromEntries(Object.entries(v).map(([k,x]) =>
    [k,createHash('sha256').update(JSON.stringify(x)).digest('hex')]));
async function delayed(part) {
    const run=new NethackGame({...part,storage:new InMemoryStorage()});
    const display=new GameDisplay(null), end=new Error('Input queue empty: bounded dip audit');
    let used=0;
    display.onEmptyQueue=async()=>{
        await setImmediate(); if(used===part.moves.length) throw end;
        return part.moves.charCodeAt(used++);
    };
    run._pendingDisplay=display;
    try {
        await run.start();
        for(let n=0;n<1024&&!game.program_state?.gameover;n++) await moveloop_core();
    } catch(error) {if(error!==end)throw error;}
    assert.equal(used,part.moves.length);return run;
}
function snapshot(g,step) {
    return {step,top:g._toplines,pending:g._pending_message,turn:g.moves,
        terrain:g.level?.at(g.u.ux,g.u.uy)?.typ,menu:!!g.iflags.menu_requested,
        levitating:!!Levitation(),walkingWater:!!Wwalking(),floorReach:can_reach_floor(false),
        queues:[CQ_CANNED,CQ_REPEAT].map(q=>(g.command_queue?.[q]||[]).map(e=>({
            typ:e.typ,key:e.key,command:e.ec_entry?.ef_txt}))),
        inventory:(g.invent||[]).map(o=>({id:o.o_id,letter:o.invlet,type:o.otyp,
            worn:o.owornmask||0,pickup:o.pickup_prev,rust:o.oeroded||0,quantity:o.quan})),
    };
}
const reports=[], values=[], observedSegments=[];
assert.equal(input.segments.length,recipe.segments.length);
for(const [index,part] of input.segments.entries()) {
    for(const field of ['name','seed','datetime','nethackrc','moves']) {
        assert.equal(Object.hasOwn(part,field),Object.hasOwn(recipe.segments[index],field));
        assert.deepEqual(part[field],recipe.segments[index][field]);
    }
    if(part.steps?.length) {
        assert.equal(input.source,'c');assert.equal(input.version,5);
        assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves]);
    }
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'), states=[];let run;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step){states.push(snapshot(g,step));}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const observed=collect(run);
    const plain=collect(await runSegment({...part,storage:new InMemoryStorage()}));
    const late=collect(await delayed(part));
    assert.deepEqual(hashes(observed),hashes(plain),'observer preserves all five outputs');
    assert.deepEqual(hashes(late),hashes(plain),'deferred input preserves all five outputs');
    assert.deepEqual(plain.slices.flat(),plain.rng);
    assert.equal(plain.screens.length,part.moves.length+1);
    const text=plain.screens.map(s=>decodeScreen(s).map(row=>row.map(c=>c.ch).join('')).join('\n'));
    values.push(plain);observedSegments.push({steps:plain.screens.map(screen=>({screen}))});
    reports.push({index,name:part.name,boundaries:plain.screens.length,calls:plain.rng.length,
        frames:plain.frames.flat().length,hashes:hashes(plain),observerHashes:hashes(observed),
        deferredHashes:hashes(late),states});
    await test(`${part.name}: real producer and owner branch`,()=>{
        const final=states.at(-1), inventory=final.inventory;
        const dagger=inventory.find(o=>o.type===ONAMES.DAGGER);
        const queries=text.filter(screen=>screen.startsWith('Dip '));
        const has=s=>text.some(t=>t.includes(s));
        if(index===0) {
            const search=states.filter(s=>s.top?.startsWith('Search for:'));
            assert.equal(search.length,7);
            assert.ok(search.every(s=>s.terrain===FOUNTAIN&&s.queues[CQ_CANNED].length===1
                &&s.queues[CQ_CANNED][0].typ===CMDQ_KEY&&s.queues[CQ_CANNED][0].key==='y'));
            assert.equal(dagger.rust,1);assert.equal(dagger.pickup,0);
            assert.deepEqual(final.queues[CQ_CANNED],[]);assert.equal(queries.length,0);
        } else if(index===1||index===9) {
            assert.equal(queries.length,1);assert.ok(has("You don't have anything else to dip a dagger into."));
            assert.equal(final.turn,states.at(-2).turn);assert.equal(dagger.rust,0);
            if(index===9)assert.ok(final.walkingWater&&final.terrain===POOL);
        } else if(index===2||index===3) {
            assert.equal(final.terrain,FOUNTAIN);assert.equal(queries.length,0);
            assert.ok(has("You don't have anything to dip a dagger into."));assert.equal(dagger.rust,0);
            if(index===2)assert.ok(states.some(s=>s.menu));
            else assert.ok(final.levitating&&!final.floorReach);
        } else if(index>=4&&index<=7) {
            assert.ok(has('You need to take off your'));
            const selected=inventory.find(o=>o.letter==='a');
            const required=index===5?W_ARMU:index===6?W_RINGL:W_ARM;
            assert.ok(selected.worn&required);assert.equal(queries.length,0);
            if(index===5) {
                assert.ok(inventory.some(o=>o.worn&W_ARM)&&inventory.some(o=>o.worn&W_ARMC));
                assert.ok(has('Hawaiian shirt.--More--'));
                assert.equal(final.turn,states.at(-2).turn);
            } else if(index===6)assert.ok(inventory.some(o=>o.worn&W_ARMG));
            else assert.ok(inventory.some(o=>o.worn&W_ARMC));
            if(index===7) {
                assert.ok(has('What do you want to dip into the clear potion?'));
                assert.ok(inventory.some(o=>o.type===ONAMES.POT_WATER&&o.quantity===1));
            }
        } else if(index===8) {
            assert.equal(queries.length,1);assert.equal(dagger.rust,2);
            assert.ok(has('Your dagger rusts further!'));
            assert.equal(final.turn,states.at(-2).turn+1);
        } else if(index===10) {
            assert.ok(has('Never mind.'));assert.equal(queries.length,0);assert.equal(dagger.rust,0);
        } else if(index===11) {
            assert.ok(has("You don't have anything to dip a dagger into."));assert.equal(queries.length,0);
        } else if(index===12||index===14) {
            assert.equal(queries.length,1);assert.equal(dagger.rust,1);assert.equal(dagger.pickup,0);
            if(index===14)assert.ok(final.walkingWater&&final.terrain===POOL);
        } else {
            assert.ok(has('What do you want to dip a dagger into?'));assert.ok(has('Never mind.'));
            assert.equal(dagger.rust,0);assert.ok(inventory.some(o=>o.type===ONAMES.POT_WATER));
        }
    });
}
const errors=branchAssertionErrors(recipe,{segments:observedSegments});
const native=input.segments.every(p=>p.steps?.length>0);
const nativeErrors=native?branchAssertionErrors(recipe,input):null;
const report={evidence:'Ordinary JS keys; native comparison not performed by this gate.',
    inputSHA256:createHash('sha256').update(bytes).digest('hex'),reports,
    boundaries:reports.reduce((s,r)=>s+r.boundaries,0),calls:reports.reduce((s,r)=>s+r.calls,0),
    frames:reports.reduce((s,r)=>s+r.frames,0),observerPairs:reports.length*5,deferredPairs:reports.length*5,
    recipeAssertions:{count:recipe.branchAssertions.length,jsErrors:errors,nativeChecked:native,nativeErrors}};
if(output) {fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
    fs.writeFileSync(output.replace(/\.json$/,'.outputs.json'),JSON.stringify(values)+'\n');}
await test('all recipe assertions match supplied ordinary output',()=>{
    assert.deepEqual(errors,[]);if(native)assert.deepEqual(nativeErrors,[]);
});
console.log(`Verified ${report.boundaries} boundaries, ${report.calls} calls, ${report.frames} frames; ${report.observerPairs} observer and ${report.deferredPairs} deferred hashes.`);
