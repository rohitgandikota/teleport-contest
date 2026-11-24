// Native ordinary inputs plus two JS-only negative inputs. No raw is rewritten.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Passes_walls} from '../js/youprop.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';

const raw = readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/vault-corridor-destination.session.json', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(raw), 'e04491123e810c9a1f15693d1d9ffceb1444fe9c6bf5f2bcc07c30f9cffe30a1');
const fixture = JSON.parse(raw);
const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/vault-corridor-destination.json', import.meta.url)));
const hash = value => sha(JSON.stringify(value));
const results = [];
async function replay(part) {
    const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            states.push({step, word: g.u.intrinsic?.HPasses_walls || 0,
                magicBreathing: g.u.intrinsic?.HMagical_breathing || 0,
                flat: Object.hasOwn(g.u.uprops || {}, 'PASSES_WALLS'),
                fallback: Object.hasOwn(g.u.wiz_intrinsic_timeouts || {}, 'PASSES_WALLS'),
                effect: Passes_walls(), hero: [g.u.ux, g.u.uy]});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), prior);
    assert.equal(states.length, part.moves.length + 1);
    assert.equal(run._display.inputQueueLength, 0);
    const hashes = {screens: hash(run.getScreens()), cursors: hash(run.getCursors()),
        fullRng: hash(run.getRngLog()), slices: hash(run.getRngSlices()),
        animations: hash(run.getAnimationFramesByStep())};
    return {run, states, hashes};
}
const top = screen => decodeScreen(screen)[0].map(c => c.ch).join('').trimEnd();
for (const [index, part] of fixture.segments.entries()) {
    for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
        assert.deepEqual(part[key], recipe.segments[index][key]);
    const {run, states, hashes} = await replay(part);
    const branch = recipe.branchAssertions[index + 3];
    const {grantStep, expiryStep, movementSteps} = branch.nativeEvidence;
    const cTop = part.steps.map(s => top(s.screen));
    const warningSteps = branch.screenIncludes.slice(1, 3)
        .map(message => cTop.findIndex(line => line.includes(message)));
    await test(`${part.name}: the canonical update precedes the real feedback acknowledgment`, () => {
        assert.equal(states[grantStep].word, 30);
        assert.ok(!states[grantStep].flat && !states[grantStep].fallback);
        assert.ok(top(run.getScreens()[grantStep]).includes('set to 30.--More--'));
        assert.ok(states[grantStep].effect);
    });
    await test(`${part.name}: source warnings and expiry retain native input order`, () => {
        for (const step of [...warningSteps, expiryStep])
            assert.equal(top(run.getScreens()[step]), cTop[step]);
        assert.deepEqual(warningSteps.map(step => states[step].word), [4, 2]);
        assert.equal(states[expiryStep - 1].word, 1);
        assert.equal(states[expiryStep].word, 0);
        assert.ok(warningSteps[0] < warningSteps[1] && warningSteps[1] < expiryStep);
    });
    await test(`${part.name}: expiry precedes all escort inputs without flat timer residue`, () => {
        assert.ok(expiryStep < movementSteps[0]);
        assert.ok(states.every(s => !s.flat && !s.fallback));
        assert.ok(states.slice(expiryStep).every(s => !s.effect && !s.word));
        assert.equal(run.getAnimationFramesByStep().flat().length, 0);
    });
    results.push({name: part.name, kind: 'unchanged C-recorded input',
        hashes, grant: states[grantStep], warnings: warningSteps.map(step => states[step]),
        expiry: states[expiryStep], boundaries: states.length, calls: run.getRngLog().length,
        observersRestored: true});
}

// These two inputs are negative controls, not new C recordings. They reuse the
// verified ordinary setup and select a different property or cancel the menu.
const source = recipe.segments[0];
const prefix = source.moves.slice(0, source.moves.indexOf('#wizintrinsic'));
for (const [name, command, breathing] of [
    ['magical-breathing-negative', '>5g\r', true],
    ['cancel-negative', '\x1b', false],
]) {
    const part = {...source, name,
        moves: prefix + '#wizintrinsic\r' + command + '  \x1b\x1b.......  \x1b\x1b'};
    const {run, states, hashes} = await replay(part);
    await test(`${name}: ordinary input reaches its intended negative path`, () => {
        assert.ok(states.every(s => !s.word && !s.effect && !s.flat && !s.fallback));
        assert.equal(states.some(s => s.magicBreathing === 5), breathing);
        assert.equal(states.at(-1).magicBreathing, 0);
    });
    results.push({name, kind: 'JS-only ordinary negative input', hashes,
        boundaries: states.length, calls: run.getRngLog().length, observersRestored: true});
}
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify({results}, null, 2) + '\n');
console.log(JSON.stringify({results}));
