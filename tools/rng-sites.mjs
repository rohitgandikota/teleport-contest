#!/usr/bin/env node
// rng-sites.mjs — which RNG call sites in the C source has NO recorded trace
// ever reached?
//
// The recorder tags every rn2/rnd/rnl/d/rne/rnz draw with its caller as
// "@ func(file.c:line)" (nethack-c/patches/003-rng-log-core.patch). The union
// of those tags over sessions/ and tools/gen-sessions/generated/ is the exact
// set of RNG-drawing C branches we hold ground truth for. Every other RNG call
// site in src/*.c is a branch the port can get wrong without any test
// noticing. This tool lists that complement, grouped by file and enclosing
// function, so recipe writing is driven by the source instead of by the
// hand-written matrix in coverage-requirements.json.
//
// Two readings of the output matter:
//   * a function with ZERO observed sites ("never") has no oracle at all. If
//     js/ defines it, the port was written blind and has never been checked.
//   * a function with SOME unobserved sites has a branch the oracle has never
//     selected, which is where rn2()-gated arms silently diverge.
//
// Line numbers in the tags come from the recorder-patched tree, so the static
// scan reads nethack-c/recorder's source when present and falls back to
// upstream. The "observed but not a static site" count at the bottom is the
// self-check that the two trees agree; it should be near zero.
//
// Usage:
//   node tools/rng-sites.mjs                    # per-file summary
//   node tools/rng-sites.mjs --functions [N]    # functions with unobserved sites, top N
//   node tools/rng-sites.mjs --file dig.c       # every site in one file, observed or not
//   node tools/rng-sites.mjs --never            # functions with no observed site at all
//   node tools/rng-sites.mjs --json out.json    # dump everything
//
// The corpus scan is cached per session file by mtime in
// tools/gen-sessions/.cache/rng-sites.json, so re-runs after adding a recipe
// only parse the new file.

import {
    readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, statSync,
} from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_CANDIDATES = [
    join(ROOT, 'nethack-c/recorder/src'),
    join(ROOT, 'nethack-c/recorder/build/src'),
    join(ROOT, 'nethack-c/upstream/src'),
];
const CORPORA = [
    join(ROOT, 'sessions'),
    join(ROOT, 'tools/gen-sessions/generated'),
];
const CACHE = join(ROOT, 'tools/gen-sessions/.cache/rng-sites.json');
// rn1() and ROLL_FROM() are hack.h macros over rn2(), so they tag their own
// line just like a direct call.
const RNG_CALL = /\b(rn2|rnd|rnl|rne|rnz|rn1|ROLL_FROM|AC_VALUE|d)\s*\(/;
const SKIP_FILES = new Set(['rnd.c', 'isaac64.c']);
const NOT_FUNCTIONS = new Set(['if', 'while', 'for', 'switch', 'return', 'sizeof', 'else']);

const args = process.argv.slice(2);
function flag(name) { return args.includes(name); }
function opt(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; }

// ---------- static scan of the C source ----------

function stripC(text) {
    text = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    text = text.replace(/\/\/[^\n]*/g, '');
    text = text.replace(/"(?:\\.|[^"\\\n])*"/g, '""');
    text = text.replace(/'(?:\\.|[^'\\\n])'/g, "''");
    return text;
}

function scanSource(srcDir) {
    const files = new Map(); // file -> { sites: [], funcs: Map(name -> {line, sites: []}) }
    for (const name of readdirSync(srcDir).sort()) {
        if (!name.endsWith('.c') || SKIP_FILES.has(name)) continue;
        const lines = stripC(readFileSync(join(srcDir, name), 'utf8')).split('\n');
        const funcs = new Map();
        const sites = [];
        let fn = null;
        lines.forEach((raw, i) => {
            const m = /^([A-Za-z_]\w*)\s*\(/.exec(raw);
            if (m && !NOT_FUNCTIONS.has(m[1])) {
                fn = m[1];
                if (!funcs.has(fn)) funcs.set(fn, { name: fn, file: name, line: i + 1, sites: [] });
            }
            if (/^\s*#/.test(raw)) return;
            if (!RNG_CALL.test(raw)) return;
            const site = { file: name, line: i + 1, fn, text: raw.trim(), count: 0, sessions: 0 };
            sites.push(site);
            if (fn) funcs.get(fn).sites.push(site);
        });
        files.set(name, { file: name, sites, funcs });
    }
    return files;
}

// ---------- which C functions js/ defines ----------

function jsDefinitions() {
    const defs = new Set();
    const re = /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm;
    const re2 = /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function\b|\()/gm;
    const walk = (dir) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
            const p = join(dir, e.name);
            if (e.isDirectory()) { walk(p); continue; }
            if (!e.name.endsWith('.js')) continue;
            const text = readFileSync(p, 'utf8');
            for (const m of text.matchAll(re)) defs.add(m[1]);
            for (const m of text.matchAll(re2)) defs.add(m[1]);
        }
    };
    walk(join(ROOT, 'js'));
    return defs;
}

// ---------- observed sites from the recorded corpus ----------

function loadCache() {
    try { return JSON.parse(readFileSync(CACHE, 'utf8')); } catch { return {}; }
}

function scanCorpus() {
    const cache = loadCache();
    const fresh = {};
    let parsed = 0;
    for (const dir of CORPORA) {
        if (!existsSync(dir)) continue;
        for (const f of readdirSync(dir).sort()) {
            if (!f.endsWith('.session.json')) continue;
            const path = join(dir, f);
            const key = `${basename(dir)}/${f}`;
            const mtime = statSync(path).mtimeMs;
            if (cache[key] && cache[key].mtime === mtime) { fresh[key] = cache[key]; continue; }
            const counts = {};
            let lua = 0, untagged = 0, total = 0;
            const s = JSON.parse(readFileSync(path, 'utf8'));
            for (const seg of s.segments || []) {
                for (const st of seg.steps || []) {
                    for (const r of st.rng || []) {
                        total++;
                        const m = /@ (\w+)\((\w+\.c):(\d+)\)$/.exec(r);
                        if (!m) { if (/@ nh\.|src=/.test(r)) lua++; else untagged++; continue; }
                        const k = `${m[2]}:${m[3]}`;
                        counts[k] = (counts[k] || 0) + 1;
                    }
                }
            }
            fresh[key] = { mtime, counts, lua, untagged, total };
            parsed++;
        }
    }
    mkdirSync(join(CACHE, '..'), { recursive: true });
    writeFileSync(CACHE, JSON.stringify(fresh));
    const observed = new Map(); // "file:line" -> { count, sessions }
    let lua = 0, untagged = 0, total = 0, sessions = 0;
    for (const e of Object.values(fresh)) {
        sessions++;
        lua += e.lua; untagged += e.untagged; total += e.total;
        for (const [k, c] of Object.entries(e.counts)) {
            const o = observed.get(k) || { count: 0, sessions: 0 };
            o.count += c; o.sessions++;
            observed.set(k, o);
        }
    }
    return { observed, lua, untagged, total, sessions, parsed };
}

// ---------- join ----------

const srcDir = opt('--src') || SRC_CANDIDATES.find((d) => existsSync(d));
if (!srcDir) { console.error('no C source tree found'); process.exit(2); }
const files = scanSource(srcDir);
const jsDefs = jsDefinitions();
const corpus = scanCorpus();

const siteByKey = new Map();
for (const f of files.values())
    for (const s of f.sites) siteByKey.set(`${s.file}:${s.line}`, s);
const strayObserved = [];
for (const [key, o] of corpus.observed) {
    let s = siteByKey.get(key);
    if (!s) {
        // A call spanning lines is tagged with the line of its closing paren
        // (clang's __LINE__ inside a macro argument list). Walk back a few
        // lines to the line the scanner attributed the call to.
        const [file, line] = key.split(':');
        for (let k = 1; k <= 6 && !s; k++) s = siteByKey.get(`${file}:${Number(line) - k}`);
    }
    if (!s) { strayObserved.push(key); continue; }
    s.count += o.count; s.sessions += o.sessions;
}

const funcRows = [];
for (const f of files.values()) {
    for (const fn of f.funcs.values()) {
        if (!fn.sites.length) continue;
        const observed = fn.sites.filter((s) => s.count > 0).length;
        funcRows.push({
            file: f.file, fn: fn.name, line: fn.line, sites: fn.sites.length, observed,
            unobserved: fn.sites.length - observed, ported: jsDefs.has(fn.name),
        });
    }
}

const fileRows = [];
for (const f of files.values()) {
    if (!f.sites.length) continue;
    const observed = f.sites.filter((s) => s.count > 0).length;
    const fnRows = funcRows.filter((r) => r.file === f.file);
    fileRows.push({
        file: f.file, sites: f.sites.length, observed, unobserved: f.sites.length - observed,
        funcs: fnRows.length, never: fnRows.filter((r) => r.observed === 0).length,
        neverPorted: fnRows.filter((r) => r.observed === 0 && r.ported).length,
        js: existsSync(join(ROOT, 'js', f.file.replace(/\.c$/, '.js'))),
    });
}

function pad(s, n) { s = String(s); return s.length >= n ? s : (typeof s === 'number' || /^\d/.test(s) ? ' '.repeat(n - s.length) + s : s + ' '.repeat(n - s.length)); }
function pct(a, b) { return b ? `${(100 * a / b).toFixed(1)}%` : '-'; }

const totalSites = fileRows.reduce((a, r) => a + r.sites, 0);
const totalObserved = fileRows.reduce((a, r) => a + r.observed, 0);
const totalFuncs = funcRows.length;
const neverFuncs = funcRows.filter((r) => r.observed === 0);

if (opt('--json')) {
    writeFileSync(opt('--json'), JSON.stringify({ srcDir, files: [...files.values()], funcRows, fileRows, corpus: { ...corpus, observed: [...corpus.observed] }, strayObserved }, null, 1));
    console.log(`wrote ${opt('--json')}`);
} else if (opt('--file')) {
    const f = files.get(opt('--file'));
    if (!f) { console.error(`no such file: ${opt('--file')}`); process.exit(2); }
    for (const fn of f.funcs.values()) {
        if (!fn.sites.length) continue;
        const observed = fn.sites.filter((s) => s.count > 0).length;
        console.log(`\n${fn.name}()  ${f.file}:${fn.line}  sites ${observed}/${fn.sites.length}  ${jsDefs.has(fn.name) ? 'ported' : 'ABSENT in js/'}${observed === 0 ? '  NEVER OBSERVED' : ''}`);
        for (const s of fn.sites)
            console.log(`  ${s.count > 0 ? pad(s.count, 7) : '      -'} ${pad(s.sessions ? s.sessions + 's' : '', 5)} :${s.line}  ${s.text.slice(0, 90)}`);
    }
} else if (flag('--functions') || flag('--never')) {
    const n = Number(opt('--functions') || opt('--never')) || 60;
    const rows = (flag('--never') ? neverFuncs : funcRows.filter((r) => r.unobserved > 0))
        .sort((a, b) => b.unobserved - a.unobserved || a.file.localeCompare(b.file) || a.line - b.line)
        .slice(0, n);
    console.log(`${pad('file', 14)} ${pad('function', 30)} ${pad('obs/sites', 10)} ${pad('ported', 7)} flag`);
    for (const r of rows)
        console.log(`${pad(r.file, 14)} ${pad(r.fn, 30)} ${pad(`${r.observed}/${r.sites}`, 10)} ${pad(r.ported ? 'yes' : 'NO', 7)} ${r.observed === 0 ? 'never' : ''}`);
    console.log(`\n${rows.length} shown of ${flag('--never') ? neverFuncs.length : funcRows.filter((r) => r.unobserved > 0).length}`);
} else {
    fileRows.sort((a, b) => b.unobserved - a.unobserved);
    console.log(`${pad('file', 14)} ${pad('sites', 6)} ${pad('obs', 6)} ${pad('unobs', 6)} ${pad('cover', 7)} ${pad('fns', 5)} ${pad('never', 6)} ${pad('nvr+js', 7)} js-twin`);
    for (const r of fileRows)
        console.log(`${pad(r.file, 14)} ${pad(r.sites, 6)} ${pad(r.observed, 6)} ${pad(r.unobserved, 6)} ${pad(pct(r.observed, r.sites), 7)} ${pad(r.funcs, 5)} ${pad(r.never, 6)} ${pad(r.neverPorted, 7)} ${r.js ? 'yes' : 'no'}`);
    console.log(`\nsource tree: ${srcDir}`);
    console.log(`RNG call sites: ${totalSites}, observed ${totalObserved} (${pct(totalObserved, totalSites)}), unobserved ${totalSites - totalObserved}`);
    console.log(`RNG-drawing functions: ${totalFuncs}, never observed ${neverFuncs.length} (of which ${neverFuncs.filter((r) => r.ported).length} are defined in js/ and so were ported blind)`);
    console.log(`corpus: ${corpus.sessions} sessions, ${corpus.total} RNG calls, ${corpus.lua} Lua-context, ${corpus.untagged} untagged, ${corpus.parsed} files parsed fresh`);
    console.log(`observed sites with no static match: ${strayObserved.length}${strayObserved.length ? '  e.g. ' + strayObserved.slice(0, 5).join(' ') : ''}`);
}
