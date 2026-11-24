// Valid serial native recording only. Negative controls mutate memory, not bytes.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const bytes=fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/fog-cloud-door-feedback.session.json',import.meta.url));
const native=JSON.parse(bytes);
const recipe=JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/fog-cloud-door-feedback.json',import.meta.url)));
const facts=native.segments.map(s=>{
    const before=decodeScreen(s.steps[68].screen),step=s.steps[69],grid=decodeScreen(step.screen);
    return {door:before[6][38],mon:grid[6][38],cursor:step.cursor,rng:step.rng,
        message:grid[0].map(c=>c.ch).join('').trimEnd()};
});
function assertPassage(w,index) {
    assert.deepEqual(w.door,{ch:'+',color:3,attr:0,decgfx:0});
    assert.deepEqual(w.mon,{ch:['v','b'][index],color:[8,2][index],attr:0,decgfx:0});
    assert.deepEqual(w.cursor,[37,6,1]);
    assert.equal(w.message,['The fog cloud flows under the door.',
        'The acid blob oozes under the door.'][index]);
    assert.equal(w.rng.length,13);
    assert.equal(w.rng[0],'rn2(5)=3 @ distfleeck(monmove.c:538)');
    assert.equal(w.rng[12],'rn2(76)=43 @ moveloop_core(allmain.c:360)');
}
test('valid native bytes, input fields, integrity and both recipe groups remain exact',()=>{
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
        'f0c715df55b26c93f202414f9cd1cb83edee314f1db601fdf4bf731be8883030');
    assert.equal(native.version,5);assert.equal(native.source,'c');
    assert.equal(native.segments.length,2);
    for(const [index,segment] of native.segments.entries()){
        for(const field of ['name','seed','datetime','nethackrc','moves'])
            assert.deepEqual(segment[field],recipe.segments[index][field],field);
        assert.equal(segment.steps.length,72);
        assert.equal(segment.steps.reduce((n,s)=>n+s.rng.length,0),[2448,2449][index]);
        assert.equal(segment.steps.reduce((n,s)=>n+(s.animation_frames||[]).length,0),0);
    }
    assert.deepEqual(recordingIntegrityErrors(native),[]);
    assert.deepEqual(branchAssertionErrors(recipe,native),[]);
});
test('native fog cloud flows through the closed doorway',()=>assertPassage(facts[0],0));
test('native acid blob still oozes, with the same movement-call packet',()=>{
    assertPassage(facts[1],1);assert.deepEqual(facts[0].rng,facts[1].rng);
});
test('negative control rejects fog oozing feedback',()=>{
    assert.throws(()=>assertPassage({...facts[0],message:'The fog cloud oozes under the door.'},0));
});
test('negative control rejects extending flows to an acid blob',()=>{
    assert.throws(()=>assertPassage({...facts[1],message:'The acid blob flows under the door.'},1));
});
test('negative control rejects a missing movement call',()=>{
    assert.throws(()=>assertPassage({...facts[0],rng:facts[0].rng.slice(1)},0));
});
