// Native witnesses are independent of the JS runtime and its observers.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const bytes = fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/vault-guard-death-throttle.session.json', import.meta.url));
const raw = JSON.parse(bytes);
const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-guard-death-throttle.json', import.meta.url)));
const requirements = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/coverage-requirements.json', import.meta.url)));
const boundaries = [95, 120, 157, 120], counts = [5464, 5615, 6136, 5493];
const births = [1, 2, 3, 2], ledgerSteps = [80, 105, 130, 105];
const waitStarts = [83, 108, 133, 108];
const ledgerNames = ['a guard', '2 guards', '3 guards', '2 human zombies'];
const rolls = [[], [3, 1, 3, 0, 0, 2, 3, 0, 2, 3, 2, 0],
    [5, 7, 5, 7, 8, 6, 3, 6, 2, 2, 3, 8, 8, 7, 0, 7, 0, 7, 2, 6, 4, 6, 0, 8], []];
const ownerSite = '@ invault(vault.c:334)';
const callerSite = '@ moveloop_core(allmain.c:360)';
const lines = step => decodeScreen(step.screen).map(row => row.map(cell => cell.ch).join('').trim());

function witness(index) {
    const part = raw.segments[index];
    const ledger = part.steps[ledgerSteps[index]];
    return {
        creations: Array.from({length: births[index]}, (_, n) => {
            const prompt = part.steps[50 + 25 * n], answer = part.steps[51 + 25 * n];
            const kill = part.steps[64 + 25 * n];
            return {prompt: lines(prompt)[0], promptCursor: prompt.cursor, promptRng: prompt.rng,
                answer: answer.key, creation: lines(answer)[0],
                kill: lines(kill)[0], killRng: kill.rng};
        }),
        ledger: {lines: lines(ledger).slice(0, 3), cursor: ledger.cursor, rng: ledger.rng},
        beforeWaitOwner: part.steps.slice(0, waitStarts[index]).flatMap(s => s.rng)
            .filter(c => c.endsWith(ownerSite)),
        beforeWaitTurns: part.steps.slice(0, waitStarts[index]).flatMap((s, step) =>
            s.rng.filter(c => c.endsWith(callerSite)).map(call => ({step, key: s.key, call}))),
        waits: part.steps.slice(waitStarts[index]).map((s, n) =>
            ({step: waitStarts[index] + n, key: s.key, rng: s.rng})),
    };
}

function assertWitness(index, value) {
    const negative = index === 3;
    assert.equal(value.creations.length, births[index]);
    for (const c of value.creations) {
        assert.equal(c.prompt, 'Creating human zombie instead; force guard? [yn] (n)');
        assert.deepEqual(c.promptCursor, [53, 0, 1]);
        assert.deepEqual(c.promptRng, []);
        assert.equal(c.answer, negative ? 'n' : 'y');
        assert.match(c.creation, negative ? /^A human zombie appears/ : /^A guard appears/);
        assert.match(c.kill, negative ? /^You destroy the human zombie!/ : /^You kill the guard!/);
        assert.ok(c.killRng.some(c => c.endsWith('@ xkilled(mon.c:3587)')));
    }
    // The vanquished ledger is a species-death witness, unlike a monster name.
    assert.deepEqual(value.ledger.lines, ['Vanquished creatures:', '', ledgerNames[index]]);
    assert.deepEqual(value.ledger.cursor, [49, 3, 1]);
    assert.deepEqual(value.ledger.rng, []);
    assert.deepEqual(value.beforeWaitOwner, []);
    assert.deepEqual(value.beforeWaitTurns, [{step: 43, key: ' ',
        call: 'rn2(67)=55 @ moveloop_core(allmain.c:360)'}], 'one elapsed turn at vault entry before the time-free commands');
    assert.equal(value.waits.length, index === 2 ? 24 : 12);
    let timer = 1;
    const timerSequence = [];
    for (const [n, wait] of value.waits.entries()) {
        assert.equal(wait.step, waitStarts[index] + n);
        assert.equal(wait.key, '.');
        const owner = wait.rng.filter(c => c.endsWith(ownerSite));
        const caller = wait.rng.filter(c => c.endsWith(callerSite));
        assert.equal(caller.length, 1, 'one engraving check per elapsed turn');
        if (index === 1 || index === 2) {
            assert.deepEqual(owner, [`rn2(${index === 1 ? 4 : 9})=${rolls[index][n]} ${ownerSite}`]);
            assert.ok(wait.rng.indexOf(owner[0]) < wait.rng.indexOf(caller[0]), 'invault precedes caller RNG');
            if (rolls[index][n] === 0) ++timer;
        } else {
            assert.deepEqual(owner, [], 'one guard death or zombie deaths do not throttle');
            ++timer;
        }
        timerSequence.push(timer);
    }
    assert.equal(timer, [13, 5, 4, 13][index]);
    return timerSequence;
}

await test('immutable raw bytes, native counts, five input fields, every key and recipe assertions', () => {
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
        '90d31fee9304b9d74c2ab56cd0207093fece318fb7e125e4e78fd55540f4e756');
    assert.equal(raw.source, 'c');
    assert.equal(raw.version, 5);
    assert.equal(raw.segments.length, 4);
    assert.equal(recipe.branchAssertions.length, 4);
    for (const [i, part] of raw.segments.entries()) {
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(part[field], recipe.segments[i][field]);
        assert.deepEqual(part.steps.map(s => s.key), [null, ...part.moves]);
        assert.equal(part.steps.length, boundaries[i]);
        assert.equal(part.steps.flatMap(s => s.rng).length, counts[i]);
        assert.ok(part.steps.every(s => (s.animation_frames || []).length === 0));
        assert.equal(part.moves.includes('#timeout'), false, 'rejected pointer-bearing V1 is excluded');
    }
    assert.deepEqual(recordingIntegrityErrors(raw), []);
    assert.deepEqual(branchAssertionErrors(recipe, raw), []);
    const tags = new Set(requirements.requirements.map(r => r.id));
    assert.ok(recipe.coverage.every(tag => tags.has(tag)));
});
for (const [i, part] of raw.segments.entries()) {
    await test(`${part.name}: native species ledger, throttle outcomes and caller ordering`, () => {
        const value = witness(i), timerSequence = assertWitness(i, value);
        console.log(JSON.stringify({name: part.name, ledgerStep: ledgerSteps[i],
            ledger: value.ledger.lines[2], waitStart: waitStarts[i], ownerDraws: rolls[i],
            inferredTimerSequence: timerSequence,
            timerEvidence: 'C rule applied to observed native calls; counter itself is not recorded'}));
    });
}
await test('negative: appearance or a creation request cannot substitute for the death ledger', () => {
    const changed = structuredClone(witness(3));
    changed.ledger.lines[2] = '2 guards';
    assert.throws(() => assertWitness(3, changed), assert.AssertionError);
});
await test('negative: declining the creation override cannot prove real guard creation', () => {
    const changed = structuredClone(witness(1));
    changed.creations[0].answer = 'n';
    assert.throws(() => assertWitness(1, changed), assert.AssertionError);
});
await test('negative: an equal-range draw from another owner is not an invault witness', () => {
    const changed = structuredClone(witness(1)), wait = changed.waits[0];
    const at = wait.rng.findIndex(c => c.endsWith(ownerSite));
    wait.rng[at] = wait.rng[at].replace(ownerSite, '@ start_corpse_timeout(mkobj.c:1413)');
    assert.throws(() => assertWitness(1, changed), assert.AssertionError);
});
await test('negative: moving the throttle draw after caller RNG is rejected', () => {
    const changed = structuredClone(witness(1)), wait = changed.waits[0];
    const at = wait.rng.findIndex(c => c.endsWith(ownerSite));
    wait.rng.push(wait.rng.splice(at, 1)[0]);
    assert.throws(() => assertWitness(1, changed), assert.AssertionError);
});
await test('negative: changing a failed roll to zero changes the inferred timer', () => {
    const changed = structuredClone(witness(2)), wait = changed.waits[0];
    const at = wait.rng.findIndex(c => c.endsWith(ownerSite));
    wait.rng[at] = wait.rng[at].replace('=5 ', '=0 ');
    assert.throws(() => assertWitness(2, changed), assert.AssertionError);
});
await test('negative: zombie deaths must not acquire guard throttle calls', () => {
    const changed = structuredClone(witness(3));
    changed.waits[0].rng.unshift(`rn2(4)=0 ${ownerSite}`);
    assert.throws(() => assertWitness(3, changed), assert.AssertionError);
});
