#!/usr/bin/env node
// Measure actual C decisions, including functions with no RNG calls.
// Usage: node tools/c-branch-coverage.mjs --build
//        node tools/c-branch-coverage.mjs [--out DIR] [session.json | corpus-dir ...]
// Defaults to public + supplemental. Only exact re-recordings earn coverage.
// Darwin's continuous profiles preserve counters when the recorder is killed
// at the final input boundary. Lua and inactive build configurations are outside
// this census. Raw llvm-cov output retains macro expansions' branch counters;
// the concise report counts only conditions written directly in C functions.

import {
    cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync,
    writeFileSync, openSync, closeSync, statSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CACHE = join(ROOT, '.cache/c-coverage');
const BUILD = join(CACHE, 'recorder');
const BINARY = join(BUILD, 'src/nethack');
const INSTALL = join(BUILD, 'install/games/lib/nethackdir');
const RECORDER = join(ROOT, 'scripts/record-session.mjs');

export function recordingDifference(expected, actual) {
    if (!expected.segments.length) return 'empty session';
    if (expected.segments.length !== actual.segments.length)
        return 'segment count';
    for (let s = 0; s < expected.segments.length; ++s) {
        const a = expected.segments[s].steps || [];
        const b = actual.segments[s].steps || [];
        if (!a.length || a.length !== b.length)
            return `segment ${s}: step count ${a.length}/${b.length}`;
        for (let i = 0; i < a.length; ++i)
            for (const field of ['key', 'rng', 'screen', 'cursor', 'animation_frames'])
                if (!isDeepStrictEqual(a[i][field], b[i][field]))
                    return `segment ${s}, step ${i}: ${field}`;
    }
    return null;
}

export function summarizeFunctions(coverage, build) {
    return coverage.data.flatMap(data => data.functions).flatMap(fn => {
        const file = relative(build, fn.filenames[0]);
        if (!/^(src|win\/tty)\/[^/]+\.c$/.test(file)) return [];
        // LLVM's branch tuple: start/end line+column, true/false counts,
        // file ID, expanded file ID, region kind. A macro's file ID is nonzero.
        const branches = fn.branches.filter(b => b[6] === 0);
        const missing = branches.flatMap(b => [
            ...(b[4] === 0 ? [{ line: b[0], column: b[1], outcome: true }] : []),
            ...(b[5] === 0 ? [{ line: b[0], column: b[1], outcome: false }] : []),
        ]);
        return [{
            file, name: fn.name.replace(/^.*:/, ''), line: fn.regions[0][0],
            calls: fn.count, outcomes: branches.length * 2,
            covered: branches.length * 2 - missing.length, missing,
        }];
    });
}

function run(command, args, options = {}) {
    const r = spawnSync(command, args, {
        cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options,
    });
    if (r.error) throw r.error;
    if (r.status !== 0)
        throw new Error(`${command} exited ${r.status}: ${(r.stderr || '').slice(-1500)}`);
    return r.stdout;
}

function buildRecorder() {
    const original = join(ROOT, 'nethack-c/recorder');
    if (!existsSync(join(original, 'src/Makefile')))
        throw new Error('Build the ordinary recorder first with nethack-c/build-recorder.sh.');
    mkdirSync(CACHE, { recursive: true });
    rmSync(BUILD, { recursive: true, force: true });
    cpSync(original, BUILD, { recursive: true, dereference: true });
    for (const name of readdirSync(join(BUILD, 'src')))
        if (name.endsWith('.o') || ['hacklib.a', 'nethack', 'Sysunix'].includes(name))
            rmSync(join(BUILD, 'src', name));
    const log = openSync(join(CACHE, 'build.log'), 'w');
    try {
        run('make', ['-C', join(BUILD, 'src'), '-j8',
            'CC=clang -fprofile-instr-generate -fcoverage-mapping'], {
            env: { ...process.env, SOURCE_DATE_EPOCH: '1777723200' },
            stdio: ['ignore', log, log],
        });
    } finally { closeSync(log); }
    console.log(`Built ${relative(ROOT, BINARY)}. Log: .cache/c-coverage/build.log`);
}

function sessionFiles(paths) {
    return [...new Set(paths.flatMap(p => {
        const full = resolve(p);
        return statSync(full).isDirectory()
            ? readdirSync(full).filter(n => n.endsWith('.session.json')).sort()
                .map(n => join(full, n))
            : [full];
    }))];
}

function writeReport(out, results, functions, binaryHash) {
    const credited = results.filter(r => r.credited);
    const covered = functions.reduce((n, f) => n + f.covered, 0);
    const outcomes = functions.reduce((n, f) => n + f.outcomes, 0);
    const called = functions.filter(f => f.calls > 0).length;
    const summary = {
        generatedAt: new Date().toISOString(), binarySha256: binaryHash,
        sessions: results.length, credited: credited.length,
        functions: { covered: called, total: functions.length },
        branchOutcomes: { covered, total: outcomes }, results,
    };
    writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    writeFileSync(join(out, 'functions.json'), JSON.stringify(functions, null, 2) + '\n');
    const partial = functions.filter(f => f.calls && f.covered < f.outcomes)
        .sort((a, b) => b.missing.length - a.missing.length);
    const never = functions.filter(f => !f.calls)
        .sort((a, b) => b.outcomes - a.outcomes);
    const lines = [
        '# Measured C branch coverage', '', `Generated: ${summary.generatedAt}.`, '',
        `Exact C re-recordings: **${credited.length}/${results.length}**.`,
        `Functions entered: **${called}/${functions.length}**.`,
        `Direct C branch outcomes observed: **${covered}/${outcomes}** `
            + `(${(100 * covered / outcomes).toFixed(2)}%).`, '',
        'A covered outcome means C executed it, not that JS implements it correctly.',
        'Only byte-identical re-recordings contribute profiles. Rejected recordings',
        'are listed below. This denominator covers the compiled src/ and win/tty/',
        'functions, including unreachable/error paths. It excludes Lua, macro-internal',
        'conditions, and inactive build configurations. It is not whole-game completeness.',
        'Profiles cover process lifetime, including startup and recorder shutdown.',
        '', '## Uncovered outcomes in entered functions', '',
        '| Source | Function | Observed outcomes | First missing outcome |',
        '|---|---|---:|---|',
    ];
    for (const f of partial.slice(0, 40)) {
        const m = f.missing[0];
        lines.push(`| ${f.file}:${f.line} | ${f.name} | ${f.covered}/${f.outcomes} `
            + `| ${m.line}:${m.column} = ${m.outcome} |`);
    }
    lines.push('', '## Functions never entered', '',
        '| Source | Function | Branch outcomes |', '|---|---|---:|');
    for (const f of never.slice(0, 40))
        lines.push(`| ${f.file}:${f.line} | ${f.name} | ${f.outcomes} |`);
    lines.push('', '## Rejected recordings', '');
    for (const r of results.filter(r => !r.credited))
        lines.push(`- ${r.session}: ${r.reason}`);
    if (credited.length === results.length) lines.push('None.');
    lines.push('', 'Complete function and missing-outcome lists are in `functions.json`.',
        'The original LLVM counters, including macros, are in `coverage.json`.', '');
    writeFileSync(join(out, 'report.md'), lines.join('\n'));
    console.log(`C coverage: ${called}/${functions.length} functions; ${covered}/${outcomes} `
        + `direct branch outcomes. ${credited.length}/${results.length} recordings credited.`);
}

function main() {
    const args = process.argv.slice(2);
    if (process.platform !== 'darwin')
        throw new Error('This collector requires Darwin continuous LLVM profiles (%c).');
    if (args[0] === '--build') { buildRecorder(); return; }
    let out = join(CACHE, 'run');
    const i = args.indexOf('--out');
    if (i >= 0) {
        if (!args[i + 1]) throw new Error('--out needs a directory');
        out = resolve(args[i + 1]); args.splice(i, 2);
    }
    if (!existsSync(BINARY)) throw new Error('Run with --build first.');
    if (existsSync(out)) throw new Error(`Output already exists: ${out}. Choose a fresh --out.`);
    const files = sessionFiles(args.length ? args : [
        join(ROOT, 'sessions'), join(ROOT, 'tools/gen-sessions/generated'),
    ]);
    if (!files.length) throw new Error('No sessions selected.');
    mkdirSync(out, { recursive: true });
    const results = [], profiles = [];
    for (const [index, input] of files.entries()) {
        const dir = join(out, String(index));
        mkdirSync(dir);
        const result = { session: relative(ROOT, input), credited: false };
        try {
            const expected = JSON.parse(readFileSync(input, 'utf8'));
            if (expected.jsGroundTruth) throw new Error('JS ground truth is not a C oracle');
            run(process.execPath, [RECORDER, input, join(dir, 'actual.json')], {
                env: { ...process.env, NETHACK_BINARY: BINARY, NETHACK_INSTALL: INSTALL,
                    LLVM_PROFILE_FILE: join(dir, '%p%c.profraw') },
            });
            const actual = JSON.parse(readFileSync(join(dir, 'actual.json'), 'utf8'));
            const diff = recordingDifference(expected, actual);
            if (diff) {
                const rejected = join(out, `${index}.rejected.session.json`);
                writeFileSync(rejected, JSON.stringify(actual));
                result.recording = relative(ROOT, rejected);
                throw new Error(diff);
            }
            const raw = readdirSync(dir).filter(n => n.endsWith('.profraw'));
            if (raw.length !== expected.segments.length)
                throw new Error(`expected ${expected.segments.length} profiles, got ${raw.length}`);
            const profile = join(out, `${index}.profdata`);
            run('xcrun', ['llvm-profdata', 'merge', '-sparse',
                ...raw.map(n => join(dir, n)), '-o', profile]);
            profiles.push(profile);
            result.credited = true;
        } catch (e) { result.reason = e.message; }
        results.push(result);
        rmSync(dir, { recursive: true, force: true });
        if (!result.credited || (index + 1) % 10 === 0 || index === files.length - 1)
            console.log(`[${index + 1}/${files.length}] ${result.credited ? 'exact' : 'REJECT'} `
                + `${result.session}${result.reason ? ': ' + result.reason : ''}`);
    }
    writeFileSync(join(out, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    if (!profiles.length) throw new Error('No exact recordings; no coverage credited.');
    const profile = join(out, 'merged.profdata');
    run('xcrun', ['llvm-profdata', 'merge', '-sparse', ...profiles, '-o', profile]);
    const data = run('xcrun', ['llvm-cov', 'export', '--skip-expansions', BINARY,
        `-instr-profile=${profile}`]);
    writeFileSync(join(out, 'coverage.json'), data);
    const hash = createHash('sha256').update(readFileSync(BINARY)).digest('hex');
    writeReport(out, results, summarizeFunctions(JSON.parse(data), BUILD), hash);
    if (results.some(r => !r.credited)) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { main(); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
