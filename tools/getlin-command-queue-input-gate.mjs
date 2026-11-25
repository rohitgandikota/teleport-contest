// Ordinary keys only. Observers copy state and never inject queues or input.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { NethackGame, runSegment } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { InMemoryStorage } from '../js/storage.js';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { branchAssertionErrors } from './gen-sessions/assertions.mjs';
import { CQ_CANNED, CQ_REPEAT, CMDQ_KEY, FOUNTAIN } from '../js/const.js';

const recipePath = new URL('gen-sessions/recipes/getlin-command-queue.json', import.meta.url);
const recipe = JSON.parse(fs.readFileSync(recipePath));
const bytes = fs.readFileSync(process.argv[2] || recipePath), input = JSON.parse(bytes);
const output = process.argv[3];
const collect = run => ({
    screens: run.getScreens(), cursors: run.getCursors(), rng: [...run.getRngLog()],
    slices: run.getRngSlices(), frames: run.getAnimationFramesByStep(),
});
const hashes = values => Object.fromEntries(Object.entries(values).map(([key, value]) =>
    [key, createHash('sha256').update(JSON.stringify(value)).digest('hex')]));

async function delayed(part) {
    const run = new NethackGame({ ...part, storage: new InMemoryStorage() });
    const display = new GameDisplay(null), end = new Error('Input queue empty: bounded audit');
    let used = 0;
    display.onEmptyQueue = async () => {
        await setImmediate();
        if (used === part.moves.length) throw end;
        return part.moves.charCodeAt(used++);
    };
    run._pendingDisplay = display;
    try {
        await run.start();
        for (let i = 0; i < 1024 && !game.program_state?.gameover; i++) await moveloop_core();
    } catch (error) { if (error !== end) throw error; }
    assert.equal(used, part.moves.length);
    return run;
}
function snapshot(g, step) {
    return {
        step, top: g._toplines, inGetlin: g.program_state?.in_getlin || 0,
        botDisabled: !!g.bot_disabled, termGone: g.iflags?.term_gone || 0, turn: g.moves,
        terrain: g.level?.at(g.u.ux, g.u.uy)?.typ,
        inRoleSelection: !!g.in_role_selection, heroX: g.u?.ux,
        queues: [CQ_CANNED, CQ_REPEAT].map(q => (g.command_queue?.[q] || []).map(entry => ({
            typ: entry.typ, key: entry.key, command: entry.ec_entry?.ef_txt,
        }))),
        inventory: (g.invent || []).map(obj => ({
            id: obj.o_id, letter: obj.invlet, type: obj.otyp, name: obj.oname,
        })),
    };
}
const reports = [], observedSegments = [];
assert.equal(input.segments.length, recipe.segments.length);
for (const [index, part] of input.segments.entries()) {
    for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
        assert.equal(Object.hasOwn(part, key), Object.hasOwn(recipe.segments[index], key));
        assert.deepEqual(part[key], recipe.segments[index][key]);
    }
    if (part.steps?.length) {
        assert.equal(input.source, 'c'); assert.equal(input.version, 5);
        assert.deepEqual(part.steps.map(step => step.key), [null, ...part.moves]);
    }
    const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), states = [];
    let run;
    try {
        globalThis.__step_snapshot = { step: '*', cb(g, step) { states.push(snapshot(g, step)); } };
        run = await runSegment({ ...part, storage: new InMemoryStorage() });
    } finally {
        if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), prior);
    const observed = collect(run);
    observedSegments.push({ steps: observed.screens.map(screen => ({ screen })) });
    const plain = collect(await runSegment({ ...part, storage: new InMemoryStorage() }));
    const late = collect(await delayed(part));
    assert.deepEqual(hashes(observed), hashes(plain), 'observer preserves all five outputs');
    assert.deepEqual(hashes(late), hashes(plain), 'deferred input preserves all five outputs');
    assert.deepEqual(plain.slices.flat(), plain.rng);
    assert.equal(plain.screens.length, part.moves.length + 1);
    assert.equal(plain.frames.flat().length, 0);
    reports.push({ index, name: part.name, boundaries: plain.screens.length,
        calls: plain.rng.length, frames: 0, hashes: hashes(plain),
        observerHashes: hashes(observed), deferredHashes: hashes(late), states });
    await test(`${part.name}: real producers and line-reader boundary`, () => {
        assert.ok(states.every(state => state.termGone === 0 && state.turn === (index === 3 ? 0 : 1)));
        if (index < 2) {
            const search = states.filter(state => state.top?.startsWith('Search for:'));
            assert.equal(search.length, 4);
            assert.deepEqual(search.map(state => state.top),
                ['Search for: ', 'Search for: d', 'Search for: da', 'Search for: dag']);
            assert.ok(search.every(state => state.terrain === FOUNTAIN
                && state.botDisabled && state.inGetlin === 0));
            const expected = index === 0 ? [{ typ: CMDQ_KEY, key: 'y', command: undefined }] : [];
            assert.ok(search.every(state => JSON.stringify(state.queues[CQ_CANNED])
                === JSON.stringify(expected)), 'only the real context action supplies pending y');
            if (index === 0)
                assert.ok(search.every(state => state.queues[CQ_REPEAT][0]?.command === 'dip'));
            else
                assert.ok(search.every(state => state.queues[CQ_REPEAT].length === 0),
                    'rhack records #dip only after doextcmd returns');
        } else if (index === 2) {
            const prompt = states.filter(state => state.top?.startsWith('What do you want to name'));
            assert.equal(prompt.length, 6);
            assert.ok(prompt.slice(0, 5).every(state => state.inGetlin === 1 && state.botDisabled));
            assert.ok(prompt.every(state => state.queues[CQ_CANNED].length === 0));
            assert.equal(prompt.at(-1).inGetlin, 0); assert.equal(prompt.at(-1).botDisabled, false);
            assert.equal(prompt.at(-1).inventory.find(obj => obj.letter === 'a')?.name, 'Edge');
            assert.ok(states.filter(state => state.top === '# ').every(state => state.inGetlin === 0));
            assert.equal(states.at(-1).top, '');
        } else {
            const search = states.filter(state => state.top?.startsWith('Search for:'));
            assert.deepEqual(search.map(state => state.top),
                ['Search for: ', 'Search for: W', 'Search for: Wi', 'Search for: Wiz']);
            assert.ok(search.every(state => state.inRoleSelection && state.heroX === 0
                && state.inGetlin === 0 && state.queues.every(q => q.length === 0)));
        }
    });
}
const recipeErrors = branchAssertionErrors(recipe, { segments: observedSegments });
const hasNative = input.segments.every(part => part.steps?.length > 0);
const nativeRecipeErrors = hasNative ? branchAssertionErrors(recipe, input) : null;
const report = {
    evidence: 'Ordinary JS keys and source/state controls. This gate alone is not a native comparison.',
    inputSHA256: createHash('sha256').update(bytes).digest('hex'),
    observerPairs: reports.length * 5, deferredPairs: reports.length * 5, reports,
    recipeAssertions: { count: recipe.branchAssertions.length, jsErrors: recipeErrors,
        nativeChecked: hasNative, nativeErrors: nativeRecipeErrors },
};
if (output) fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
await test('recipe terminal assertions match actual JS output and supplied native output, if present', () => {
    assert.deepEqual(recipeErrors, []);
    if (hasNative) assert.deepEqual(nativeRecipeErrors, []);
});
console.log(`Verified ${reports.length * 5} observer and ${reports.length * 5} deferred-output hashes.`);
