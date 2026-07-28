#!/usr/bin/env node
// gen-optlist.mjs — Generate js/optlist.js from include/optlist.h.
//
// NetHack declares its 238 options once, as a list of NHOPTB/NHOPTC/NHOPTP/
// NHOPTO macro invocations in include/optlist.h, and expands that list several
// ways (prototypes, an enum, the parse table). We generate the JS table from
// the same source so that a 5.1 option change is absorbed by re-running this
// script rather than by hand-editing JS — see docs/plan/00-strategy.md, D2.
//
// Field order comes from the NHOPT_PARSE expansions at optlist.h:75-86.
//
//   NHOPTB(a, sec, b, c, s, i, n, v, d, al, bp, termp, desc)
//   NHOPTC(a, sec, b, c, s,    n, v, d, h, al, z)
//   NHOPTP(a, sec, b, c, s,    n, v, d, h, al, z)
//   NHOPTO(m, sec, a, b, c, s, n, v, d, al, z)
//
// Usage: node tools/gen-optlist.mjs [--stdout]

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(PROJECT_ROOT, 'nethack-c/upstream/include/optlist.h');
const OUT = join(PROJECT_ROOT, 'js/optlist.js');

// Split a macro argument list on top-level commas, respecting nested parens,
// brackets, and string/char literals.
function splitArgs(s) {
    const out = [];
    let depth = 0, cur = '', i = 0;
    while (i < s.length) {
        const c = s[i];
        if (c === '"' || c === "'") {
            const quote = c;
            cur += c; i++;
            while (i < s.length) {
                if (s[i] === '\\') { cur += s[i] + (s[i + 1] ?? ''); i += 2; continue; }
                cur += s[i];
                if (s[i] === quote) { i++; break; }
                i++;
            }
            continue;
        }
        if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth--;
        if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; i++; continue; }
        cur += c; i++;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

// The reference recorder build's preprocessor state (macOS unix tty). The
// About window's compiled-options list is the evidence for most of these:
// insurance files, mail daemon, news file, restore via menu, status via
// windowport with highlighting, stack trace + browser reporting. Options in
// #ifdef blocks outside this set do not exist in the C's allopt[] and must
// not exist here — the '?g' option_help window shows the table verbatim.
const DEFINES = new Set([
    'OPTLIST_H', 'NHOPT_PARSE',
    'UNIX', 'TTY_GRAPHICS', 'ALTMETA', 'INSURANCE', 'MAIL', 'NEWS',
    'SELECTSAVED', 'STATUS_HILITES', 'CRASHREPORT', 'PREV_MSGS',
    'SND_LIB_INTEGRATED', 'BACKWARD_COMPAT',
]);

// Strip the #if/#else/#endif branches the reference build does not compile.
// Handles the directive forms optlist.h actually uses: #ifdef X, #ifndef X,
// #if 0, #if <expr> with defined()/!defined()/||/&&, #else, #endif.
function preprocess(text) {
    const evalExpr = (expr) => {
        expr = expr.replace(/\/\*.*?\*\//g, '').trim();
        if (/^\d+$/.test(expr)) return Number(expr) !== 0;
        /* defined(X) / defined X -> truth; bare identifiers likewise */
        const js = expr
            .replace(/defined\s*\(\s*(\w+)\s*\)/g, (_, n) =>
                DEFINES.has(n) ? 'true' : 'false')
            .replace(/\b([A-Z_][A-Z0-9_]*)\b/g, (_, n) =>
                DEFINES.has(n) ? 'true' : 'false')
            .replace(/!/g, '!').replace(/&&/g, '&&').replace(/\|\|/g, '||');
        try {
            return !!Function(`"use strict"; return (${js});`)();
        } catch (e) {
            throw new Error(`optlist.h: cannot evaluate #if ${expr}`);
        }
    };

    const out = [];
    const stack = []; /* {active, seenTrue} */
    for (const line of text.split('\n')) {
        const m = /^\s*#\s*(ifdef|ifndef|if|elif|else|endif)\b(.*)$/.exec(line);
        if (m) {
            const parentActive = stack.every(f => f.active);
            const kw = m[1], rest = m[2].trim();
            if (kw === 'ifdef') {
                const v = DEFINES.has(rest.split(/\s/)[0]);
                stack.push({ active: parentActive && v, seenTrue: v });
            } else if (kw === 'ifndef') {
                const v = !DEFINES.has(rest.split(/\s/)[0]);
                stack.push({ active: parentActive && v, seenTrue: v });
            } else if (kw === 'if') {
                const v = evalExpr(rest);
                stack.push({ active: parentActive && v, seenTrue: v });
            } else if (kw === 'elif') {
                const f = stack[stack.length - 1];
                const above = stack.slice(0, -1).every(x => x.active);
                const v = !f.seenTrue && evalExpr(rest);
                f.active = above && v;
                f.seenTrue = f.seenTrue || v;
            } else if (kw === 'else') {
                const f = stack[stack.length - 1];
                const above = stack.slice(0, -1).every(x => x.active);
                f.active = above && !f.seenTrue;
                f.seenTrue = true;
            } else if (kw === 'endif') {
                stack.pop();
            }
            continue; /* the directive line itself never emits */
        }
        if (stack.every(f => f.active))
            out.push(line);
    }
    return out.join('\n');
}

// Find every NHOPT* invocation that is not a #define, reading the balanced
// argument list even when it spans several lines.
function extractInvocations(text) {
    const found = [];
    const re = /\bNHOPT([BCPO])\s*\(/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        // Skip the macro definitions themselves.
        const lineStart = text.lastIndexOf('\n', m.index) + 1;
        if (/^\s*#\s*define/.test(text.slice(lineStart, m.index))) continue;

        // Descriptions routinely contain parentheses ("(e.g. Quit)"), so the
        // scan has to step over string and char literals or it unbalances and
        // swallows every following entry.
        let i = re.lastIndex, depth = 1;
        while (i < text.length && depth > 0) {
            const c = text[i];
            if (c === '"' || c === "'") {
                const quote = c;
                i++;
                while (i < text.length) {
                    if (text[i] === '\\') { i += 2; continue; }
                    if (text[i] === quote) { i++; break; }
                    i++;
                }
                continue;
            }
            if (c === '(') depth++;
            else if (c === ')') depth--;
            if (depth === 0) break;
            i++;
        }
        found.push({ kind: m[1], args: splitArgs(text.slice(re.lastIndex, i)) });
        re.lastIndex = i;
    }
    return found;
}

const KIND_FIELDS = {
    // name, section, length, opt_in_out, setwhere, initval, negateok, valok,
    // dupok, alias, addr, termpref, descr
    B: ['name', 'section', 'length', 'optInOut', 'setwhere', 'initval',
        'negateok', 'valok', 'dupok', 'alias', 'addr', 'termpref', 'descr'],
    // name, section, length, opt_in_out, setwhere, negateok, valok, dupok,
    // hasHandler, alias, descr
    C: ['name', 'section', 'length', 'optInOut', 'setwhere',
        'negateok', 'valok', 'dupok', 'hasHandler', 'alias', 'descr'],
    P: ['name', 'section', 'length', 'optInOut', 'setwhere',
        'negateok', 'valok', 'dupok', 'hasHandler', 'alias', 'descr'],
    // display name, section, fn name, length, opt_in_out, setwhere, negateok,
    // valok, dupok, alias, descr
    O: ['displayName', 'section', 'name', 'length', 'optInOut', 'setwhere',
        'negateok', 'valok', 'dupok', 'alias', 'descr'],
};

const TYPE_OF = { B: 'BoolOpt', C: 'CompOpt', P: 'CompOpt', O: 'OthrOpt' };

function unquote(tok) {
    if (tok === undefined || tok === null) return null;
    const t = tok.trim();
    if (t === 'NoAlias' || t === '(const char *) 0' || t === '0') return null;
    const m = /^"((?:[^"\\]|\\.)*)"$/.exec(t);
    /* C string escapes: the source spells \" for an embedded quote */
    return m ? m[1].replace(/\\(.)/g, '$1') : t;
}

function main() {
    /* strip block comments so a commented-out NHOPT invocation ("moved to
       top") cannot be scraped as a real row; quote-aware */
    const stripComments = (t) => {
        let out = '', i = 0;
        while (i < t.length) {
            const c = t[i];
            if (c === '"') {
                out += c; i++;
                while (i < t.length) {
                    out += t[i];
                    if (t[i] === '\\') { i++; out += t[i] ?? ''; i++; continue; }
                    if (t[i] === '"') { i++; break; }
                    i++;
                }
                continue;
            }
            if (c === '/' && t[i + 1] === '*') {
                i += 2;
                while (i < t.length && !(t[i] === '*' && t[i + 1] === '/')) i++;
                i += 2;
                out += ' ';
                continue;
            }
            out += c; i++;
        }
        return out;
    };
    const text = stripComments(preprocess(readFileSync(SRC, 'utf8')));
    const invocations = extractInvocations(text);

    const entries = invocations.map(({ kind, args }) => {
        const fields = KIND_FIELDS[kind];
        const e = { type: TYPE_OF[kind], pfx: kind === 'P' };
        fields.forEach((f, i) => { e[f] = args[i] === undefined ? null : args[i].trim(); });
        e.name = unquote(e.displayName ?? e.name);
        e.alias = unquote(e.alias);
        e.descrQuoted = !!(e.descr && e.descr.startsWith('"'));
        e.descr = unquote(e.descr);
        delete e.displayName;
        /* keep a marker for '(boolean *) 0' addresses before dropping addr:
           option_help skips such rows (the platform's compiled-out stubs) */
        e.noaddr = !!(e.addr && e.addr.replace(/\s+/g, '').includes('(boolean*)0'));
        delete e.addr;
        delete e.termpref;
        return e;
    });

    const byType = entries.reduce((a, e) => { a[e.type] = (a[e.type] || 0) + 1; return a; }, {});

    const body = entries.map(e => {
        const parts = [
            `name: ${JSON.stringify(e.name)}`,
            `type: ${JSON.stringify(e.type)}`,
            `section: ${JSON.stringify(e.section)}`,
            `length: ${JSON.stringify(e.length)}`,
            `optInOut: ${JSON.stringify(e.optInOut)}`,
            `setwhere: ${JSON.stringify(e.setwhere)}`,
            `negateok: ${JSON.stringify(e.negateok)}`,
            `valok: ${JSON.stringify(e.valok)}`,
            `dupok: ${JSON.stringify(e.dupok)}`,
        ];
        if (e.type === 'BoolOpt') parts.push(`initval: ${JSON.stringify(e.initval)}`);
        if (e.hasHandler) parts.push(`hasHandler: ${JSON.stringify(e.hasHandler)}`);
        if (e.pfx) parts.push('pfx: true');
        if (e.alias) parts.push(`alias: ${JSON.stringify(e.alias)}`);
        /* option_help ('?g') prints each compound option's description */
        if (e.descrQuoted)
            parts.push(`descr: ${JSON.stringify(e.descr)}`);
        /* a null addr marks an option compiled out on this platform; the
           allopt row exists but option_help skips it (options.c:9476) */
        if (e.noaddr)
            parts.push('noaddr: true');
        return `    { ${parts.join(', ')} },`;
    }).join('\n');

    const out = `// optlist.js — GENERATED by tools/gen-optlist.mjs from
// nethack-c/upstream/include/optlist.h. Do not edit by hand; re-run the
// generator instead. Field order follows the NHOPT_PARSE macro expansions at
// optlist.h:75-86.
//
// Token values (opt_in, set_gameview, On, Off, PL_NSIZ, ...) are kept as the
// raw C identifiers the header uses, so this table reads the same as the C and
// js/options.js interprets them the same way parseoptions() does.
//
// ${entries.length} options: ${Object.entries(byType).map(([k, v]) => `${v} ${k}`).join(', ')}.

export const allopt = [
${body}
];

const byName = new Map();
for (const o of allopt) {
    byName.set(o.name.toLowerCase(), o);
    if (o.alias) byName.set(o.alias.toLowerCase(), o);
}

export function findOption(name) {
    return byName.get(String(name).toLowerCase()) || null;
}
`;

    if (process.argv.includes('--stdout')) process.stdout.write(out);
    else {
        writeFileSync(OUT, out);
        console.log(`wrote ${OUT}`);
        console.log(`${entries.length} options: ${Object.entries(byType).map(([k, v]) => `${v} ${k}`).join(', ')}`);
        const aliased = entries.filter(e => e.alias);
        console.log(`${aliased.length} with aliases, e.g. ${aliased.slice(0, 5).map(e => `${e.name}=${e.alias}`).join(', ')}`);
    }
}

main();
