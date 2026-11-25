// Ordinary keys with read-only state observation and deferred-input equality.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {NethackGame, runSegment} from '../js/jsmain.js';
import {GameDisplay} from '../js/game_display.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {moveloop_core} from '../js/allmain.js';
import {Free_action, Sleep_resistance} from '../js/youprop.js';
import {getRngLog} from '../js/rng.js';
import {W_RINGL} from '../js/const.js';
import {ONAMES as O} from '../js/objects_data.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

assert.ok(process.argv.length <= 3 && !process.argv[2]?.startsWith('--'));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hashes = value => Object.fromEntries(Object.entries(value).map(([k, v]) => [k, hash(v)]));
const outputs = run => ({screens:run.getScreens(), cursors:run.getCursors(),
    rng:[...run.getRngLog()], slices:run.getRngSlices(), frames:run.getAnimationFramesByStep()});
const recipeBytes = fs.readFileSync(new URL('./gen-sessions/recipes/free-action-owner-contract.json', import.meta.url));
assert.equal(digest(recipeBytes), 'f466bfa621309cf4db020e8c5a49cf141fe314788e58c9b4be9a5347e009b3cb');
const recipe = JSON.parse(recipeBytes);
const nativeBytes = fs.readFileSync(new URL('./gen-sessions/generated/free-action-owner-contract.session.json', import.meta.url));
const nativeSHA256 = digest(nativeBytes);
assert.equal(nativeSHA256, '08fc72de3b2cd849ec8eb96b17f491c83eea45be56dcf37f32048a4409389d72');
const native = JSON.parse(nativeBytes);
assert.equal(native.source, 'c'); assert.equal(native.version, 5);
assert.equal(native.segments.length, 10); assert.equal(recipe.segments.length, 10);
assert.equal(recipe.requireBranchAssertions, true);
assert.equal(recipe.branchAssertions.length, 10);
assert.deepEqual(recipe.branchAssertions.map(a => a.branch), recipe.branches);
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(recipe, native), []);
const counts = {boundaries:0, rngCalls:0, frames:0};
for (const [i, part] of native.segments.entries()) {
    const expected = recipe.segments[i];
    for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
        assert.ok(Object.hasOwn(part, field) && Object.hasOwn(expected, field));
        assert.deepEqual(part[field], expected[field]);
    }
    assert.deepEqual(part.steps.map(s => s.key), [null, ...expected.moves]);
    for (const step of part.steps) {
        counts.boundaries++;
        counts.rngCalls += step.rng.length;
        counts.frames += (step.animation_frames || []).length;
    }
}
assert.deepEqual(counts, {boundaries:969, rngCalls:23279, frames:8});
assert.deepEqual(Object.keys(recipe.unchangedOutputHashes).sort(), [
    'plain-sleeping', 'ring-plain-sleeping', 'ring-timed-paralysis',
    'ring-timed-sleeping', 'sleep-resistant-timed-sleeping'].sort());

function snapshot(step) {
    return {step, turn:game.moves, intrinsic:game.u?.intrinsic?.HFree_action || 0,
        extrinsic:game.u?.uprops?.FREE_ACTION || 0,
        legacy:game.u?.wiz_intrinsic_timeouts?.FREE_ACTION ?? null,
        legacyBase:game.u?.wiz_intrinsic_base_props?.FREE_ACTION ?? null,
        freeAction:Free_action(), sleepResistance:Sleep_resistance(),
        rings:(game.invent || []).filter(o => o.otyp === O.RIN_FREE_ACTION)
            .map(o => ({mask:o.owornmask || 0, letter:o.invlet})),
        gameover:!!game.program_state?.gameover};
}
async function replay(input, observed) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let run;
    try {
        if (observed) globalThis.__step_snapshot = {step:'*', cb(_g, step) { states.push(snapshot(step)); }};
        run = await runSegment({...input, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    return {output:outputs(run), states};
}
async function deferred(input) {
    const run = new NethackGame({...input, storage:new InMemoryStorage()});
    const display = new GameDisplay(null);
    const end = new Error('supplied keys ended');
    let used = 0, settled = false, signalEnd, release, timer;
    const atEnd = new Promise(resolve => { signalEnd = resolve; });
    display.onEmptyQueue = async () => {
        await setImmediate();
        if (used === input.moves.length) {
            signalEnd();
            return new Promise((_, reject) => { release = () => reject(end); });
        }
        return input.moves.charCodeAt(used++);
    };
    run._pendingDisplay = display;
    const work = (async () => {
        try {
            await run.start();
            for (let i = 0; i < 2048 && !game.program_state?.gameover; i++) await moveloop_core();
        } catch (error) { if (error !== end) throw error; }
        finally { settled = true; }
    })();
    try {
        await Promise.race([atEnd, work.then(() => { throw Error('ended before blocked input'); }),
            new Promise((_, reject) => { timer = setTimeout(() => reject(Error('input timeout')), 3000); })]);
        const before = snapshot(used), rng = [...getRngLog()];
        await setImmediate();
        assert.equal(settled, false);
        assert.deepEqual(snapshot(used), before); assert.deepEqual(getRngLog(), rng);
    } finally {
        clearTimeout(timer); if (release) release(); await work;
    }
    assert.equal(used, input.moves.length);
    return outputs(run);
}

const deadline = setTimeout(() => process.exit(2), 55000);
const reports = [], recorded = [];
for (const part of recipe.segments) {
    const row = {name:part.name, checks:[]};
    const check = (name, operation) => {
        try { operation(); row.checks.push({name, pass:true}); }
        catch (error) { row.checks.push({name, pass:false, error:error.message.slice(0, 1200)}); }
    };
    try {
        const input = Object.fromEntries(['seed', 'datetime', 'nethackrc', 'moves'].map(k => [k, part[k]]));
        const plain = await replay(input, false), seen = await replay(input, true);
        const late = await deferred(input), h = hashes(plain.output), states = seen.states;
        check('all outputs agree for plain, observed, deferred and exhausted input', () => {
            assert.deepEqual(hashes(seen.output), h); assert.deepEqual(hashes(late), h);
            for (const k of ['screens', 'cursors', 'slices', 'frames'])
                assert.equal(plain.output[k].length, part.moves.length + 1);
            assert.deepEqual(plain.output.slices.flat(), plain.output.rng);
        });
        check('real timer and equipment remain separate through the consequence', () => {
            const timed = !['plain-sleeping', 'ring-plain-sleeping'].includes(part.name);
            const withRing = part.name.startsWith('ring-');
            const removed = part.name === 'ring-removed-timed-sleeping';
            const last = states.at(-1);
            assert.ok(states.every(s => !s.gameover && s.legacy === null && s.legacyBase === null));
            assert.ok(states.every(s => s.extrinsic === 0 || s.extrinsic === W_RINGL));
            if (timed) {
                assert.ok(states.some(s => s.intrinsic === 400), 'actual timer selection');
                assert.ok(last.intrinsic > 0 && last.intrinsic < 400, 'normal turns decrement timer');
            } else assert.ok(states.every(s => s.intrinsic === 0));
            if (withRing) assert.ok(states.some(s => s.rings.some(o => o.mask === W_RINGL)));
            assert.equal(last.extrinsic, withRing && !removed ? W_RINGL : 0);
            assert.equal(last.freeAction, withRing && !removed);
            if (removed) assert.ok(last.rings.some(o => o.mask === 0));
            assert.equal(last.sleepResistance, part.name === 'sleep-resistant-timed-sleeping');
        });
        if (Object.hasOwn(recipe.unchangedOutputHashes, part.name))
            check('negative case retains all five output hashes', () => assert.deepEqual(h, recipe.unchangedOutputHashes[part.name]));
        recorded.push({steps:plain.output.screens.map((screen, i) => ({screen, rng:plain.output.slices[i]}))});
        Object.assign(row, {hashes:h, last:states.at(-1), boundaries:plain.output.screens.length,
            calls:plain.output.rng.length, frames:plain.output.frames.flat().length});
    } catch (error) {
        row.checks.push({name:'execution', pass:false, error:error.message.slice(0, 1200)});
    }
    row.pass = row.checks.every(c => c.pass); reports.push(row);
}
clearTimeout(deadline);
const assertionErrors = branchAssertionErrors(recipe, {segments:recorded});
const report = {total:10, passed:reports.filter(r => r.pass).length,
    assertions:reports.reduce((n, r) => n + r.checks.length, 0), assertionErrors,
    nativeSHA256, nativeCounts:counts, nativeIntegrityChecked:true, nativeParityClaimed:false, reports};
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({passed:report.passed, total:10, assertionErrors,
    failures:reports.filter(r => !r.pass).map(r => ({name:r.name, checks:r.checks.filter(c => !c.pass)}))}));
if (report.passed !== 10 || assertionErrors.length) process.exitCode = 1;
