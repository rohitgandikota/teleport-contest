import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {outputs, hashes, deferred} from './observe.mjs';
import {branchAssertionErrors} from './assertions.mjs';

const recipe = JSON.parse(readFileSync(new URL('../../recipe.json', import.meta.url)));
const results = [];
const timer = setTimeout(() => process.exit(2), 55000);
for (const [index, part] of recipe.segments.entries()) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let out;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            if (!g.u || !g.level) return;
            states.push({step, level: {...g.u.uz}, xy: [g.u.ux, g.u.uy],
                hp: g.u.uhp, turn: g.moves, trap: g.trapinfo?.tobj?.o_id ?? null,
                time: g.trapinfo?.time_needed ?? null,
                occupation: g.occupation?.name ?? null});
        }};
        out = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    const result = {name: part.name, hashes: hashes(out), states, checks: []};
    async function check(name, fn) {
        try { await fn(); result.checks.push({name, pass: true}); }
        catch (error) { result.checks.push({name, pass: false, error: error.message.slice(0, 700)}); }
    }
    await check('real trap producer and source branch', () => {
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
        assert.equal(out.screens.length, part.moves.length + 1);
        assert.deepEqual(out.slices.flat(), out.calls);
        assert.ok(states.every(s => s.hp > 0));
        if (index < 4) {
            const start = states.find(s => s.step === 31);
            assert.equal(start.trap, 34);
            assert.equal(start.time, 4);
            assert.equal(start.occupation, null, 'actual nearby monster interrupted occupation');
        }
        if (index === 0) {
            for (const step of [34, 37]) {
                const state = states.find(s => s.step === step);
                assert.equal(state.trap, null, 'departing clears trap context');
                assert.equal(state.time, 4, 'reset does not zero saved duration');
            }
            assert.equal(states.at(-1).trap, 34);
            assert.equal(states.at(-1).time, 4, 'return begins a new attempt');
            assert.deepEqual(states.at(-1).xy, [60, 14]);
        } else if (index < 4) {
            assert.equal(states.at(-1).trap, 34);
            assert.equal(states.at(-1).time, 4);
            assert.ok(states.every(s => s.level.dnum === 0 && s.level.dlevel === 1));
        } else {
            assert.ok(states.every(s => s.trap === null));
            assert.equal(states.find(s => s.step === 3).level.dlevel, 2);
            assert.equal(states.at(-1).level.dlevel, 1);
        }
        const assertion = recipe.branchAssertions[index];
        const generated = {segments: []};
        generated.segments[index] = {steps: out.screens.map((screen, i) => ({screen, rng: out.slices[i]}))};
        assert.deepEqual(branchAssertionErrors({...recipe, branches: [assertion.branch],
            branchAssertions: [assertion]}, generated), []);
        if (index) assert.deepEqual(result.hashes, recipe.unchangedOutputHashes[part.name]);
    });
    await check('observer preserves all five channels', async () =>
        assert.deepEqual(out, outputs(await runSegment({...part, storage: new InMemoryStorage()}))));
    await check('deferred keys and held EOF preserve all five channels', async () =>
        assert.deepEqual(out, await deferred(part)));
    results.push(result);
}
clearTimeout(timer);
const report = {classification: 'ordinary keyboard checks, no native claim', total: 15,
    passed: results.flatMap(r => r.checks).filter(c => c.pass).length, results};
writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({total: report.total, passed: report.passed,
    failed: results.flatMap(r => r.checks.filter(c => !c.pass).map(c => ({case: r.name, ...c})))}));
if (report.passed !== report.total) process.exitCode = 1;
