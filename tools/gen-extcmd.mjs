// gen-extcmd.mjs — scrape src/cmd.c's extcmdlist[] into js/extcmd_data.js.
//
// The table drives two things a session depends on: which names #-completion
// will expand a prefix to, and which names an exact match accepts. Both are
// filtered by the AUTOCOMPLETE flag, so the flags have to come across too, not
// just the names.
//
//     src/cmd.c:1667  struct ext_func_tab extcmdlist[] = {
//         { '#', "#", "enter and perform an extended command",
//           doextcmd, IFBURIED | GENERALCMD | CMD_M_PREFIX, NULL },
//
// Entries span a variable number of lines, so this splits the initialiser on
// top-level braces rather than trying to match line by line.

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'nethack-c/upstream/src/cmd.c'), 'utf8');

// include/defsym.h — the OBJCLASS expansions define basename##_SYM = ch
// (WEAPON_SYM ')' ...); OBJCLASS2 carries an explicit sname (GOLD_SYM).
// Some extcmdlist entries use these as their default key.
const CLASS_SYMS = {};
{
    const dsh = readFileSync(join(ROOT, 'nethack-c/upstream/include/defsym.h'), 'utf8');
    const CH2 = String.raw`'(\\.|[^'\\])'`;
    for (const m of dsh.matchAll(new RegExp(
            String.raw`^\s+OBJCLASS\(\s*\d+,\s*(${CH2}),\s*(\w+)`, 'gm'))) {
        let ch = m[1].slice(1, -1);
        if (ch.startsWith('\\')) ch = ({ "\\'": "'", '\\\\': '\\' })[ch] ?? ch[1];
        CLASS_SYMS[`${m[3]}_SYM`] = ch;
    }
    for (const m of dsh.matchAll(new RegExp(
            String.raw`^\s+OBJCLASS2\(\s*\d+,\s*(${CH2}),\s*(\w+),\s*(\w+)`, 'gm'))) {
        let ch = m[1].slice(1, -1);
        if (ch.startsWith('\\')) ch = ({ "\\'": "'", '\\\\': '\\' })[ch] ?? ch[1];
        CLASS_SYMS[`${m[3]}_SYM`] = ch;
        CLASS_SYMS[m[4]] = ch;
    }
}

const start = src.indexOf('struct ext_func_tab extcmdlist[] = {');
if (start < 0) throw new Error('extcmdlist[] not found');
const open = src.indexOf('{', start + 'struct ext_func_tab extcmdlist[] ='.length);

// Walk to the matching close brace of the initialiser.
let depth = 0, end = open;
for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
}
const body = src.slice(open + 1, end);

// Split into top-level { ... } entries.
const entries = [];
depth = 0;
let cur = '';
for (const ch of body) {
    if (ch === '{') { depth++; if (depth === 1) { cur = ''; continue; } }
    if (ch === '}') { depth--; if (depth === 0) { entries.push(cur); continue; } }
    if (depth >= 1) cur += ch;
}

// include/func_tab.h flag bits, read from the header so they cannot drift.
const hdr = readFileSync(join(ROOT, 'nethack-c/upstream/include/func_tab.h'), 'utf8');
const FLAGS = {};
for (const m of hdr.matchAll(/^#define\s+([A-Z0-9_]+)\s+(0x[0-9a-fA-F]+|\d+)\s*(?:\/\*|$)/gm))
    FLAGS[m[1]] = Number(m[2]);

const out = [];
for (const eRaw of entries) {
    /* strip block comments first: the "down" entry's comment says the word
       MOVEMENTCMD, which the flag scrape below must not read as a flag */
    const e = eRaw.replace(/\/\*[\s\S]*?\*\//g, ' ');
    // ef_txt is the second field: a string literal after the key.
    const strs = [...e.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]);
    if (strs.length < 1) continue;
    const ef_txt = strs[0];

    // The first field is the default key binding, written as a character
    // literal, C('x') for a control key, M('x') for meta, or '\0' for none.
    // rhack() needs it to tell "bound but not ported yet" from "genuinely not
    // a command", which is the difference between silence and C's
    // "Unknown command '%s'." message.
    let key = 0;
    /* the key patterns below are all anchored, so match against the entry
       itself — slicing at the first comma broke on the ',' char literal
       ("pickup"'s default key) */
    const head = e;
    let km;
    if ((km = /^\s*C\('(.)'\)/.exec(head)))      key = km[1].charCodeAt(0) & 0x1f;
    else if ((km = /^\s*M\('(.)'\)/.exec(head))) key = 0x80 | km[1].charCodeAt(0);
    else if (/^\s*'\\\\'/.test(head))            key = 92;  /* '\\' backslash */
    else if ((km = /^\s*'\\([0-7]{1,3})'/.exec(head))) key = parseInt(km[1], 8);
    else if ((km = /^\s*'\\(.)'/.exec(head)))    key = { n: 10, r: 13, t: 9 }[km[1]] ?? 0;
    else if ((km = /^\s*'(.)'/.exec(head)))       key = km[1].charCodeAt(0);
    else if ((km = /^\s*([A-Z_]+_SYM)\b/.exec(head))) {
        /* include/objclass.h class display characters (AMULET_SYM '"', ...) */
        const sym = CLASS_SYMS[km[1]];
        if (sym === undefined)
            throw new Error(`extcmdlist: unknown symbol key ${km[1]}`);
        key = sym.charCodeAt(0);
    }

    // flags is the field after the function pointer; collect the ALL_CAPS
    // identifiers that name known bits.
    let flags = 0;
    /* the recorder is a UNIX build with SHELL and SUSPEND defined
       (include/unixconf.h), so an entry's "#ifndef SHELL | CMD_NOT_AVAILABLE
       #endif" block is not compiled in; drop such blocks before collecting
       flag names, and keep "#ifdef X" blocks only for defined X */
    const DEFINED = new Set(['SHELL', 'SUSPEND', 'UNIX', 'MAIL', 'MAIL_STRUCTURES']);
    const flagsrc = e
        .replace(/#ifndef\s+(\w+)[\s\S]*?#endif[^\n]*/g,
                 (m, name) => DEFINED.has(name) ? '' : m)
        .replace(/#ifdef\s+(\w+)[\s\S]*?#endif[^\n]*/g,
                 (m, name) => DEFINED.has(name) ? m : '');
    for (const m of flagsrc.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g))
        if (FLAGS[m[1]] !== undefined) flags |= FLAGS[m[1]];

    /* ef_desc is the third field, the human description dowhatdoes,
       dokeylist and doextlist print */
    const ef_desc = strs.length > 1 ? strs[1] : '';

    out.push({ ef_txt, ef_desc, key, flags });
}

const names = Object.keys(FLAGS).sort();
writeFileSync(join(ROOT, 'js/extcmd_data.js'),
`// GENERATED by tools/gen-extcmd.mjs from src/cmd.c extcmdlist[] — do not edit.
// C ref: src/cmd.c:1667, include/func_tab.h

export const EXTCMD_FLAGS = {
${names.map(n => `    ${n}: ${FLAGS[n]},`).join('\n')}
};

// src/cmd.c extcmdlist[] — ef_txt and flags, in table order. extcmds_match()
// walks this in order and returns the indices that matched.
export const extcmdlist = [
${out.map(e => `    { ef_txt: ${JSON.stringify(e.ef_txt)}, ef_desc: ${JSON.stringify(e.ef_desc)}, key: ${e.key}, flags: ${e.flags} },`).join('\n')}
];
`);
console.log(`wrote ${out.length} extended commands, ${names.length} flag bits`);
