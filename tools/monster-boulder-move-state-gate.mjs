// C monmove.c:133-173, 2039-2047. Constructed maps, real monsters and floor objects.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {mksobj, place_object} from '../js/mkobj.js';
import {obj_extract_self} from '../js/invent.js';
import {m_move, m_can_break_boulder} from '../js/monmove.js';
import {m_at, mon_allowflags} from '../js/mon.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {resetInputState} from '../js/input.js';
import {vision_recalc} from '../js/vision.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {ROOM, STONE, COLNO, ROWNO, NO_MINVENT, MM_NOMSG, MM_NOGRP,
    MM_NOCOUNTBIRTH, MMOVE_MOVED, MMOVE_DONE, MMOVE_NOMOVES, ALLOW_ROCK} from '../js/const.js';

async function setup(type, cooldown = 0, withBoulder = true) {
    const run = await runSegment({seed:99812, datetime:'20000110090000', moves:' ',
        nethackrc:'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage:new InMemoryStorage()});
    let acknowledgments = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(++acknowledgments <= 12, 'bounded real message acknowledgments');
        return 32;
    };
    game._preNhgetchHook = null;
    resetInputState();
    game.level.monsters = []; game.level.monAt.clear();
    for (const obj of [...game.level.objects]) await obj_extract_self(obj);
    game.level.traps = []; game.regions = []; game.timer_base = [];
    game.u.ux = 31; game.u.uy = 10;
    for (let x = 1; x < COLNO; x++) for (let y = 0; y < ROWNO; y++)
        Object.assign(game.level.at(x, y), {typ:y === 10 && x >= 31 && x <= 34 ? ROOM : STONE,
            lit:1, waslit:1, seenv:255, roomno:0, doormask:0});
    vision_recalc(0);
    const mon = await makemon(game.mons[type], 34, 10,
        NO_MINVENT | MM_NOMSG | MM_NOGRP | MM_NOCOUNTBIRTH);
    assert.ok(mon);
    mon.mpeaceful = mon.msleeping = 0;
    mon.mspec_used = cooldown;
    mon.mux = game.u.ux; mon.muy = game.u.uy;
    let boulder;
    if (withBoulder) {
        boulder = mksobj(ONAMES.BOULDER, true, false);
        await place_object(boulder, 33, 10);
    }
    game.context.mon_moving = true;
    game._toplin = 0; game._toplines = ''; game._pending_message = ''; game._msg_history = [];
    initRng(14); enableRngLog();
    return {mon, boulder};
}

for (const cooldown of [0, 19]) test(`Rider breaks before moving even with cooldown ${cooldown}`, async () => {
    const {mon, boulder} = await setup(PMNAMES.PM_DEATH, cooldown);
    const id = boulder.o_id;
    assert.equal(m_can_break_boulder(mon), true);
    assert.ok(mon_allowflags(mon) & ALLOW_ROCK);
    assert.equal(await m_move(mon, 0), MMOVE_DONE);
    assert.deepEqual([mon.mx, mon.my], [34, 10]);
    assert.equal(m_at(34, 10), mon);
    assert.equal(m_at(33, 10), null);
    assert.equal(boulder.o_id, id);
    assert.equal(boulder.otyp, ONAMES.ROCK);
    assert.equal(mon.mspec_used, cooldown);
    const draws = getRngLog();
    assert.equal(draws.filter(s => /^rn2\(60\)=/.test(s)).length, 1);
    assert.equal(draws.some(s => /^rn2\(20\)=/.test(s)), false);
    assert.match(game._toplines, /boulder falls apart/);
});

test('a ready non-Rider leader consumes cooldown before fracturing, without moving', async () => {
    const {mon, boulder} = await setup(PMNAMES.PM_LORD_CARNARVON);
    assert.equal(m_can_break_boulder(mon), true);
    assert.equal(await m_move(mon, 0), MMOVE_DONE);
    assert.deepEqual([mon.mx, mon.my], [34, 10]);
    assert.equal(boulder.otyp, ONAMES.ROCK);
    const draws = getRngLog();
    const cooldownDraw = draws.findIndex(s => /^rn2\(20\)=/.test(s));
    const fractureDraw = draws.findIndex(s => /^rn2\(60\)=/.test(s));
    assert.ok(cooldownDraw >= 0 && fractureDraw > cooldownDraw);
    assert.equal(mon.mspec_used, Number(draws[cooldownDraw].split('=')[1]) + 10);
    assert.match(game._msg_history.join('\n') + game._toplines, /mutters an incantation/);
});

for (const type of [PMNAMES.PM_LORD_CARNARVON, PMNAMES.PM_ORC])
    test(`${type === PMNAMES.PM_ORC ? 'ordinary orc' : 'cooling-down leader'} cannot enter the boulder square`, async () => {
        const {mon, boulder} = await setup(type, 9);
        assert.equal(m_can_break_boulder(mon), false);
        assert.equal(mon_allowflags(mon) & ALLOW_ROCK, 0);
        assert.equal(await m_move(mon, 0), MMOVE_NOMOVES);
        assert.deepEqual([mon.mx, mon.my], [34, 10]);
        assert.equal(boulder.otyp, ONAMES.BOULDER);
        assert.equal(mon.mspec_used, 9);
        assert.equal(getRngLog().some(s => /^rn2\((20|60)\)=/.test(s)), false);
    });

test('rock-throwing giant can enter without acquiring the special breaking ability', async () => {
    const {mon, boulder} = await setup(PMNAMES.PM_HILL_GIANT);
    assert.ok(mon_allowflags(mon) & ALLOW_ROCK);
    assert.equal(m_can_break_boulder(mon), false);
    await m_move(mon, 0);
    assert.deepEqual([mon.mx, mon.my], [33, 10]);
    assert.equal(boulder.otyp, ONAMES.BOULDER);
    assert.equal(getRngLog().some(s => /^rn2\(60\)=/.test(s)), false);
});

test('Rider moves normally when the chosen square contains no boulder', async () => {
    const {mon} = await setup(PMNAMES.PM_DEATH, 0, false);
    assert.equal(await m_move(mon, 0), MMOVE_MOVED);
    assert.deepEqual([mon.mx, mon.my], [33, 10]);
    assert.equal(getRngLog().some(s => /^rn2\(60\)=/.test(s)), false);
});
