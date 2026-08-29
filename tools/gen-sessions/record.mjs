#!/usr/bin/env node
// record.mjs — Generate a .session.json from a recipe, via the patched
// C recorder.
//
// A recipe is a JSON file naming the inputs of each segment and nothing
// else — the steps (rng / screens / cursors) are produced by actually
// running the recorder binary, so the output is ground truth by
// construction:
//
//   {
//     "name": "fountain-quaff",
//     "description": "what this session covers",
//     "coverage": ["terrain.furniture", "object.potions"],
//     "branches": ["example.concrete-c-branch"],
//     "segments": [
//       { "seed": 6101, "datetime": "20000110090000",
//         "nethackrc": "OPTIONS=...\n", "moves": "hjkl..." }
//     ]
//   }
//
// Keys in "moves" are raw characters, one key per char, exactly as in
// sessions/*.session.json: "\r" for Enter, "\u001b" for ESC, "\u0004"
// for ^D, etc. (record-session.mjs translates \r -> \n on the wire,
// matching the tmux ICRNL discipline of the canonical recordings.)
//
// Usage:
//   node tools/gen-sessions/record.mjs recipes/<name>.json [more.json ...]
//   node tools/gen-sessions/record.mjs --all          # every recipe
//
// Output: tools/gen-sessions/generated/<name>.session.json
//
// Requires the recorder binary (bash nethack-c/build-recorder.sh).

import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const RECORD = path.join(ROOT, 'scripts', 'record-session.mjs');
const GENERATED = path.join(HERE, 'generated');
const RECIPES = path.join(HERE, 'recipes');

function recipeToSessionInput(recipe) {
    if (!recipe.name || !Array.isArray(recipe.coverage)
        || !Array.isArray(recipe.segments)) {
        throw new Error('recipe needs {name, coverage:[], segments:[{seed,datetime,nethackrc,moves}]}');
    }
    if (recipe.branches !== undefined && !Array.isArray(recipe.branches))
        throw new Error('recipe branches must be an array when present');
    const input = {
        version: 5,
        segments: recipe.segments.map((s) => ({
            seed: s.seed,
            datetime: s.datetime,
            nethackrc: s.nethackrc,
            moves: s.moves,
            steps: [],
        })),
        source: 'c',
        recorded_with: {
            tool: 'tools/gen-sessions/record.mjs',
            spec: `${recipe.name}.json`,
        },
        coverage: [...new Set(recipe.coverage)].sort(),
    };
    if (recipe.branches?.length)
        input.branches = [...new Set(recipe.branches)].sort();
    return input;
}

async function runRecorder(inputPath, outputPath) {
    await new Promise((resolve, reject) => {
        const c = spawn(process.execPath, [RECORD, inputPath, outputPath], {
            stdio: ['ignore', 'inherit', 'inherit'],
        });
        c.on('error', reject);
        c.on('close', (code) => code === 0 ? resolve()
            : reject(new Error(`record-session exit=${code}`)));
    });
}

async function generateOne(recipePath) {
    const recipe = JSON.parse(await fs.readFile(recipePath, 'utf8'));
    const input = recipeToSessionInput(recipe);
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen-sess-'));
    const inputPath = path.join(tmpDir, 'input.json');
    const outputPath = path.join(GENERATED, `${recipe.name}.session.json`);
    try {
        await fs.writeFile(inputPath, JSON.stringify(input));
        await fs.mkdir(GENERATED, { recursive: true });
        await runRecorder(inputPath, outputPath);
        const out = JSON.parse(await fs.readFile(outputPath, 'utf8'));
        let ok = true;
        out.segments.forEach((seg, i) => {
            const expected = (seg.moves || '').length + 1;
            const got = (seg.steps || []).length;
            const rng = (seg.steps || []).reduce((n, s) => n + (s.rng || []).length, 0);
            const note = got === expected ? '' : `  (expected ${expected} — game ended early?)`;
            if (got !== expected) ok = false;
            console.log(`  seg ${i}: seed=${seg.seed} steps=${got} rng=${rng}${note}`);
        });
        console.log(`${ok ? '[ok]' : '[warn]'} ${path.relative(ROOT, outputPath)}`);
        return ok;
    } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
}

async function main() {
    let args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: node tools/gen-sessions/record.mjs <recipe.json> [...] | --all');
        process.exit(2);
    }
    if (args[0] === '--all') {
        args = (await fs.readdir(RECIPES))
            .filter((n) => n.endsWith('.json'))
            .sort()
            .map((n) => path.join(RECIPES, n));
    }
    let fails = 0;
    for (const a of args) {
        console.log(`=== ${path.basename(a)} ===`);
        try {
            // Accept a path relative to cwd, or a bare/relative recipe
            // name resolved against tools/gen-sessions/recipes/.
            let p = path.resolve(a);
            try { await fs.access(p); } catch {
                p = path.join(RECIPES, path.basename(a));
                if (!p.endsWith('.json')) p += '.json';
            }
            if (!await generateOne(p)) fails += 1;
        } catch (e) {
            console.error(`[fail] ${a}: ${e.message}`);
            fails += 1;
        }
    }
    process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
