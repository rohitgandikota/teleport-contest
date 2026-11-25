import assert from 'node:assert/strict';
import {test, after} from 'node:test';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {resetInputState} from '../js/input.js';
import {display_nhwindow_message} from '../js/display.js';
import {doterrain} from '../js/cmd.js';
import {tty_create_nhwindow, tty_start_menu, tty_add_menu, tty_end_menu,
    tty_select_menu, tty_get_nhwindow, tty_destroy_nhwindow, NHW_MENU} from '../js/tty/wintty.js';
import {PICK_ONE, MENU_ITEMFLAGS_SELECTED, MENU_ITEMFLAGS_NONE,
    TER_MAP, TER_TRP, TER_OBJ, TER_FULL} from '../js/const.js';
import {NO_COLOR} from '../js/terminal.js';

const receipt = process.argv[2], observations = [];
const boot = {seed: 9770, datetime: '20000112093000', moves: ' ',
    nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,!verbose,pettype:none,pauper,nudist\n'
        + 'OPTIONS=suppress_alert:3.4.3\nOPTIONS=symset:plain\n'};
async function ready() {
    const run = await runSegment({...boot, storage: new InMemoryStorage()});
    resetInputState();
    run._display.onEmptyQueue = () => 32;
    await display_nhwindow_message();
    return run;
}
const outputs = run => ({screens: run.getScreens(), cursors: run.getCursors(),
    rng: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep()});
const hashes = run => Object.fromEntries(Object.entries(outputs(run)).map(([key, value]) =>
    [key, createHash('sha256').update(JSON.stringify(value)).digest('hex')]));
function observe() {
    const display = game.nhDisplay;
    return {terrainmode: game.iflags.terrainmode || 0,
        top: display.grid[0].map(cell => cell.ch).join('').trimEnd(),
        cursor: [display.cursorCol, display.cursorRow], botDisabled: game.bot_disabled,
        windowActive: tty_get_nhwindow(game.ttyDisplay?.lastwin)?.active};
}
async function terrain(choice, name, observeReads = true) {
    const run = await ready(), reads = [];
    let count = 0;
    run._display.onEmptyQueue = () => {
        if (observeReads) reads.push(observe());
        assert.ok(++count <= 5, 'bounded terrain input');
        return count === 1 ? choice.charCodeAt(0) : 27;
    };
    const savedAutodescribe = game.iflags.autodescribe;
    const result = await doterrain();
    const out = {name, choice, result, inputCount: count, reads,
        finalTerrainmode: game.iflags.terrainmode || 0,
        autodescribeRestored: game.iflags.autodescribe === savedAutodescribe,
        botDisabledRestored: game.bot_disabled === false, hashes: hashes(run)};
    observations.push(out);
    return out;
}

for (const [key, values, cancelled] of [['\x1b', [], true], [' ', [1], false],
    ['a', [], false], ['b', [1, 2], false]])
test(`real select_menu preserves its result after dismissal for ${JSON.stringify(key)}`, async () => {
    const run = await ready(), win = tty_create_nhwindow(NHW_MENU);
    tty_start_menu(win, 0);
    tty_add_menu(win, null, 1, 'a', 0, 0, NO_COLOR, 'Default', MENU_ITEMFLAGS_SELECTED);
    tty_add_menu(win, null, 2, 'b', 0, 0, NO_COLOR, 'Other', MENU_ITEMFLAGS_NONE);
    tty_end_menu(win, 'Select one');
    let reads = 0;
    run._display.onEmptyQueue = () => { assert.equal(++reads, 1); return key.charCodeAt(0); };
    const picks = await tty_select_menu(win, PICK_ONE);
    assert.deepEqual([...picks], values);
    assert.equal(picks.cancelled, cancelled);
    assert.equal(tty_get_nhwindow(win).cancelled, false, 'C dismissal clears window flags');
    assert.equal(tty_get_nhwindow(win).active, 0);
    await tty_destroy_nhwindow(win);
    assert.equal(picks.cancelled, cancelled, 'result remains valid after window destruction');
});

test('Escape cancels doterrain without a terrain prompt or another input read', async () => {
    const out = await terrain('\x1b', 'cancel');
    assert.equal(out.result, 0);
    assert.equal(out.inputCount, 1);
    assert.equal(out.reads[0].terrainmode, 0);
    assert.ok(!out.reads.some(r => r.top.startsWith('Showing ')));
    assert.equal(out.finalTerrainmode, 0);
    assert.equal(out.autodescribeRestored, true);
    assert.equal(out.botDisabledRestored, true);
});

for (const [name, key, mode] of [['implicit-default', ' ', TER_MAP],
    ['explicit-deselection', 'a', TER_MAP], ['traps', 'b', TER_MAP | TER_TRP],
    ['objects', 'c', TER_MAP | TER_TRP | TER_OBJ], ['full-map', 'd', TER_MAP | TER_FULL]])
test(`doterrain ${name} reaches and finishes the real terrain browser`, async () => {
    const out = await terrain(key, name);
    assert.equal(out.result, 0);
    assert.equal(out.reads[0].terrainmode, 0);
    assert.ok(out.reads.some(r => r.terrainmode === mode), `expected terrainmode ${mode}`);
    assert.equal(out.finalTerrainmode, 0);
    assert.equal(out.autodescribeRestored, true);
    assert.equal(out.botDisabledRestored, true);
});

for (const [name, key, heading] of [['internals', 'e', ''], ['legend', 'f', '#terrain encodings:']])
test(`wizard ${name} remains a text display, without terrain browsing`, async () => {
    const out = await terrain(key, name);
    assert.equal(out.inputCount, 2);
    assert.ok(out.reads.every(r => r.terrainmode === 0));
    assert.equal(out.reads[1].top, heading);
    assert.equal(out.finalTerrainmode, 0);
    assert.equal(out.botDisabledRestored, true);
});

test('doterrain waits for the real selection reader before returning', async () => {
    const run = await ready();
    let entered, release, done = false, reads = 0;
    const atInput = new Promise(resolve => { entered = resolve; });
    run._display.onEmptyQueue = () => {
        if (++reads === 1) {
            entered();
            return new Promise(resolve => { release = resolve; });
        }
        assert.ok(reads <= 5);
        return 27;
    };
    const pending = doterrain().then(() => { done = true; });
    await atInput;
    const during = {done, ...observe()};
    release(27);
    await pending;
    assert.equal(during.done, false);
    assert.equal(during.windowActive, 1);
    assert.equal(during.terrainmode, 0);
    assert.equal(done, true);
    assert.equal(reads, 1, 'Escape finishes this owner');
});

test('read-only terrain observations preserve all five raw output collections', async () => {
    const observed = await terrain('b', 'observer-on');
    const plain = await terrain('b', 'observer-off', false);
    assert.equal(observed.inputCount, plain.inputCount);
    assert.deepEqual(observed.hashes, plain.hashes);
});

after(() => { if (receipt) writeFileSync(receipt, JSON.stringify(observations, null, 2) + '\n'); });
