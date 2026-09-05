#!/usr/bin/env node

// The C oracles pin screens and RNG. These source-derived assertions check
// persistent references which can be wrong even when those traces match.
// C: invent.c:876 merged(), light.c:808 obj_merge_light_sources(), and
// light.c:838 candle_light_range().

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { W_WEP, W_SWAPWEP, W_QUIVER, OBJ_INVENT } from '../js/const.js';
import { BURN_OBJECT } from '../js/timeout.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/inventory-adjust-equipment.json', import.meta.url),
'utf8'));
const expectedSlots = {
    'merge-wielded': ['uwep', W_WEP],
    'merge-quivered': ['uquiver', W_QUIVER],
    'merge-alternate': ['uswapwep', W_SWAPWEP],
    'merge-wielded-quiver': ['uwep', W_WEP],
    'merge-quiver-wielded': ['uwep', W_WEP],
    'merge-alternate-quiver': ['uswapwep', W_SWAPWEP],
};

for (const segment of recipe.segments) {
    await runSegment({ ...segment, storage: new InMemoryStorage() });
    assert.equal(game.invent.length, 1, segment.name + ': one combined stack');
    const obj = game.invent[0];
    assert.equal(obj.quan, 10, segment.name + ': preserve total quantity');
    assert.equal(obj.where, OBJ_INVENT);
    assert.equal(obj.invlet, 'a');

    if (segment.name in expectedSlots) {
        const [slot, mask] = expectedSlots[segment.name];
        for (const candidate of ['uwep', 'uswapwep', 'uquiver'])
            assert.equal(game.u[candidate] ?? null, candidate === slot ? obj : null,
                         segment.name + ': ' + candidate + ' references the surviving stack');
        assert.equal(obj.owornmask, mask, segment.name + ': C equipment precedence');
    } else {
        assert.equal(segment.name, 'lit-candle-merge');
        assert.equal(obj.lamplit, 1);
        assert.equal(obj.timed, 1);
        const lights = game.light_sources.filter(light => light.type === 1);
        assert.equal(lights.length, 1, 'merging lit candles removes the discarded light source');
        assert.equal(lights[0].id, obj.o_id, 'the remaining light belongs to the combined stack');
        assert.equal(lights[0].range, 4, 'C gives ten candles radius four');
        const timers = game.timer_base.filter(timer => timer.func_index === BURN_OBJECT);
        assert.equal(timers.length, 1, 'one burn timer survives the merger');
        assert.equal(timers[0].arg, obj, 'the burn timer references the combined stack');
    }
}

console.log('inventory adjustment state: PASS (seven C scenarios)');
