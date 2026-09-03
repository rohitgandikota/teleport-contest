#!/usr/bin/env node

// Development-only scope and import checks. Parse code without executing it.
// A binding in a different function must not hide an unresolved reference,
// and destructuring an import must name an actual export of that module.

import { parse } from 'acorn';
import { analyze } from 'eslint-scope';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GLOBALS = new Set([
    ...Object.getOwnPropertyNames(globalThis),
    'window', 'document', 'navigator', 'localStorage', 'HTMLElement',
    'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver',
]);

function walk(node, visit) {
    if (!node || typeof node.type !== 'string') return;
    visit(node);
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(child => walk(child, visit));
        else if (value && typeof value === 'object') walk(value, visit);
    }
}

const nameOf = node => node?.name ?? node?.value;
const modulePath = (file, source) => typeof source === 'string' && source.startsWith('.')
    ? resolve(dirname(file), source) : null;
const importedSource = node => {
    if (node?.type !== 'AwaitExpression') return null;
    const expr = node.argument;
    return expr.type === 'ImportExpression' && expr.source.type === 'Literal'
        ? expr.source.value : null;
};

export function auditSources(sources, { globals = GLOBALS, ignore = new Set() } = {}) {
    const modules = new Map();
    const findings = [];
    const add = (file, node, kind, name, detail = '') => {
        if (!ignore.has(file)) findings.push({
            file, line: node.loc.start.line, column: node.loc.start.column + 1,
            kind, name, detail,
        });
    };

    for (const [file, source] of sources) {
        const ast = parse(source, {
            ecmaVersion: 2025, sourceType: 'module', locations: true, ranges: true,
        });
        const scope = analyze(ast, { ecmaVersion: 2025, sourceType: 'module' });
        const exports = new Set();
        const stars = [];
        const checks = [];
        const namespaces = new Map();
        const references = new Map();
        for (const s of scope.scopes)
            for (const ref of s.references) references.set(ref.identifier, ref);
        for (const ref of scope.globalScope.through) {
            if (!globals.has(ref.identifier.name))
                add(file, ref.identifier, 'unbound', ref.identifier.name);
        }
        const check = (node, source, name = '*') => {
            const target = modulePath(file, source);
            if (target) checks.push({ node, target, name });
        };
        for (const node of ast.body) {
            if (node.type === 'ExportDefaultDeclaration') exports.add('default');
            if (node.type === 'ExportAllDeclaration') {
                check(node, node.source.value);
                if (node.exported) exports.add(nameOf(node.exported));
                else stars.push(modulePath(file, node.source.value));
            }
            if (node.type === 'ExportNamedDeclaration') {
                if (node.declaration?.type === 'VariableDeclaration') {
                    for (const variable of scope.getDeclaredVariables(node.declaration))
                        exports.add(variable.name);
                } else if (node.declaration?.id) exports.add(node.declaration.id.name);
                for (const spec of node.specifiers) {
                    exports.add(nameOf(spec.exported));
                    if (node.source) check(spec, node.source.value, nameOf(spec.local));
                }
            }
            if (node.type === 'ImportDeclaration') {
                check(node, node.source.value);
                for (const spec of node.specifiers) {
                    if (spec.type === 'ImportNamespaceSpecifier') {
                        const variable = scope.getDeclaredVariables(node)
                            .find(v => v.name === spec.local.name);
                        namespaces.set(variable, modulePath(file, node.source.value));
                    } else check(spec, node.source.value,
                                 spec.type === 'ImportDefaultSpecifier' ? 'default'
                                     : nameOf(spec.imported));
                }
            }
        }
        walk(ast, node => {
            if (node.type === 'ImportExpression' && node.source.type === 'Literal')
                check(node, node.source.value);
            if (node.type !== 'VariableDeclarator') return;
            const source = importedSource(node.init);
            if (!source) return;
            if (node.id.type === 'ObjectPattern') {
                for (const prop of node.id.properties) {
                    if (prop.type !== 'RestElement'
                        && (!prop.computed || prop.key.type === 'Literal'))
                        check(prop, source, nameOf(prop.key));
                }
            } else if (node.id.type === 'Identifier') {
                const variable = scope.getDeclaredVariables(node)
                    .find(v => v.name === node.id.name);
                namespaces.set(variable, modulePath(file, source));
            }
        });
        walk(ast, node => {
            if (node.type !== 'MemberExpression'
                || (node.computed && node.property.type !== 'Literal')) return;
            const ref = references.get(node.object);
            const target = namespaces.get(ref?.resolved)
                || modulePath(file, importedSource(node.object));
            if (target) checks.push({ node, target, name: nameOf(node.property) });
        });
        modules.set(file, { exports, stars, checks });
    }

    // Resolve re-export chains, including cycles, without evaluating modules.
    let changed = true;
    while (changed) {
        changed = false;
        for (const module of modules.values()) {
            for (const target of module.stars) {
                for (const name of modules.get(target)?.exports || []) {
                    if (name !== 'default' && !module.exports.has(name)) {
                        module.exports.add(name);
                        changed = true;
                    }
                }
            }
        }
    }
    for (const [file, module] of modules) {
        for (const { node, target, name } of module.checks) {
            if (!modules.has(target)) add(file, node, 'missing-module', name, target);
            else if (name !== '*' && !modules.get(target).exports.has(name))
                add(file, node, 'missing-export', name, target);
        }
    }
    return findings.sort((a, b) => a.file.localeCompare(b.file)
        || a.line - b.line || a.column - b.column || a.kind.localeCompare(b.kind));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const files = execFileSync('rg', ['--files', '-g', '*.js', 'js'], {
            cwd: ROOT, encoding: 'utf8',
        }).trim().split('\n').map(file => resolve(ROOT, file));
        const ignore = new Set(['isaac64', 'terminal', 'storage']
            .map(name => resolve(ROOT, `js/${name}.js`)));
        const sources = new Map(files.map(file => [file, readFileSync(file, 'utf8')]));
        const findings = auditSources(sources, { ignore });
        if (process.argv.includes('--json')) console.log(JSON.stringify(findings, null, 2));
        else {
            for (const item of findings) console.log(
                `${relative(ROOT, item.file)}:${item.line}:${item.column} ${item.kind} ${item.name}`
                + (item.detail ? ` in ${relative(ROOT, item.detail)}` : ''));
            console.log(`${findings.length} scope/import finding(s) in ${files.length - ignore.size} non-frozen modules.`);
        }
        process.exitCode = findings.length ? 1 : 0;
    } catch (error) {
        console.error(`source-audit: ${error.stack || error}`);
        process.exitCode = 2;
    }
}
