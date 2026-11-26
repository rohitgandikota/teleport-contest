import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url),repo=new URL('../../../',root);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=name=>JSON.parse(readFileSync(new URL(name,root)));
const lock=read('input-lock.json');
assert.equal(sha(readFileSync(new URL(import.meta.url))),lock.probeSHA256);
for(const [name,hash] of Object.entries(lock.files))
    assert.equal(sha(readFileSync(new URL(name,root))),hash,name);
for(const [name,hash] of Object.entries(read('original-pins.json')))
    assert.equal(sha(readFileSync(new URL('original/'+name,root))),hash,name);
assert.equal(Object.keys(read('original/source-files.json')).length,12);
assert.equal(sha(readFileSync(new URL('original/source-files.json',root))),read('original/SEAL.json').sourceFilesSHA256);
for(const [name,hash] of Object.entries(read('baseline-runtime.json')))
    assert.equal(sha(readFileSync(new URL('baseline/'+name,root))),hash,name);
for(const [name,hash] of Object.entries(read('source-pins.json')))
    assert.equal(sha(readFileSync(new URL(name,repo))),hash,name);
const {parentPageProof}=await import('./check-parent.mjs');
assert.deepEqual(parentPageProof,read('parent-page-proof.json'));
const recipe=read('recipe.json'),predictions=read('predictions.json');
const originalRecipe=read('original/recipe.json'),changes=read('producer-changes.json');
assert.deepEqual(predictions,read('original/predictions.json'));
for(const [i,s] of recipe.segments.entries()) {
    const frozen=lock.inputs[i],prior=originalRecipe.segments[i];
    for(const field of lock.fields) {
        assert.equal(Object.hasOwn(s,field),frozen.fields[field].present);
        assert.deepEqual(s[field],frozen.fields[field].value);
        if(field!=='moves'||i>=3) assert.deepEqual(s[field],prior[field]);
    }
    assert.deepEqual(Array.from(s.moves,c=>c.charCodeAt(0)),frozen.keys);
    if(i<3) {
        const c=changes.changes[i],at=c.insertAtKeyOffset;
        assert.equal(s.moves,prior.moves.slice(0,at)+' '+prior.moves.slice(at));
        assert.equal(at,parentPageProof.pages[i].firstPageBoundary);
    } else assert.deepEqual(s,prior);
}
const reportPath=new URL('baseline-observation.json',root);
assert.ok(!existsSync(reportPath));
assert.ok(!existsSync(new URL('page-observation.json',root)));
const pageObservations=[];

const {runSegment} = await import('./baseline/js/jsmain.js');
const {InMemoryStorage} = await import('./baseline/js/storage.js');
const {ONAMES} = await import('./baseline/js/objects_data.js');
const arts = await import('./baseline/js/artilist_data.js');
const {FROMOUTSIDE} = await import('./baseline/js/const.js');
const {decodeScreen, renderCell} = await import('./baseline/frozen/screen-decode.mjs');
const {outputs, hashes, deferred} = await import('./baseline/tools/half-damage-reader-observe.mjs');
const properties = ['HSee_invisible', 'HFire_resistance', 'HCold_resistance',
    'HShock_resistance', 'HSleep_resistance', 'HPoison_resistance'];
const rows = [];
for (const [index, part] of recipe.segments.entries()) {
    const prediction = predictions[index];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (!g.u || !g.level) return;
            states.push({step, turn:g.moves, hp:g.u.uhp, mortality:g.u.umortality || 0,
                crown:g.u.uevent?.uhand_of_elbereth || 0,
                intrinsic:properties.map(p => g.u.intrinsic?.[p] || 0),
                objects:[...g.invent, ...g.level.objects].map(o => ({id:o.o_id,
                    type:o.otyp, artifact:o.oartifact || 0, blessed:!!o.blessed})),
                logs:(g.gamelog || []).map(e => ({flags:e.flags, turn:e.turn, text:e.text}))});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const output = structuredClone(outputs(run)), streamHashes = hashes(output);
    const last = states.at(-1), firstCrown = states.find(s => s.crown);
    const texts = output.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    if(index<3) {
        const at=changes.changes[index].insertAtKeyOffset;
        pageObservations.push({index,name:part.name,
            firstPage:{step:at,key:part.moves[at-1],rows:texts[at].split('\n')},
            nextPage:{step:at+1,key:part.moves[at],rows:texts[at+1].split('\n')},
            closed:{step:at+2,key:part.moves[at+1],rows:texts[at+2].split('\n')}});
        writeFileSync(new URL('page-observation.json',root),JSON.stringify(pageObservations,null,2)+'\n');
    }
    const expected = prediction.crown ? [prediction.title, prediction.gift] : [];
    const logs = last.logs.filter(e => e.text === prediction.title || e.text === prediction.gift);
    const checks = [];
    const check = (name, test) => {
        try { test(); checks.push({name, pass:true}); }
        catch (error) { checks.push({name, pass:false, error:error.message}); }
    };
    check('real crown and gift setup', () => {
        assert.equal(last.crown, prediction.crown);
        if (prediction.crown) {
            assert.ok(firstCrown);
            assert.ok(last.intrinsic.every(p => (p & FROMOUTSIDE) !== 0));
            assert.ok(last.objects.some(o => o.type === ONAMES[prediction.objectType]
                && (!prediction.artifact || o.artifact === arts[prediction.artifact]) && o.blessed));
        } else assert.equal(firstCrown, undefined);
    });
    check('C title and gift event order', () => assert.deepEqual(logs.map(e => e.text), expected));
    check('C event categories and turn', () => {
        assert.deepEqual(logs.map(e => e.flags), prediction.crown ? prediction.flags : []);
        if (prediction.crown) assert.deepEqual(logs.map(e => e.turn), [firstCrown.turn, firstCrown.turn]);
    });
    check('C chronicle entries', () => {
        assert.ok(texts.some(t => t.includes('Logged events:')));
        for (const text of [prediction.title, prediction.gift])
            assert.equal(texts.some(t => t.includes(text)), !!prediction.crown);
    });
    check('survival and every input boundary', () => {
        assert.ok(states.every(s => s.hp > 0 && !s.mortality));
        assert.equal(last.step, part.moves.length);
        assert.equal(output.screens.length, part.moves.length + 1);
        assert.deepEqual(output.slices.flat(), output.calls);
    });
    const plain = outputs(await runSegment({...part, storage:new InMemoryStorage()}));
    check('observer preserves five streams', () => assert.deepEqual(hashes(plain), streamHashes));
    const delayed = await deferred(part);
    check('deferred input preserves five streams', () => assert.deepEqual(hashes(delayed), streamHashes));
    rows.push({name:part.name, checks, firstCrown, last, hashes:streamHashes,
        keys:part.moves.length, boundaries:output.screens.length,
        calls:output.calls.length, frames:output.frames.flat().length});
}
const report = {recipeSHA256:lock.files['recipe.json'], runtimeSHA256:lock.files['baseline-runtime.json'], rows};
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {flag:'wx'});
const failures = rows.flatMap(r => r.checks.filter(c => !c.pass).map(c => ({case:r.name, ...c})));
console.log(JSON.stringify({cases:rows.length, checks:rows.length * 7, failures}));
if (failures.length) process.exitCode = 1;
