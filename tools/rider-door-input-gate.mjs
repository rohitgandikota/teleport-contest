// Ordinary input reach. Native equality is checked separately when C is available.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {PMNAMES} from '../js/monst_data.js';
import {DOOR, D_LOCKED, D_ISOPEN} from '../js/const.js';

const input=JSON.parse(fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/rider-door-unlock.session.json', import.meta.url)));
assert.equal(input.segments.length,1);
const part=input.segments[0], states=[];
const keys=['__step_snapshot','__rng_trace_sites'];
const previous=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
let run;
try {
    globalThis.__rng_trace_sites=true;
    globalThis.__step_snapshot={step:'*',cb(g,step){
        if(!g.u||!g.level)return;
        const door=g.level.at(39,5);
        const rider=g.level.monsters.find(m=>m.mnum===PMNAMES.PM_DEATH);
        states.push({step,hero:[g.u.ux,g.u.uy],text:g._toplines||'',
            door:{type:door.typ,mask:door.doormask},
            rider:rider?{id:rider.m_id,x:rider.mx,y:rider.my,inventory:rider.minvent}:null});
    }};
    run=await runSegment({...part,storage:new InMemoryStorage()});
} finally {
    keys.forEach((k,i)=>previous[i]?Object.defineProperty(globalThis,k,previous[i]):delete globalThis[k]);
}
const before=states.find(s=>s.step===55),after=states.find(s=>s.step===56);
test('actual terrain wishes create a locked door and a keyless Rider approaches it',()=>{
    assert.deepEqual(before.door,{type:DOOR,mask:D_LOCKED});
    assert.deepEqual([before.rider.x,before.rider.y],[40,5]);
    assert.equal(before.rider.inventory,null);
    assert.deepEqual(before.hero,[38,5]);
});
test('the same Rider unlocks and opens rather than destroying that door',()=>{
    assert.equal(after.rider.id,before.rider.id);
    assert.deepEqual([after.rider.x,after.rider.y],[39,5]);
    assert.equal(after.door.mask,D_ISOPEN);
    assert.match(after.text,/Death unlocks and opens a door\./);
});
test('the ordinary input avoids the door-smashing RNG draw',()=>{
    assert.equal(run.getRngSlices()[56].some(c=>/^rn2\(2\)=.*@js\/monmove\.js:/.test(c)),false);
});
test('all 58 keys reach boundaries without leaked hooks or extra animations',()=>{
    assert.equal(run.getScreens().length,59);
    assert.equal(run.getRngLog().length,2396);
    assert.equal(run.getAnimationFramesByStep().reduce((n,s)=>n+s.length,0),0);
    assert.deepEqual(keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k)),previous);
});
console.log(JSON.stringify({before,after,boundaries:run.getScreens().length,calls:run.getRngLog().length}));
