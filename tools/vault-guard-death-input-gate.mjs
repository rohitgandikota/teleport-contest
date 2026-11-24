// Ordinary inputs only. Observe the real death ledger and invault draws.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {vault_occupied} from '../js/vault.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const input = JSON.parse(fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/vault-guard-death-throttle.session.json', import.meta.url)));
const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-guard-death-throttle.json', import.meta.url)));
const requirements = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/coverage-requirements.json', import.meta.url)));
const expected = [
    {deaths: 1, zombies: 0, turns: 12, timer: 13},
    {deaths: 2, zombies: 0, turns: 12, timer: 5},
    {deaths: 3, zombies: 0, turns: 24, timer: 4},
    {deaths: 0, zombies: 2, turns: 12, timer: 13},
];
const hash = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');

await test('source-c v5 input tuples, valid coverage tags and four assertion groups', () => {
    assert.equal(input.version, 5);
    assert.equal(input.source, 'c');
    assert.equal(input.segments.length, 4);
    assert.equal(recipe.branchAssertions.length, 4);
    assert.deepEqual(recordingIntegrityErrors(input), []);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    const tags = new Set(requirements.requirements.map(r => r.id));
    assert.ok(recipe.coverage.every(t => tags.has(t)));
    for (const [i, part] of input.segments.entries()) {
        for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(part[key], recipe.segments[i][key]);
        if (part.steps.length) assert.deepEqual(part.steps.map(s => s.key), [null, ...part.moves]);
    }
    if (input.segments.some(s => s.steps.length))
        assert.deepEqual(branchAssertionErrors(recipe, input), []);
});

for (const [i, part] of input.segments.entries()) {
    const want = expected[i], states = [];
    const saved = Object.fromEntries(['__step_snapshot', '__rng_trace_sites'].map(key =>
        [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    let run;
    try {
        globalThis.__rng_trace_sites = true;
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            states.push({step, turn: g.moves, timer: g.u.uinvault,
                vault: !!vault_occupied(g.u.urooms),
                deaths: g.mvitals[P.PM_GUARD].died || 0,
                zombies: g.mvitals[P.PM_HUMAN_ZOMBIE].died || 0,
                callCount: getRngLog().length,
                guards: g.level.monsters.filter(m => m.mnum === P.PM_GUARD && m.mhp > 0)
                    .map(m => ({id: m.m_id, isgd: !!m.isgd, cham: m.cham})),
                escorts: g.level.monsters.filter(m => m.isgd && m.mhp > 0).length});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        for (const [key, descriptor] of Object.entries(saved)) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
    const calls = run.getRngLog(), final = states.at(-1);
    const ownerCalls = calls.filter(c => /@js\/vault\.js:/.test(c));
    const seen = [...new Map(states.flatMap(s => s.guards).map(g => [g.id, g])).values()];
    const advanced = states.filter((s, n) => n && s.turn > states[n-1].turn
        && states[n-1].deaths === want.deaths && states[n-1].zombies === want.zombies);

    await test(`${part.name}: actual species deaths, not appearance or an escort flag`, () => {
        assert.equal(final.deaths, want.deaths);
        assert.equal(final.zombies, want.zombies);
        assert.equal(seen.length, want.deaths);
        assert.ok(seen.every(g => !g.isgd && g.cham === -1));
        assert.ok(states.every(s => s.escorts === 0));
    });
    await test(`${part.name}: each elapsed turn uses the C throttle before the timer gate`, () => {
        assert.equal(advanced.length, want.turns);
        assert.equal(final.timer, want.timer);
        assert.equal(ownerCalls.length, want.deaths >= 2 ? want.turns : 0);
        let zeros = 0, failures = 0;
        for (const s of advanced) {
            const previous = states[states.indexOf(s) - 1];
            const draws = calls.slice(previous.callCount, s.callCount)
                .filter(c => /@js\/vault\.js:/.test(c));
            if (want.deaths < 2) {
                assert.deepEqual(draws, []);
                assert.equal(s.timer, previous.timer + 1);
            } else {
                assert.equal(draws.length, 1);
                const m = draws[0].match(/^rn2\((\d+)\)=(\d+)/);
                assert.ok(m);
                assert.equal(Number(m[1]), want.deaths * want.deaths);
                const increment = Number(m[2]) === 0 ? 1 : 0;
                zeros += increment;
                failures += 1 - increment;
                assert.equal(s.timer, previous.timer + increment);
            }
        }
        if (want.deaths >= 2) assert.ok(zeros && failures, 'both real roll outcomes reached');
    });
    await test(`${part.name}: native call boundaries imply the same timer sequence`, () => {
        assert.equal(part.steps.length, part.moves.length + 1, 'requires the unchanged C recording');
        const firstWait = part.steps.length - want.turns;
        assert.equal(states[firstWait - 1].timer, 1, 'real vault-entry timer before waiting');
        let counter = 1;
        for (let step = firstWait; step < part.steps.length; ++step) {
            assert.equal(part.steps[step].key, '.');
            const native = part.steps[step].rng.filter(c => c.endsWith('@ invault(vault.c:334)'));
            const actual = run.getRngSlices()[step].filter(c => /@js\/vault\.js:/.test(c));
            assert.deepEqual(actual.map(c => c.split(' @')[0]), native.map(c => c.split(' @')[0]));
            if (want.deaths < 2) {
                assert.deepEqual(native, []);
                ++counter;
            } else {
                assert.equal(native.length, 1);
                const draw = native[0].match(/^rn2\((\d+)\)=(\d+) @ invault\(vault\.c:334\)$/);
                assert.ok(draw);
                assert.equal(Number(draw[1]), want.deaths * want.deaths);
                if (Number(draw[2]) === 0) ++counter;
            }
            assert.equal(states[step].vault, true);
            assert.equal(states[step].timer, counter, 'counter inferred from the native draws and C rule');
        }
        assert.equal(counter, want.timer);
    });
    await test(`${part.name}: displayed death ledger, bounded live input, clean observers`, () => {
        // Recipe RNG-site assertions are reserved for C. Check JS owner
        // attribution above and apply every screen assertion here.
        const a = {...recipe.branchAssertions[i], segment: 0};
        delete a.rngIncludes;
        assert.deepEqual(branchAssertionErrors({...recipe, branches: [a.branch], branchAssertions: [a]},
            {segments: [{steps: run.getScreens().map(screen => ({screen}))}]}), []);
        assert.equal(run.getScreens().length, part.moves.length + 1);
        assert.equal(run.getCursors().length, part.moves.length + 1);
        assert.equal(run.getRngSlices().length, part.moves.length + 1);
        assert.equal(run._display.inputQueueLength, 0);
        assert.ok(game.u.uhp > 0 && !game.program_state?.gameover);
        for (const [key, descriptor] of Object.entries(saved))
            assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, key), descriptor);
    });
    const plain = rows => rows.map(c => c.replace(/\s+@.*$/, ''));
    console.log(JSON.stringify({name: part.name, final, species: seen, ownerCalls,
        waitStates: advanced.map(s => ({step: s.step, turn: s.turn, timer: s.timer, vault: s.vault})),
        boundaries: run.getScreens().length, calls: calls.length,
        frames: run.getAnimationFramesByStep().reduce((n,a) => n+a.length, 0),
        hashes: {screens: hash(run.getScreens()), cursors: hash(run.getCursors()),
            rng: hash(plain(calls)), slices: hash(run.getRngSlices().map(plain)),
            frames: hash(run.getAnimationFramesByStep())}}));
}
