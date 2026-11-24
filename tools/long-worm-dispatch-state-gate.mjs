// C monmove.c:1769-1850. Real makemon/tamedog producers in a constructed arena.
// These source controls are separate from the three ordinary-input C recordings.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {tamedog, dog_move} from '../js/dog.js';
import {GameMap} from '../js/game.js';
import {m_move} from '../js/monmove.js';
import {m_at, mfndpos, mon_allowflags} from '../js/mon.js';
import {get_wormno, count_wsegs} from '../js/worm.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {resetInputState} from '../js/input.js';
import {vision_reset, vision_recalc} from '../js/vision.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ROOM, STONE, COLNO, ROWNO, NO_MINVENT, MM_NOMSG, MM_NOGRP,
    MM_NOCOUNTBIRTH, MM_NOTAIL, MMOVE_MOVED, MMOVE_NOMOVES, MMOVE_DONE} from '../js/const.js';

const flags = NO_MINVENT | MM_NOMSG | MM_NOGRP | MM_NOCOUNTBIRTH;
function seed(n) { initRng(n); enableRngLog(); }
function chain(mon) {
    const result = [];
    for (let seg = game.worms.wtails[mon.wormno]; seg; seg = seg.nseg)
        result.push([seg.wx, seg.wy]);
    return result;
}
async function setup({type = P.PM_LONG_WORM, tame = true, tail = false,
                      exhaust = false, blocked = false} = {}) {
    const run = await runSegment({seed:99826, datetime:'20000110090000', moves:' ',
        nethackrc:'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage:new InMemoryStorage()});
    let acknowledgments = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(++acknowledgments <= 20); return 32;
    };
    game._preNhgetchHook = null; resetInputState();
    game.level = new GameMap();
    game.worms = {wheads:{}, wtails:{}, wgrowtime:{}};
    game.regions = []; game.timer_base = [];
    game.u.ux = 31; game.u.uy = 10; game.moves = 20;
    for (let x = 1; x < COLNO; x++) for (let y = 0; y < ROWNO; y++)
        Object.assign(game.level.at(x,y), {typ:ROOM,lit:1,waslit:1,seenv:255});
    vision_reset(); vision_recalc(0);
    seed(14);
    if (exhaust) {
        // C worm.c:96-106 and makemon.c:1404. Fill all 31 real slots;
        // the next adult is legitimately head-only, not a fabricated species/slot pair.
        for (let n = 1; n < 32; n++) {
            const other = await makemon(game.mons[P.PM_LONG_WORM], n + 1, 2, flags | MM_NOTAIL);
            assert.equal(other.wormno, n);
        }
        assert.equal(get_wormno(), 0);
    }
    const mon = await makemon(game.mons[type], 34, 10, flags | (tail ? 0 : MM_NOTAIL));
    assert.ok(mon); mon.msleeping = 0;
    if (tame) assert.equal(await tamedog(mon, null, false), true);
    else mon.mpeaceful = 1;
    assert.equal(mon.mcanmove, true);
    assert.ok(!mon.mtrapped && !mon.meating && !mon.isshk && !mon.isgd && !mon.ispriest);
    assert.equal(m_at(35,10), null, 'chosen destination is initially empty');
    // Restrict only the terrain, retaining the real monster, tail and pet state.
    for (let x = 1; x < COLNO; x++) for (let y = 0; y < ROWNO; y++)
        game.level.at(x,y).typ = STONE;
    for (const [x,y] of [[31,10],[34,10],...(blocked ? [] : [[35,10]])])
        game.level.at(x,y).typ = ROOM;
    vision_reset(); vision_recalc(0);
    const destinations = {};
    assert.equal(mfndpos(mon, destinations, mon_allowflags(mon)), blocked ? 0 : 1);
    if (!blocked) assert.deepEqual(destinations.poss[0], {x:35,y:10});
    game._toplin = 0; game._toplines = ''; game._pending_message = ''; game._msg_history = [];
    seed(14);
    return mon;
}

for (const tail of [false, true]) test(`tame adult with ${tail ? 'visible tail' : 'only hidden head'} uses ordinary worm movement`, async () => {
    const mon = await setup({tail});
    assert.ok(mon.mtame && mon.edog && mon.wormno);
    const before = chain(mon);
    assert.equal(before.length > 1, tail);
    assert.equal(game.worms.wgrowtime[mon.wormno], 0);
    const result = await m_move(mon, 0);
    assert.equal(result, MMOVE_MOVED);
    assert.deepEqual([mon.mx,mon.my], [35,10]);
    const head = game.worms.wheads[mon.wormno];
    assert.deepEqual([head.wx,head.wy], [35,10]);
    assert.deepEqual(chain(mon), [...before,[35,10]], 'old hidden head becomes body, new head is appended');
    for (const [x,y] of chain(mon)) assert.equal(m_at(x,y), mon);
    assert.equal(count_wsegs(mon), before.length);
    assert.ok(game.worms.wgrowtime[mon.wormno] > game.moves);
    assert.deepEqual(getRngLog().map(call => call.split('=')[0]),
        ['rn2(10)','rn2(1)','rnd(5)','d(2,2)'],
        'C ordinary peaceful selection precedes first worm growth');
});

test('untame peaceful adult retains the same ordinary movement and tail growth', async () => {
    const mon = await setup({tame:false});
    assert.equal(mon.mtame, 0); assert.ok(mon.wormno);
    assert.equal(await m_move(mon, 0), MMOVE_MOVED);
    assert.deepEqual(chain(mon), [[34,10],[35,10]]);
    assert.deepEqual(getRngLog().map(call => call.split('=')[0]),
        ['rn2(10)','rn2(1)','rnd(5)','d(2,2)']);
});

for (const spec of [
    {name:'tame baby long worm', type:P.PM_BABY_LONG_WORM},
    {name:'tame adult after all real worm slots are occupied', exhaust:true},
]) test(`${spec.name} still delegates to dog_move`, async () => {
    // C's guard is the allocated slot, not the monster class or species.
    // Compare the actual delegate on an identical real-producer setup.
    let mon = await setup(spec);
    assert.equal(mon.wormno || 0, 0); assert.ok(mon.mtame && mon.edog);
    const expectedResult = await dog_move(mon, 0);
    const expected = {at:[mon.mx,mon.my], hp:mon.mhp, edog:structuredClone(mon.edog), rng:getRngLog()};
    mon = await setup(spec);
    assert.equal(await m_move(mon, 0), expectedResult);
    assert.deepEqual({at:[mon.mx,mon.my], hp:mon.mhp, edog:mon.edog, rng:getRngLog()}, expected);
    assert.equal(getRngLog().some(call => /^rnd\(5\)|^d\(2,2\)/.test(call)), false);
});

test('ordinary nonspecial non-pet still uses the common movement path', async () => {
    const mon = await setup({type:P.PM_GIANT_ANT,tame:false});
    assert.equal(mon.wormno || 0, 0); assert.equal(mon.mtame, 0);
    assert.equal(await m_move(mon, 0), MMOVE_MOVED);
    assert.deepEqual([mon.mx,mon.my], [35,10]);
    assert.deepEqual(getRngLog().map(call => call.split('=')[0]), ['rn2(10)','rn2(1)']);
});

test('live-slot tame worm with no legal square takes the ordinary early return', async () => {
    const mon = await setup({blocked:true});
    const before = chain(mon), hp = mon.mhp;
    assert.equal(await m_move(mon, 0), MMOVE_NOMOVES);
    assert.deepEqual(chain(mon), before); assert.equal(mon.mhp, hp);
    assert.equal(game.worms.wgrowtime[mon.wormno], 0);
    assert.deepEqual(getRngLog().map(call => call.split('=')[0]), ['rn2(10)']);
});

test('eating still returns before the common worm dispatch guard', async () => {
    const mon = await setup(); mon.meating = 3;
    const before = chain(mon);
    assert.equal(await m_move(mon, 0), MMOVE_DONE);
    assert.equal(mon.meating, 2); assert.deepEqual(chain(mon), before);
    assert.deepEqual(getRngLog(), []);
});
