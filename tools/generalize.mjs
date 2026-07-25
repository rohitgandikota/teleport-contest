#!/usr/bin/env node
// generalize.mjs — what would the HELD-OUT sessions block on?
//
// The 44 held-out sessions are the half that decides the contest and the half we
// never see. Tuning against `sessions/` measures the wrong thing: the leaderboard
// shows four entrants at a perfect 11405/11405 public and 265, 61, 2524, 2877
// held-out.
//
// This asks a question that does not involve the public set at all. Run the port
// over a spread of seeds and rc configurations that are NOT in sessions/, and
// count which unported code paths get REACHED. A path reached by 90% of random
// games is one a held-out session almost certainly hits; a path reached by one
// game in fifty is not worth porting next, however visible it is locally.
//
// It cannot tell us whether a ported path is CORRECT — there is no C reference
// for a seed nobody recorded. It only ranks what is missing, which is exactly
// the ordering question `tools/diverge.mjs` cannot answer without the answers.
//
// TWO CAVEATS, both learned the hard way:
//
// 1. Reached is not the same as DRAWS. The first run of this put
//    `m_dowear with inventory` on top at 21% of games — and m_dowear plus
//    m_dowear_type is 244 lines of C containing not one rn2/rnd/rn1. It changes
//    what a monster is wearing, not the PRNG stream. Before acting on anything
//    this reports, grep the C function for draws.
//
// 2. It only sees as far as the first keystroke the game asks for, which is the
//    legacy blurb's --More--. So this ranks LEVEL GENERATION, and cannot see
//    anything in the move loop. m_move will never appear here no matter how
//    central it is.
//
// Usage:
//   node tools/generalize.mjs             # 40 seeds x the default role spread
//   node tools/generalize.mjs 100         # more seeds
//   node tools/generalize.mjs 40 --roles  # per-role breakdown

import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const N = Number(process.argv[2]) || 40;
const perRole = process.argv.includes('--roles');

/* Deliberately NOT the public set's seeds. Held-out seeds are unknown, so use a
   spread far from the ones in sessions/. */
const seedOf = i => 20000 + i * 137;

/* One config per role, each pinning every facet so no chargen keys are needed.
   The races and alignments are the ones each role actually allows. */
const CONFIGS = [
    'name:Gen,role:Archeologist,race:human,gender:male,align:lawful',
    'name:Gen,role:Barbarian,race:orc,gender:female,align:chaotic',
    'name:Gen,role:Caveman,race:gnome,gender:male,align:neutral',
    'name:Gen,role:Healer,race:gnome,gender:female,align:neutral',
    'name:Gen,role:Knight,race:human,gender:male,align:lawful',
    'name:Gen,role:Monk,race:human,gender:female,align:chaotic',
    'name:Gen,role:Priest,race:elf,gender:male,align:chaotic',
    'name:Gen,role:Ranger,race:elf,gender:female,align:chaotic',
    'name:Gen,role:Rogue,race:orc,gender:male,align:chaotic',
    'name:Gen,role:Samurai,race:human,gender:female,align:lawful',
    'name:Gen,role:Tourist,race:human,gender:male,align:neutral',
    'name:Gen,role:Valkyrie,race:dwarf,gender:female,align:lawful',
    'name:Gen,role:Wizard,race:gnome,gender:male,align:neutral',
];

/* pathToFileURL matters: importing by plain path gives a SEPARATE module
   instance from the one js/jsmain.js loads, so `game` would stay empty. */
const { runSegment } = await import(pathToFileURL(join(ROOT, 'js/jsmain.js')).href);
const gstate = await import(pathToFileURL(join(ROOT, 'js/gstate.js')).href);

const newStorage = () => {
    const m = new Map();
    return {
        getItem: k => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => { m.set(k, String(v)); },
        removeItem: k => { m.delete(k); },
        get length() { return m.size; },
        key(i) { let n = 0; for (const k of m.keys()) { if (n === i) return k; n++; } return null; },
    };
};

const hits = new Map();          // path -> games that reached it
const byRole = new Map();        // role -> Map(path -> count)
let ran = 0, failed = 0;
const errors = new Map();

for (let i = 0; i < N; i++) {
    const cfg = CONFIGS[i % CONFIGS.length];
    const role = /role:(\w+)/.exec(cfg)[1];
    try {
        await runSegment({
            seed: String(seedOf(i)),
            nethackrc: `OPTIONS=${cfg}\n`,
            storage: newStorage(),
            datetime: '2026-07-25T12:00:00Z',
            /* spaces dismiss --More-- prompts (the legacy blurb, the
               welcome line) so the game reaches the move loop and a few
               turns of it, which is where most unported paths live */
            keys: ' '.repeat(60).split(''),
            onFrame: () => {},
        });
    } catch (e) {
        /* a throw is itself a generalization failure worth counting */
        const msg = String(e && e.message || e).split('\n')[0].slice(0, 90);
        errors.set(msg, (errors.get(msg) || 0) + 1);
        failed++;
    }
    ran++;
    for (const path of (gstate.game.unported || [])) {
        hits.set(path, (hits.get(path) || 0) + 1);
        if (perRole) {
            if (!byRole.has(role)) byRole.set(role, new Map());
            const m = byRole.get(role);
            m.set(path, (m.get(path) || 0) + 1);
        }
    }
}

const T = process.stdout.isTTY
    ? { bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', off: '\x1b[0m' }
    : { bold: '', dim: '', red: '', off: '' };

console.log(`${T.dim}${ran} games over ${CONFIGS.length} role configs, `
            + `seeds ${seedOf(0)}..${seedOf(N - 1)} — none from sessions/${T.off}\n`);

if (failed) {
    console.log(`${T.red}${T.bold}${failed} of ${ran} games threw:${T.off}`);
    for (const [msg, n] of [...errors].sort((a, b) => b[1] - a[1]))
        console.log(`  ${String(n).padStart(4)}  ${msg}`);
    console.log('');
}

console.log(`${T.bold}reached-but-unported, by share of games:${T.off}`);
const rows = [...hits].sort((a, b) => b[1] - a[1]);
for (const [path, n] of rows) {
    const pct = (100 * n / ran).toFixed(0).padStart(3);
    const bar = '#'.repeat(Math.round(24 * n / ran)).padEnd(24);
    console.log(`  ${pct}%  ${bar}  ${path}`);
}
if (!rows.length) console.log('  (none — every path these games reached is ported)');

if (perRole) {
    console.log(`\n${T.bold}paths reached by only some roles:${T.off}`);
    for (const [role, m] of byRole) {
        const only = [...m].filter(([p]) => hits.get(p) < ran).map(([p]) => p);
        if (only.length) console.log(`  ${role.padEnd(14)} ${only.join(', ')}`);
    }
}
