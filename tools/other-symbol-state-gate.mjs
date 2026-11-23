#!/usr/bin/env node
// Source-state controls for display.c's other-symbol consumers.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {NO_COLOR} from '../js/terminal.js';
import {COLNO, ROWNO, ROOM} from '../js/const.js';
import {cansee} from '../js/vision.js';
import {ONAMES} from '../js/objects_data.js';
import {gs_showsyms, SYM_INVISIBLE} from '../js/symbols.js';
import {
    clear_glyph_buffer, gbuf_at, glyph_at, row_refresh, flush_screen,
    magic_map_background, map_invisible, glyph_is_invisible_at, show_glyph_cell,
} from '../js/display.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/other-map-symbols.json', import.meta.url)));
async function setup(segment) {
    await runSegment({...recipe.segments[segment], moves:' ',
        storage:new InMemoryStorage()});
}

test('clearing marks custom unexplored cells for the next screen flush', async () => {
    await setup(0);
    clear_glyph_buffer();
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            assert.equal(game.level.at(x, y).gnew, 1);
            assert.equal(glyph_at(x, y).kind, 'unexplored');
        }
    }
    await flush_screen(0);
    assert.equal(game.nhDisplay.grid[1][0].ch, 'U');
    assert.equal(game.nhDisplay.grid[ROWNO][COLNO - 2].ch, 'U');
});

test('default unexplored cells need no repaint after a screen clear', async () => {
    await setup(4);
    clear_glyph_buffer();
    assert.equal(game.level.at(1, 0).gnew, 0);
    assert.equal(glyph_at(1, 0).kind, 'unexplored');
});

test('row refresh restores custom unexplored symbols under a text overlay', async () => {
    await setup(0);
    clear_glyph_buffer();
    for (let column = 0; column < 3; column++)
        game.nhDisplay.setCell(column, 1, 'X', NO_COLOR, 0);
    row_refresh(1, 2, 0);
    assert.equal(game.nhDisplay.grid[1][0].ch, 'U');
    assert.equal(game.nhDisplay.grid[1][1].ch, 'U');
    assert.equal(game.nhDisplay.grid[1][2].ch, 'X');
});

test('magic mapping draws nothing without overwriting remembered objects', async () => {
    await setup(2);
    const x = 4, y = 2, loc = game.level.at(x, y);
    assert.equal(loc.typ, ROOM);
    assert.equal(cansee(x, y), false);
    assert.equal(!!loc.waslit, false);
    const remembered = {ch:'!', color:NO_COLOR, decgfx:false,
        glyph:{kind:'obj', otyp:ONAMES.POT_HEALING}};
    loc.remembered_glyph = remembered;
    show_glyph_cell(x, y, '!', NO_COLOR, false, 0, remembered.glyph);
    magic_map_background(x, y, true);
    await flush_screen(0);
    assert.equal(game.nhDisplay.grid[y + 1][x - 1].ch, 'N');
    assert.equal(glyph_at(x, y).kind, 'nothing');
    assert.equal(loc.remembered_glyph, remembered);
});

test('hidden magic mapping updates background memory without drawing it', async () => {
    await setup(2);
    const x = 4, y = 2, loc = game.level.at(x, y);
    loc.remembered_glyph = null;
    const before = gbuf_at(x, y);
    magic_map_background(x, y, false);
    assert.equal(loc.remembered_glyph.glyph.kind, 'nothing');
    assert.equal(gbuf_at(x, y), before);
});

test('invisible markers use the active other symbol and retain their identity', async () => {
    await setup(4);
    // S_invisible in dat/symbols names a monster class first. Inject the
    // other-symbol slot to exercise reset_glyphmap's separate invis branch.
    gs_showsyms.X[SYM_INVISIBLE] = '?';
    map_invisible(1, 0);
    await flush_screen(0);
    assert.equal(game.nhDisplay.grid[1][0].ch, '?');
    assert.equal(gbuf_at(1, 0).disp_color, NO_COLOR);
    assert.equal(glyph_is_invisible_at(1, 0), true);
});
