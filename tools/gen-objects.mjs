#!/usr/bin/env node
// gen-objects.mjs — Generate js/objects_data.js from the NetHack object tables.
//
// include/objects.h declares every object through one of ~28 class-specific
// macros (WEAPON, ARMOR, RING, POTION, ...), each expanding to a common
// OBJECT() with derived fields. Reimplementing 28 macro expansions by hand
// would be a large, silent-failure-prone transcription job, so instead we let
// the C preprocessor expand them and parse the result. The compiler is the
// ground truth for what the binary actually contains.
//
// Requires the recorder tree (nethack-c/recorder/), i.e. build-recorder.sh must
// have been run — same prerequisite as recording sessions.
//
// Usage: node tools/gen-objects.mjs [--stdout]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const RECORDER = join(PROJECT_ROOT, 'nethack-c/recorder');
const OUT = join(PROJECT_ROOT, 'js/objects_data.js');

function preprocess() {
    if (!existsSync(RECORDER)) {
        throw new Error(
            'nethack-c/recorder/ not found — run `bash nethack-c/build-recorder.sh` first');
    }
    return execFileSync('clang', [
        '-E',
        '-I', join(RECORDER, 'include'),
        '-I', join(RECORDER, 'src'),
        '-DNOTPARMDECL', '-DNO_TIMED_DELAY',
        join(RECORDER, 'src/objects.c'),
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

// Drop the preprocessor's "# 123 "file"" line markers and comments.
function clean(text) {
    return text
        .split('\n')
        .filter(l => !/^#\s*\d+\s+"/.test(l))
        .join('\n');
}

// Read the field names out of the *preprocessed* struct definition, so that
// config-dependent fields (#ifdef'd members) are picked up exactly as the
// binary has them rather than as the header source suggests.
function structFields(text, name) {
    const re = new RegExp(`struct\\s+${name}\\s*\\{`);
    const m = re.exec(text);
    if (!m) throw new Error(`struct ${name} not found`);
    const start = m.index + m[0].length;
    const end = text.indexOf('};', start);
    const body = text.slice(start, end);

    const fields = [];
    for (let decl of body.split(';')) {
        decl = decl.replace(/\s+/g, ' ').trim();
        if (!decl) continue;
        // "unsigned oc_dir : 3" / "schar oc_wsdam, oc_wldam" / "char *oc_uname"
        const noBits = decl.replace(/\s*:\s*\d+\s*$/, '');
        const parts = noBits.split(',').map(s => s.trim());
        parts.forEach((part, i) => {
            const tok = part.replace(/[*]/g, ' ').trim().split(/\s+/);
            const nm = tok[tok.length - 1];
            if (i === 0 && tok.length < 2) return; // a bare type, no name
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(nm)) fields.push(nm);
        });
    }
    return fields;
}

// Split a flat brace-delimited initialiser list into its top-level entries.
function topLevelEntries(text, arrayName) {
    const re = new RegExp(`${arrayName}\\s*\\[[^\\]]*\\]\\s*=\\s*\\{`);
    const m = re.exec(text);
    if (!m) throw new Error(`array ${arrayName} not found`);
    let i = m.index + m[0].length;
    const entries = [];
    let depth = 0, cur = '';
    while (i < text.length) {
        const c = text[i];
        if (c === '"') { // string literal
            let s = c; i++;
            while (i < text.length) {
                if (text[i] === '\\') { s += text[i] + text[i + 1]; i += 2; continue; }
                s += text[i];
                if (text[i] === '"') { i++; break; }
                i++;
            }
            cur += s;
            continue;
        }
        if (c === '{') { depth++; if (depth === 1) { cur = ''; i++; continue; } }
        else if (c === '}') {
            if (depth === 0) break; // closing the array itself
            depth--;
            if (depth === 0) { entries.push(cur); cur = ''; i++; continue; }
        }
        if (depth > 0) cur += c;
        i++;
    }
    return entries;
}

// Split one entry's text on top-level commas.
function splitFields(entry) {
    const out = [];
    let depth = 0, cur = '', i = 0;
    while (i < entry.length) {
        const c = entry[i];
        if (c === '"') {
            let s = c; i++;
            while (i < entry.length) {
                if (entry[i] === '\\') { s += entry[i] + entry[i + 1]; i += 2; continue; }
                s += entry[i];
                if (entry[i] === '"') { i++; break; }
                i++;
            }
            cur += s;
            continue;
        }
        if (c === '(') depth++;
        else if (c === ')') depth--;
        if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; i++; continue; }
        cur += c;
        i++;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

// Evaluate the small set of constant expressions the preprocessor leaves
// behind. Anything unrecognised is kept verbatim as a C identifier.
function value(tok) {
    const t = String(tok).replace(/\s+/g, ' ').trim();
    if (t === '' ) return null;

    // C concatenates adjacent string literals: `"generic " "ring"` is one
    // string. objects.h relies on this heavily, so join them rather than
    // emitting the source text.
    if (/^"/.test(t)) {
        const parts = [...t.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]);
        const rest = t.replace(/"(?:[^"\\]|\\.)*"/g, '').trim();
        if (parts.length && rest === '') {
            return parts.join('').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
    }
    if (/^\(char \*\)\s*0$/.test(t) || t === '0L' || t === 'NULL') return t === 'NULL' ? null : 0;
    if (/^-?\d+$/.test(t)) return Number(t);
    if (/^-?\d+[UL]+$/i.test(t)) return Number(t.replace(/[UL]+$/i, ''));
    // "(0UL-1UL)" — the ULONG_MAX sentinel used for unseen shop prices.
    const arith = /^\((\d+)UL\s*-\s*(\d+)UL\)$/i.exec(t);
    if (arith) return Number(arith[1]) - Number(arith[2]);
    if (/^\(\s*-?\d+\s*\)$/.test(t)) return Number(t.replace(/[()\s]/g, ''));
    return t; // an enum / macro identifier
}

// Extract `enum objects_nums { ... }` and evaluate it, giving every object
// index constant (STRANGE_OBJECT, HELMET, POT_WATER, WAN_NOTHING, LAST_REAL_GEM
// ...). In 5.0 these are an enum generated from objects.h's MARKER() macro
// rather than a checked-in onames.h, so the preprocessor is the only source.
function extractEnum(text, enumName) {
    const re = new RegExp(`enum\\s+${enumName}\\s*\\{`);
    const m = re.exec(text);
    if (!m) throw new Error(`enum ${enumName} not found`);
    const start = m.index + m[0].length;
    const end = text.indexOf('};', start);
    return evalEnumBody(text.slice(start, end));
}

function evalEnumBody(body) {
    const values = {};
    let next = 0;
    for (let item of body.split(',')) {
        item = item.replace(/\s+/g, ' ').trim();
        if (!item) continue;
        const eq = item.indexOf('=');
        if (eq < 0) {
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(item)) continue;
            values[item] = next++;
        } else {
            const name = item.slice(0, eq).trim();
            const expr = item.slice(eq + 1).trim();
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
            // Expressions only ever reference earlier enum members and integers.
            const resolved = expr.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (id) =>
                Object.prototype.hasOwnProperty.call(values, id) ? values[id] : id);
            if (!/^[-+*/()\d\s]+$/.test(resolved)) continue;
            // eslint-disable-next-line no-new-func
            const v = Function(`"use strict"; return (${resolved});`)();
            values[name] = v;
            next = v + 1;
        }
    }
    return values;
}

// Same as extractEnum but for an anonymous enum, located by a member name.
function extractEnumAt(text, memberName) {
    const idx = text.indexOf(memberName);
    if (idx < 0) throw new Error(`enum member ${memberName} not found`);
    const open = text.lastIndexOf('{', idx);
    const end = text.indexOf('};', open);
    return evalEnumBody(text.slice(open + 1, end));
}

function main() {
    const text = clean(preprocess());

    const objFields = structFields(text, 'objclass');
    const descrFields = structFields(text, 'objdescr');

    const onames = extractEnum(text, 'objects_nums');
    // The anonymous enum in objclass.h carrying WEAPON_CLASS .. MAXOCLASSES.
    const oclasses = extractEnumAt(text, 'ILLOBJ_CLASS');

    const objEntries = topLevelEntries(text, 'obj_init');
    const descrEntries = topLevelEntries(text, 'obj_descr_init');

    const objects = objEntries.map((e) => {
        const vals = splitFields(e);
        const o = {};
        objFields.forEach((f, i) => { o[f] = value(vals[i]); });
        return o;
    });

    const descrs = descrEntries.map((e) => {
        const vals = splitFields(e);
        const d = {};
        descrFields.forEach((f, i) => { d[f] = value(vals[i]); });
        return d;
    });

    if (objects.length !== descrs.length) {
        throw new Error(`table length mismatch: obj_init ${objects.length}, obj_descr_init ${descrs.length}`);
    }

    const out = `// objects_data.js — GENERATED by tools/gen-objects.mjs.
// Do not edit by hand; re-run the generator.
//
// Source: nethack-c/upstream/include/objects.h, expanded by the C preprocessor
// via nethack-c/recorder/src/objects.c. The header declares objects through ~28
// class-specific macros (WEAPON, ARMOR, RING, ...) that all expand to a common
// OBJECT(); rather than reimplement those expansions we run clang -E and parse
// the result, so this table is what the binary actually contains.
//
// Field names come from the preprocessed \`struct objclass\` and
// \`struct objdescr\`, so config-dependent members match the built binary.
//
// ${objects.length} entries (NUM_OBJECTS + 1, the last being the terminator).
// Unresolved leaves are kept as C identifiers (LIQUID, VENOM_CLASS, P_NONE);
// resolving them belongs to js/const.js.

export const objects = ${JSON.stringify(objects, null, 1)};

export const obj_descr = ${JSON.stringify(descrs, null, 1)};

export const NUM_OBJECTS = ${objects.length - 1};

// enum objects_nums — object index constants. In 5.0 these are generated from
// objects.h's MARKER() macro rather than a checked-in onames.h.
export const ONAMES = ${JSON.stringify(onames, null, 1)};

// Object class constants from include/objclass.h (WEAPON_CLASS .. MAXOCLASSES).
export const OCLASSES = ${JSON.stringify(oclasses, null, 1)};
`;

    if (process.argv.includes('--stdout')) process.stdout.write(out);
    else {
        writeFileSync(OUT, out);
        console.log(`wrote ${OUT}`);
        console.log(`${objects.length} entries, ${objFields.length} objclass fields, ${descrFields.length} objdescr fields`);
        console.log('objclass fields:', objFields.join(', '));
        const byClass = objects.reduce((a, o) => { a[o.oc_class] = (a[o.oc_class] || 0) + 1; return a; }, {});
        console.log(`${Object.keys(onames).length} object index constants`);
        console.log("by class:", Object.entries(byClass).map(([k, v]) => `${k}=${v}`).join(' '));
    }
}

main();
