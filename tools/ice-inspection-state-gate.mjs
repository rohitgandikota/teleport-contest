// pager.c:1599-1603 delegates detailed ice inspection to its canonical helper.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, seed, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {set_levltyp} from '../js/mkmaze.js';
import {newsym} from '../js/display.js';
import {do_screen_description} from '../js/pager.js';
import {start_timer, TIMER_LEVEL, MELT_ICE_AWAY} from '../js/timeout.js';
import {getRngLog} from '../js/rng.js';
import {ICE} from '../js/const.js';

async function ice(dx, remaining) {
    await setup(); set_levltyp(dx, y, ICE);
    if (remaining) assert.equal(start_timer(remaining, TIMER_LEVEL, MELT_ICE_AWAY, (dx << 16) | y), true);
    newsym(dx, y); seed();
}
for (const [remaining, rating, adjective] of [
    [0, 0, 'solid'], [1, 5, 'slushy'], [14, 5, 'slushy'],
    [15, 4, 'thin'], [50, 4, 'thin'], [51, 3, 'unsteady'],
    [100, 3, 'unsteady'], [101, 2, 'steady'], [1000, 2, 'steady'],
    [1001, 1, 'sturdy'],
]) test(`nearby ice with ${remaining} turns remaining`, async () => {
    const dx = x + 1; await ice(dx, remaining);
    const timers = JSON.stringify(game.timer_base);
    const result = do_screen_description({x:dx, y}, true, 0);
    assert.equal(result.firstmatch, `${adjective} ice`);
    assert.ok(result.out_str.endsWith(`(${adjective} ice)`));
    assert.equal(game.iflags.ice_rating, rating);
    assert.equal(JSON.stringify(game.timer_base), timers);
    assert.deepEqual(getRngLog(), []);
});

test('distant ice stays unqualified', async () => {
    const dx = x + 4; await ice(dx, 1001);
    assert.equal(do_screen_description({x:dx, y}, true, 0).firstmatch, 'ice');
    assert.equal(game.iflags.ice_rating, -1);
    assert.deepEqual(getRngLog(), []);
});

test('keyboard symbol lookup does not inspect an ice square', async () => {
    const dx = x + 1; await ice(dx, 1001);
    const before = game.iflags.ice_rating;
    const result = do_screen_description({x:dx, y}, false, '.');
    assert.ok(!result.out_str.includes('sturdy'));
    assert.equal(game.iflags.ice_rating, before);
    assert.deepEqual(getRngLog(), []);
});
