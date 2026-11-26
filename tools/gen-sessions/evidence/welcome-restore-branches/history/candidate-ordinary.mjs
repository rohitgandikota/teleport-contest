// One fixed-input batch. Observation never edits the game or its saved bytes.
import { pins } from './preflight.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';

assert.equal(process.argv.length, 2, 'no selectors or alternate runtime');
const packet = new URL('./', import.meta.url);
const repo = new URL('../../../', packet);
const runtime = new URL('./candidate/', packet);
const source = new URL('./source/', packet);
const original = new URL('../welcome-restore-source-audit/', packet);
const sha = b => createHash('sha256').update(b).digest('hex');
const read = p => fs.readFileSync(new URL(p, source));
const lockBytes = read('review/input-lock.json');
assert.equal(sha(lockBytes), 'c4fef7a3d80808ae1ae2ec72b75ab4460d6d1afad2f17fcc72889f2a54ddcb80');
const lock = JSON.parse(lockBytes);
const expectations = JSON.parse(fs.readFileSync(new URL('review/candidate-expectations.json', packet)));
const recipeBytes = read(lock.recipe);
assert.equal(sha(recipeBytes), lock.recipeSHA256);
const recipe = JSON.parse(recipeBytes);
assert.equal(sha(read('review/source-predictions.json')), lock.predictionsSHA256);
const tuples = recipe.segments.map(p => lock.fields.map(field => ({
    field, present: Object.hasOwn(p, field),
    ...(Object.hasOwn(p, field) ? { value: p[field] } : {}),
})));
assert.deepEqual(tuples, lock.tuples);
assert.equal(sha(JSON.stringify(tuples)), lock.tuplesSHA256);
assert.equal(sha(JSON.stringify(recipe.segments.map(p => [null, ...p.moves]))), lock.allKeysSHA256);
const oldSealBytes = fs.readFileSync(new URL('SEAL.json', original));
assert.equal(sha(oldSealBytes), lock.original.sealSHA256);
const oldSeal = JSON.parse(oldSealBytes);
const oldManifestBytes = fs.readFileSync(new URL('MANIFEST.json', original));
assert.equal(sha(oldManifestBytes), oldSeal.manifestSHA256);
function verifyOriginal() {
    for (const [path, digest] of Object.entries(JSON.parse(oldManifestBytes).files))
        assert.equal(sha(fs.readFileSync(new URL(path, original))), digest, path);
}
verifyOriginal();
const oldRecipe = JSON.parse(fs.readFileSync(new URL('welcome-restore.json', original)));
assert.deepEqual(recipe.segments.slice(0, 6), oldRecipe.segments);
assert.deepEqual(recipe.branchAssertions.slice(0, 6), oldRecipe.branchAssertions);
assert.deepEqual(recipe.branches.slice(0, 6), oldRecipe.branches);
const oldRows = JSON.parse(fs.readFileSync(new URL('review/proposal-01-probe.json', original))).rows;
const oldNegative = JSON.parse(fs.readFileSync(new URL('review/negative-hashes.json', original))).hashes;
const mapBytes = fs.readFileSync(new URL('runtime.json', runtime));
assert.equal(sha(mapBytes), pins.candidateRuntimeSHA256);
const map = JSON.parse(mapBytes);
assert.equal(Object.keys(map).length, 280);
function verifyRuntime() {
    for (const [path, digest] of Object.entries(map)) {
        const source = new URL(path, runtime);
        assert.equal(sha(fs.readFileSync(source)), digest, path);
        assert.notEqual(fs.realpathSync(source), new URL(path, repo).pathname, path);
    }
}
verifyRuntime();
for (const pin of JSON.parse(read('review/helper-pins.json')))
    assert.equal(sha(fs.readFileSync(new URL(pin.path, repo))), pin.sha256, pin.path);
for (const pin of JSON.parse(read('review/source-coverage.json')).ranges) {
    const bytes = fs.readFileSync(new URL(pin.path, repo));
    assert.equal(sha(bytes), pin.fileSHA256, pin.path);
}
const target = new URL('review/ordinary-candidate.json', packet);
assert.equal(fs.existsSync(target), false, 'never overwrite a prior attempt');
const { branchAssertionErrors, recordingIntegrityErrors } = await import(new URL('tools/gen-sessions/assertions.mjs', repo));
assert.deepEqual(branchAssertionErrors(recipe), []);

// All game imports follow the original seal, exact inputs and fixed graph.
const { runSegment, NethackGame } = await import(new URL('js/jsmain.js', runtime));
const { InMemoryStorage } = await import(new URL('js/storage.js', runtime));
const { gamestate_decode } = await import(new URL('js/save.js', runtime));
const { moveloop_core } = await import(new URL('js/allmain.js', runtime));
const state = await import(new URL('js/gstate.js', runtime)); // retain live binding
const { GameDisplay } = await import(new URL('js/game_display.js', runtime));
const { PMNAMES } = await import(new URL('js/monst_data.js', runtime));
const { ONAMES } = await import(new URL('js/objects_data.js', runtime));
const { G_GENOD } = await import(new URL('js/const.js', runtime));
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

const report = { evidence: 'Fresh candidate ordinary controls. Source-derived positive classification is separate metadata; original diagnostic retained. Native comparison is separate.',
    inputLockSHA256: sha(lockBytes), recipeSHA256: lock.recipeSHA256,
    tuplesSHA256: lock.tuplesSHA256, runtimeSHA256: pins.candidateRuntimeSHA256,
    baselineRuntimeSHA256: lock.runtimeSHA256,
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
        console.log(JSON.stringify({ mode, name: part.name, passed: failures.length === 0,
            failures, sourcePredictionFailures, boundaries: output.screens.length }));
    }
    report.modes[mode] = rows;
}
verifyRuntime();
verifyOriginal();
report.runtimePinsAfter = 280;
report.originalMembersAfter = 18;
// Keep fresh state/storage hashes instead of duplicating the full diagnostic traces.
const compactReport = { ...report, modes: Object.fromEntries(Object.entries(report.modes)
    .map(([mode, rows]) => [mode, rows.map(({ trace, before, after, feedback, ...row }) => ({
        ...row, beforeSHA256: sha(JSON.stringify(before)), afterSHA256: sha(JSON.stringify(after)),
        ...(trace ? { traceSHA256: sha(JSON.stringify(trace)), feedbackSHA256: sha(JSON.stringify(feedback)) } : {}),
    }))])) };
fs.writeFileSync(target, JSON.stringify(compactReport, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.modes)
    .map(([mode, rows]) => [mode, { passed: rows.filter(r => r.passed).length, total: rows.length }]))));
if (Object.values(report.modes).some(rows => rows.some(r => !r.passed || r.sourcePredictionFailures.length))) process.exitCode = 1;
