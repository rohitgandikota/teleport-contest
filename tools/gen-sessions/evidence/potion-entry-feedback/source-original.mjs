import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root = new URL('./', import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const read = name => JSON.parse(readFileSync(new URL(name, root)));
const lock = read('input-lock.json');
assert.equal(sha(readFileSync(new URL(import.meta.url))), lock.probeSHA256);
const recipeBytes = readFileSync(new URL('recipe.json', root));
const predictionsBytes = readFileSync(new URL('predictions.json', root));
assert.equal(sha(recipeBytes), lock.recipeSHA256);
assert.equal(sha(predictionsBytes), lock.predictionsSHA256);
const recipe = JSON.parse(recipeBytes), predictions = JSON.parse(predictionsBytes);
const runtimeBytes = readFileSync(new URL('baseline-runtime.json', root));
assert.equal(sha(runtimeBytes), lock.runtimeSHA256);
for (const [name, expected] of Object.entries(JSON.parse(runtimeBytes)))
    assert.equal(sha(readFileSync(new URL('baseline/' + name, root))), expected, name);
for (const [name, expected] of Object.entries(lock.sourcePins))
    assert.equal(sha(readFileSync(name)), expected, name);
const reportPath = new URL('baseline-observation.json', root);
assert.ok(!existsSync(reportPath));
const {runSegment} = await import('./baseline/js/jsmain.js');
const {InMemoryStorage} = await import('./baseline/js/storage.js');
const {ONAMES} = await import('./baseline/js/objects_data.js');
const {Hallucination, Confusion} = await import('./baseline/js/youprop.js');
const {decodeScreen, renderCell} = await import('./baseline/frozen/screen-decode.mjs');
const {outputs, hashes, deferred} = await import('./baseline/tools/half-damage-reader-observe.mjs');
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
const report = {recipeSHA256:lock.recipeSHA256,runtimeSHA256:lock.runtimeSHA256,rows};
writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const failures = rows.flatMap(r => r.checks.filter(c => !c.pass).map(c => ({case:r.name,...c})));
console.log(JSON.stringify({cases:rows.length,checks:rows.reduce((n,r) => n+r.checks.length,0),failures}));
if (failures.length) process.exitCode = 1;
