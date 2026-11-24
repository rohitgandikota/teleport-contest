// Normal imports and passive replay hooks. Accepts proposals or unchanged C raw.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {Deaf, Blind} from '../js/youprop.js';
import {is_silent} from '../js/mondata.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {M_AP_TYPE, M_AP_OBJECT} from '../js/const.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-early-exit-boundaries.json', import.meta.url)));
const input = JSON.parse(fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/vault-early-exit-boundaries.session.json', import.meta.url)));
const requirements = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/coverage-requirements.json', import.meta.url)));
const tags = new Set(requirements.requirements.map(r => r.id));
assert.ok(recipe.coverage.every(tag => tags.has(tag)));
assert.deepEqual(branchAssertionErrors(recipe), []);
assert.equal(input.source, 'c');
assert.equal(input.version, 5);
assert.equal(input.segments.length, 13);
assert.deepEqual(recordingIntegrityErrors(input), []);
if (input.segments.some(s => s.steps.length)) {
    assert.ok(input.segments.every(s => s.steps.length === s.moves.length + 1));
    assert.deepEqual(branchAssertionErrors(recipe, input), []);
}
const hash = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');

for (const [index, part] of input.segments.entries()) {
    for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
        assert.deepEqual(part[field], recipe.segments[index][field], field);
    const [kind, mode] = part.name.split('-').slice(-2), deaf = mode === 'deaf';
    const keys = ['__step_snapshot', '__rng_trace_sites'];
    const old = keys.map(k => Object.getOwnPropertyDescriptor(globalThis, k));
    const states = [];
    let run;
    try {
        globalThis.__rng_trace_sites = true;
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            const guard = g.level?.monsters.find(m => m.isgd && m.mhp > 0);
            states.push({step, turn: g.moves, text: g._toplines || '',
                hero: [g.u.ux, g.u.uy], deaf: Deaf(), blind: Blind(),
                swallowed: !!g.u.uswallow, hidden: !!g.u.uundetected,
                silent: is_silent(g.youmonst.data),
                appearanceType: M_AP_TYPE(g.youmonst), appearance: g.youmonst.mappearance,
                strangled: g.u.intrinsic?.HStrangled || 0,
                multi: g.multi, after: g.afternmv?.name,
                births: g.mvitals[PMNAMES.PM_GUARD].born,
                deaths: g.mvitals[PMNAMES.PM_GUARD].died,
                entry: [g.level.at(25, 5).typ, g.level.at(25, 5).doormask],
                guard: guard && {fcend: guard.mextra.egd.fcend || 0,
                    drop: guard.mextra.egd.dropgoldcnt, warn: guard.mextra.egd.warncnt}});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        keys.forEach((k, i) => old[i] ? Object.defineProperty(globalThis, k, old[i]) : delete globalThis[k]);
    }
    const before = states.find(s => s.step === 43);
    const entered = states.find(s => s.births > before.births);
    const final = states.at(-1), screens = run.getScreens();
    await test(`${part.name}: real producer state at guard arrival`, () => {
        assert.ok(entered, 'guard really spawned');
        assert.equal(entered.deaf, deaf);
        assert.deepEqual(entered.hero, [23, 5]);
        if (kind === 'swallowed') assert.equal(entered.swallowed, true);
        if (kind === 'mimic' || kind === 'gold') {
            assert.equal(entered.appearanceType, M_AP_OBJECT);
            assert.equal(entered.appearance, kind === 'gold' ? ONAMES.GOLD_PIECE : ONAMES.STRANGE_OBJECT);
        }
        if (kind === 'hidden') assert.equal(entered.hidden, true);
        if (kind === 'silent') {
            assert.equal(entered.silent, true);
            assert.equal(entered.appearanceType, 0);
            assert.equal(entered.hidden, false);
        }
        if (kind === 'strangled') {
            assert.ok(entered.strangled > 0);
            assert.equal(entered.silent, false);
            assert.equal(entered.multi, 0);
        }
        if (kind === 'paralyzed' || kind === 'gold') {
            assert.ok(entered.multi < 0);
            assert.notEqual(entered.after, 'unfaint');
            if (kind === 'gold') assert.equal(entered.after, 'eatmdone');
        }
    });
    await test(`${part.name}: source-derived feedback and guard cleanup`, () => {
        const a = recipe.branchAssertions[index];
        const one = {...recipe, branches: [a.branch], branchAssertions: [{...a, segment: 0}]};
        // Ephemeral JS assertion view only. It is never saved as a C recording.
        assert.deepEqual(branchAssertionErrors(one, {
            segments: [{steps: screens.map(screen => ({screen}))}]}), []);
        assert.equal(final.guard, undefined);
        assert.equal(final.births, before.births + 1);
        assert.equal(final.deaths, before.deaths);
        assert.ok(states.every(s => !s.guard || (s.guard.fcend === 0 && s.guard.drop === 0)));
        assert.deepEqual(final.entry, before.entry, 'entry remains a wall, no escort corridor');
        if (kind === 'strangled') assert.equal(final.strangled, 0, 'amulet removed safely afterward');
        if (kind === 'gold') assert.equal(final.appearanceType, 0, 'eatmdone finishes ordinary recovery');
    });
    await test(`${part.name}: complete input, live hero and no observer leak`, () => {
        assert.equal(screens.length, part.moves.length + 1);
        assert.equal(run.getCursors().length, screens.length);
        assert.equal(run.getRngSlices().length, screens.length);
        assert.equal(run.getAnimationFramesByStep().length, screens.length);
        assert.equal(run._display.inputQueueLength, 0);
        assert.ok(game.u.uhp > 0);
        assert.ok(!game.program_state.gameover);
        assert.deepEqual(keys.map(k => Object.getOwnPropertyDescriptor(globalThis, k)), old);
    });
    console.log(JSON.stringify({name: part.name, entered, final,
        boundaries: screens.length, calls: run.getRngLog().length,
        frames: run.getAnimationFramesByStep().reduce((n, frames) => n + frames.length, 0),
        outputHashes: {screens: hash(screens), cursors: hash(run.getCursors()),
            rng: hash(run.getRngLog()), slices: hash(run.getRngSlices()),
            animations: hash(run.getAnimationFramesByStep())}}));
}
