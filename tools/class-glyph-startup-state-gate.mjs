#!/usr/bin/env node
// Source-derived class expansion checks, paired with native startup recordings.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {PMNAMES} from '../js/monst_data.js';
import {gs_sym_customizations} from '../js/glyphs.js';
import {showsym_mon, PRIMARYSET} from '../js/symbols.js';
import {
    custom_ureps, GLYPH_MON_MALE_OFF, GLYPH_MON_FEM_OFF,
    GLYPH_PET_MALE_OFF, GLYPH_PET_FEM_OFF,
    GLYPH_DETECT_MALE_OFF, GLYPH_DETECT_FEM_OFF,
    GLYPH_RIDDEN_MALE_OFF, GLYPH_RIDDEN_FEM_OFF,
} from '../js/const.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/class-glyph-startup.json', import.meta.url)));
async function setup(segment) {
    await runSegment({...recipe.segments[segment], moves:' ',
        storage:new InMemoryStorage()});
}
const variants = [GLYPH_MON_MALE_OFF, GLYPH_MON_FEM_OFF,
    GLYPH_PET_MALE_OFF, GLYPH_PET_FEM_OFF,
    GLYPH_DETECT_MALE_OFF, GLYPH_DETECT_FEM_OFF,
    GLYPH_RIDDEN_MALE_OFF, GLYPH_RIDDEN_FEM_OFF];
function customizations() {
    return new Map(gs_sym_customizations[PRIMARYSET][custom_ureps].details
        .map(detail => [detail.content.urep.glyphidx, detail.content.urep.u.utf32ch]));
}

test('startup class expansion includes both sexes and each monster glyph range', async () => {
    await setup(0);
    const entries = customizations();
    for (const offset of variants)
        assert.equal(entries.get(offset + PMNAMES.PM_HUMAN), 0x2603);
    assert.equal(entries.has(GLYPH_MON_MALE_OFF + PMNAMES.PM_KITTEN), false);
});

test('a later process replaces earlier class customizations', async () => {
    await setup(0);
    await setup(2);
    const entries = customizations();
    for (const offset of variants)
        assert.equal(entries.get(offset + PMNAMES.PM_KITTEN), 0x2603);
    assert.equal(entries.has(GLYPH_MON_MALE_OFF + PMNAMES.PM_HUMAN), false);
});

test('an ordinary class override remains active alongside stored Unicode', async () => {
    await setup(1);
    assert.equal(showsym_mon(game.mons[PMNAMES.PM_HUMAN].mlet), 'H');
    assert.equal(customizations().get(GLYPH_MON_MALE_OFF + PMNAMES.PM_HUMAN), 0x2603);
});
