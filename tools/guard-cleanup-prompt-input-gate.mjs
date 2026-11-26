// Mandatory canonical evidence validation precedes every game/control import.
import {reportPath, nativeEvidence} from './guard-cleanup-prompt-preflight.mjs';
import {writeFileSync} from 'node:fs';

const {report: original} = await import('./guard-cleanup-prompt/ordinary.mjs');
const report = {
    classification: original.classification,
    passed: original.passed + original.cleanupPolicy.passed,
    total: original.total + original.cleanupPolicy.total,
    ordinary: {passed: original.passed, total: original.total},
    policy: {passed: original.cleanupPolicy.passed, total: original.cleanupPolicy.total},
    results: [...original.results, ...original.cleanupPolicy.results],
    cases: original.rows.map(({name, keys, boundaries, calls, hashes, deferredHashes}) =>
        ({name, keys, boundaries, calls, hashes, deferredHashes})),
    nativePreflight: nativeEvidence,
};
if (reportPath)
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({passed: report.passed, total: report.total,
    ordinary: report.ordinary, policy: report.policy, cases: report.cases.length}));
if (original.passed !== 40 || original.total !== 40
    || original.cleanupPolicy.passed !== 5 || original.cleanupPolicy.total !== 5)
    process.exitCode = 1;
