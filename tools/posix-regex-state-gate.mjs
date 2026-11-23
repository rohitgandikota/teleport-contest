#!/usr/bin/env node
// Compare the game's regex wrapper with the pinned C-locale implementation.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { regex_init, regex_compile, regex_match, regex_error_desc } from '../js/posixregex.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(join(root, 'nethack-c/recorder/sys/share/posixregex.c'), 'utf8');
const temp = mkdtempSync(join(tmpdir(), 'posix-regex-'));
after(() => rmSync(temp, { recursive: true, force: true }));
writeFileSync(join(temp, 'probe.c'), `
#include "hack.h"
#undef alloc
#define alloc malloc
${source}
// Hex arguments preserve embedded NULs and incomplete UTF-8 byte sequences.
static char *decode(const char *hex) {
    size_t n = strlen(hex) / 2, i;
    char *bytes = malloc(n + 1);
    for (i = 0; i < n; i++) {
        unsigned int byte;
        sscanf(hex + 2 * i, "%2x", &byte);
        bytes[i] = byte;
    }
    bytes[n] = '\\0';
    return bytes;
}
int main(int argc, char **argv) {
    if (argc != 3) return 2;
    char *pattern = decode(argv[1]), *text = decode(argv[2]), error[BUFSZ];
    struct nhregex *re = regex_init();
    boolean compiled = regex_compile(pattern, re);
    printf("%d\\n%d\\n%s\\n", compiled,
           compiled ? regex_match(text, re) : 0, regex_error_desc(re, error));
    regex_free(re);
    free(pattern);
    free(text);
    return 0;
}
`);
execFileSync('clang', ['-std=c99', '-I', join(root, 'nethack-c/recorder/include'),
    join(temp, 'probe.c'), '-o', join(temp, 'probe')]);

function check(pattern, text) {
    const [compiled, matched, error] = execFileSync(join(temp, 'probe'),
        [Buffer.from(pattern).toString('hex'), Buffer.from(text).toString('hex')],
        { encoding: 'utf8' }).split('\n');
    const re = regex_init();
    const actualCompiled = regex_compile(pattern, re);
    assert.equal(+actualCompiled, +compiled, 'compile: ' + pattern);
    if (actualCompiled)
        assert.equal(+regex_match(text, re), +matched, `${pattern}: ${text}`);
    else
        assert.equal(regex_error_desc(re), error, String(pattern));
}

test('ASCII expressions and compile errors match C', () => {
    for (const pattern of ['quarterstaff', '^You sit', '[[:alpha:]]+',
        '(cat|dog){1,2}', '^a.$', '[', '(', 'x\\', 'a{256}', 'a{2,1}'])
        for (const text of ['a quarterstaff', 'You sit on the stairs.', 'catdog', 'a\n'])
            check(pattern, text);
});

test('UTF-8 literals, dots and bracket classes match bytes as in C', () => {
    for (const pattern of ['^.$', '^..$', '^....$', 'caf\u00e9', '^\u00e9+$',
        '^[\u00e9]+$', '^[[:alpha:]]+$', '^\u03b1.$'])
        for (const text of ['\u00e9', '\u00e9\u00e9', 'caf\u00e9', '\u03b1x', '\ud83d\ude00'])
            check(pattern, text);
});

test('a scanf limit can leave a pattern ending inside a UTF-8 character', () => {
    const pattern = new TextEncoder().encode('x'.repeat(254) + '\u00e9').slice(0, 255);
    for (const text of ['x'.repeat(254) + '\u00e9', 'x'.repeat(254),
        'x'.repeat(254) + '\u00f6'])
        check(pattern, text);
});

test('pattern and message strings end at their first NUL byte', () => {
    for (const [pattern, text] of [['^a$\0ignored', 'a'],
        ['^a$', 'a\0ignored'], ['ignored', 'a\0ignored']])
        check(pattern, text);
});
