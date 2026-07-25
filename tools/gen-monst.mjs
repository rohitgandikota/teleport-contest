#!/usr/bin/env node
// gen-monst.mjs — Generate js/monst_data.js from the NetHack monster table.
//
// Same technique as tools/gen-objects.mjs: include/monsters.h declares every
// monster through MON()/MON3() macros, so we let the C preprocessor expand them
// and parse the result rather than reimplementing the macros. The compiler is
// the ground truth for what the binary contains.
//
// Requires the recorder tree — run bash nethack-c/build-recorder.sh first.
//
// Usage: node tools/gen-monst.mjs [--stdout]

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const RECORDER = join(PROJECT_ROOT, 'nethack-c/recorder');
const OUT = join(PROJECT_ROOT, 'js/monst_data.js');

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
        join(RECORDER, 'src/monst.c'),
    ], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
    return out.split('\n').filter(l => !/^#\s*\d+\s+"/.test(l)).join('\n');
}

// Object-like `#define NAME <constant-expression>` from a header, for the flag
// families the preprocessor eats before we ever see them (M1_/M2_/M3_ in
// monflag.h, AT_/AD_ in monattk.h). Values are evaluated, not copied as text,
// so `0x80000000UL` and `(-1)` both come out as numbers.
function defines(headerRelPath, prefixes) {
    const text = readFileSync(join(RECORDER, headerRelPath), 'utf8');
    const out = {};
    const re = /^[ \t]*#[ \t]*define[ \t]+([A-Za-z_][A-Za-z0-9_]*)[ \t]+(.+)$/gm;
    let m;
    while ((m = re.exec(text)) !== null) {
        const [, name, rhsRaw] = m;
        if (!prefixes.some(p => name.startsWith(p))) continue;
        const rhs = rhsRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/, '').trim();
        const expr = rhs.replace(/\b(0[xX][0-9a-fA-F]+|\d+)[UL]+\b/g, '$1');
        if (!/^[-+*/|&^()~<>\s0-9a-fA-FxX]+$/.test(expr) || !/\d/.test(expr)) continue;
        try {
            // eslint-disable-next-line no-new-func
            const v = Function(`"use strict"; return (${expr});`)();
            if (Number.isFinite(v)) out[name] = v;
        } catch { /* not a plain constant; skip */ }
    }
    return out;
}

// A `static const short NAME[][2] = { {A, B}, ... };` table of PM_ identifiers,
// read from the unpreprocessed source and resolved through the monnums enum.
// Terminates at the first pair whose first element is below LOW_PM (the C loops
// use `grownups[i][0] >= LOW_PM` as their sentinel).
function shortPairs(srcRelPath, name, monnums) {
    const text = readFileSync(join(RECORDER, srcRelPath), 'utf8');
    const m = new RegExp(`${name}\\s*\\[\\s*\\]\\s*\\[\\s*2\\s*\\]\\s*=\\s*\\{`).exec(text);
    if (!m) throw new Error(`table ${name} not found in ${srcRelPath}`);
    const body = text.slice(m.index + m[0].length, text.indexOf('};', m.index));
    const out = [];
    for (const pair of body.matchAll(/\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}/g)) {
        const a = monnums[pair[1]], b = monnums[pair[2]];
        if (a === undefined || b === undefined) break;   /* NON_PM sentinel */
        out.push([a, b]);
    }
    return out;
}

// Field names from the *preprocessed* struct, so config-dependent members match
// the built binary. Handles "schar a, b, c;" and "const char *x[N];".
function structFields(text, name) {
    const m = new RegExp(`struct\\s+${name}\\s*\\{`).exec(text);
    if (!m) throw new Error(`struct ${name} not found`);
    const body = text.slice(m.index + m[0].length, text.indexOf('};', m.index));

    const fields = [];
    for (let decl of body.split(';')) {
        decl = decl.replace(/\s+/g, ' ').trim();
        if (!decl) continue;
        const noBits = decl.replace(/\s*:\s*\d+\s*$/, '');
        noBits.split(',').map(s => s.trim()).forEach((part, i) => {
            const cleaned = part.replace(/\[[^\]]*\]/g, '').replace(/[*]/g, ' ').trim();
            const tok = cleaned.split(/\s+/);
            const nm = tok[tok.length - 1];
            if (i === 0 && tok.length < 2) return; // a bare type with no name
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(nm)) fields.push(nm);
        });
    }
    return fields;
}

// Parse a brace-nested initialiser into nested arrays; leaves are expression
// text. Monster entries nest: pmnames[3] and mattk[6] of {4}.
function parseInitializer(text, start) {
    let i = start;
    function list() {
        const items = [];
        let cur = '';
        i++; // '{'
        while (i < text.length) {
            const c = text[i];
            if (c === '{') { items.push(list()); cur = ''; continue; }
            if (c === '}') {
                i++;
                if (cur.trim()) items.push(cur.trim());
                return items;
            }
            if (c === ',') {
                if (cur.trim()) items.push(cur.trim());
                cur = ''; i++; continue;
            }
            if (c === '"') {
                let s = c; i++;
                while (i < text.length) {
                    if (text[i] === '\\') { s += text[i] + text[i + 1]; i += 2; continue; }
                    s += text[i];
                    if (text[i] === '"') { i++; break; }
                    i++;
                }
                cur += s; continue;
            }
            cur += c; i++;
        }
        throw new Error('unterminated initialiser');
    }
    return list();
}

function leaf(v) {
    if (Array.isArray(v)) return v.map(leaf);
    const t = String(v).replace(/\s+/g, ' ').trim();
    if (t === '') return null;
    if (/^\(const char \*\)\s*0$/.test(t) || t === 'NULL') return null;

    if (/^"/.test(t)) { // adjacent string literals concatenate in C
        const parts = [...t.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]);
        if (parts.length && t.replace(/"(?:[^"\\]|\\.)*"/g, '').trim() === '')
            return parts.join('').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    if (/^-?\d+$/.test(t)) return Number(t);

    // Numeric flag expressions the preprocessor already reduced:
    // "0x00040000L | 0x00002000L", "(0x0020 | 0x0080 | 3)"
    const numeric = t.replace(/([0-9a-fA-FxX]+)[UL]+\b/g, '$1');
    if (/^[-+*/|&^()~\s0-9a-fA-FxX]+$/.test(numeric) && /\d/.test(numeric)
        && !/\b[g-wyzG-WYZ]\w*/.test(numeric)) {
        try {
            // eslint-disable-next-line no-new-func
            const n = Function(`"use strict"; return (${numeric});`)();
            if (Number.isFinite(n)) return n;
        } catch { /* keep the text */ }
    }
    return t; // an enum identifier (S_ANT, MS_SILENT, PM_GIANT_ANT)
}

// Every enum in the preprocessed text, flattened to name → value.
//
// Needed because leaf() deliberately leaves unresolved identifiers as strings
// (S_ANT, MS_SILENT, PM_GIANT_ANT). If those reach monst_data.js as strings,
// every numeric comparison against them silently fails — `ptr.mlet === S_NYMPH`
// is false forever and the makemon() mlet switch never fires. The same defect
// hid mkobj_erosions for a while via oc_material === "IRON"; see docs/plan/NOTES.md.
function collectEnums(text) {
    const values = {};
    const re = /enum\s+(?:[A-Za-z_][A-Za-z0-9_]*\s*)?\{/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const end = text.indexOf('};', m.index);
        if (end < 0) continue;
        const body = text.slice(m.index + m[0].length, end);
        let next = 0;
        for (let item of body.split(',')) {
            item = item.replace(/\s+/g, ' ').trim();
            if (!item) continue;
            const eq = item.indexOf('=');
            if (eq < 0) {
                if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(item) && !(item in values))
                    values[item] = next;
                next++;
                continue;
            }
            const nm = item.slice(0, eq).trim();
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nm)) continue;
            const expr = item.slice(eq + 1).trim().replace(
                /[A-Za-z_][A-Za-z0-9_]*/g,
                id => (Object.prototype.hasOwnProperty.call(values, id) ? values[id] : id));
            if (!/^[-+*/()\d\s]+$/.test(expr)) continue;
            // eslint-disable-next-line no-new-func
            const v = Function(`"use strict"; return (${expr});`)();
            if (!(nm in values)) values[nm] = v;
            next = v + 1;
        }
    }
    return values;
}

// enum monnums { ... } → { PM_GIANT_ANT: 0, ... }
function extractEnum(text, name) {
    const m = new RegExp(`enum\\s+${name}\\s*\\{`).exec(text);
    if (!m) throw new Error(`enum ${name} not found`);
    const body = text.slice(m.index + m[0].length, text.indexOf('};', m.index));
    const values = {};
    let next = 0;
    for (let item of body.split(',')) {
        item = item.replace(/\s+/g, ' ').trim();
        if (!item) continue;
        const eq = item.indexOf('=');
        if (eq < 0) {
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(item)) values[item] = next++;
            continue;
        }
        const nm = item.slice(0, eq).trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nm)) continue;
        const expr = item.slice(eq + 1).trim().replace(/[A-Za-z_][A-Za-z0-9_]*/g,
            id => (Object.prototype.hasOwnProperty.call(values, id) ? values[id] : id));
        if (!/^[-+*/()\d\s]+$/.test(expr)) continue;
        // eslint-disable-next-line no-new-func
        const v = Function(`"use strict"; return (${expr});`)();
        values[nm] = v;
        next = v + 1;
    }
    return values;
}

function topLevelEntries(text, arrayName) {
    const m = new RegExp(`${arrayName}\\s*\\[[^\\]]*\\]\\s*=\\s*\\{`).exec(text);
    if (!m) throw new Error(`array ${arrayName} not found`);
    let i = text.indexOf('{', m.index + m[0].length - 1);
    // step into the outer array brace, then read each entry
    const outer = parseInitializer(text, i);
    return outer;
}

function main() {
    const text = preprocess();

    const fields = structFields(text, 'permonst');
    const monnums = extractEnum(text, 'monnums');
    const ENUMS = collectEnums(text);
    const entries = topLevelEntries(text, 'mons_init');

    /* resolve enum identifiers (S_ANT, MS_SILENT, PM_GIANT_ANT) to numbers,
       at any depth — mattk[] entries carry AT_/AD_ symbols too */
    const resolve = (v) => {
        if (Array.isArray(v)) return v.map(resolve);
        if (typeof v === 'string'
            && Object.prototype.hasOwnProperty.call(ENUMS, v))
            return ENUMS[v];
        return v;
    };

    const mons = entries
        .filter(e => Array.isArray(e))
        .map(e => {
            const m = {};
            fields.forEach((f, i) => {
                m[f] = e[i] === undefined ? null : resolve(leaf(e[i]));
            });
            return m;
        })
        // The table is NUMMONS+1 with a zeroed terminator. Its pmnames are
        // present but empty, so test for a NON-EMPTY name — testing only for
        // `typeof n === 'string'` let the terminator through and made NUMMONS
        // one too large.
        .filter(m => Array.isArray(m.pmnames)
                  && m.pmnames.some(n => typeof n === 'string' && n.length > 0));

    /* The symbol/sound/attack enums, exported so ported C can compare against
       named constants instead of literals. Hardcoding a numeric otyp/mlet is
       how BOULDER became "worthless piece of orange glass"; see CLAUDE.md. */
    const pick = (prefix) => Object.fromEntries(
        Object.entries(ENUMS).filter(([k]) => k.startsWith(prefix)));
    const MONSYMS = pick('S_');
    const MSOUND = pick('MS_');
    const ATTKS = defines('include/monattk.h', ['AT_', 'AD_']);
        /* MR_ is the resistance family; dogfood()'s resists_poison() needs it,
       and it lives in the same header as the M1_/M2_/M3_ flags. */
const MFLAGS = defines('include/monflag.h', ['M1_', 'M2_', 'M3_', 'G_', 'MR_']);
    const MMFLAGS = defines('include/hack.h', ['MM_', 'NO_MM_FLAGS', 'NO_MINVENT']);
    /* MAXMCLASSES and A_NONE are enum/#define constants mkclass() needs but
       that no prefix filter above catches. */
    const LIMITS = {
        ...defines('include/global.h', ['MAXMONNO']),
        ...defines('include/align.h', ['A_NONE']),
        MAXMCLASSES: ENUMS.MAXMCLASSES,
        NUMMONS: ENUMS.NUMMONS,
    };
    const STRAT = defines('include/monst.h', ['STRAT_']);
    /* src/mondata.c:1228 grownups[][2] — baby form to adult form. Drives
       little_to_big()/big_to_little(), which can_be_hatched() and
       dead_species() both depend on. */
    const GROWNUPS = shortPairs('src/mondata.c', 'grownups', monnums);

    const out = `// monst_data.js — GENERATED by tools/gen-monst.mjs.
// Do not edit by hand; re-run the generator.
//
// Source: nethack-c/upstream/include/monsters.h, expanded by the C
// preprocessor via nethack-c/recorder/src/monst.c. Field names come from the
// preprocessed \`struct permonst\`, so config-dependent members match the built
// binary. Enum identifiers (S_ANT, MS_SILENT, AT_WEAP) are resolved to their
// numeric values — leaving them as strings silently breaks every comparison.
//
// pmnames is [male, female, neutral] — a null means "use the neutral form".
//
// ${mons.length} monsters.

export const mons = ${JSON.stringify(mons, null, 1)};

// enum monnums — PM_* index constants.
export const PMNAMES = ${JSON.stringify(monnums, null, 1)};

// include/monsym.h — S_* monster class symbols.
export const MONSYMS = ${JSON.stringify(MONSYMS, null, 1)};

// include/monflag.h — MS_* sounds.
export const MSOUND = ${JSON.stringify(MSOUND, null, 1)};

// include/monattk.h — AT_* attack types and AD_* damage types.
export const ATTKS = ${JSON.stringify(ATTKS, null, 1)};

// include/monflag.h — M1_/M2_/M3_ permonst flag bits and G_* generation bits.
export const MFLAGS = ${JSON.stringify(MFLAGS, null, 1)};

// include/hack.h — MM_* mmflags controlling makemon() behaviour.
export const MMFLAGS = ${JSON.stringify(MMFLAGS, null, 1)};

// include/global.h — MAXMONNO, the default per-species birth limit.
export const LIMITS = ${JSON.stringify(LIMITS, null, 1)};

// include/monst.h — STRAT_* monster strategy bits.
export const STRAT = ${JSON.stringify(STRAT, null, 1)};

// src/mondata.c:1228 grownups[][2] — [baby, adult] monster index pairs.
export const GROWNUPS = ${JSON.stringify(GROWNUPS)};

export const NUMMONS = ${mons.length};

// include/monst.h — pmnames indices
export const MALE = 0, FEMALE = 1, NEUTRAL = 2;

export function mons_name(pm) {
    return pm.pmnames[NEUTRAL] ?? pm.pmnames[MALE] ?? pm.pmnames[FEMALE];
}
`;

    if (process.argv.includes('--stdout')) process.stdout.write(out);
    else {
        writeFileSync(OUT, out);
        console.log(`wrote ${OUT}`);
        console.log(`${mons.length} monsters, ${fields.length} permonst fields, ${Object.keys(monnums).length} PM_ constants`);
        console.log('fields:', fields.join(', '));
    }
}

main();
