// Bound the offline scorer worker's runtime for each fixture.
// Pair this timeout check with scoring for output equality and worker errors.
// tools/deferred-input-gate.mjs separately checks delayed input through the
// interactive API. The July 2026 timeout history is in docs/plan/NOTES.md.
//
// Usage:  node tools/hang-gate.mjs [--ms=8000] [session ...]
// Exit 1 if any worker exceeds the time limit. Default: every sessions/ file.

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const msArg = args.find(a => a.startsWith('--ms='));
const budgetMs = msArg ? Number(msArg.slice(5)) : 8000;
let targets = args.filter(a => !a.startsWith('--'));
if (!targets.length)
    targets = readdirSync('sessions').filter(f => f.endsWith('.session.json'))
        .map(f => 'sessions/' + f);

console.log(`hang gate: ${targets.length} session(s), ${budgetMs}ms each`);
console.log('each offline scorer worker has a separate time limit\n');

const hung = [];
for (const t of targets) {
    const r = spawnSync(process.execPath,
        ['frozen/ps_test_runner.mjs', '--worker-session=' + t],
        { timeout: budgetMs, encoding: 'utf8' });
    const name = t.replace(/^sessions\//, '').replace(/\.session\.json$/, '');
    if (r.error && r.error.code === 'ETIMEDOUT') {
        hung.push(name);
        console.log(`  HANG  ${name}`);
    }
}

console.log('');
if (hung.length) {
    console.log(`FAIL: ${hung.length} session worker(s) exceeded the time limit:`);
    for (const h of hung) console.log('  ' + h);
    console.log('\nInspect the timed-out workers and their scorer results.');
    process.exit(1);
}
console.log(`OK: no worker exceeded the time limit (${targets.length} checked).`);
