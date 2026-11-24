// Pinned-C contract witnesses. Reads source; does not execute or replace C/JS.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
const sources = [];
const checks = [];
const read = file => readFileSync(new URL(file, root), 'utf8');

function body(file, name, javascript = false) {
    const source = read(file);
    const prefix = javascript ? '(?:export )?(?:async )?function ' : '';
    const match = source.match(new RegExp(`^${prefix}${name}\\([^]*?^}`, 'm'));
    assert.ok(match, `${file}: ${name}`);
    sources.push({ file, function: name,
        line: source.slice(0, match.index).split('\n').length,
        sha256: hash(match[0]), fileSha256: hash(source) });
    return match[0];
}

function check(name, verify) {
    try {
        verify();
        checks.push({ name, passed: true });
    } catch (error) {
        checks.push({ name, passed: false, error: error.message });
    }
}

const declarations = read('nethack-c/recorder/include/decl.h');
const defaults = read('nethack-c/recorder/src/decl.c');
const initialize = body('nethack-c/recorder/src/decl.c', 'decl_globals_init');
const assign = body('nethack-c/recorder/src/invent.c', 'assigninvlet');
const inventory = body('nethack-c/recorder/src/u_init.c', 'u_init_inventory_attrs');
const save = body('nethack-c/recorder/src/save.c', 'savegamestate');
const restore = body('nethack-c/recorder/src/restore.c', 'restgamestate');
const reset = body('js/gstate.js', 'resetGame', true);
const encode = body('js/save.js', 'gamestate_encode', true);
const checkpoint = body('js/save.js', 'save_checkpoint', true);
const restoreJs = body('js/restore.js', 'restgamestate', true);

check('C declares the allocation counter never saved or restored', () => {
    assert.match(declarations, /int lastinvnr;\s*\/\* 0 \.\.\. 51 \(never saved&restored\) \*\//);
});

check('C installs 51 at process initialization and inventory initialization', () => {
    const initial = defaults.match(/static const struct instance_globals_l g_init_l = \{[^]*?^};/m);
    assert.ok(initial);
    assert.match(initial[0], /51, \/\* lastinvr \*\//);
    assert.match(initialize, /gl = g_init_l;/);
    assert.match(inventory, /gl\.lastinvnr = 51;[^]*while \(gi\.invent\)/);
});

check('C preserves occupied letters and starts searching after the process counter', () => {
    assert.match(assign, /obj != otmp/);
    assert.match(assign, /if \(\(i = otmp->invlet\)[^]*?return;/);
    assert.match(assign, /for \(i = gl\.lastinvnr \+ 1; i != gl\.lastinvnr; i\+\+\)/);
    assert.match(assign, /i = -1;[^]*?continue;/);
    assert.match(assign, /inuse\[i\] \? NOINVSYM/);
});

check('C saves and restores inventory owners without the allocation counter', () => {
    assert.match(save, /saveobjchn\(nhfp, &gi\.invent\)/);
    assert.match(restore, /gi\.invent = restobjchn\(nhfp, FALSE\)/);
    assert.doesNotMatch(save, /lastinvnr/);
    assert.doesNotMatch(restore, /lastinvnr/);
});

check('JS process initialization supplies 51 before boot or recovery', () => {
    assert.match(reset, /game = \{ lastinvnr: 51 \};/);
    const main = read('js/jsmain.js');
    assert.ok(main.indexOf('const g = resetGame();') < main.indexOf('await newgame();'));
});

check('JS excludes only the root counter from newly encoded saves', () => {
    const skip = read('js/save.js').match(/export const SAVE_SKIP_KEYS = new Set\(\[[^]*?\]\);/);
    assert.ok(skip);
    assert.match(skip[0], /'lastinvnr'/);
    assert.match(encode, /depth === 0 && SAVE_SKIP_KEYS\.has\(k\)/);
});

check('JS ignores legacy saved counters and retains the current process value', () => {
    assert.match(restoreJs, /for \(const key of Object\.keys\(game\)\)\s*if \(!SAVE_SKIP_KEYS\.has\(key\)/);
    assert.match(restoreJs, /for \(const \[key, value\] of Object\.entries\(saved\)\)\s*if \(!SAVE_SKIP_KEYS\.has\(key\)/);
});

check('Failed-write checkpoint retains the live root record without JSON filtering', () => {
    assert.match(checkpoint, /for \(const record of \[game, game\.u/);
    assert.match(checkpoint, /remember\(record\)/);
    assert.match(checkpoint, /Object\.assign\(record, saved\)/);
    assert.doesNotMatch(checkpoint, /gamestate_encode|SAVE_SKIP_KEYS/);
});

const failures = checks.filter(check => !check.passed);
console.log(JSON.stringify({ evidence: 'source assertions, not a compiled C oracle',
    passed: checks.length - failures.length, total: checks.length, checks, sources }, null, 4));
process.exitCode = failures.length ? 1 : 0;
