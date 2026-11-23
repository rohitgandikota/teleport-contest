#!/usr/bin/env node
// Source-derived table and process-state checks, paired with native fixtures.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {
    assign_graphics, switch_symbols, get_othersym, showsym, showsym_oc,
    gs_symset, gc_currentgraphics, gp_primary_syms, go_ov_primary_syms,
    PRIMARYSET, ROGUESET, SYM_OFF_X, SYM_BOULDER,
} from '../js/symbols.js';
import {cmap_names} from '../js/drawing_data.js';
import {OCLASSES} from '../js/objects_data.js';

const recipe = name => JSON.parse(readFileSync(new URL(
    `gen-sessions/recipes/${name}.json`, import.meta.url)));
const presets = recipe('loaded-symbol-sets');

async function setup(extra = '') {
    return runSegment({...presets.segments[0], moves:' ',
        nethackrc:presets.segments[0].nethackrc + extra,
        storage:new InMemoryStorage()});
}

test('graphics selection copies the selected table and its overrides', async () => {
    await setup('OPTIONS=symset:plain\nROGUESYMBOLS=S_food:F\n');
    assign_graphics(ROGUESET);
    assert.equal(gc_currentgraphics.set, ROGUESET);
    assert.equal(showsym_oc(OCLASSES.FOOD_CLASS), 'F');
    assert.equal(showsym_oc(OCLASSES.AMULET_CLASS), ',');
    assert.equal(showsym(cmap_names.S_upstair).ch, '%');
    assert.equal(gs_symset[ROGUESET].nocolor, 1);
    assign_graphics(PRIMARYSET);
    assert.equal(showsym_oc(OCLASSES.FOOD_CLASS), '%');
    assert.equal(showsym(cmap_names.S_upstair).ch, '<');
});

test('switch_symbols copies primary symbols without selecting a new graphics set', async () => {
    await setup();
    assign_graphics(ROGUESET);
    switch_symbols(true);
    assert.equal(gc_currentgraphics.set, ROGUESET);
    assert.equal(showsym_oc(OCLASSES.FOOD_CLASS), '%');
});

test('loaded other symbols have lower precedence than explicit overrides', async () => {
    await setup();
    const index = SYM_BOULDER + SYM_OFF_X;
    gp_primary_syms[index] = 'B'.charCodeAt(0);
    assert.equal(get_othersym(SYM_BOULDER, PRIMARYSET), 'B'.charCodeAt(0));
    go_ov_primary_syms[index] = 'X'.charCodeAt(0);
    assert.equal(get_othersym(SYM_BOULDER, PRIMARYSET), 'X'.charCodeAt(0));
});

test('a new process clears loaded names, handlers and other-symbol state', async () => {
    await setup('OPTIONS=symset:IBMgraphics,roguesymset:RogueEpyx\n');
    gp_primary_syms[SYM_BOULDER + SYM_OFF_X] = 'B'.charCodeAt(0);
    assign_graphics(ROGUESET);
    await setup();
    assert.equal(gc_currentgraphics.set, PRIMARYSET);
    for (const set of [PRIMARYSET, ROGUESET]) {
        assert.equal(gs_symset[set].name, null);
        assert.equal(gs_symset[set].handling, 0);
    }
    assert.equal(get_othersym(SYM_BOULDER, PRIMARYSET), '`'.charCodeAt(0));
});

test('an invisible gold fallback does not invalidate an unchanged raw gold symbol', async () => {
    const run = await runSegment({...presets.segments[14], storage:new InMemoryStorage()});
    assert.equal(game.iflags.invis_goldsym, true);
    assert.equal(game._botl_oldgoldsym, ' ');
    assert.ok(run.getScreens().at(-1).includes('Dlvl:1  :0'));
});

for (const option of ['!color', '!dark_room']) {
    test(`startup ${option} uses the nothing symbol for dark-room memory`, async () => {
        await setup(`OPTIONS=${option}\nSYMBOLS=S_nothing:N\n`);
        assert.equal(showsym(cmap_names.S_darkroom).ch, 'N');
    });
}

test('restoring on Rogue selects the new process symbol tables', async () => {
    const segments = recipe('symbol-set-save-restore').segments;
    const storage = new InMemoryStorage();
    await runSegment({...segments[0], storage});
    await runSegment({...segments[1], moves:' n', storage});
    assert.equal(gc_currentgraphics.set, ROGUESET);
    assert.equal(gs_symset[PRIMARYSET].name, 'plain');
    assert.equal(gs_symset[ROGUESET].name, 'RogueEpyx');
    assert.equal(showsym_oc(OCLASSES.COIN_CLASS), '\x0f');
});
