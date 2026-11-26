// Shared by the two mandatory gates and the open diagnostic. No game imports.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'),'optional compact report path only');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const hash=value=>sha(JSON.stringify(value));
const evidence='gen-sessions/evidence/corpse-xname-owner/';
const bytes=file=>readFileSync(new URL(file,import.meta.url));
const json=file=>JSON.parse(bytes(file));
const pinBytes=bytes(evidence+'metadata-pins.json');
assert.equal(sha(pinBytes),'d73559905ee46a1bdb6defad21ef09f1a029928615af03f82c48a84c99d82b53','tracked metadata pins');
const pins=JSON.parse(pinBytes);
for(const [file,digest] of Object.entries(pins.files))
    assert.equal(sha(bytes(file)),digest,`tracked source evidence: ${file}`);

const recipe=json('gen-sessions/recipes/corpse-xname-owner.json');
const lock=json(evidence+'input-lock.json');
const proposals=json(evidence+'input-proposals.json');
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(sha(bytes('gen-sessions/recipes/corpse-xname-owner.json')),lock.recipeSHA256);
assert.deepEqual(recipe.segments,proposals.segments,'all original proposed input tuples');
assert.equal(hash(recipe.segments.map(fields)),lock.inputFieldsSHA256);
assert.equal(hash(recipe.branchRequirements),lock.branchRequirementsSHA256);
assert.equal(hash(recipe.unchangedOutputHashes),lock.negativeHashesSHA256);
assert.equal(hash(recipe.branchAssertions),lock.branchAssertionsSHA256);
assert.equal(recipe.segments.length,4);assert.equal(lock.segments.length,4);
assert.equal(recipe.requireBranchAssertions,true);
assert.deepEqual(recipe.branches,recipe.branchRequirements.map(r=>'corpse-xname.'+r.branch));
assert.equal(recipe.branches.length,4);assert.equal(recipe.branchAssertions.length,4);
assert.deepEqual(recipe.branchAssertions.map(a=>[a.branch,a.segment]),recipe.branches.map((b,i)=>[b,i]));
assert.deepEqual(branchAssertionErrors(recipe),[],'four required branch schemas');
for(const [i,part] of recipe.segments.entries()){
    assert.deepEqual(fields(part),lock.segments[i].fields,'five fields and presence');
    assert.deepEqual([...Buffer.from(part.moves)],lock.segments[i].keys,'original key bytes');
    assert.equal(sha(Buffer.from(part.moves)),lock.segments[i].movesSHA256);
}
const firstRecipe=json(evidence+'health-metadata-v1/recipes/corpse-xname-owner.json');
assert.deepEqual(firstRecipe.segments,recipe.segments,'health correction changed no input');
assert.deepEqual(firstRecipe.unchangedOutputHashes,recipe.unchangedOutputHashes);
assert.deepEqual(firstRecipe.branchAssertions,recipe.branchAssertions);
assert.deepEqual(recipe.branchRequirements,firstRecipe.branchRequirements.map(r=>({...r,minimumHP:1,finalHP:115})),
    'documented health phase correction only');

const rawBytes=bytes('gen-sessions/generated/corpse-xname-owner.session.json');
assert.equal(sha(rawBytes),'13990943b540a0f3b08f4752fe68249b1aa43da2ca210e2a12b93a5d91d7c309','exact canonical C raw bytes');
assert.equal(rawBytes.length,3056105);
const native=JSON.parse(rawBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);assert.equal(native.segments.length,4);
assert.deepEqual(native.segments.map(fields),recipe.segments.map(fields),'C five fields, presence and values');
let keys=0,boundaries=0,calls=0,frames=0;
for(const [i,part] of native.segments.entries()){
    assert.ok(Array.isArray(part.steps));assert.equal(part.steps.length,part.moves.length+1);
    assert.deepEqual(part.steps.map(s=>s.key),[null,...recipe.segments[i].moves],'every C key and initial boundary');
    assert.equal(sha(Buffer.from(part.moves)),lock.segments[i].movesSHA256);
    for(const step of part.steps){
        assert.ok(Object.hasOwn(step,'key'));
        assert.equal(typeof step.screen,'string');
        assert.ok(Array.isArray(step.cursor)&&step.cursor.length===3&&step.cursor.every(Number.isInteger));
        assert.ok(Array.isArray(step.rng)&&step.rng.every(c=>typeof c==='string'));
        if(Object.hasOwn(step,'animation_frames'))assert.ok(Array.isArray(step.animation_frames));
        calls+=step.rng.length;frames+=(step.animation_frames||[]).length;
    }
    keys+=part.moves.length;boundaries+=part.steps.length;
}
assert.deepEqual({keys,boundaries,calls,frames},{keys:729,boundaries:733,calls:23926,frames:0});
assert.equal(keys,lock.keys);assert.equal(boundaries,lock.boundaries);
assert.deepEqual(recordingIntegrityErrors(native),[],'C recording integrity');
assert.deepEqual(branchAssertionErrors(recipe,native),[],'all four required C branches');
// Parent recording and comparison receipts are provenance, not current-state oracles.
const recording=json(evidence+'parent-recording.json');
assert.equal(recording.exit,0);assert.equal(recording.cExecutedOnce,true);
assert.equal(recording.rawSha256,sha(rawBytes));assert.equal(recording.primaryRecipeSHA256,lock.recipeSHA256);
assert.equal(recording.fiveInputFieldsAndPresencePreserved,true);assert.equal(recording.allKeysExact,true);
