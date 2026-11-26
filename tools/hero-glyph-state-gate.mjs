#!/usr/bin/env node
// Source-state controls for include/display.h:246-261 and :560.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import * as C from '../js/const.js';
import {PMNAMES as PM, NUMMONS} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {display_self, gbuf_at, glyphmap, row_refresh} from '../js/display.js';
import {rn2_on_display_rng} from '../js/rng.js';
import {CLR_RED, CLR_BROWN, CLR_MAGENTA, NO_COLOR} from '../js/terminal.js';

const input = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/class-glyph-startup.json', import.meta.url)));
async function setup(hallucinating) {
    await runSegment({...input.segments[0], moves:' ', storage:new InMemoryStorage()});
    game.u.uprops.HALLUC = hallucinating ? 100 : 0;
    game.flags.color = true;
    game.flags.hilite_pet = false;
    game.iflags.colorcount = 256;
}
function expectedDraw(random, normal) {
    const before = structuredClone(game.dispCtx);
    const mnum = random ? rn2_on_display_rng(NUMMONS) : normal;
    const after = structuredClone(game.dispCtx);
    game.dispCtx = before;
    return {mnum, after, core:structuredClone(game.coreCtx)};
}
async function check(glyphnum, draw) {
    glyphmap()[glyphnum].customcolor = C.NH_BASIC_COLOR | CLR_RED;
    display_self();
    const cell = gbuf_at(game.u.ux, game.u.uy);
    assert.equal(cell.disp_glyphnum, glyphnum);
    assert.equal(cell.disp_customcolor, C.NH_BASIC_COLOR | CLR_RED);
    await row_refresh(game.u.ux, game.u.ux, game.u.uy);
    assert.equal(game.nhDisplay.grid[game.u.uy + 1][game.u.ux - 1].color, CLR_RED);
    assert.deepEqual(game.dispCtx, draw.after);
    assert.deepEqual(game.coreCtx, draw.core);
}

for (const female of [false, true]) {
    for (const hallucinating of [false, true]) {
        test(`ridden ${female ? 'female' : 'male'}, hallucination ${hallucinating}`, async () => {
            await setup(hallucinating);
            game.u.usteed = {data:game.mons[PM.PM_PONY], mnum:PM.PM_PONY,
                female, mtame:10, minvis:0, mundetected:0, mburied:0};
            const draw = expectedDraw(hallucinating, PM.PM_PONY);
            await check(draw.mnum + (female ? C.GLYPH_RIDDEN_FEM_OFF : C.GLYPH_RIDDEN_MALE_OFF), draw);
        });
    }
}

for (const hidden of ['minvis', 'mundetected', 'mburied']) {
    test(`a ${hidden} steed falls back to the hero without a hallucination draw`, async () => {
        await setup(true);
        game.u.usteed = {data:game.mons[PM.PM_PONY], mnum:PM.PM_PONY,
            female:1, mtame:10, minvis:0, mundetected:0, mburied:0, [hidden]:1};
        game.u.uprops.SEE_INVIS = 0;
        game.u.intrinsic.HSee_invisible = 0;
        const draw = expectedDraw(false, game.u.umonnum);
        await check(draw.mnum + C.GLYPH_MON_MALE_OFF, draw);
    });
}

test('a visible steed takes priority over the hero object disguise', async () => {
    await setup(true);
    game.youmonst.m_ap_type = C.M_AP_OBJECT;
    game.youmonst.mappearance = ONAMES.STATUE;
    game.u.usteed = {data:game.mons[PM.PM_PONY], mnum:PM.PM_PONY,
        female:1, mtame:10, minvis:0, mundetected:0, mburied:0};
    const draw = expectedDraw(true, PM.PM_PONY);
    await check(draw.mnum + C.GLYPH_RIDDEN_FEM_OFF, draw);
});

for (const otyp of [ONAMES.STRANGE_OBJECT, ONAMES.DAGGER, ONAMES.CORPSE, ONAMES.STATUE, ONAMES.BOULDER]) {
    for (const hallucinating of [false, true]) {
        test(`object disguise ${otyp}, hallucination ${hallucinating}`, async () => {
            await setup(hallucinating);
            game.youmonst.m_ap_type = C.M_AP_OBJECT;
            game.youmonst.mappearance = otyp;
            const draw = expectedDraw(false, 0);
            await check(C.GLYPH_OBJ_OFF + otyp, draw);
        });
    }
}

test('native controls reach ridden color, Unicode, hallucination and object disguise', () => {
    const fixture = JSON.parse(readFileSync(new URL(
        'gen-sessions/generated/hero-glyph-identities.session.json', import.meta.url)));
    const samples = [
        [0, 35, 69, 8, 'u', CLR_RED],
        [1, 35, 69, 8, 'u', CLR_BROWN],
        [2, 35, 69, 8, ' ', NO_COLOR],
        [3, 35, 69, 8, 'u', CLR_BROWN],
        [4, 71, 69, 8, '&', CLR_MAGENTA],
        [5, 36, 7, 13, ']', NO_COLOR],
        [6, 77, 7, 13, ']', NO_COLOR],
    ];
    for (const [segment, step, x, y, ch, color] of samples) {
        const cell = decodeScreen(fixture.segments[segment].steps[step].screen)[y][x];
        assert.deepEqual([cell.ch, cell.color], [ch, color]);
    }
});
