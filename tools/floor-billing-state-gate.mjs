#!/usr/bin/env node
// Source-derived mkobj.c:2358 placement controls using the real shop helpers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { costly_spot, costly_adjacent, find_objowner } from '../js/shk.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { ROOM, OBJ_FLOOR } from '../js/const.js';

const input = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/shop-normal.json', import.meta.url))).segments[0];

for (const location of ['outside', 'interior', 'free-post', 'door', 'untended-door']) {
    test(`floor billing flag at ${location}`, async () => {
        await runSegment({ ...input, storage: new InMemoryStorage() });
        const keeper = game.level.monsters.find(mon => mon.isshk && mon.mhp > 0);
        assert.ok(keeper);
        const obj = mksobj(ONAMES.DAGGER, false, false);
        obj.no_charge = 1;
        let pos = location.includes('door') ? keeper.eshk.shd : keeper.eshk.shk;
        if (location === 'interior' || location === 'outside') {
            pos = null;
            for (let x = 1; x < 79 && !pos; x++) {
                for (let y = 0; y < 21; y++) {
                    if (game.level.at(x, y).typ !== ROOM) continue;
                    if (location === 'interior' ? costly_spot(x, y)
                        : !costly_spot(x, y) && !costly_adjacent(keeper, x, y)) {
                        pos = { x, y };
                        break;
                    }
                }
            }
        }
        assert.ok(pos);
        assert.equal(costly_spot(pos.x, pos.y), location === 'interior');
        if (location === 'free-post' || location.includes('door'))
            assert.equal(costly_adjacent(keeper, pos.x, pos.y), true);
        if (location === 'untended-door') {
            for (const room of game.level.rooms)
                if (room.resident === keeper) room.resident = null;
        }
        assert.equal(find_objowner(obj, pos.x, pos.y),
            location === 'outside' || location === 'untended-door' ? null : keeper);

        initRng(3);
        enableRngLog();
        place_object(obj, pos.x, pos.y);
        assert.equal(obj.no_charge,
            location === 'outside' || location === 'untended-door' ? 0 : 1);
        assert.equal(obj.where, OBJ_FLOOR);
        assert.ok(game.level.objectsAt(pos.x, pos.y).includes(obj));
        assert.equal(game.level.objects.filter(item => item === obj).length, 1);
        assert.deepEqual(getRngLog(), []);
    });
}
