// C trap.c4233-4314: chest fire does not burn or ignite floor objects.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.ok(process.argv.length <= 3 && !process.argv[2]?.startsWith('--'),
    'usage: dofiretrap-chest-floor-gate.mjs [new-report.json]');
const reportPath = process.argv[2];
assert.ok(!reportPath || !existsSync(reportPath), 'report must be a new file');
const evidence = new URL('gen-sessions/evidence/dofiretrap-chest-floor/', import.meta.url);
const evidencePins = {
    "README.md": "f4344c6b354031ba38b310d074d493878dc96152de7809f903738f088b8d314a",
    "SOURCE-REVIEW.md": "cd73673c83509e6083ecfabaa37e6c262dfd67ecc33438686129124b65825e8a",
    "baseline-native.json": "54ebe8e57e64a1e67363e6a6942c6eeaecce8813934888e0e1d9375afb3ef291",
    "baseline-observation.json": "a7ebd3385cb4c00fef8f56d01fa5884aa2d83e3b3f32998a732d77f6808da7bb",
    "candidate-checks.json": "4f2be642f10bb8e83405db3fa6a94d233dc315753509015760af4232d67ccaa3",
    "candidate-native.json": "8a0bbebb2a0a2135c5440c64a8cc8b18834d83b1e5b28217442f1f3859c07fb6",
    "candidate-observation.json": "6aa421ef394f9299cd3afe6599bfd7cdb1cded1580d57b54d4334fc9af010dda",
    "candidate-seal.json": "5c35f5d72729d6dd34bf50a42627d9774e5bec885e42566bbdb5366d559d32f8",
    "candidate-worker.json": "fa6e1f421aa4b413a84523108f42e369c1d9dbd6b62224ac7bf0ae1f3ad6d8bf",
    "coverage-correction.json": "69030cf7c179f283a16fe09adabb55d3c3c42f66cfdae135394eef432c85821e",
    "derivation.json": "e070975f973453383c6c436388aa1908511f52eeeb41bd092138a6b8d37a9721",
    "input-lock.json": "6a3f746f51cf2abd70a32d34466ec0a1914ef7dd19c836580e508838d48f1e14",
    "negative-hashes.json": "34350eaeb9f0cccc2857a5c19f642415cf9ec382654e59f571a43ebb40c1e0f5",
    "ordinary-original.mjs": "9f11173b0a3cbd82a2d87c83dffa65c3c996fad12d29fd09debd1d20248a6c7e",
    "original-recipe.json": "21764f1c38c3ddd93ca402da2dccac75b09d0ac48b601390757badfc7282ecbd",
    "original-source-review.json": "ce82376070b4145640da99871bf6e7c4ffa1a8fa2657302c3e3e8247bd587c51",
    "parent-input-lock.json": "df1e5351a7627d65476bc385ce2869be97c67fad66a2036157f217b68cbac1e1",
    "parent-preflight.json": "e16989b09f7b81eaa9b799550df19d7e2a77babeed1fd33ba2dbf2af450d4fd7",
    "portable-first-attempt.log": "4263f94a6d960da2a8908c96e627f8fb456beed732ebd096a1f76e72d27cb06e",
    "portable-serialization-diagnostic.json": "3b70d2e362aba81915eb14058c272c402e85e69a6ed63add112707a6ae7e328c",
    "predictions.json": "308999f0ab6195ea7b41169c192cd569d7cbdb85b0d561e4a8f47014cb5f538f",
    "recording-receipt.json": "8a1cc18f745646fcdca48d4d69135e7db725474042ca3ac9c823024993c47205",
    "retained-checks.json": "179db29f7ffadd8ca23f1d3cb32d7262388737c5261f4af30c36ecea6b8bc3d1",
    "source-batch-receipt.json": "024c1261fa51d6e0d9497d5a9e7a657daa23b6a53e54faa5115a3b3d5fe1f65e",
    "source-pins.json": "629879abc900c6a13c7d392daa633f4f439e04b434791fc39a9f080abadff75c",
    "source-ranges.json": "421106229d0e9590dee0cebb63d1fd0e7372937645c59208a8f14d67c432918b",
    "source-seal.json": "da788716cafe30043538a5aa22f5b942f961ec71a2434357d2cfbeaed391969e",
    "source-summary.json": "c54b94cc7f04f17d9e95c85a92ae9ff5f0d805894859666e3b6d6cfabb18496b"
};
for (const [name, digest] of Object.entries(evidencePins))
    assert.equal(sha(readFileSync(new URL(name,evidence))),digest,name);
const supportPins = {
    "half-damage-reader-observe.mjs": "201cdafe4409d5d58414c1d0ebc0449c32b29834cdf35c72c151a555d9031d07",
    "gen-sessions/assertions.mjs": "aed2dfe01e18cb2e8b0d62e389ab9d8a9c02b0e3e98d4e427fcead4c228e3adc",
    "gen-sessions/screen-decode.mjs": "0831fd4db121dab1d3c8f80efac29c68ce50f67fedbb49f2bd7c21371244dae0",
    "../frozen/screen-decode.mjs": "cb4a0fbfed3dda28c14736e6ae9c8b9eb8c87d75916c50d6df80f40eb0368cbe"
};
for (const [name,digest] of Object.entries(supportPins))
    assert.equal(sha(readFileSync(new URL(name,import.meta.url))),digest,name);
const read = name => JSON.parse(readFileSync(new URL(name,evidence)));
const lock = read('input-lock.json'), correction = read('coverage-correction.json');
const sourceSeal = read('source-seal.json'), candidateSeal = read('candidate-seal.json');
const parentLock = read('parent-input-lock.json'), receipt = read('recording-receipt.json');
const recipeBytes = readFileSync(new URL('gen-sessions/recipes/dofiretrap-chest-floor.json',import.meta.url));
const recipeSHA256 = sha(recipeBytes);
assert.equal(recipeSHA256,'b7c21e9f46180cbd8546ec60f062accc5571de0a33679c494f1df511423a9eda');
const originalBytes = readFileSync(new URL('original-recipe.json',evidence));
assert.equal(sha(originalBytes),lock.files['recipe.json']);
assert.equal(sha(originalBytes),sourceSeal.recipeSHA256);
assert.equal(sha(originalBytes),correction.originalRecipeSHA256);
assert.equal(recipeBytes.toString(),originalBytes.toString().replace('"items.containers"','"object.tools-containers"'));
assert.equal(correction.primaryRecipeSHA256,recipeSHA256);
assert.equal(correction.beforeC,true); assert.ok(correction.createdAt < receipt.startedAt);
assert.equal(receipt.exit,0); assert.equal(receipt.cExecutedOnce,true);
assert.equal(parentLock.metadataCorrectionSHA256,evidencePins['coverage-correction.json']);
for (const proof of [parentLock,receipt]) {
    assert.equal(proof.sourceSealSHA256,evidencePins['source-seal.json']);
    assert.equal(proof.primaryRecipeSHA256,recipeSHA256);
}
assert.equal(candidateSeal.originalSourceSealSHA256,evidencePins['source-seal.json']);
assert.equal(candidateSeal.recipeSHA256,recipeSHA256);
const recipe = JSON.parse(recipeBytes), predictions = read('predictions.json');
assert.deepEqual(lock.fields,['name','seed','datetime','nethackrc','moves']);
const tuples = parts => parts.map(part => lock.fields.map(field =>
    ({field,present:Object.hasOwn(part,field),...(Object.hasOwn(part,field)?{value:part[field]}:{})})));
assert.deepEqual(tuples(recipe.segments),lock.tuples);
assert.equal(Object.hasOwn(recipe.segments[1],'name'),false);
const rawBytes = readFileSync(new URL('gen-sessions/generated/dofiretrap-chest-floor.session.json',import.meta.url));
const rawSHA256 = sha(rawBytes);
assert.equal(rawSHA256,'e822528540fa739189e0743021e04c0f7f5c851e952ad11e4fca683c1fedcfef');
assert.equal(rawBytes.length,441203); assert.equal(receipt.rawSha256,rawSHA256);
assert.equal(candidateSeal.rawSHA256,rawSHA256);
const native = JSON.parse(rawBytes);
assert.equal(native.source,'c'); assert.equal(native.version,5);
assert.equal(native.segments.length,3); assert.equal(recipe.branchAssertions.length,3);
assert.deepEqual(tuples(native.segments),lock.tuples);
for (const key of Object.keys(recipe)) if (key !== 'segments') {
    assert.ok(Object.hasOwn(native,key)); assert.deepEqual(native[key],recipe[key]);
}
for (const [i,part] of recipe.segments.entries()) {
    assert.deepEqual([...part.moves].map(c=>c.charCodeAt(0)),lock.keys[i]);
    assert.deepEqual(native.segments[i].steps.map(s=>s.key),[null,...part.moves]);
}
assert.equal(recipe.segments.reduce((n,p)=>n+p.moves.length,0),156);
assert.equal(native.segments.reduce((n,p)=>n+p.steps.length,0),159);
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(recipe,native),[]);
const sourceRows = read('baseline-observation.json'), candidateRows = read('candidate-observation.json');
const nativeBefore = read('baseline-native.json'), nativeAfter = read('candidate-native.json');
const exact = row => row.fullStyleExact && row.frozenScreenCursorExact && row.fullRngExact && row.animationExact;
assert.equal(sourceRows.flatMap(r=>r.checks).filter(c=>c.pass).length,25);
assert.equal(candidateRows.flatMap(r=>r.checks).filter(c=>c.pass).length,27);
assert.equal(nativeBefore.filter(exact).length,2); assert.ok(nativeAfter.every(exact));
assert.equal(candidateSeal.nativeReportSHA256,evidencePins['candidate-native.json']);
for (const i of [1,2]) {
    assert.deepEqual(sourceRows[i],candidateRows[i]); assert.deepEqual(nativeBefore[i],nativeAfter[i]);
}
assert.deepEqual([1,2].map(index=>({index,outputHashes:sourceRows[index].outputHashes})),read('negative-hashes.json'));
const original = readFileSync(new URL('ordinary-original.mjs',evidence),'utf8');
const derivation = read('derivation.json');
const originalBody = original.slice(original.indexOf(derivation.start),original.indexOf(derivation.end));
assert.equal(sha(originalBody),derivation.bodySHA256);
const self = readFileSync(new URL(import.meta.url),'utf8');
const currentBody = self.slice(self.indexOf('\nconst snapshotObject =')+1,self.indexOf('\n// End preserved source assertions.'));
assert.equal(currentBody,originalBody);

// Tested current-repository modules are imported only after the complete preflight.
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {ONAMES} = await import('../js/objects_data.js');
const {decodeScreen, renderCell} = await import('../frozen/screen-decode.mjs');
const {outputs, hashes, deferred} = await import('./half-damage-reader-observe.mjs');
const snapshotObject = o => ({id: o.o_id, type: o.otyp, letter: o.invlet,
    where: o.where, lit: !!o.lamplit, age: o.age, cursed: !!o.cursed,
    trapped: !!o.otrapped, locked: !!o.olocked, xy: [o.ox, o.oy]});
const rows = [];
for (const [index, part] of recipe.segments.entries()) {
    const p = predictions[index], states = [], checks = [];
    const check = (kind, name, fn) => {
        try { fn(); checks.push({kind, name, pass: true}); }
        catch (error) { checks.push({kind, name, pass: false, error: error.message}); }
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            if (!g.u || !g.level) return;
            states.push({step, turn: g.moves, hp: g.u.uhp, maxHp: g.u.uhpmax,
                mortality: g.u.umortality || 0, gameover: !!g.program_state?.gameover,
                xy: [g.u.ux, g.u.uy], inventory: (g.invent || []).map(snapshotObject),
                floor: g.level.objectsAt(g.u.ux, g.u.uy).map(snapshotObject)});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const out = structuredClone(outputs(run));
    const texts = out.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    const before = states.find(s => s.step === p.before), after = states.at(-1);
    const lamp = state => state?.[p.lampWhere].find(o => o.type === ONAMES.OIL_LAMP);
    const chest = state => state?.[p.chestWhere].find(o => o.type === ONAMES.CHEST);
    const actionTexts = texts.slice(p.before + 1);
    const has = text => actionTexts.some(s => s.includes(text));
    check('producer', 'starting uncursed lamp is unlit and fueled at the selected location', () => {
        assert.ok(lamp(before)); assert.equal(lamp(before).lit, false);
        assert.equal(lamp(before).cursed, false); assert.ok(lamp(before).age > 0);
    });
    check('producer', 'actual trapped unlocked chest occupies the selected location', () => {
        assert.ok(chest(before)); assert.equal(chest(before).trapped, true);
        assert.equal(chest(before).locked, false);
    });
    check('producer', 'actual fire dispatch matches the predeclared action', () => {
        assert.equal(has('A tower of flame bursts from the chest!'), p.fire);
        assert.equal(has('You trigger a trap!'), p.fire);
    });
    check('producer', 'all inputs finish without death or relocation', () => {
        assert.equal(after.step, part.moves.length); assert.equal(out.screens.length, part.moves.length + 1);
        assert.deepEqual(out.slices.flat(), out.calls);
        assert.ok(states.every(s => s.hp > 0 && !s.mortality && !s.gameover));
        assert.deepEqual(after.xy, before.xy);
    });
    check('source', 'chest fire preserves ground fuel and may ignite carried fuel', () => {
        assert.ok(lamp(after)); assert.equal(lamp(after).id, lamp(before).id);
        assert.equal(lamp(after).lit, p.lampLitAfter);
    });
    check('source', 'lamp ignition feedback agrees with the source item path', () => {
        assert.equal(has('catches light!'), p.lampLitAfter);
    });
    check('source', 'opening spends only the chest trap; look preserves it', () => {
        assert.ok(chest(after)); assert.equal(chest(after).trapped, !p.fire);
    });
    const plain = structuredClone(outputs(await runSegment({...part, storage: new InMemoryStorage()})));
    const delayed = await deferred(part);
    check('neutrality', 'passive observation preserves all five streams', () => assert.deepEqual(out, plain));
    check('neutrality', 'deferred input preserves all five streams', () => assert.deepEqual(out, delayed));
    rows.push({index, negative: p.negative, checks, before, after,
        producer: checks.filter(c => c.kind === 'producer').every(c => c.pass),
        source: checks.filter(c => c.kind === 'source').every(c => c.pass),
        statesSHA256: sha(JSON.stringify(states)), outputHashes: hashes(out),
        actionCalls: out.slices.slice(p.before + 1).flat(), boundaries: out.screens.length,
        calls: out.calls.length, frames: out.frames.flat().length});
}
// End preserved source assertions.
// Saved observations use JSON: absent inventory coordinates serialize as null.
for (const i of [1,2])
    assert.deepEqual(JSON.parse(JSON.stringify(rows[i])),sourceRows[i],`complete negative row ${i}`);
const checks = rows.flatMap(row=>row.checks);
const summary = {cases:3,setups:rows.filter(row=>row.producer).length,
    checks:checks.filter(c=>c.pass).length,total:27,
    neutrality:checks.filter(c=>c.kind==='neutrality' && c.pass).length,
    negativeHashes:10,completeNegativeRows:2,primaryCAssertions:3,
    absentNameIndex:1,keys:156,boundaries:159,rawSHA256,recipeSHA256};
if (reportPath) writeFileSync(reportPath,JSON.stringify({summary,rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(summary));
if (summary.checks !== 27 || summary.neutrality !== 6) process.exitCode = 1;
