#!/usr/bin/env node
// gen-artifacts.mjs — emit js/artilist_data.js from include/artilist.h.
//
// makedefs turns each A(...) entry in artilist.h into an ART_<TAG> constant
// numbered by its position in the list, 1-based:
//
//     A("Snickersnee", KATANA, SPFX_RESTR, ...,  SNICKERSNEE),
//         -> #define ART_SNICKERSNEE 21
//
// Those numbers exist only in a generated header the build produces, so they
// are not greppable in the source tree and are exactly the kind of thing that
// gets hand-counted wrong. Counting them here means a reordered or inserted
// artifact in 5.1 renumbers everything without an edit.
//
// Usage: node tools/gen-artifacts.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'nethack-c/upstream/include/artilist.h');
const OUT = join(ROOT, 'js/artilist_data.js');

function stripIfZeroBlocks(text) {
    const kept = [];
    let depth = 0;
    for (const line of text.split('\n')) {
        if (/^\s*#\s*if\s+0(?:\s|$)/.test(line)) {
            depth = 1;
            continue;
        }
        if (depth > 0) {
            if (/^\s*#\s*(?:if|ifdef|ifndef)\b/.test(line)) depth++;
            else if (/^\s*#\s*endif\b/.test(line)) depth--;
            continue;
        }
        kept.push(line);
    }
    return kept.join('\n');
}

// Match the active C list. In particular, artilist.h retains the obsolete
// Palantir inside a #if 0 block, so scraping the raw file shifts every later
// artifact number away from C's enum artifacts_nums.
const src = stripIfZeroBlocks(readFileSync(SRC, 'utf8'));

/* SPFX_* values scraped from include/artifact.h */
const artifactH = readFileSync(join(ROOT, 'nethack-c/upstream/include/artifact.h'), 'utf8');
const spfxTable = [...artifactH.matchAll(/#define (SPFX_\w+)\s+0x([0-9A-Fa-f]+)L?/g)]
    .map(m => [m[1], parseInt(m[2], 16)]);
const SPFX = Object.fromEntries(spfxTable);
const spfxval = (expr) => expr.split('|')
    .map(t => t.replace(/[()\s]/g, '').replace(/(\d)L$/, '$1'))
    .reduce((a, t) => a | (SPFX[t] ?? (Number(t) || 0)), 0);

/* An A() entry is matched by balancing parens, not by a lazy regex: the fields
   contain their own calls — PHYS(0, 8), DFNS(AD_BLND) — so "first \w+ before a
   close paren" lands inside one of those and yields a number instead of the tag.
   The tag is the last top-level field. */
const names = [];
const tags = [];
const otyps = [];
const spfxs = [], mtypes = [], attks = [], defns = [], carys = [],
      invProps = [], aligns = [], roles = [], races = [], genSpes = [],
      giftValues = [];
for (let i = src.indexOf('A("'); i !== -1; i = src.indexOf('A("', i + 1)) {
    /* Skip A( appearing inside a longer identifier, e.g. NO_CARY. */
    if (/\w/.test(src[i - 1] || '')) continue;

    let depth = 0, end = -1;
    for (let j = i + 1; j < src.length; j++) {
        if (src[j] === '(') depth++;
        else if (src[j] === ')' && --depth === 0) { end = j; break; }
    }
    if (end === -1) break;

    const body = src.slice(i + 2, end);
    names.push(body.match(/^\s*"((?:[^"\\]|\\.)*)"/)[1]);

    /* Split on top-level commas only, then take the final field. */
    let d = 0, last = 0;
    const fields = [];
    for (let j = 0; j < body.length; j++) {
        if (body[j] === '(') d++;
        else if (body[j] === ')') d--;
        else if (body[j] === ',' && d === 0) { fields.push(body.slice(last, j)); last = j + 1; }
    }
    fields.push(body.slice(last));
    tags.push(fields[fields.length - 1].trim());
    /* The second field is the base object type macro (WAR_HAMMER, ...),
       possibly with a trailing comment. artifact_name(objnam.c wishes)
       resolves it through ONAMES at load time. */
    otyps.push(fields[1].replace(/\/\*[^]*?\*\//g, '').trim());

    /* A(nam, typ, s1, s2, mt, atk, dfn, cry, inv, al, cl, rac, gs, gv,
       cost, clr, bn) — fields after the name, 0-based: 0=typ 1=spfx
       2=cspfx 3=mtype 4=attk 5=defn 6=cary 7=inv_prop 8=alignment 9=role
       10=race, 11=gen_spe, 12=gift_value. */
    const clean = (s) => s.replace(/\/\*[^]*?\*\//g, '').replace(/\s+/g, ' ').trim();
    spfxs.push(clean(fields[2] ?? '0'));
    mtypes.push(clean(fields[4] ?? '0'));
    attks.push(clean(fields[5] ?? 'NO_ATTK'));
    defns.push(clean(fields[6] ?? 'NO_DFNS'));
    carys.push(clean(fields[7] ?? 'NO_CARY'));
    invProps.push(clean(fields[8] ?? '0'));
    aligns.push(clean(fields[9] ?? 'A_NONE'));
    roles.push(clean(fields[10] ?? 'NON_PM'));
    races.push(clean(fields[11] ?? 'NON_PM'));
    genSpes.push(Number(clean(fields[12] ?? '0')) || 0);
    giftValues.push(Number(clean(fields[13] ?? '0')) || 0);
}

if (names.length < 20) {
    console.error(`scrape found ${names.length} artifacts — artilist.h layout changed`);
    process.exit(2);
}

/* makedefs.c:2336 numbers these by array index starting at 1, and index 0 is
   the A("") dummy that makes oartifact==0 mean "not an artifact". Numbering
   from the dummy instead shifts every constant by one. */
/* Entry 0 IS emitted, as ART_NONARTIFACT. The A() macro's ARTI_ENUM form
   expands to ART_##bn for every entry including the dummy, whose bn tag is
   NONARTIFACT, and src/artifact.c uses it -- `oart != &artilist[
   ART_NONARTIFACT]` in bane_applies and retouch_object. Skipping it left
   those consumers with nothing to compare against. */
const consts = tags
    .map((t, i) => `export const ART_${t} = ${i};`)
    .join('\n');

writeFileSync(OUT, `// artilist_data.js — GENERATED by tools/gen-artifacts.mjs. Do not edit.
// Source: include/artilist.h, the A() entries makedefs numbers into ART_*.
//
// Index is positional and matches obj->oartifact. Index 0 is artilist.h's
// A("") dummy, which is why oartifact==0 means "not an artifact" and is_art()
// on an ordinary object is always false.

${consts}

// Names in list order including the empty dummy at 0, so this indexes directly
// by oartifact the way C's artifact_names[] does.
export const artifact_names = ${JSON.stringify(names, null, 1)};

// Base object type of each artifact (artilist.h's second A() field), as the
// ONAMES key. Index 0 is the dummy's STRANGE_OBJECT, which is how
// \`for (a = artilist + 1; a->otyp; a++)\` loops know where the list ends.
export const artifact_otyps = ${JSON.stringify(otyps, null, 1)};

// Per-artifact records used by generation, touch checks, and combat.
export const artifact_records = ${JSON.stringify(names.map((n, i) => ({
    spfx: spfxval(spfxs[i] ?? '0'),
    mtype: mtypes[i],
    attk: attks[i],
    defn: defns[i],
    cary: carys[i],
    inv_prop: invProps[i] === '0' ? 0 : invProps[i],
    align: aligns[i],
    role: roles[i],
    race: races[i],
    gen_spe: genSpes[i],
    gift_value: giftValues[i],
})), null, 1)};
`);

console.log(`wrote ${OUT}: ${names.length} artifacts`);
