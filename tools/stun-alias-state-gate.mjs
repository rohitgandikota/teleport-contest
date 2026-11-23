// Source-state controls. These call real producers and earn no native coverage.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {set_uasmon} from '../js/polyself.js';
import {make_stunned} from '../js/potion.js';
import {set_ulycn} from '../js/were.js';
import {Stunned} from '../js/youprop.js';
import {dosave0, dorecover, gamestate_decode} from '../js/save.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES} from '../js/monst_data.js';
import {FROMFORM, TIMEOUT, NON_PM} from '../js/const.js';

async function setup() {
    await runSegment({seed:99812, datetime:'20000110090000', moves:' ',
        nethackrc:'OPTIONS=name:Desired,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage:new InMemoryStorage()});
}
function form(id) {
    game.u.umonnum = id;
    const calls = getRngLog().length;
    assert.equal(set_uasmon(), undefined, 'producer stays synchronous and void');
    assert.equal(getRngLog().length, calls, 'alias synchronization consumes no RNG');
}
function status(raw) {
    assert.equal(game.u.intrinsic.HStun || 0, raw);
    assert.equal(game.u.uprops?.STUNNED || 0, raw ? 1 : 0);
    assert.equal(Stunned(), !!raw);
    if (!raw) assert.equal(Object.hasOwn(game.u.uprops || {}, 'STUNNED'), false);
}

test('set_uasmon mirrors FROMFORM entry and removal without a timeout', async () => {
    await setup();
    status(0);
    for (const id of [PMNAMES.PM_GIANT_BAT, PMNAMES.PM_STALKER, PMNAMES.PM_BAT]) {
        form(id); status(FROMFORM);
        form(PMNAMES.PM_GIANT_ANT); status(0);
    }
});
test('timed stun survives both form transitions and clears through make_stunned', async () => {
    await setup();
    await make_stunned(11, false); status(11);
    form(PMNAMES.PM_GIANT_BAT); status(FROMFORM | 11);
    form(PMNAMES.PM_GIANT_ANT); status(11);
    await make_stunned(0, false); status(0);
});
test('expiry keeps FROMFORM, then form removal clears the last stun source', async () => {
    await setup();
    form(PMNAMES.PM_GIANT_BAT);
    await make_stunned(1, false); status(FROMFORM | 1);
    await make_stunned(0, false); status(FROMFORM);
    form(PMNAMES.PM_GIANT_ANT); status(0);
});
test('timer clamping preserves form bits; form changes preserve the timer mask', async () => {
    await setup();
    form(PMNAMES.PM_STALKER);
    await make_stunned(TIMEOUT + 1, false); status(FROMFORM | TIMEOUT);
    form(PMNAMES.PM_GIANT_ANT); status(TIMEOUT);
});
test('set_ulycn refreshes form properties without losing or duplicating timed stun', async () => {
    await setup();
    form(PMNAMES.PM_STALKER);
    await make_stunned(7, false);
    set_ulycn(PMNAMES.PM_WEREWOLF); status(FROMFORM | 7);
    set_ulycn(NON_PM); status(FROMFORM | 7);
});
for (const kind of ['form-only', 'mixed', 'cleared']) {
    test(`dosave0/dorecover preserves the real producer's ${kind} stun state`, async () => {
        await setup();
        form(PMNAMES.PM_GIANT_BAT);
        if (kind !== 'form-only') await make_stunned(7, false);
        if (kind === 'cleared') {
            await make_stunned(0, false);
            form(PMNAMES.PM_GIANT_ANT);
        }
        const expected = kind === 'cleared' ? 0 : FROMFORM | (kind === 'mixed' ? 7 : 0);
        status(expected);
        assert.equal(dosave0(), true);
        const saved = gamestate_decode(JSON.parse(game.storage.getItem(`save:${game.plname}`)));
        assert.equal(saved.u.intrinsic.HStun, expected);
        assert.equal(saved.u.uprops.STUNNED || 0, expected ? 1 : 0);
        await make_stunned(3, false);
        assert.equal(await dorecover(), true);
        status(expected);
        form(PMNAMES.PM_GIANT_ANT);
        status(expected & TIMEOUT);
    });
}
