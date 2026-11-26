// Ordinary keyboard checks for C quaff entry and unchanged-effect feedback.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const evidence = new URL('gen-sessions/evidence/potion-entry-feedback/', import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const reportPath = process.argv[2] || null;
assert.ok(process.argv.length <= 3 && (!reportPath || !reportPath.startsWith('-')));
assert.ok(!reportPath || !existsSync(reportPath), 'report must be new');
const pins = {
    "source-input-lock.json": "8cea90a99da24b454520ec0bff45f4bc265fa6b61f4e8fecd68b3c9521b18598",
    "parent-input-lock.json": "a15d7896edbc5111713d48fe9af81ef1078dc6077280133a1066c10aae44137a",
    "baseline-ordinary.json": "4dd4063992467f14ff20bf274969a85640b54b0a47cf962898b9fd7c5d136eda",
    "candidate-ordinary.json": "8d2825ffc8e78a36d72384e51589a5086e165df9a75e18a110b7307f1dbde7c2",
    "native-baseline.json": "eecfaad962f07da55c693f98a23c7b45a34dff9ee5a3a55c1a90f9b1fdce3baa",
    "native.json": "e50ddab2b0a3ea436aeecbf5ce4f7af8876c62be006608578a4d51eeda4df508",
    "candidate-composition.json": "0bdcb299bceeb18e7237cb487d773239cb00a3afd3454614874a12f789451038",
    "candidate-validation.json": "04680ae2139f653a6ae8f784b081119a2e53f658cc1868b5b3590917b0b870ca",
    "recording.json": "81e0c1c99e68f9919515803ba865fdead44185e011a3ea9a62220cc1eb3c495c",
    "minimal-input.json": "a01843a91120ba9e12200443a2da3d47e8bb13b32d5e2f93323a76fcd3ae7118",
    "negative-hashes.json": "25cb4c73232765926c00b883ec27e17e905c2af735c314f4522603398a4ab1af",
    "predictions.json": "e54428c255437d6c4a0dbd4b74e056401daaae5e9374e5e9103fd1d4b020c8e6"
};
function read(name) {
    const bytes = readFileSync(new URL(name, evidence));
    assert.equal(sha(bytes), pins[name], name);
    return JSON.parse(bytes);
}
for (const name of Object.keys(pins)) read(name);
const lock = read('source-input-lock.json');
assert.equal(sha(readFileSync(new URL('source-original.mjs', evidence))), lock.probeSHA256);
const predictions = read('predictions.json');
assert.equal(pins['predictions.json'], lock.predictionsSHA256);
const beforeC = read('parent-input-lock.json');
const baseline = read('baseline-ordinary.json');
const recording = read('recording.json');
const negative = read('negative-hashes.json');
const recipeBytes = readFileSync(new URL('gen-sessions/recipes/potion-entry-feedback.json', import.meta.url));
assert.equal(sha(recipeBytes), lock.recipeSHA256);
assert.equal(sha(recipeBytes), beforeC.primaryRecipeSHA256);
const recipe = JSON.parse(recipeBytes);
const rawBytes = readFileSync(new URL('gen-sessions/generated/potion-entry-feedback.session.json', import.meta.url));
assert.equal(sha(rawBytes), 'a4382e966fe5498849f77a906b14c9c24ff9496552fc42a2a4a1c14a59bb0952');
const raw = JSON.parse(rawBytes);
assert.equal(raw.source, 'c');
assert.equal(raw.version, 5);
assert.equal(raw.segments.length, 6);
assert.equal(recording.exit, 0);
assert.equal(recording.cExecutedOnce, true);
assert.equal(recording.rawSha256, sha(rawBytes));
assert.equal(recording.cPin, '16ff59115315917b93185d026aeefea06db9b0f4');
assert.equal(recording.binarySha256, 'ba4dbc1c823f8d4b0cfb6fd594d00ff0ff5754daaaa2036bee15baeffdf85aa7');
assert.equal(recording.recorderSha256, 'b129caee2ca3941b30c36f5c26644bd37ff610344332eb511c474b8709b70648');
assert.equal(recording.inputSHA256, beforeC.minimalInputSHA256);
assert.equal(recording.primaryRecipeSHA256, beforeC.primaryRecipeSHA256);
const tuple = s => ['name','seed','datetime','nethackrc','moves'].map(f => [f,Object.hasOwn(s,f),s[f]]);
assert.deepEqual(raw.segments.map(tuple), recipe.segments.map(tuple));
for (const [i, part] of recipe.segments.entries())
    assert.deepEqual(raw.segments[i].steps.map(s => s.key), [null,...part.moves]);
assert.deepEqual(recordingIntegrityErrors(raw), []);
assert.deepEqual(branchAssertionErrors(recipe, raw), []);
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {ONAMES} = await import('../js/objects_data.js');
const {Hallucination, Confusion} = await import('../js/youprop.js');
const {decodeScreen, renderCell} = await import('../frozen/screen-decode.mjs');
const {outputs, hashes, deferred} = await import('./half-damage-reader-observe.mjs');
const rows = [];
for (const [index, part] of recipe.segments.entries()) {
    const states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            states.push({step, turn:g.moves, hp:g.u.uhp, strangled:g.u.intrinsic?.HStrangled || 0,
                hallucinating:!!Hallucination(), confused:!!Confusion(),
                potionNothing:g.potion_nothing || 0, wornAmulet:g.u.uamul?.otyp ?? null,
                inventory:g.invent.map(o => ({type:o.otyp,quantity:o.quan,letter:o.invlet}))});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const output = structuredClone(outputs(run)), streamHashes = hashes(output);
    const before = states.find(s => s.step === predictions.actionStart[index]);
    const after = states.at(-1), checks = [];
    const text = decodeScreen(output.screens.at(-1))
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n');
    const check = (name, test) => {
        try { test(); checks.push({name,pass:true}); }
        catch (error) { checks.push({name,pass:false,error:error.message}); }
    };
    check('real producer setup', () => {
        assert.ok(before && before.hp > 0);
        if (index < 2) {
            assert.ok(before.strangled > 0);
            assert.equal(before.wornAmulet,ONAMES.AMULET_OF_STRANGULATION);
        } else {
            assert.equal(before.strangled,0);
            if (index === 2) assert.ok(before.inventory.some(o => o.type === ONAMES.POT_HEALING));
            if (index === 3) {
                assert.equal(before.wornAmulet,null);
                assert.ok(before.inventory.some(o => o.type === ONAMES.AMULET_OF_STRANGULATION));
            }
            if (index >= 4) {
                assert.equal(before.hallucinating,index === 4);
                assert.equal(before.confused,index === 5);
                assert.ok(before.inventory.some(o => o.quantity === 1 && o.type ===
                    (index === 4 ? ONAMES.POT_HALLUCINATION : ONAMES.POT_CONFUSION)));
            }
        }
    });
    check('C entry or effect feedback', () => assert.ok(text.includes(predictions.expectedMessages[index])));
    check('command effect and turn contract', () => {
        if (index < 4) {
            assert.equal(after.turn,before.turn);
            assert.deepEqual(after.inventory,before.inventory);
        } else {
            assert.ok(after.potionNothing > 0);
            assert.equal(after.hallucinating,index === 4);
            assert.equal(after.inventory.length,0);
        }
    });
    check('all boundaries and ordered random slices', () => {
        assert.equal(after.step,part.moves.length);
        assert.equal(output.screens.length,part.moves.length+1);
        assert.deepEqual(output.slices.flat(),output.calls);
    });
    const plain = outputs(await runSegment({...part, storage:new InMemoryStorage()}));
    check('observer preserves five streams', () => assert.deepEqual(hashes(plain),streamHashes));
    const delayed = await deferred(part);
    check('deferred input preserves five streams', () => assert.deepEqual(hashes(delayed),streamHashes));
    rows.push({name:part.name,checks,before,after,hashes:streamHashes,finalText:text,
        keys:part.moves.length,boundaries:output.screens.length,calls:output.calls.length,
        frames:output.frames.flat().length});
}
const failures = rows.flatMap(r => r.checks.filter(c => !c.pass).map(c => ({case:r.name,...c})));
for (const index of [2, 3, 5]) {
    assert.deepEqual(rows[index], baseline.rows[index], 'complete negative row');
    assert.deepEqual(rows[index].hashes, negative[rows[index].name], 'original negative hashes');
}
const report = {classification:'C quaff entry and unchanged-effect feedback',rows};
if (reportPath) writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:rows.length,checks:rows.reduce((n,r) => n+r.checks.length,0),failures}));
if (failures.length) process.exitCode = 1;
