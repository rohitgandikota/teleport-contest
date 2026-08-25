#!/usr/bin/env node
// Refresh one artifact with every score that matters for this contest.
// It measures public and supplemental traces locally, checks the hang gate,
// fetches the live public and held-out result, and records a history row.

import {
    appendFileSync, existsSync, readFileSync, writeFileSync,
} from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RUNNER = join(ROOT, 'frozen', 'ps_test_runner.mjs');
const DASHBOARD = join(ROOT, 'docs', 'plan', 'contest-dashboard.md');
const HISTORY = join(ROOT, 'docs', 'plan', 'contest-dashboard-history.tsv');
const LEADERBOARD_URL = 'https://mazesofmenace.ai/leaderboard/data.json';
const FORK = 'rohitgandikota/teleport-contest';

function runScorer(target) {
    const child = spawnSync(process.execPath, [RUNNER, target], {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        env: {
            ...process.env,
            SESSION_REPLAY_TIMEOUT_MS: process.env.SESSION_REPLAY_TIMEOUT_MS || '120000',
        },
    });
    const output = child.stdout || '';
    const marker = output.lastIndexOf('__RESULTS_JSON__');
    if (child.status !== 0 || marker < 0) {
        throw new Error(`scorer failed for ${target}: ${(child.stderr || output).slice(-2000)}`);
    }
    return JSON.parse(output.slice(marker + '__RESULTS_JSON__'.length).trim());
}

function aggregate(bundle) {
    const total = {
        passed: 0,
        sessions: bundle.results.length,
        screensMatched: 0,
        screensTotal: 0,
        cellsMatched: 0,
        cellsTotal: 0,
        cursorsMatched: 0,
        cursorsTotal: 0,
        rngMatched: 0,
        rngTotal: 0,
        animMatched: 0,
        animTotal: 0,
    };
    for (const result of bundle.results) {
        if (result.passed) total.passed += 1;
        const metrics = result.metrics || {};
        total.screensMatched += metrics.screens?.matched || 0;
        total.screensTotal += metrics.screens?.total || 0;
        total.cellsMatched += metrics.cellsOnly?.matched || 0;
        total.cellsTotal += metrics.cellsOnly?.total || 0;
        total.cursorsMatched += metrics.cursors?.matched || 0;
        total.cursorsTotal += metrics.cursors?.total || 0;
        total.rngMatched += metrics.rngCalls?.matched || 0;
        total.rngTotal += metrics.rngCalls?.total || 0;
        total.animMatched += metrics.animFrames?.matched || 0;
        total.animTotal += metrics.animFrames?.total || 0;
    }
    return total;
}

function percent(numerator, denominator, digits = 2) {
    return denominator ? `${((numerator / denominator) * 100).toFixed(digits)}%` : 'n/a';
}

function ratio(numerator, denominator) {
    return denominator ? (numerator / denominator).toFixed(3) : 'n/a';
}

function runHangGate() {
    const child = spawnSync(process.execPath, [join(ROOT, 'tools', 'hang-gate.mjs')], {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        env: {
            ...process.env,
            SESSION_REPLAY_TIMEOUT_MS: process.env.SESSION_REPLAY_TIMEOUT_MS || '120000',
        },
    });
    return {
        passed: child.status === 0,
        summary: `${child.stdout || ''}${child.stderr || ''}`.trim().split('\n').slice(-1)[0] || '',
    };
}

async function fetchLeaderboard() {
    const response = await fetch(`${LEADERBOARD_URL}?t=${Date.now()}`);
    if (!response.ok) throw new Error(`leaderboard fetch failed: ${response.status}`);
    const data = await response.json();
    const team = data.teams.find((entry) => entry.fork === FORK);
    if (!team) throw new Error(`fork ${FORK} not found on leaderboard`);
    const heldRanking = [...data.teams].sort((a, b) =>
        (b.heldOut?.points || 0) - (a.heldOut?.points || 0));
    const publicRanking = [...data.teams].sort((a, b) =>
        (b.public?.points || 0) - (a.public?.points || 0));
    return {
        data,
        team,
        heldRank: heldRanking.findIndex((entry) => entry.fork === FORK) + 1,
        publicRank: publicRanking.findIndex((entry) => entry.fork === FORK) + 1,
        leader: heldRanking[0],
    };
}

function appendHistory(row) {
    const header = [
        'refreshed_at', 'commit', 'leaderboard_scored_at',
        'public_local_screens', 'public_local_max', 'public_local_passed',
        'supplemental_screens', 'supplemental_max', 'supplemental_passed',
        'held_screens', 'held_max', 'held_passed', 'held_rank',
        'public_rng_pct', 'held_rng_pct', 'playable', 'hang_gate',
    ].join('\t');
    if (!existsSync(HISTORY)) writeFileSync(HISTORY, `${header}\n`);
    const existing = readFileSync(HISTORY, 'utf8').trimEnd().split('\n');
    const key = [
        row.commit,
        row.leaderboardScoredAt,
        row.publicLocal.screensMatched,
        row.publicLocal.screensTotal,
        row.publicLocal.passed,
        row.supplemental.screensMatched,
        row.supplemental.screensTotal,
        row.supplemental.passed,
        row.held.points,
        row.heldRank,
    ].join('\t');
    const duplicate = existing.slice(1).some((line) => {
        const fields = line.split('\t');
        return [
            fields[1], fields[2], fields[3], fields[4], fields[5], fields[6],
            fields[7], fields[8], fields[9], fields[12],
        ].join('\t') === key;
    });
    if (!duplicate) appendFileSync(HISTORY, `${[
        row.refreshedAt,
        row.commit,
        row.leaderboardScoredAt,
        row.publicLocal.screensMatched,
        row.publicLocal.screensTotal,
        row.publicLocal.passed,
        row.supplemental.screensMatched,
        row.supplemental.screensTotal,
        row.supplemental.passed,
        row.held.points,
        row.held.maxPoints,
        row.held.passing,
        row.heldRank,
        row.publicLive.rngPct,
        row.held.rngPct,
        row.playability.playable,
        row.hangGate.passed,
    ].join('\t')}\n`);
}

function recentHistory() {
    if (!existsSync(HISTORY)) return [];
    const lines = readFileSync(HISTORY, 'utf8').trim().split('\n');
    const header = lines[0].split('\t');
    return lines.slice(1).slice(-10).reverse().map((line) =>
        Object.fromEntries(line.split('\t').map((value, index) => [header[index], value])));
}

function render(row, leaderboard) {
    const publicLive = row.publicLive;
    const held = row.held;
    const publicLocal = row.publicLocal;
    const supplemental = row.supplemental;
    const playability = row.playability;
    const history = recentHistory();
    const lines = [];
    lines.push('# Contest score dashboard');
    lines.push('');
    lines.push(`Last refreshed: ${row.refreshedAt}. Local commit: \`${row.commit}\`.`);
    lines.push(`Leaderboard snapshot: ${leaderboard.data.timestamp}. Fork last scored: ${row.leaderboardScoredAt}.`);
    lines.push('');
    lines.push('## Score summary');
    lines.push('');
    lines.push('| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |');
    lines.push('|---|---:|---:|---:|---:|---:|');
    lines.push(`| Public local | ${publicLocal.screensMatched}/${publicLocal.screensTotal} | ${percent(publicLocal.screensMatched, publicLocal.screensTotal)} | ${publicLocal.passed}/${publicLocal.sessions} | ${publicLocal.rngMatched}/${publicLocal.rngTotal} (${percent(publicLocal.rngMatched, publicLocal.rngTotal)}) | ${publicLocal.animMatched}/${publicLocal.animTotal} |`);
    lines.push(`| Public leaderboard | ${publicLive.points}/${publicLive.maxPoints} | ${publicLive.screenPct.toFixed(2)}% | ${publicLive.passing}/${publicLive.total} | ${publicLive.rngPct.toFixed(2)}% | ${publicLive.animMatched}/${publicLive.animTotal} |`);
    lines.push(`| Held-out leaderboard | ${held.points}/${held.maxPoints} | ${held.screenPct.toFixed(2)}% | ${held.passing}/${held.total} | ${held.rngPct.toFixed(2)}% | ${held.animMatched}/${held.animTotal} |`);
    lines.push(`| Supplemental C suite | ${supplemental.screensMatched}/${supplemental.screensTotal} | ${percent(supplemental.screensMatched, supplemental.screensTotal)} | ${supplemental.passed}/${supplemental.sessions} | ${supplemental.rngMatched}/${supplemental.rngTotal} (${percent(supplemental.rngMatched, supplemental.rngTotal)}) | ${supplemental.animMatched}/${supplemental.animTotal} |`);
    lines.push('');
    lines.push('## Contest position and generalization');
    lines.push('');
    lines.push(`- Held-out rank: **${row.heldRank}/${leaderboard.data.teams.length}**.`);
    lines.push(`- Public rank: **${row.publicRank}/${leaderboard.data.teams.length}**.`);
    lines.push(`- Held-out/public identical-screen ratio: **${ratio(held.points, publicLive.points)}**.`);
    lines.push(`- Current held-out leader: \`${leaderboard.leader.fork}\`, ${leaderboard.leader.heldOut.points}/${leaderboard.leader.heldOut.maxPoints}.`);
    lines.push(`- Contest phase: ${leaderboard.data.contestPhase}.`);
    lines.push('');
    lines.push('## Output details');
    lines.push('');
    lines.push('| Check | Public local | Supplemental |');
    lines.push('|---|---:|---:|');
    lines.push(`| Cells only | ${publicLocal.cellsMatched}/${publicLocal.cellsTotal} | ${supplemental.cellsMatched}/${supplemental.cellsTotal} |`);
    lines.push(`| Cursor positions | ${publicLocal.cursorsMatched}/${publicLocal.cursorsTotal} | ${supplemental.cursorsMatched}/${supplemental.cursorsTotal} |`);
    lines.push(`| Startup and per-turn estimate | ${row.publicSpeed} | ${row.supplementalSpeed} |`);
    lines.push('');
    lines.push('## Judge health');
    lines.push('');
    lines.push(`- Playable: ${playability.playable}. Browser: ${playability.browser_ok}.`);
    lines.push(`- Speed: ${playability.ms_per_move} ms per move, limit ${playability.threshold_ms_per_move} ms.`);
    lines.push(`- Sessions skipped: ${playability.sessions_skipped}. Sessions killed: ${playability.sessions_killed}.`);
    lines.push(`- Early abort: ${playability.aborted_early}. Total scored moves: ${playability.total_moves}.`);
    lines.push(`- Local hang gate: ${row.hangGate.passed ? 'PASS' : 'FAIL'}. ${row.hangGate.summary}`);
    lines.push('');
    lines.push('## Recent snapshots');
    lines.push('');
    lines.push('| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |');
    lines.push('|---|---|---:|---:|---:|---:|');
    for (const entry of history) {
        lines.push(`| ${entry.refreshed_at} | \`${entry.commit}\` | ${entry.public_local_screens}/${entry.public_local_max} | ${entry.supplemental_screens}/${entry.supplemental_max} | ${entry.held_screens}/${entry.held_max} | ${entry.held_rank} |`);
    }
    lines.push('');
    lines.push('Refresh with `node tools/contest-dashboard.mjs`. The command runs both local');
    lines.push('corpora, the hang gate, and a live leaderboard fetch. A push can take up to');
    lines.push('two hours to appear in the held-out column.');
    lines.push('');
    return lines.join('\n');
}

async function main() {
    const refreshedAt = new Date().toISOString();
    const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: ROOT,
        encoding: 'utf8',
    }).trim();
    const publicBundle = runScorer(join(ROOT, 'sessions'));
    const supplementalBundle = runScorer(join(ROOT, 'tools', 'gen-sessions', 'generated'));
    const publicLocal = aggregate(publicBundle);
    const supplemental = aggregate(supplementalBundle);
    const hangGate = runHangGate();
    const leaderboard = await fetchLeaderboard();
    const row = {
        refreshedAt,
        commit,
        leaderboardScoredAt: leaderboard.team.lastScored,
        publicLocal,
        supplemental,
        publicLive: leaderboard.team.public,
        held: leaderboard.team.heldOut,
        heldRank: leaderboard.heldRank,
        publicRank: leaderboard.publicRank,
        playability: leaderboard.team.playability,
        hangGate,
        publicSpeed: publicBundle.speed?.label || 'n/a',
        supplementalSpeed: supplementalBundle.speed?.label || 'n/a',
    };
    if (!process.argv.includes('--no-history')) appendHistory(row);
    const text = `${render(row, leaderboard).trimEnd()}\n`;
    if (process.argv.includes('--stdout')) process.stdout.write(text);
    else {
        writeFileSync(DASHBOARD, text);
        console.log(`wrote ${DASHBOARD}`);
        console.log(`public ${publicLocal.screensMatched}/${publicLocal.screensTotal}, supplemental ${supplemental.screensMatched}/${supplemental.screensTotal}, held ${row.held.points}/${row.held.maxPoints}, rank ${row.heldRank}/${leaderboard.data.teams.length}`);
        console.log(`hang gate: ${hangGate.passed ? 'PASS' : 'FAIL'}`);
    }
    if (!hangGate.passed) process.exitCode = 1;
}

main().catch((error) => {
    console.error(`contest-dashboard: ${error.message}`);
    process.exit(2);
});
