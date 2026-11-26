// C vault.c:1120-1150, both doorway branches erase the engraving beyond them.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const root = new URL('../', import.meta.url);
const evidence = new URL('gen-sessions/evidence/guard-door-engraving/', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pins = {
    "input-lock.json": "55506284b04df383553ad4b892e71087ac7e1488b8b502f8749f065919a0a8af",
    "pre-candidate-lock.json": "05c0e52ea64adaca29c2e79f99671c09a81cfab625ec9664f349775e2da6a90f",
    "source-controls-original.mjs": "dc7ef8da884e659206cd2c191ebc43835fba0ffdd08cec7b451cb2b9c42404ba",
    "baseline-controls.json": "4b14fb0e4a6d05b72cbb36e82b704338efadcbfdeff588d1ea18785016356aeb",
    "candidate-controls.json": "03c0661795a7c41b8800c5cbe12d221618d10f08585c82a78034aec996ade1fa",
    "native-checks.json": "e1218af5b64f9b3de8264e603441a4ccff8f88bbf46fabd3660e020590c1df66",
    "native-branch-checks.json": "abd1115c5b02d2532539248d286c021b602e0c18e2a9890c4adeb4c7845e8c72",
    "recording-receipt.json": "6b594daf2b83f4d4ad71eb9ae53015774169fc505bdbd53d4fd573a08de7e46d"
};
for (const [name,digest] of Object.entries(pins))
    assert.equal(sha(fs.readFileSync(new URL(name,evidence))),digest,name);
const read = name => JSON.parse(fs.readFileSync(new URL(name,evidence)));
const recipeBytes = fs.readFileSync(new URL('gen-sessions/recipes/guard-door-engraving.json',import.meta.url));
assert.equal(sha(recipeBytes),'950270550d480d0fa94672c66c0ccaa6414af9171c17b7fc945145f38ce78ec6');
const recipe = JSON.parse(recipeBytes);
const recordingRecipeBytes = fs.readFileSync(new URL('recording-recipe-original.json',evidence));
assert.equal(sha(recordingRecipeBytes),'8f9de99d934faecec60333c148cda720ce654d6176108b5b6755f57b7c1c66df');
const recordingRecipe = JSON.parse(recordingRecipeBytes);
assert.deepEqual({...recipe,coverage:recordingRecipe.coverage},recordingRecipe);
const lock = read('input-lock.json'), original = read('baseline-controls.json');
const prelock = read('pre-candidate-lock.json');
assert.equal(lock.candidateExisted,false); assert.equal(prelock.candidateExisted,false);
const fields = s => Object.fromEntries(lock.inputFields.map(f => [f,{present:Object.hasOwn(s,f),value:s[f]}]));
assert.deepEqual(recipe.segments.map(fields),lock.tuples);
assert.equal(sha(JSON.stringify(lock.tuples)),lock.tupleSHA256);
assert.deepEqual([lock.keys,lock.boundaries],[906,911]);
assert.deepEqual([original.passed,original.total],[23,25]);
assert.deepEqual(original.results.filter(r=>!r.pass).map(r=>r.name),
    recipe.segments.slice(0,2).map(s=>s.name+': C doorway cleanup or paired negative'));
const expected = read('candidate-controls.json');
assert.deepEqual([expected.passed,expected.total],[25,25]);
assert.deepEqual(expected.results.map(r=>r.name),original.results.map(r=>r.name));
assert.deepEqual(expected.rows.slice(2),original.rows.slice(2));
const rawBytes = fs.readFileSync(new URL('gen-sessions/generated/guard-door-engraving.session.json',import.meta.url));
assert.equal(sha(rawBytes),'b8a1373f43c614f3614ce34b6231ea9eac4a623d2d728d706ac646ee90d3be50');
const raw = JSON.parse(rawBytes);
assert.equal(raw.source,'c'); assert.equal(raw.version,5);
assert.deepEqual(raw.segments.map(fields),lock.tuples);
for (const [i,s] of raw.segments.entries())
    assert.deepEqual(s.steps.map(t=>t.key),[null,...recipe.segments[i].moves]);
assert.equal(raw.segments.flatMap(s=>s.steps).length,911);
assert.equal(raw.segments.flatMap(s=>s.steps).reduce((n,s)=>n+s.rng.length,0),31087);
assert.deepEqual(recordingIntegrityErrors(raw),[]);
assert.deepEqual(branchAssertionErrors(recipe,raw),[]);
assert.deepEqual(read('native-branch-checks.json'),{integrityErrors:[],branchErrors:[],primaryBranches:5});
const outputPath = process.argv[2];
assert.ok(process.argv.length<=3 && (!outputPath || !outputPath.startsWith('-')),
    'usage: guard-door-engraving-input-gate.mjs [new-report.json]');
assert.ok(!outputPath || !fs.existsSync(outputPath));
// Metadata is checked before importing the current game implementation.
const {runSegment} = await import(new URL('js/jsmain.js',root));
const {InMemoryStorage} = await import(new URL('js/storage.js',root));
const {Passes_walls} = await import(new URL('js/youprop.js',root));
const {in_rooms} = await import(new URL('js/hack.js',root));
const {VAULT, DOOR, CORR, STONE, THRONE, IS_WALL} = await import(new URL('js/const.js',root));
const {outputs, hashes, deferred} = await import('./half-damage-reader-observe.mjs');
// BEGIN ORIGINAL CONTROL BODY
const firstCarve = [175, 187, 169, null, 134];
const results = [], rows = [];
function check(name, fn) {
    try { fn(); results.push({name, pass:true}); }
    catch (error) { results.push({name, pass:false, error:error.message}); }
}
for (const [i, part] of recipe.segments.entries()) {
    const states = [];
    const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let observed;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g,step) {
            if (!g.level || !g.u || step < 65) return;
            const guard = g.level.monsters.find(m => m.isgd);
            const e = guard?.mextra?.egd;
            const ep = g.level.lev_engr?.find(e => e.x===27 && e.y===5);
            states.push({step, key:part.moves[step-1], turn:g.moves,
                hero:[g.u.ux,g.u.uy], inVault:!!in_rooms(g.u.ux,g.u.uy,VAULT),
                passWalls:Passes_walls(), top:g._toplines,
                guard:guard?{xy:[guard.mx,guard.my],end:e.fcend,done:e.gddone,peaceful:guard.mpeaceful}:null,
                at26:g.level.at(26,5).typ, at27:g.level.at(27,5).typ,
                engraving:ep?{text:ep.engr_txt,type:ep.engr_type}:null});
        }};
        observed = outputs(await runSegment({...part, storage:new InMemoryStorage()}));
    } finally {
        if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const plain = outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    const held = await deferred(part);
    const liveHashes = hashes(plain);
    check(part.name+': passive observation is neutral', () => assert.deepEqual(hashes(observed),liveHashes));
    check(part.name+': deferred input preserves all streams', () => assert.deepEqual(hashes(held),liveHashes));
    check(part.name+': all keys and random boundaries retained', () => {
        assert.equal(plain.screens.length,part.moves.length+1);
        assert.deepEqual(plain.slices.flat(),plain.calls);
    });
    const before = states.find(s => s.step === (firstCarve[i] ? firstCarve[i]-1 : part.moves.length));
    const after = firstCarve[i] ? states.find(s => s.step === firstCarve[i]) : null;
    check(part.name+': actual door and engraving producers', () => {
        assert.deepEqual(before.hero,[23,5]); assert.deepEqual(before.guard.xy,[25,5]);
        assert.equal(before.guard.end,1); assert.equal(before.guard.peaceful,1);
        assert.equal(before.passWalls,false);
        if (i===1) { assert.equal(before.at26,THRONE); assert.ok(IS_WALL(before.at27)); }
        else if (i===2) { assert.equal(before.at26,STONE); assert.equal(before.at27,THRONE); }
        else if (i<4) { assert.ok(IS_WALL(before.at26)); assert.equal(before.at27,THRONE); }
        if (i<4) assert.equal(before.engraving.text,'mar|');
        else assert.equal(before.engraving,null);
        if (after) {
            assert.deepEqual(after.hero,[24,5]); assert.equal(after.inVault,true);
            assert.deepEqual(after.guard.xy,[26,5]); assert.equal(after.guard.end,2);
            assert.equal(after.at26,i<2?DOOR:CORR);
        }
    });
    check(part.name+': C doorway cleanup or paired negative', () => {
        if (i<2) {
            assert.equal(after.engraving,null,'C deletes the engraving beyond the opened door');
            assert.equal(states.at(-1).engraving,null);
            assert.ok(!states.some(s=>s.top?.includes('Something is written here in the dust.')));
        } else if (i===2) {
            assert.equal(after.engraving.text,'mar|');
            assert.ok(states.some(s=>s.top?.includes('Something is written here in the dust.')));
        } else if (i===3) {
            assert.equal(before.engraving.text,'mar|'); assert.equal(before.guard.end,1);
        } else assert.equal(states.at(-1).engraving,null);
    });
    rows.push({name:part.name,keys:part.moves.length,boundaries:plain.screens.length,
        calls:plain.calls.length,hashes:liveHashes,deferredHashes:hashes(held),
        before,after,last:states.at(-1)});
}
const report = {classification:'Ordinary source controls; original C output is checked separately',
    passed:results.filter(r=>r.pass).length,total:results.length,results,rows};
// END ORIGINAL CONTROL BODY
// Complete negative output streams must stay fixed, including deferred input.
for (const row of rows.slice(2)) {
    assert.deepEqual(row.hashes,prelock.negativeHashes[row.name]);
    assert.deepEqual(row.deferredHashes,prelock.negativeHashes[row.name]);
}
if (outputPath) fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:report.passed,total:report.total,failures:results.filter(r=>!r.pass)}));
if (report.passed!==report.total) process.exitCode=1;
