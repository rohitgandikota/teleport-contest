// C weapon.c705-742 select_hwep: the hero's actual primary slot controls Balrog preference.
// Fresh real keyboard producers; source assertions and complete negative rows are preserved.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
const hash = value => sha(JSON.stringify(value));
assert.ok(process.argv.length <= 3 && !process.argv[2]?.startsWith('--'),
    'usage: balrog-weapon-gate.mjs [new-report.json]');
const reportPath = process.argv[2];
assert.ok(!reportPath || !existsSync(reportPath), 'report must be a new file');
const evidence = new URL('gen-sessions/evidence/balrog-weapon/', import.meta.url);
const evidencePins = {
    "README.md": "64aa55d87d7daa8a68ebdb567ae95976cba5453b2ea3a4b32199b1b9f506ed7d",
    "baseline-native.json": "1bef4011306b9871d45b45035e1d737f8277e67dcdc5c33c39df70d5bf72a1b8",
    "baseline-observation.json": "ba6bead856bb5d4a14f0b1339193ada9e57e1f3848208e82901a77a77a5c0295",
    "candidate-native.json": "3391d2eec6286ee077d4cecc4e29ed5f49abb552d98d858092cbbde43ac4db68",
    "candidate-observation.json": "fdddb986a77ba6efd7316d982d64ad0acef932ffea609dc605922ee2fbf52638",
    "candidate-seal.json": "dd74b63c892dbba8b28d38682fa026d8729ab38973a6f0c5f738a121015379d4",
    "derivation.json": "ea7840188b93e9654ede3c4cd60d5c130cd01860a89f3b02e73da5ff53d6c2ac",
    "history/gender-attribution.json": "365d88c14ff21e2023a2c2f3ea80bdaf59471cfa4be2cf8e34b20742ff30d798",
    "history/male-six-wait-diagnostic.json": "8578db87d3aaffa8bc01a07efdf9f5701c0f919f70a707cd7b777ad5f5f9111e",
    "history/male-six-wait-input-lock.json": "aabfcfce7e783e8766cb92697e655315614b825fba56272c0db7d77d87ca32b5",
    "history/male-six-wait-native-summary.json": "83612c4c20a8e307f57db8f22be52e8a005a779f52a4c74d9493df0e90249b34",
    "history/male-six-wait-negative-hashes.json": "7af25facbf7bf75bba3fea2a466726937d1a4ef23e3a12cb5c6a7dc47f196e88",
    "history/male-six-wait-probe.mjs": "b055655f117034024b57ebfa9dcce8ffae43ed4a8e3b7a60d3689d1b09be1ec3",
    "history/male-six-wait-recipe.json": "c9d6609945576063741ff2062107130879293144541b7eb5822e32b3f95298d6",
    "history/male-six-wait-seal.json": "dea5ec55c15553597dc05a3458583f4841b9e2e104ed6196e38ad7a2e987a527",
    "history/one-wait-diagnostic.json": "1fdbbd024a33140fa47bd050ad43dcdca0234c7f9662393b17c98011c0fb41ca",
    "history/one-wait-input-lock.json": "3a7ddd605174925b2bc5f0f6ad9dd52f895443f049ebd8105465d1fe7ba84cba",
    "history/one-wait-negative-hashes.json": "57f4ef0ceab1bd0b2d2a0a523177dec4777e7ab3295efa9ea7395103705761f0",
    "history/one-wait-probe.mjs": "8fca661b13c80f90f6a9e609ae0e12e2b9e58d35cb78925805916e9377a3a292",
    "history/one-wait-recipe.json": "adf425cd2fc137372c68fda90abd034c56449031cb5c9f7cfb2b53f6caa1213a",
    "history/one-wait-seal.json": "dd3e8877960cf6b71ddf659785bda7ef3a4c28ac6547fc5b3672b82ec5087893",
    "history/valid-source-review.md": "bef0ad7fdf4b7504aa776df26e1d670323cd6fcd67cc6fd3768f02283651ef96",
    "input-lock.json": "6dbebd8897131ac4d7565a9df04c24c29a6d3afbfa9c5ffdd07b8af91a477279",
    "native-preflight.json": "06d0331389a759b49661dd74a95e63bafb6be4136904ac3c200f89ebb37e91e2",
    "negative-hashes.json": "d3447a21f6cb1bd9323e046cd5f73a48c6073b25f5a40d6b8ce4c5accf95115a",
    "ordinary-original.mjs": "55edcb004f44c05f949bc16edad98bab66b8a35a59387e8973d95ef96f84815c",
    "parent-input-lock.json": "f2247b5d889eb194ebe014f38cc1dd0801504280aa97ed3076c003326ce5ce02",
    "predictions.json": "c4d58b3a532f59bf340fc4f8e7aedcad18ebc70cb04fc53a324ae9f9cd7b6718",
    "provenance.json": "a19a44ac60f39d4c0a9f0ab84eb3a1272e70d227b67caab69e0a30a3c41451a3",
    "recording-receipt.json": "6399837221262d851b48f6f91d97b3a0507126b0ef79a1e14e0a2323a39693fd",
    "source-review.md": "26863d6d6c5caee6c26e3c451662fb8044ebcbfec5a488146ae3a5294ff97054",
    "source-seal.json": "dfb88913ce2d5164e7f3008e8ea997ebd3b76a99d2c365cb3eb7d80ba2b48f74"
};
for (const [name, digest] of Object.entries(evidencePins))
    assert.equal(sha(readFileSync(new URL(name, evidence))), digest, name);
const read = name => JSON.parse(readFileSync(new URL(name, evidence)));
const lock = read('input-lock.json'), parentLock = read('parent-input-lock.json');
const sourceSeal = read('source-seal.json'), candidateSeal = read('candidate-seal.json');
const receipt = read('recording-receipt.json');
assert.equal(candidateSeal.sourceSealSHA256, evidencePins['source-seal.json']);
assert.equal(parentLock.sourceSealSHA256, evidencePins['source-seal.json']);
assert.equal(receipt.sourceSealSHA256, evidencePins['source-seal.json']);
assert.equal(receipt.exit, 0);
assert.equal(receipt.cExecutedOnce, true);
const recipeBytes = readFileSync(new URL('gen-sessions/recipes/balrog-weapon-valid.json', import.meta.url));
const recipeSHA256 = sha(recipeBytes);
assert.equal(recipeSHA256, 'a8ef6b987fabbec9dcfd2066f2023b26ec395298713b9df264fce9d48918bb93');
assert.equal(sourceSeal.recipeSHA256, recipeSHA256);
assert.equal(lock.files['recipe.json'], recipeSHA256);
assert.equal(lock.files['predictions.json'], evidencePins['predictions.json']);
assert.equal(lock.probeSHA256, evidencePins['ordinary-original.mjs']);
for (const field of ['sourceRecipeSHA256', 'primaryRecipeSHA256', 'minimalSHA256'])
    assert.equal(parentLock[field], recipeSHA256);
assert.equal(parentLock.beforeC, true);
assert.equal(receipt.inputSHA256, recipeSHA256);
assert.equal(receipt.primaryRecipeSHA256, recipeSHA256);
const recipe = JSON.parse(recipeBytes);
assert.equal(recipe.segments.length, 4);
assert.equal(recipe.branches.length, 4);
assert.equal(recipe.branchAssertions.length, 4);
assert.equal(recipe.requireBranchAssertions, true);
assert.deepEqual(lock.fields, ['name', 'seed', 'datetime', 'nethackrc', 'moves']);
const tuples = parts => parts.map(part => lock.fields.map(field =>
    ({field, present:Object.hasOwn(part, field), value:part[field]})));
assert.deepEqual(tuples(recipe.segments), lock.tuples);
const rawBytes = readFileSync(new URL('gen-sessions/generated/balrog-weapon-valid.session.json', import.meta.url));
const rawSHA256 = sha(rawBytes);
assert.equal(rawSHA256, '633c0e7ffac330591af55781453678c33f898707e1b64b54c50b2058783ea118');
assert.equal(rawBytes.length, 767534);
assert.equal(receipt.rawSha256, rawSHA256);
assert.equal(candidateSeal.rawSHA256, rawSHA256);
const native = JSON.parse(rawBytes);
assert.equal(native.source, 'c');
assert.equal(native.version, 5);
assert.equal(native.segments.length, 4);
assert.deepEqual(tuples(native.segments), lock.tuples);
for (const field of Object.keys(recipe)) {
    if (field === 'segments') continue;
    assert.ok(Object.hasOwn(native, field));
    assert.deepEqual(native[field], recipe[field]);
}
for (const [index, part] of recipe.segments.entries()) {
    assert.deepEqual(native.segments[index].steps.map(step => step.key), [null, ...part.moves]);
    assert.equal(recipe.branchAssertions[index].branch, recipe.branches[index]);
    assert.equal(recipe.branchAssertions[index].segment, index);
}
assert.equal(recipe.segments.reduce((n, part) => n + part.moves.length, 0), 599);
assert.equal(native.segments.reduce((n, part) => n + part.steps.length, 0), 603);
assert.equal(native.segments.flatMap(part => part.steps).flatMap(step => step.rng || []).length, 10830);
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(recipe, native), []);
const baselineRows = read('baseline-observation.json'), candidateRows = read('candidate-observation.json');
const nativeBefore = read('baseline-native.json'), nativeAfter = read('candidate-native.json');
const exact = row => row.fullStyleExact && row.frozenScreenCursorExact && row.fullRngExact && row.animationExact;
assert.equal(nativeBefore.filter(exact).length, 2);
assert.equal(nativeAfter.length, 4);
assert.ok(nativeAfter.every(exact));
assert.equal(evidencePins['candidate-native.json'], candidateSeal.nativeReportSHA256);
for (const index of [2,3]) {
    assert.deepEqual(baselineRows[index], candidateRows[index]);
    assert.deepEqual(nativeBefore[index], nativeAfter[index]);
}
assert.deepEqual([2,3].map(index => ({index, hashes:baselineRows[index].hashes})), read('negative-hashes.json'));
assert.equal(read('history/one-wait-seal.json').producer, '0/4');
assert.equal(read('history/one-wait-diagnostic.json').flatMap(row => row.checks).filter(c => c.pass).length, 20);
assert.equal(read('history/male-six-wait-diagnostic.json').flatMap(row => row.checks).filter(c => c.pass).length, 30);
assert.equal(read('history/male-six-wait-native-summary.json').exactCases, 0);
assert.equal(read('history/gender-attribution.json').nativeCasesPassing, 0);
const original = readFileSync(new URL('ordinary-original.mjs', evidence), 'utf8');
const derivation = read('derivation.json');
const start = original.indexOf(derivation.start);
const originalBody = original.slice(start, original.indexOf(derivation.end, start));
assert.equal(sha(original), derivation.originalProbeSHA256);
assert.equal(sha(originalBody), derivation.originalBodySHA256);
let portableBody = originalBody;
for (const [before, after] of derivation.importRelocations)
    portableBody = portableBody.replaceAll(before, after);
assert.equal(sha(portableBody), derivation.portableBodySHA256);
const current = readFileSync(new URL(import.meta.url), 'utf8');
assert.equal(current.split('// BEGIN ORIGINAL ORDINARY BODY\n')[1]
    .split('// END ORIGINAL ORDINARY BODY')[0], portableBody);
assert.equal(sha(readFileSync(new URL('half-damage-reader-observe.mjs', import.meta.url))),
    '201cdafe4409d5d58414c1d0ebc0449c32b29834cdf35c72c151a555d9031d07');
// Exact C/data/history preflight above finishes before tested gameplay imports.
// BEGIN ORIGINAL ORDINARY BODY
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {PMNAMES} = await import('../js/monst_data.js');
const {ONAMES} = await import('../js/objects_data.js');
const {decodeScreen, renderCell} = await import('../frozen/screen-decode.mjs');
const {outputs, hashes, deferred} = await import('./half-damage-reader-observe.mjs');
const predictions = read('predictions.json');
const rows = [];
const object = obj => obj ? {id:obj.o_id, type:obj.otyp, letter:obj.invlet,
    artifact:obj.oartifact || 0, worn:obj.owornmask || 0, cursed:!!obj.cursed} : null;
for (const [index, part] of recipe.segments.entries()) {
    const states = [], checks = [], p = predictions[index];
    const check = (kind, name, fn) => {
        try {fn(); checks.push({kind, name, pass:true});}
        catch (error) {checks.push({kind, name, pass:false, error:error.message});}
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (!g.u || !g.level) return;
            states.push({step, turn:g.moves, hp:g.u.uhp, level:g.u.ulevel, female:!!g.flags.female, mortality:g.u.umortality || 0,
                hero:[g.u.ux, g.u.uy], weapon:object(g.u.uwep), alternate:object(g.u.uswapwep),
                inventory:(g.invent || []).map(object),
                balrogs:g.level.monsters.filter(m => m.mnum === PMNAMES.PM_BALROG && m.mhp > 0)
                    .map(m => ({id:m.m_id, xy:[m.mx,m.my], hp:m.mhp, movement:m.movement, canmove:!!m.mcanmove, weaponCheck:m.weapon_check, peaceful:!!m.mpeaceful,
                        asleep:!!m.msleeping, weapon:object(m.mw), inventory:(m.minvent || []).map(object)}))});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const out = structuredClone(outputs(run));
    const texts = out.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    const created = states.find(s => s.balrogs.length);
    const wielded = states.find(s => s.balrogs.some(m => m.weapon));
    const mon = wielded?.balrogs[0];
    check('producer', 'one live hostile Balrog created through the real command', () => {
        assert.equal(created?.balrogs.length, 1);
        assert.equal(created.balrogs[0].peaceful, false);
        assert.equal(created.balrogs[0].asleep, false);
        assert.ok(states.filter(s => s.step >= created.step).every(s =>
            s.balrogs.length === 1 && s.balrogs[0].id === created.balrogs[0].id));
    });
    check('producer', 'real desired primary and alternate hero slots', () => {
        assert.ok(created);
        assert.equal(created.level, 30);
        assert.equal(created.female, true);
        assert.ok(created.hp > 120);
        assert.equal(created.weapon?.type ?? null, p.armed ? ONAMES[p.weapon] : null);
        assert.equal(created.alternate?.type ?? null, p.alternate ? ONAMES.LONG_SWORD : null);
        assert.equal(created.inventory.length, 1);
        assert.equal(created.inventory[0].type, ONAMES[p.weapon]);
    });
    check('producer', 'ordinary bullwhip and broadsword both available', () => {
        assert.ok(mon && mon.hp > 0);
        for (const type of [ONAMES.BULLWHIP, ONAMES.BROADSWORD])
            assert.ok(mon.inventory.some(o => o.type === type && !o.artifact));
        assert.ok(mon.inventory.every(o => !o.artifact));
    });
    check('producer', 'real monster wield action and visible message reached', () => {
        assert.ok(mon?.weapon);
        assert.ok(texts.some(t => t.includes('balrog wields')));
        assert.ok(Math.max(...mon.xy.map((v,i) => Math.abs(v-wielded.hero[i]))) <= 2);
    });
    check('producer', 'all inputs consumed with no death', () => {
        assert.equal(states.at(-1)?.step, part.moves.length);
        assert.equal(out.screens.length, part.moves.length + 1);
        assert.deepEqual(out.slices.flat(), out.calls);
        assert.ok(states.every(s => s.hp > 0 && !s.mortality));
    });
    check('source', 'Balrog prefers its bullwhip only while the hero is armed', () => {
        assert.ok(mon?.weapon);
        if (p.armed) assert.equal(mon.weapon.type, ONAMES.BULLWHIP);
        else assert.notEqual(mon.weapon.type, ONAMES.BULLWHIP);
    });
    const plain = structuredClone(outputs(await runSegment({...part, storage:new InMemoryStorage()})));
    const delayed = await deferred(part);
    check('neutrality', 'passive observer preserves all five streams', () => assert.deepEqual(out, plain));
    check('neutrality', 'deferred input preserves all five streams and pending EOF', () => assert.deepEqual(out, delayed));
    rows.push({index, name:part.name, checks, producer:checks.filter(c => c.kind === 'producer').every(c => c.pass),
        source:checks.filter(c => c.kind === 'source').every(c => c.pass),
        created, wielded, final:states.at(-1), hashes:hashes(out),
        boundaries:out.screens.length, calls:out.calls.length, frames:out.frames.flat().length,
        wieldMessages:texts.flatMap((text, step) => text.includes('balrog wields') ? [{step, top:text.split('\n')[0]}] : [])});
}
// END ORIGINAL ORDINARY BODY
const persistedRows = JSON.parse(JSON.stringify(rows));
for (const index of [2,3])
    assert.deepEqual(persistedRows[index], baselineRows[index], `complete ordinary negative ${index}`);
assert.deepEqual([2,3].map(index => ({index, hashes:rows[index].hashes})), read('negative-hashes.json'));
const checks = rows.flatMap(row => row.checks);
const report = {cases:rows.length, sourceChecks:checks.filter(check => check.pass).length,
    totalChecks:32, producerCases:rows.filter(row => row.producer).length,
    sourceCases:rows.filter(row => row.source).length,
    neutralityChecks:checks.filter(check => check.kind === 'neutrality' && check.pass).length,
    completeNegativeRows:2, negativeHashes:10,
    preflight:{beforeGameplayImports:true, source:'c', version:5, rawSHA256, recipeSHA256,
        fieldsAndPresence:true, keysExact:true, keys:599, boundaries:603,
        primaryAssertions:4, integrityErrors:[], branchErrors:[]},
    archivedNative:{baseline:'2/4', candidate:'4/4', completeNegativeRowsUnchanged:2,
        reportSHA256:evidencePins['candidate-native.json']}, nativeReplays:0,
    rows:persistedRows.map(row => ({index:row.index, name:row.name, rowSHA256:hash(row),
        retainedStatesSHA256:hash({created:row.created, wielded:row.wielded, final:row.final}),
        outputHashes:row.hashes, failedChecks:row.checks.filter(check => !check.pass)}))};
if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {flag:'wx'});
process.stdout.write(JSON.stringify(report) + '\n');
assert.equal(rows.length, 4);
assert.equal(checks.length, 32);
assert.ok(checks.every(check => check.pass), 'all32 original checks pass');
assert.equal(report.neutralityChecks, 8);
