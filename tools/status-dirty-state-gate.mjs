#!/usr/bin/env node

// C flush_screen, bot, and timebot keep stale status until the right flag.
// In particular, a time-only update must not expose unrelated live changes.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { bot, flush_screen, timebot } from '../js/display.js';
import { setuhpmax } from '../js/exper.js';
import { PMNAMES } from '../js/monst_data.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/revival-substitute-types.json', import.meta.url), 'utf8'));
await runSegment({ ...recipe.segments[0], moves: ' ' });
assert.equal(game.u.uhppeak, game.u.uhpmax, 'newgame initializes peak HP');
assert.equal(game.u.uenpeak, game.u.uenmax, 'newgame initializes peak energy');
const row = (index) => game.nhDisplay.grid[index].map(cell => cell.ch).join('');

await bot();
const oldStatus = row(23);
game.u.uen += 7;
await flush_screen(1);
assert.equal(row(23), oldStatus, 'a map flush preserves clean status');
game.disp.botl = true;
await flush_screen(1);
assert.notEqual(row(23), oldStatus, 'a dirty status refreshes live values');
assert.equal(game.disp.botl, false, 'bot clears the dirty flags');

game.flags.time = true;
game.moves = 9;
await bot();
const beforeTime = row(23);
const beforeTitle = row(22);
game.u.uen += 7;
game.moves = 10;
game.disp.time_botl = true;
await flush_screen(1);
assert.equal(row(23), beforeTime.replace(' T:9', ' T:10').slice(0, 80),
             'time-only update preserves every other field, even at a digit boundary');
assert.equal(row(22), beforeTitle, 'time-only update leaves the first row alone');
assert.equal(game.disp.time_botl, false);
game.bot_disabled = true;
game.disp.time_botl = true;
timebot();
assert.equal(game.disp.time_botl, true, 'disabled bot leaves the update pending');
game.bot_disabled = false;

// src/attrib.c:1157 setuhpmax has separate human and monster HP branches.
const u = game.u;
u.umonnum = PMNAMES.PM_XORN;
u.mtimedone = 100;
u.uhpmax = 20;
u.uhp = 25;
u.uhppeak = 30;
u.mhmax = 10;
u.mh = 13;
game.disp.botl = false;
setuhpmax(8, false);
assert.deepEqual([u.mhmax, u.mh, u.uhpmax, u.uhp], [8, 8, 20, 25]);
assert.equal(game.disp.botl, true);
game.disp.botl = false;
setuhpmax(18, true);
assert.deepEqual([u.mhmax, u.mh, u.uhpmax, u.uhp, u.uhppeak], [8, 8, 18, 18, 30]);
assert.equal(game.disp.botl, true);
game.disp.botl = false;
setuhpmax(18, true);
assert.equal(game.disp.botl, false, 'unchanged HP leaves status clean');
u.uhp = 19;
setuhpmax(18, true);
assert.equal(u.uhp, 18);
assert.equal(game.disp.botl, true, 'clamping HP dirties unchanged maximum HP');

// The C trace rolls rn2(20000)=2952 at level 13. rndexp doubles it and
// adds the level's 40000-point floor after applying the 32767 bound.
const levelRecipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/polymorph-level-gain.json', import.meta.url), 'utf8'));
await runSegment({ ...levelRecipe.segments[1] });
assert.equal(game.u.mtimedone, 0, 'the probe returns to human form');
assert.equal(game.u.ulevel, 13);
assert.equal(game.u.uexp, 45904, 'rndexp restores the scaled random value');

console.log('status dirty state: PASS');
