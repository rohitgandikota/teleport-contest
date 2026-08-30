#!/usr/bin/env node

// State checks for the ordinary-terrain path through src/zap.c zap_map().
// The matching C recipe zaps striking across room, wall, corridor, and doors.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { DOOR, D_BROKEN, COLNO, ROWNO } from '../js/const.js';

const recipePath = new URL('gen-sessions/recipes/wand-striking-door.json',
                           import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));
await runSegment({ ...recipe.segments[0], onFrame: () => {} });

let brokenDoors = 0;
for (let x = 1; x < COLNO; ++x) {
    for (let y = 0; y < ROWNO; ++y) {
        const loc = game.level.at(x, y);
        if (loc?.typ === DOOR && (loc.doormask & D_BROKEN))
            ++brokenDoors;
    }
}

assert.ok(brokenDoors >= 2, 'both struck doors remain broken');
assert.ok(![...(game.unported || [])].some(path =>
    path.startsWith('zap:zap_map:terrain_reveal')),
          'ordinary striking terrain has no zap-map gap marker');
assert.ok(!game.unported?.has('zap:zap_map:drawbridge'),
          'the ordinary route does not claim a drawbridge path');
assert.ok(!game.unported?.has('zap:zap_map:probing'),
          'the ordinary route does not claim a probing path');

console.log('zap map state: PASS');
