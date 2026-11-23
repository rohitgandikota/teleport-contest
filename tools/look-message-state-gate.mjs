#!/usr/bin/env node
// Compare temporary message-rule suppression with the original C function.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import '../js/jsmain.js';
import { game, resetGame } from '../js/gstate.js';
import * as options from '../js/options.js';
import { MSGTYP_MASK_REP_SHOW, MSGTYP_NOSHOW } from '../js/const.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(join(root, 'nethack-c/recorder/src/options.c'), 'utf8');
const fn = source.match(/^void\nhide_unhide_msgtypes\([^]*?^}/m)?.[0];
assert.ok(fn);
const temp = mkdtempSync(join(tmpdir(), 'look-message-'));
after(() => rmSync(temp, { recursive: true, force: true }));
writeFileSync(join(temp, 'probe.c'), `
#include "hack.h"
#define gp probe_gp
static struct { struct plinemsg_type *plinemsg_types; } probe_gp;
${fn}
int main(void) {
    struct plinemsg_type rules[7] = { 0 };
    int hide, mask, i;
    gp.plinemsg_types = rules;
    for (hide = 0; hide <= 1; hide++)
        for (mask = 0; mask < 16; mask++) {
            for (i = 0; i < 7; i++) {
                rules[i].msgtype = i - 3;
                rules[i].next = i < 6 ? &rules[i + 1] : NULL;
            }
            hide_unhide_msgtypes(hide, mask);
            for (i = 0; i < 7; i++)
                printf("%s%d", i ? "," : "[", rules[i].msgtype);
            puts("]");
        }
    return 0;
}
`);
execFileSync('clang', ['-std=c99', '-I', join(root, 'nethack-c/recorder/include'),
    join(temp, 'probe.c'), '-o', join(temp, 'probe')]);
const native = execFileSync(join(temp, 'probe'), { encoding: 'utf8' })
    .trim().split('\n').map(line => JSON.parse(line));

for (const hide of [false, true]) {
    test(`${hide ? 'hiding' : 'unhiding'} every message mask matches C`, () => {
        for (let mask = 0; mask < 16; mask++) {
            resetGame();
            game.plinemsg_types = Array.from({ length: 7 }, (_, i) => ({ msgtype: i - 3 }));
            options.hide_unhide_msgtypes(hide, mask);
            assert.deepEqual(game.plinemsg_types.map(rule => rule.msgtype),
                native[+hide * 16 + mask], 'mask ' + mask);
        }
    });
}

test('a temporarily disabled first match still takes precedence over later rules', () => {
    resetGame();
    options.parseNethackrc('MSGTYPE=stop "item"\nMSGTYPE=hide "item"\n');
    options.hide_unhide_msgtypes(true, MSGTYP_MASK_REP_SHOW);
    assert.equal(options.msgtype_type('item', false), -MSGTYP_NOSHOW);
    options.hide_unhide_msgtypes(false, MSGTYP_MASK_REP_SHOW);
    assert.equal(options.msgtype_type('item', false), MSGTYP_NOSHOW);
});
