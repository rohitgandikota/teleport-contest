// Shared metadata-only validation. No game imports or file output.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const hash=value=>sha(JSON.stringify(value));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
function pinned(file,expected,label){
    const bytes=readFileSync(new URL(file,import.meta.url));
    assert.equal(sha(bytes),expected,label);
    return JSON.parse(bytes);
}
const recipe=pinned('gen-sessions/recipes/wrapped-message-clear.json',
    'f3ed4adb5f0c9fce1581b4a8101bffc9a41f6f2917874f4cbf10717c36815db4','unchanged primary recipe bytes');
const evidence='gen-sessions/evidence/wrapped-message-clear/';
const lock=pinned(evidence+'input-lock.json',
    '89ae3d1dbc7cae9d859860a23af57c570d418835f95c4ba5325792ece973b511','original final input lock bytes');
assert.equal(lock.recipeSHA256,'f3ed4adb5f0c9fce1581b4a8101bffc9a41f6f2917874f4cbf10717c36815db4');
assert.deepEqual(lock.inputFields,['name','seed','datetime','nethackrc','moves']);
assert.equal(recipe.segments.length,5);assert.equal(lock.cases,5);
assert.equal(lock.keys,243);assert.equal(lock.boundaries,248);
assert.deepEqual(recipe.segments,lock.segments,'all original fields and keys');
assert.deepEqual(recipe.branchRequirements,lock.sourcePredictions,'all original source requirements');
assert.deepEqual(recipe.unchangedOutputHashes,lock.negativeHashes,'all fifteen original negative hashes');
assert.equal(Object.keys(lock.negativeHashes).length,3);
assert.ok(Object.values(lock.negativeHashes).every(v=>Object.keys(v).length===5));
const tuples=recipe.segments.map(fields);
assert.ok(tuples.every(t=>t.every(f=>f.present)),'all five original fields are present');
assert.equal(hash(tuples),'15cb38f510c228fe4bfae21fe86ee99811a789650ea38cfab6926002bfd779dd');
assert.equal(lock.allFiveFieldsPresenceValuesSHA256,hash(tuples));
assert.equal(recipe.requireBranchAssertions,true);
assert.equal(recipe.branches.length,5);assert.equal(recipe.branchAssertions.length,5);
assert.deepEqual(recipe.branches,recipe.segments.map(s=>'wrapped-message.'+s.name));
assert.deepEqual(recipe.branchAssertions.map(a=>[a.branch,a.segment]),recipe.branches.map((b,i)=>[b,i]));
assert.deepEqual(branchAssertionErrors(recipe),[]);

const history={};
for(const [name,digest] of Object.entries(lock.attempts))
    history[name]=pinned(evidence+'history/'+name,digest,'original input history bytes: '+name);
assert.deepEqual(history['proposals-02.json'].segments,recipe.segments,'final probe used locked tuples');
const initial=history['ordinary-proposals.json'].segments;
assert.equal(initial.length,5);
for(let i=0;i<5;i++){
    if(i<3){
        assert.ok(initial[i].moves.startsWith(' #'));
        assert.deepEqual(recipe.segments[i],{...initial[i],moves:initial[i].moves.slice(1)},'only failed leading-space assumption removed');
    }else assert.deepEqual(recipe.segments[i],initial[i],'welcome inputs unchanged');
}

const rawBytes=readFileSync(new URL('gen-sessions/generated/wrapped-message-clear.session.json',import.meta.url));
assert.equal(sha(rawBytes),'920886535739edb1b616f1014df969d28e3a7b939c99f81628b3f7e84e6322d1','exact canonical C raw bytes');
assert.equal(rawBytes.length,957913);
const native=JSON.parse(rawBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);assert.equal(native.segments.length,5);
assert.deepEqual(native.segments.map(fields),tuples,'all five C fields, presence and values');
for(const [i,part] of native.segments.entries()){
    assert.ok(Array.isArray(part.steps)&&part.steps.length,'C boundaries are mandatory');
    assert.deepEqual(part.steps.map(s=>s.key),[null,...recipe.segments[i].moves],'every recorded key and initial null boundary');
    assert.equal(sha(Buffer.from(part.moves,'utf8')),sha(Buffer.from(recipe.segments[i].moves,'utf8')),'exact input bytes');
}
assert.equal(native.segments.reduce((n,s)=>n+s.moves.length,0),243);
assert.equal(native.segments.reduce((n,s)=>n+s.steps.length,0),248);
assert.deepEqual(recordingIntegrityErrors(native),[],'canonical C recording integrity');
assert.deepEqual(branchAssertionErrors(recipe,native),[],'all five primary C branches');
