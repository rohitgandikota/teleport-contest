// Validate exact tracked C/source evidence before importing any game module.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length <= 3 && (process.argv[2] === undefined
    || (process.argv[2] && !process.argv[2].startsWith('-'))),
    'usage: altar-drop-conduct-input-gate.mjs [new-compact-report.json]; no selectors');
const target = process.argv[2] || null;
assert.ok(!target || !existsSync(target), 'report path must be new');
const repo = new URL('../', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function pinned(path, digest) {
    const bytes = readFileSync(new URL(path, repo));
    assert.equal(sha(bytes), digest, 'exact tracked evidence: ' + path);
    return bytes;
}
const evidence = 'tools/gen-sessions/evidence/altar-drop-conduct/';
const evidencePins = {
    "PROBE-ADAPTATION.md": "3199d1a7e9b95ba66ba7a7756388be2b501521c9d7d9f6a760d5fcbffbb80c3b",
    "README.md": "7d9ac50b3d4f87defc84c2cd90e4f0e0f635e7a4857ee38064318d686b761e39",
    "SOURCE-REVIEW.md": "7b9b18d5b551b4081ceac2adbd6e901f6a967f7d430798debe12c65504f8cb16",
    "baseline-native.json": "02529542a31472fa86d6d4125b34a5f8eb9b89f130ea41cc53209d81d48b8478",
    "candidate-native.json": "f59aa9f105ace02fa7450aa5bd63fb3a10aa10c9673d9f4f34b781beb067d4e1",
    "candidate-ordinary.json": "d55b35dc738c7f32cc9d75f6acf1aa1fdd00a8f00e8d93e4c6ceab069d1b4773",
    "candidate-probe-adaptation.json": "b70623e4decc5ec1d96093085ab7a14de7e4c748fa4c0420b634ab762e1b1b6a",
    "candidate-validation.json": "7903716886607ef995c5934117d7a7fcdbcedf39ca1b1529d17473c21a79320a",
    "input-identity.json": "0cab1271dc9d801870e2ba105a6b39fe2f6ad1f4c0f5610871f04fb449f1a353",
    "native-recording.json": "a32f49a563425d5d7d6e89cfecb53c8984a4dd3d43794a3847f0574e6a14f67f",
    "parent-input-lock.json": "681fce9d212521165920e269bfa7ee28da30bcfd73bd07c45aad940706d3ed39",
    "source/SOURCE-REVIEW.md": "10a9a02f88a766c9f4c1c26789d6020cbe034966db59b290049ce37af5683810",
    "source/baseline-command.json": "114c42dd25a3268a98b92f106d68657feea5b65e2af2894820adb64b3d13e3ce",
    "source/baseline-observation.json": "71608da65f7d670bb36ad013f27e1f9326f7586e2fe34048d8f7cca5ac33c330",
    "source/baseline-runtime.json": "50a18d5fbd3b7c3cb89b049d931e936124b5b89cec61ed195dbc5220985d22a6",
    "source/baseline.log": "81a68a975590b5842d44bda6557d398766f12d7f4f3e5b1f53a38321f4092d55",
    "source/input-lock.json": "c539cd4b2091542bebf91252a76f72c6a5c1b251834c942846f197fc0d9aa342",
    "source/negative-hashes.json": "1460dd965e1c6fe62ea94cb16bd10fe1960b63b9c3d163d79c45b506b940ba21",
    "source/predictions.json": "98499ba1a572d8707da93eb774f131f5439c439f46d139d93786a6788d2f3eb3",
    "source/probe.mjs": "17ad8c38efbf7489ded41870a760c818f16f96bd2ea1111f6c332029242d0dfa",
    "source/producer-origin.json": "b21fcfcfa4b3a0449ef4ed2f680ee5fd5fe98889b121211168e617d75eceaadf",
    "source/source-pins.json": "066a96cae129a75ae55d066be302b70d4a90cf9da5b469f0da2f10b239f0fdc1",
    "source-files.json": "74f2b4b1b294ed62dbef7a0123f99dcb4aa87bc6f185d017543678f25739c85a",
    "source-provenance.json": "5030d6d1e63250bdbff31435cd60e5a91a824d7f7b547e4d171b98042cff301a"
};
for (const [name, digest] of Object.entries(evidencePins)) pinned(evidence + name, digest);
const readEvidence = name => JSON.parse(pinned(evidence + name, evidencePins[name]));
const provenance = readEvidence('source-provenance.json');
const sourceFiles = readEvidence('source-files.json');
assert.equal(evidencePins['source-files.json'], '74f2b4b1b294ed62dbef7a0123f99dcb4aa87bc6f185d017543678f25739c85a');
assert.deepEqual(Object.keys(sourceFiles).sort(), Object.keys(provenance.sourceFilePublicPaths).sort());
for (const [name, digest] of Object.entries(sourceFiles)) pinned(provenance.sourceFilePublicPaths[name], digest);
const recipeBytes = pinned('tools/gen-sessions/recipes/altar-drop-conduct.json',
    'a0fe158c2722f67c8cd33f5764d48ba86a0a35ecf0184926aabb6cd32cc04f28');
const recipe = JSON.parse(recipeBytes);
const lock = readEvidence('source/input-lock.json');
for (const [name, digest] of Object.entries(lock.files)) pinned(provenance.sourceFilePublicPaths[name], digest);
assert.equal(lock.beforeGameplayCAndCandidate, true);
const originalProbe = pinned(evidence + 'source/probe.mjs', lock.probeSHA256).toString();
const predictions = readEvidence('source/predictions.json');
const negative = readEvidence('source/negative-hashes.json');
assert.deepEqual(lock.negativeIndexes, [3, 4, 5]);
assert.deepEqual(Object.keys(negative), recipe.segments.slice(3).map(part => part.name));
assert.equal(Object.values(negative).reduce((n, row) => n + Object.keys(row).length, 0), 15);
const parentLock = readEvidence('parent-input-lock.json');
assert.equal(parentLock.beforeC, true);
assert.equal(parentLock.preserveAllRootMetadata, true);
assert.equal(parentLock.sourceFilesSHA256, evidencePins['source-files.json']);
assert.equal(parentLock.primaryRecipeSHA256, sha(recipeBytes));
assert.equal(parentLock.minimalSHA256, sha(recipeBytes));
assert.equal(parentLock.negativeSHA256, evidencePins['source/negative-hashes.json']);
assert.equal(parentLock.baselineRuntimeSHA256, evidencePins['source/baseline-runtime.json']);
const identity = readEvidence('input-identity.json');
assert.equal(identity.recipeSHA256, sha(recipeBytes));
assert.equal(identity.sourceInputLockSHA256, evidencePins['source/input-lock.json']);
const fields = ['name', 'seed', 'datetime', 'nethackrc', 'moves'];
assert.deepEqual(identity.fields, fields);
const fieldTuple = part => fields.map(field => ({ field, present: Object.hasOwn(part, field),
    ...(Object.hasOwn(part, field) ? { value: part[field] } : {}) }));
const tuples = recipe.segments.map(fieldTuple);
const keys = recipe.segments.map(part => [null, ...part.moves]);
assert.ok(tuples.every(part => part.every(field => field.present)));
assert.equal(sha(JSON.stringify(tuples)), identity.tuplesSHA256);
assert.equal(identity.tuplesSHA256, '9d7614f046d280da22af6342e88f68f2eb84a8fd7260cb696222757feb192dd4');
assert.equal(sha(JSON.stringify(keys)), identity.allKeysSHA256);
assert.equal(identity.allKeysSHA256, '6a791af8b13a176e7aea75383fe8e4b90fbd24068a11dbcbb1fd663c73f73108');
assert.equal(recipe.segments.length, 6);
assert.equal(recipe.segments.reduce((n, part) => n + part.moves.length, 0), 284);
assert.equal(keys.flat().length, 290);
const rawBytes = pinned('tools/gen-sessions/generated/altar-drop-conduct.session.json',
    '36def34578ebf169073b7d9c349a7a797967c32e47402dfdc25fb82463b52d0e');
assert.equal(rawBytes.length, 862551);
const raw = JSON.parse(rawBytes);
assert.equal(raw.source, 'c');
assert.equal(raw.version, 5);
assert.equal(raw.segments.length, 6);
assert.deepEqual(Object.keys(raw).filter(k => k !== 'segments').sort(), Object.keys(recipe).filter(k => k !== 'segments').sort());
for (const key of Object.keys(recipe)) if (key !== 'segments') assert.deepEqual(raw[key], recipe[key]);
assert.deepEqual(raw.segments.map(fieldTuple), tuples);
assert.deepEqual(raw.segments.map(part => part.steps.map(step => step.key)), keys);
assert.deepEqual(recordingIntegrityErrors(raw), []);
assert.equal(recipe.requireBranchAssertions, true);
assert.deepEqual(recipe.branchAssertions.map(row => row.segment), [0, 1, 2, 3, 4, 5]);
assert.deepEqual(recipe.branchAssertions.map(row => row.branch), recipe.branches);
assert.deepEqual(branchAssertionErrors(recipe), []);
assert.deepEqual(branchAssertionErrors(recipe, raw), []);
const recording = readEvidence('native-recording.json');
assert.equal(recording.rawSha256, sha(rawBytes));
assert.equal(recording.primaryRecipeSHA256, sha(recipeBytes));
assert.equal(recording.cExecutedOnce, true);
assert.equal(recording.fiveInputFieldsAndPresencePreserved, true);
assert.equal(recording.allKeysExact, true);

// Preserve inherited failures/proof without using saved states as live observations.
const baseline = readEvidence('source/baseline-observation.json');
const expected = readEvidence('candidate-ordinary.json');
const baselineNative = readEvidence('baseline-native.json');
const candidateNative = readEvidence('candidate-native.json');
const validation = readEvidence('candidate-validation.json');
assert.equal(validation.ordinaryReportSHA256, evidencePins['candidate-ordinary.json']);
assert.equal(validation.nativeReportSHA256, evidencePins['candidate-native.json']);
assert.equal(validation.baselineNativeReportSHA256, evidencePins['baseline-native.json']);
assert.equal(validation.rawSHA256, sha(rawBytes));
assert.equal(expected.recipeSHA256, sha(recipeBytes));
assert.equal(expected.runtimeSHA256, provenance.candidateRuntimeSHA256);
assert.equal(baseline.runtimeSHA256, provenance.sourceBaselineRuntimeSHA256);
const historicalFailures = baseline.rows.flatMap((row, index) => row.checks.filter(check => !check.pass)
    .map(check => [index, check.name]));
assert.deepEqual(historicalFailures, [0, 1, 2].flatMap(index =>
    ['C first-drop conduct log', 'C chronicle visibility'].map(name => [index, name])));
assert.equal(expected.rows.length, 6);
assert.ok(expected.rows.every(row => row.checks.length === 7 && row.checks.every(check => check.pass)));
const exactNative = row => row.fullStyleExact && row.frozenScreenCursorExact && row.fullRngExact && row.animationExact;
assert.equal(baselineNative.length, 6);
assert.equal(candidateNative.length, 6);
assert.equal(baselineNative.filter(exactNative).length, 3);
assert.ok(candidateNative.every(exactNative));
for (const index of [3, 4, 5]) {
    assert.deepEqual(candidateNative[index], baselineNative[index]);
    assert.deepEqual(expected.rows[index], baseline.rows[index]);
    assert.deepEqual(expected.rows[index].hashes, negative[expected.rows[index].name]);
}
const adaptation = readEvidence('candidate-probe-adaptation.json');
const startMarker = 'const ' + 'phrase = ';
const endMarker = '// ' + 'END ORIGINAL ASSERTION BODY\n';
const originalBody = originalProbe.slice(originalProbe.indexOf(startMarker), originalProbe.indexOf('const ' + 'report = '));
const installedGate = readFileSync(new URL(import.meta.url), 'utf8');
const installedBody = installedGate.slice(installedGate.indexOf(startMarker), installedGate.indexOf(endMarker));
assert.equal(installedBody, originalBody, 'all original42 assertion bodies unchanged');
assert.equal(sha(installedBody), adaptation.originalAssertionBodySHA256);
assert.equal(adaptation.originalChecks, 42);

// Maintained data/observer dependencies are pinned; no historical runtime is loaded.
pinned('tools/gen-sessions/assertions.mjs', 'aed2dfe01e18cb2e8b0d62e389ab9d8a9c02b0e3e98d4e427fcead4c228e3adc');
pinned('tools/gen-sessions/screen-decode.mjs', '0831fd4db121dab1d3c8f80efac29c68ce50f67fedbb49f2bd7c21371244dae0');
pinned('tools/half-damage-reader-observe.mjs', '201cdafe4409d5d58414c1d0ebc0449c32b29834cdf35c72c151a555d9031d07');
pinned('frozen/screen-decode.mjs', 'cb4a0fbfed3dda28c14736e6ae9c8b9eb8c87d75916c50d6df80f40eb0368cbe');
// All gameplay imports follow the exact C/source/input/primary preflight.
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {ONAMES} = await import('../js/objects_data.js');
const {ALTAR, LL_CONDUCT} = await import('../js/const.js');
const {Blind} = await import('../js/youprop.js');
const {decodeScreen, renderCell} = await import('../frozen/screen-decode.mjs');
const {outputs, hashes, deferred} = await import('./half-damage-reader-observe.mjs');

const phrase = 'eschewed atheism, by dropping';
const object = o => ({id:o.o_id, type:o.otyp, quantity:o.quan, letter:o.invlet,
    blessed:!!o.blessed, cursed:!!o.cursed, known:!!o.bknown});
const rows = [];
for (const [index, part] of recipe.segments.entries()) {
    const prediction = predictions[index];
    const types = prediction.types.map(name => ONAMES[name]);
    assert.ok(types.every(Number.isInteger));
    const states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (!g.u || !g.level) return;
            states.push({step, turn:g.moves, hp:g.u.uhp, mortality:g.u.umortality || 0,
                terrain:g.level.at(g.u.ux, g.u.uy).typ, blind:!!Blind(),
                gnostic:g.u.uconduct?.gnostic || 0,
                inventory:g.invent.filter(o => types.includes(o.otyp)).map(object),
                floor:g.level.objects.filter(o => o.ox === g.u.ux && o.oy === g.u.uy
                    && types.includes(o.otyp)).map(object),
                logs:(g.gamelog || []).filter(e => e.text.startsWith(phrase))
                    .map(e => ({flags:e.flags, turn:e.turn, text:e.text}))});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const output = structuredClone(outputs(run));
    const streamHashes = hashes(output);
    const before = states.find(s => s.step === prediction.beforeDrop);
    const after = states.find(s => s.step === prediction.afterDrop);
    const last = states.at(-1);
    const texts = output.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    const checks = [];
    const check = (name, test) => {
        try { test(); checks.push({name,pass:true}); }
        catch (error) { checks.push({name,pass:false,error:error.message}); }
    };
    check('real altar, item and perception setup', () => {
        assert.ok(before && before.hp > 0);
        assert.equal(before.terrain === ALTAR, prediction.altar);
        assert.equal(before.blind, prediction.blind);
        assert.equal(before.gnostic, 0);
        assert.deepEqual(before.logs, []);
        assert.deepEqual(before.inventory.map(o => o.type).sort((a,b) => a-b),
            [...types].sort((a,b) => a-b));
    });
    check('drop ownership, conduct counter and turns', () => {
        assert.ok(after && after.hp > 0);
        assert.equal(after.gnostic, prediction.gnostic);
        assert.equal(after.turn - before.turn, prediction.turns);
        assert.deepEqual(after.inventory, []);
        assert.deepEqual(after.floor.map(o => o.id).sort((a,b) => a-b),
            before.inventory.map(o => o.id).sort((a,b) => a-b));
        if (index === 3) assert.ok(after.floor.every(o => !o.blessed && !o.cursed));
        if (index === 4) assert.equal(after.floor[0].known, before.inventory[0].known);
    });
    check('C first-drop conduct log', () => {
        assert.equal(after.logs.length, prediction.logs);
        if (prediction.logs) {
            assert.equal(after.logs[0].flags, LL_CONDUCT);
            assert.equal(after.logs[0].turn, before.turn);
            assert.ok(after.logs[0].text.includes('apple'));
            assert.ok(after.logs[0].text.endsWith(' on an altar'));
        }
        assert.deepEqual(last.logs, after.logs);
    });
    check('C chronicle visibility', () => {
        assert.ok(texts.some(text => text.includes('Logged events:')));
        assert.equal(texts.some(text => text.includes(phrase)), prediction.logs > 0);
    });
    check('survival, boundaries and random slices', () => {
        assert.ok(states.every(s => s.hp > 0 && !s.mortality));
        assert.equal(last.step, part.moves.length);
        assert.equal(output.screens.length, part.moves.length + 1);
        assert.deepEqual(output.slices.flat(), output.calls);
    });
    const plain = outputs(await runSegment({...part, storage:new InMemoryStorage()}));
    check('observer preserves five streams', () => assert.deepEqual(hashes(plain), streamHashes));
    const delayed = await deferred(part);
    check('deferred input preserves five streams', () => assert.deepEqual(hashes(delayed), streamHashes));
    rows.push({name:part.name, checks, before, after, last, hashes:streamHashes,
        keys:part.moves.length, boundaries:output.screens.length,
        calls:output.calls.length, frames:output.frames.flat().length});
}
// END ORIGINAL ASSERTION BODY
const report = {recipeSHA256:sha(recipeBytes), rows};
if (target) writeFileSync(target, JSON.stringify(report,null,2)+'\n', {flag:'wx'});
const failures = rows.flatMap(row => row.checks.filter(check => !check.pass)
    .map(check => ({case:row.name,...check})));
console.log(JSON.stringify({cases:rows.length, checks:42, failures, nativeProof:'inherited6/6'}));
if (failures.length) process.exitCode = 1;
assert.equal(LL_CONDUCT, 0x20);
assert.deepEqual(rows, expected.rows, 'fresh complete rows equal fixed candidate proof');
for (const index of [3, 4, 5]) {
    assert.deepEqual(rows[index], baseline.rows[index], 'complete negative ordinary row');
    assert.deepEqual(rows[index].hashes, negative[rows[index].name], 'all15 negative hashes');
}
for (const index of [0, 1, 2]) assert.deepEqual(rows[index].after.logs,
    [{flags:0x20, turn:1, text:'eschewed atheism, by dropping an apple on an altar'}]);
