// unported-hits.mjs — which unported paths do the REAL sessions actually reach?
//
// tools/generalize.mjs reports the same thing for 40 short synthetic games, and
// that is the right instrument for held-out generality. This one answers the
// complementary question: of the code we know is missing, what do the scored
// sessions hit, and in how many of them.
//
// It ranks work by IMPACT rather than by position. tools/diverge.mjs orders by
// where a stream first diverges, which says nothing about a gap that draws no
// RNG -- skill_init's unrestrict arm was reached by 100% of games and never
// appeared in the divergence aggregate at all, because it is RNG-neutral and
// only breaks behaviour.
//
// KNOWN LIMITATION, read before trusting a percentage. This harness feeds only
// segment 0's keys and does not reproduce everything frozen/ps_test_runner.mjs
// does, so most sessions run out of input before they reach the move loop.
// The proof is that `moveloop_preamble set_wear/pickup` is an UNCONDITIONAL
// note_unported at js/allmain.js:290 and yet reports 14%: that 14% is the share
// of sessions this tool got that far in, NOT the share in which the gap
// matters. Treat the percentages as a floor and the ORDERING as the signal,
// until the harness is fixed to match the real runner.
//
//     node tools/unported-hits.mjs
//     node tools/unported-hits.mjs <session-file>

import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv[2];
const files = arg ? [arg]
    : readdirSync(join(ROOT, 'sessions'))
        .filter((f) => f.endsWith('.session.json'))
        .map((f) => join('sessions', f));

const gstate = await import(pathToFileURL(join(ROOT, 'js/gstate.js')).href);
const { runSegment } = await import(pathToFileURL(join(ROOT, 'js/jsmain.js')).href);
const newStorage = () => {
    const m = new Map();
    return {
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => { m.set(k, String(v)); },
        removeItem: (k) => { m.delete(k); },
        get length() { return m.size; },
        key(i) { let n = 0; for (const k of m.keys()) { if (n === i) return k; n++; } return null; },
        clear() { m.clear(); },
    };
};

const hits = new Map();
const errs = new Map();
let ran = 0, threw = 0;

for (const f of files) {
    const data = JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
    const seg = data.segments[0];
    try {
        await runSegment({
            seed: String(seg.seed),
            datetime: seg.datetime,
            nethackrc: seg.nethackrc,
            storage: newStorage(),
            keys: (seg.steps || []).map((s) => s.key),
            onFrame: () => {},
        });
    } catch (e) {
        threw++;
        errs.set(String(e && e.message || e).split('\n')[0].slice(0,70),
                 (errs.get(String(e && e.message || e).split('\n')[0].slice(0,70))||0)+1);
    }
    ran++;
    for (const path of (gstate.game.unported || []))
        hits.set(path, (hits.get(path) || 0) + 1);
}

const rows = [...hits.entries()].sort((a, b) => b[1] - a[1]);
console.log(`${ran} session(s); unported paths REACHED, by share:\n`);
for (const [path, n] of rows) {
    const pct = Math.round((n / ran) * 100);
    console.log(`  ${String(pct).padStart(3)}%  ${'#'.repeat(Math.ceil(pct / 4)).padEnd(25)}  ${path}`);
}
if (!rows.length) console.log('  (none recorded)');
console.log(`\n${threw}/${ran} threw:`);
for (const [m,n] of [...errs].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(n).padStart(3)}  ${m}`);
