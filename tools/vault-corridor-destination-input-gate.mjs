// Ordinary-input reach checks. A proposal has empty steps; it is not a C oracle.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Passes_walls} from '../js/youprop.js';
import {game} from '../js/gstate.js';
import {CORR, DOOR, STONE, THRONE, IS_WALL} from '../js/const.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
const input = JSON.parse(fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/vault-corridor-destination.session.json', import.meta.url)));
const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-corridor-destination.json', import.meta.url)));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
assert.equal(input.version, 5); assert.equal(input.source, 'c');
assert.equal(input.segments.length, 3);
for (const [index, part] of input.segments.entries()) {
    for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
        assert.deepEqual(part[key], recipe.segments[index][key], key);
    const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            const guard = g.level.monsters.find(m => m.isgd);
            states.push({step, hero: [g.u.ux, g.u.uy], phasing: Passes_walls(),
                target: {typ: g.level.at(26, 5).typ, flags: g.level.at(26, 5).flags},
                guard: guard && {id: guard.m_id, xy: [guard.mx, guard.my],
                    peaceful: guard.mpeaceful, egd: structuredClone(guard.mextra.egd)}});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
        else delete globalThis.__step_snapshot;
    }
    const entry = states.find(s => s.guard?.egd.fcend === 1);
    const carve = states.find(s => s.guard?.egd.fcend === 2);
    const final = states.at(-1);
    const messages = run.getScreens().map(s => decodeScreen(s)
        .map(row => row.map(c => c.ch).join('')).join('\n')).join('\n');
    await test(`${part.name}: ordinary preparation precedes the real guard`, () => {
        assert.ok(states.some(s => s.phasing && !s.guard && s.hero[0] === 26 && s.hero[1] === 5));
        assert.ok(entry); assert.equal(entry.phasing, false);
        assert.deepEqual(entry.hero, [23, 5]); assert.deepEqual(entry.guard.xy, [25, 5]);
        assert.deepEqual([entry.guard.egd.gdx, entry.guard.egd.gdy], [31, 8]);
        if (index === 0) assert.ok(IS_WALL(entry.target.typ));
        else assert.equal(entry.target.typ, index === 1 ? STONE : THRONE);
    });
    await test(`${part.name}: source-derived conversion preserves the original terrain record`, () => {
        assert.ok(carve); assert.deepEqual(carve.hero, [24, 5]);
        assert.deepEqual(carve.guard.xy, [26, 5]); assert.equal(carve.phasing, false);
        assert.equal(carve.target.typ, index === 2 ? DOOR : CORR);
        assert.equal(carve.target.flags, 0);
        assert.deepEqual(carve.guard.egd.fakecorr[1],
            {fx: 26, fy: 5, ftyp: entry.target.typ, flags: 0, doormask: 0});
    });
    await test(`${part.name}: the unphased hero can follow the same peaceful guard`, () => {
        assert.deepEqual(final.hero, [28, 5]); assert.equal(final.phasing, false);
        assert.deepEqual(final.guard.xy, [29, 6]); assert.equal(final.guard.egd.fcend, 6);
        assert.equal(final.guard.id, entry.guard.id); assert.equal(final.guard.peaceful, 1);
    });
    await test(`${part.name}: recipe feedback and negative assertions hold`, () => {
        for (const text of recipe.branchAssertions[index].screenIncludes) assert.ok(messages.includes(text), text);
        for (const text of recipe.branchAssertions[index].screenExcludes) assert.ok(!messages.includes(text), text);
    });
    await test(`${part.name}: every key finishes with no leaked observer`, () => {
        for (const list of [run.getScreens(), run.getCursors(), run.getRngSlices(), run.getAnimationFramesByStep()])
            assert.equal(list.length, part.moves.length + 1);
        assert.equal(run._display.inputQueueLength, 0);
        assert.ok(game.u.uhp > 0 && !game.program_state.gameover);
        assert.equal(run.getAnimationFramesByStep().flat().length, 0);
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), prior);
    });
    console.log(JSON.stringify({name: part.name, boundaries: run.getScreens().length,
        calls: run.getRngLog().length, frames: run.getAnimationFramesByStep().flat().length,
        entry, carve, final, hashes: {screens: hash(run.getScreens()), cursors: hash(run.getCursors()),
            rng: hash(run.getRngLog()), slices: hash(run.getRngSlices()), frames: hash(run.getAnimationFramesByStep())}}));
}
