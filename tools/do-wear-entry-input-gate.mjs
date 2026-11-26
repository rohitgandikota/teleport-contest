// Current installed runtime, with original C and source evidence checked first.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const evidence = new URL('tools/gen-sessions/evidence/do-wear-entry/', root);
const json = url => JSON.parse(readFileSync(url, 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = url => sha(readFileSync(url));
assert.ok(process.argv.length <= 3, 'usage: node tools/do-wear-entry-input-gate.mjs [new-report.json]');
const reportPath = process.argv[2] || null;
if (reportPath) {
    assert.ok(!reportPath.startsWith('-'), 'report must be a new filename');
    assert.ok(!existsSync(reportPath), 'report already exists');
}

const contractFile = new URL('source-contract.json', evidence);
assert.equal(digest(contractFile), '7c60bc8330674b563cfa469cdb24ba43da2e518710acfe83006d07c3bf4c72cf');
const contract = json(contractFile);
for (const [path, hash] of Object.entries(contract.evidencePins))
    assert.equal(digest(new URL(path, evidence)), hash, path);
for (const [path, hash] of Object.entries(contract.portableDependencyPins))
    assert.equal(digest(new URL(path, root)), hash, path);
const read = path => json(new URL(path, evidence));
const recipe = read('source/recipe.json');
const lock = read('source/input-lock.json');
const predictions = read('source/predictions.json');
const negativeHashes = read('source/negative-hashes.json');
assert.equal(digest(new URL('source/recipe.json', evidence)), lock.recipeSha256);
assert.equal(digest(new URL('source/predictions.json', evidence)), lock.predictionsSha256);
assert.deepEqual(lock.fields, ['name','seed','datetime','nethackrc','moves']);
assert.equal(recipe.segments.length, 6);
assert.equal(lock.segments.length, 6);
const primary = read('source/primary-recipe.json');
const recordingPrimary = read('parent/primary-recipe.json');
const publicFile = new URL('tools/gen-sessions/recipes/do-wear-entry.json', root);
const derivation = read('public-recipe-derivation.json');
assert.equal(digest(publicFile), derivation.publicRecipeSha256);
assert.equal(digest(new URL('source/primary-recipe.json', evidence)), derivation.sourcePrimarySha256);
assert.equal(digest(new URL('parent/primary-recipe.json', evidence)), derivation.parentRecordingPrimarySha256);
const publicRecipe = json(publicFile);
const derived = structuredClone(primary);
derived.name = 'do-wear-entry';
derived.coverage = recordingPrimary.coverage;
derived.branches = recordingPrimary.branches;
derived.description = 'C references for both full-equipment entry messages, inventory-menu cancellation repeat cleanup, and three unchanged control cases.';
derived.branchAssertions.forEach((a,i) => { a.branch = derived.branches[i]; });
assert.deepEqual(publicRecipe, derived, 'public metadata derivation');
assert.deepEqual(primary.segments, recipe.segments);

// The recording pinned the archived 25-member seal, not the final 31-member seal.
const parentLock = read('parent/input-lock.json');
const history = read('candidate/history-accounting.json');
assert.equal(digest(new URL('source25-SEAL.json', evidence)), parentLock.sourceSealSHA256);
for (const [sealPath, manifestPath, members] of [
    ['source25-SEAL.json','source25-manifest.json',25],
    ['source31-SEAL.json','source31-manifest.json',31],
    ['candidate/SEAL.json','candidate/manifest.json',348],
]) {
    const seal = read(sealPath);
    assert.equal(seal.members, members);
    assert.equal(read(manifestPath).length, members);
    assert.equal(digest(new URL(manifestPath, evidence)), seal.manifestSha256);
}
assert.equal(history.topLevelSealUnchangedClaim, false);
assert.equal(history.originalUnchangedMembers.length, 19);
assert.equal(history.metadataUpdatedDuringFinalization.length, 6);
assert.equal(history.secondRecording, false);
assert.equal(history.originalRecordingSourceSeal.sha256, parentLock.sourceSealSHA256);
assert.equal(history.finalSourceSeal.sha256, digest(new URL('source31-SEAL.json', evidence)));
assert.equal(parentLock.primaryRecipeSHA256, derivation.parentRecordingPrimarySha256);
assert.equal(parentLock.originalRecipeSHA256, lock.recipeSha256);
assert.equal(parentLock.sourcePredictionsSHA256, lock.predictionsSha256);

// Historical diagnostic failures remain required evidence, separate from live checks.
const historical = ['source/observation.json','candidate/original-observation.json',
    'candidate/corrected-baseline-observation.json','candidate/corrected-observation.json'].map(read);
assert.deepEqual(historical.map(r => r.summary.checks), [52,52,52,52]);
assert.deepEqual(historical.map(r => r.summary.failures.length), [6,1,6,0]);
assert.equal(historical[1].summary.failures[0].name, 'put on: C entry feedback');
const signature = report => report.rows.map(r => [r.name,r.checks.map(c => [c.name,c.category])]);
for (const report of historical) {
    assert.deepEqual(signature(report), signature(historical[0]));
    assert.ok(!report.workerFailure);
    assert.equal(report.summary.observerRestored, true);
    for (const row of report.rows) {
        assert.ok(row.checks.filter(c => ['setup','neutrality','integrity'].includes(c.category)).every(c => c.pass));
        if (Object.hasOwn(negativeHashes, row.name))
            assert.deepEqual(row.hashes, negativeHashes[row.name]);
    }
}
assert.equal(Object.keys(negativeHashes).length, 3);
assert.equal(Object.values(negativeHashes).reduce((n,h) => n+Object.keys(h).length,0), 15);
for (let i=0;i<6;i++) {
    assert.deepEqual(historical[0].rows[i].hashes, historical[2].rows[i].hashes);
    assert.deepEqual(historical[1].rows[i].hashes, historical[3].rows[i].hashes);
}
const nativeBefore = read('parent/baseline-native.json'), nativeAfter = read('candidate/native.json');
const exact = r => r.fullStyleExact && r.frozenScreenCursorExact && r.fullRngExact && r.animationExact;
assert.equal(nativeBefore.length, 6);
assert.equal(nativeAfter.length, 6);
assert.equal(nativeBefore.filter(exact).length, 3);
assert.equal(nativeAfter.filter(exact).length, 6);
for (const index of [1,2,5]) assert.deepEqual(nativeAfter[index], nativeBefore[index]);

const rawFile = new URL(contract.native.path, root);
const rawBytes = readFileSync(rawFile);
assert.equal(sha(rawBytes), contract.native.sha256);
assert.equal(rawBytes.length, contract.native.bytes);
const raw = JSON.parse(rawBytes);
assert.equal(raw.source, 'c');
assert.equal(raw.version, 5);
assert.equal(raw.segments.length, 6);
let keys=0, boundaries=0, calls=0, frames=0;
for (const [i, part] of recipe.segments.entries()) {
    const locked = lock.segments[i];
    for (const field of lock.fields) {
        for (const tuple of [part, primary.segments[i], recordingPrimary.segments[i], publicRecipe.segments[i], raw.segments[i]]) {
            assert.equal(Object.hasOwn(tuple, field), locked.fields[field].present, `${i}/${field} presence`);
            assert.deepEqual(tuple[field], locked.fields[field].value, `${i}/${field}`);
        }
    }
    assert.deepEqual(Array.from(part.moves, c => c.charCodeAt(0)), locked.keys);
    assert.deepEqual(raw.segments[i].steps.map(s => s.key), [null,...part.moves]);
    keys += locked.keys.length;
    for (const step of raw.segments[i].steps) {
        boundaries++;
        calls += (step.rng || []).length;
        frames += (step.animation_frames || []).length;
    }
}
assert.deepEqual({keys,boundaries,calls,frames}, {keys:1684,boundaries:1690,calls:17532,frames:2});
const recording = read('parent/native-recording.json');
assert.equal(recording.rawSha256, contract.native.sha256);
assert.equal(recording.primaryRecipeSHA256, parentLock.primaryRecipeSHA256);
assert.equal(recording.inputSHA256, parentLock.minimalInputSHA256);
assert.equal(recording.cPin, contract.cPin);
assert.equal(recording.exit, 0);
assert.equal(recording.cExecutedOnce, true);
assert.equal(recording.fiveInputFieldsAndPresencePreserved, true);
assert.equal(recording.allKeysExact, true);

// These imports decode evidence only; they do not load the game.
const { branchAssertionErrors, recordingIntegrityErrors } = await import('./gen-sessions/assertions.mjs');
const { decodeScreen, renderCell } = await import('../frozen/screen-decode.mjs');
assert.deepEqual(recordingIntegrityErrors(raw), []);
assert.equal(primary.requireBranchAssertions, true);
assert.equal(primary.branchAssertions.length, 6);
const sourceCells = primary.branchAssertions.reduce((n,a) => n+a.screenCells.length,0);
assert.equal(sourceCells, 467);
assert.deepEqual(branchAssertionErrors(primary, raw), []);
assert.deepEqual(branchAssertionErrors(publicRecipe, raw), []);
const layout = read('parent/layout-attribution.json');
const originalPrimaryErrors = branchAssertionErrors(recordingPrimary, raw);
assert.deepEqual(originalPrimaryErrors, ['do-wear-entry.full-eleven-wear-puton: segment 0 lacks screen text "some lenses."']);
assert.deepEqual(originalPrimaryErrors, layout.originalPrimaryErrors);
const decodedRows = decodeScreen(raw.segments[0].steps[478].screen).slice(0,2)
    .map(row => row.map(renderCell).join('').trimEnd());
assert.deepEqual(decodedRows, layout.decodedRows);
assert.equal(decodedRows.join(' '), predictions.cPredictions.putonFull+'--More--');
const nativePreflight = {sha256:contract.native.sha256,source:'c',version:5,cases:6,
    keys,boundaries,calls,frames,sourceCells,originalPrimaryErrors};
const sourcePreflight = {evidenceFiles:Object.keys(contract.evidencePins).length,
    archivedSourceMembers:25,finalSourceMembers:31,candidateMembers:348,
    originalCandidate:'51/52',correctedCandidate:'52/52',negativeHashes:15};

// Gameplay imports occur only after the entire preflight above succeeds.
const { runSegment } = await import('../js/jsmain.js');
const { InMemoryStorage } = await import('../js/storage.js');
const { CQ_REPEAT } = await import('../js/const.js');
const { ONAMES } = await import('../js/objects_data.js');
const { outputs, hashes, deferred } = await import('./half-damage-reader-observe.mjs');
const typeNames = Object.fromEntries(Object.entries(ONAMES).map(([k,v]) => [v,k]));
const text = screen => decodeScreen(screen).map(row => row.map(renderCell).join('').trimEnd()).join('\n');
const expectedTypes = ['HAWAIIAN_SHIRT','LEATHER_ARMOR','LEATHER_CLOAK','HELMET',
    'SMALL_SHIELD','LEATHER_GLOVES','LOW_BOOTS','RIN_PROTECTION','RIN_ADORNMENT',
    'AMULET_OF_REFLECTION','LENSES'];
const report = {sourcePreflight,nativePreflight,recipeSha256:lock.recipeSha256,rows:[]};
const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');

function snapshot(g, step) {
    return { step, turn:g.moves, multi:g.multi, afternmv:g.afternmv?.name || null,
        hp:g.u.uhp, form:g.u.umonnum, gameover:!!g.program_state?.gameover,
        slots:Object.fromEntries(predictions.slots.map(s => [s,g.u[s]?.invlet || null])),
        inventory:(g.invent || []).map(o => ({letter:o.invlet,type:typeNames[o.otyp],
            cursed:!!o.cursed,artifact:o.oartifact || 0,worn:o.owornmask || 0})),
        repeat:(g.command_queue?.[CQ_REPEAT] || []).map(q => ({type:q.typ,
            command:q.ec_entry?.ef_txt || null,key:q.key ?? null})),
        inDoagain:!!g.in_doagain };
}

try {
    for (const [index, part] of recipe.segments.entries()) {
        const plan = predictions.cases[index];
        const points = new Set(plan.points.flatMap(p => Object.values(p).filter(Number.isInteger)));
        const states = new Map();
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (points.has(step)) states.set(step, snapshot(g, step));
        }};
        const run = await runSegment({...part, storage:new InMemoryStorage()});
        delete globalThis.__step_snapshot;
        const output = structuredClone(outputs(run));
        const row = {name:part.name, kind:plan.kind, keys:part.moves.length,
            boundaries:output.screens.length, hashes:hashes(output), checks:[], observations:[]};
        report.rows.push(row);
        const check = (name, body, category='source-prediction') => {
            try { body(); row.checks.push({name,category,pass:true}); }
            catch (error) { row.checks.push({name,category,pass:false,error:error.message}); }
        };
        check('all input boundaries and RNG slices', () => {
            assert.equal(output.screens.length,part.moves.length+1);
            assert.deepEqual(output.slices.flat(),output.calls);
        }, 'integrity');
        for (const p of plan.points) {
            const captured = Object.fromEntries(Object.entries(p).filter(([,v]) => Number.isInteger(v))
                .map(([label,step]) => [label,{state:states.get(step),text:text(output.screens[step])}]));
            row.observations.push({label:p.label,...captured});
            const before = captured.before.state;
            check(`${p.label}: real producer setup`, () => {
                assert.equal(before.gameover,false);
                assert.ok(before.hp > 0);
                assert.equal(before.multi,0);
                assert.equal(before.afternmv,null);
                assert.deepEqual(before.inventory.map(o => o.type),
                    plan.kind.includes('equipment') || plan.kind==='missing-slot-negative'
                        ? expectedTypes : ['HAWAIIAN_SHIRT','LOW_BOOTS']);
                assert.ok(before.inventory.every(o => !o.cursed && !o.artifact));
                const worn = Object.values(before.slots).filter(Boolean);
                assert.equal(worn.length,plan.kind==='full-equipment' ? 11
                    : plan.kind==='missing-slot-negative' ? 10 : 0);
                if (plan.missing) assert.equal(before.slots[plan.missing],null);
            }, 'setup');
            if (plan.kind==='full-equipment' || plan.kind==='missing-slot-negative') {
                check(`${p.label}: C entry feedback`, () => {
                    const entryText = plan.kind==='full-equipment' && p.command==='P'
                        ? captured.after.text.split('\n').slice(0,2).join(' ')
                        : captured.after.text;
                    assert.ok(entryText.includes(plan.kind==='full-equipment'
                        ? predictions.cPredictions[p.command==='W' ? 'wearFull' : 'putonFull']
                        : `What do you want to ${p.label}?`));
                });
                check(`${p.label}: slots and time unaffected at entry`, () => {
                    assert.deepEqual(captured.after.state.slots,before.slots);
                    assert.equal(captured.after.state.turn,before.turn);
                });
            } else {
                check(`${p.label}: cancelled getobj clears repeat`, () => {
                    assert.deepEqual(captured.cancelled.state.repeat,[]);
                });
                check(`${p.label}: Ctrl-A has no command available`, () => {
                    assert.ok(captured.repeated.text.includes('There is no command available to repeat.'));
                });
                check(`${p.label}: cancellation consumes no time or equipment`, () => {
                    assert.equal(captured.repeated.state.turn,before.turn);
                    assert.deepEqual(captured.repeated.state.slots,before.slots);
                });
            }
        }
        const plain = await runSegment({...part, storage:new InMemoryStorage()});
        check('observer-free five streams unchanged', () => {
            assert.deepEqual(hashes(outputs(plain)),row.hashes);
        }, 'neutrality');
        const late = await deferred(part);
        check('deferred five streams unchanged', () => {
            assert.deepEqual(hashes(late),row.hashes);
        }, 'neutrality');
        if (Object.hasOwn(negativeHashes, part.name))
            assert.deepEqual(row.hashes, negativeHashes[part.name], 'all five negative streams');
        console.log(JSON.stringify({name:row.name,checks:row.checks.length,
            failures:row.checks.filter(c => !c.pass).map(c => c.name)}));
    }
} catch (error) {
    report.workerFailure = {message:error.message,stack:error.stack};
} finally {
    if (previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
    else delete globalThis.__step_snapshot;
    report.summary = {cases:report.rows.length,
        checks:report.rows.reduce((n,r) => n+r.checks.length,0),
        failures:report.rows.flatMap(r => r.checks.filter(c => !c.pass).map(c => ({name:r.name,...c}))),
        observerRestored:JSON.stringify(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'))
            === JSON.stringify(previous)};
    const compactReport = {...report, rows:report.rows.map(({observations, ...row}) => row)};
    if (reportPath)
        writeFileSync(reportPath,JSON.stringify(compactReport,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({cases:report.summary.cases,checks:report.summary.checks,
        failures:report.summary.failures,observerRestored:report.summary.observerRestored,
        workerFailure:report.workerFailure?.message || null,nativePreflight,sourcePreflight}));
}
process.exitCode = report.workerFailure || report.summary.failures.length
    || !report.summary.observerRestored || report.summary.cases !== recipe.segments.length ? 1 : 0;
