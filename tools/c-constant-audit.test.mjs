import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { probeConstants, compareConstants } from './c-constant-audit.mjs';

test('C evaluates aliases and wide flags; runtime names and missing symbols are rejected', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nethack-constants-'));
    try {
        writeFileSync(join(dir, 'hack.h'), `
enum { BASE = 2, NEXT, ALIAS = NEXT };
#define HIGH (1ULL << 40)
#define TOP (1ULL << 63)
#define NEGATIVE (-2LL)
#define MASK (1UL << 31)
extern int RUNTIME;
#define FUNCTION(x) ((x) + 1)
`);
        const { values, rejected } = probeConstants(
            ['BASE', 'NEXT', 'ALIAS', 'HIGH', 'TOP', 'NEGATIVE', 'MASK', 'RUNTIME', 'MISSING', 'FUNCTION'],
            dir, dir);
        assert.equal(values.ALIAS.value, '3');
        assert.equal(values.HIGH.value, '1099511627776');
        assert.equal(values.TOP.value, '9223372036854775808');
        assert.equal(values.NEGATIVE.value, '-2');
        assert.deepEqual(rejected.map(r => r.name).sort(), ['FUNCTION', 'MISSING', 'RUNTIME']);
        assert.ok(rejected.every(r => r.reason.length));
        const result = compareConstants([
            ['BASE', 2], ['ALIAS', 4], ['HIGH', 1n << 40n], ['MASK', -2147483648],
        ], values);
        assert.deepEqual(result.mismatches, [{ name: 'ALIAS', js: '4', c: '3', bytes: 4 }]);
        assert.deepEqual(result.representations.map(r => r.name), ['MASK']);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('header errors fail the audit rather than crediting an empty comparison', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nethack-constants-'));
    try {
        writeFileSync(join(dir, 'hack.h'), '#error broken header\n');
        assert.throws(() => probeConstants(['VALUE'], dir, dir), /broken header/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
