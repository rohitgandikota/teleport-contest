// Mandatory canonical evidence validation precedes both game/control imports.
import {reportPath, nativeEvidence} from './guard-cleanup-prompt-preflight.mjs';
import {writeFileSync} from 'node:fs';

const {report: source} = await import('./guard-cleanup-prompt/source.mjs');
const {report: escape} = await import('./guard-cleanup-prompt/escape.mjs');
const report = {
    classification: 'Constructed public-helper controls; not ordinary reach',
    passed: source.passed + escape.passed,
    total: source.total + escape.total,
    results: [...source.results, ...escape.results],
    nativePreflight: nativeEvidence,
};
if (reportPath)
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({passed: report.passed, total: report.total}));
if (report.passed !== 17 || report.total !== 17)
    process.exitCode = 1;
