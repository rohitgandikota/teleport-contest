#!/usr/bin/env node

// State checks for draw-neutral decisions behind the source-audit C fixture.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { cmdq_add_int, cmdq_pop } from '../js/cmd.js';
import { some_armor } from '../js/do_wear.js';
import { avoid_moving_on_liquid } from '../js/hack.js';
import { tty_yn_function } from '../js/tty/topl.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { impossible } from '../js/pline.js';
import { remove_rooms } from '../js/mkmap.js';
import { ONAMES } from '../js/objects_data.js';
import { CMDQ_INT, CQ_CANNED, W_ARMS, POOL, IRONBARS } from '../js/const.js';
import { NO_COLOR } from '../js/terminal.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/source-audit-actions.json', import.meta.url), 'utf8'));

await runSegment({ ...recipe.segments[1], onFrame: () => {} });
const digging = game.invent.find(obj => obj.otyp === ONAMES.WAN_DIGGING);
const light = game.invent.find(obj => obj.otyp === ONAMES.WAN_LIGHT);
assert.equal(digging.spe, 8, 'directional wand uses the eight-charge limit');
assert.equal(light.spe, 12, 'nondirectional wand uses the fifteen-charge limit');

cmdq_add_int(CQ_CANNED, 314);
assert.deepEqual(cmdq_pop(), { typ: CMDQ_INT, intval: 314 });
const shield = { owornmask: W_ARMS };
assert.equal(some_armor({ minvent: [shield] }), shield,
             'monster armor selection reads the monster inventory');

const water = game.level.at(game.u.ux + 1, game.u.uy);
const oldWater = { ...water };
const boots = { otyp: ONAMES.WATER_WALKING_BOOTS, oerodeproof: 1, rknown: 1 };
water.typ = POOL;
water.seenv = 1;
game.context.run = 1;
game.objects[boots.otyp].oc_name_known = 1;
game.u.uarmf = boots;
assert.equal(avoid_moving_on_liquid(game.u.ux + 1, game.u.uy, false), false,
             'known water-walking boots are read from the hero equipment');
game.u.uarmf = null;
assert.equal(avoid_moving_on_liquid(game.u.ux + 1, game.u.uy, false), true,
             'without known boots a run stops at seen water');
Object.assign(water, oldWater);

const clearTop = () => {
    game._topline_physical_prefix = game._pending_message = game._toplines = '';
    game._topl_curx = game._topl_cury = game._toplin = 0;
    for (let x = 0; x < game.nhDisplay.cols; ++x)
        game.nhDisplay.setCell(x, 0, ' ', NO_COLOR, 0);
};
clearTop();
resetInputState();
const reads = [];
game._preNhgetchHook = () => reads.push({
    line: game.nhDisplay.grid[0].map(cell => cell.ch).join(''),
    cursor: [game.nhDisplay.cursorX, game.nhDisplay.cursorY],
});
pushKeys('#\bny');
assert.equal(await tty_yn_function('Take it?', 'yn#', 'n'), 'n');
assert.match(reads[1].line, /Take it\? \[yn#\] \(n\) #/);
assert.doesNotMatch(reads[2].line, /Take it\? \[yn#\] \(n\) #/);
game._preNhgetchHook = null;
assert.equal(game.yn_number, 0);

clearTop();
resetInputState();
pushKeys('   ');
game.program_state = { something_worth_saving: true };
await impossible('regular room in joined map');
assert.deepEqual(game.impossible_log, ['regular room in joined map']);
assert.equal(game.program_state.in_impossible, 0);

const regular = { lx: 1, ly: 1, hx: 3, hy: 3, irregular: false };
game.level.rooms = [regular];
game.level.nroom = 1;
clearTop();
resetInputState();
pushKeys('   ');
await remove_rooms(2, 2, 4, 4);
assert.equal(game.level.nroom, 1, 'a partially overlaid room is retained');
assert.equal(game.impossible_log.at(-1), 'regular room in joined map');

game.level.rooms = [{ lx: 2, ly: 2, hx: 3, hy: 3, irregular: false }];
game.level.nroom = 1;
await remove_rooms(1, 1, 4, 4);
assert.equal(game.level.nroom, 0, 'a fully overlaid room is removed');

await runSegment({ ...recipe.segments[4], onFrame: () => {} });
assert.equal(game.u.utraptype, 2, 'the exploded land mine becomes a pit');
assert.equal(game.u.utrap, 7, 'the hero recursively enters the resulting pit');
assert.equal(game.u.uhp, 81, 'the land mine and pit apply the C damage rolls');

await runSegment({ ...recipe.segments[5], onFrame: () => {} });
assert.deepEqual([game.u.ux, game.u.uy], [53, 11],
                 'an ordinary human remains outside the iron bars');
assert.equal(game.level.at(52, 11).typ, IRONBARS,
             'the wished terrain remains iron bars');

console.log('source audit state: PASS');
