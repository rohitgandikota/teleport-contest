#!/usr/bin/env node

// Compile integer expressions from the pinned C headers, independently of the
// JS declarations. This finds drift even in paths absent from recorded games.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as constants from '../js/const.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export function probeConstants(names, includeDir, outDir) {
    let remaining = [...names];
    const rejected = [];
    const sourcePath = resolve(outDir, 'probe.c');
    const binaryPath = resolve(outDir, 'probe');
    while (remaining.length) {
        for (const name of remaining)
            if (!/^[A-Za-z_]\w*$/.test(name)) throw new Error('Invalid C name: ' + name);
        writeFileSync(sourcePath, '#include "hack.h"\n#include <stdio.h>\nint main(void) {\n'
            + remaining.map(name => `#line 1 "${name}"\n`
                + `_Static_assert(__builtin_constant_p(${name}) && __builtin_classify_type(${name}) == 1 && sizeof(${name}) <= 8, "not a 64-bit integer constant");\n`
                + `if ((${name}) < 0) printf("${name} %lld %zu\\n", (long long)(${name}), sizeof(${name}));\n`
                + `else printf("${name} %llu %zu\\n", (unsigned long long)(${name}), sizeof(${name}));\n`)
                .join('') + 'return 0;\n}\n');
        const build = spawnSync('clang', ['-std=c99', '-I', includeDir,
            '-ferror-limit=0', '-Wno-everything', sourcePath, '-o', binaryPath],
        { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
        if (build.error) throw build.error;
        writeFileSync(resolve(outDir, 'compile.log'), build.stderr);
        if (build.status === 0) {
            const run = spawnSync(binaryPath, [], { encoding: 'utf8' });
            if (run.error) throw run.error;
            if (run.status !== 0) throw new Error(run.stderr || 'C probe failed');
            const values = Object.fromEntries(run.stdout.trim().split('\n').map(line => {
                const [name, value, bytes] = line.split(' ');
                return [name, { value, bytes: Number(bytes) }];
            }));
            return { values, rejected };
        }
        const errors = [...build.stderr.matchAll(
            /^(.+?):\d+:\d+: (?:fatal )?error: (.*)$/gm)];
        if (errors.some(m => !remaining.includes(m[1])))
            throw new Error(build.stderr);
        const bad = new Map(errors.map(m => [m[1], m[2]]));
        const removed = remaining.filter(name => bad.has(name));
        if (!removed.length) throw new Error(build.stderr || 'C compiler failed');
        rejected.push(...removed.map(name => ({ name, reason: bad.get(name) })));
        remaining = remaining.filter(name => !bad.has(name));
    }
    return { values: {}, rejected };
}

export function compareConstants(entries, values) {
    const mismatches = [], representations = [];
    for (const [name, js] of entries) {
        if (!(name in values)) continue;
        const { value: c, bytes } = values[name];
        if (BigInt(js) === BigInt(c)) continue;
        const row = { name, js: String(js), c, bytes };
        // JS bit operators use signed int32, even for masks held in a C long.
        // Report matching bit patterns separately. Call sites still need review.
        if (BigInt.asUintN(32, BigInt(js)) === BigInt.asUintN(32, BigInt(c))
            && BigInt(js) >= -2147483648n && BigInt(js) <= 4294967295n
            && BigInt(c) >= -2147483648n && BigInt(c) <= 4294967295n)
            representations.push(row);
        else
            mismatches.push(row);
    }
    return { mismatches, representations };
}

function main() {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--out'))
        throw new Error('Usage: node tools/c-constant-audit.mjs [--out NEW_DIRECTORY]');
    const outDir = resolve(ROOT, args[1] || '.cache/c-constants/' + Date.now());
    if (existsSync(outDir)) throw new Error('Output already exists: ' + outDir);
    mkdirSync(outDir, { recursive: true });
    const entries = Object.entries(constants).filter(([, value]) =>
        typeof value === 'bigint' || (typeof value === 'number' && Number.isInteger(value)));
    const result = probeConstants(entries.map(([name]) => name),
        resolve(ROOT, 'nethack-c/recorder/include'), outDir);
    const comparison = compareConstants(entries, result.values);
    const report = { source: 'nethack-c/recorder/include/hack.h',
        compiler: 'clang -std=c99', requested: entries.length,
        compared: Object.keys(result.values).length, ...result, ...comparison };
    writeFileSync(resolve(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`C constants: ${report.compared}/${report.requested} comparable; `
        + `${report.mismatches.length} different values; `
        + `${report.representations.length} same int32 patterns; `
        + `${report.rejected.length} unavailable/nonconstant names.`);
    console.log('Report: ' + resolve(outDir, 'report.json'));
    if (report.mismatches.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    main();
