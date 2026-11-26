// Mandatory for both gates. No game imports, writes or alternate raw paths.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const hash=value=>sha(JSON.stringify(value));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
const evidence='gen-sessions/evidence/corpse-impact-owner/';
function pinned(file,digest){
    const bytes=readFileSync(new URL(file,import.meta.url));
    assert.equal(sha(bytes),digest,file);return JSON.parse(bytes);
}
const recipe=pinned('gen-sessions/recipes/corpse-impact-owner.json','0fe2c20e2a9156cc3c9dbcf339d4f3ca80f5e3d223e6cf1501964120493266f1');
const original=pinned(evidence+'recording-recipe.json','901e7494fc208ca9ccc36571225886b46efdd0aa9728b50f59f1605ba19300a6');
const lock=pinned(evidence+'input-lock.json','1d9d5d599782bbf513c04183d22eb42136d9a5e58dc8026325a44d695b9ef01e');
const proposal16=pinned(evidence+'proposal-16.json','79dd28bc36f28962ade91f84580b50486a314aacca7748bb5bae389de8d9cd19');
const proposals=pinned(evidence+'proposals-01.json','eae2019dbe7d70e4db3d1ba041afddc1d8a170ed6efa1e51d50312a31cb7119c');
const selection=pinned(evidence+'proposal-selection.json','e2aec3f3912e2a12cb3446d71687c4dbfea77b3b9f883397cf12ce0e9cf03e6e');
const derivation=pinned(evidence+'recipe-derivation.json','b61bde3b74d7ade9e35f85281a020649342e8876b48d0b50e2e2001893c212dc');
const {branches,requireBranchAssertions,branchAssertions,...unchanged}=recipe;
assert.deepEqual(unchanged,original,'only three added metadata fields');
assert.equal(JSON.stringify(unchanged,null,2)+'\n',readFileSync(new URL(evidence+'recording-recipe.json',import.meta.url),'utf8'),'stripped original bytes');
assert.equal(requireBranchAssertions,true);assert.equal(branches.length,4);assert.equal(branchAssertions.length,4);
assert.deepEqual(branches,recipe.branchRequirements.map(r=>'corpse-impact.'+r.branch));
assert.deepEqual(branchAssertions.map(a=>[a.branch,a.segment]),branches.map((b,i)=>[b,i]));
assert.deepEqual(branchAssertionErrors(recipe),[],'all four observable branch schemas');
assert.equal(lock.recipeSHA256,derivation.originalRecipeSHA256);
assert.equal(lock.recipeSHA256,'901e7494fc208ca9ccc36571225886b46efdd0aa9728b50f59f1605ba19300a6');
assert.equal(recipe.segments.length,4);assert.equal(lock.totalKeys,613);
assert.equal(hash(recipe.segments.map(fields)),lock.fieldsSHA256);
assert.equal(lock.fieldsSHA256,'998c1a60245582ad7450fbc72bc8a8555190ee093fe7e20c8140401ed26ec74d');
assert.equal(hash(recipe.branchRequirements),lock.branchRequirementsSHA256);
assert.equal(hash(recipe.unchangedOutputHashes),lock.negativeHashesSHA256);
for(const [i,s]of recipe.segments.entries()){
    const l=lock.cases[i];assert.equal(s.name,l.name);assert.equal(s.moves.length,l.keys);
    assert.equal(sha(Buffer.from(s.moves,'utf8')),l.keyBytesSHA256);assert.equal(hash(fields(s)),l.fiveFieldsSHA256);
}
assert.equal(recipe.segments.reduce((n,s)=>n+s.moves.length,0),613);
assert.deepEqual(recipe.segments[0],proposal16.segments[0],'original proposal16 tuple');
assert.deepEqual(selection.selectedIndices,[0,1,2,4]);
assert.deepEqual(recipe.segments,selection.selectedIndices.map(i=>proposals.segments[i]),'all selected proposal tuples');
assert.equal(selection.excluded.length,1);assert.equal(selection.excluded[0].index,3);
assert.equal(selection.excluded[0].name,proposals.segments[3].name,'failed quarterstaff reach retained');
assert.equal(selection.original16ReproducedByteExactly,true);assert.equal(selection.negativeHashSets,3);
assert.equal(derivation.primaryRecipeSHA256,sha(readFileSync(new URL('gen-sessions/recipes/corpse-impact-owner.json',import.meta.url))));
assert.deepEqual(derivation.onlyAddedFields,['branches','requireBranchAssertions','branchAssertions']);
assert.equal(derivation.inputFieldsSHA256,lock.fieldsSHA256);
assert.equal(derivation.stateRequirementsSHA256,lock.branchRequirementsSHA256);
assert.equal(derivation.all15NegativeHashesSHA256,lock.negativeHashesSHA256);

const rawBytes=readFileSync(new URL('gen-sessions/generated/corpse-impact-owner.session.json',import.meta.url));
assert.equal(sha(rawBytes),'6e69c20ddb555c320603929bc52aa1f3b149f4cc6a58804a7cb55ef111ae7ce1','exact canonical C raw bytes');
assert.equal(rawBytes.length,2807903);
const native=JSON.parse(rawBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);assert.equal(native.segments.length,4);
assert.deepEqual(native.segments.map(fields),recipe.segments.map(fields),'all five C fields, presence and values');
for(const [i,part]of native.segments.entries()){
    assert.ok(Array.isArray(part.steps)&&part.steps.length,'mandatory C boundaries');
    assert.deepEqual(part.steps.map(s=>s.key),[null,...recipe.segments[i].moves],'all original keys and initial null');
    assert.equal(sha(Buffer.from(part.moves,'utf8')),lock.cases[i].keyBytesSHA256,'exact input key bytes');
}
assert.equal(native.segments.reduce((n,s)=>n+s.moves.length,0),613);
assert.equal(native.segments.reduce((n,s)=>n+s.steps.length,0),617);
assert.deepEqual(recordingIntegrityErrors(native),[],'canonical C recording integrity');
assert.deepEqual(branchAssertionErrors(recipe,native),[],'all four required C branches');
