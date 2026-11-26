// Shared by all three gates. This module imports no game code and writes nothing.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const hash=value=>sha(JSON.stringify(value));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
const evidence='gen-sessions/evidence/saved-monster-traits-owner/';
function pinned(file,expected,label){
    const bytes=readFileSync(new URL(file,import.meta.url));
    assert.equal(sha(bytes),expected,label);
    return JSON.parse(bytes);
}
const recipe=pinned('gen-sessions/recipes/saved-monster-traits-owner.json',
    'cdeee4337d02db79544ce5e1ed847d7c9d252de5c47fa3de2adc208296513e81','primary recipe bytes');
const original=pinned(evidence+'recording-recipe.json',
    'f693ddd418ad6f54757c1c903a8115ab5863d2abd32453d9e6967a11881c97c6','original v2 recipe bytes');
const {requireBranchAssertions,branches,branchAssertions,...originalFields}=recipe;
assert.deepEqual(originalFields,original,'all original inputs, state requirements and negative hashes');
assert.equal(requireBranchAssertions,true);
assert.equal(branches.length,4);assert.equal(branchAssertions.length,4);
assert.equal(hash({requireBranchAssertions,branches,branchAssertions}),
    '3f7ab88998cabac943aa915011a8285ccb1b832c6eed07a961390a5f069873d9','primary branch metadata');
assert.deepEqual(branches,recipe.branchRequirements.map(r=>'saved-monster-traits.'+r.branch));
assert.deepEqual(branchAssertions.map(a=>[a.branch,a.segment]),branches.map((b,i)=>[b,i]));
const lock=pinned(evidence+'input-lock.json',
    'b7cc76c53b698925afcc7dea8d12d2453a8af9e7e5067980014b42f5ca749caf','original v2 input lock bytes');
assert.equal(lock.recipeSHA256,'f693ddd418ad6f54757c1c903a8115ab5863d2abd32453d9e6967a11881c97c6');
assert.equal(recipe.segments.length,4);assert.equal(lock.cases,4);assert.equal(lock.keys,374);
assert.equal(hash(recipe.segments.map(fields)),'41d53500476c05c4f76cd40ccb3fbe690d5343a76ae2786a58c138079ab31463');
assert.equal(lock.fieldsSHA256,hash(recipe.segments.map(fields)));
assert.equal(lock.branchesSHA256,hash(recipe.branchRequirements));
assert.equal(lock.negativeHashesSHA256,hash(recipe.unchangedOutputHashes));
const v1=pinned(evidence+'v1-recipe.json',
    'ffe092fddd16029d025e37dfb1cfb936fe410c6512a1d78a6c3a4ce4e676bd48','original failed v1 recipe bytes');
const v1lock=pinned(evidence+'v1-input-lock.json',
    '4ebb055e2171375de29b6d633c310f1ba5ed5198004f3734b80135785c330cd8','original failed v1 lock bytes');
assert.equal(lock.originalLockSHA256,'4ebb055e2171375de29b6d633c310f1ba5ed5198004f3734b80135785c330cd8');
assert.equal(v1lock.fieldsSHA256,hash(v1.segments.map(fields)));
assert.deepEqual(recipe.segments.slice(1),v1.segments.slice(1),'three negative input tuples unchanged');
assert.deepEqual(recipe.branchRequirements,v1.branchRequirements);
assert.deepEqual(recipe.unchangedOutputHashes,v1.unchangedOutputHashes,'all fifteen original negative hashes');
const first=v1.segments[0],pickup=first.moves.lastIndexOf(',');
assert.deepEqual(recipe.segments[0],{...first,moves:first.moves.slice(0,pickup)+'  \x1b'+first.moves.slice(pickup)},'only v1 to v2 input repair');
for(const [file,digest]of [
    ['proposal-02.json','fe394a3245b20831fd5d0370f2113aa263c6baf34980dec89ea290a2d02c058f'],
    ['proposal-16.json','1b875a64639b0afd35f9468e5019f91cb2cf8fed418d8ebe6c9bcafb198a89a9'],
    ['traits-proposal-02.json','e572a21cda4e7fac943d5011ee3678127423c3cb96200aa18d92ff2dbdabaa62'],
])pinned(evidence+file,digest,'original source setup bytes: '+file);
pinned('gen-sessions/recipes/mounted-movement-owner.json',
    '7c9b882f45abf37a25e909631f13f245cf43b035eed07dbb651943b04aa32651','canonical mounted setup recipe bytes');

// The canonical raw is immutable. No alternative paths or metadata allowances.
const rawBytes=readFileSync(new URL('gen-sessions/generated/saved-monster-traits-owner.session.json',import.meta.url));
assert.equal(sha(rawBytes),'3c7d858545b068fa7e9187488bbae50674d94d56bf0fd0778c8ab239f64b2cba','exact canonical C raw bytes');
assert.equal(rawBytes.length,1553110);
const native=JSON.parse(rawBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);assert.equal(native.segments.length,4);
assert.deepEqual(native.segments.map(fields),recipe.segments.map(fields),'all five C input fields, presence and values');
for(const [i,part]of native.segments.entries()){
    assert.ok(Array.isArray(part.steps)&&part.steps.length,'C boundaries are mandatory');
    assert.deepEqual(part.steps.map(s=>s.key),[null,...recipe.segments[i].moves],'every original key and initial null boundary');
    assert.equal(sha(Buffer.from(part.moves,'utf8')),sha(Buffer.from(recipe.segments[i].moves,'utf8')),'exact key bytes');
}
assert.equal(native.segments.reduce((n,s)=>n+s.moves.length,0),374);
assert.equal(native.segments.reduce((n,s)=>n+s.steps.length,0),378);
assert.deepEqual(recordingIntegrityErrors(native),[],'canonical C recording integrity');
assert.deepEqual(branchAssertionErrors(recipe,native),[],'all four required C branches');
