#!/usr/bin/env node
// Source-derived symbol metadata and tty capture controls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {GameDisplay} from '../js/game_display.js';
import {NO_COLOR, ATR_BOLD, ATR_INVERSE} from '../js/terminal.js';
import {glyphmap} from '../js/display.js';
import {GLYPH_MON_MALE_OFF, GLYPH_CMAP_MAIN_OFF} from '../js/const.js';
import {PMNAMES} from '../js/monst_data.js';
import {cmap_names} from '../js/drawing_data.js';
import {showsyms_at, savedsym_strbuf} from '../js/symbols.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/glyph-config-values.json', import.meta.url)));
async function setup(segment) {
    await runSegment({...recipe.segments[segment], moves:' ',
        storage:new InMemoryStorage()});
}

test('a G_ config value is saved without being applied as a color', async () => {
    await setup(0);
    assert.equal(glyphmap()[GLYPH_MON_MALE_OFF + PMNAMES.PM_HUMAN].customcolor, 0);
    assert.ok(savedsym_strbuf().includes('SYMBOLS=G_male_human:/red\n'));
});

test('a G_ config value is saved without replacing a Unicode glyph', async () => {
    await setup(2);
    assert.equal(glyphmap()[GLYPH_MON_MALE_OFF + PMNAMES.PM_HUMAN].u, null);
    assert.ok(savedsym_strbuf().includes('SYMBOLS=G_male_human:U+2603\n'));
});

test('Unicode handling preserves raw symbol bytes and the loaded representation', async () => {
    await setup(3);
    assert.equal(showsyms_at(cmap_names.S_vwall), '|'.charCodeAt(0));
    const u = glyphmap()[GLYPH_CMAP_MAIN_OFF].u;
    assert.equal(u.utf32ch, 0x2502);
    assert.deepEqual(u.utf8str, [226, 148, 130]);
});

test('capture preserves styled blanks on both sides of text', () => {
    const display = new GameDisplay(null);
    display.setCell(3, 0, ' ', NO_COLOR, ATR_INVERSE);
    display.setCell(4, 0, 'X', NO_COLOR, 0);
    display.setCell(7, 0, ' ', NO_COLOR, ATR_BOLD);
    const before = structuredClone(display.grid);
    const first = display.terminal.serialize();
    const cells = decodeScreen(first);
    assert.equal(cells[0][3].attr, ATR_INVERSE);
    assert.equal(cells[0][7].attr, ATR_BOLD);
    assert.equal(cells[0][7].ch, ' ');
    assert.deepEqual(display.grid, before);
    assert.equal(display.terminal.serialize(), first);
});

test('capture retains a final row containing only a styled blank', () => {
    const display = new GameDisplay(null);
    display.setCell(79, 23, ' ', NO_COLOR, ATR_INVERSE);
    const cells = decodeScreen(display.terminal.serialize());
    assert.equal(cells[23][79].attr, ATR_INVERSE);
    assert.equal(display.grid[23][79].ch, ' ');
});
