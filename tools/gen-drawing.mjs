#!/usr/bin/env node
// gen-drawing.mjs — emit js/drawing_data.js from include/defsym.h
//
// src/drawing.c's def_monsyms[] and def_oc_syms[] are not literal tables: they
// are built by including defsym.h with a MONSYM/OBJCLASS macro defined to pick
// out the fields it wants. The data itself lives in defsym.h as
//
//     MONSYM( 1, 'a', ANT, S_ANT,   "ant or other insect")
//     OBJCLASS( 2,  ')', WEAPON, S_weapon, "weapons", "weapon")
//
// newsym() needs the CHARACTER for a monster's class and an object's class, and
// getting one wrong shows the wrong glyph on every frame that monster or object
// appears on. Five separate bugs in this port came from tables typed by hand
// (oc_prob, the G_ flags, SPBOOK_no_NOVEL, MR_POISON, M3_ZOMBIFIER), so this one
// is scraped.
//
// Usage: node tools/gen-drawing.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'nethack-c/upstream/include/defsym.h');
const OUT = join(ROOT, 'js/drawing_data.js');

const src = readFileSync(SRC, 'utf8');

/* include/color.h values used by defsym.h. Keep the aliases here because
   generated drawing data is consumed without importing terminal.js. */
const COLORS = {
    CLR_BLACK: 0, CLR_RED: 1, CLR_GREEN: 2, CLR_BROWN: 3,
    CLR_BLUE: 4, CLR_MAGENTA: 5, CLR_CYAN: 6, CLR_GRAY: 7,
    NO_COLOR: 8, CLR_ORANGE: 9, CLR_BRIGHT_GREEN: 10, CLR_YELLOW: 11,
    CLR_BRIGHT_BLUE: 12, CLR_BRIGHT_MAGENTA: 13,
    CLR_BRIGHT_CYAN: 14, CLR_WHITE: 15,
    HI_METAL: 6, HI_GOLD: 11, HI_WOOD: 3, HI_ZAP: 12,
};

/* A C character literal: 'a', ']', '\\' or '\''. */
const CH = String.raw`'(\\.|[^'\\])'`;

function scrape(re) {
    const out = [];
    let m;
    while ((m = re.exec(src)) !== null) {
        const idx = Number(m[1]);
        let ch = m[2].slice(1, -1);
        if (ch.startsWith('\\')) ch = ({ '\\\\': '\\', "\\'": "'" })[ch] ?? ch[1];
        out.push({ idx, ch, basename: m[3], sym: m[4] });
    }
    return out;
}

/* Only the indented invocations carry data; the #define lines above them name
   the same macro with its parameter list and must not be matched.
   Coins use OBJCLASS2, which carries an extra field (GOLD_SYM) between the
   basename and the symbol name — matching only OBJCLASS() silently left index
   12 empty and drew gold as '?'. */
const monsyms = scrape(
    new RegExp(String.raw`^\s+MONSYM\(\s*(\d+),\s*(${CH}),\s*(\w+),\s*(\w+)`, 'gm'));

/* the MONSYM explanation strings ("human or elf"), for farlook */
const monexplain = [];
{
    const re = new RegExp(
        String.raw`^\s+MONSYM\(\s*(\d+),\s*${CH},\s*\w+,\s*\w+,\s*"([^"]*)"`, 'gm');
    let m;
    while ((m = re.exec(src)) !== null)
        monexplain[Number(m[1])] = m[m.length - 1];
}
const oclasses = [
    ...scrape(new RegExp(
        String.raw`^\s+OBJCLASS\(\s*(\d+),\s*(${CH}),\s*(\w+),\s*(\w+)`, 'gm')),
    ...scrape(new RegExp(
        String.raw`^\s+OBJCLASS2\(\s*(\d+),\s*(${CH}),\s*(\w+),\s*\w+,\s*(\w+)`, 'gm')),
].sort((a, b) => a.idx - b.idx);

/* OBJCLASS names ("weapons") and explanations ("weapon"), indexed by the C
   class number. The quoted fields may sit on a wrapped line. */
const oc_names = [];
const oc_explain = [];
{
    const joined = src.replace(/,\s*\n\s+/g, ', ');
    const re2 = new RegExp(
        String.raw`OBJCLASS2?\(\s*(\d+),\s*${CH},\s*\w+,(?:\s*\w+,)?\s*S_\w+,\s*"([^"]*)",\s*"([^"]*)"\s*\)`, 'g');
    let m;
    while ((m = re2.exec(joined)) !== null) {
        oc_names[Number(m[1])] = m[m.length - 2];
        oc_explain[Number(m[1])] = m[m.length - 1];
    }
}

/* include/defsym.h PCHAR/PCHAR2: cmap index, default ASCII symbol,
   explanation ("staircase up"), and color. PCHAR2's explanation is its fifth
   argument (the fourth is the tile name); PCHAR's is its fourth. Wrapped
   invocations are joined first. */
const defsyms = [];
{
    const joined = src.replace(/,\s*\n\s+/g, ', ');
    const re = new RegExp(
        String.raw`PCHAR(2?)\(\s*(\d+),\s*(${CH}),\s*(S_\w+),\s*"([^"]*)"(?:,\s*"([^"]*)")?,\s*(\w+)\s*\)`, 'g');
    let m;
    while ((m = re.exec(joined)) !== null) {
        const two = m[1] === '2';
        const idx = Number(m[2]);
        let ch = m[3].slice(1, -1);
        if (ch.startsWith('\\')) ch = ({ '\\\\': '\\', "\\'": "'" })[ch] ?? ch[1];
        const name = m[5];
        const explain = two ? (m[7] ?? '') : m[6];
        const color = COLORS[m[8]];
        if (color === undefined)
            throw new Error(`unknown defsym color ${m[8]}`);
        /* sym: defsym.h's default ASCII character (what a user types to ask
           about a feature); ch/dec: the DECgraphics showsym actually drawn */
        defsyms[idx] = { name, sym: ch, ch, dec: false, explain, color };
    }
}

/* dat/symbols "start: DECgraphics" — the symset the reference build runs
   with. Each override is a meta byte \xNN; the terminal renders it as the
   DEC special-graphics character (byte & 0x7f) with the graphics charset
   shifted in, which this port models as { ch, dec: true }. */
{
    const symsrc = readFileSync(join(ROOT, 'nethack-c/upstream/dat/symbols'), 'utf8');
    const start = symsrc.indexOf('start: DECgraphics');
    const end = symsrc.indexOf('\nfinish', start);
    if (start < 0 || end < 0)
        throw new Error('DECgraphics block not found in dat/symbols');
    const block = symsrc.slice(start, end);
    const re = /^\s*(S_\w+):\s*\\x([0-9a-fA-F]{2})/gm;
    let m;
    while ((m = re.exec(block)) !== null) {
        const name = m[1];
        const byte = parseInt(m[2], 16);
        const d = defsyms.find(e => e && e.name === name);
        if (!d) continue;
        d.ch = String.fromCharCode(byte & 0x7f);
        d.dec = true;
    }
}

if (!monsyms.length || !oclasses.length) {
    console.error('scrape found nothing — defsym.h layout changed');
    process.exit(2);
}

const table = (rows) => {
    const max = Math.max(...rows.map(r => r.idx));
    const arr = new Array(max + 1).fill('');
    for (const r of rows) arr[r.idx] = r.ch;
    return arr;
};

const body = `// drawing_data.js — GENERATED by tools/gen-drawing.mjs. Do not edit.
// Source: include/defsym.h, the MONSYM() and OBJCLASS() invocations that
// src/drawing.c expands into def_monsyms[] and def_oc_syms[].
//
// Indexed by class number, so def_monsyms[mlet] and def_oc_syms[oclass] give
// the character newsym() should show. Index 0 is the "random class" placeholder
// in both and is deliberately empty.

// ${monsyms.length} monster classes
export const def_monsyms = ${JSON.stringify(table(monsyms))};

// ${oclasses.length} object classes
export const def_oc_syms = ${JSON.stringify(table(oclasses))};

// symbol name -> class index, for reading SYMBOLS= lines from an rc
export const monsym_names = ${JSON.stringify(
    Object.fromEntries(monsyms.map(r => [r.sym, r.idx])), null, 1)};

export const oclass_names = ${JSON.stringify(
    Object.fromEntries(oclasses.map(r => [r.sym, r.idx])), null, 1)};

// MONSYM explanation strings, indexed like def_monsyms ("human or elf");
// src/pager.c do_screen_description reads these for farlook
export const monexplain = ${JSON.stringify(monexplain)};

// OBJCLASS explanation strings, indexed like def_oc_syms ("weapon")
export const oc_explain = ${JSON.stringify(oc_explain)};

// OBJCLASS names, indexed like def_oc_syms ("weapons")
export const oc_names = ${JSON.stringify(oc_names)};

// include/defsym.h PCHAR entries with dat/symbols DECgraphics overrides
// applied: the displayed { ch, dec } pair, explanation, and pinned C color
// for each cmap index. This is gs.showsyms[] plus the relevant defsyms[]
// fields for the symset the reference build records with.
export const defsyms = ${JSON.stringify(defsyms)};

// S_* name -> cmap index
export const cmap_names = ${JSON.stringify(
    Object.fromEntries(defsyms.map((e, i) => [e.name, i])))};
`;

writeFileSync(OUT, body);
console.log(`wrote ${OUT}: ${monsyms.length} monster classes, `
            + `${oclasses.length} object classes`);
