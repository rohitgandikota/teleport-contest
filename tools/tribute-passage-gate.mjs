#!/usr/bin/env node
// Compare choose_passage's draws, choices and remaining pool with compiled C.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import '../js/jsmain.js';
import { game, resetGame } from '../js/gstate.js';
import { enableRngLog, getRngLog, initRng, rn2 } from '../js/rng.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const c = readFileSync(join(root, 'nethack-c/recorder/src/files.c'), 'utf8');
const js = readFileSync(join(root, 'js/files.js'), 'utf8');
const cFunction = c.match(/^staticfn int\nchoose_passage\([^]*?^}/m)?.[0];
const jsFunction = js.match(/^function choose_passage\([^]*?^}/m)?.[0];
const jsLimit = js.match(/^const MAXPASSAGES = [^\n]+/m)?.[0];
assert.ok(cFunction && jsFunction && jsLimit);
// Keep the game function private. Compile its unchanged source with the same
// game and RNG imports that files.js uses.
const bindChoose = new Function('game', 'rn2',
    jsLimit + '\n' + jsFunction + '\nreturn choose_passage;');
const temp = mkdtempSync(join(tmpdir(), 'tribute-passages-'));
after(() => rmSync(temp, { recursive: true, force: true }));
writeFileSync(join(temp, 'probe.c'), `
#include "hack.h"
#undef rn2
#define svc probe_svc
struct { struct { struct novel_tracking novel; } context; } probe_svc;
#define MAXPASSAGES SIZE(svc.context.novel.pasg)
static int remaining;
int rn2(int bound) {
    int observed, value;
    if (remaining-- <= 0 || scanf("%d%d", &observed, &value) != 2)
        exit(2);
    if (observed != bound) {
        fprintf(stderr, "rn2 bound: C=%d, JS=%d\\n", bound, observed);
        exit(3);
    }
    return value;
}
${cFunction}
int main(void) {
    int count, result, i;
    unsigned oid;
    while (scanf("%d%u%d", &count, &oid, &remaining) == 3) {
        result = choose_passage(count, oid);
        if (remaining) return 4;
        printf("[%u,%d,[", svc.context.novel.id, svc.context.novel.count);
        for (i = 0; i < svc.context.novel.count; i++)
            printf("%s%d", i ? "," : "", svc.context.novel.pasg[i]);
        printf("],%d]\\n", result);
    }
    return 0;
}
`);
execFileSync('clang', ['-std=c99', '-I', join(root, 'nethack-c/recorder/include'),
    join(temp, 'probe.c'), '-o', join(temp, 'probe')]);

function compare(calls, seed) {
    resetGame();
    initRng(seed);
    enableRngLog();
    const choose = bindChoose(game, rn2);
    const expected = [], input = [];
    for (const [count, oid] of calls) {
        const mark = getRngLog().length;
        const result = choose(count, oid);
        const draws = getRngLog().slice(mark).map(line => {
            const match = /^rn2\((\d+)\)=(\d+)/.exec(line);
            assert.ok(match, line);
            return match[1] + ' ' + match[2];
        });
        input.push(`${count} ${oid} ${draws.length}`, ...draws);
        const novel = game.context.novel;
        expected.push([novel.id, novel.count, novel.pasg.slice(0, novel.count), result]);
    }
    const actual = execFileSync(join(temp, 'probe'), [], {
        input: input.join('\n') + '\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(actual, expected);
}

for (const count of [-1, 0, 1, 2, 20, 21, 29, 30, 31, 63, 100]) {
    test(`${count} passages agree through pool exhaustion and refill`, () => {
        const calls = Array.from({ length: 2 * Math.min(Math.max(count, 1), 30) + 3 },
            () => [count, 123]);
        for (const seed of [1, 31, 99584])
            compare(calls, seed);
    });
}

test('changing books resets the pool; empty books preserve it', () => {
    compare([[31, 1], [31, 1], [0, 2], [7, 2], [7, 2], [31, 1], [2, 3]], 23);
});
