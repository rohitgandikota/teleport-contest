#!/usr/bin/env node
// gen-dungeon.mjs — Generate js/dungeon_data.js from dat/dungeon.lua.
//
// dungeon.lua is the one Lua file in dat/ that is purely declarative: 333 lines
// of nested tables with string and integer values, no functions and no control
// flow. So the dungeon topology can be generated without the Lua interpreter,
// which is why dungeon.c's initialisation is reachable ahead of M9a proper.
//
// If a future NetHack adds real logic to dungeon.lua this will fail loudly
// rather than silently mis-parse — see assertOnlyData().
//
// Usage: node tools/gen-dungeon.mjs [--stdout]

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(PROJECT_ROOT, 'nethack-c/upstream/dat/dungeon.lua');
const OUT = join(PROJECT_ROOT, 'js/dungeon_data.js');

// Strip Lua comments (-- to end of line), leaving string literals alone.
function stripComments(src) {
    let out = '';
    for (let i = 0; i < src.length;) {
        const c = src[i];
        if (c === '"' || c === "'") {
            const q = c;
            out += src[i++];
            while (i < src.length) {
                if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
                out += src[i];
                if (src[i] === q) { i++; break; }
                i++;
            }
            continue;
        }
        if (c === '-' && src[i + 1] === '-') {
            while (i < src.length && src[i] !== '\n') i++;
            continue;
        }
        out += src[i++];
    }
    return out;
}

// Guard: this generator only handles declarative data. If dungeon.lua ever
// gains real Lua, stop rather than emit something subtly wrong.
function assertOnlyData(src) {
    const banned = /\b(function|if|then|else|elseif|for|while|repeat|until|local|return|require|and|or|not)\b/;
    const m = banned.exec(src);
    if (m) {
        throw new Error(
            `dungeon.lua now contains Lua code ("${m[0]}" at offset ${m.index}); ` +
            'this generator only handles pure data. Use the interpreter instead.');
    }
}

// Minimal Lua table-literal reader: { key = value, ... } and { value, ... }.
function parse(src) {
    let i = 0;

    const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };

    function value() {
        ws();
        const c = src[i];
        if (c === '{') return table();
        if (c === '"' || c === "'") return string();
        const start = i;
        while (i < src.length && !/[,}\s]/.test(src[i])) i++;
        const tok = src.slice(start, i);
        if (/^-?\d+$/.test(tok)) return Number(tok);
        if (/^-?\d*\.\d+$/.test(tok)) return Number(tok);
        if (tok === 'true') return true;
        if (tok === 'false') return false;
        if (tok === 'nil') return null;
        throw new Error(`unexpected token "${tok}" at offset ${start}`);
    }

    function string() {
        const q = src[i++];
        let s = '';
        while (i < src.length && src[i] !== q) {
            if (src[i] === '\\') { s += src[i + 1]; i += 2; continue; }
            s += src[i++];
        }
        i++; // closing quote
        return s;
    }

    // A Lua table is an array, a map, or both. Emit an array when every entry
    // is positional, an object when every entry is keyed — dungeon.lua never
    // mixes them.
    function table() {
        i++; // '{'
        const arr = [];
        const obj = {};
        let keyed = false, positional = false;
        for (;;) {
            ws();
            if (src[i] === '}') { i++; break; }
            if (src[i] === ',' || src[i] === ';') { i++; continue; }

            // lookahead for "key ="
            const save = i;
            const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(src.slice(i));
            if (m && src[i + m[0].length] !== '=') {
                i += m[0].length;
                keyed = true;
                obj[m[1]] = value();
            } else {
                i = save;
                positional = true;
                arr.push(value());
            }
        }
        if (keyed && positional) {
            throw new Error('mixed array/map table — not expected in dungeon.lua');
        }
        return keyed ? obj : arr;
    }

    // The file is a sequence of "name = <table>" assignments at top level.
    const top = {};
    for (;;) {
        ws();
        if (i >= src.length) break;
        const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(src.slice(i));
        if (!m) throw new Error(`expected assignment at offset ${i}`);
        i += m[0].length;
        top[m[1]] = value();
    }
    return top;
}

function main() {
    const raw = stripComments(readFileSync(SRC, 'utf8'));
    assertOnlyData(raw);
    const top = parse(raw);

    if (!Array.isArray(top.dungeon)) {
        throw new Error('expected a top-level `dungeon` array');
    }

    const nDungeons = top.dungeon.length;
    const nBranches = top.dungeon.reduce((a, d) => a + (d.branches?.length || 0), 0);
    const nLevels = top.dungeon.reduce((a, d) => a + (d.levels?.length || 0), 0);

    const out = `// dungeon_data.js — GENERATED by tools/gen-dungeon.mjs from
// nethack-c/upstream/dat/dungeon.lua. Do not edit by hand; re-run the
// generator.
//
// dungeon.lua is the one file in dat/ that is purely declarative — nested
// tables of strings and integers, no functions, no control flow — so the
// dungeon topology needs no Lua interpreter. The generator refuses to run if
// that ever stops being true.
//
// ${nDungeons} dungeons, ${nBranches} branches, ${nLevels} named levels.

export const dungeon = ${JSON.stringify(top.dungeon, null, 4)};

export default dungeon;
`;

    if (process.argv.includes('--stdout')) process.stdout.write(out);
    else {
        writeFileSync(OUT, out);
        console.log(`wrote ${OUT}`);
        console.log(`${nDungeons} dungeons, ${nBranches} branches, ${nLevels} named levels`);
        for (const d of top.dungeon) {
            console.log(`  ${String(d.name).padEnd(26)} base=${d.base} range=${d.range ?? 0}` +
                ` branches=${d.branches?.length || 0} levels=${d.levels?.length || 0}`);
        }
    }
}

main();
