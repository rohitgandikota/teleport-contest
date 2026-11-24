// Immutable parent C recording. Output parity is checked separately by the
// frozen runner, complete-RNG gate, and full-style confirmation diagnostic.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {recordingIntegrityErrors,branchAssertionErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type:'json'};
const raw=readFileSync(new URL('gen-sessions/generated/hero-gaze-counter-effects.session.json',import.meta.url));
const native=JSON.parse(raw);
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/hero-gaze-counter-effects.json',import.meta.url)));
const counts=[[84,3456,19],[117,2821,0],[93,2804,0],[111,2811,0],[76,2815,0]];
const calls=a=>(a||[]).map(s=>{
    const call=String(s).replace(/\s*@\s.*$/,'').replace(/^\d+\s+/,'').trim();
    assert.match(call,/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/);
    return call;
});
test('native raw bytes, provenance, five field presences and every input key',()=>{
    assert.equal(createHash('sha256').update(raw).digest('hex'),'dc0bee64e6a27503b9cd6084218f08c06ec46b495d4b567979e16cadbc7dc4a8');
    assert.equal(raw.length,783657);assert.equal(native.source,'c');assert.equal(native.version,5);
    assert.equal(native.segments.length,5);assert.equal(recipe.segments.length,5);
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
