// Source controls for term_clear_screen() through the real display adapter.
// No terminal methods or gameplay helpers are replaced.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {Terminal, CLR_GRAY, CLR_RED, NO_COLOR} from '../js/terminal.js';
import {GameDisplay} from '../js/game_display.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {getRngLog} from '../js/rng.js';
import {cls} from '../js/display.js';
import {NHW_TEXT, NHW_MENU, tty_create_nhwindow, tty_get_nhwindow,
    tty_putstr, tty_start_menu, tty_add_menu_str, tty_end_menu,
    tty_display_nhwindow, tty_destroy_nhwindow} from '../js/tty/wintty.js';

const display = (rows = 24, cols = 80) => new GameDisplay(new Terminal(null, {rows, cols}));
const blank = {ch: ' ', color: NO_COLOR, attr: 0};

test('full clear erases glyphs, colored blanks and attributes to default foreground', () => {
    const d = display(3, 4);
    for (let y = 0; y < d.rows; y++) for (let x = 0; x < d.cols; x++)
        d.setCell(x, y, x % 2 ? ' ' : '#', (x + y) % 16, 7);
    assert.equal(d.clearScreen(), undefined);
    for (const row of d.grid) for (const cell of row) assert.deepEqual(cell, blank);
});

test('clear homes the cursor without changing visibility or input', () => {
    const d = display();
    d.setCursor(11, 7);
    d.cursSet(0);
    d.pushKey('a');
    const queued = d.inputQueueLength;
    assert.equal(d.clearScreen(), undefined);
    assert.deepEqual([d.cursorCol, d.cursorRow, d.cursorVisible], [0, 0, 0]);
    assert.equal(d.inputQueueLength, queued);
});

test('clear preserves wrapper message and display configuration state', () => {
    const d = display(), flags = {color: true};
    d.flags = flags;
    d.topMessage = d.toplines = 'kept';
    d.messages.push('kept');
    d.toplin = 1;
    d.clearScreen();
    assert.equal(d.flags, flags);
    assert.deepEqual([d.topMessage, d.toplines, d.messages, d.toplin], ['kept', 'kept', ['kept'], 1]);
});

test('repeated clear includes both last edges and remains synchronous', () => {
    const d = display(2, 3);
    d.clearScreen();
    d.setCell(2, 1, 'X', CLR_RED, 7);
    assert.equal(d.clearScreen(), undefined);
    assert.deepEqual(d.grid[1][2], blank);
    assert.deepEqual(d.grid[0][0], blank);
});

test('new glyphs expose cleared interior spaces as default, not explicit gray', () => {
    const d = display();
    d.clearScreen();
    d.setCell(6, 5, '|', NO_COLOR, 0);
    d.setCell(13, 5, '|', NO_COLOR, 0);
    const grid = decodeScreen(d.terminal.serialize());
    for (let x = 7; x < 13; x++) {
        assert.deepEqual(d.grid[5][x], blank);
        assert.equal(grid[5][x].color, NO_COLOR);
    }
});

test('explicit gray text and an explicit gray interior blank remain gray', () => {
    const d = display();
    d.clearScreen();
    d.putstr(2, 3, 'a b', CLR_GRAY, 0);
    const grid = decodeScreen(d.terminal.serialize());
    for (let x = 2; x <= 4; x++) assert.equal(grid[3][x].color, CLR_GRAY);
    assert.equal(grid[3][3].ch, ' ');
});

test('default and explicit gray interior blanks stay distinct', () => {
    const d = display();
    d.clearScreen();
    d.setCell(2, 3, 'a', CLR_GRAY, 0);
    d.setCell(3, 3, ' ', CLR_GRAY, 0);
    d.setCell(5, 3, 'b', CLR_GRAY, 0);
    const grid = decodeScreen(d.terminal.serialize());
    assert.equal(grid[3][3].color, CLR_GRAY);
    assert.equal(grid[3][4].color, NO_COLOR);
});

test('colored and attributed blank edges remain observable after a clear', () => {
    const d = display();
    d.clearScreen();
    d.setCell(0, 4, ' ', CLR_RED, 7);
    d.setCell(79, 4, ' ', CLR_GRAY, 1);
    const grid = decodeScreen(d.terminal.serialize());
    assert.deepEqual([grid[4][0].ch, grid[4][0].color, grid[4][0].attr], [' ', CLR_RED, 7]);
    assert.deepEqual([grid[4][79].ch, grid[4][79].color, grid[4][79].attr], [' ', CLR_GRAY, 1]);
});

test('serialization is repeatable and does not change real buffer cells', () => {
    const d = display();
    d.clearScreen();
    d.setCell(0, 4, ' ', CLR_RED, 7);
    d.putstr(5, 4, 'gray space', CLR_GRAY, 0);
    const grid = structuredClone(d.grid);
    const first = d.terminal.serialize();
    assert.equal(d.terminal.serialize(), first);
    assert.deepEqual(d.grid, grid);
});

test('wrapping an existing terminal does not rewrite its constructor cells', () => {
    const t = new Terminal(null, {rows: 2, cols: 3});
    const before = structuredClone(t.grid);
    const d = new GameDisplay(t);
    assert.deepEqual(d.grid, before);
    assert.equal(d.grid[0][0].color, CLR_GRAY);
});

test('the generic frozen terminal retains its original clear contract', () => {
    const t = new Terminal(null, {rows: 2, cols: 3});
    t.setCell(2, 1, '#', CLR_RED, 7);
    t.clearScreen();
    assert.deepEqual(t.grid[1][2], {ch: ' ', color: CLR_GRAY, attr: 0});
    assert.deepEqual([t.cursorCol, t.cursorRow], [0, 0]);
});

// Real startup supplies the level and live global binding for public callers.
const fixture = JSON.parse(readFileSync(new URL('gen-sessions/generated/projectile-trap-callers.session.json', import.meta.url)));
await runSegment({...fixture.segments[0], moves: '', storage: new InMemoryStorage()});

test('public cls clears physical and logical map state without RNG', async () => {
    game._toplin = 0;
    game.nhDisplay.setCell(7, 5, '#', CLR_RED, 7);
    const rng = [...getRngLog()];
    await cls();
    for (const row of game.nhDisplay.grid) for (const cell of row) assert.deepEqual(cell, blank);
    assert.equal(game.disp.botlx, true);
    assert.equal(game.level.at(7, 4).disp_glyph.kind, 'unexplored');
    assert.equal(game.level.at(7, 4).disp_color, NO_COLOR);
    assert.equal(game._in_cls, false);
    assert.deepEqual(getRngLog(), rng);
});

test('cls reentrance guard preserves explicit painted data and cursor', async () => {
    game.nhDisplay.setCell(7, 5, ' ', CLR_RED, 7);
    game.nhDisplay.setCursor(7, 5);
    const grid = structuredClone(game.nhDisplay.grid);
    game._in_cls = true;
    try { await cls(); } finally { game._in_cls = false; }
    assert.deepEqual(game.nhDisplay.grid, grid);
    assert.deepEqual([game.nhDisplay.cursorCol, game.nhDisplay.cursorRow], [7, 5]);
});

for (const [name, type, overlay] of [
    ['full text', NHW_TEXT, true],
    ['full menu', NHW_MENU, false],
    ['corner menu', NHW_MENU, true],
]) test(`${name}: real public window caller honors its clear boundary`, async () => {
    game._toplin = 0;
    game.nhDisplay = display();
    game.nhDisplay.setCell(2, 20, '#', CLR_RED, 7);
    const previousOverlay = game.iflags.menu_overlay;
    game.iflags.menu_overlay = overlay;
    const window = tty_create_nhwindow(type);
    try {
        if (type === NHW_TEXT) tty_putstr(window, 0, 'text');
        else {
            tty_start_menu(window, 0);
            tty_add_menu_str(window, 'entry');
            tty_end_menu(window, null);
        }
        const rng = [...getRngLog()];
        await tty_display_nhwindow(window);
        const full = tty_get_nhwindow(window).offx === 0;
        assert.equal(full, type === NHW_TEXT || !overlay);
        assert.deepEqual(game.nhDisplay.grid[20][2], full ? blank : {ch: '#', color: CLR_RED, attr: 7});
        assert.deepEqual(getRngLog(), rng);
    } finally {
        tty_destroy_nhwindow(window);
        game.iflags.menu_overlay = previousOverlay;
    }
});
