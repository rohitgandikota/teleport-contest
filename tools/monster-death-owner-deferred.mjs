// Current runtime deferred input; compares all five output collections in memory.
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
export const outputs = run => ({screens:run.getScreens(),cursors:run.getCursors(),
    calls:run.getRngLog(),slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
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
