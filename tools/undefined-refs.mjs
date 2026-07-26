// undefined-refs.mjs — find calls to names a module never binds.
//
// Why this exists: a JS module happily loads with a call to a name it never
// imported. The ReferenceError fires only when that line actually runs, so a
// missing import on a rarely-taken branch is invisible to `node --check`, to
// module load, and to every session that does not take the branch. Two landed
// this way in js/sp_lev.js (obj_resists, obj_extract_self, both inside
// bury_an_obj) and neither showed up until a generalize seed buried something.
//
// This is deliberately a *lexical* check, not a real scope analysis: it reads
// each file, collects the names bound at module level, collects the names used
// in call position, and reports the difference. Locals declared inside function
// bodies are collected too, so the result is over-permissive (it will miss a
// genuinely shadowed name) rather than noisy. Anything it does report is worth
// looking at.
//
//     node tools/undefined-refs.mjs

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Globals a browser/node module may call without importing.
const GLOBALS = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'typeof',
    'new', 'await', 'case', 'do', 'else', 'delete', 'in', 'of', 'throw',
    'yield', 'void', 'this', 'super', 'import', 'constructor', 'get', 'set',
    'Math', 'Number', 'String', 'Object', 'Array', 'Set', 'Map', 'JSON',
    'Boolean', 'Symbol', 'Promise', 'Error', 'RegExp', 'Date', 'BigInt',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
    'decodeURIComponent', 'structuredClone', 'queueMicrotask', 'atob', 'btoa',
    'Uint8Array', 'Int8Array', 'Uint16Array', 'Int16Array', 'Uint32Array',
    'Int32Array', 'Float32Array', 'Float64Array', 'ArrayBuffer', 'DataView',
    'WeakMap', 'WeakSet', 'Proxy', 'Reflect', 'console', 'process', 'require',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'globalThis',
]);

function jsFiles(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...jsFiles(p));
        else if (name.endsWith('.js')) out.push(p);
    }
    return out;
}

// Strip comments and string/template literals so their contents cannot look
// like code. Crude but adequate: the port has no regex literals containing
// unbalanced quotes.
function decomment(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
        .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

const IDENT = '[A-Za-z_$][\\w$]*';
let findings = 0;

for (const file of jsFiles(join(ROOT, 'js')).sort()) {
    const rel = relative(ROOT, file);
    // The frozen files are supplied by the judge; not ours to audit.
    if (/^js\/(isaac64|terminal|storage)\.js$/.test(rel)) continue;

    const src = decomment(readFileSync(file, 'utf8'));
    const bound = new Set();

    // import { a, b as c } from '...'   /   import d from '...'
    for (const m of src.matchAll(/import\s*\{([^}]*)\}/g))
        for (const part of m[1].split(','))
            bound.add(part.trim().split(/\s+as\s+/).pop().trim());
    for (const m of src.matchAll(new RegExp(`import\\s+(${IDENT})\\s+from`, 'g')))
        bound.add(m[1]);
    for (const m of src.matchAll(new RegExp(`import\\s*\\*\\s*as\\s+(${IDENT})`, 'g')))
        bound.add(m[1]);

    // declarations at any depth, plus params and catch bindings
    for (const re of [
        `(?:async\\s+)?function\\s*\\*?\\s*(${IDENT})`,
        `(?:const|let|var)\\s+(${IDENT})`,
        `class\\s+(${IDENT})`,
        `catch\\s*\\(\\s*(${IDENT})`,
    ]) for (const m of src.matchAll(new RegExp(re, 'g'))) bound.add(m[1]);

    // `let a = ..., b = ...` — every declarator after the first. Missing these
    // reported add_door_fn in js/sp_lev.js as unbound when the wire defines it.
    for (const m of src.matchAll(new RegExp(`(?:const|let|var)\\s+([^;\\n]*)`, 'g')))
        for (const part of m[1].split(','))
            for (const n of part.match(new RegExp(IDENT, 'g')) || []) {
                if (part.trim().startsWith(n)) bound.add(n);
                break;
            }

    // object-literal / class method shorthand: `name(args) {`. These are
    // properties, not free calls, but read like calls to a lexical scan.
    for (const m of src.matchAll(new RegExp(`(?:^|[,{]|\\n)\\s*(?:async\\s+|\\*\\s*)?(${IDENT})\\s*\\([^()]*\\)\\s*\\{`, 'g')))
        bound.add(m[1]);

    // every identifier appearing in a parameter list or destructuring pattern
    for (const m of src.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g))
        for (const p of m[1].split(',')) {
            const n = p.trim().replace(/^\.\.\./, '').split(/[=:]/)[0].trim();
            if (new RegExp(`^${IDENT}$`).test(n)) bound.add(n);
        }
    for (const m of src.matchAll(new RegExp(`\\{([^{}]*)\\}\\s*=`, 'g')))
        for (const p of m[1].split(',')) {
            const n = p.trim().split(/[=:]/).pop().trim();
            if (new RegExp(`^${IDENT}$`).test(n)) bound.add(n);
        }
    for (const m of src.matchAll(new RegExp(`(${IDENT})\\s*=>`, 'g'))) bound.add(m[1]);

    // names used in call position, minus property accesses (`x.foo(`)
    const missing = new Set();
    for (const m of src.matchAll(new RegExp(`(\\.?)\\s*(${IDENT})\\s*\\(`, 'g'))) {
        const [, dot, name] = m;
        if (dot === '.' || bound.has(name) || GLOBALS.has(name)) continue;
        missing.add(name);
    }

    // Namespace objects read as `NAME.member`. These never look like calls, so
    // the pass above misses them entirely -- MATERIALS.WOOD in js/sp_lev.js
    // survived the first version of this tool and still crashed a generalize
    // seed. Only ALL_CAPS bases are checked: a lowercase `foo.bar` is usually a
    // local whose declaration this lexical scan cannot see.
    for (const m of src.matchAll(new RegExp(`(\\.?)\\s*([A-Z][A-Z0-9_]{2,})\\s*\\.`, 'g'))) {
        const [, dot, name] = m;
        if (dot === '.' || bound.has(name) || GLOBALS.has(name)) continue;
        missing.add(name);
    }

    if (missing.size) {
        findings += missing.size;
        console.log(`${rel}`);
        for (const name of [...missing].sort()) {
            const line = readFileSync(file, 'utf8')
                .split('\n')
                .findIndex((l) => new RegExp(`(^|[^\\w$.])${name}\\s*\\(`).test(l)) + 1;
            console.log(`    ${name}  (first use ${rel}:${line})`);
        }
    }
}

console.log(findings ? `\n${findings} unbound call target(s).`
                     : 'No unbound call targets.');
