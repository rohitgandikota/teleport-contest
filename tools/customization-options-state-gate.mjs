#!/usr/bin/env node
// Source-derived controls for options.c, symbols.c and utf8map.c state changes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {glyphmap} from '../js/display.js';
import {GLYPH_CMAP_MAIN_OFF, GLYPH_CMAP_MINES_OFF} from '../js/const.js';
import {clear_symsetentry, gs_symset, PRIMARYSET, ROGUESET, H_UTF8} from '../js/symbols.js';
import {gs_sym_customizations} from '../js/glyphs.js';
import {boolean_option} from '../js/options.js';
import * as utf8map from '../js/utf8map.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/customization-options.json', import.meta.url)));

async function setup(segment, moves = ' ') {
    await runSegment({...recipe.segments[segment], moves,
        storage: new InMemoryStorage()});
}

test('startup customsymbols writes iflags and suppresses Unicode entries', async () => {
    await setup(0);
    assert.equal(game.iflags.customsymbols, false);
    assert.equal(glyphmap()[GLYPH_CMAP_MAIN_OFF].u, null);
});

test('startup customcolors writes iflags and suppresses custom colors', async () => {
    await setup(4);
    assert.equal(game.iflags.customcolors, false);
    assert.ok(glyphmap().every(glyph => glyph.customcolor === 0));
});

test('customsymbols toggles clear and restore the active Unicode entries', async () => {
    await setup(2, ' \x14 ');
    assert.equal(game.iflags.customsymbols, false);
    assert.equal(glyphmap()[GLYPH_CMAP_MAIN_OFF].u, null);
    assert.equal(game.opt_reset_customsymbols, false);
    await setup(2, ' \x14 \x14 ');
    assert.equal(game.iflags.customsymbols, true);
    assert.equal(glyphmap()[GLYPH_CMAP_MAIN_OFF].u.utf32ch, 0x2502);
    assert.equal(game.opt_reset_customsymbols, false);
});

test('customcolors toggles clear and restore the active color entries', async () => {
    await setup(3, ' \x14 ');
    assert.equal(game.iflags.customcolors, false);
    assert.equal(glyphmap()[GLYPH_CMAP_MINES_OFF].customcolor, 0);
    assert.equal(game.opt_reset_customcolors, false);
    await setup(3, ' \x14 \x14 ');
    assert.equal(game.iflags.customcolors, true);
    assert.equal(glyphmap()[GLYPH_CMAP_MINES_OFF].customcolor, 0xbe7e00);
    assert.equal(game.opt_reset_customcolors, false);
});

test('reset_customsymbols frees stale entries before applying the option', async () => {
    await setup(1);
    assert.equal(typeof utf8map.reset_customsymbols, 'function');
    game.iflags.customsymbols = false;
    utf8map.reset_customsymbols();
    assert.ok(glyphmap().every(glyph => glyph.u === null));
    game.iflags.customsymbols = true;
    utf8map.reset_customsymbols();
    assert.equal(glyphmap()[GLYPH_CMAP_MAIN_OFF].u.utf32ch, 0x2502);
});

for (const enabled of [true, false]) {
    test(`restoring uses the new process's ${enabled ? 'enabled' : 'disabled'} customizations`, async () => {
        const savedRecipe = JSON.parse(readFileSync(new URL(
            'gen-sessions/recipes/customization-save-restore.json', import.meta.url)));
        const first = enabled ? 0 : 2;
        const storage = new InMemoryStorage();
        await runSegment({...savedRecipe.segments[first], storage});
        await runSegment({...savedRecipe.segments[first + 1], storage});
        assert.equal(boolean_option('customsymbols'), enabled);
        assert.equal(boolean_option('customcolors'), enabled);
        assert.equal(glyphmap()[GLYPH_CMAP_MAIN_OFF].u?.utf32ch ?? null,
            enabled ? 0x2502 : null);
        assert.equal(glyphmap()[GLYPH_CMAP_MINES_OFF].customcolor,
            enabled ? 0xbe7e00 : 0);
    });
}

for (const otherUtf8 of [false, true]) {
    test(`clearing a set ${otherUtf8 ? 'retains' : 'frees'} shared Unicode data`, async () => {
        await setup(1);
        if (otherUtf8)
            gs_symset[ROGUESET].handling = H_UTF8;
        const before = glyphmap()[GLYPH_CMAP_MAIN_OFF].u;
        assert.ok(before);
        assert.notEqual(glyphmap()[GLYPH_CMAP_MINES_OFF].customcolor, 0);
        clear_symsetentry(PRIMARYSET, !otherUtf8);
        assert.equal(gs_symset[PRIMARYSET].name, otherUtf8 ? 'Enhanced1' : null);
        assert.equal(glyphmap()[GLYPH_CMAP_MAIN_OFF].u, otherUtf8 ? before : null);
        assert.ok(glyphmap().every(glyph => glyph.customcolor === 0));
        assert.ok(gs_sym_customizations[PRIMARYSET].every(entry => !entry.details.length));
    });
}

// Check the private reset coordinator against C's ordered effects without
// running an interactive menu. Only its imports and display calls are stubbed.
const optionsSource = readFileSync(new URL('../js/options.js', import.meta.url), 'utf8');
const resetSource = optionsSource.match(
    /async function reset_needed_visuals\(\) \{[\s\S]*?^\}/m)[0]
    .replace(/import\('([^']+)'\)/g,
        (_, path) => `Promise.resolve(imports[${JSON.stringify(path)}])`);

for (const fullReset of [false, true]) {
    test(`visual reset ${fullReset ? 'orders all effects' : 'redraws for custom symbols alone'}`, async () => {
        const calls = [];
        const state = {
            opt_need_glyph_reset: fullReset,
            opt_reset_customcolors: fullReset,
            opt_reset_customsymbols: true,
            opt_need_redraw: fullReset,
            disp: {botl: fullReset},
        };
        const effect = name => () => calls.push(name);
        const context = vm.createContext({
            game: state,
            imports: {
                './display.js': {reset_glyphmap: effect('glyphmap')},
                './const.js': {gm_optionchange: 0},
            },
            reset_customcolors: effect('colors'),
            reset_customsymbols: effect('symbols'),
            check_gold_symbol: effect('gold'),
            reglyph_darkroom: effect('darkroom'),
            docrt: effect('redraw'),
            bot: effect('status'),
        });
        vm.runInContext(resetSource, context);
        await context.reset_needed_visuals();
        assert.deepEqual(calls, fullReset
            ? ['glyphmap', 'colors', 'symbols', 'gold', 'darkroom', 'redraw', 'status']
            : ['symbols', 'redraw']);
        for (const field of ['opt_need_glyph_reset', 'opt_reset_customcolors',
                             'opt_reset_customsymbols', 'opt_need_redraw'])
            assert.equal(state[field], false, field);
    });
}
