#!/usr/bin/env node
// Compare configuration parsing and regex compilation with the pinned C code.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import '../js/jsmain.js';
import { game, resetGame } from '../js/gstate.js';
import { parseNethackrc, msgtype_type } from '../js/options.js';
import { mungspaces } from '../js/hacklib.js';
import { MSGTYP_NORMAL, MSGTYP_NOSHOW, MSGTYP_NOREP } from '../js/const.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(join(root, 'nethack-c/recorder/src/options.c'), 'utf8');
const handler = source.match(/^boolean\nmsgtype_parse_add\([^]*?^}/m)?.[0];
const add = source.match(/^staticfn boolean\nmsgtype_add\([^]*?^}/m)?.[0];
const free = source.match(/^void\nmsgtype_free\([^]*?^}/m)?.[0];
const names = source.match(/^static const struct \{\n    const char \*name;\n    xint8 msgtyp;[^]*?^};/m)?.[0];
const regex = readFileSync(join(root, 'nethack-c/recorder/sys/share/posixregex.c'), 'utf8');
assert.ok(handler && add && free && names);
const temp = mkdtempSync(join(tmpdir(), 'message-type-'));
after(() => rmSync(temp, { recursive: true, force: true }));
writeFileSync(join(temp, 'probe.c'), `
#include "hack.h"
#include <stdarg.h>
#include <strings.h>
#undef alloc
#define alloc malloc
#define dupstr strdup
#define gp probe_gp
static struct { struct plinemsg_type *plinemsg_types; } probe_gp;
static char diagnostic[1024];
boolean str_start_is(const char *text, const char *prefix, boolean insensitive) {
    return !strncasecmp(text, prefix, strlen(prefix));
}
void config_error_add(const char *format, ...) {
    va_list args;
    va_start(args, format);
    vsnprintf(diagnostic, sizeof diagnostic, format, args);
    va_end(args);
}
${names}
${regex}
${add}
${free}
${handler}
int main(int argc, char **argv) {
    if (argc != 2) return 2;
    msgtype_parse_add(argv[1]);
    struct plinemsg_type *rule = gp.plinemsg_types;
    printf("%d\\n%s\\n%s\\n", rule ? rule->msgtype : -1,
           rule ? rule->pattern : "", diagnostic);
    msgtype_free();
    return 0;
}
`);
execFileSync('clang', ['-std=c99', '-I', join(root, 'nethack-c/recorder/include'),
    join(temp, 'probe.c'), '-o', join(temp, 'probe')]);

function check(value) {
    const [type, pattern, error] = execFileSync(join(temp, 'probe'),
        [mungspaces(value)], { encoding: 'utf8' }).split('\n');
    resetGame();
    const rc = parseNethackrc('MSGTYPE=' + value + '\n');
    const rule = game.plinemsg_types?.[0];
    assert.deepEqual(rule ? [rule.msgtype, rule.pattern] : [-1, ''],
        [+type, pattern], value);
    assert.deepEqual(rc.errors, error ? [error] : [], value);
    assert.deepEqual(rc.unhandled, [], value);
}

test('message names, aliases, prefixes and case match C', () => {
    for (const name of ['show', 'hide', 'noshow', 'stop', 'more', 'norep',
        's', 'h', 'n', 'no', 'nor', 'st', 'm', 'SHOW', 'NoReP'])
        check(name + ' "a message"');
});

test('scanning limits, whitespace and malformed input match C', () => {
    for (const value of ['', 'show', 'show ""', 'show message',
        'show "unterminated', 'show "first" ignored', 'show"without space"',
        ' \tshow  "spaced   message" ', 'unknown "message"',
        'normal "message"', 'abcdefghijk "message"', 'abcdefghij"message"',
        'show "' + 'x'.repeat(255) + '"', 'show "' + 'x'.repeat(256) + '"'])
        check(value);
});

test('regex compilation reports C diagnostics and preserves valid patterns', () => {
    for (const pattern of ['[', '(', 'x\\', 'a{256}', 'a{2,1}',
        '[[:alpha:]]+', '^You sit on', 'caf\u00e9', 'x'.repeat(254) + '\u00e9'])
        check('hide "' + pattern + '"');
});

test('later matching rules win and nonmatching messages use the default', () => {
    resetGame();
    parseNethackrc('MSGTYPE=hide "message"\nMSGTYPE=show "specific message"\n');
    assert.equal(msgtype_type('a message', false), MSGTYP_NOSHOW);
    assert.equal(msgtype_type('specific message', false), MSGTYP_NORMAL);
    assert.equal(msgtype_type('unrelated', false), MSGTYP_NORMAL);
    assert.equal(msgtype_type('unrelated', true), MSGTYP_NOREP);
});

test('a new process has no message rules from the previous process', () => {
    resetGame();
    parseNethackrc('MSGTYPE=hide "message"\n');
    assert.equal(msgtype_type('message', false), MSGTYP_NOSHOW);
    resetGame();
    parseNethackrc('');
    assert.equal(msgtype_type('message', false), MSGTYP_NORMAL);
});
