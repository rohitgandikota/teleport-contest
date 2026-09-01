#!/usr/bin/env node
// Score each segment in one recorded session independently. This makes a
// command-suite mismatch attributable to one seed instead of every later
// input boundary in the aggregate replay.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const RUNNER = join(PROJECT_ROOT, 'frozen', 'ps_test_runner.mjs');

function usage() {
    console.error('usage: node tools/score-session-segments.mjs <session.json>');
    process.exit(2);
}

const target = process.argv[2];
if (!target || process.argv.length !== 3)
    usage();

const sessionPath = target.startsWith('/') ? target : join(PROJECT_ROOT, target);
const raw = JSON.parse(readFileSync(sessionPath, 'utf8'));
if (!Array.isArray(raw.segments))
    throw new Error(`${sessionPath} has no segments array`);

const tempDir = mkdtempSync(join(tmpdir(), 'nethack-segments-'));
let failures = 0;

try {
    console.log(`${basename(sessionPath)}: ${raw.segments.length} segments`);
    for (let i = 0; i < raw.segments.length; i++) {
        const segment = raw.segments[i];
        const tempPath = join(tempDir, `segment-${String(i).padStart(2, '0')}.session.json`);
        writeFileSync(tempPath, JSON.stringify({ version: raw.version, segments: [segment] }));

        const run = spawnSync(process.execPath, [RUNNER, tempPath], {
            cwd: PROJECT_ROOT,
            encoding: 'utf8',
            maxBuffer: 16 * 1024 * 1024,
        });
        const marker = '__RESULTS_JSON__\n';
        const offset = run.stdout.lastIndexOf(marker);
        if (offset < 0) {
            failures++;
            console.log(`${String(i).padStart(2, '0')} seed ${segment.seed}: ERROR`);
            const detail = (run.stderr || run.stdout || '').trim();
            if (detail)
                console.log(`   ${detail.replaceAll('\n', '\n   ')}`);
            continue;
        }

        const bundle = JSON.parse(run.stdout.slice(offset + marker.length));
        const result = bundle.results[0];
        const rng = result.metrics.rngCalls;
        const screens = result.metrics.screens;
        const cursors = result.metrics.cursors;
        const animation = result.metrics.animFrames;
        if (!result.passed)
            failures++;
        console.log(
            `${String(i).padStart(2, '0')} seed ${segment.seed}: `
            + `${result.passed ? 'PASS' : 'FAIL'}  `
            + `RNG ${rng.matched}/${rng.total}  `
            + `screen ${screens.matched}/${screens.total}  `
            + `cursor ${cursors.matched}/${cursors.total}  `
            + `anim ${animation.matched}/${animation.total}`,
        );
    }
} finally {
    rmSync(tempDir, { recursive: true, force: true });
}

process.exitCode = failures ? 1 : 0;
