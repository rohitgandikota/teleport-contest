#!/usr/bin/env node
// scoreboard.mjs — Run the contest scorer, record the result, and report what
// changed since last time.
//
// The point is regression detection. A long working session can quietly trade
// points in one subsystem for points in another; comparing per-session counts
// against the previous run makes that visible immediately.
//
// Usage:
//   node tools/scoreboard.mjs           # all 44 public sessions
//   node tools/scoreboard.mjs --fast    # the 8 short sessions only
//   node tools/scoreboard.mjs --private # sessions-private/ (see M12)
//   node tools/scoreboard.mjs --no-save # report, don't record
//
// Appends one row per run to docs/plan/score-history.tsv and keeps a full
// per-session snapshot in .cache/ for the next comparison.

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const RUNNER = join(PROJECT_ROOT, 'frozen/ps_test_runner.mjs');
const HISTORY = join(PROJECT_ROOT, 'docs/plan/score-history.tsv');

const T = process.stdout.isTTY
    ? { dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
        bold: '\x1b[1m', off: '\x1b[0m' }
    : { dim: '', red: '', green: '', yellow: '', bold: '', off: '' };

// The eight shortest public sessions. Whole-session passes on these are the
// cheapest available, and Phase 2 qualification may be counted in session
// passes rather than screen points — see docs/plan/00-strategy.md.
const SHORT_SESSIONS = [
    'seed8000-tourist-starter',
    'seed0102-ranger-name-cancel',
    'seed1800-tourist-eat-throw',
    'seed0101-ranger-quiver-throw-travel-engrave',
    'seed0501-priest-cast-read-turn',
    'seed0105-valk-chat-lamp-ration',
    'seed0077-rogue-chargen',
    'seed0016-healer-newmoon-eat-zap',
];

function runScorer(targets) {
    const args = [RUNNER, ...targets];
    const child = spawnSync(process.execPath, args, {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        env: { ...process.env, SESSION_REPLAY_TIMEOUT_MS: process.env.SESSION_REPLAY_TIMEOUT_MS || '120000' },
    });
    const out = child.stdout || '';
    const idx = out.lastIndexOf('__RESULTS_JSON__');
    if (idx < 0) {
        throw new Error(`scorer produced no results bundle\n${(child.stderr || '').slice(-2000)}`);
    }
    return JSON.parse(out.slice(idx + '__RESULTS_JSON__'.length).trim());
}

function totalsOf(bundle) {
    let screensMatched = 0, screensTotal = 0, rngMatched = 0, rngTotal = 0, passed = 0;
    for (const r of bundle.results) {
        screensMatched += r.metrics?.screens?.matched || 0;
        screensTotal += r.metrics?.screens?.total || 0;
        rngMatched += r.metrics?.rngCalls?.matched || 0;
        rngTotal += r.metrics?.rngCalls?.total || 0;
        if (r.passed) passed++;
    }
    return { screensMatched, screensTotal, rngMatched, rngTotal, passed, sessions: bundle.results.length };
}

function pct(n, d) { return d ? ((n / d) * 100).toFixed(1) : '0.0'; }

function delta(now, before) {
    if (before === undefined || before === null) return '';
    const d = now - before;
    if (d === 0) return `${T.dim}   ·${T.off}`;
    const s = (d > 0 ? '+' : '') + d;
    return d > 0 ? `${T.green}${s.padStart(4)}${T.off}` : `${T.red}${s.padStart(4)}${T.off}`;
}

function main() {
    const argv = process.argv.slice(2);
    const fast = argv.includes('--fast');
    const priv = argv.includes('--private');
    const noSave = argv.includes('--no-save');

    let targets;
    let label;
    if (fast) {
        targets = SHORT_SESSIONS.map(n => join(PROJECT_ROOT, 'sessions', `${n}.session.json`));
        label = 'short';
    } else if (priv) {
        targets = [join(PROJECT_ROOT, 'sessions-private')];
        label = 'private';
        if (!existsSync(targets[0])) {
            console.error('no sessions-private/ directory — see docs/plan/12-generalization-hardening.md');
            process.exit(2);
        }
    } else {
        targets = [join(PROJECT_ROOT, 'sessions')];
        label = 'public';
    }

    const snapshotPath = join(PROJECT_ROOT, '.cache', `scoreboard-${label}.json`);
    const previous = existsSync(snapshotPath)
        ? JSON.parse(readFileSync(snapshotPath, 'utf8'))
        : null;
    const prevBySession = new Map(
        (previous?.results || []).map(r => [r.session, r.metrics?.screens?.matched || 0]));
    const prevRngBySession = new Map(
        (previous?.results || []).map(r => [r.session, r.metrics?.rngCalls?.matched || 0]));

    const bundle = runScorer(targets);
    const totals = totalsOf(bundle);

    console.log(`${T.bold}${label} corpus${T.off}  commit ${bundle.commit}` +
        (previous ? `  ${T.dim}(delta vs ${previous.timestamp})${T.off}` : ''));
    console.log();

    const regressions = [];
    const sorted = [...bundle.results].sort((a, b) =>
        (b.metrics?.screens?.total || 0) - (a.metrics?.screens?.total || 0));

    for (const r of sorted) {
        const s = r.metrics?.screens || {};
        const g = r.metrics?.rngCalls || {};
        const name = r.session.replace('.session.json', '');
        const before = prevBySession.get(r.session);
        const prevRng = prevRngBySession.get(r.session);
        if (before !== undefined && (s.matched || 0) < before) {
            regressions.push({ name, before, now: s.matched || 0 });
        }
        const status = r.passed ? `${T.green}PASS${T.off}` : (r.error ? `${T.red}ERR ${T.off}` : 'fail');
        console.log(
            `  ${status}  ${name.padEnd(46)} ` +
            `screens ${String(s.matched ?? 0).padStart(5)}/${String(s.total ?? 0).padEnd(5)} ${delta(s.matched || 0, before)}  ` +
            `rng ${String(g.matched ?? 0).padStart(6)}/${String(g.total ?? 0).padEnd(6)} ${delta(g.matched || 0, prevRng)}` +
            (r.error ? `  ${T.red}${r.error}${T.off}` : '')
        );
    }

    const prevTotals = previous ? totalsOf(previous) : null;
    console.log();
    console.log(`  ${T.bold}TOTAL${T.off}  sessions passed ${totals.passed}/${totals.sessions}` +
        (prevTotals ? ` ${delta(totals.passed, prevTotals.passed)}` : ''));
    console.log(`         screens ${totals.screensMatched}/${totals.screensTotal} ` +
        `(${pct(totals.screensMatched, totals.screensTotal)}%)` +
        (prevTotals ? ` ${delta(totals.screensMatched, prevTotals.screensMatched)}` : ''));
    console.log(`         rng     ${totals.rngMatched}/${totals.rngTotal} ` +
        `(${pct(totals.rngMatched, totals.rngTotal)}%)` +
        (prevTotals ? ` ${delta(totals.rngMatched, prevTotals.rngMatched)}` : ''));
    console.log(`  ${T.dim}rng is advisory only and counts positional matches, so it can${T.off}`);
    console.log(`  ${T.dim}overstate progress after an early divergence. See docs/plan/NOTES.md.${T.off}`);

    if (regressions.length) {
        console.log(`\n${T.red}${T.bold}REGRESSIONS — ${regressions.length} session(s) lost screens${T.off}`);
        for (const r of regressions) {
            console.log(`  ${T.red}${r.name}: ${r.before} → ${r.now}${T.off}`);
        }
        console.log('\nFix or revert before moving on. See /CLAUDE.md, "The loop for every change".');
    }

    if (!noSave) {
        mkdirSync(dirname(snapshotPath), { recursive: true });
        writeFileSync(snapshotPath, JSON.stringify(bundle, null, 2));

        let commit = bundle.commit;
        try {
            commit = execSync('git rev-parse --short HEAD', { cwd: PROJECT_ROOT }).toString().trim();
        } catch { /* not a checkout */ }
        if (!existsSync(HISTORY)) {
            writeFileSync(HISTORY,
                'timestamp\tcorpus\tcommit\tsessions_passed\tsessions\tscreens_matched\tscreens_total\trng_matched\trng_total\n');
        }
        appendFileSync(HISTORY,
            [bundle.timestamp, label, commit, totals.passed, totals.sessions,
             totals.screensMatched, totals.screensTotal,
             totals.rngMatched, totals.rngTotal].join('\t') + '\n');
        console.log(`\n${T.dim}recorded in docs/plan/score-history.tsv${T.off}`);
    }

    process.exit(regressions.length ? 1 : 0);
}

try {
    main();
} catch (e) {
    console.error(`scoreboard: ${e.message}`);
    process.exit(2);
}
