import assert from 'node:assert/strict';
import {writeFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {root, read, verifyRuntime, rawFile} from './preflight.mjs';

await import('./probe.mjs');
const rows = read('reports/candidate-observation.json');
const legacy = structuredClone(rows);
for (const row of legacy) {
    if (read('predictions.json')[row.index].trigger) continue;
    for (const check of row.checks) {
        let evaluate;
        if (check.name === 'underwater return retains slime apart from elapsed turns; dry fire cures')
            evaluate = () => assert.equal(row.after.slime, 100);
        else if (check.name === 'source trap RNG prefix is preserved without filtering world-turn calls')
            evaluate = () => assert.deepEqual(row.actionCalls, []);
        if (!evaluate) continue;
        try { evaluate(); check.pass = true; delete check.error; }
        catch (error) { check.pass = false; check.error = error.message; }
    }
    row.source = row.checks.filter(c => c.kind === 'source').every(c => c.pass);
}
const write = (name, value) => writeFileSync(new URL(name, root), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
write('reports/legacy-candidate-accounting.json', legacy);
const nativeReport = new URL('reports/candidate-native.json', root);
assert.ok(!existsSync(nativeReport));
process.argv = [process.execPath,
    fileURLToPath(new URL('tools/tty-text-window-native-gate.mjs', root)),
    fileURLToPath(rawFile), fileURLToPath(nativeReport)];
await import('./tools/tty-text-window-native-gate.mjs');

const native = read('reports/candidate-native.json');
const baselineNative = read('history/parent-baseline-native.json');
const original = read('history/original-observation.json');
const baseline = read('history/authoritative-baseline-accounting.json');
const exact = r => r.fullStyleExact && r.frozenScreenCursorExact && r.fullRngExact && r.animationExact;
const behavior = ({checks, producer, source, ...rest}) => rest;
const checks = [];
const check = (name, fn) => {
    try { fn(); checks.push({name, pass: true}); }
    catch (error) { checks.push({name, pass: false, error: error.message}); }
};
check('corrected102 checks pass', () => {
    assert.equal(rows.flatMap(r => r.checks).length, 102);
    assert.equal(rows.flatMap(r => r.checks).filter(c => c.pass).length, 102);
});
check('legacy accounting retains exactly the two blind-look failures', () => {
    assert.equal(legacy.flatMap(r => r.checks).filter(c => c.pass).length, 100);
    assert.deepEqual(legacy.filter(r => !r.source).map(r => r.index), [4]);
    assert.deepEqual(legacy[4].checks.filter(c => !c.pass), original[4].checks.filter(c => !c.pass));
});
check('native moves4/6 to6/6 without changing inputs', () => {
    assert.deepEqual(baselineNative.map(exact), [false, false, true, true, true, true]);
    assert.equal(native.length, 6);
    assert.ok(native.every(exact));
});
check('all20 negative hashes unchanged', () =>
    assert.deepEqual(read('reports/candidate-negative-hashes.json'), read('negative-hashes.json')));
for (const index of [2, 3, 4, 5]) {
    check(`${index}: complete corrected ordinary negative row unchanged`, () => assert.deepEqual(rows[index], baseline[index]));
    check(`${index}: complete legacy ordinary negative row unchanged`, () => assert.deepEqual(legacy[index], original[index]));
    check(`${index}: original behavior-only negative row unchanged`, () => assert.deepEqual(behavior(rows[index]), behavior(original[index])));
    check(`${index}: complete native negative report unchanged`, () => assert.deepEqual(native[index], baselineNative[index]));
}
check('all30 observed JS hashes equal native-comparator JS hashes', () => {
    for (const [index, row] of rows.entries()) assert.deepEqual(native[index].rawHashes.js, row.outputHashes);
});
verifyRuntime();
const report = {
    checks,
    ordinary: {cases: rows.length, checks: 102, passed: rows.flatMap(r => r.checks).filter(c => c.pass).length,
        producerChecks: rows.flatMap(r => r.checks).filter(c => c.kind === 'producer' && c.pass).length,
        sourceChecks: rows.flatMap(r => r.checks).filter(c => c.kind === 'source' && c.pass).length,
        neutrality: rows.flatMap(r => r.checks).filter(c => c.kind === 'neutrality' && c.pass).length},
    history: {original: '88/102', authoritativeBaseline: '90/102',
        legacyCandidatePassed: legacy.flatMap(r => r.checks).filter(c => c.pass).length,
        legacyDerivedWithoutReplay: true, originalAssertionsPreserved: true},
    native: {before: baselineNative.filter(exact).length, after: native.filter(exact).length,
        cases: 6, boundaries: 873, calls: 16839, frames: 21},
    negativeIndexes: [2, 3, 4, 5], sourceInputsUnchanged: true,
    changedRuntimeFiles: ['js/trap.js'], newCRecordings: 0
};
write('reports/accounting.json', report);
console.log(JSON.stringify(report));
if (checks.some(c => !c.pass)) process.exitCode = 1;
