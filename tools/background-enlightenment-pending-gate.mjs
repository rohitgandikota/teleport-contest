// Exercise the real menu and final More readers with no input available.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {setImmediate} from 'node:timers/promises';
import {NethackGame} from '../js/jsmain.js';
import {moveloop_core} from '../js/allmain.js';
import {game} from '../js/gstate.js';
import {GameDisplay} from '../js/game_display.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';

const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/background-polymorph-enlightenment.json',import.meta.url)));
const outputs=run=>({screens:run.getScreens(),cursors:run.getCursors(),rng:run.getRngLog(),slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
for(const [index,step]of [[0,21],[2,28]])test(`background waits at ${index?'final More':'attributes menu'}`,{timeout:8000},async()=>{
    const part=recipe.segments[index],display=new GameDisplay(null);
    const run=new NethackGame({...part,moves:'',storage:new InMemoryStorage()});
    run._pendingDisplay=display;game.nhDisplay=display;
    const keys=Array.from(part.moves.slice(0,step),ch=>ch.charCodeAt(0));
    let consumed=0,release,stop,notify,finished=false;
    let waiting=new Promise(resolve=>{notify=resolve;});
    const end=new Error('pending test complete');
    display.onEmptyQueue=()=>{
        if(consumed<keys.length)return keys[consumed++];
        return new Promise((resolve,reject)=>{release=resolve;stop=()=>reject(end);notify();});
    };
    const operation=(async()=>{
        try{await run.start();while(!game.program_state?.gameover)await moveloop_core();}
        catch(error){if(error!==end)throw error;}
        finally{finished=true;}
    })();
    try{
        await Promise.race([waiting,operation.then(()=>{throw Error('command ended before input wait');})]);
        assert.equal(consumed,step);assert.equal(finished,false);
        const before=structuredClone(outputs(run));
        const text=decodeScreen(before.screens.at(-1)).map(r=>r.map(renderCell).join('')).join('\n');
        assert.match(text,index?/You were in male ogre form\./:/You are currently in male ogre form\./);
        assert.match(text,index?/--More--/:/\(1 of /);
        const state=[game.u.umonnum,game.u.uexp,game.moves];
        await setImmediate();await setImmediate();
        assert.equal(finished,false,'caller remains suspended without a paging key');
        assert.deepEqual(outputs(run),before,'all five collections remain stable while input is absent');
        waiting=new Promise(resolve=>{notify=resolve;});
        release(32);
        await Promise.race([waiting,operation.then(()=>{throw Error('one page unexpectedly completed game loop');})]);
        assert.equal(finished,false);
        const after=outputs(run);
        assert.equal(after.screens.length,before.screens.length+1);
        assert.notDeepEqual(after.screens.at(-1),before.screens.at(-1),'real page advances after space');
        assert.deepEqual(after.rng,before.rng);
        assert.deepEqual([game.u.umonnum,game.u.uexp,game.moves],state);
    }finally{if(stop)stop();await operation;}
});
