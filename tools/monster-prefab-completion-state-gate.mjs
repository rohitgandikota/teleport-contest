// dat/hellfill.lua:300-443 and sp_lev.c:6308-6311: finish prefab contents,
// reset their map frame, then place stairs and populate the whole level.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { GameMap } from '../js/game.js';
import { hellfill_level } from '../js/dat/hellfill.js';
import { create_des_coder, reset_xystart_size } from '../js/sp_lev.js';
import { TOPLINE_EMPTY } from '../js/display.js';
import { PMNAMES as P } from '../js/monst_data.js';
import { G_GENOD } from '../js/const.js';
import { initRng } from '../js/rng.js';

for (const [seed, dimensions, min, max] of [[8, [13, 11], 4, 8], [18, [10, 10], 1, 1]])
    test(`prefab ${dimensions.join('x')} finishes before stairs and whole-level stocking`, async () => {
        const run = await runSegment({ seed: 99812, datetime: '20000110090000', moves: ' ',
            nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
                + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
            storage: new InMemoryStorage() });
        game._preNhgetchHook = null;
        game._toplin = TOPLINE_EMPTY; game._toplines = game._pending_message = '';
        game.level = new GameMap(); game.level.flags.rndmongen = true;
        game.in_mklev = true; game.in_mk_themerooms = false;
        game.coder = null; create_des_coder(); reset_xystart_size();
        game.stairs = null; game.exclusion_zones = [];
        game.u.ulevel = 10; game.u.uz.dnum = 1; game.u.uz.dlevel = 12;
        game.flags.monpolycontrol = true;
        // The real exhausted-class fallback selects the sole eligible species.
        for (const [index, vital] of game.mvitals.entries())
            if (index !== P.PM_CHAMELEON) vital.mvflags |= G_GENOD;
        initRng(seed);
        let keys = [], prefabPrompts = 0, stockingPrompts = 0, prefabFrame;
        run._display.onEmptyQueue = () => {
            if (!keys.length) {
                assert.match(game._toplines, /^Change the chameleon @ .* into what\? /);
                const frame = [game.xstart, game.ystart, game.xsize, game.ysize];
                if (game.xsize < 79) {
                    ++prefabPrompts;
                    assert.equal(game.stairs, null, 'stairs must wait for the prefab contents');
                    assert.equal(stockingPrompts, 0, 'stocking must wait for the prefab contents');
                    assert.deepEqual(frame.slice(2), dimensions);
                    if (prefabFrame) assert.deepEqual(frame, prefabFrame);
                    prefabFrame = frame;
                } else {
                    ++stockingPrompts;
                    assert.ok(prefabPrompts >= min && prefabPrompts <= max);
                    assert.deepEqual(frame, [1, 0, 79, 21]);
                    assert.ok(game.stairs && game.stairs.next, 'both stairs precede stocking');
                }
                keys = [...'chameleon\r'];
            }
            return keys.shift().charCodeAt(0);
        };
        await hellfill_level();
        assert.ok(prefabPrompts >= min && prefabPrompts <= max);
        assert.ok(stockingPrompts > 0);
        assert.deepEqual([game.xstart, game.ystart, game.xsize, game.ysize], [1, 0, 79, 21]);
    });
