#!/usr/bin/env node
// diverge.mjs — Localise the first divergence between our JS port and the
// recorded C reference, and name the C function responsible.
//
// The recorded sessions carry an "@ caller(file:line)" annotation on every
// C-side PRNG call. The scorer strips it before comparing; we don't. So when
// our call N disagrees with C's call N, the recording tells us exactly which
// C source line produced C's call — which is the next thing to port.
//
// Usage:
//   node tools/diverge.mjs <session>            # name, prefix, or path
//   node tools/diverge.mjs <session> -w 20      # wider context window
//   node tools/diverge.mjs <session> --screens  # also report screen misses
//   node tools/diverge.mjs --all                # first divergence per session
//
// Exit status: 0 when nothing diverges, 1 when something does, 2 on error.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SESSIONS_DIR = join(PROJECT_ROOT, 'sessions');

// ---------------------------------------------------------------- utilities

const C = process.stdout.isTTY
    ? { dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
        bold: '\x1b[1m', off: '\x1b[0m' }
    : { dim: '', red: '', green: '', yellow: '', bold: '', off: '' };

// Same predicate the scorer uses: recorder sessions contain only PRNG lines.
function isRngCall(entry) {
    return typeof entry === 'string' && /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(entry);
}

// Same normalisation the scorer uses: drop the caller annotation and any
// leading index, so "rn2(5)=3 @ foo(bar.c:10)" compares as "rn2(5)=3".
function normalizeRng(entry) {
    return String(entry).replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim();
}

// "rn2(5)=3 @ m_initweap(makemon.c:431)" -> "m_initweap(makemon.c:431)"
function annotationOf(entry) {
    const m = /@\s*(.+)$/.exec(String(entry));
    return m ? m[1].trim() : '';
}

// "m_initweap(makemon.c:431)" -> { fn: 'm_initweap', file: 'makemon.c', line: 431 }
function parseAnnotation(ann) {
    const m = /^([A-Za-z0-9_]+)\(([^:]+):(\d+)\)$/.exec(ann);
    if (!m) return null;
    return { fn: m[1], file: m[2], line: Number(m[3]) };
}

function resolveSession(arg) {
    if (arg.includes('/') || arg.endsWith('.session.json')) {
        const p = arg.startsWith('/') ? arg : join(PROJECT_ROOT, arg);
        if (existsSync(p) && statSync(p).isFile()) return p;
    }
    const all = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.session.json'));
    const exact = all.find(f => f === `${arg}.session.json`);
    if (exact) return join(SESSIONS_DIR, exact);
    const hits = all.filter(f => f.startsWith(arg));
    if (hits.length === 1) return join(SESSIONS_DIR, hits[0]);
    if (hits.length > 1) {
        throw new Error(`ambiguous session "${arg}":\n  ${hits.join('\n  ')}`);
    }
    throw new Error(`no session matching "${arg}"`);
}

function allSessions() {
    return readdirSync(SESSIONS_DIR)
        .filter(f => f.endsWith('.session.json'))
        .sort()
        .map(f => join(SESSIONS_DIR, f));
}

// ------------------------------------------------------------- C-side model

// Flatten the recorded session into positional arrays, keeping enough
// provenance to say "segment 2, step 17" for any flat index.
function loadCanonical(segments) {
    const rng = [];        // annotated entries, in call order
    const rngOrigin = [];  // { seg, step, key } per rng index
    const screens = [];
    const cursors = [];
    const screenOrigin = [];

    segments.forEach((seg, segIdx) => {
        (seg.steps || []).forEach((step, stepIdx) => {
            for (const entry of step.rng || []) {
                if (!isRngCall(entry)) continue;
                rng.push(entry);
                rngOrigin.push({ seg: segIdx, step: stepIdx, key: step.key });
            }
            if (step.screen) {
                screens.push(step.screen);
                cursors.push(Array.isArray(step.cursor) ? step.cursor : null);
                screenOrigin.push({ seg: segIdx, step: stepIdx, key: step.key });
            }
        });
    });
    return { rng, rngOrigin, screens, cursors, screenOrigin };
}

// ------------------------------------------------------------ JS-side model

// Drive the contestant entry point exactly the way frozen/ps_test_runner.mjs
// does, so what we measure here is what the scorer measures.
async function runOurPort(segments, maxSeconds = 0) {
    const { runSegment } = await import(join(PROJECT_ROOT, 'js/jsmain.js'));

    const store = new Map();
    const storage = {
        getItem: k => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => { store.set(k, String(v)); },
        removeItem: k => { store.delete(k); },
        get length() { return store.size; },
        key(i) {
            let n = 0;
            for (const k of store.keys()) { if (n === i) return k; n++; }
            return null;
        },
    };

    const rng = [];
    const screens = [];
    const cursors = [];
    let error = null;

    /* A session that BLOCKS used to take diverge down with it: runSegment
       never returns, so nothing below ever runs and the tool printed zero
       bytes. That is the one failure where a divergence point matters most.
       --max-seconds bounds the replay and reports how far it got, read from
       the gstate singleton, which keeps updating even while runSegment is
       stuck inside it. */
    const maxMs = maxSeconds > 0 ? maxSeconds * 1000 : 0;
    let timedOut = false;
    let deadlineTimer;
    const deadline = maxMs
        ? new Promise((res) => {
            deadlineTimer = setTimeout(() => { timedOut = true; res('TIMEOUT'); }, maxMs);
        })
        : null;

    const replay = (async () => {
        for (const seg of segments) {
            const game = await runSegment({
                seed: seg.seed,
                datetime: seg.datetime,
                nethackrc: seg.nethackrc,
                moves: seg.moves,
                storage,
            });
            for (const e of game.getRngLog?.() || []) {
                const s = typeof e === 'string' ? e.replace(/^\d+\s+/, '') : String(e);
                if (isRngCall(s)) rng.push(s);
            }
            for (const s of game.getScreens?.() || []) screens.push(s);
            for (const c of game.getCursors?.() || []) cursors.push(c);
        }
    })();

    try {
        if (deadline) {
            const who = await Promise.race([replay.then(() => 'DONE'), deadline]);
            if (who === 'TIMEOUT') {
                /* runSegment is still stuck, so its game object never came
                   back. The gstate singleton is the same object the port has
                   been mutating all along, so read the progress out of it. */
                const { game: live } = await import(join(PROJECT_ROOT, 'js/gstate.js'));
                const drawn = live?._rngLog?.length ?? 0;
                /* Report HERE and exit. Returning normally is not enough:
                   the blocked readKey keeps a pending promise on the event
                   loop, so node never exits on its own and the bound would
                   look like it had not fired at all. */
                process.stderr.write(
                    `\nREPLAY DID NOT TERMINATE within ${maxSeconds}s\n`
                    + `  last move reached : ${live?.moves ?? '?'}\n`
                    + `  rng calls drawn   : ${drawn}\n`
                    + `  => the port blocked at or before rng call ${drawn}.\n`
                    + `     Re-run without --max-seconds against the C log and\n`
                    + `     read the divergence at that index.\n`);
                process.exit(3);
            }
        } else {
            await replay;
        }
    } catch (e) {
        error = e;
    } finally {
        clearTimeout(deadlineTimer);
    }
    return { rng, screens, cursors, error };
}

// ------------------------------------------------------------------ compare

function firstRngDivergence(cRng, jsRng) {
    const n = Math.max(cRng.length, jsRng.length);
    for (let i = 0; i < n; i++) {
        const a = i < cRng.length ? normalizeRng(cRng[i]) : null;
        const b = i < jsRng.length ? normalizeRng(jsRng[i]) : null;
        if (a !== b) return i;
    }
    return -1;
}

// Positional match count, the same way the scorer counts it. Note this is not
// "length of the matching prefix" — later calls can coincidentally align.
function rngMatchCount(cRng, jsRng) {
    let n = 0;
    for (let i = 0; i < cRng.length; i++) {
        if (normalizeRng(cRng[i] || '') === normalizeRng(jsRng[i] || '')) n++;
    }
    return n;
}

async function firstScreenDivergence(cScreens, cCursors, jsScreens, jsCursors) {
    const { decodeScreen, diffCell, ROWS_24, COLS_80 } =
        await import(join(PROJECT_ROOT, 'frozen/screen-decode.mjs'));

    const cellsEqual = (a, b) => {
        const ga = decodeScreen(String(a ?? ''));
        const gb = decodeScreen(String(b ?? ''));
        for (let r = 0; r < ROWS_24; r++) {
            for (let c = 0; c < COLS_80; c++) {
                if (diffCell(ga[r][c], gb[r][c])) return false;
            }
        }
        return true;
    };
    const cursorEqual = (c, j) => {
        if (!Array.isArray(c)) return true;
        if (!Array.isArray(j)) return false;
        return c[0] === j[0] && c[1] === j[1] && c[2] === j[2];
    };

    for (let i = 0; i < cScreens.length; i++) {
        const okCells = cellsEqual(jsScreens[i], cScreens[i]);
        const okCursor = cursorEqual(cCursors[i], jsCursors[i]);
        if (!okCells || !okCursor) {
            return { index: i, cells: okCells, cursor: okCursor };
        }
    }
    return null;
}

// ------------------------------------------------------------------- report

function originLabel(origin) {
    if (!origin) return '';
    const key = origin.key === null || origin.key === undefined
        ? 'initial'
        : `key ${JSON.stringify(origin.key)}`;
    return `seg ${origin.seg + 1}, step ${origin.step} (${key})`;
}

function printRngWindow(cRng, jsRng, rngOrigin, at, window) {
    const lo = Math.max(0, at - window);
    const hi = Math.min(Math.max(cRng.length, jsRng.length), at + window + 1);
    const width = String(hi).length;

    for (let i = lo; i < hi; i++) {
        const cEntry = i < cRng.length ? cRng[i] : null;
        const jEntry = i < jsRng.length ? jsRng[i] : null;
        const cNorm = cEntry === null ? '—' : normalizeRng(cEntry);
        const jNorm = jEntry === null ? '—' : normalizeRng(jEntry);
        const same = cNorm === jNorm;
        const mark = i === at ? `${C.red}MISMATCH${C.off}`
            : same ? `${C.dim}ok${C.off}`
                : `${C.yellow}differs${C.off}`;
        const ann = cEntry === null ? '' : annotationOf(cEntry);
        const idx = String(i).padStart(width);
        const cCol = cNorm.padEnd(18);
        const jCol = jNorm.padEnd(18);
        const annCol = ann ? `${C.dim}@ ${ann}${C.off}` : '';
        console.log(`  ${idx}  C ${cCol} ours ${jCol} ${mark}  ${annCol}`);
    }

    const origin = rngOrigin[at];
    if (origin) console.log(`\n  divergent call occurs at ${originLabel(origin)}`);
}

function printNextTarget(cRng, at) {
    const entry = at < cRng.length ? cRng[at] : null;
    if (!entry) {
        console.log(`\n${C.bold}Our port made calls C never made.${C.off}`);
        console.log('  Something is consuming RNG that should not be. Look at the');
        console.log('  last matching call above and check what runs after it.');
        return;
    }
    const parsed = parseAnnotation(annotationOf(entry));
    if (!parsed) {
        console.log(`\n${C.bold}Next C call to reproduce:${C.off} ${normalizeRng(entry)}`);
        return;
    }
    console.log(
        `\n${C.bold}Next C function to port:${C.off} ` +
        `${C.green}${parsed.fn}${C.off} (src/${parsed.file}:${parsed.line})`
    );
    console.log(`  grep -n "${parsed.fn}" nethack-c/upstream/src/${parsed.file}`);
}

// ---------------------------------------------------------------------- run

async function analyseSession(sessionPath, opts) {
    const raw = JSON.parse(readFileSync(sessionPath, 'utf8'));
    const { normalizeSession } = await import(join(PROJECT_ROOT, 'frozen/session_loader.mjs'));
    const segments = normalizeSession(raw).segments;

    const canon = loadCanonical(segments);
    const ours = await runOurPort(segments, opts?.maxSeconds || 0);

    const at = firstRngDivergence(canon.rng, ours.rng);
    const matched = rngMatchCount(canon.rng, ours.rng);
    return { sessionPath, segments, canon, ours, at, matched, opts };
}

function summaryLine(r) {
    const name = basename(r.sessionPath).replace('.session.json', '');
    const pct = r.canon.rng.length
        ? ((r.matched / r.canon.rng.length) * 100).toFixed(1)
        : '0.0';
    const where = r.at < 0 ? 'no divergence' : `div@${r.at}`;
    const ann = r.at >= 0 && r.at < r.canon.rng.length
        ? annotationOf(r.canon.rng[r.at])
        : '';
    const err = r.ours.error ? `  ERROR: ${r.ours.error.message}` : '';
    return `${name.padEnd(46)} RNG ${String(r.matched).padStart(6)}/${String(r.canon.rng.length).padEnd(6)} ` +
        `(${pct.padStart(5)}%)  ${where.padEnd(12)} ${C.dim}${ann}${C.off}${err}`;
}

async function reportOne(r) {
    const name = basename(r.sessionPath).replace('.session.json', '');
    console.log(`\n${C.bold}${name}${C.off}`);
    console.log(`  segments ${r.segments.length}, ` +
        `C calls ${r.canon.rng.length}, ours ${r.ours.rng.length}, ` +
        `screens ${r.canon.screens.length}`);

    if (r.ours.error) {
        console.log(`\n${C.red}Our port threw before finishing:${C.off} ${r.ours.error.message}`);
        console.log(`${C.dim}${(r.ours.error.stack || '').split('\n').slice(1, 5).join('\n')}${C.off}`);
        console.log('\nA thrown exception forfeits every remaining step in the session.');
    }

    if (r.at < 0) {
        console.log(`\n${C.green}RNG stream matches C call for call (${r.canon.rng.length} calls).${C.off}`);
    } else {
        console.log(`\nRNG diverges at call ${C.bold}${r.at}${C.off} of ${r.canon.rng.length} ` +
            `(${r.matched} positions match overall)\n`);
        printRngWindow(r.canon.rng, r.ours.rng, r.canon.rngOrigin, r.at, r.opts.window);
        printNextTarget(r.canon.rng, r.at);
    }

    if (r.opts.screens || r.at < 0) {
        const s = await firstScreenDivergence(
            r.canon.screens, r.canon.cursors, r.ours.screens, r.ours.cursors);
        if (!s) {
            console.log(`\n${C.green}All ${r.canon.screens.length} screens match.${C.off}`);
        } else {
            const reason = !s.cells
                ? (s.cursor ? 'cell grid differs' : 'cell grid and cursor differ')
                : 'cells match but cursor differs';
            console.log(`\nFirst screen miss at step ${C.bold}${s.index}${C.off} ` +
                `of ${r.canon.screens.length} — ${reason}`);
            console.log(`  ${originLabel(r.canon.screenOrigin[s.index])}`);
            console.log(`  node tools/screendiff.mjs ${basename(r.sessionPath).replace('.session.json', '')} ${s.index}`);
        }
    }
}

async function main() {
    const argv = process.argv.slice(2);
    const opts = { window: 8, screens: false, all: false, maxSeconds: 0 };
    const targets = [];

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '-w' || a === '--window') opts.window = Number(argv[++i]);
        else if (a === '--max-seconds') opts.maxSeconds = Number(argv[++i]);
        else if (a === '--screens') opts.screens = true;
        else if (a === '--all') opts.all = true;
        else if (a.startsWith('-')) throw new Error(`unknown flag ${a}`);
        else targets.push(a);
    }

    if (!opts.all && targets.length === 0) {
        console.error('usage: node tools/diverge.mjs <session> [-w N] [--screens]');
        console.error('       node tools/diverge.mjs --all');
        process.exit(2);
    }

    const paths = opts.all && targets.length === 0
        ? allSessions()
        : targets.map(resolveSession);

    let diverged = 0;
    if (opts.all) {
        for (const p of paths) {
            const r = await analyseSession(p, opts);
            console.log(summaryLine(r));
            if (r.at >= 0) diverged++;
        }
        console.log(`\n${paths.length - diverged}/${paths.length} sessions match C's RNG stream end to end.`);
    } else {
        for (const p of paths) {
            const r = await analyseSession(p, opts);
            await reportOne(r);
            if (r.at >= 0) diverged++;
        }
    }
    process.exit(diverged ? 1 : 0);
}

main().catch(e => {
    console.error(`diverge: ${e.message}`);
    process.exit(2);
});
