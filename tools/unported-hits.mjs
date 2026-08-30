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
// The harness drives sessions the way frozen/ps_test_runner.mjs does:
// normalizeSession() first, then one runSegment() per segment passing `moves`,
// with one storage handle shared across the session. Getting this wrong is
// easy and quiet -- an earlier version passed a flattened key list instead of
// `moves`, and 41 of 44 sessions ran out of input before the move loop. The
// tell was that `moveloop_preamble set_wear/pickup`, an UNCONDITIONAL
// note_unported at js/allmain.js:290, reported 14% instead of 100%.
//
// If a percentage ever looks impossible for an unconditional path, suspect the
// harness before the result.
//
// REACH IS NOT INCORRECTNESS. A high row means the path executed, not that it
// returned the wrong answer. onscary:elbereth reports 98% and is harmless: the
// only unported part is the Elbereth test, our stub returns FALSE, and FALSE
// is what C returns when nothing is engraved -- which is every session but
// one. Weigh each row by whether the answer can actually differ before
// spending a session on it.
//
//     node tools/unported-hits.mjs
//     node tools/unported-hits.mjs <session-file-or-directory>
//     node tools/unported-hits.mjs <session-file-or-directory> --evidence

import { readdirSync, readFileSync, statSync } from 'fs';
import { basename, join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const showEvidence = args.includes('--evidence');
const arg = args.find((item) => item !== '--evidence');
const target = arg ? join(ROOT, arg) : null;
const files = target && statSync(target).isDirectory()
    ? readdirSync(target)
        .filter((f) => f.endsWith('.session.json'))
        .map((f) => join(arg, f))
    : arg ? [arg]
      : readdirSync(join(ROOT, 'sessions'))
        .filter((f) => f.endsWith('.session.json'))
        .map((f) => join('sessions', f));

const gstate = await import(pathToFileURL(join(ROOT, 'js/gstate.js')).href);
const { runSegment } = await import(pathToFileURL(join(ROOT, 'js/jsmain.js')).href);
const { normalizeSession } = await import(pathToFileURL(join(ROOT, 'frozen/session_loader.mjs')).href);
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
const evidence = new Map();
const errs = new Map();
let ran = 0, threw = 0;

for (const f of files) {
    const data = JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
    /* drive it the way frozen/ps_test_runner.mjs does: normalize first, then
       pass `moves` per segment, not a flattened key list */
    const { segments } = normalizeSession(data);
    const storage = newStorage();
    try {
        for (const seg of segments)
            await runSegment({
                seed: seg.seed,
                datetime: seg.datetime,
                nethackrc: seg.nethackrc,
                moves: seg.moves,
                storage,
                onFrame: () => {},
            });
    } catch (e) {
        threw++;
        errs.set(String(e && e.message || e).split('\n')[0].slice(0,70),
                 (errs.get(String(e && e.message || e).split('\n')[0].slice(0,70))||0)+1);
    }
    ran++;
    for (const path of (gstate.game.unported || [])) {
        hits.set(path, (hits.get(path) || 0) + 1);
        if (showEvidence) {
            if (!evidence.has(path))
                evidence.set(path, []);
            evidence.get(path).push(basename(f, '.session.json'));
        }
    }
}

const rows = [...hits.entries()].sort((a, b) => b[1] - a[1]);
console.log(`${ran} session(s); unported paths REACHED, by share:\n`);
for (const [path, n] of rows) {
    const pct = Math.round((n / ran) * 100);
    console.log(`  ${String(pct).padStart(3)}%  ${'#'.repeat(Math.ceil(pct / 4)).padEnd(25)}  ${path}`);
    if (showEvidence)
        console.log(`       ${evidence.get(path).join(', ')}`);
}
if (!rows.length) console.log('  (none recorded)');
console.log(`\n${threw}/${ran} threw:`);
for (const [m,n] of [...errs].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(n).padStart(3)}  ${m}`);
