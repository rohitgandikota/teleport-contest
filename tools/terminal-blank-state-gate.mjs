#!/usr/bin/env node
// C's capture retains colored blanks, although the scorer ignores their color
// unless they also have inverse or underline attributes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {GameDisplay} from '../js/game_display.js';
import {CLR_RED, CLR_BLUE, CLR_WHITE, NO_COLOR} from '../js/terminal.js';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';

test('capture retains colored blanks at both edges and on an otherwise blank row', () => {
    const display = new GameDisplay(null);
    display.setCell(2, 0, ' ', CLR_RED, 0);
    display.setCell(4, 0, 'X', NO_COLOR, 0);
    display.setCell(7, 0, ' ', CLR_BLUE, 0);
    display.setCell(79, 23, ' ', CLR_WHITE, 0);
    const before = structuredClone(display.grid);
    const captured = display.terminal.serialize();
    const cells = decodeScreen(captured);
    assert.equal(cells[0][2].color, CLR_RED);
    assert.equal(cells[0][7].color, CLR_BLUE);
    assert.equal(cells[23][79].color, CLR_WHITE);
    assert.deepEqual(display.grid, before);
    assert.equal(display.terminal.serialize(), captured);
});

test('Blank symbol set retains the native colors of every captured map cell', async () => {
    const fixture = JSON.parse(readFileSync(new URL(
        'gen-sessions/generated/loaded-symbol-sets.session.json', import.meta.url)));
    const recipe = JSON.parse(readFileSync(new URL(
        'gen-sessions/recipes/loaded-symbol-sets.json', import.meta.url)));
    const index = recipe.segments.findIndex(segment => segment.name === 'Blank');
    assert.ok(index >= 0);
    const segment = fixture.segments[index];
    const result = await runSegment({...segment, storage: new InMemoryStorage()});
    const screens = result.getScreens();
    let coloredBlanks = 0;
    for (let step = 0; step < segment.steps.length; step++) {
        const expected = decodeScreen(segment.steps[step].screen);
        const actual = decodeScreen(screens[step]);
        for (let y = 1; y < 22; y++) {
            for (let x = 0; x < 80; x++) {
                assert.deepEqual(actual[y][x], expected[y][x], `step ${step}, cell ${x},${y}`);
                if (expected[y][x].ch === ' ' && expected[y][x].color !== NO_COLOR)
                    coloredBlanks++;
            }
        }
    }
    assert.ok(coloredBlanks > 0);
});
