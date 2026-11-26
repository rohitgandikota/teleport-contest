// Data-only preflight runs before any installed gameplay import.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length <= 3
    && (process.argv[2] === undefined || (process.argv[2] && !process.argv[2].startsWith('-'))),
    'usage: welcome-restore-branches-input-gate.mjs [new-compact-report.json]; no selectors');
const target = process.argv[2] || null;
assert.ok(!target || !fs.existsSync(target), 'report path must be new');
const repo = new URL('../', import.meta.url);
const runtime = repo;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function pinned(path, digest) {
    const bytes = fs.readFileSync(new URL(path, import.meta.url));
    assert.equal(sha(bytes), digest, 'exact tracked evidence: ' + path);
    return bytes;
}
const evidence = 'gen-sessions/evidence/welcome-restore-branches/';
const evidencePins = {
    "PROBE-ADAPTATION.md": "fe3e9bdfb74612ca040df0daf97c095c29e2e6bb3ba4d46ffd643c80c516759d",
    "README.md": "f619f8d4830c5c0711c482ed7cd3f9c5912b42afe5b5807225e1b50be4d408fd",
    "SOURCE-REVIEW.md": "299c51f13e22d224ff5528df35001031930910bff29207751ad13f0251f33151",
    "baseline-native.json": "82c0a2c9b49ea9cb8c4b9aa34c544b8558eed3306b8a2ecbfb879c81fb1f0f5c",
    "candidate-expectations.json": "456071a651fd29c1617fc4bc3d1a8f527d4423eb19331460efb2440bb798f5b0",
    "candidate-native.json": "8b01e878c9612653b0cb211addf7cafec6cf13685814fc47f1994412a5d0a8ab",
    "candidate-ordinary.json": "205356fb633320a56160d5f6d3b0e5e6b7711e7f2954bbee06f7ffc6654f791a",
    "candidate-source-coverage.json": "33d251d7241d91732db8843d9becbea6d4d631239ce92d0e1874d866baaaef97",
    "candidate-validation.json": "782689c509c76060f5fc583e0046754e306b6f6eaec584b9f58e36189f12d6a6",
    "history/candidate-metadata-adaptation.json": "2d03420e04a1b8c7c9f9ee9535962f402fecae602e8a31a271542e95599ebfcf",
    "history/candidate-ordinary.mjs": "703ee3dd1d38bb4d4b1b5c16142ee976bf098747c7914cd1e071de205cff13e2",
    "history/original-diagnostic.mjs": "7e37d342faed48ededb23389e318e8296a827d8471f311b26230499fc1c14b0f",
    "history/probe-adaptation.json": "8732c98ce8617f0100cfc6f5845886299c0b2c61b5dbac5154a5d79073775099",
    "history/source-probe.mjs": "6a734c20339b21d4df2d3805b976868d5188323ceebda79bac452e352d4147f5",
    "input-lock.json": "c4fef7a3d80808ae1ae2ec72b75ab4460d6d1afad2f17fcc72889f2a54ddcb80",
    "log-category-source.json": "45ceb6fe7406f0ca532fe7a013bd55e2abe0851c1474294fce4d2ef9ad1e4562",
    "native-recording.json": "52927a18827a38d7e6e79ce2462390b021f0ed02ed422a2cd696eb4416b3b549",
    "negative-hashes.json": "c1a5b8e2e2c7bb2191fc41731aaca774c853d98b4823ca700e99d16dd820f453",
    "original-diagnostic.json": "f887757e1f96656cc08b4caa167509ef3fb7ceaa73e7dc0e6c8145c0d7aa6b8f",
    "original-input-lock.json": "2748a3561238c5c69748aab72bd1f93b17ca80e09a969e3f36a20c9ade664e9e",
    "original-negative-hashes.json": "02e5c03f4f372694e5d2c4b150cc267570da2f6d106233ef0897a5e297def86f",
    "original-output-hashes.json": "dc795f126425cf2399c446038da02e08213f234bb14f7aa1e1439e0bc5412269",
    "original-recipe.json": "ed6d76e3bfd2d9cb52071dce1690d2b8a42bdfc5a5425eb56d6125616ff3d3c4",
    "parent-input-lock.json": "e2d49b6791a719ac3a5ffeb7066379fb6693cc3fa62772d4a7f657d533087fe6",
    "source-predictions.json": "6708c50ebf90d36a6a30bc20be982e7f9e892aafc32d07062e879bb3e7e90d4d",
    "source-provenance.json": "eb719fd5e3bafb7ea1c071d9e4a6449c15b35cc850a6a5342045b519749d8c06"
};
for (const [name, digest] of Object.entries(evidencePins)) pinned(evidence + name, digest);
const readEvidence = name => JSON.parse(pinned(evidence + name, evidencePins[name]));

// These maintained metadata/serialization helpers do not start gameplay.
pinned('gen-sessions/assertions.mjs', 'aed2dfe01e18cb2e8b0d62e389ab9d8a9c02b0e3e98d4e427fcead4c228e3adc');
pinned('gen-sessions/screen-decode.mjs', '0831fd4db121dab1d3c8f80efac29c68ce50f67fedbb49f2bd7c21371244dae0');
pinned('half-damage-reader-observe.mjs', '201cdafe4409d5d58414c1d0ebc0449c32b29834cdf35c72c151a555d9031d07');
pinned('../frozen/screen-decode.mjs', 'cb4a0fbfed3dda28c14736e6ae9c8b9eb8c87d75916c50d6df80f40eb0368cbe');
const lockBytes = pinned(evidence + 'input-lock.json', evidencePins['input-lock.json']);
const lock = JSON.parse(lockBytes);
const recipeBytes = pinned('gen-sessions/recipes/welcome-restore-branches.json',
    '0ac79e37338b5e37e64ae94e221a52ac5618abf68c13882d623ff592af795bae');
const recipe = JSON.parse(recipeBytes);
const expectations = readEvidence('candidate-expectations.json');
const provenance = readEvidence('source-provenance.json');
const parentLock = readEvidence('parent-input-lock.json');
assert.equal(parentLock.beforeCAndCandidate, true);
assert.equal(parentLock.sourceInputLockSHA256, sha(lockBytes));
assert.equal(parentLock.primaryRecipeSHA256, sha(recipeBytes));
assert.equal(parentLock.originalRecipeSHA256, sha(recipeBytes));
assert.equal(parentLock.sourceSealSHA256, provenance.sources.expanded20.sealSHA256);
assert.equal(parentLock.originalSourceSealSHA256, provenance.sources.original18.sealSHA256);
assert.equal(parentLock.sourceProbeSHA256, provenance.expandedProbeSHA256);
assert.equal(parentLock.negativeHashesSHA256, evidencePins['negative-hashes.json']);
assert.equal(lock.nativeRecorded, false, 'historical lock predates C');
assert.equal(lock.runtimeCandidate, false, 'historical lock predates candidate');
assert.equal(lock.recipeSHA256, sha(recipeBytes));
assert.equal(lock.predictionsSHA256, evidencePins['source-predictions.json']);
assert.deepEqual(lock.fields, ['name', 'seed', 'datetime', 'nethackrc', 'moves']);
const fieldTuple = part => lock.fields.map(field => ({
    field, present: Object.hasOwn(part, field),
    ...(Object.hasOwn(part, field) ? { value: part[field] } : {}),
}));
const tuples = recipe.segments.map(fieldTuple);
const allKeys = recipe.segments.map(part => [null, ...part.moves]);
assert.deepEqual(tuples, lock.tuples);
assert.equal(sha(JSON.stringify(tuples)), lock.tuplesSHA256);
assert.equal(lock.tuplesSHA256, '7841b4a028128d47bfa4ffc21271ffe3fc854cac25c18fccdcecb7573706c093');
assert.equal(sha(JSON.stringify(allKeys)), lock.allKeysSHA256);
assert.equal(lock.allKeysSHA256, '3d4f70b8f1b95a7aa2fc2a42e02e5d17b524cc9d7308c4393ae239be760cf6f1');
assert.deepEqual([lock.segments, lock.keys, lock.expectedBoundaries], [16, 606, 622]);
assert.equal(recipe.segments.length, 16);
assert.equal(recipe.segments.reduce((n, part) => n + part.moves.length, 0), 606);
assert.equal(allKeys.flat().length, 622);
const oldRecipe = readEvidence('original-recipe.json');
const oldLock = readEvidence('original-input-lock.json');
assert.equal(lock.original.inputLockSHA256, evidencePins['original-input-lock.json']);
assert.equal(lock.original.recipeSHA256, evidencePins['original-recipe.json']);
assert.equal(lock.original.sealSHA256, provenance.sources.original18.sealSHA256);
assert.equal(lock.original.tuplesSHA256, oldLock.tuplesSHA256);
assert.deepEqual(recipe.segments.slice(0, 6), oldRecipe.segments);
assert.deepEqual(recipe.branchAssertions.slice(0, 6), oldRecipe.branchAssertions);
assert.deepEqual(recipe.branches.slice(0, 6), oldRecipe.branches);
const oldOutput = readEvidence('original-output-hashes.json');
assert.equal(oldOutput.sourceSHA256, provenance.originalProbeSHA256);
const oldRows = oldOutput.rows;
assert.equal(oldRows.length, 6);
const oldNegative = readEvidence('original-negative-hashes.json').hashes;
assert.equal(lock.original.negativeHashesSHA256, evidencePins['original-negative-hashes.json']);
assert.deepEqual(readEvidence('negative-hashes.json').hashes, oldNegative);
assert.deepEqual(Object.keys(oldNegative), recipe.segments.slice(2, 6).map(part => part.name));
for (const row of oldRows.slice(2)) {
    assert.deepEqual(Object.keys(row.hashes), ['screens', 'cursors', 'calls', 'slices', 'frames']);
    assert.deepEqual(row.hashes, oldNegative[row.name]);
}
assert.deepEqual(expectations.unchangedOriginalSegments, [0, 2, 3, 4, 5]);
assert.deepEqual(expectations.correctedOriginalPositiveSegments, [1]);
assert.deepEqual(expectations.mandatoryNegativeSegments, [2, 3, 4, 5]);
assert.deepEqual(expectations.mandatoryCPrimarySegments, Array.from({ length: 16 }, (_, i) => i));
assert.equal(expectations.originalDiagnosticSHA256, evidencePins['original-diagnostic.json']);
assert.equal(expectations.nativeCandidateSHA256, evidencePins['candidate-native.json']);
const diagnostic = readEvidence('original-diagnostic.json');
assert.deepEqual(diagnostic.modes.observed.filter(row => !row.passed).map(row => row.name), [recipe.segments[1].name]);
assert.ok(diagnostic.modes.observed[1].failures[0].startsWith('original six full outputs unchanged'));
assert.ok(diagnostic.modes.plain.every(row => row.passed));
assert.ok(diagnostic.modes.deferred.every(row => row.passed));

// Historical adaptation records prove the original diagnostic and its one
// applicability correction. Read source strings as evidence, never execute them.
let historicalBody = pinned(evidence + 'history/source-probe.mjs', evidencePins['history/source-probe.mjs']).toString();
for (const [record, output] of [
    ['history/probe-adaptation.json', 'history/original-diagnostic.mjs'],
    ['history/candidate-metadata-adaptation.json', 'history/candidate-ordinary.mjs'],
]) {
    for (const { before, after } of readEvidence(record).changes) {
        assert.equal(historicalBody.split(before).length, 2, 'one exact historical replacement');
        historicalBody = historicalBody.replace(before, after);
    }
    assert.equal(sha(historicalBody), evidencePins[output]);
}

// The exact canonical original C recording is mandatory, even for ordinary runs.
const rawBytes = pinned('gen-sessions/generated/welcome-restore-branches.session.json',
    '82b5aaf8ae42d10946ffb75a3df0b73791adc461d3d6f33126de56a1d7b98bb0');
assert.equal(rawBytes.length, 1983712);
const raw = JSON.parse(rawBytes);
assert.equal(raw.source, 'c');
assert.equal(raw.version, 5);
assert.equal(raw.segments.length, 16);
assert.deepEqual(raw.segments.map(fieldTuple), tuples);
assert.deepEqual(raw.segments.map(part => part.steps.map(step => step.key)), allKeys);
assert.deepEqual(recordingIntegrityErrors(raw), []);
assert.equal(recipe.requireBranchAssertions, true);
assert.equal(recipe.branchAssertions.length, 16);
assert.deepEqual(recipe.branchAssertions.map(row => row.segment), Array.from({ length: 16 }, (_, i) => i));
assert.deepEqual(recipe.branchAssertions.map(row => row.branch), recipe.branches);
assert.deepEqual(branchAssertionErrors(recipe), []);
assert.deepEqual(branchAssertionErrors(recipe, raw), []);

// Inherited native reports are proof, not a fresh comparison or state observer.
const baselineNative = readEvidence('baseline-native.json');
const candidateNative = readEvidence('candidate-native.json');
const exactNative = row => row.frozenScreenCursorExact && row.fullRngExact
    && row.fullStyleExact && row.animationExact;
assert.equal(baselineNative.length, 16);
assert.equal(candidateNative.length, 16);
assert.equal(baselineNative.filter(exactNative).length, 10);
assert.ok(candidateNative.every(exactNative));
for (const index of [2, 3, 4, 5]) assert.deepEqual(candidateNative[index], baselineNative[index]);
const categoryHistory = readEvidence('log-category-source.json');
assert.ok(categoryHistory.rows[0].categoryFailure);
assert.equal(categoryHistory.rows[1].categoryFailure, null);
assert.deepEqual(categoryHistory.rows[0].hashes, categoryHistory.rows[1].hashes);

// All game imports follow tracked evidence, exact C/input and primary checks.
const { runSegment, NethackGame } = await import(new URL('js/jsmain.js', runtime));
const { InMemoryStorage } = await import(new URL('js/storage.js', runtime));
const { gamestate_decode } = await import(new URL('js/save.js', runtime));
const { moveloop_core } = await import(new URL('js/allmain.js', runtime));
const state = await import(new URL('js/gstate.js', runtime)); // retain live binding
const { GameDisplay } = await import(new URL('js/game_display.js', runtime));
const { PMNAMES } = await import(new URL('js/monst_data.js', runtime));
const { ONAMES } = await import(new URL('js/objects_data.js', runtime));
const { G_GENOD, LL_ACHIEVE } = await import(new URL('js/const.js', runtime));
const { olfaction } = await import(new URL('js/mondata.js', runtime));
const { decodeScreen, renderCell } = await import(new URL('frozen/screen-decode.mjs', repo));
const { outputs, hashes } = await import(new URL('tools/half-damage-reader-observe.mjs', repo));

function snapshot(g) {
    if (!g.u || !g.level || g.u.umonnum === undefined) return null;
    const u = g.u, loc = u.uz;
    const special = g.sp_levchn?.find(s => s.dlevel?.dnum === loc?.dnum
        && s.dlevel?.dlevel === loc?.dlevel);
    return {
        turn: g.moves, initgend: g.flags?.initgend, female: !!g.flags?.female,
        baseFemale: u.mfemale ?? null, form: u.umonnum, baseForm: u.umonster,
        upolyd: u.umonnum !== u.umonster, hp: u.uhp, mh: u.mh,
        role: g.urole?.name ?? null, alignment: u.ualign?.type,
        alignmentBases: [...(u.ualignbase || [])],
        hallucination: u.uprops?.HALLUC || 0,
        hallucinationResistance: !!(u.uprops?.HALLUC_RES || u.intrinsic?.HHalluc_resistance),
        humanGenocided: !!((g.mvitals?.[PMNAMES.PM_HUMAN]?.mvflags || 0) & G_GENOD),
        helmet: u.uarmh?.otyp ?? null, helmetWorn: u.uarmh?.owornmask || 0,
        level: loc ? { ...loc } : null, special: special?.proto ?? special?.name ?? null,
        hellish: !!g.dungeons?.[loc?.dnum]?.flags?.hellish,
        temperature: g.level.flags?.temperature ?? null,
        olfaction: g.youmonst?.data ? !!olfaction(g.youmonst.data) : null,
        annotation: g.mapseen?.[`${loc?.dnum}:${loc?.dlevel}`]?.custom ?? null,
        restored: !!g.program_state?.beyond_savefile_load,
        gameover: !!g.program_state?.gameover,
    };
}
function savedSummary(storage) {
    const bytes = storage.getItem('save:wizard');
    if (bytes === null) return null;
    return { bytes: Buffer.byteLength(bytes), sha256: sha(bytes),
        state: snapshot(gamestate_decode(JSON.parse(bytes))) };
}
function branchState(check, pair, s, label) {
    check(() => assert.ok(s, `${label}: state exists`));
    if (!s) return;
    check(() => assert.equal(s.initgend, pair === 2 ? 1 : 0, `${label}: original gender`));
    if (pair <= 2) {
        check(() => assert.equal(s.female, pair !== 1, `${label}: expected gender`));
        check(() => assert.equal(s.upolyd, false, `${label}: underlying human`));
    } else if (pair === 3) {
        check(() => assert.ok(s.hallucination > 0, `${label}: real hallucination timeout`));
        check(() => assert.equal(s.hallucinationResistance, false, `${label}: no resistance`));
        check(() => assert.equal(s.upolyd, false, `${label}: human form`));
    } else if (pair === 4) {
        check(() => assert.equal(s.alignment, 1, `${label}: lawful current alignment`));
        check(() => assert.deepEqual(s.alignmentBases, [-1, -1], `${label}: chaotic bases unchanged`));
        check(() => assert.equal(s.helmet, ONAMES.HELM_OF_OPPOSITE_ALIGNMENT, `${label}: actual helm`));
        check(() => assert.ok(s.helmetWorn, `${label}: helm worn`));
    } else if (pair === 5) {
        check(() => assert.equal(s.form, PMNAMES.PM_WATER_NYMPH, `${label}: water nymph form`));
        check(() => assert.equal(s.baseFemale, false, `${label}: underlying male gender`));
        check(() => assert.equal(s.female, true, `${label}: current female gender`));
        check(() => assert.equal(s.role?.m, 'Priest', `${label}: innate male role name`));
        check(() => assert.equal(s.role?.f, 'Priestess', `${label}: distinct female role name`));
    } else if (pair === 6) {
        check(() => assert.equal(s.form, PMNAMES.PM_HILL_GIANT, `${label}: hill giant form`));
        check(() => assert.ok(s.hp < 0 && s.mh > 0, `${label}: pending human death, living monster`));
        check(() => assert.equal(s.humanGenocided, true, `${label}: real human genocide flag`));
    } else if (pair === 7) {
        check(() => assert.equal(s.special, 'baalz', `${label}: scripted destination`));
        check(() => assert.equal(s.hellish, true, `${label}: hellish dungeon`));
        check(() => assert.equal(s.temperature, 1, `${label}: hot level`));
        check(() => assert.equal(s.olfaction, true, `${label}: can smell`));
        check(() => assert.equal(s.annotation, 'Hot camp', `${label}: real annotation`));
    }
}

// The installed display's normal pending-input API, one key per event-loop
// turn. No queue/RNG/game fields are swapped. The EOF promise remains pending
// until outputs are captured, then is rejected only to unwind this run.
async function deferred(part, storage) {
    const display = new GameDisplay(null);
    const run = new NethackGame({ ...part, storage });
    run._pendingDisplay = display;
    const keys = Array.from(part.moves, c => c.charCodeAt(0));
    let consumed = 0, stop, atEnd;
    const exhausted = new Promise(resolve => { atEnd = resolve; });
    const end = new Error('deferred observation finished');
    display.onEmptyQueue = async () => {
        await setImmediate();
        if (consumed < keys.length) return keys[consumed++];
        return new Promise((_resolve, reject) => {
            stop = () => reject(end);
            atEnd('pending-input');
        });
    };
    const operation = (async () => {
        try {
            await run.start();
            while (!state.game.program_state?.gameover) await moveloop_core();
        } catch (error) { if (error !== end) throw error; }
    })();
    try {
        const ended = await Promise.race([exhausted, operation.then(() => 'game-exit')]);
        assert.equal(consumed, keys.length, 'all deferred keys consumed');
        return { output: structuredClone(outputs(run)), ended, consumed };
    } finally {
        if (stop) stop();
        await operation;
    }
}

const expectedLogText = 'wizard the neutral male human Wizard entered the dungeon';
let logEntries = [], logFirstSeen = null;
const report = { evidence: 'Fresh installed-runtime ordinary controls; native comparison is inherited separately. Original diagnostic and metadata correction retained.',
    inputLockSHA256: sha(lockBytes), recipeSHA256: lock.recipeSHA256,
    tuplesSHA256: lock.tuplesSHA256, rawSHA256: sha(rawBytes),
    passiveProbeInvocations: 1, modes: {} };
for (const mode of ['observed', 'plain', 'deferred']) {
    const storage = new InMemoryStorage(), rows = [];
    for (const [index, part] of recipe.segments.entries()) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        const trace = [], failures = [], before = savedSummary(storage);
        const check = fn => { try { fn(); } catch (e) { failures.push(e.message); } };
        let output, error = null, ended = null, consumed = null;
        try {
            if (mode === 'observed') globalThis.__step_snapshot = { step: '*', cb(g, step) {
                // Separate source assertion, sharing the original passive callback.
                if (index === 0) {
                    const found = (g.gamelog || []).filter(entry => entry.text === expectedLogText);
                    if (found.length) {
                        logFirstSeen ??= step;
                        logEntries = found.map(entry => ({ ...entry }));
                    }
                }
                const s = snapshot(g);
                if (!s) return;
                const last = trace.at(-1);
                if (last && JSON.stringify(last.state) === JSON.stringify(s)) last.lastStep = step;
                else trace.push({ firstStep: step, lastStep: step, state: s });
            } };
            if (mode === 'deferred') {
                ({ output, ended, consumed } = await deferred(part, storage));
            } else {
                const run = await runSegment({ ...part, storage });
                output = structuredClone(outputs(run));
            }
        } catch (e) { error = String(e?.stack || e); }
        finally {
            if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
        const after = savedSummary(storage);
        check(() => assert.equal(error, null));
        if (!output) {
            rows.push({ name: part.name, error, failures, before, after, trace });
            continue;
        }
        check(() => assert.equal(output.screens.length, part.moves.length + 1, 'all key boundaries'));
        check(() => assert.deepEqual(output.slices.flat(), output.calls, 'all RNG slices'));
        const texts = output.screens.map(screen => decodeScreen(screen)
            .map(line => line.map(renderCell).join('').trimEnd()).join('\n'));
        const record = { segments: Array(index).fill(null).concat([{ ...part,
            steps: output.screens.map((screen, step) => ({ screen,
                key: step ? part.moves[step - 1] : null, cursor: output.cursors[step],
                rng: output.slices[step], animation_frames: output.frames[step] })) }]) };
        const primary = recipe.branchAssertions[index];
        const sourcePredictionFailures = branchAssertionErrors({ ...recipe,
            branches: [primary.branch], branchAssertions: [primary] }, record);
        const integrity = recordingIntegrityErrors({ segments: [record.segments[index]] });
        check(() => assert.deepEqual(integrity, []));
        const digest = hashes(output);
        if (mode === 'observed') {
            check(() => assert.ok(trace.length, 'fresh live state observed'));
            if (index % 2 === 0) {
                check(() => assert.equal(before, null, 'no leftover save at new pair'));
                check(() => assert.ok(after, 'real keyboard save exists'));
                check(() => assert.ok(texts.some(t => t.includes('Be seeing you...')), 'save completed'));
                branchState(check, Math.floor(index / 2), after?.state, 'stored state');
                check(() => assert.ok(trace.some(t => !t.state.gameover), 'live producer observed'));
            } else {
                check(() => assert.ok(before, 'real prior save exists'));
                check(() => assert.equal(after, null, 'keyboard default n deleted restored save'));
                check(() => assert.ok(trace[0]?.state.restored, 'actual dorecover reached'));
                check(() => assert.deepEqual(trace[0]?.state.level, before?.state.level, 'restored saved level'));
                branchState(check, Math.floor(index / 2), trace[0]?.state, 'first restored state');
            }
            if (expectations.unchangedOriginalSegments.includes(index)) check(() => assert.deepEqual(digest, oldRows[index].hashes, 'original six full outputs unchanged'));
            if (oldNegative[part.name]) check(() => assert.deepEqual(digest, oldNegative[part.name], 'original negative five hashes'));
        } else {
            check(() => assert.deepEqual(digest, report.modes.observed[index].hashes, `${mode}/observer full output equality`));
            check(() => assert.deepEqual(before, report.modes.observed[index].before, `${mode}/observer input storage equality`));
            check(() => assert.deepEqual(after, report.modes.observed[index].after, `${mode}/observer resulting storage equality`));
        }
        const feedback = [];
        if (mode === 'observed') for (const [step, text] of texts.entries()) {
            for (const line of text.split('\n').slice(0, 3))
                if (/welcome|cosmic|studio audience|feel .*inside|nymph|giant|helmet|helm|hot here|smoke|remember this level|keep the save|Really save|Be seeing you|Saving|teleport|You feel/.test(line)
                    && !feedback.some(f => f.line === line)) feedback.push({ step, line });
        }
        rows.push({ name: part.name, error, passed: failures.length === 0, failures,
            keys: part.moves.length, boundaries: output.screens.length, calls: output.calls.length,
            frames: output.frames.flat().length, hashes: digest, sourcePredictionFailures,
            integrity, ended, consumed, before, after, ...(mode === 'observed' ? { trace, feedback } : {}) });
    }
    report.modes[mode] = rows;
}
// C allmain.c:919-923 uses LL_ACHIEVE. This is fresh JS log-state evidence,
// not a claim about the native logfile or visible chronicle categories.
const logFailures = [];
const checkLog = fn => { try { fn(); } catch (error) { logFailures.push(error.message); } };
checkLog(() => assert.equal(LL_ACHIEVE, 2));
checkLog(() => assert.equal(logEntries.length, 1, 'one genuine welcome event'));
checkLog(() => assert.equal(logEntries[0]?.text, expectedLogText));
checkLog(() => assert.equal(logEntries[0]?.flags, LL_ACHIEVE, 'C welcome uses LL_ACHIEVE'));
checkLog(() => assert.equal(logEntries[0]?.turn, 1));
checkLog(() => assert.equal(logFirstSeen, 0));
report.logCategory = { passed: logFailures.length === 0, failures: logFailures,
    firstSeen: logFirstSeen, entries: logEntries, nativeLogfileTested: false };
// Keep fresh state/storage hashes instead of duplicating the full diagnostic traces.
const compactReport = { ...report, modes: Object.fromEntries(Object.entries(report.modes)
    .map(([mode, rows]) => [mode, rows.map(({ trace, before, after, feedback, ...row }) => ({
        ...row, beforeSHA256: sha(JSON.stringify(before)), afterSHA256: sha(JSON.stringify(after)),
        ...(trace ? { traceSHA256: sha(JSON.stringify(trace)), feedbackSHA256: sha(JSON.stringify(feedback)) } : {}),
    }))])) };
if (target) fs.writeFileSync(target, JSON.stringify(compactReport, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ modes: Object.fromEntries(Object.entries(report.modes)
    .map(([mode, rows]) => [mode, { passed: rows.filter(r => r.passed && !r.sourcePredictionFailures.length).length, total: rows.length }])),
    primaryBranches: 16, negativeHashes: 20, logCategory: report.logCategory.passed }));
if (Object.values(report.modes).some(rows => rows.some(r => !r.passed || r.sourcePredictionFailures.length))
    || !report.logCategory.passed) process.exitCode = 1;
