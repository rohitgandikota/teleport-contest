#!/usr/bin/env node
// src/explode.c scatter() passes an object pointer to thitu(). A potion
// consumed on impact must not be placed back on the floor afterwards.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { scatter } from '../js/explode.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { initRng, rn2 } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { ROOM, MAY_HITYOU, N_DIRS, xdir, ydir, OBJ_DELETED, OBJ_FLOOR } from '../js/const.js';

for (const [otyp, hits] of [[ONAMES.POT_WATER, true], [ONAMES.DAGGER, true],
                            [ONAMES.DAGGER, false]]) {
    test(`scattered object ${otyp}, hits=${hits}`, async () => {
        const replay = await runSegment({ seed: 20104, datetime: '20000211130000',
            nethackrc: 'OPTIONS=name:Scatter,role:Knight,race:human,gender:male,align:lawful\n',
            moves: '  n', storage: new InMemoryStorage() });
        // Escape acknowledges More and cancels an unknown potion's naming
        // prompt. Repeated spaces would keep that text prompt open forever.
        replay._display.onEmptyQueue = () => 0x1b;
        game.u.ux = 30;
        game.u.uy = 10;
        game.u.uhp = game.u.uhpmax = 200;
        game.u.uac = hits ? 100 : -100;
        game.level.monAt.clear();
        for (let x = 29; x <= 31; x++)
            for (let y = 9; y <= 11; y++)
                game.level.at(x, y).typ = ROOM;

        // Choose the source square from the seeded direction so this is a
        // collision test regardless of the direction table's orientation.
        initRng(42);
        const direction = rn2(N_DIRS);
        const sx = game.u.ux - xdir[direction], sy = game.u.uy - ydir[direction];
        const obj = mksobj(otyp, false, false);
        obj.quan = 1;
        obj.spe = 0;
        obj.blessed = obj.cursed = false;
        place_object(obj, sx, sy);
        initRng(42);
        const moved = await scatter(sx, sy, 1, MAY_HITYOU, obj);
        if (otyp === ONAMES.POT_WATER) {
            assert.equal(obj.where, OBJ_DELETED);
            assert.equal(game.level.objects.includes(obj), false);
            assert.equal(moved, 0);
        } else {
            assert.equal(obj.where, OBJ_FLOOR);
            assert.equal(game.level.objects.includes(obj), true);
            assert.deepEqual([obj.ox, obj.oy], [game.u.ux, game.u.uy]);
            assert.equal(moved, 1);
            assert.equal(game.u.uhp < 200, hits);
        }
        assert.equal(game.thrownobj, null);
    });
}
