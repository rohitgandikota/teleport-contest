// Ordinary inputs only. Passive snapshots are restored in finally. This gate
// proves JS reach, not native parity. An optional recorded fixture must preserve
// every recipe input and every key, and is never rewritten.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Passes_walls, Antimagic} from '../js/youprop.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {ANTI_MAGIC, D_CLOSED, D_NODOOR, REPAIR_DELAY} from '../js/const.js';
const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/passes-walls-consumers.json', import.meta.url)));
const fixture = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2])) : null;
if (fixture) {
    assert.equal(fixture.version, 5); assert.equal(fixture.source, 'c');
    assert.equal(fixture.segments.length, recipe.segments.length);
    fixture.segments.forEach((part, i) => {
        for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(part[key], recipe.segments[i][key]);
        assert.ok(Array.isArray(part.steps));
        if (part.steps.length) {
            assert.equal(part.steps.length, part.moves.length + 1);
            assert.equal(part.steps[0].key, null);
            assert.deepEqual(part.steps.slice(1).map(s => s.key), Array.from(part.moves));
        }
    });
}
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const results = [];
for (const [i, part] of recipe.segments.entries()) {
    const states = [], prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            const tile = g.level.at(g.u.ux, g.u.uy);
            states.push({step, xy: [g.u.ux, g.u.uy], hp: g.u.uhp, pw: g.u.uen,
                maxPw: g.u.uenmax, move: g.moves, word: g.u.intrinsic?.HPasses_walls || 0,
                phase: Passes_walls(), mr: Antimagic(),
                flat: Object.hasOwn(g.u.uprops || {}, 'PASSES_WALLS'),
                trap: g.level.traps.find(t => t.tx === g.u.ux && t.ty === g.u.uy)?.ttyp,
                typ: tile.typ, mask: tile.doormask,
                damage: (g.level.damagelist || []).map(d => ({x:d.x, y:d.y, typ:d.typ, when:d.when}))});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), prior);
    assert.equal(run.getScreens().length, part.moves.length + 1);
    assert.equal(run._display.inputQueueLength, 0);
    const screens = run.getScreens().map(s => decodeScreen(s).map(row => row.map(c => c.ch).join('')).join('\n'));
    const branch = recipe.branchAssertions[i];
    const result = {name:part.name, boundaries:states.length, calls:run.getRngLog().length,
        frames:run.getAnimationFramesByStep().flat().length, observersRestored:true,
        frameSteps: run.getAnimationFramesByStep().flatMap((frames, step) =>
            frames.length ? [{step, count: frames.length}] : []),
        hashes:{screens:hash(run.getScreens()), cursors:hash(run.getCursors()),
            fullRng:hash(run.getRngLog()), slices:hash(run.getRngSlices()),
            animations:hash(run.getAnimationFramesByStep())}, states};
    results.push(result);
    await test(`${part.name}: declared feedback and completed ordinary inputs`, () => {
        for (const message of branch.screenIncludes) assert.ok(screens.some(s => s.includes(message)), message);
        for (const message of branch.screenExcludes || []) assert.ok(!screens.some(s => s.includes(message)), message);
        assert.equal(result.frames, i < 2 ? 0 : 8);
        if (i >= 2) assert.ok(result.frameSteps.every(f => f.step < 86),
            'all eight frames belong to the original shop setup, before the new phasing/teleport inputs');
    });
    if (i < 2) {
        await test(`${part.name}: real field, MR cloak, damage and energy ordering`, () => {
            const step = screens.findIndex(s => s.includes('You sit down.') && s.includes('You feel'));
            assert.ok(step > 0);
            const before = states[step - 1], after = states[step];
            assert.equal(before.trap, ANTI_MAGIC); assert.ok(before.mr);
            assert.equal(before.phase, i === 0);
            assert.equal(before.hp - after.hp, i === 0 ? 1 : 4);
            assert.equal(after.pw, 3);
            const calls = run.getRngSlices()[step];
            assert.match(calls[0], /^rnd\(4\)=4$/);
            assert.match(calls[1], /^d\(2,6\)=/);
            assert.ok(screens[step + 1].includes('magical energy drain away!'));
            assert.equal(states[step + 1].move, before.move + 1);
            if (i === 0) {
                assert.equal(before.word, 30); assert.equal(after.word, 30);
                assert.equal(states[step + 1].word, 29); assert.ok(!before.flat);
            }
        });
    } else {
        await test(`${part.name}: occupied real doorway, aged damage and repair disposition`, () => {
            const occupied = states.find(s => s.xy[0] === 29 && s.xy[1] === 5 && s.damage.length);
            assert.ok(occupied); assert.equal(occupied.mask, D_NODOOR);
            const eligible = states.filter(s => s.step >= occupied.step && s.move >= occupied.damage[0].when + REPAIR_DELAY);
            assert.ok(eligible.length >= 2);
            assert.ok(eligible.every(s => s.xy[0] === 29 && s.xy[1] === 5));
            if (i === 2) {
                const repaired = eligible.find(s => !s.damage.length);
                assert.ok(repaired && repaired.phase && repaired.word > 0 && !repaired.flat);
                assert.equal(repaired.mask, D_CLOSED);
                assert.ok(screens[repaired.step].includes('Samoe whispers an incantation.  Suddenly, the shop door reappears!'));
            } else {
                assert.ok(eligible.every(s => !s.phase && !s.word && s.damage.length === 1 && s.mask === D_NODOOR));
            }
        });
    }
}
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify({kind:'JS ordinary-input reach, not native parity',results}, null, 2) + '\n');
