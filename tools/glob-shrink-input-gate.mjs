// Ordinary input and read-only observations. No module overrides or helper mocks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { PMNAMES } from '../js/monst_data.js';
import { SHRINK_GLOB } from '../js/timeout.js';
import { OBJ_FLOOR } from '../js/const.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { decodeScreen as decodeCells } from '../frozen/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const recipePath = process.argv[2] || new URL(
    'gen-sessions/recipes/glob-shrink-ownership.json', import.meta.url);
const nativePath = process.argv[3];
const recipe = JSON.parse(fs.readFileSync(recipePath));
assert.equal(recipe.segments.length, 5);
const results = [];
const failures = [];
const replay = { segments: [] };
function output(run) {
    return structuredClone({ screens: run.getScreens(), cursors: run.getCursors(),
        rng: run.getRngLog(), slices: run.getRngSlices(),
        animations: run.getAnimationFramesByStep() });
}

const plainArg = process.argv.find(arg => arg.startsWith('--plain='));
if (plainArg) {
    const index = Number(plainArg.slice('--plain='.length));
    fs.writeFileSync(1, JSON.stringify(output(await runSegment({
        ...recipe.segments[index], storage: new InMemoryStorage(),
    }))));
    process.exit(0);
}

for (const [segment, part] of recipe.segments.entries()) {
    const states = [];
    const oldHook = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let observed;
    try {
        globalThis.__step_snapshot = { step: '*', cb(game, step) {
            if (!game.invent || !game.u?.uz)
                return;
            states[step] = {
                step, moves: game.moves, level: { ...game.u.uz },
                hero: [game.u.ux, game.u.uy], hidden: game.u.uundetected,
                form: game.u.umonnum, weapon: game.u.uwep?.o_id ?? null,
                globs: [...game.invent, ...game.level.objects].filter(obj => obj.globby)
                    .map(obj => ({ id: obj.o_id, where: obj.where, weight: obj.owt,
                        eaten: obj.oeaten, worn: obj.owornmask || 0, xy: [obj.ox, obj.oy] })),
                timers: (game.timer_base || []).filter(timer => timer.func_index === SHRINK_GLOB)
                    .map(timer => ({ deadline: timer.timeout, id: timer.arg?.o_id })),
            };
        }};
        observed = output(await runSegment({ ...part, storage: new InMemoryStorage() }));
    } finally {
        if (oldHook)
            Object.defineProperty(globalThis, '__step_snapshot', oldHook);
        else
            delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), oldHook);
    // fmt_ptr has process lifetime. An independent process prevents #timeout's
    // pointer labels from inheriting a previous replay's allocation sequence.
    const plain = spawnSync(process.execPath, [fileURLToPath(import.meta.url),
        recipePath instanceof URL ? fileURLToPath(recipePath) : recipePath,
        `--plain=${segment}`], { encoding: 'utf8', timeout: 20000,
        maxBuffer: 8 * 1024 * 1024 });
    assert.equal(plain.status, 0, plain.stderr || String(plain.error));
    const unobserved = JSON.parse(plain.stdout);
    assert.deepEqual(observed, unobserved, 'observations preserve every output field');
    const rows = observed.screens.map(decodeScreen);
    const find = text => rows.findIndex(lines => lines[0].includes(text));
    const final = states.filter(Boolean).at(-1);
    const witnesses = [];
    try {
        const created = states.find(state => state?.globs.some(glob => glob.weight === 20));
        assert.ok(created, 'ordinary wish creates a normal-weight glob');
        witnesses.push(created);
        if (segment === 0) {
            const worn = states.find(state => state?.globs.some(glob => glob.id === state.weapon));
            assert.ok(worn, 'ordinary wield command equips the glob');
            assert.equal(final.weapon, null);
            assert.deepEqual(final.globs, []);
            assert.deepEqual(final.timers, []);
            assert.ok(find('You are already bare handed.') >= 0);
            witnesses.push(worn, final);
        } else if (segment === 1) {
            const step = find('A small glob of gray ooze fades away.');
            assert.ok(step >= 0);
            assert.deepEqual(states[step].globs, []);
            assert.deepEqual(states[step].hero, [29, 7]);
            witnesses.push(states[step], final);
        } else if (segment === 2) {
            const step = find('Your partly eaten small glob of gray ooze shrinks.');
            assert.ok(step >= 0);
            assert.equal(states[step].globs[0].weight, 19);
            assert.equal(states[step].globs[0].eaten, 9);
            witnesses.push(states[step]);
        } else if (segment === 3) {
            const dropped = states.find(state => state?.globs.some(glob => glob.where === OBJ_FLOOR));
            assert.ok(dropped);
            assert.ok(states.some(state => state?.level.dlevel === 2), 'real level departure');
            assert.equal(final.level.dlevel, 1);
            assert.ok(final.moves > 600);
            assert.deepEqual(final.globs, [], 'overdue floor glob is removed on actual arrival');
            assert.deepEqual(final.timers, []);
            witnesses.push(dropped, final);
        } else {
            const hiding = states.find(state => state?.hidden && state.globs.length);
            const step = find('The small glob of gray ooze fades away.');
            assert.ok(hiding, 'real polymorph and #monster establish concealment');
            assert.equal(hiding.form, PMNAMES.PM_GARTER_SNAKE);
            assert.ok(step >= 0);
            const gone = states[step];
            assert.equal(gone.form, PMNAMES.PM_GARTER_SNAKE, 'no polymorph reversion confound');
            assert.equal(gone.hidden, 0, 'expiry reveals hero before the later #monster command');
            assert.deepEqual(gone.globs, []);
            assert.deepEqual(gone.timers, []);
            assert.deepEqual(decodeCells(observed.screens[step])[8][29],
                { ch: 'S', color: 2, attr: 0, decgfx: 0 },
                'the first fade boundary draws the still-polymorphed hero');
            witnesses.push(hiding, gone);
        }
    } catch (error) {
        failures.push({ segment, error: error.message });
    }
    replay.segments.push({ ...part, steps: observed.screens.map((screen, step) => ({
        screen, cursor: observed.cursors[step], rng: observed.slices[step],
        animation_frames: observed.animations[step],
    })) });
    results.push({ segment, name: part.name, boundaries: rows.length,
        calls: observed.rng.length,
        animations: observed.animations.reduce((sum, frames) => sum + frames.length, 0),
        hookNeutral: true, outputSha256: createHash('sha256')
            .update(JSON.stringify(observed)).digest('hex'), witnesses });
}
failures.push(...branchAssertionErrors(recipe, replay));
let nativeSha256 = null;
const nativeWitnesses = [];
if (nativePath) {
    const bytes = fs.readFileSync(nativePath);
    const native = JSON.parse(bytes);
    assert.equal(native.version, 5);
    assert.equal(native.source, 'c');
    assert.equal(native.segments.length, recipe.segments.length);
    for (const [index, part] of recipe.segments.entries()) {
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(native.segments[index][field], part[field], `${index}.${field}`);
    }
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    // Zero-based native boundaries. The late hide command alone does not
    // distinguish the missing expiry cleanup, so pin the visible transition.
    for (const [segment, step, text] of [
        [0, 76, 'You stop waiting.'],
        [0, 86, 'You are already bare handed.'],
        [1, 77, 'A small glob of gray ooze fades away.'],
        [2, 44, 'Your partly eaten small glob of gray ooze shrinks.'],
        [3, 61, 'Active timeout queue:'],
        [4, 100, 'You are now hiding underneath a glob of gray ooze.'],
        [4, 111, 'The small glob of gray ooze fades away.'],
    ]) {
        const recorded = native.segments[segment].steps[step];
        const rows = decodeScreen(recorded.screen);
        assert.ok(rows.some(row => row.includes(text)), `${segment}:${step} ${text}`);
        nativeWitnesses.push({ segment, step, text, cursor: recorded.cursor });
    }
    const queueRows = decodeScreen(native.segments[3].steps[61].screen);
    assert.ok(queueRows.some(row => row.includes('<empty>')));
    assert.ok(queueRows[23].includes('Dlvl:1'));
    assert.ok(queueRows[23].includes('T:602'));
    for (const [step, cell, turn] of [
        [106, { ch: '%', color: 8, attr: 0, decgfx: 0 }, 455],
        [111, { ch: 'S', color: 2, attr: 0, decgfx: 0 }, 530],
    ]) {
        const recorded = native.segments[4].steps[step];
        const rows = decodeScreen(recorded.screen);
        assert.deepEqual(decodeCells(recorded.screen)[8][29], cell);
        assert.deepEqual(recorded.cursor, [29, 8, 1]);
        assert.ok(rows[22].includes('the Garter Snake'));
        assert.ok(rows[23].includes('HD:1'));
        assert.ok(rows[23].includes(`T:${turn}`));
        nativeWitnesses.push({ segment: 4, step, cell: { x: 29, y: 8, ...cell },
            form: rows[22].trimEnd(), status: rows[23].trimEnd(),
            cursor: recorded.cursor });
    }
    nativeSha256 = createHash('sha256').update(bytes).digest('hex');
}
console.log(JSON.stringify({ evidence: nativePath
    ? 'normal JS observations and native recipe/cell assertions; strict native replay is separate'
    : 'normal JS observations; proposed native assertions have no supplied C recording',
    results, failures, nativeSha256, nativeWitnesses }, null, 4));
process.exitCode = failures.length ? 1 : 0;
