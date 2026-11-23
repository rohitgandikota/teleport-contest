#!/usr/bin/env node
// Compile C's shirt text and fixed-time conversion, including unsigned hashes.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import '../js/jsmain.js';
import { game, resetGame } from '../js/gstate.js';
import * as calendar from '../js/calendar.js';
import * as read from '../js/read.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = name => readFileSync(join(root, 'nethack-c/recorder/src', name), 'utf8');
function extract(text, name) {
    const fn = text.match(new RegExp(
        '^(?:staticfn )?(?:char \\*|time_t|void)\\n' + name + '\\([^]*?^}', 'm'))?.[0];
    assert.ok(fn, 'C function ' + name);
    return fn;
}
const engraving = source('engrave.c');
const rubouts = engraving.match(/static const struct \{\n    char wipefrom;[^]*?} };/)?.[0];
assert.ok(rubouts);
const temp = mkdtempSync(join(tmpdir(), 'shirt-text-'));
after(() => rmSync(temp, { recursive: true, force: true }));
writeFileSync(join(temp, 'probe.c'), `
#include "hack.h"
#undef rn2
#define TIME_type time_t *
#define LOCALTIME_type time_t *
time_t ubirthday;
// These cases exercise the seeded path. Abort if a case reaches random erosion.
int rn2(int n) { (void) n; abort(); }
${rubouts}
${extract(engraving, 'wipeout_text')}
${['erode_obj_text', 'tshirt_text', 'hawaiian_motif', 'apron_text']
    .map(name => extract(source('read.c'), name)).join('\n')}
${extract(source('calendar.c'), 'time_from_yyyymmddhhmmss')}
int main(int argc, char **argv) {
    unsigned birthdays[] = { 0U, 947683800U, 1784099514U, 2147483648U, 4294967295U };
    unsigned b, id, erosion;
    struct obj item = { 0 };
    char motif[BUFSZ], shirt[BUFSZ], apron[BUFSZ];
    if (argc == 2) {
        printf("%lld\\n", (long long) time_from_yyyymmddhhmmss(argv[1]));
        return 0;
    }
    for (b = 0; b < SIZE(birthdays); b++)
        for (id = 1; id <= 96; id++) {
            unsigned seed = id ^ birthdays[b];
            if (!seed || (seed * 31U) % (BUFSZ - 1) == 0)
                continue;
            ubirthday = birthdays[b];
            item.o_id = id;
            for (erosion = 0; erosion <= MAX_ERODE; erosion++) {
                item.oeroded = erosion;
                hawaiian_motif(&item, motif);
                tshirt_text(&item, shirt);
                apron_text(&item, apron);
                printf("%u\\t%u\\t%u\\t%s\\t%s\\t%s\\n",
                       birthdays[b], id, erosion, motif, shirt, apron);
            }
        }
    return 0;
}
`);
execFileSync('clang', ['-std=c99', '-I', join(root, 'nethack-c/recorder/include'),
    join(temp, 'probe.c'), '-o', join(temp, 'probe')]);
const rows = execFileSync(join(temp, 'probe'), { encoding: 'utf8' })
    .trimEnd().split('\n').map(line => line.split('\t'));

test('fixed timestamps match C with the recorder timezone', () => {
    resetGame();
    for (const date of ['20000112093000', '20000601120000', '20260215002847',
        '20260308015959', '20260308030000', '20261101013000', '20261114004959',
        '20400101000000']) {
        game.fixed_datetime = date;
        const native = Number(execFileSync(join(temp, 'probe'), [date], {
            encoding: 'utf8', env: { ...process.env, TZ: 'Etc/GMT+4' },
        }));
        assert.equal(calendar.getnow_seconds(), native, date);
    }
});

test(`${rows.length} motif and erosion combinations match C`, () => {
    resetGame();
    const differences = [];
    for (const [birthday, id, erosion, motif, shirt, apron] of rows) {
        game.ubirthday = +birthday;
        const obj = { o_id: +id, oeroded: +erosion, oeroded2: 0 };
        const label = `${birthday}/${id}/${erosion}`;
        for (const [name, actual, expected] of [
            ['motif', read.hawaiian_motif(obj), motif],
            ['shirt', read.tshirt_text(obj), shirt],
            ['apron', read.apron_text(obj), apron],
        ])
            if (actual !== expected)
                differences.push({ name, label, actual, expected });
    }
    assert.equal(differences.length, 0, JSON.stringify(differences.slice(0, 8)));
});
