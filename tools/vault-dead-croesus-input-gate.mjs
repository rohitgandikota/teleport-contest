// Ordinary inputs only. Observers never alter runtime state or RNG.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {MON_WEP} from '../js/monst.js';
import {Deaf, Blind} from '../js/youprop.js';
import {NON_PM, NEED_WEAPON, W_WEP} from '../js/const.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const input = JSON.parse(fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/vault-dead-croesus-response.session.json', import.meta.url)));
const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-dead-croesus-response.json', import.meta.url)));
const requirements = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/coverage-requirements.json', import.meta.url)));
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('source-c schema, coverage tags, unchanged five input fields and assertion groups', () => {
    assert.equal(input.version, 5);
    assert.equal(input.source, 'c');
    assert.equal(input.segments.length, 4);
    assert.equal(recipe.branchAssertions.length, 4);
    assert.deepEqual(recordingIntegrityErrors(input), []);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    const tags = new Set(requirements.requirements.map(r => r.id));
    assert.ok(recipe.coverage.every(tag => tags.has(tag)));
    for (const [i, part] of input.segments.entries()) {
        for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(part[key], recipe.segments[i][key], key);
        if (part.steps.length) assert.deepEqual(part.steps.map(s => s.key), [null, ...part.moves]);
    }
    if (input.segments.some(s => s.steps.length))
        assert.deepEqual(branchAssertionErrors(recipe, input), []);
});

for (const [index, part] of input.segments.entries()) {
    const negative = index === 3, states = [];
    const old = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            const guard = g.level?.monsters.find(m => m.isgd && m.mhp > 0);
            const croesus = g.level?.monsters.find(m => m.mnum === P.PM_CROESUS && m.mhp > 0);
            const weapon = guard && MON_WEP(guard);
            states.push({step, turn: g.moves, text: g._toplines || '',
                deaths: g.mvitals[P.PM_CROESUS].died || 0,
                doppelDeaths: g.mvitals[P.PM_DOPPELGANGER].died || 0,
                align: g.u.ualign.record, abuse: g.u.ualign.abuse || 0,
                deaf: Deaf(), blind: Blind(),
                croesus: croesus && {mnum: croesus.mnum, cham: croesus.cham, id: croesus.m_id},
                guard: guard && {id: guard.m_id, peaceful: guard.mpeaceful, malign: guard.malign,
                    movement: guard.movement, weapon: weapon?.otyp ?? null,
                    weaponId: weapon?.o_id ?? null, mask: weapon?.owornmask || 0,
                    cursed: !!weapon?.cursed, check: guard.weapon_check,
                    owned: !!weapon && guard.minvent.includes(weapon),
                    fcend: guard.mextra.egd.fcend || 0, drop: guard.mextra.egd.dropgoldcnt}});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (old) Object.defineProperty(globalThis, '__step_snapshot', old);
        else delete globalThis.__step_snapshot;
    }
    const created = states.find(s => s.croesus);
    const killed = states.find(s => negative ? s.doppelDeaths : s.deaths);
    const entered = states.find(s => s.guard);
    const final = states.at(-1);
    await test(`${part.name}: actual species and death producer, not just a name`, () => {
        assert.ok(created);
        assert.equal(created.croesus.mnum, P.PM_CROESUS);
        assert.equal(created.croesus.cham, negative ? P.PM_DOPPELGANGER : NON_PM);
        assert.equal(created.deaths, 0);
        assert.ok(killed && entered && killed.step < entered.step);
        assert.equal(killed.deaths, negative ? 0 : 1);
        assert.equal(killed.doppelDeaths, negative ? 1 : 0);
        assert.equal(final.deaths, killed.deaths);
        assert.equal(final.doppelDeaths, killed.doppelDeaths);
        assert.equal(entered.guard.weapon, null);
        assert.equal(entered.guard.peaceful, 1);
        assert.equal(entered.deaf, index === 1 || index === 2);
        assert.equal(entered.blind, index === 2);
    });
    await test(`${part.name}: reply, anger and weapon complete in C order`, () => {
        const a = recipe.branchAssertions[index];
        const one = {...recipe, branches: [a.branch], branchAssertions: [{...a, segment: 0}]};
        assert.deepEqual(branchAssertionErrors(one, {
            segments: [{steps: run.getScreens().map(screen => ({screen}))}]}), []);
        if (negative) {
            assert.equal(final.guard, undefined);
            assert.equal(final.align, entered.align);
            assert.equal(final.abuse, entered.abuse);
        } else {
            assert.ok(final.guard);
            assert.equal(final.guard.peaceful, 0);
            assert.equal(final.align, entered.align - 1);
            assert.equal(final.abuse, entered.abuse + 1);
            assert.equal(final.guard.malign, entered.guard.malign);
            assert.equal(final.guard.movement, entered.guard.movement);
            assert.equal(final.guard.weapon, index === 0 ? O.DAGGER : O.KNIFE);
            assert.equal(final.guard.owned, true);
            assert.equal(final.guard.mask & W_WEP, W_WEP);
            assert.equal(final.guard.check, NEED_WEAPON);
            assert.equal(final.guard.fcend, 0);
            assert.equal(final.guard.drop, 0);
            const angry = states.find(s => s.text.includes('gets angry!'));
            assert.ok(angry);
            assert.equal(angry.align, entered.align - 1);
            if (index < 2) {
                assert.equal(angry.guard.weapon, null);
                const reply = states.find(s => /Back from the dead|mouths something/.test(s.text));
                assert.ok(reply && angry.step < reply.step);
                assert.equal(reply.guard.mask & W_WEP, 0, 'wield message waits before final worn mask');
            }
            if (index > 0) assert.equal(final.guard.cursed, true);
        }
    });
    await test(`${part.name}: all inputs consumed with live hero and observer restored`, () => {
        assert.equal(run.getScreens().length, part.moves.length + 1);
        assert.equal(run.getCursors().length, part.moves.length + 1);
        assert.equal(run.getRngSlices().length, part.moves.length + 1);
        assert.equal(run._display.inputQueueLength, 0);
        assert.ok(game.u.uhp > 0 && !game.program_state?.gameover);
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), old);
    });
    console.log(JSON.stringify({name: part.name, created, killed, entered, final,
        boundaries: run.getScreens().length, calls: run.getRngLog().length,
        frames: run.getAnimationFramesByStep().reduce((n, a) => n + a.length, 0),
        hashes: {grids: hash(run.getScreens()), cursors: hash(run.getCursors()),
            calls: hash(run.getRngLog()), slices: hash(run.getRngSlices()),
            frames: hash(run.getAnimationFramesByStep())}}));
}
