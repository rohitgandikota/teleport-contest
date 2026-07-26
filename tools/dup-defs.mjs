// dup-defs.mjs — find names defined in more than one module, and say whether
// the definitions AGREE.
//
// The architecture rule is that a constant lives in js/const.js named exactly
// as in include/*.h, and a function lives in the js/ file mirroring the .c
// file that defines it. A second copy elsewhere is drift, and drift with a
// DIFFERENT body is a bug that no score will ever show you: both copies
// compile, both look right, and whichever one the caller imported wins.
//
// Real examples this found:
//   Is_rogue_level  js/const.js had Lcheck against rogue_level; js/mkobj.js
//                   had a copy testing game.level.flags.is_rogue_level, a flag
//                   nothing sets
//   dist2           js/hacklib.js (correct, src/hacklib.c) and js/monmove.js
//                   (a copy labelled "src/hack.c")
//   MON_WEP         js/mon.js and js/worn.js, both correct but neither in the
//                   include/monst.h home the C has
//
//     node tools/dup-defs.mjs            differing bodies only (the bugs)
//     node tools/dup-defs.mjs --all      every duplicated name

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const showAll = process.argv.includes('--all');

function jsFiles(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...jsFiles(p));
        else if (name.endsWith('.js')) out.push(p);
    }
    return out;
}

// The body of a one-line definition, normalised enough that whitespace and
// comment differences do not count as disagreement.
function bodyOf(src, idx) {
    let end = src.indexOf('\n', idx);
    let text = src.slice(idx, end < 0 ? src.length : end);
    // a brace-opened definition runs to its matching close
    if (text.includes('{') && !text.trimEnd().endsWith('}')) {
        let depth = 0, i = idx;
        for (; i < src.length; i++) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') { depth--; if (!depth) break; }
        }
        text = src.slice(idx, i + 1);
    }
    return text
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const seen = new Map();          // name -> [{file, body}]

for (const file of jsFiles(join(ROOT, 'js'))) {
    const rel = relative(ROOT, file);
    if (/^js\/(isaac64|terminal|storage)\.js$/.test(rel)) continue;
    // generated tables are allowed to restate what they generate
    if (/_data\.js$/.test(rel)) continue;

    const src = readFileSync(file, 'utf8');
    const re = /^(?:export\s+)?(?:async\s+)?(?:function|const|let)\s+([A-Za-z_$][\w$]*)/gm;
    for (const m of src.matchAll(re)) {
        if (!seen.has(m[1])) seen.set(m[1], []);
        seen.get(m[1]).push({ file: rel, body: bodyOf(src, m.index) });
    }
}

let differing = 0, same = 0;
const rows = [];

for (const [name, defs] of seen) {
    const files = [...new Set(defs.map((d) => d.file))];
    if (files.length < 2) continue;

    const bodies = new Set(defs.map((d) => d.body));
    if (bodies.size > 1) {
        differing++;
        rows.push({ name, files, defs, differs: true });
    } else {
        same++;
        if (showAll) rows.push({ name, files, defs, differs: false });
    }
}

rows.sort((a, b) => (b.differs - a.differs) || a.name.localeCompare(b.name));

for (const r of rows) {
    console.log(`${r.differs ? 'DIFFERS' : 'same   '}  ${r.name}`);
    for (const d of r.defs)
        console.log(`           ${d.file}:  ${d.body.slice(0, 96)}`);
}

console.log(`\n${differing} name(s) defined differently in more than one file`
            + `, ${same} duplicated but identical`
            + (showAll ? '' : ' (--all to list those too).'));
