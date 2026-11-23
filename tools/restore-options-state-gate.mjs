#!/usr/bin/env node
// C saves flags but rebuilds instance_flags and menu regexes at startup.
// Native save/restore recordings separately check the rendered menus.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { gamestate_encode, gamestate_decode } from '../js/save.js';
import { regex_match } from '../js/posixregex.js';
import { CLR_BLUE, CLR_GREEN } from '../js/terminal.js';
import { ATR_ULINE } from '../js/const.js';

async function restore(name, legacy) {
    const recipe = JSON.parse(readFileSync(new URL(
        `gen-sessions/recipes/${name}.json`, import.meta.url)));
    const storage = new InMemoryStorage();
    await runSegment({ ...recipe.segments[0], storage });
    if (legacy) {
        // Older versions serialized both fields. Encode them under temporary
        // names to preserve valid object IDs, then install the old field names.
        const key = `save:${game.plname}`;
        const saved = gamestate_decode(JSON.parse(storage.getItem(key)));
        delete saved.iflags;
        delete saved.menu_colorings;
        saved.old_iflags = game.iflags;
        saved.old_menu_colorings = game.menu_colorings;
        const snapshot = gamestate_encode(saved);
        for (const field of ['iflags', 'menu_colorings']) {
            snapshot.$o[field] = snapshot.$o['old_' + field];
            delete snapshot.$o['old_' + field];
        }
        storage.setItem(key, JSON.stringify(snapshot));
    }
    await runSegment({ ...recipe.segments[1], storage });
}

for (const legacy of [false, true]) {
    const label = legacy ? 'legacy save' : 'current save';
    test(`${label} keeps persistent flags and uses fresh instance options`, async () => {
        await restore('instance-options-save-restore', legacy);
        assert.equal(game.flags.autopickup, false);
        assert.deepEqual(game.iflags.menu_headings,
            { color: CLR_BLUE, attr: ATR_ULINE });
        assert.equal(game.iflags.num_pad, true);
        assert.equal(game.Cmd.num_pad, true);
        assert.equal(game.iflags.menuobjsyms, 3);
    });

    test(`${label} uses executable menu-color rules from the new configuration`, async () => {
        await restore('menu-colors-save-restore', legacy);
        assert.equal(game.menu_colorings.length, 1);
        const rule = game.menu_colorings[0];
        assert.equal(rule.color, CLR_GREEN);
        assert.equal(rule.attr, ATR_ULINE);
        assert.ok(regex_match('a quarterstaff', rule.match));
        assert.equal(regex_match('a dagger', rule.match), false);
        assert.equal(game.flags.autopickup, false);
    });
}
