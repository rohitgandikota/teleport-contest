#!/usr/bin/env node

// State checks for src/sp_lev.c add_doors_to_room(). The paired C recording
// pins the later niche RNG decisions which depend on these door counts.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/themed-subroom-doors.json', import.meta.url), 'utf8'));

await runSegment({ ...recipe.segments[0], onFrame: () => {} });

const room = game.level.rooms[0];
const subroom = game.level.subrooms[0];
assert.deepEqual([room.lx, room.ly, room.hx, room.hy], [3, 9, 19, 17]);
assert.deepEqual([subroom.lx, subroom.ly, subroom.hx, subroom.hy],
                 [5, 17, 17, 17]);
assert.deepEqual([subroom.doorct, subroom.fdoor], [2, 0],
                 'the nested subroom owns both fixed doors');
assert.deepEqual([room.doorct, room.fdoor], [4, 2],
                 'the outer room owns both fixed doors, a corridor door, and a niche door');
assert.equal(game.level.doorindex, 21,
             'the shared door table has the C-recorded number of entries');

const doors = game.level.doors.slice(0, game.level.doorindex);
for (const expected of [{ x: 5, y: 16 }, { x: 4, y: 17 }]) {
    assert.equal(doors.filter(door => door.x === expected.x
                                    && door.y === expected.y).length, 2,
                 `door (${expected.x},${expected.y}) belongs to both nested rooms`);
}

console.log('themed subroom door registration state: PASS');
