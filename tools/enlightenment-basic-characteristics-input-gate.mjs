// Normal imports, real keys, read-only observation and equality of all five outputs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { money_cnt, hidden_gold } from '../js/invent.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const recipePath = args[0] || fileURLToPath(new URL(
    'gen-sessions/recipes/enlightenment-basic-characteristics.json', import.meta.url));
const recipe = JSON.parse(fs.readFileSync(recipePath));
const cases = JSON.parse(fs.readFileSync(new URL('enlightenment-basic-characteristics-input-cases.json', import.meta.url)));
const plain = process.argv.includes('--plain');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
const runs = [], traces = [];
try {
    for (const part of recipe.segments) {
        const trace = [];
        if (!plain) {
            globalThis.__step_snapshot = { step: '*', cb(game, step) {
                trace.push({ step, wallet: money_cnt(game.invent),
                    hidden: hidden_gold(game.invent, false), ac: game.u.uac,
                    wizard: game.wizard, cursedGloves: !!game.u.uarmg?.cursed });
            } };
        }
        const run = await runSegment({ ...part, storage: new InMemoryStorage() });
        runs.push({ screens: run.getScreens(), cursors: run.getCursors(),
            rng: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep() });
        traces.push(trace);
    }
} finally {
    if (previous)
        Object.defineProperty(globalThis, '__step_snapshot', previous);
    else
        delete globalThis.__step_snapshot;
}
if (plain) {
    await new Promise(resolve => process.stdout.write(JSON.stringify(runs), resolve));
    process.exit(0);
}
// All observed game runs have completed before the one unobserved worker starts.
const unobserved = spawnSync(process.execPath, [fileURLToPath(import.meta.url), recipePath, '--plain'],
    { encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
assert.equal(unobserved.status, 0, unobserved.stderr || String(unobserved.error));
assert.deepEqual(runs, JSON.parse(unobserved.stdout), 'all five collections are observer-neutral');

const checks = [], failures = [];
function check(name, operation) {
    try {
        operation();
        checks.push(name);
    } catch (error) {
        failures.push({ name, error: error.message });
    }
}
const hashes = runs.map(run => Object.fromEntries(
    Object.entries(run).map(([key, value]) => [key, hash(value)])));
for (const [index, expected] of Object.entries(cases.negativeHashes)) {
    check(`ordinary control ${index} keeps all five original hashes`, () =>
        assert.deepEqual(hashes[index], expected));
}
for (const [index, step, x, y, text] of cases.visible) {
    check(`visible case ${index} step ${step}: ${text}`, () => {
        const row = decodeScreen(runs[index].screens[step])[y];
        assert.equal(row.slice(x, x + text.length), text);
    });
}
for (const expected of cases.producerStates) {
    check(`actual producer state case ${expected.segment} step ${expected.step}`, () => {
        const actual = traces[expected.segment].find(state => state.step === expected.step);
        assert.ok(actual);
        for (const [key, value] of Object.entries(expected)) {
            if (key !== 'segment' && key !== 'step')
                assert.equal(actual[key], value, key);
        }
    });
}
check('hallucinated currency draws once at the actual inspection input', () => {
    const expected = cases.hallucinatedCurrency;
    const calls = runs[expected.segment].slices[expected.step]
        .filter(entry => entry.includes(expected.call));
    assert.equal(calls.length, 1);
});
const recording = { version: 5, source: 'js', segments: recipe.segments.map((part, index) => ({
    ...part, steps: runs[index].screens.map((screen, step) => ({
        key: step ? Array.from(part.moves)[step - 1] : null,
        screen, cursor: runs[index].cursors[step], rng: runs[index].slices[step],
        animation_frames: runs[index].frames[step],
    })),
})) };
check('all executable recipe cells match their actual boundaries', () =>
    assert.deepEqual(branchAssertionErrors(recipe, recording), []));
if (args[1]) {
    const raw = JSON.parse(fs.readFileSync(args[1]));
    check('optional raw keeps c/v5, five fields including presence and every key', () => {
        assert.equal(raw.source, 'c');
        assert.equal(raw.version, 5);
        assert.equal(raw.segments.length, recipe.segments.length);
        for (const [index, part] of recipe.segments.entries()) {
            for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
                assert.equal(Object.hasOwn(raw.segments[index], field), Object.hasOwn(part, field));
                assert.deepEqual(raw.segments[index][field], part[field]);
            }
            assert.deepEqual(raw.segments[index].steps.map(step => step.key), [null, ...part.moves]);
        }
        assert.deepEqual(recordingIntegrityErrors(raw), []);
    });
    check('optional native basics and final-tense witnesses', () =>
        assert.deepEqual(branchAssertionErrors(recipe, raw), []));
}
console.log(JSON.stringify({ evidence: args[1] ? 'JS and optional native visible witnesses'
    : 'ordinary JS inputs only; fresh C pending', checks, failures,
    observerNeutralAllFiveCollections: true,
    counts: runs.map(run => ({ boundaries: run.screens.length, calls: run.rng.length,
        frames: run.frames.reduce((sum, frames) => sum + frames.length, 0) })), hashes }, null, 4));
if (failures.length)
    process.exitCode = 1;
