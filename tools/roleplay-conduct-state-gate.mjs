#!/usr/bin/env node
// Source-derived controls for conduct states outside the native startup cases.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {show_conduct} from '../js/insight.js';
import {freeinv} from '../js/invent.js';

async function conduct(roleplay, final = 0, removePossessions = false) {
    const replay = await runSegment({
        seed:9790, datetime:'20000112093000', moves:' ',
        nethackrc:'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!legacy,!tutorial,!tips,pettype:none\n',
        storage:new InMemoryStorage(),
    });
    game._preNhgetchHook = null;
    Object.assign(game.u.uroleplay, roleplay);
    if (removePossessions) {
        for (const obj of [...game.invent])
            await freeinv(obj);
        assert.equal(game.invent.length, 0);
    }
    // Current sensory loss does not establish a lifelong conduct.
    game.u.intrinsic.HBlinded = 10;
    game.u.intrinsic.HDeaf = 10;
    const screens = [];
    replay._display.onEmptyQueue = () => {
        screens.push(replay._display.terminal.serialize());
        return 32;
    };
    await show_conduct(final);
    return screens.join('\n');
}

for (const [numrerolls, wording] of [
    [0, 'was not rerolled'], [1, 'was rerolled once'],
    [2, 'was rerolled twice'], [3, 'was rerolled thrice'],
    [4, 'was rerolled 4 times'],
]) {
    test(`reroll count ${numrerolls} uses C wording in both tenses`, async () => {
        for (const final of [0, 1]) {
            const screen = await conduct({reroll:true, numrerolls}, final);
            assert.ok(screen.includes(`Your character ${wording}.`));
        }
    });
}

test('disabled rerolling ignores a stale counter', async () => {
    const screen = await conduct({reroll:false, numrerolls:4});
    assert.ok(screen.includes('Character rerolling was not enabled.'));
    assert.ok(!screen.includes('was rerolled'));
});

test('temporary blindness and deafness do not imply birth conduct', async () => {
    const screen = await conduct({blind:false, deaf:false});
    assert.ok(!screen.includes('from birth'));
});

test('pauper conduct follows an inventory emptied through freeinv', async () => {
    for (const final of [0, 1, 2]) {
        const screen = await conduct({pauper:true}, final, true);
        assert.ok(screen.includes(final
            ? 'You started out without possessions.'
            : 'You are without possessions.'));
        assert.ok(!screen.includes('You started without possessions.'));
    }
});

test('pauper conduct with possessions retains its past starting state', async () => {
    for (const final of [0, 1, 2]) {
        const screen = await conduct({pauper:true}, final);
        assert.ok(screen.includes(final
            ? 'You started out without possessions.'
            : 'You started without possessions.'));
    }
});

test('losing all possessions does not establish pauper conduct', async () => {
    for (const final of [0, 1, 2]) {
        const screen = await conduct({pauper:false}, final, true);
        assert.ok(!screen.includes('without possessions'));
    }
});
