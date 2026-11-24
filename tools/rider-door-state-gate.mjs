// C monmove.c:1766-1767 and 1554. Constructed map, real monsters and keys.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {mksobj} from '../js/mkobj.js';
import {obj_extract_self} from '../js/invent.js';
import {mpickobj} from '../js/steal.js';
import {m_move} from '../js/monmove.js';
import {mon_allowflags} from '../js/mon.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {resetInputState} from '../js/input.js';
import {vision_recalc} from '../js/vision.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {ROOM, STONE, DOOR, D_LOCKED, D_CLOSED, D_ISOPEN, D_NODOOR, D_BROKEN,
    COLNO, ROWNO, NO_MINVENT, MM_NOMSG, MM_NOGRP, MM_NOCOUNTBIRTH,
    MMOVE_MOVED, MMOVE_NOMOVES, UNLOCKDOOR} from '../js/const.js';

async function setup(type, mask = D_LOCKED, key = false) {
    const run = await runSegment({seed:99812, datetime:'20000110090000', moves:' ',
        nethackrc:'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage:new InMemoryStorage()});
    let acknowledgments = 0;
    run._display.onEmptyQueue = () => { assert.ok(++acknowledgments <= 10); return 32; };
    game._preNhgetchHook = null; resetInputState();
    game.level.monsters = []; game.level.monAt.clear();
    for (const obj of [...game.level.objects]) await obj_extract_self(obj);
    game.level.traps = []; game.regions = []; game.timer_base = [];
    game.u.ux = 31; game.u.uy = 10;
    for (let x = 1; x < COLNO; x++) for (let y = 0; y < ROWNO; y++)
        Object.assign(game.level.at(x, y), {typ:y === 10 && x >= 31 && x <= 34 ? ROOM : STONE,
            lit:1, waslit:1, seenv:255, roomno:0, doormask:0});
    const door = game.level.at(33, 10);
    Object.assign(door, {typ:DOOR, doormask:mask});
    vision_recalc(0);
    const mon = await makemon(game.mons[type], 34, 10,
        NO_MINVENT | MM_NOMSG | MM_NOGRP | MM_NOCOUNTBIRTH);
    assert.ok(mon);
    mon.mpeaceful = mon.msleeping = 0;
    mon.mux = game.u.ux; mon.muy = game.u.uy;
    if (key) await mpickobj(mon, mksobj(ONAMES.SKELETON_KEY, true, false));
    game.context.mon_moving = true;
    game._toplin = 0; game._toplines = ''; game._pending_message = ''; game._msg_history = [];
    initRng(14); enableRngLog();
    return {mon, door};
}

for (const type of [PMNAMES.PM_DEATH, PMNAMES.PM_FAMINE, PMNAMES.PM_PESTILENCE])
    test(`Rider ${type} unlocks without a key or a smashing draw`, async () => {
        const {mon, door} = await setup(type);
        assert.equal(mon.minvent, null);
        assert.ok(mon_allowflags(mon) & UNLOCKDOOR);
        assert.equal(await m_move(mon, 0), MMOVE_MOVED);
        assert.deepEqual([mon.mx, mon.my], [33, 10]);
        assert.equal(door.doormask, D_ISOPEN);
        assert.match(game._toplines, /unlocks and opens a door/);
        assert.equal(getRngLog().some(s => /^rn2\(2\)=/.test(s)), false);
    });

test('ordinary keyless humanoid is still blocked by a locked door', async () => {
    const {mon, door} = await setup(PMNAMES.PM_ORC);
    assert.equal(mon_allowflags(mon) & UNLOCKDOOR, 0);
    assert.equal(await m_move(mon, 0), MMOVE_NOMOVES);
    assert.equal(door.doormask, D_LOCKED);
    assert.deepEqual([mon.mx, mon.my], [34, 10]);
});

test('a real carried skeleton key keeps the existing humanoid unlocking path', async () => {
    const {mon, door} = await setup(PMNAMES.PM_ORC, D_LOCKED, true);
    assert.equal(await m_move(mon, 0), MMOVE_MOVED);
    assert.equal(door.doormask, D_ISOPEN);
    assert.match(game._toplines, /unlocks and opens a door/);
});

test('a giant still smashes a locked door rather than unlocking it', async () => {
    const {mon, door} = await setup(PMNAMES.PM_HILL_GIANT);
    assert.equal(await m_move(mon, 0), MMOVE_MOVED);
    assert.ok([D_NODOOR, D_BROKEN].includes(door.doormask));
    assert.match(game._toplines, /smashes down a door/);
    assert.equal(getRngLog().filter(s => /^rn2\(2\)=/.test(s)).length, 1);
});

test('an unlocked closed door keeps ordinary keyless opening behavior', async () => {
    const {mon, door} = await setup(PMNAMES.PM_ORC, D_CLOSED);
    assert.equal(await m_move(mon, 0), MMOVE_MOVED);
    assert.equal(door.doormask, D_ISOPEN);
    assert.match(game._toplines, /opens a door/);
});
