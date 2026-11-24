// Immutable parent C recording. Output parity is checked separately by the
// frozen runner, complete-RNG gate, and full-style confirmation diagnostic.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {recordingIntegrityErrors,branchAssertionErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type:'json'};
const raw=readFileSync(new URL('gen-sessions/generated/hero-species-table-identity.session.json',import.meta.url));
const native=JSON.parse(raw);
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/hero-species-table-identity.json',import.meta.url)));
const counts=[[73,2903,0],[74,2809,0],[74,3020,0]];
const calls=a=>(a||[]).map(s=>{
    const call=String(s).replace(/\s*@\s.*$/,'').replace(/^\d+\s+/,'').trim();
    assert.match(call,/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/);
    return call;
});
test('native raw bytes, provenance, five field presences and every input key',()=>{
    assert.equal(createHash('sha256').update(raw).digest('hex'),'06cae818c0140935a1d61435f3b7d5d90cf05e96029c2335ea17fbf62bc69715');
    assert.equal(raw.length,455487);assert.equal(native.source,'c');assert.equal(native.version,5);
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
