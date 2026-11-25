// Actual-key producer observations, with plain and delayed output equality.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {NethackGame,runSegment} from '../js/jsmain.js';
import {GameDisplay} from '../js/game_display.js';
import {InMemoryStorage} from '../js/storage.js';
import {moveloop_core} from '../js/allmain.js';
import {game} from '../js/gstate.js';
const inputPath=process.argv[2]||new URL('gen-sessions/recipes/line-input-eof.json',import.meta.url);
const inputBytes=fs.readFileSync(inputPath),input=JSON.parse(inputBytes);
const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/line-input-eof.json',import.meta.url)));
const output=process.argv[3];
const collect=r=>({screens:r.getScreens(),cursors:r.getCursors(),rng:[...r.getRngLog()],slices:r.getRngSlices(),frames:r.getAnimationFramesByStep()});
const hashes=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,createHash('sha256').update(JSON.stringify(v)).digest('hex')]));
async function delayed(part){
    const run=new NethackGame({...part,storage:new InMemoryStorage()}),display=new GameDisplay(null);
    const end=new Error('Input queue empty: bounded delayed audit');let used=0;
    display.onEmptyQueue=async()=>{await setImmediate();if(used===part.moves.length)throw end;return part.moves.charCodeAt(used++);};
    run._pendingDisplay=display;
    try{await run.start();for(let i=0;i<1024&&!game.program_state?.gameover;i++)await moveloop_core();}
    catch(error){if(error!==end)throw error;}
    assert.equal(used,part.moves.length);return run;
}
function snapshot(g,step){return {step,top:g._toplines,prev:g._prevmsg,
    termGone:g.iflags?.term_gone||0,resumeWish:g.context?.resume_wish||0,
    botDisabled:!!g.bot_disabled,turn:g.moves,wishes:g.u?.uconduct?.wishes||0,
    inventory:(g.invent||[]).map(o=>({id:o.o_id,type:o.otyp,name:o.oname}))};}
const reports=[];
assert.equal(input.segments.length,6);
for(const [index,part] of input.segments.entries()){
    for(const key of ['name','seed','datetime','nethackrc','moves']){
        assert.equal(Object.hasOwn(part,key),Object.hasOwn(recipe.segments[index],key));
        assert.deepEqual(part[key],recipe.segments[index][key]);
    }
    if(part.steps?.length){
        assert.equal(input.source,'c');assert.equal(input.version,5);
        assert.deepEqual(part.steps.map(step=>step.key),[null,...part.moves]);
    }
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),states=[];let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){states.push(snapshot(g,step));}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const observed=collect(run);
    const plain=collect(await runSegment({...part,storage:new InMemoryStorage()}));
    const late=collect(await delayed(part));
    assert.deepEqual(hashes(observed),hashes(plain),'observer is read-only for all five outputs');
    assert.deepEqual(hashes(late),hashes(plain),'deferred input preserves all five outputs');
    assert.deepEqual(plain.slices.flat(),plain.rng);
    assert.equal(plain.screens.length,part.moves.length+1);
    assert.equal(plain.frames.flat().length,0);
    const at=step=>states.find(s=>s.step===step),ff=part.moves.indexOf('\xff');
    reports.push({name:part.name,index,negative:index>=3,boundaries:plain.screens.length,
        calls:plain.rng.length,frames:0,hashes:hashes(plain),observerHashes:hashes(observed),deferredHashes:hashes(late),states});
    await test(`${part.name}: actual keys reach the intended source branch`,()=>{
        assert.ok(!/[^\x00-\x7f]/.test(part.nethackrc),'ASCII config isolates this input boundary');
        assert.ok(states.every(s=>s.wishes===0&&s.inventory.length===0));
        if(ff>=0){
            assert.equal(at(ff).termGone,0);assert.equal(at(ff+1).termGone,1);
            assert.ok(states.filter(s=>s.step>ff).every(s=>s.termGone===1));
            assert.ok(states.every(s=>!s.top?.includes('\xff')),'FF never enters the line buffer');
        }else assert.ok(states.every(s=>s.termGone===0&&s.resumeWish===0));
        if(index===0||index===3){
            assert.equal(at(2).top,'# ');assert.equal(at(3).top,'');
            assert.equal(at(4).top,'# ');assert.equal(at(5).top,'');
        }else if(index===1){
            assert.equal(at(6).top,'# version','actual ext-command completion hook ran');
            assert.equal(at(7).top,'');assert.equal(at(8).top,'# ');assert.equal(at(9).top,'');
        }else if(index===2){
            assert.equal(at(5).top,'For what do you wish? abc');
            assert.equal(at(6).top,'You may wish for an object.','real caller resumes the interrupted wish');
            assert.equal(at(7).top,'For what do you wish? ');assert.equal(at(7).botDisabled,true);
            assert.ok(states.every(s=>s.turn===1),'resume occurs before a time-taking command');
        }else if(index===4){
            assert.equal(at(6).top,'# version');assert.equal(at(7).top,'# ','ESC first clears');
            assert.equal(at(8).top,'','second ESC cancels');assert.equal(at(9).top,'# ');
            assert.equal(at(10).top,'');
        }else if(index===5){
            assert.equal(at(9).top,'For what do you wish? nothing');assert.equal(at(10).botDisabled,false);
            assert.equal(at(10).resumeWish,0);
        }
    });
}
const report={evidence:'Actual JS keys and producer states, not a native recording or native parity result.',
    inputSha256:createHash('sha256').update(inputBytes).digest('hex'),
    observerPairs:reports.length*5,deferredPairs:reports.length*5,reports};
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(`Verified ${reports.length*5} observer and ${reports.length*5} delayed-input hashes.`);
