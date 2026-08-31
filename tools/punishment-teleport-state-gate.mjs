#!/usr/bin/env node

// State checks for src/teleport.c teleds() punishment relocation.
// The matching C recipe pins the distant and nearby visible outcomes.

import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { teleds, TELEDS_ALLOW_DRAG, TELEDS_NO_FLAGS, TELEDS_TELEPORT }
    from '../js/teleport.js';
import { addinv, obj_extract_self } from '../js/invent.js';
import { OBJ_FLOOR, OBJ_INVENT } from '../js/const.js';

const nethackrc = [
    'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug',
    'OPTIONS=!autopickup,!tutorial,!tips,pettype:none,debug_mongen',
    'OPTIONS=suppress_alert:3.4.3',
    'OPTIONS=symset:DECgraphics',
    '',
].join('\n');

const setupMoves = ' \x17cursed scroll of punishment\ri\x1bro '
    + 'm\x14whhhhhhhhhhhhh.\x1b\x1b\x06hh';

async function setupSpreadPunishment() {
    await runSegment({
        seed: 6960,
        datetime: '20000112121500',
        nethackrc,
        moves: setupMoves,
        onFrame: () => {},
    });
    const { ux, uy, uball, uchain } = game.u;
    assert.deepEqual(
        [uball?.ox, uball?.oy, uchain?.ox, uchain?.oy],
        [ux + 2, uy, ux + 1, uy],
        'setup spreads hero, chain, and floor ball across three squares',
    );
    assert.equal(game.u.uball.where, OBJ_FLOOR, 'setup ball is on the floor');
    assert.equal(game.u.uchain.where, OBJ_FLOOR, 'setup chain is on the floor');
}

await setupSpreadPunishment();
let { ux, uy } = game.u;
await teleds(ux, uy + 2, TELEDS_TELEPORT);
assert.deepEqual(
    [game.u.uball.ox, game.u.uball.oy,
     game.u.uchain.ox, game.u.uchain.oy],
    [ux + 2, uy, ux + 1, uy + 1],
    'nearby teleport fixes the ball and moves only the chain',
);

await setupSpreadPunishment();
({ ux, uy } = game.u);
await teleds(ux - 1, uy, TELEDS_ALLOW_DRAG);
assert.deepEqual(
    [game.u.ux, game.u.uy,
     game.u.uball.ox, game.u.uball.oy,
     game.u.uchain.ox, game.u.uchain.oy],
    [ux - 1, uy, ux + 1, uy, ux, uy],
    'allowed one-step relocation drags both punishment pieces',
);

await setupSpreadPunishment();
({ ux, uy } = game.u);
pushKeys('\x1b\x1b');
await teleds(ux - 1, uy, TELEDS_NO_FLAGS);
assert.deepEqual(
    [game.u.ux, game.u.uy,
     game.u.uball.ox, game.u.uball.oy,
     game.u.uchain.ox, game.u.uchain.oy],
    [ux - 1, uy, ux - 1, uy, ux - 1, uy],
    'short relocation without drag permission rebuilds both pieces below the hero',
);

await setupSpreadPunishment();
({ ux, uy } = game.u);
const carriedBall = game.u.uball;
obj_extract_self(carriedBall);
await addinv(carriedBall);
assert.equal(carriedBall.where, OBJ_INVENT, 'test ball enters inventory');
await teleds(ux - 1, uy, TELEDS_ALLOW_DRAG);
assert.deepEqual(
    [game.u.ux, game.u.uy,
     carriedBall.where,
     game.u.uchain.ox, game.u.uchain.oy],
    [ux - 1, uy, OBJ_INVENT, ux, uy],
    'a carried ball stays carried while the chain follows an allowed move',
);

console.log('punishment teleport state: PASS');
