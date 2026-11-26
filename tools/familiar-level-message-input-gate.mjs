// src/do.c:1448 familiar_level_msg and first-creation trigger in goto_level.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
assert(process.argv.length <= 3 && !process.argv[2]?.startsWith('--'),
    'usage: familiar-level-message-input-gate.mjs [new-report.json]');
const target = process.argv[2];
assert(!target || !fs.existsSync(target), 'report must be new');
const repo = new URL('../', import.meta.url);
const runtime = repo;
const packet = new URL('gen-sessions/evidence/familiar-level-message/', import.meta.url);
const read = name => fs.readFileSync(name === 'familiar-level-message.json'
    ? new URL('tools/gen-sessions/recipes/familiar-level-message.json', repo)
    : new URL(name, packet));
const sha = data => createHash('sha256').update(data).digest('hex');
const pins = {
    "source-probe.mjs": "513d3e19bcd23f5c4eb3d80a3b30d56b1163d2cec1b1c7f77569f0d32fd0544c",
    "baseline-runtime.json": "50a18d5fbd3b7c3cb89b049d931e936124b5b89cec61ed195dbc5220985d22a6",
    "review/input-lock.json": "861a85a2898f2d5c002e0121e4a302cd5b2acce4425ae28e3c914383c021fc0b",
    "review/source-predictions.json": "a9ffdc229cef260e5c901c9b8ac4b3605682007ff3d14f6ead78dc901fbee1d3",
    "review/negative-hashes.json": "b87761bcc7cec23de832d7c1874ca6bdab6a1dd3867b381e09645ffffff36e93"
};
for (const [name,expected] of Object.entries(pins)) assert.equal(sha(read(name)), expected, name);
const lockBytes = read('review/input-lock.json');
const lock = JSON.parse(lockBytes);
const recipeBytes = read(lock.recipe);
assert.equal(sha(recipeBytes), lock.recipeSHA256);
const recipe = JSON.parse(recipeBytes);
const predictions = JSON.parse(read('review/source-predictions.json'));
assert.equal(sha(read('review/source-predictions.json')),lock.predictionsSHA256);
const tuples = recipe.segments.map(part => lock.fields.map(field => ({
    field, present: Object.hasOwn(part, field), ...(Object.hasOwn(part, field) ? {value:part[field]} : {}),
})));
assert.deepEqual(tuples,lock.tuples);
assert.equal(sha(JSON.stringify(tuples)),lock.tuplesSHA256);
assert.equal(sha(JSON.stringify(recipe.segments.map(part => [null,...part.moves]))),lock.allKeysSHA256);
const oldBytes = fs.readFileSync(new URL(lock.priorRecipe,repo));
assert.equal(sha(oldBytes),lock.priorRecipeSHA256);
assert.deepEqual(recipe.segments.slice(0,2),JSON.parse(oldBytes).segments.slice(0,2));
const rawBytes = fs.readFileSync(new URL('tools/gen-sessions/generated/familiar-level-message.session.json',repo));
assert.equal(sha(rawBytes),'37dc4229d3d117ff9447f11a65a356aaaef822157ee615a69813f42e0a8cd78e');
const raw=JSON.parse(rawBytes);
assert.equal(raw.source,'c');assert.equal(raw.version,5);assert.equal(raw.segments.length,7);
for (const name of Object.keys(recipe)) if(name!=='segments') assert.deepEqual(raw[name],recipe[name]);
for (const [i,part] of recipe.segments.entries()) {
    for (const name of lock.fields) {
        assert.equal(Object.hasOwn(raw.segments[i],name),Object.hasOwn(part,name));
        assert.deepEqual(raw.segments[i][name],part[name]);
    }
    assert.deepEqual(raw.segments[i].steps.map(step=>step.key),[null,...part.moves]);
}
assert.deepEqual(recordingIntegrityErrors(raw),[]);
assert.deepEqual(branchAssertionErrors(recipe,raw),[]);
const map=Object.fromEntries(Object.keys(JSON.parse(read('baseline-runtime.json')))
    .map(name=>[name,sha(fs.readFileSync(new URL(name,runtime)))]));
const mapBytes=Buffer.from(JSON.stringify(map,null,2)+'\n');
function verifyPins() {
    for (const [name,digest] of Object.entries(map))
        assert.equal(sha(fs.readFileSync(new URL(name,runtime))),digest,name);
}
verifyPins();
const {runSegment,NethackGame}=await import('../js/jsmain.js');
const {InMemoryStorage}=await import('../js/storage.js');
const {moveloop_core}=await import('../js/allmain.js');
const state=await import('../js/gstate.js');
const {GameDisplay}=await import('../js/game_display.js');
const {Blind,Hallucination,Halluc_resistance}=await import('../js/youprop.js');
const {ONAMES}=await import('../js/objects_data.js');
const {W_TOOL}=await import('../js/const.js');
const {outputs,hashes}=await import('./half-damage-reader-observe.mjs');
const {decodeScreen,renderCell}=await import('../frozen/screen-decode.mjs');
function cemetery(chain) {
    const names = [];
    for (let row = chain; row; row = row.next) names.push(row.who);
    return names;
}
function snapshot(g) {
    if (!g.u || !g.level || !g.u.uz) return null;
    const names = cemetery(g.level.bonesinfo);
    return { turn: g.moves, level: { ...g.u.uz }, player: g.plname,
        bonesNames: names, matching: names.some(name => name.startsWith(g.plname + '-')),
        numbones: g.u.uroleplay?.numbones || 0,
        readingBones: !!g.program_state?.reading_bonesfile,
        blind: !!Blind(), cachedBlind: g.u.ublind ?? null,
        intrinsicBlind: g.u.intrinsic?.HBlinded || 0,
        blockedBlind: g.u.blocked?.BLINDED || 0,
        eyewear: g.u.ublindf?.otyp ?? null, eyewearMask: g.u.ublindf?.owornmask || 0,
        hallucination: !!Hallucination(), hallucinationTimeout: g.u.intrinsic?.HHallucination || 0,
        hallucinationResistance: !!Halluc_resistance(),
        hp: g.u.uhp, gameover: !!g.program_state?.gameover,
        savedLevels: [...(g.saved_levels?.keys() || [])],
    };
}
function storageSummary(storage) {
    const rows = [];
    for (let i = 0; i < storage.length; ++i) {
        const key = storage.key(i), bytes = storage.getItem(key);
        if (!key.startsWith('bones:')) continue;
        const saved = JSON.parse(bytes);
        rows.push({ key, bytes: Buffer.byteLength(bytes), sha256: sha(bytes),
            bonesNames: cemetery(saved.bonesinfo), wizardBones: saved.flags?.wizard_bones || 0 });
    }
    return rows.sort((a, b) => a.key.localeCompare(b.key));
}

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


const report = { evidence: 'Ordinary bones arrival, saved-level return and five-stream reader checks.',
    runtimeSHA256: sha(mapBytes), inputLockSHA256: sha(lockBytes),
    recipeSHA256: lock.recipeSHA256, tuplesSHA256: lock.tuplesSHA256,
    passiveProbeInvocations: 1, modes: {} };
for (const mode of ['observed', 'plain', 'deferred']) {
    const storage = new InMemoryStorage(), rows = [];
    for (const [index, part] of recipe.segments.entries()) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        const trace = [], failures = [], before = storageSummary(storage);
        const check = fn => { try { fn(); } catch (error) { failures.push(error.message); } };
        let output, error = null, ended = null, consumed = null;
        try {
            if (mode === 'observed') globalThis.__step_snapshot = { step: '*', cb(g, step) {
                const s = snapshot(g);
                if (!s) return;
                const last = trace.at(-1);
                if (last && JSON.stringify(last.state) === JSON.stringify(s)) last.lastStep = step;
                else trace.push({ firstStep: step, lastStep: step, state: s });
            } };
            if (mode === 'deferred') ({ output, ended, consumed } = await deferred(part, storage));
            else output = structuredClone(outputs(await runSegment({ ...part, storage })));
        } catch (e) { error = String(e?.stack || e); }
        finally {
            if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
        const after = storageSummary(storage);
        check(() => assert.equal(error, null));
        if (!output) { rows.push({ name: part.name, passed: false, failures, error, before, after }); continue; }
        check(() => assert.equal(output.screens.length, part.moves.length + 1, 'all boundaries captured'));
        check(() => assert.deepEqual(output.slices.flat(), output.calls, 'all RNG slices'));
        const digest = hashes(output);
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
        const arrival = trace.find(row => row.state.level.dnum === 0 && row.state.level.dlevel === 6
            && row.state.matching && !row.state.readingBones)?.state;
        if (mode === 'observed') {
            check(() => assert.ok(trace.length, 'fresh passive state exists'));
            if (index === 0) {
                check(() => assert.equal(before.length, 0, 'fresh shared store'));
                check(() => assert.equal(after.length, 1, 'real keyboard bones producer'));
                check(() => assert.equal(after[0]?.key, 'bones:0.6'));
                check(() => assert.ok(after[0]?.bonesNames.some(name => name.startsWith('wizard-'))));
                check(() => assert.equal(after[0]?.wizardBones, 1));
                check(() => assert.ok(texts.some(text => text.includes('Save bones?'))));
            } else {
                check(() => assert.equal(before.length, 1, 'prior real bones file present'));
                check(() => assert.deepEqual(after, before, 'retained bones bytes unchanged'));
                check(() => assert.ok(texts.some(text => text.includes('Get bones?'))));
                if (index === 6) {
                    check(() => assert.ok(!texts.some(text => text.includes('Unlink bones?'))));
                    check(() => assert.ok(trace.some(row => row.state.level.dlevel === 6
                        && !row.state.matching && row.state.numbones === 0), 'declined bones, new level'));
                } else {
                    check(() => assert.ok(texts.some(text => text.includes('Unlink bones?'))));
                    check(() => assert.ok(arrival, 'actual same-name bones arrival'));
                    if (arrival) {
                        check(() => assert.equal(arrival.numbones, 1));
                        check(() => assert.equal(arrival.hallucination, index === 2 || index === 4));
                        check(() => assert.equal(arrival.blind, index === 3 || index === 4));
                        check(() => assert.equal(arrival.hallucinationResistance, false));
                        if (index === 2 || index === 4)
                            check(() => assert.ok(arrival.hallucinationTimeout > 0, 'real active timeout'));
                        if (index === 3 || index === 4) {
                            check(() => assert.equal(arrival.eyewear, ONAMES.BLINDFOLD));
                            check(() => assert.ok(arrival.eyewearMask & W_TOOL, 'real worn blindfold'));
                        }
                    }
                    if (index === 5) {
                        const route = [];
                        for (const row of trace) {
                            const loc = `${row.state.level.dnum}:${row.state.level.dlevel}`;
                            if (route.at(-1) !== loc) route.push(loc);
                        }
                        check(() => assert.deepEqual(route, ['0:1', '0:6', '0:1', '0:6'], 'actual revisit route'));
                        check(() => assert.equal(trace.at(-1)?.state.numbones, 1, 'return uses saved level, no second bones load'));
                        check(() => assert.ok(trace.at(-1)?.state.matching, 'cemetery persists on return'));
                        check(() => assert.ok(trace.at(-1)?.state.savedLevels.includes('0:6'), 'return file exists'));
                    }
                }
            }
        } else {
            check(() => assert.deepEqual(digest, report.modes.observed[index].hashes, `${mode}/observer complete five-stream equality`));
            check(() => assert.deepEqual(before, report.modes.observed[index].before, `${mode}/observer storage before`));
            check(() => assert.deepEqual(after, report.modes.observed[index].after, `${mode}/observer storage after`));
        }
        const messageEvents = [];
        for (const [step, text] of texts.entries()) {
            for (const [kind, messages] of Object.entries(predictions.messageTables)) {
                for (const message of messages) if (text.includes(message)
                    && !(step && texts[step - 1].includes(message)))
                    messageEvents.push({ step, kind, message });
            }
        }
        const events = [];
        if (mode === 'observed') for (const row of trace) {
            const key = JSON.stringify([row.state.level, row.state.matching, row.state.numbones,
                row.state.readingBones, row.state.blind, row.state.hallucination,
                row.state.eyewear, row.state.gameover]);
            if (!events.length || events.at(-1).key !== key)
                events.push({ key, step: row.firstStep, state: row.state });
        }
        rows.push({ name: part.name, passed: failures.length === 0, failures, error,
            keys: part.moves.length, boundaries: output.screens.length, calls: output.calls.length,
            frames: output.frames.flat().length, hashes: digest, sourcePredictionFailures,
            integrity, ended, consumed, before, after,
            ...(mode === 'observed' ? { arrival: arrival || null,
                traceSHA256: sha(JSON.stringify(trace)),
                events: events.map(({ key, ...row }) => row), messageEvents } : {}) });
    }
    report.modes[mode] = rows;
}
verifyPins();
report.runtimePinsAfter=Object.keys(map).length;
const negative=JSON.parse(read('review/negative-hashes.json'));
for (const rows of Object.values(report.modes)) for (const i of negative.indices)
    assert.deepEqual(rows[i].hashes,negative.hashes[rows[i].name]);
assert(Object.values(report.modes).every(rows=>rows.length===7
    && rows.every(row=>row.passed && !row.sourcePredictionFailures.length)));
if(target) fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report,null,2));
