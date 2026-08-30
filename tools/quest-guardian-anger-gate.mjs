#!/usr/bin/env node

// State checks for src/mon.c qst_guardians_respond() through setmangry().

import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { setmangry } from '../js/mon.js';
import { makemon, NO_MM_FLAGS } from '../js/makemon.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';

await runSegment({
    seed: 8112,
    datetime: '20000112090000',
    nethackrc: [
        'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug',
        'OPTIONS=!autopickup,!tutorial,!tips,pettype:none',
        'OPTIONS=suppress_alert:3.4.3',
        'OPTIONS=symset:DECgraphics',
        '',
    ].join('\n'),
    moves: ' ',
    onFrame: () => {},
});

const leadernum = game.urole.ldrnum;
const guardnum = game.urole.guardnum;
const leader = makemon(game.mons[leadernum], 0, 0, NO_MM_FLAGS);
const firstGuard = makemon(game.mons[guardnum], 0, 0, NO_MM_FLAGS);
const secondGuard = makemon(game.mons[guardnum], 0, 0, NO_MM_FLAGS);
assert.ok(leader && firstGuard && secondGuard,
          'leader and quest guardians were created');
leader.mpeaceful = 1;
leader.mtame = 0;
firstGuard.mpeaceful = 1;
secondGuard.mpeaceful = 1;

initRng(102);
enableRngLog();
await setmangry(leader, false);

assert.deepEqual(getRngLog(), [], 'quest guardian anger consumes no RNG');
assert.equal(leader.mpeaceful, 0, 'attacked quest leader becomes hostile');
assert.equal(firstGuard.mpeaceful, 0, 'first quest guardian becomes hostile');
assert.equal(secondGuard.mpeaceful, 0, 'second quest guardian becomes hostile');
assert.ok(!game.unported?.has('setmangry:quest_leader_check'),
          'quest leader reaction is no longer marked unported');

console.log('quest guardian anger: PASS');
