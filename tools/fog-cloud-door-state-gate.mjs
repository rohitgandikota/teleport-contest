// src/monmove.c:1550-1555. Constructed corridor, real makemon and m_move.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {obj_extract_self} from '../js/invent.js';
import {m_move} from '../js/monmove.js';
import {initRng, enableRngLog} from '../js/rng.js';
import {resetInputState} from '../js/input.js';
import {vision_recalc} from '../js/vision.js';
import {PMNAMES} from '../js/monst_data.js';
import {ROOM, STONE, DOOR, D_LOCKED, D_CLOSED, D_ISOPEN,
    COLNO, ROWNO, NO_MINVENT, MM_NOMSG, MM_NOGRP, MM_NOCOUNTBIRTH,
    MMOVE_MOVED} from '../js/const.js';

async function setup(type, mask = D_CLOSED) {
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
    game.context.mon_moving = true;
    game._toplin = 0; game._toplines = ''; game._pending_message = ''; game._msg_history = [];
    initRng(14); enableRngLog();
    return {mon, door};
}


for (const [label, type, mask, verb] of [
    ['fog cloud at a closed door', PMNAMES.PM_FOG_CLOUD, D_CLOSED, 'flows'],
    ['fog cloud at a locked door', PMNAMES.PM_FOG_CLOUD, D_LOCKED, 'flows'],
    ['yellow light at a closed door', PMNAMES.PM_YELLOW_LIGHT, D_CLOSED, 'flows'],
    ['acid blob at a closed door', PMNAMES.PM_ACID_BLOB, D_CLOSED, 'oozes'],
]) {
    await test(label, async () => {
        const {mon, door} = await setup(type, mask);
        assert.equal(mon.data, game.mons[type]);
        assert.equal(mon.minvent, null);
        assert.equal(await m_move(mon, 0), MMOVE_MOVED);
        assert.deepEqual([mon.mx, mon.my], [33, 10]);
        assert.equal(door.doormask, mask);
        assert.match(game._toplines, new RegExp(verb + ' under the door\\.'));
        assert.equal(game.level.monAt.get('33,10'), mon);
        assert.equal(game.level.monAt.has('34,10'), false);
    });
}
await test('verbose off suppresses fog feedback, preserving passage', async () => {
    const {mon, door} = await setup(PMNAMES.PM_FOG_CLOUD);
    game.flags.verbose = false;
    assert.equal(await m_move(mon, 0), MMOVE_MOVED);
    assert.deepEqual([mon.mx, mon.my], [33, 10]);
    assert.equal(door.doormask, D_CLOSED);
    assert.doesNotMatch(game._toplines, /under the door/);
});
await test('an open door emits no squeezing feedback', async () => {
    const {mon, door} = await setup(PMNAMES.PM_FOG_CLOUD, D_ISOPEN);
    assert.equal(await m_move(mon, 0), MMOVE_MOVED);
    assert.equal(door.doormask, D_ISOPEN);
    assert.doesNotMatch(game._toplines, /under the door/);
});
