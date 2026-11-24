// C monmove.c:1733-1741, 1987-2008, and itsstuck():1053-1061.
// Ordinary input creates the owlbear and its held golem. Small constructed
// terrain layouts then isolate real m_move decisions without replacing helpers.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {GameMap} from '../js/game.js';
import {makemon, place_monster, remove_monster} from '../js/makemon.js';
import {mksobj, place_object} from '../js/mkobj.js';
import {ONAMES} from '../js/objects_data.js';
import {m_at, mfndpos, mon_allowflags, unstuck} from '../js/mon.js';
import {m_move, monflee} from '../js/monmove.js';
import {sticks} from '../js/mondata.js';
import {maketrap} from '../js/mklev.js';
import {mintrap} from '../js/trap.js';
import {vision_reset, vision_recalc} from '../js/vision.js';
import {resetInputState} from '../js/input.js';
import {pline, TOPLINE_EMPTY} from '../js/display.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {PMNAMES} from '../js/monst_data.js';
import {ROOM, BEAR_TRAP, FORCETRAP, ALLOW_U, MMOVE_NOTHING, MMOVE_MOVED,
    MMOVE_DONE, MMOVE_NOMOVES, NO_MINVENT, MM_NOMSG, MM_NOGRP} from '../js/const.js';

const recipe = JSON.parse(readFileSync(new URL(
    './gen-sessions/recipes/sticky-hero-blocks-monster-escape.json', import.meta.url)));
const message = () => game.nhDisplay.grid[0].map(cell => cell.ch).join('').trimEnd();
function clearMessages() {
    Object.assign(game, {_toplin:TOPLINE_EMPTY, _toplines:'', _prevmsg:'',
        _pending_message:'', _msg_history:[], _win_stop:false});
}
function resetRng() { initRng(1); enableRngLog(); }
async function setup(destinations = [[39,10], [41,10]]) {
    const part = recipe.segments[0];
    const prefix = part.moves.slice(0, part.moves.indexOf('\x173 blessed scrolls'));
    assert.ok(prefix.endsWith('#polyself\rowlbear\ru  '));
    const run = await runSegment({...part, moves:prefix, storage:new InMemoryStorage()});
    const held = game.u.ustuck;
    assert.ok(held && held.data.pmidx === PMNAMES.PM_IRON_GOLEM);
    assert.equal(game.u.umonnum, PMNAMES.PM_OWLBEAR);
    assert.deepEqual(game.youmonst.data, game.mons[game.u.umonnum]);
    assert.ok(sticks(game.youmonst.data) && !game.u.uswallow);
    assert.equal((held.minvent || []).length, 0);
    game._preNhgetchHook = null;
    resetInputState();
    run._display.onEmptyQueue = () => { throw Error('unexpected input'); };
    game.level = new GameMap();
    game.regions = [];
    game.u.ux = 39; game.u.uy = 10; game.u.urooms = '';
    for (const [x,y] of [[40,10], ...destinations])
        Object.assign(game.level.at(x,y), {typ:ROOM, lit:1, waslit:1});
    game.level.monsters.push(held);
    place_monster(held, 40, 10);
    Object.assign(held, {mux:39, muy:10});
    await monflee(held, 0, false, false);
    assert.equal(game.u.ustuck, held);
    assert.equal(held.mflee, 1);
    vision_reset(); vision_recalc(0);
    clearMessages(); resetRng();
    return {run, held};
}
function candidates(mon) {
    const data = {};
    const count = mfndpos(mon, data, mon_allowflags(mon));
    assert.equal(count, data.poss.length);
    return data;
}
function stays(mon, held = mon) {
    assert.deepEqual([mon.mx, mon.my], [40,10]);
    assert.equal(m_at(40,10), mon);
    assert.equal(game.u.ustuck, held);
    assert.deepEqual(mon.mtrack, []);
}
// C mthrowu.c:1387 draws rn2(25) for any polymorphed hero before concealment.
function movementRng() {
    assert.equal(getRngLog().length, 1);
    assert.match(getRngLog()[0], /^rn2\(25\)=\d+$/);
}
function noFeedback() { assert.doesNotMatch(message(), /cannot escape/); }

test('held fleeing monster selects the farther square but cannot move', async () => {
    const {held} = await setup();
    assert.deepEqual(candidates(held).poss, [{x:39,y:10}, {x:41,y:10}]);
    assert.equal(await m_move(held, 0), MMOVE_DONE);
    stays(held);
    assert.equal(m_at(41,10), null);
    assert.equal(message(), 'The iron golem cannot escape from you!');
    movementRng(); // The guard and feedback add no draws.
});

test('selected hero square bypasses escape refusal and leaves attack to caller', async () => {
    const {held} = await setup([[39,10]]);
    const data = candidates(held);
    assert.deepEqual(data.poss, [{x:39,y:10}]);
    assert.ok(data.info[0] & ALLOW_U);
    const hp = game.u.mh;
    assert.equal(await m_move(held, 0), MMOVE_NOTHING);
    stays(held); noFeedback();
    assert.equal(game.u.mh, hp, 'm_move leaves the attack to dochug');
    movementRng();
});

test('a different monster may move while the hero still holds the original', async () => {
    const {held} = await setup();
    remove_monster(40,10);
    Object.assign(game.level.at(39,9), {typ:ROOM, lit:1});
    place_monster(held, 39, 9);
    const other = await makemon(game.mons[PMNAMES.PM_IRON_GOLEM], 40, 10,
        NO_MINVENT | MM_NOMSG | MM_NOGRP);
    assert.ok(other && other !== held);
    Object.assign(other, {mux:39, muy:10});
    await monflee(other, 0, false, false);
    assert.deepEqual(candidates(other).poss, [{x:39,y:10}, {x:41,y:10}]);
    clearMessages(); resetRng();
    assert.equal(await m_move(other, 0), MMOVE_MOVED);
    assert.deepEqual([other.mx,other.my], [41,10]);
    assert.equal(m_at(41,10), other);
    assert.equal(game.u.ustuck, held);
    assert.deepEqual([held.mx,held.my], [39,9]);
    assert.deepEqual(other.mtrack[0], {x:40,y:10});
    noFeedback(); movementRng();
});

test('unstuck permits the same fleeing monster to move', async () => {
    const {held} = await setup();
    await unstuck(held);
    assert.equal(game.u.ustuck, null);
    assert.equal(await m_move(held, 0), MMOVE_MOVED);
    assert.deepEqual([held.mx,held.my], [41,10]);
    assert.equal(m_at(41,10), held);
    assert.equal(game.u.ustuck, null);
    noFeedback(); movementRng();
});

test('no legal destination returns before escape feedback', async () => {
    const {held} = await setup([[39,10]]);
    const scroll = mksobj(ONAMES.SCR_SCARE_MONSTER, true, false);
    await place_object(scroll, 39, 10);
    resetRng();
    assert.deepEqual(candidates(held).poss, []);
    assert.equal(await m_move(held, 0), MMOVE_NOMOVES);
    stays(held); noFeedback();
    movementRng();
});

test('a real bear trap returns before destination selection and escape feedback', async () => {
    const {held} = await setup();
    const trap = maketrap(40,10,BEAR_TRAP);
    assert.ok(trap);
    assert.equal(await mintrap(held, FORCETRAP), 1, 'Trap_Caught_Mon');
    assert.equal(held.mtrapped, 1);
    clearMessages(); resetRng();
    assert.equal(await m_move(held, 0), MMOVE_NOTHING);
    stays(held); noFeedback();
    assert.equal(held.mtrapped, 1);
    assert.equal(getRngLog().length, 1);
    assert.match(getRngLog()[0], /^rn2\(40\)=[1-9]\d*$/);
});

test('escape refusal waits for a real More acknowledgement before returning', async () => {
    const {run, held} = await setup();
    await pline('A long preceding message occupies the top line before the attempted escape.');
    let entered, release, timer, completed = false;
    const waiting = new Promise(resolve => { entered = resolve; });
    run._display.onEmptyQueue = () => {
        entered();
        return new Promise(resolve => { release = resolve; });
    };
    const pending = m_move(held, 0).then(result => { completed = true; return result; });
    try {
        await Promise.race([waiting, new Promise((_,reject) => {
            timer = setTimeout(() => reject(Error('More not reached')), 2000);
        })]);
        await setImmediate();
        assert.equal(completed, false, 'return must follow message completion');
        assert.match(game.nhDisplay.grid.slice(0,2)
            .map(row => row.map(cell => cell.ch).join('')).join('\n'), /--More--/);
        stays(held);
    } finally {
        clearTimeout(timer);
        run._display.onEmptyQueue = () => 32;
        release?.(32);
    }
    assert.equal(await pending, MMOVE_DONE);
    stays(held);
    assert.equal(message(), 'The iron golem cannot escape from you!');
    movementRng();
});
