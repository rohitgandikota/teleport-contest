import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const reportPath = process.argv[2];
assert.ok(process.argv.length <= 3 && !reportPath?.startsWith('--'),
    'optional argument: compact report path');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => readFileSync(new URL(name, import.meta.url));
const recipeBytes = read('./gen-sessions/recipes/tower-arrival-contract.json');
const lockBytes = read('./gen-sessions/evidence/tower-arrival-contract/input-lock.json');
const rawBytes = read('./gen-sessions/generated/tower-arrival-contract.session.json');
assert.equal(sha(recipeBytes), '5af0b3c936091eeb42982686138907f63705c2d289399d5f70ec9fdccf4c8342');
assert.equal(sha(lockBytes), '895c139c1ddebd0df77bc6e82448eb1a89a798276e059510fcd53f7e3bfd364a');
assert.equal(sha(rawBytes), 'ae78c9e81d91eedfe642ca09094bb91be3188305ad9ac61a3e91ccbb45972d54');
assert.equal(rawBytes.length, 7697547);
const recipe = JSON.parse(recipeBytes), lock = JSON.parse(lockBytes), raw = JSON.parse(rawBytes);
assert.equal(raw.source, 'c');
assert.equal(raw.version, 5);
assert.equal(raw.segments.length, 7);
assert.equal(recipe.segments.length, 7);
assert.equal(recipe.branchAssertions.length, 7);
assert.equal(lock.recipeSHA256, sha(recipeBytes));
for (const [i, part] of recipe.segments.entries()) {
    const native = raw.segments[i];
    for (const field of lock.fields) {
        assert.equal(Object.hasOwn(native, field), Object.hasOwn(part, field));
        assert.deepEqual(native[field], part[field]);
    }
    assert.deepEqual(native.steps.map(s=>s.key), [null, ...part.moves]);
}
assert.deepEqual(recordingIntegrityErrors(raw), []);
assert.deepEqual(branchAssertionErrors(recipe, raw), []);

const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {In_W_tower} = await import('../js/dungeon.js');
const {outputs, hashes, deferred} = await import('./half-damage-reader-observe.mjs');
const checks = [], cases = [], deadline = setTimeout(()=>process.exit(2), 55000);
function check(name, fn) {
    try { fn(); checks.push({name, pass:true}); }
    catch (error) { checks.push({name, pass:false, error:error.message.slice(0,700)}); }
}
try {
    for (const [i, part] of recipe.segments.entries()) {
        const expected = recipe.stateRequirements[i], states = [];
        const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        let output;
        try {
            globalThis.__step_snapshot = {step:'*', cb(g,step) {
                if (!g.u || !g.level) return;
                const u = g.u;
                states.push({step, xy:[u.ux,u.uy], level:[u.uz.dnum,u.uz.dlevel],
                    inside:In_W_tower(u.ux,u.uy,u.uz), mortality:u.umortality||0});
            }};
            output = outputs(await runSegment({...part, storage:new InMemoryStorage()}));
        } finally {
            if (previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
            else delete globalThis.__step_snapshot;
        }
        const name = part.name, last = states.at(-1), observedHashes = hashes(output);
        check(`${name}/observer-restored`, ()=>assert.deepEqual(
            Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous));
        check(`${name}/all-keys`, ()=>assert.equal(output.screens.length,part.moves.length+1));
        check(`${name}/ordered-rng`, ()=>assert.deepEqual(output.slices.flat(),output.calls));
        check(`${name}/destination`, ()=>assert.deepEqual(last.level,expected.level));
        check(`${name}/inside`, ()=>assert.equal(last.inside,expected.inside));
        check(`${name}/survived`, ()=>assert.equal(last.mortality,0));
        if (name !== 'outside-to-middle')
            check(`${name}/real-portal-entry`, ()=>assert.ok(states.some(s=>
                s.level[0]===1 && s.level[1]===18 && s.inside)));
        else
            check(`${name}/outside-origin`, ()=>assert.ok(states.some(s=>
                s.level[0]===1 && s.level[1]===18 && !s.inside)));
        if (name === 'inside-up-then-down')
            check(`${name}/interior-middle-stop`, ()=>assert.ok(states.some(s=>
                s.level[0]===1 && s.level[1]===17 && s.inside)));
        if (expected.unchangedHashes)
            check(`${name}/five-negative-streams`, ()=>assert.deepEqual(observedHashes,expected.unchangedHashes));
        const plain = outputs(await runSegment({...part, storage:new InMemoryStorage()}));
        check(`${name}/read-only-observer`, ()=>assert.deepEqual(hashes(plain),observedHashes));
        const held = await deferred(part);
        // Compare after deferred() reaches a real pending read with every key consumed.
        check(`${name}/deferred-input`, ()=>assert.deepEqual(hashes(held),observedHashes));
        cases.push({name, last, hashes:observedHashes});
    }
    const report = {total:checks.length, passed:checks.filter(c=>c.pass).length, checks, cases,
        scope:'Ordinary portal and level-change state, observer neutrality and held EOF; native parity is checked separately.',
        negativeHashes:20, casesCount:7};
    if (reportPath) writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({passed:report.passed,total:report.total,cases:7,
        failures:checks.filter(c=>!c.pass).map(c=>c.name)}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
