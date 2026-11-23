#!/usr/bin/env node
// Compile the pinned option handler and color parser. Compare both the
// resulting style and diagnostics, including rejected and reversed values.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import '../js/jsmain.js';
import { game, resetGame } from '../js/gstate.js';
import { parseNethackrc } from '../js/options.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = Object.fromEntries(['coloratt', 'hacklib', 'options'].map(name =>
    [name, readFileSync(join(root, 'nethack-c/recorder/src', name + '.c'), 'utf8')]));
function cFunction(file, name) {
    const match = source[file].match(new RegExp('^[^\\n]+\\n' + name + '\\([^]*?^}', 'm'));
    assert.ok(match, name);
    return match[0];
}
const temp = mkdtempSync(join(tmpdir(), 'menu-headings-'));
after(() => rmSync(temp, { recursive: true, force: true }));
writeFileSync(join(temp, 'probe.c'), `
#include "hack.h"
#include <stdarg.h>
#define iflags probe_iflags
struct { color_attr menu_headings; } probe_iflags;
static char empty_optstr[] = "";
static char errors[8192];
static struct { const char *name; } allopt[] = { { "menu_headings" } };
enum { optn_silenterr = -1, optn_err = 0, optn_ok };
enum { do_nothing, do_init, do_set, do_handler, get_val, get_cnf_val };
// Only do_set is exercised. These other request paths are inert.
#define strNsubst(...) 0
static int handler_menu_headings(void) { return 0; }
void config_error_add(const char *format, ...) {
    va_list args;
    va_start(args, format);
    vsnprintf(errors + strlen(errors), sizeof errors - strlen(errors), format, args);
    va_end(args);
    strcat(errors, "\\n");
}
${source.coloratt.slice(source.coloratt.indexOf('struct color_names'),
    source.coloratt.indexOf('/* { colortyp'))}
${['digit', 'lowc', 'fuzzymatch'].map(name => cFunction('hacklib', name)).join('\n')}
${['match_str2clr', 'match_str2attr', 'clr2colorname', 'attr2attrname',
    'color_attr_parse_str', 'color_attr_to_str'].map(name => cFunction('coloratt', name)).join('\n')}
${cFunction('options', 'bad_negation')}
${cFunction('options', 'optfn_menu_headings')}
int main(int argc, char **argv) {
    char value[1024];
    if (argc != 3) return 2;
    snprintf(value, sizeof value, "%s", argv[1]);
    iflags.menu_headings.color = CLR_ORANGE;
    iflags.menu_headings.attr = ATR_BLINK;
    optfn_menu_headings(0, do_set, atoi(argv[2]), NULL,
                       *value ? value : empty_optstr);
    printf("%d,%d\\n%s", iflags.menu_headings.color, iflags.menu_headings.attr, errors);
    return 0;
}
`);
execFileSync('clang', ['-std=c99', '-I', join(root, 'nethack-c/recorder/include'),
    join(temp, 'probe.c'), '-o', join(temp, 'probe')]);

function check(value, negated = false) {
    const output = execFileSync(join(temp, 'probe'), [value ?? '', String(+negated)],
        { encoding: 'utf8' }).trimEnd().split('\n');
    const [color, attr] = output.shift().split(',').map(Number);
    resetGame();
    game.iflags = { menu_headings: { color: 9, attr: 5 } };
    const option = `${negated ? '!' : ''}menu_headings${value == null ? '' : ':' + value}`;
    const rc = parseNethackrc('OPTIONS=' + option + '\n');
    assert.deepEqual(game.iflags.menu_headings, { color, attr }, option);
    assert.deepEqual(rc.errors, output, option);
}

test('every standard color and attribute pair matches C', () => {
    for (const color of ['black', 'red', 'green', 'brown', 'blue', 'magenta',
        'cyan', 'gray', 'orange', 'light green', 'yellow', 'light blue',
        'light magenta', 'light cyan', 'white', 'no color']) {
        for (const attr of ['none', 'bold', 'dim', 'italic', 'underline', 'blink', 'inverse'])
            check(color + '&' + attr);
    }
});

test('omitted, empty and negated values follow the option handler', () => {
    for (const value of [null, '', 'red', 'red&bold']) {
        check(value);
        check(value, true);
    }
});

test('single names, aliases, numeric colors and fuzzy names match C', () => {
    for (const value of ['red', 'bold', 'none', 'normal', 'uline', 'reverse',
        'transparent', 'purple', 'bright-purple', 'grey', 'bright red',
        'LIGHT_BLUE&BoLd', '_l i-gh_t---b l u e&u_l-i n e', '0', '15',
        '08&reverse', '15tail&normal', 'bright-green&italic'])
        check(value);
});

test('invalid and reversed components preserve C diagnostics and state', () => {
    for (const value of ['bold&red', 'none&blue', 'invalid', '16', '-1',
        'red&invalid', 'invalid&bold', 'invalid&invalid', 'red&bold&inverse',
        'red&', '&bold', '&', 'x'.repeat(300), 'red&' + 'x'.repeat(300)])
        check(value);
});
