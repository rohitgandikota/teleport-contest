#!/usr/bin/env node
// gen-roledata.mjs — Generate js/role_data.js from src/role.c.
//
// roles[], races[], genders[] and aligns[] are plain C aggregate initialisers,
// so we parse the brace structure generically and map top-level positions onto
// the field names from the struct definitions in include/you.h. Generating
// rather than transcribing means a 5.1 role change is a re-run — see
// docs/plan/00-strategy.md, D2.
//
// Leaf values are kept as the raw C expressions ("PM_ARCHEOLOGIST",
// "MH_HUMAN | MH_DWARF | ROLE_LAWFUL", -4). Resolving those belongs to
// js/const.js, not here: this file's job is to reproduce the table shape
// faithfully, not to interpret it.
//
// Usage: node tools/gen-roledata.mjs [--stdout]

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(PROJECT_ROOT, 'nethack-c/upstream/src/role.c');
const OUT = join(PROJECT_ROOT, 'js/role_data.js');

// --- field layouts, from include/you.h ------------------------------------

// struct Role, include/you.h:183-231. Order is load-bearing: these are
// positional initialisers.
const ROLE_FIELDS = [
    'name',                                     // struct RoleName
    'rank',                                     // struct RoleName[9]
    'lgod', 'ngod', 'cgod',
    'filecode', 'homebase', 'intermed',
    'mnum', 'petnum', 'ldrnum', 'guardnum', 'neminum', 'enemy1num', 'enemy2num',
    'enemy1sym', 'enemy2sym',
    'questarti',
    'allow',
    'attrbase', 'attrdist',                     // xint16[A_MAX]
    'hpadv', 'enadv',                           // struct RoleAdvance
    'xlev', 'initrecord',
    'spelbase', 'spelheal', 'spelshld', 'spelarmr', 'spelstat', 'spelspec',
    'spelsbon',
];

// --- generic C initialiser parser -----------------------------------------

function stripComments(src) {
    let out = '';
    let i = 0;
    while (i < src.length) {
        if (src[i] === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2);
            i = end < 0 ? src.length : end + 2;
            out += ' ';
            continue;
        }
        if (src[i] === '/' && src[i + 1] === '/') {
            const end = src.indexOf('\n', i);
            i = end < 0 ? src.length : end;
            continue;
        }
        if (src[i] === '"' || src[i] === "'") {
            const q = src[i];
            out += src[i++];
            while (i < src.length) {
                if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
                out += src[i];
                if (src[i] === q) { i++; break; }
                i++;
            }
            continue;
        }
        out += src[i++];
    }
    return out;
}

// Parse a brace-balanced initialiser body into nested arrays. Leaves are the
// trimmed C expression text.
function parseInitializer(text, start) {
    let i = start;
    function parseList() {
        const items = [];
        let cur = '';
        i++; // consume '{'
        while (i < text.length) {
            const c = text[i];
            if (c === '{') {
                const sub = parseList();
                items.push(sub);
                cur = '';
                continue;
            }
            if (c === '}') {
                i++;
                if (cur.trim()) items.push(cur.trim());
                return items;
            }
            if (c === ',') {
                if (cur.trim()) items.push(cur.trim());
                cur = '';
                i++;
                continue;
            }
            if (c === '"') {
                let s = c; i++;
                while (i < text.length) {
                    if (text[i] === '\\') { s += text[i] + (text[i + 1] ?? ''); i += 2; continue; }
                    s += text[i];
                    if (text[i] === '"') { i++; break; }
                    i++;
                }
                cur += s;
                continue;
            }
            cur += c;
            i++;
        }
        throw new Error('unterminated initialiser');
    }
    return parseList();
}

// Pull the initialiser for `const struct X name[...] = { ... };`
function extractTable(src, declRe) {
    const m = declRe.exec(src);
    if (!m) throw new Error(`table not found: ${declRe}`);
    const brace = src.indexOf('{', m.index + m[0].length - 1);
    return parseInitializer(src, brace);
}

// Collapse a C string expression to its JS value; leave other leaves as text.
function leafValue(v) {
    if (Array.isArray(v)) return v;
    // Bitmask expressions are line-continued in the C ("MH_HUMAN | MH_DWARF\n
    // | ROLE_NEUTRAL"); collapse the wrapping so the emitted expression is one
    // line and compares cleanly.
    const t = String(v).replace(/\s+/g, ' ').trim();
    const m = /^"((?:[^"\\]|\\.)*)"$/.exec(t);
    if (m) return m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    if (/^-?\d+$/.test(t)) return Number(t);
    return t; // a C constant expression, kept verbatim
}

function deepValue(v) {
    return Array.isArray(v) ? v.map(deepValue) : leafValue(v);
}

// struct RoleName { const char *m, *f; } — a 0 in the f slot means "same as m".
function roleName(v) {
    const a = Array.isArray(v) ? v : [v];
    const m = leafValue(a[0]);
    const f = a.length > 1 ? leafValue(a[1]) : 0;
    return { m, f: (f === 0 || f === 'NULL' || f === '0') ? null : f };
}

function buildRole(entry) {
    const r = {};
    ROLE_FIELDS.forEach((field, idx) => {
        const raw = entry[idx];
        if (raw === undefined) { r[field] = null; return; }
        if (field === 'name') r[field] = roleName(raw);
        else if (field === 'rank') r[field] = raw.map(roleName);
        else r[field] = deepValue(raw);
    });
    return r;
}

function main() {
    const src = stripComments(readFileSync(SRC, 'utf8'));

    const rolesRaw = extractTable(src, /const\s+struct\s+Role\s+roles\s*\[[^\]]*\]\s*=\s*\{/);
    const racesRaw = extractTable(src, /const\s+struct\s+Race\s+races\s*\[[^\]]*\]\s*=\s*\{/);
    const gendersRaw = extractTable(src, /const\s+struct\s+Gender\s+genders\s*\[[^\]]*\]\s*=\s*\{/);
    const alignsRaw = extractTable(src, /const\s+struct\s+Align\s+aligns\s*\[[^\]]*\]\s*=\s*\{/);

    // Each table is NUL-terminated by a final all-zero entry; the C sizes them
    // NUM_ROLES+1 etc. Drop trailing entries with no name.
    const roles = rolesRaw
        .filter(e => Array.isArray(e) && Array.isArray(e[0]) && /^"/.test(String(e[0][0])))
        .map(buildRole);

    const races = racesRaw.filter(e => Array.isArray(e)).map(deepValue);
    const genders = gendersRaw.filter(e => Array.isArray(e)).map(deepValue);
    const aligns = alignsRaw.filter(e => Array.isArray(e)).map(deepValue);

    const out = `// role_data.js — GENERATED by tools/gen-roledata.mjs from
// nethack-c/upstream/src/role.c. Do not edit by hand; re-run the generator.
//
// Field names come from the struct definitions in include/you.h (struct Role at
// you.h:183). Leaf values are the raw C expressions — "PM_ARCHEOLOGIST",
// "MH_HUMAN | MH_DWARF | ROLE_LAWFUL", -4 — because resolving constants is
// js/const.js's job, not this table's.
//
// ${roles.length} roles, ${races.length} races, ${genders.length} genders, ${aligns.length} alignments.

export const roles = ${JSON.stringify(roles, null, 4)};

export const races = ${JSON.stringify(races, null, 4)};

export const genders = ${JSON.stringify(genders, null, 4)};

export const aligns = ${JSON.stringify(aligns, null, 4)};

// src/role.c str2role() matches on the role name, case-insensitively.
export function findRole(name) {
    const n = String(name).toLowerCase();
    return roles.find(r => r.name.m.toLowerCase() === n
                        || (r.name.f && r.name.f.toLowerCase() === n)) || null;
}
`;

    if (process.argv.includes('--stdout')) process.stdout.write(out);
    else {
        writeFileSync(OUT, out);
        console.log(`wrote ${OUT}`);
        console.log(`${roles.length} roles, ${races.length} races, ${genders.length} genders, ${aligns.length} alignments`);
        console.log('roles:', roles.map(r => r.name.m).join(', '));
    }
}

main();
