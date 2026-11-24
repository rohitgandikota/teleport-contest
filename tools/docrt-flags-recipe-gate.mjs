// Proposed C assertions. Without a raw argument, validation is JS-only.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/docrt-flags.json',import.meta.url)));
const coverage=JSON.parse(fs.readFileSync(new URL('gen-sessions/coverage-requirements.json',import.meta.url)));
const known=new Set(coverage.requirements.map(r=>r.id));
assert.ok(recipe.coverage.every(tag=>known.has(tag)));
assert.deepEqual(branchAssertionErrors(recipe),[]);
let observed;
if(process.argv[2]){
    observed=JSON.parse(fs.readFileSync(process.argv[2]));
    assert.equal(observed.source,'c');assert.equal(observed.version,5);
    assert.equal(observed.segments.length,recipe.segments.length);
    for(const [i,part] of observed.segments.entries()){
        for(const key of ['name','seed','datetime','nethackrc','moves'])
            assert.deepEqual(part[key],recipe.segments[i][key],`unchanged ${i} ${key}`);
        assert.equal(part.steps.length,part.moves.length+1);
        assert.equal(part.steps[0].key,null);
        assert.deepEqual(part.steps.slice(1).map(s=>s.key),Array.from(part.moves));
    }
    assert.deepEqual(recordingIntegrityErrors(observed),[]);
}else{
    // This transient comparison object is never written as a native fixture.
    observed={segments:[]};
    for(const part of recipe.segments){
        const run=await runSegment({...part,storage:new InMemoryStorage()});
        observed.segments.push({steps:run.getScreens().map(screen=>({screen}))});
    }
}
assert.deepEqual(branchAssertionErrors(recipe,observed),[]);
console.log(JSON.stringify({assertions:recipe.branches.length,knownCoverage:recipe.coverage,
    evidence:process.argv[2]?'unchanged native observable assertions':'JS-only source assertions; native confirmation pending'}));
