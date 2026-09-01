#!/usr/bin/env node
// fuzz.mjs — random-play sessions with a C oracle attached.
//
// Every hand-written recipe tests what its author thought of. The held-out
// half of the score is 44 sessions nobody here has seen, and it did not move
// while the recipe count went from 75 to 326. This closes the loop the other
// way round: sample key streams from a trigram model of the PUBLIC sessions'
// inputs (the judges' command idioms, never their outputs), play them through
// the recorder on fresh seeds and datetimes, score the recording with the
// frozen runner, and name the C function the port first diverges in. The
// pass rate over a batch is a local estimate of the held-out pass rate under
// that input distribution, and the ranked causes are the work list, each with
// a ground-truth trace already recorded.
//
// Nothing here can overfit to sessions/: inputs are sampled, outputs come
// only from the recorder, and no seed in the batch is a public seed.
//
// Usage:
//   node tools/gen-sessions/fuzz.mjs --games 20 [--keys 250] [--seed 1] [--debug|--normal]
//   node tools/gen-sessions/fuzz.mjs --score-only        # re-score every game in fuzz/
//   node tools/gen-sessions/fuzz.mjs --report            # causes over every scored batch
//
// Output lands in tools/gen-sessions/fuzz/ (gitignored): <name>.session.json,
// <name>.recipe.json (inputs only, copy into recipes/ to keep a failing game
// as permanent coverage), and results.tsv with one row per scored game.

import { promises as fs } from 'node:fs';
import { readFileSync, readdirSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SESSIONS = path.join(ROOT, 'sessions');
const FUZZ = path.join(HERE, 'fuzz');
const RECORD = path.join(ROOT, 'scripts', 'record-session.mjs');
const RUNNER = path.join(ROOT, 'frozen', 'ps_test_runner.mjs');
const DIVERGE = path.join(ROOT, 'tools', 'diverge.mjs');
const RESULTS = path.join(FUZZ, 'results.tsv');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

// ------------------------------------------------------------ deterministic PRNG
function mulberry32(a) {
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const batchSeed = Number(opt('--seed', 1));
const rand = mulberry32(batchSeed);
const rint = (n) => Math.floor(rand() * n);
const pick = (arr) => arr[rint(arr.length)];

// ------------------------------------------------------------ public input model
const START = '';

function loadPublicSegments() {
    const segs = [];
    for (const f of readdirSync(SESSIONS).sort()) {
        if (!f.endsWith('.session.json')) continue;
        const s = JSON.parse(readFileSync(path.join(SESSIONS, f), 'utf8'));
        for (const seg of s.segments) {
            if (!seg.moves) continue;
            segs.push({
                rc: seg.nethackrc || '',
                moves: seg.moves,
                debug: /playmode:debug/.test(seg.nethackrc || ''),
                pinned: /role:/.test(seg.nethackrc || ''),
                /* the legacy intro is a --More-- that only space, return
                   or ESC dismiss; a stream sampled from !legacy sessions
                   would spend every key ringing the bell at it */
                legacy: !/!legacy/.test(seg.nethackrc || ''),
            });
        }
    }
    return segs;
}

function bump(map, key, k) {
    let m = map.get(key);
    if (!m) map.set(key, m = new Map());
    m.set(k, (m.get(k) || 0) + 1);
}

function buildChain(segs) {
    const tri = new Map(), bi = new Map(), uni = new Map();
    for (const { moves } of segs) {
        let a = START, b = START;
        for (const k of moves) {
            bump(tri, a + b, k);
            bump(bi, b, k);
            uni.set(k, (uni.get(k) || 0) + 1);
            a = b; b = k;
        }
    }
    return { tri, bi, uni, lengths: segs.map((s) => s.moves.length) };
}

function draw(dist) {
    let total = 0;
    for (const c of dist.values()) total += c;
    let r = rand() * total;
    for (const [k, c] of dist) { r -= c; if (r < 0) return k; }
    return [...dist.keys()].pop();
}

function sampleMoves(chain, n) {
    let a = START, b = START, out = '';
    while (out.length < n) {
        const dist = chain.tri.get(a + b) || chain.bi.get(b) || chain.uni;
        const k = draw(dist);
        out += k;
        a = b; b = k;
    }
    return out;
}

function sampleDatetime() {
    const month = 1 + rint(12);
    const day = 1 + rint(28);
    const p = (v) => String(v).padStart(2, '0');
    return `2026${p(month)}${p(day)}${p(rint(24))}${p(rint(60))}${p(rint(60))}`;
}

function roleOf(rc) {
    const m = /role:([A-Za-z]+)/.exec(rc);
    return m ? m[1].toLowerCase() : 'anyrole';
}

// ------------------------------------------------------------ record and score
async function record(input, outPath) {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'fuzz-'));
    const inPath = path.join(tmp, 'input.json');
    await fs.writeFile(inPath, JSON.stringify(input));
    try {
        await new Promise((resolve, reject) => {
            let err = '';
            const c = spawn(process.execPath, [RECORD, inPath, outPath], { stdio: ['ignore', 'ignore', 'pipe'] });
            c.stderr.on('data', (d) => { err += d; });
            c.on('error', reject);
            c.on('close', (code) => code === 0 ? resolve() : reject(new Error(`record-session exit=${code}\n${err.slice(-400)}`)));
        });
    } finally {
        await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
}

function score(sessionPath) {
    const r = spawnSync(process.execPath, [RUNNER, sessionPath], {
        cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
        env: { ...process.env, SESSION_REPLAY_TIMEOUT_MS: process.env.SESSION_REPLAY_TIMEOUT_MS || '120000' },
    });
    const i = r.stdout.indexOf('__RESULTS_JSON__');
    if (i < 0) return { passed: false, error: `runner produced no result: ${(r.stderr || '').slice(-300)}` };
    const j = JSON.parse(r.stdout.slice(i + '__RESULTS_JSON__'.length));
    const res = j.results[0];
    return {
        passed: !!res.passed,
        error: res.error ? String(res.error.message || res.error).slice(0, 120) : null,
        screens: res.metrics?.screens || { matched: 0, total: 0 },
        rng: res.metrics?.rngCalls || { matched: 0, total: 0 },
    };
}

function diverge(sessionPath) {
    const r = spawnSync(process.execPath, [DIVERGE, sessionPath], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const out = (r.stdout || '') + (r.stderr || '');
    const threw = /Our port threw before finishing: (.*)/.exec(out);
    const next = /Next C function to port: (\S+) \(src\/([\w.]+):(\d+)\)/.exec(out);
    const at = /divergent call occurs at seg (\d+), step (\d+)/.exec(out);
    const screenMiss = /First screen miss at step (\d+)/.exec(out);
    const extra = /Our port made calls C never made/.test(out);
    let cause;
    if (next) cause = `${next[1]} (${next[2]}:${next[3]})`;
    else if (extra) cause = 'port-made-extra-calls';
    else if (threw) cause = `threw: ${threw[1].slice(0, 70)}`;
    else if (screenMiss) cause = `screen-only miss at step ${screenMiss[1]}`;
    else cause = 'unknown';
    if (threw && next) cause += ` [threw: ${threw[1].slice(0, 50)}]`;
    return { cause, step: at ? Number(at[2]) : (screenMiss ? Number(screenMiss[1]) : null) };
}

function scoreOne(name) {
    const sessionPath = path.join(FUZZ, `${name}.session.json`);
    const s = JSON.parse(readFileSync(sessionPath, 'utf8'));
    const steps = s.segments.reduce((n, seg) => n + seg.steps.length, 0);
    const keys = s.segments.reduce((n, seg) => n + seg.moves.length, 0);
    const sc = score(sessionPath);
    let dv = { cause: '', step: null };
    if (!sc.passed) dv = diverge(sessionPath);
    const row = {
        name, keys, steps, passed: sc.passed,
        screens: `${sc.screens?.matched ?? 0}/${sc.screens?.total ?? steps}`,
        rng: `${sc.rng?.matched ?? 0}/${sc.rng?.total ?? 0}`,
        step: dv.step ?? '', cause: dv.cause || (sc.error ? `runner: ${sc.error}` : ''),
    };
    appendFileSync(RESULTS, [new Date().toISOString(), row.name, row.keys, row.steps, row.passed ? 'PASS' : 'FAIL', row.screens, row.rng, row.step, row.cause].join('\t') + '\n');
    return row;
}

function printRows(rows) {
    for (const r of rows)
        console.log(`${r.passed ? 'PASS' : 'FAIL'} ${r.name.padEnd(34)} keys ${String(r.keys).padStart(4)} steps ${String(r.steps).padStart(4)} screens ${r.screens.padStart(9)} ${r.passed ? '' : `at ${r.step}: ${r.cause}`}`);
    const passed = rows.filter((r) => r.passed).length;
    const scr = rows.reduce((a, r) => { const [m, t] = r.screens.split('/').map(Number); a.m += m; a.t += t; return a; }, { m: 0, t: 0 });
    console.log(`\n${passed}/${rows.length} games pass; screens ${scr.m}/${scr.t} (${scr.t ? (100 * scr.m / scr.t).toFixed(1) : 0}%)`);
    const causes = new Map();
    for (const r of rows) if (!r.passed) causes.set(r.cause, (causes.get(r.cause) || 0) + 1);
    if (causes.size) {
        console.log('\nfirst-divergence causes:');
        for (const [c, n] of [...causes].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${c}`);
    }
}

// ------------------------------------------------------------ main
async function main() {
    mkdirSync(FUZZ, { recursive: true });
    if (!existsSync(RESULTS))
        appendFileSync(RESULTS, 'scored_at\tname\tkeys\tsteps\tresult\tscreens\trng\tstep\tcause\n');

    if (flag('--report')) {
        const rows = readFileSync(RESULTS, 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
        const latest = new Map();
        for (const r of rows) latest.set(r[1], r);
        const all = [...latest.values()];
        const fails = all.filter((r) => r[4] === 'FAIL');
        const causes = new Map();
        for (const r of fails) causes.set(r[8], (causes.get(r[8]) || 0) + 1);
        console.log(`${all.length - fails.length}/${all.length} games pass (latest score per game)\n`);
        for (const [c, n] of [...causes].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${c}`);
        return;
    }

    if (flag('--score-only')) {
        const names = readdirSync(FUZZ).filter((f) => f.endsWith('.session.json')).map((f) => f.replace('.session.json', '')).sort();
        const rows = [];
        for (const n of names) rows.push(scoreOne(n));
        printRows(rows);
        return;
    }

    const games = Number(opt('--games', 10));
    const cap = Number(opt('--keys', 250));
    const segs = loadPublicSegments();
    const styles = new Map();
    for (const s of segs) {
        const key = `${s.pinned ? 'pinned' : 'menu'}:${s.debug ? 'debug' : 'normal'}:${s.legacy ? 'legacy' : 'nolegacy'}`;
        if (!styles.has(key)) styles.set(key, []);
        styles.get(key).push(s);
    }
    const chains = new Map([...styles].map(([k, v]) => [k, { chain: buildChain(v), rcs: v.map((s) => s.rc) }]));
    const styleKeys = [...styles.keys()].filter((k) => flag('--debug') ? k.includes(':debug:') : flag('--normal') ? k.includes(':normal:') : true);
    const weights = styleKeys.map((k) => styles.get(k).length);

    const rows = [];
    for (let i = 0; i < games; i++) {
        let r = rand() * weights.reduce((a, b) => a + b, 0), style = styleKeys[0];
        for (let j = 0; j < styleKeys.length; j++) { r -= weights[j]; if (r < 0) { style = styleKeys[j]; break; } }
        const { chain, rcs } = chains.get(style);
        const rc = pick(rcs);
        const n = Math.max(20, Math.min(cap, pick(chain.lengths)));
        const moves = sampleMoves(chain, n);
        const seed = 100000 + rint(900000);
        const name = `fuzz-s${batchSeed}-${String(i).padStart(2, '0')}-${roleOf(rc)}-${style.replace(/:/g, '-')}`;
        const recipe = { name, description: `random play sampled from public inputs, style ${style}`, coverage: ['fuzz.random-play'], segments: [{ seed, datetime: sampleDatetime(), nethackrc: rc, moves }] };
        await fs.writeFile(path.join(FUZZ, `${name}.recipe.json`), JSON.stringify(recipe, null, 1));
        const input = { version: 5, segments: recipe.segments.map((s) => ({ ...s, steps: [] })), source: 'c', recorded_with: { tool: 'tools/gen-sessions/fuzz.mjs', spec: `${name}.recipe.json` }, coverage: recipe.coverage };
        const sessionPath = path.join(FUZZ, `${name}.session.json`);
        try {
            await record(input, sessionPath);
        } catch (e) {
            console.log(`FAIL ${name}: recorder: ${e.message.split('\n')[0]}`);
            continue;
        }
        const row = scoreOne(name);
        rows.push(row);
        console.log(`${row.passed ? 'PASS' : 'FAIL'} ${name} keys ${row.keys} steps ${row.steps} screens ${row.screens}${row.passed ? '' : ` at ${row.step}: ${row.cause}`}`);
    }
    console.log('');
    printRows(rows);
}

main().catch((e) => { console.error(e); process.exit(1); });
