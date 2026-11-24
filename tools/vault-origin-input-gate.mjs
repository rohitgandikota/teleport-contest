// Actual vault creation, warning progression, displacement, and movement.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Displaced} from '../js/youprop.js';

const input=JSON.parse(fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/vault-guard-origin.session.json',import.meta.url)));
const recipe=JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-guard-origin.json',import.meta.url)));
assert.equal(input.source,'c');
assert.equal(input.version,5);
assert.equal(input.segments.length,1);
const part=input.segments[0];
const fields=['name','seed','datetime','nethackrc','moves'];
assert.deepEqual(fields.map(k=>part[k]),fields.map(k=>recipe.segments[0][k]));
const keys=['__step_snapshot','__rng_trace_sites'];
const previous=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
const states=[];
let run;
try {
    globalThis.__rng_trace_sites=true;
    globalThis.__step_snapshot={step:'*',cb(g,step){
        if(!g.u||!g.level)return;
        const guard=g.level.monsters.find(m=>m.isgd);
        states.push({step,hero:[g.u.ux,g.u.uy],displaced:!!Displaced(),
            text:g._toplines||'',guard:guard?{id:guard.m_id,at:[guard.mx,guard.my],
                peaceful:guard.mpeaceful,warn:guard.mextra.egd.warncnt,
                track:structuredClone(guard.mtrack||[]),
                positions:[...g.level.monAt].filter(([,v])=>v===guard).map(([k])=>k)}:null});
    }};
    run=await runSegment({...part,storage:new InMemoryStorage()});
} finally {
    keys.forEach((k,i)=>previous[i]?Object.defineProperty(globalThis,k,previous[i]):delete globalThis[k]);
}
const before=states.find(s=>s.step===128),after=states.find(s=>s.step===129);
await test('ordinary input creates a guard and reaches its seventh warning',()=>{
    assert.deepEqual(before.hero,[23,5]);
    assert.deepEqual(before.guard.at,[25,5]);
    assert.equal(before.guard.warn,7);
    assert.equal(before.guard.peaceful,1);
});
await test('real wizard displacement persists through the diagonal hero step',()=>{
    assert.ok(states.some(s=>s.text==='Timeout for displaced set to 100.'));
    assert.equal(before.displaced,true);
    assert.equal(after.displaced,true);
    assert.deepEqual(after.hero,[24,6]);
    assert.match(after.text,/You've been warned, knave!/);
});
await test('fallback leaves the guard indexed only at its final location',()=>{
    assert.equal(after.guard.id,before.guard.id);
    assert.equal(after.guard.peaceful,0);
    assert.deepEqual(after.guard.at,[23,6]);
    assert.deepEqual(after.guard.positions,['23,6']);
});
await test('movement track starts at the real post-relocation origin',()=>{
    assert.deepEqual(after.guard.track,[{x:23,y:5}]);
});
await test('all boundaries and calls complete without animations',()=>{
    assert.equal(run.getScreens().length,132);
    assert.equal(run.getCursors().length,132);
    assert.equal(run.getRngLog().length,6358);
    assert.equal(run.getAnimationFramesByStep().reduce((n,s)=>n+s.length,0),0);
});
await test('all input is consumed and observer hooks are restored',()=>{
    assert.equal(run._display.inputQueueLength,0);
    assert.deepEqual(keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k)),previous);
});
console.log(JSON.stringify({before,after,boundaries:run.getScreens().length,calls:run.getRngLog().length}));
