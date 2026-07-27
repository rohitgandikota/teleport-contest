// tools/hang-gate.mjs — reproduce the JUDGE's end-of-input blocking behaviour.
//
// WHY THIS EXISTS. Neither of our other gates can see a judge hang:
//   - frozen/score.sh runs only the 44 public sessions and lets nhgetch THROW
//     "Input queue empty" when the queue drains, so an over-read looks benign.
//   - tools/generalize.mjs hits the same throw path.
// The judge runs frozen/playability_runner.mjs, which sets game.nhDisplay to a
// js/terminal.js instance. That class HAS readKey(), so js/input.js:20 falls
// through to `await display.readKey(...)` instead of throwing, and an
// end-of-input --More-- BLOCKS FOREVER. One hung session eats the judge's
// whole 900s budget and the fork goes unscored -- that is what happened on
// Mon 27 Jul 2026 20:50 UTC.
//
// A hang is a DIVERGENCE SIGNAL, not just a stall: the session's key list is
// exactly what C consumed, so asking for one more key means we emitted a
// prompt C did not.
//
// Usage:  node tools/hang-gate.mjs [--ms=8000] [session ...]
// Exit 1 if any session over-reads. Default: every session in sessions/.

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
console.log('a session that BLOCKS asked for a key the recorded run never provided\n');

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
    console.log(`FAIL: ${hung.length} session(s) blocked on an over-read:`);
    for (const h of hung) console.log('  ' + h);
    console.log('\nDo not push. Find the message we emit that C does not.');
    process.exit(1);
}
console.log(`OK: no session over-read (${targets.length} checked).`);
