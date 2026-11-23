#!/usr/bin/env node
// Compare ordered binding records and lookup results with the pinned C code.
// Command bodies are inert: this gate tests bindings, not gameplay effects.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import '../js/jsmain.js';
import { game, resetGame } from '../js/gstate.js';
import * as cmd from '../js/cmd.js';
import { extcmdlist } from '../js/extcmd_data.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(join(root, 'nethack-c/recorder/src/cmd.c'), 'utf8');
function cFunction(name) {
    const match = source.match(new RegExp('^[^\\n]+\\n' + name + '\\([^]*?^}', 'm'));
    assert.ok(match, name);
    return match[0];
}
const table = source.match(/^struct ext_func_tab extcmdlist\[\] = \{[^]*?^};/m)[0];
const moves = source.match(/^static int \(\*move_funcs[^]*?^};/m)[0];
const special = source.slice(source.indexOf('static struct {', source.indexOf('shortened %s')))
    .match(/^static struct \{[^]*?^};/m)[0];
assert.ok(special.includes('spkeys_binds'));
const functions = [...new Set(extcmdlist.map(ec => ec.ef_funct))];
assert.ok(functions.every(Boolean));
const temp = mkdtempSync(join(tmpdir(), 'command-table-'));
after(() => rmSync(temp, { recursive: true, force: true }));
writeFileSync(join(temp, 'probe.c'), `
#include "hack.h"
#include "func_tab.h"
#include <strings.h>
#undef alloc
#define alloc malloc
#undef strcmpi
#define gc probe_gc
#define iflags probe_iflags
struct { struct {
    struct Cmd_bind *cmdbinds;
    boolean num_pad, swap_yz, pcHack_compat, phone_layout;
    int serialno, spkeys[64];
    char extcmd_char;
    const char *dirchars, *alphadirchars;
} Cmd; } probe_gc;
struct flag flags;
struct { boolean num_pad; int num_pad_mode; } probe_iflags;
${functions.map(fn => `#define ${fn} probe_${fn}\nstatic int probe_${fn}(void) { return 0; }`).join('\n')}
${table}
${moves}
${special}
static int extcmdlist_length = SIZE(extcmdlist) - 1;
static void cmdbind_remove(uchar key);
int strcmpi(const char *a, const char *b) { return strcasecmp(a, b); }
char highc(char c) { return c >= 'a' && c <= 'z' ? c - 'a' + 'A' : c; }
void config_error_add(const char *format, ...) { }
boolean bind_mousebtn(int button, const char *name) { return TRUE; }
${['cmdbind_get', 'cmdbind_remove', 'cmdbind_add', 'cmdbind_swapkeys',
    'count_bind_keys', 'bind_key', 'bind_key_fn', 'commands_init',
    'ext_func_tab_from_func', 'cmd_from_func', 'update_rest_on_space',
    'reset_commands'].map(cFunction).join('\n')}
static void snapshot(void) {
    struct Cmd_bind *b;
    int i, first = 1;
    printf("[%d,%d,%d,%d,%d,\\"%s\\",\\"%s\\",%u,%d,[",
        gc.Cmd.serialno, gc.Cmd.num_pad, gc.Cmd.swap_yz,
        gc.Cmd.pcHack_compat, gc.Cmd.phone_layout, gc.Cmd.dirchars,
        gc.Cmd.alphadirchars, (uchar) gc.Cmd.extcmd_char, count_bind_keys());
    for (b = gc.Cmd.cmdbinds; b; b = b->next) {
        printf("%s[%u,%d,", first ? "" : ",", b->key, b->userbind);
        if (b->cmd) printf("\\"%s\\"", b->cmd->ef_txt); else printf("null");
        if (b->param) printf(",\\"%s\\"]", b->param); else printf(",null]");
        first = 0;
    }
    printf("],[");
    for (i = 0; i < extcmdlist_length; i++)
        printf("%s[\\"%s\\",%u,\\"%s\\"]", i ? "," : "", extcmdlist[i].ef_txt,
            (uchar) cmd_from_func(extcmdlist[i].ef_funct),
            extcmdlist[i].f_text ? extcmdlist[i].f_text : "");
    printf("]]\\n");
}
int main(void) {
    char operation[8], text[256];
    int key, mode;
    reset_commands(TRUE);
    snapshot();
    while (scanf("%7s", operation) == 1) {
        if (!strcmp(operation, "bind")) {
            if (scanf("%d%255s", &key, text) != 2) return 2;
            bind_key(key, text, TRUE);
        } else if (!strcmp(operation, "pad")) {
            if (scanf("%d", &mode) != 1) return 3;
            iflags.num_pad = mode > 0;
            iflags.num_pad_mode = mode < 0 ? 1 : mode > 0 ? mode - 1 : 0;
            reset_commands(FALSE);
        } else if (!strcmp(operation, "rest")) {
            if (scanf("%d", &mode) != 1) return 4;
            flags.rest_on_space = mode;
            update_rest_on_space();
        } else return 5;
        snapshot();
    }
    return 0;
}
`);
execFileSync('clang', ['-std=c99', '-I', join(root, 'nethack-c/recorder/include'),
    join(temp, 'probe.c'), '-o', join(temp, 'probe')]);

function snapshot() {
    const c = game.Cmd;
    return [c.serialno, +c.num_pad, +c.swap_yz, +c.pcHack_compat, +c.phone_layout,
        c.dirchars, c.alphadirchars, c.extcmd_char.charCodeAt(0), cmd.count_bind_keys(),
        c.cmdbinds.map(b => [b.key, +b.userbind, b.cmd?.ef_txt || null, b.param]),
        extcmdlist.map(ec => [ec.ef_txt, cmd.cmd_from_func(ec.ef_txt).charCodeAt(0),
            ec.f_text || ''])];
}

function compare(operations) {
    const expected = execFileSync(join(temp, 'probe'), [], {
        input: operations.map(op => op.join(' ')).join('\n') + '\n',
        encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    }).trim().split('\n').map(JSON.parse);
    resetGame();
    game.flags = {};
    game.iflags = {};
    cmd.reset_commands(true);
    assert.deepEqual(snapshot(), expected[0], 'initial bindings');
    for (const [i, [op, value, name]] of operations.entries()) {
        if (op === 'bind')
            cmd.bind_key(value, name);
        else if (op === 'pad') {
            game.iflags.num_pad = value > 0;
            game.iflags.num_pad_mode = value < 0 ? 1 : value > 0 ? value - 1 : 0;
            cmd.reset_commands(false);
        } else {
            game.flags.rest_on_space = !!value;
            cmd.update_rest_on_space();
        }
        assert.deepEqual(snapshot(), expected[i + 1], `operation ${i}: ${operations[i]}`);
    }
}

test('newest bindings, replacements, removal and parameter lifetime match C', () => {
    compare([['bind', 126, 'versionshort'], ['bind', 33, 'versionshort'],
        ['bind', 126, 'inventory'], ['bind', 126, 'versionshort'],
        ['bind', 33, 'nothing'], ['bind', 86, 'nothing'],
        ['bind', 126, 'toggle(autopickup)'], ['bind', 126, 'versionshort'],
        ['bind', 126, 'toggle(rest_on_space)'], ['bind', 126, 'toggle'],
        ['bind', 126, 'nothing'], ['bind', 126, 'nothing']]);
});

for (let from = -1; from <= 4; from++) {
    test(`all keypad transitions from mode ${from} match C`, () => {
        const operations = [['pad', from]];
        for (let to = -1; to <= 4; to++)
            operations.push(['bind', 104, 'versionshort'], ['pad', to],
                ['bind', 121, 'toggle(autopickup)'], ['pad', to],
                ['pad', from]);
        compare(operations);
    });
}

test('space overrides restore their saved command and discard its parameter', () => {
    compare([['bind', 32, 'versionshort'], ['rest', 0], ['rest', 1], ['rest', 0],
        ['bind', 32, 'toggle(autopickup)'], ['rest', 1], ['rest', 0],
        ['bind', 46, 'nothing'], ['rest', 1], ['pad', 3], ['rest', 0]]);
});

test('mixed bindings and repeated layout changes agree after every operation', () => {
    let seed = 115073;
    const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
    const commands = ['inventory', 'versionshort', 'wait', 'search', 'name', 'call',
        'movewest', 'runnorthwest', 'rushsouth', 'fight', 'reqmenu', '#',
        'toggle(autopickup)', 'toggle(rest_on_space)', 'nothing'];
    const keys = [1, 9, 14, 25, 32, 33, 45, 46, 48, 49, 50, 51, 53, 54, 55, 56,
        57, 67, 78, 86, 89, 90, 104, 105, 106, 107, 108, 109, 110, 121, 122, 126,
        153, 176, 177, 178, 179, 181, 183, 184, 185, 206, 217, 249];
    const operations = Array.from({ length: 400 }, () => {
        const op = random(6);
        return op < 4 ? ['bind', keys[random(keys.length)], commands[random(commands.length)]]
            : op === 4 ? ['pad', random(6) - 1] : ['rest', random(2)];
    });
    compare(operations);
});
