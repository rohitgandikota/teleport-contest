import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {NethackGame} from '../js/jsmain.js';
import {GameDisplay} from '../js/game_display.js';
import {InMemoryStorage} from '../js/storage.js';
import {moveloop_core} from '../js/allmain.js';
import {game} from '../js/gstate.js';
import {outputs, unobserved, hashes} from './accessory-eating-effects-observe.mjs';

const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/accessory-eating-effects.json',import.meta.url)));
const evidence=JSON.parse(fs.readFileSync(new URL('gen-sessions/evidence/accessory-eating-effects.json',import.meta.url)));
const index=evidence.findIndex(x=>x.intent==='levitation');
const part=recipe.segments[index],boundary=evidence[index].result.effectMessages[0].step;

test('ordinary levitation meal waits before granting, resumes exactly, and stops at exhausted input',async()=>{
    const expected=await unobserved(part);
    const display=new GameDisplay(null);
    const run=new NethackGame({...part,storage:new InMemoryStorage()});
    run._pendingDisplay=display;game.nhDisplay=display;
    const keys=Array.from(part.moves,ch=>ch.charCodeAt(0));
    const done=new Error('bounded input finished');
    let consumed=0,held=false,settled=false,abort=false,resume,rejectHeld,stop,atPause,atEnd;
    const paused=new Promise(resolve=>{atPause=resolve;});
    const exhausted=new Promise(resolve=>{atEnd=resolve;});
    display.onEmptyQueue=()=>{
        if(abort)throw done;
        if(!held&&consumed===boundary){
            held=true;
            return new Promise((resolve,reject)=>{
                resume=()=>resolve(keys[consumed++]);rejectHeld=reject;atPause('paused');
            });
        }
        if(consumed<keys.length)return keys[consumed++];
        return new Promise((_resolve,reject)=>{stop=()=>reject(done);atEnd('input');});
    };
    const operation=(async()=>{
        try{await run.start();while(!game.program_state?.gameover)await moveloop_core();}
        catch(error){if(error!==done)throw error;}
        finally{settled=true;}
    })();
    try {
        assert.equal(await Promise.race([paused,operation.then(()=>'exit')]),'paused');
        assert.equal(settled,false);
        assert.equal(game.u.intrinsic.HLevitation||0,0);
        assert.equal(game.u.uconduct.food,1);
        assert.deepEqual(game.context.victual,{});
        assert.equal(game.invent.length,1);
        assert.equal(game.invent[0].known,1);
        const before=hashes(outputs(run));
        await setImmediate();await setImmediate();
        assert.deepEqual(hashes(outputs(run)),before);assert.equal(settled,false);
        resume();
        assert.equal(await Promise.race([exhausted,operation.then(()=>'exit')]),'input');
        assert.equal(consumed,keys.length);assert.equal(settled,false);
        assert.deepEqual(outputs(run),expected);
        await setImmediate();await setImmediate();
        assert.deepEqual(outputs(run),expected);assert.equal(settled,false);
        console.log(JSON.stringify({
            name:part.name,boundary,propertyAbsentWhilePending:true,itemStillOwnedAndKnown:true,
            nutritionPrecedesFeedback:true,resumedAllFiveCollectionsExact:true,
            exhaustedInputStable:true,evidence:'JS real keys and real display queue only'}));
    } finally {
        abort=true;rejectHeld?.(done);stop?.();await operation;
    }
});
