#!/usr/bin/env node
// Compile the recorder patch's raw-output capture code. A reset separates
// output streams without moving the cursor already visible on the terminal.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const patch = readFileSync(process.argv[2]
    || join(root, 'nethack-c/patches/006-nomux-capture.patch'), 'utf8');
const additions = patch.split('\n').filter(line => line.startsWith('+')
    && !line.startsWith('+++')).map(line => line.slice(1)).join('\n');
const start = additions.indexOf('/* Raw-mode shadow tracking');
assert.ok(start >= 0);
const rawCapture = additions.slice(start,
    additions.indexOf('#endif /* NOMUX_CAPTURE */', start));
const temp = mkdtempSync(join(tmpdir(), 'recorder-cursor-'));
try {
    writeFileSync(join(temp, 'probe.c'), `
#include <assert.h>
#include <stdio.h>
#include <string.h>
struct cell { char ch; int fg, attr, decgfx; } nomux_buf[24][80];
struct display { int curx, cury; } display = { 37, 12 }, *ttyDisplay = &display;
int nomux_fg_cur, nomux_attr_cur, nomux_decgfx_cur;
int nomux_markers_enabled(void) { return 1; }
void nomux_clear_screen(void) { memset(nomux_buf, 0, sizeof nomux_buf); }
${rawCapture}
int main(void) {
    int x, y;
    nomux_get_cursor(&x, &y);
    assert(x == 37 && y == 12);
    nomux_raw_emit("Be seeing you...", 0);
    nomux_get_cursor(&x, &y);
    assert(x == 0 && y == 1);
    nomux_reset_raw_mode();
    ttyDisplay = NULL;
    nomux_get_cursor(&x, &y);
    assert(x == 0 && y == 1);
    assert(nomux_buf[0][0].ch == 'B');
    nomux_raw_emit("Top ten", 0);
    nomux_get_cursor(&x, &y);
    assert(x == 0 && y == 1);
    assert(nomux_buf[0][0].ch == 'T' && !nomux_buf[1][0].ch);
    nomux_raw_emit("Second line", 1);
    nomux_get_cursor(&x, &y);
    assert(x == 0 && y == 2);
    nomux_reset_raw_mode();
    nomux_get_cursor(&x, &y);
    assert(x == 0 && y == 2);
    ttyDisplay = &display;
    nomux_get_cursor(&x, &y);
    assert(x == 37 && y == 12);
    puts("7 cursor states and stream separation match terminal output");
    return 0;
}
`);
    execFileSync('clang', ['-std=c99', join(temp, 'probe.c'), '-o', join(temp, 'probe')]);
    process.stdout.write(execFileSync(join(temp, 'probe'), { encoding: 'utf8' }));
} finally {
    rmSync(temp, { recursive: true, force: true });
}
