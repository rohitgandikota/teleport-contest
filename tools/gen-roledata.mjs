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

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const RECORDER = join(PROJECT_ROOT, 'nethack-c/recorder');
const OUT = join(PROJECT_ROOT, 'js/role_data.js');

// Run the C preprocessor over role.c so that the `allow` bitmasks arrive as
// evaluable numbers (0x08L | 0x20L | ...) rather than as ROLE_/MH_/AM_ macro
// names we would otherwise have to resolve ourselves. Same approach as
// tools/gen-objects.mjs, and same prerequisite: build-recorder.sh must have run.
function preprocess() {
    if (!existsSync(RECORDER)) {
        throw new Error(
            'nethack-c/recorder/ not found — run `bash nethack-c/build-recorder.sh` first');
    }
    const out = execFileSync('clang', [
        '-E',
        '-I', join(RECORDER, 'include'),
        '-I', join(RECORDER, 'src'),
        '-DNOTPARMDECL', '-DNO_TIMED_DELAY',
        join(RECORDER, 'src/role.c'),
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return out.split('\n').filter(l => !/^#\s*\d+\s+"/.test(l)).join('\n');
}

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

// struct Race, include/you.h:257
const RACE_FIELDS = [
    'noun', 'adj', 'coll', 'filecode', 'individual',
    'mnum', 'mummynum', 'zombienum',
    'allow', 'selfmask', 'lovemask', 'hatemask',
    'attrmin', 'attrmax', 'hpadv', 'enadv',
];

// struct Gender, include/you.h:301
const GENDER_FIELDS = ['adj', 'he', 'him', 'his', 'filecode', 'allow'];

// struct Align, include/you.h:334
const ALIGN_FIELDS = ['noun', 'adj', 'filecode', 'allow', 'value'];

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
    // Bitmask expressions the preprocessor reduced to numbers:
    // "0x00000008L | 0x00000020L | 0x1000". Evaluate them so ok_role() and
    // friends can test bits directly.
    const numeric = t.replace(/([0-9a-fA-FxX]+)[UL]+\b/g, '$1');
    // Accept both a bare literal ("0x1000") and an expression
    // ("0x08 | 0x20"); require a digit and no bare identifiers.
    if (/^[-+*/|&^()~\s0-9a-fA-FxX]+$/.test(numeric) && /\d/.test(numeric)
        && !/\b[g-wyzG-WYZ]\w*/.test(numeric)) {
        try {
            // eslint-disable-next-line no-new-func
            const n = Function(`"use strict"; return (${numeric});`)();
            if (Number.isFinite(n)) return n;
        } catch { /* fall through and keep the text */ }
    }
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
    const src = stripComments(preprocess());

    const rolesRaw = extractTable(src, /const\s+struct\s+Role\s+roles\s*\[[^\]]*\]\s*=\s*\{/);
    const racesRaw = extractTable(src, /const\s+struct\s+Race\s+races\s*\[[^\]]*\]\s*=\s*\{/);
    const gendersRaw = extractTable(src, /const\s+struct\s+Gender\s+genders\s*\[[^\]]*\]\s*=\s*\{/);
    const alignsRaw = extractTable(src, /const\s+struct\s+Align\s+aligns\s*\[[^\]]*\]\s*=\s*\{/);

    // Each table is NUL-terminated by a final all-zero entry; the C sizes them
    // NUM_ROLES+1 etc. Drop trailing entries with no name.
    const roles = rolesRaw
        .filter(e => Array.isArray(e) && Array.isArray(e[0]) && /^"/.test(String(e[0][0])))
        .map(buildRole);

    // Map positional initialisers onto named struct fields, the same way
    // roles[] is handled. Without this, callers in js/role.js could not read
    // .allow / .selfmask and would have to hardcode array offsets.
    const byFields = (fields, entry) => {
        const o = {};
        fields.forEach((f, i) => {
            const raw = entry[i];
            if (raw === undefined) { o[f] = null; return; }
            o[f] = (f === 'individual') ? roleName(raw) : deepValue(raw);
        });
        return o;
    };
    // The C sizes these NUM_RACES+1 etc. and NUL-terminates them; after
    // preprocessing the terminator shows up as a ((void*)0) first field.
    const isReal = (v) => typeof v === 'string' && !/void\s*\*/.test(v);

    const races = racesRaw.filter(e => Array.isArray(e))
        .map(e => byFields(RACE_FIELDS, e)).filter(r => isReal(r.noun));
    const genders = gendersRaw.filter(e => Array.isArray(e))
        .map(e => byFields(GENDER_FIELDS, e)).filter(g => isReal(g.adj));
    const aligns = alignsRaw.filter(e => Array.isArray(e))
        .map(e => byFields(ALIGN_FIELDS, e)).filter(a => isReal(a.noun));


// src/attrib.c:23 — the `struct innate <name>_abil[]` tables: which intrinsic a
// role or race gains at which experience level. u_calc_moveamt()'s rn2(3) is
// gated on Fast, and a Samurai has HFast from experience level 1, so a port
// that does not know these tables silently skips a draw every turn for some
// roles and not others.
function innateTables() {
    const src = readFileSync(join(RECORDER, 'src/attrib.c'), 'utf8');
    const out = {};
    const tableRe = /(\w+_abil)\s*\[\]\s*=\s*\{([\s\S]*?)\{\s*0,\s*0,\s*0,\s*0\s*\}/g;
    let m;
    while ((m = tableRe.exec(src)) !== null) {
        const rows = [];
        const rowRe = /\{\s*(\d+)\s*,\s*&\(\s*(\w+)\s*\)/g;
        let r;
        while ((r = rowRe.exec(m[2])) !== null)
            rows.push([Number(r[1]), r[2]]);
        out[m[1]] = rows;
    }
    return out;
}

    const INNATE = innateTables();

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

// src/attrib.c:23 struct innate — [experience level, intrinsic] per role and
// race. Keys are the C table names (arc_abil, sam_abil, elf_abil, ...).
export const INNATE = ${JSON.stringify(INNATE, null, 1)};

// src/attrib.c role_abil() — the table for a role.
//
// Keyed by NAME, not by position: roles[] lists Rogue before Ranger, while the
// abil tables are alphabetical (ran_abil then rog_abil), so an index-based map
// silently swaps their intrinsics.
const ROLE_ABIL_BY_NAME = {
    Archeologist: 'arc_abil', Barbarian: 'bar_abil', Caveman: 'cav_abil',
    Healer: 'hea_abil', Knight: 'kni_abil', Monk: 'mon_abil',
    Priest: 'pri_abil', Ranger: 'ran_abil', Rogue: 'rog_abil',
    Samurai: 'sam_abil', Tourist: 'tou_abil', Valkyrie: 'val_abil',
    Wizard: 'wiz_abil',
};
export function role_abil(rolenum) {
    const nm = roles[rolenum]?.name?.m;
    return INNATE[ROLE_ABIL_BY_NAME[nm]] || [];
}

// src/attrib.c adjabil() — the race table; only elves and orcs have one.
export function race_abil(racenum) {
    const noun = races[racenum]?.noun;
    return INNATE[{ elf: 'elf_abil', orc: 'orc_abil' }[noun]] || [];
}

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
