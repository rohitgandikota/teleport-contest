// Ordinary input reach only. This gate does not label JS output as native C.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {DRAWBRIDGE_UP,DB_UNDER,DB_ICE,DB_MOAT} from '../js/const.js';
import {Levitation} from '../js/youprop.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import coverage from './gen-sessions/coverage-requirements.json' with {type:'json'};
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/accessible-raised-drawbridge.json',import.meta.url)));
const raw=readFileSync(new URL('gen-sessions/generated/accessible-raised-drawbridge.session.json',import.meta.url));
const native=JSON.parse(raw);
await test('recipe name, registered tags and observable assertions',()=>{
    assert.equal(recipe.name,'accessible-raised-drawbridge');
    assert.equal(recipe.segments.length,2);
    assert.equal(createHash('sha256').update(raw).digest('hex'),
        '9d715e570ec7e7c007c7cb7bdcaafbab7df0d69bf86a4bf298c118ec2e4eb0ff');
    assert.equal(native.source,'c');assert.equal(native.version,5);
    assert.equal(native.segments.length,2);
    assert.deepEqual(recordingIntegrityErrors(native),[]);
    assert.deepEqual(branchAssertionErrors(recipe,native),[]);
    for(const [index,segment]of native.segments.entries()) {
        for(const field of ['name','seed','datetime','nethackrc','moves']) {
            assert.equal(Object.hasOwn(segment,field),Object.hasOwn(recipe.segments[index],field));
            assert.equal(segment[field],recipe.segments[index][field]);
        }
        assert.equal(segment.steps.length,segment.moves.length+1);
        assert.equal(segment.steps[0].key,null);
        for(let step=1;step<segment.steps.length;step++)assert.equal(segment.steps[step].key,segment.moves[step-1]);
    }
    for(const tag of recipe.coverage)assert.ok(coverage.requirements.some(r=>r.id===tag));
});
for(const [index,part] of recipe.segments.entries())await test(part.name,async()=>{
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),states=[];
    let run;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step){
            const lev=g.level?.at(14,11);
            states.push({step,hp:g.u.uhp,mortality:g.u.umortality||0,x:g.u.ux,y:g.u.uy,
                bridge:lev?{type:lev.typ,mask:lev.drawbridgemask}:null});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.equal(run.getScreens().length,part.moves.length+1);
    assert.ok(states.every(s=>s.hp>0&&s.mortality===0));
    assert.ok(Levitation(),'real worn ring permits the unfrozen control approach');
    assert.deepEqual([game.u.ux,game.u.uy],[13,11],'force-fight leaves the hero adjacent');
    const bridge=game.level.at(14,11);
    assert.equal(bridge.typ,DRAWBRIDGE_UP);
    assert.equal(bridge.drawbridgemask&DB_UNDER,index===0?DB_ICE:DB_MOAT);
    assert.ok(!game.level.monAt.get('14,11'),'the force-fight target is empty');
    const visible=run.getScreens().map(s=>decodeScreen(s)
        .map(r=>r.map(c=>c.ch).join('')).join('\n')).join('\n');
    assert.ok(!/Die\? \[yn\]|OK, so you don't die/.test(visible));
    for(const text of recipe.branchAssertions[index].screenIncludes)assert.ok(visible.includes(text),text);
    if(index===0)assert.ok(states.some(s=>s.bridge?.type===DRAWBRIDGE_UP
        &&(s.bridge.mask&DB_UNDER)===DB_ICE),'the cold wand reached the raised span');
});
