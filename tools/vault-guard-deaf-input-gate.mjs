// Ordinary inputs only. This gate also accepts the later native recording.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Deaf, Displaced} from '../js/youprop.js';
import {game} from '../js/gstate.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
const input = JSON.parse(fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/vault-guard-deaf-feedback.session.json', import.meta.url)));
const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-guard-deaf-feedback.json', import.meta.url)));
assert.equal(input.version, 5);
assert.equal(input.source, 'c');
assert.equal(input.segments.length, 3);
const hash = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
for (const [index, part] of input.segments.entries()) {
    for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
        assert.deepEqual(part[field], recipe.segments[index][field], field);
    const keys = ['__step_snapshot', '__rng_trace_sites'];
    const old = keys.map(k => Object.getOwnPropertyDescriptor(globalThis, k));
    const states = [];
    let run;
    try {
        globalThis.__rng_trace_sites = true;
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            const guard = g.level?.monsters.find(m => m.isgd);
            if (!guard?.mextra?.egd.fcend) return;
            const e = guard.mextra.egd;
            states.push({step, hero: [g.u.ux, g.u.uy], deaf: Deaf(),
                displaced: Displaced(), timer: g.u.intrinsic?.HDeaf || 0,
                hp: g.u.uhp, level: g.u.ulevel, text: g._toplines || '',
                guard: {id: guard.m_id, at: [guard.mx, guard.my],
                    warn: e.warncnt, drop: e.dropgoldcnt, peaceful: guard.mpeaceful,
                    fcend: e.fcend}});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        keys.forEach((k, i) => old[i] ? Object.defineProperty(globalThis, k, old[i]) : delete globalThis[k]);
    }
    const before3 = states.find(s => s.guard.warn === 3);
    const after3 = states.find(s => s.guard.warn === 4);
    const before7 = states.find(s => s.guard.warn === 7 && s.guard.peaceful);
    const after7 = states.find(s => s.guard.warn === 7 && !s.guard.peaceful);
    const messages = run.getScreens().map(s => decodeScreen(s)[0].map(c => c.ch).join('').trimEnd());
    const deaf = index === 1;
    await test(`${part.name}: ordinary invault creates the guard before status changes`, () => {
        const initial = states.find(s => s.guard.warn === 1 && s.guard.drop === 1);
        assert.ok(initial);
        assert.equal(initial.deaf, false);
        assert.equal(initial.guard.fcend, 1);
        assert.deepEqual(initial.guard.at, [25, 5]);
        assert.equal(before7.guard.id, initial.guard.id);
        assert.equal(before7.level, 10);
        assert.equal(before7.displaced, true);
    });
    await test(`${part.name}: actual deaf producer and recovery state`, () => {
        assert.equal(states.some(s => s.timer > 0), index !== 0);
        assert.equal(messages.some(m => m.includes('You are unable to hear anything.')), index !== 0);
        assert.equal(messages.some(m => m.includes('You can hear again.')), index === 2);
        assert.equal(before3.deaf, deaf);
        assert.equal(after7.deaf, deaf);
        assert.equal(before3.timer > 0, deaf);
    });
    await test(`${part.name}: warning three speech and counter follow C's Deaf guard`, () => {
        assert.equal(after3.guard.drop, before3.guard.drop + (deaf ? 0 : 1));
        assert.equal(after3.guard.peaceful, 1);
        assert.equal(messages.some(m => m.includes('I repeat, drop that gold and follow me!')), !deaf);
    });
    await test(`${part.name}: warning seven changes state even when speech is suppressed`, () => {
        assert.equal(before7.guard.peaceful, 1);
        assert.equal(after7.guard.peaceful, 0);
        assert.deepEqual(after7.hero, [24, 6]);
        assert.notDeepEqual(after7.guard.at, before7.guard.at);
        assert.equal(messages.some(m => m.includes("You've been warned, knave!")), !deaf);
    });
    await test(`${part.name}: all input finishes alive and hooks are restored`, () => {
        assert.equal(run.getScreens().length, part.moves.length + 1);
        assert.equal(run.getCursors().length, part.moves.length + 1);
        assert.equal(run.getRngSlices().length, part.moves.length + 1);
        assert.equal(run._display.inputQueueLength, 0);
        assert.ok(game.u.uhp > 0);
        assert.ok(!game.program_state.gameover);
        assert.equal(messages.some(m => m.includes('You die...')), false);
        assert.equal(run.getAnimationFramesByStep().reduce((n, a) => n + a.length, 0), 0);
        assert.deepEqual(keys.map(k => Object.getOwnPropertyDescriptor(globalThis, k)), old);
    });
    console.log(JSON.stringify({name: part.name, before3, after3, before7, after7,
        boundaries: run.getScreens().length, calls: run.getRngLog().length,
        outputHashes: {screens: hash(run.getScreens()), cursors: hash(run.getCursors()),
            rng: hash(run.getRngLog()), slices: hash(run.getRngSlices()),
            animations: hash(run.getAnimationFramesByStep())}}));
}
