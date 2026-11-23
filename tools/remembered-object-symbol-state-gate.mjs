#!/usr/bin/env node
// Source-state checks for C's redraw of remembered object glyph identities.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {ONAMES, OCLASSES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {OBJ_FLOOR} from '../js/const.js';
import {ATR_INVERSE} from '../js/terminal.js';
import {mksobj} from '../js/mkobj.js';
import {cansee} from '../js/vision.js';
import {map_object, newsym, glyph_at, gbuf_at, flush_screen} from '../js/display.js';
import {assign_graphics, go_ov_primary_syms, PRIMARYSET} from '../js/symbols.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/remembered-object-symbols.json', import.meta.url)));
const cases = [
    {name:'weapon', otyp:ONAMES.DAGGER},
    {name:'generic potion', otyp:ONAMES.POT_HEALING, generic:true},
    {name:'corpse', otyp:ONAMES.CORPSE, corpsenm:PMNAMES.PM_LICHEN},
    {name:'statue', otyp:ONAMES.STATUE, corpsenm:PMNAMES.PM_NEWT},
    {name:'boulder', otyp:ONAMES.BOULDER},
    {name:'pile', otyp:ONAMES.DAGGER, pile:true},
    {name:'hallucinated object', otyp:ONAMES.POT_HEALING, hallucinated:true},
];

for (const sample of cases) {
    test(`remembered ${sample.name} resolves active symbols without changing identity`, async () => {
        await runSegment({...recipe.segments[0], moves:' ',
            storage:new InMemoryStorage()});
        const x = 4, y = 2, loc = game.level.at(x, y);
        assert.equal(cansee(x, y), false);
        const obj = mksobj(sample.otyp, false, false);
        Object.assign(obj, {ox:x, oy:y, where:OBJ_FLOOR,
            dknown:sample.generic ? 0 : 1, corpsenm:sample.corpsenm ?? -1});
        game.level.objects.push(obj);
        game.flags.hilite_pile = true;
        if (sample.pile) {
            const second = mksobj(ONAMES.APPLE, false, false);
            Object.assign(second, {ox:x, oy:y, where:OBJ_FLOOR, dknown:1});
            game.level.objects.push(second);
        }
        if (sample.hallucinated)
            game.u.uprops.HALLUC = 100;
        map_object(obj, true);
        const remembered = loc.remembered_glyph;
        assert.equal(remembered.glyph.kind, 'obj');
        if (sample.generic)
            assert.equal(remembered.glyph.otyp, OCLASSES.POTION_CLASS);
        if (sample.pile)
            assert.equal(remembered.glyph.pile, true);
        const core = structuredClone(game.coreCtx);
        const display = structuredClone(game.dispCtx);
        go_ov_primary_syms.fill('X'.charCodeAt(0));
        assign_graphics(PRIMARYSET);
        newsym(x, y);
        await flush_screen(0);
        assert.equal(game.nhDisplay.grid[y + 1][x - 1].ch, 'X');
        assert.equal(loc.remembered_glyph, remembered);
        assert.equal(glyph_at(x, y), remembered.glyph);
        if (sample.pile)
            assert.equal(gbuf_at(x, y).disp_attr & ATR_INVERSE, ATR_INVERSE);
        assert.deepEqual(game.coreCtx, core);
        assert.deepEqual(game.dispCtx, display);
    });
}
