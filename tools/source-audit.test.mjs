import assert from 'node:assert/strict';
import test from 'node:test';
import { auditSources } from './source-audit.mjs';

const audit = files => auditSources(new Map(Object.entries(files)));

test('a different function does not bind a bare or template reference', () => {
    const findings = audit({ '/entry.js': [
        'function first() { const Luck = () => 1; return Luck(); }',
        'function second() { return `${Luck()} ${missing}`; }',
    ].join('\n') });
    assert.deepEqual(findings.map(x => [x.name, x.line]), [['Luck', 2], ['missing', 2]]);
});

test('block bindings do not escape, and properties are not bare variables', () => {
    const findings = audit({ '/entry.js': [
        'const obj = { method(a) { return a; } };',
        'if (true) { const local = 1; obj.method(local); }',
        'obj.method(local);',
    ].join('\n') });
    assert.deepEqual(findings.map(x => x.name), ['local']);
});

test('literal imports check aliases, destructuring and scoped namespaces', () => {
    const findings = audit({
        '/entry.js': [
            'import { missing as renamed } from "./exports.js";',
            'const { good: alias, absent } = await import("./exports.js");',
            'const ns = await import("./exports.js");',
            'ns.good(); ns.nope();',
            'function shadow(ns) { return ns.nope(); }',
            '(await import("./exports.js")).other();',
        ].join('\n'),
        '/exports.js': 'export function good() {}',
    });
    assert.deepEqual(findings.map(x => [x.kind, x.name]), [
        ['missing-export', 'missing'], ['missing-export', 'absent'],
        ['missing-export', 'nope'], ['missing-export', 'other'],
    ]);
});

test('static namespace reads use their lexical binding', () => {
    const findings = audit({
        '/entry.js': 'import * as ns from "./exports.js"; ns.nope(); function f(ns) { ns.nope(); }',
        '/exports.js': 'export const good = 1;',
    });
    assert.deepEqual(findings.map(x => x.name), ['nope']);
});

test('an unawaited import is a promise, not a module namespace', () => {
    assert.deepEqual(audit({
        '/entry.js': 'const pending = import("./exports.js"); pending.then(ns => ns.good()); import("./exports.js").then(() => {});',
        '/exports.js': 'export const good = 1;',
    }), []);
});

test('re-export cycles resolve names but do not re-export default', () => {
    const findings = audit({
        '/entry.js': 'import value, { left, right, alias } from "./left.js";',
        '/left.js': 'export const left = 1; export * from "./right.js"; export { right as alias } from "./right.js";',
        '/right.js': 'export const right = 2; export default 3; export * from "./left.js";',
    });
    assert.deepEqual(findings.map(x => [x.kind, x.name]), [['missing-export', 'default']]);
});

test('exported destructuring binds its actual names', () => {
    assert.deepEqual(audit({
        '/entry.js': 'import { value, rest } from "./exports.js";',
        '/exports.js': 'export const { original: value, ...rest } = { original: 1 };',
    }), []);
});

test('missing local modules are reported without loading code', () => {
    const findings = audit({ '/entry.js': 'import "./missing.js"; throw new Error("must not execute");' });
    assert.deepEqual(findings.map(x => x.kind), ['missing-module']);
});
