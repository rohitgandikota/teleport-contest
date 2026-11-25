// Read-only observation of the current runtime. Output arrays stay in memory.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const outputs = run => ({screens:run.getScreens(),cursors:run.getCursors(),
    calls:run.getRngLog(),slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
export const hashes = value => Object.fromEntries(Object.entries(value).map(([k,v])=>[k,hash(v)]));
export async function observe(part,observed=true) {
    const {runSegment} = await import(new URL('../js/jsmain.js',import.meta.url));
    const {InMemoryStorage} = await import(new URL('../js/storage.js',import.meta.url));
    const {decodeScreen,renderCell} = await import(new URL('../frozen/screen-decode.mjs',import.meta.url));
    const previous = Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states=[]; let run;
    try {
        if(observed) globalThis.__step_snapshot={step:'*',cb(g,step){
            if(!g.u||!g.level) return;
            states.push({step,turn:g.moves,hp:g.u.uhp,mh:g.u.mh,form:g.u.umonnum,
                xy:[g.u.ux,g.u.uy],mortality:g.u.umortality||0,
                intrinsic:[g.u.intrinsic?.HHalf_physical_damage||0,g.u.intrinsic?.HHalf_spell_damage||0],
                extrinsic:[g.u.uprops?.HALF_PHDAM||0,g.u.uprops?.HALF_SPDAM||0]});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if(previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    const output=outputs(run);
    assert.equal(output.screens.length,part.moves.length+1);
    assert.deepEqual(output.slices.flat(),output.calls);
    const texts=output.screens.map(screen=>decodeScreen(screen)
        .map(row=>row.map(renderCell).join('').trimEnd()).join('\n'));
    return {output,states,texts,hashes:hashes(output)};
}

// Same pending-input contract as tools/deferred-input-gate.mjs. Include slices
// as well as screens, cursors, complete calls and frames in the comparison.
export async function deferred(part) {
    const {NethackGame} = await import('../js/jsmain.js');
    const {moveloop_core} = await import('../js/allmain.js');
    const state = await import('../js/gstate.js');
    const {GameDisplay} = await import('../js/game_display.js');
    const {InMemoryStorage} = await import('../js/storage.js');
    const display = new GameDisplay(null);
    const run = new NethackGame({...part,storage:new InMemoryStorage()});
    run._pendingDisplay = display;
    state.game.nhDisplay = display;
    const keys = Array.from(part.moves,ch=>ch.charCodeAt(0));
    let consumed=0,stop,atEnd;
    const exhausted = new Promise(resolve=>{atEnd=resolve;});
    const end = new Error('deferred input complete');
    display.onEmptyQueue = async()=>{
        await setImmediate();
        if(consumed<keys.length) return keys[consumed++];
        return new Promise((_resolve,reject)=>{
            stop=()=>reject(end);
            atEnd('input');
        });
    };
    const operation=(async()=>{
        try {
            await run.start();
            while(!state.game.program_state?.gameover) await moveloop_core();
        } catch(error) { if(error!==end) throw error; }
    })();
    try {
        await Promise.race([exhausted,operation.then(()=>'exit')]);
        assert.equal(consumed,keys.length,'all ordinary keys consumed');
        return structuredClone(outputs(run));
    } finally {
        if(stop) stop();
        await operation;
    }
}
