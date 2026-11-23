#!/usr/bin/env node
// Source-derived losestr boundaries; native spell damage is recorded separately.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {ABASE, setABASE, losestr} from '../js/attrib.js';
import {polymon} from '../js/polyself.js';
import {A_STR, Upolyd} from '../js/const.js';
import {PMNAMES} from '../js/monst_data.js';

async function setup() {
    const replay = await runSegment({
        seed:9780, datetime:'20000112093000', moves:' ',
        nethackrc:'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage:new InMemoryStorage(),
    });
    replay._display.onEmptyQueue = () => 32;
    game._preNhgetchHook = null;
    game.u.uhp = game.u.uhpmax = 16;
    game.u.uhppeak = 16;
}

test('ordinary strength loss leaves hit points unchanged', async () => {
    await setup();
    setABASE(A_STR, 5);
    await losestr(1, null, 0);
    assert.equal(ABASE(A_STR), 4);
    assert.deepEqual([game.u.uhp, game.u.uhpmax], [16, 16]);
});

test('life-saving cannot leave HP above the reduced maximum', async () => {
    await setup();
    setABASE(A_STR, 3);
    game.u.uhp = 1;
    await losestr(1, null, 0);
    assert.ok(game.u.uhpmax < 16);
    assert.equal(game.u.uhp, game.u.uhpmax);
    assert.equal(game.u.umortality, 1);
});

test('strength damage preserves the experience-level HP floor', async () => {
    await setup();
    setABASE(A_STR, 3);
    game.u.ulevel = 12;
    game.u.uhp = game.u.uhpmax = 13;
    await losestr(1, null, 0);
    assert.equal(game.u.uhpmax, 12);
});

test('polymorph damage reduces monster HP, leaving human HP intact', async () => {
    await setup();
    await polymon(PMNAMES.PM_KITTEN);
    setABASE(A_STR, 3);
    game.u.mh = game.u.mhmax = 20;
    const human = [game.u.uhp, game.u.uhpmax];
    await losestr(1, null, 0);
    assert.ok(Upolyd(game.u));
    assert.deepEqual([game.u.uhp, game.u.uhpmax], human);
    assert.ok(game.u.mhmax < 20);
    assert.equal(game.u.mh, game.u.mhmax);
});

test('rehumanization preserves human strength and maximum HP', async () => {
    await setup();
    const strength = ABASE(A_STR);
    const human = [game.u.uhp, game.u.uhpmax];
    await polymon(PMNAMES.PM_KITTEN);
    setABASE(A_STR, 5);
    game.u.mh = 1;
    await losestr(4, null, 0);
    assert.equal(Upolyd(game.u), false);
    assert.equal(ABASE(A_STR), strength);
    assert.deepEqual([game.u.uhp, game.u.uhpmax], human);
});

test('invalid strength loss reports the C diagnostic', async () => {
    await setup();
    await losestr(0, null, 0);
    assert.deepEqual(game.impossible_log, [`losestr: ${ABASE(A_STR)} - 0`]);
});
