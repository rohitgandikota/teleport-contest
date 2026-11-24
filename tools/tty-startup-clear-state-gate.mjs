// Source-derived startup controls using the actual display and startup owner.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Terminal, CLR_GRAY, CLR_RED, NO_COLOR } from '../js/terminal.js';
import { GameDisplay } from '../js/game_display.js';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { getRngLog } from '../js/rng.js';
import { tty_init_nhwindows } from '../js/plselect.js';
import { tty_curs_base, tty_base_pos, tty_base_cursor } from '../js/tty/wintty.js';
import { COPYRIGHT_BANNER } from '../js/banner_data.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';

await runSegment({
    seed: 99812,
    datetime: '20000110090000',
    moves: '',
    storage: new InMemoryStorage(),
    nethackrc: 'OPTIONS=name:Startup,role:Wizard,race:human,gender:male,align:neutral\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none\n',
});

const blank = { ch: ' ', color: NO_COLOR, attr: 0 };
function prepare(splash) {
    const display = new GameDisplay(new Terminal(null));
    game.nhDisplay = display;
    game.flags.splash_screen = splash;
    return display;
}
function checkScreen(display, banner) {
    for (let y = 0; y < display.rows; y++) {
        for (let x = 0; x < display.cols; x++) {
            const ch = banner && y >= 4 && y < 8
                ? (COPYRIGHT_BANNER[y - 4][x] ?? ' ') : ' ';
            assert.deepEqual(display.grid[y][x], { ...blank, ch }, `cell ${x},${y}`);
        }
    }
}

test('generic construction retains explicit gray until the startup owner clears it', () => {
    const display = prepare(false);
    for (const row of display.grid) {
        for (const cell of row)
            assert.deepEqual(cell, { ch: ' ', color: CLR_GRAY, attr: 0 });
    }
    tty_init_nhwindows();
    checkScreen(display, false);
});

test('disabled banner still clears glyphs, colored blanks and attributes at every cell', () => {
    const display = prepare(false);
    for (let y = 0; y < display.rows; y++) {
        for (let x = 0; x < display.cols; x++)
            display.setCell(x, y, x % 2 ? ' ' : '#', (x + y) % 16, 7);
    }
    assert.equal(tty_init_nhwindows(), undefined);
    checkScreen(display, false);
});

test('base clear homes physical and logical cursors with the banner disabled', () => {
    const display = prepare(false);
    display.setCursor(27, 19);
    tty_curs_base(15, 6);
    tty_init_nhwindows();
    assert.deepEqual([display.cursorCol, display.cursorRow], [0, 0]);
    assert.deepEqual(tty_base_pos(), { x: 0, y: 0 });
    tty_base_cursor();
    assert.deepEqual([display.cursorCol, display.cursorRow], [0, 0]);
});

test('enabled banner is painted after the clear with default foreground throughout', () => {
    const display = prepare(true);
    display.putstr(0, 4, 'stale banner', CLR_RED, 7);
    assert.equal(tty_init_nhwindows(), undefined);
    checkScreen(display, true);
    assert.deepEqual(tty_base_pos(), { x: 0, y: 11 });
    tty_base_cursor();
    assert.deepEqual([display.cursorCol, display.cursorRow], [0, 11]);
});

test('unset splash option retains the existing enabled-banner default', () => {
    const display = prepare(undefined);
    tty_init_nhwindows();
    checkScreen(display, true);
});

test('another initialization clears both last edges and resets a reused base cursor', () => {
    const display = prepare(true);
    tty_init_nhwindows();
    display.setCell(79, 23, 'X', CLR_RED, 7);
    tty_curs_base(79, 22);
    game.flags.splash_screen = false;
    tty_init_nhwindows();
    checkScreen(display, false);
    assert.deepEqual(tty_base_pos(), { x: 0, y: 0 });
});

test('a new real display does not inherit the previous base cursor or glyphs', () => {
    const first = prepare(true);
    tty_init_nhwindows();
    const previousGrid = structuredClone(first.grid);
    tty_curs_base(47, 15);
    const next = prepare(false);
    tty_init_nhwindows();
    checkScreen(next, false);
    assert.deepEqual(tty_base_pos(), { x: 0, y: 0 });
    assert.deepEqual(first.grid, previousGrid);
});

test('startup remains synchronous without consuming input or changing RNG state', () => {
    const display = prepare(true);
    display.pushKey('n');
    display.pushKey('y');
    const queued = display.inputQueueLength;
    const rng = [...getRngLog()];
    const moves = game.moves;
    assert.equal(tty_init_nhwindows(), undefined);
    assert.equal(display.inputQueueLength, queued);
    assert.deepEqual(getRngLog(), rng);
    assert.equal(game.moves, moves);
});

test('later interior gaps expose default blanks while explicit gray remains distinct', () => {
    const display = prepare(false);
    tty_init_nhwindows();
    display.setCell(3, 4, 'a', NO_COLOR, 0);
    display.setCell(4, 4, ' ', CLR_GRAY, 0);
    display.setCell(8, 4, 'b', NO_COLOR, 0);
    const grid = decodeScreen(display.terminal.serialize());
    assert.deepEqual([grid[4][4].ch, grid[4][4].color, grid[4][4].attr], [' ', CLR_GRAY, 0]);
    for (let x = 5; x < 8; x++)
        assert.deepEqual([grid[4][x].ch, grid[4][x].color, grid[4][x].attr], [' ', NO_COLOR, 0]);
});

test('later explicitly colored and bold blanks are preserved, without global normalization', () => {
    const display = prepare(false);
    tty_init_nhwindows();
    display.setCell(0, 4, ' ', CLR_RED, 2);
    display.setCell(79, 4, ' ', CLR_GRAY, 1);
    const grid = decodeScreen(display.terminal.serialize());
    assert.deepEqual([grid[4][0].ch, grid[4][0].color, grid[4][0].attr], [' ', CLR_RED, 2]);
    assert.deepEqual([grid[4][79].ch, grid[4][79].color, grid[4][79].attr], [' ', CLR_GRAY, 1]);
});
