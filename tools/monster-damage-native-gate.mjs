// Immutable parent C recording. Output parity is checked separately by the
// frozen runner, complete-RNG gate, and full-style confirmation diagnostic.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {recordingIntegrityErrors,branchAssertionErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type:'json'};
const raw=readFileSync(new URL('gen-sessions/generated/monster-damage-type-dispatch.session.json',import.meta.url));
const native=JSON.parse(raw);
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/monster-damage-type-dispatch.json',import.meta.url)));
const counts=[[58,2912,0],[67,2942,0],[65,2898,0]];
const calls=a=>(a||[]).map(s=>String(s).replace(/\s*@\s.*$/,'').replace(/^\d+\s+/,'').trim())
    .filter(s=>/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(s));
test('native raw bytes, provenance, five field presences and every input key',()=>{
    assert.equal(createHash('sha256').update(raw).digest('hex'),'77a02731f8ad89302ac5cb2d484cda4714ee2b25f7d913f4497985af99931330');
    assert.equal(raw.length,464370);assert.equal(native.source,'c');assert.equal(native.version,5);
    assert.equal(native.segments.length,3);assert.equal(recipe.segments.length,3);
    assert.deepEqual(recordingIntegrityErrors(native),[]);
    for(const [i,part] of native.segments.entries()){
        for(const key of ['name','seed','datetime','nethackrc','moves']){
            assert.equal(Object.hasOwn(part,key),true);assert.equal(Object.hasOwn(recipe.segments[i],key),true);
            assert.deepEqual(part[key],recipe.segments[i][key]);
        }
        assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves]);
        assert.equal(part.steps.length,counts[i][0]);
        assert.equal(calls(part.steps.flatMap(s=>s.rng||[])).length,counts[i][1]);
        assert.equal(part.steps.reduce((n,s)=>n+(s.animation_frames||[]).length,0),counts[i][2]);
    }
});
test('registered recipe categories and unchanged C branch assertions',()=>{
    const known=new Set(tags.requirements.map(r=>r.id));
    for(const category of recipe.coverage)assert.ok(known.has(category),category);
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    assert.deepEqual(branchAssertionErrors(recipe,native),[]);
});
