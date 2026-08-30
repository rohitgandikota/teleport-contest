#!/usr/bin/env node

// State checks for the shopkeeper path through src/mon.c m_detach().
// variant-world-tour.session.json records the same path against C output.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { m_detach } from '../js/mon.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { MON_DETACH, ROOMOFFSET } from '../js/const.js';

const recipePath = new URL('gen-sessions/recipes/shop-normal.json',
                           import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));
await runSegment({ ...recipe.segments[0], onFrame: () => {} });

const shkp = game.level.monsters.find(mon => mon.isshk && mon.mhp > 0);
assert.ok(shkp, 'the natural shopkeeper is alive');
const eshk = shkp.eshk || shkp.mextra?.eshk;
assert.ok(eshk, 'shopkeeper state exists');
const room = game.level.rooms[eshk.shoproom - ROOMOFFSET];
assert.ok(room, 'shop room exists');
room.resident = shkp;

const stock = game.level.objects.find(obj =>
    obj.ox >= room.lx && obj.ox <= room.hx
    && obj.oy >= room.ly && obj.oy <= room.hy);
assert.ok(stock, 'shop stock exists');
stock.no_charge = 1;

const roomchar = String.fromCharCode(eshk.shoproom);
if (!game.u.ushops.includes(roomchar))
    game.u.ushops += roomchar;
const mx = shkp.mx;
const my = shkp.my;
const purgeBefore = game.iflags.purge_monsters | 0;

initRng(102);
enableRngLog();
m_detach(shkp, shkp.data, false);

assert.deepEqual(getRngLog(), [], 'shopkeeper detach consumes no RNG');
assert.equal(game.level.monAt.get(`${mx},${my}`), undefined,
             'shopkeeper leaves the map immediately');
assert.ok(game.level.monsters.includes(shkp),
          'shopkeeper remains in the monster list until the purge');
assert.equal(shkp.mhp, 0, 'detached shopkeeper is dead');
assert.ok(shkp.mstate & MON_DETACH, 'detach state is set');
assert.equal(game.iflags.purge_monsters, purgeBefore + 1,
             'deferred purge count advances');
assert.equal(room.resident, null, 'shop room residency is cleared');
assert.equal(stock.no_charge, 0, 'former shop stock loses shop ownership');
assert.ok(!game.u.ushops.includes(roomchar),
          'hero is removed from the closed shop');
assert.ok(![...(game.unported || [])].some(path =>
    path.startsWith('mon:m_detach:')),
          'the covered shopkeeper path has no detach gap marker');

console.log('monster detach state: PASS');
