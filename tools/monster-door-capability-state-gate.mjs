// C monmove.c:1765-1767 and 1509-1598. Constructed arena, real makers/traps/input.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {GameMap} from '../js/game.js';
import {makemon, is_rider} from '../js/makemon.js';
import {maketrap} from '../js/mklev.js';
import {mksobj} from '../js/mkobj.js';
import {mpickobj} from '../js/steal.js';
import {m_move} from '../js/monmove.js';
import {tamedog} from '../js/dog.js';
import {m_at, mfndpos, mon_allowflags} from '../js/mon.js';
import {nohands, verysmall, amorphous, passes_walls} from '../js/mondata.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {resetInputState} from '../js/input.js';
import {vision_reset, vision_recalc} from '../js/vision.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {ROOM, STONE, DOOR, D_LOCKED, D_CLOSED, D_ISOPEN, D_NODOOR, D_BROKEN,
    COLNO, ROWNO, POLY_TRAP, W_NONPASSWALL, NO_MINVENT, MM_NOMSG, MM_NOGRP, MM_NOCOUNTBIRTH,
    MMOVE_MOVED, MMOVE_NOMOVES, MMOVE_DONE} from '../js/const.js';

const flags = NO_MINVENT | MM_NOMSG | MM_NOGRP | MM_NOCOUNTBIRTH;
const canOpen = mon => !(nohands(mon.data) || verysmall(mon.data));
async function setup(type, {mask = D_CLOSED, key, trap = true, tame = false} = {}) {
    const run = await runSegment({seed:99812, datetime:'20000110090000', moves:' ',
        nethackrc:'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage:new InMemoryStorage()});
    game._preNhgetchHook = null; resetInputState();
    game.level = new GameMap(); game.worms = {wheads:{},wtails:{},wgrowtime:{}};
    game.regions = []; game.timer_base = [];
    game.u.ux = 31; game.u.uy = 10;
    for (let x=1;x<COLNO;x++) for (let y=0;y<ROWNO;y++)
        Object.assign(game.level.at(x,y), {typ:y===10 && x>=31 && x<=34 ? ROOM : STONE,
            lit:1,waslit:1,seenv:255,roomno:0,doormask:0,wall_info:W_NONPASSWALL});
    const poly = trap ? maketrap(33,10,POLY_TRAP) : null;
    if (trap) assert.equal(poly.ttyp, POLY_TRAP);
    const door = game.level.at(33,10); Object.assign(door,{typ:DOOR,doormask:mask,wall_info:0});
    vision_reset(); vision_recalc(0);
    const mon = await makemon(game.mons[type],34,10,flags);
    assert.ok(mon); mon.mpeaceful = mon.msleeping = 0;
    assert.ok(mon.mcanmove && !mon.mtrapped && !mon.meating);
    if (key !== undefined) await mpickobj(mon,mksobj(key,false,false));
    if (tame) assert.equal(await tamedog(mon,null,false),true);
    mon.mux = game.u.ux; mon.muy = game.u.uy;
    game.context.mon_moving = true; game.flags.monpolycontrol = trap;
    game._toplin = 0; game._toplines = ''; game._pending_message = ''; game._msg_history = [];
    initRng(14); enableRngLog();
    return {mon,door,display:run._display};
}

async function moveThroughTrap(state, target) {
    const {mon,door,display} = state;
    const oldType = mon.mnum, oldMask = door.doormask;
    const choices = {};
    assert.equal(mfndpos(mon,choices,mon_allowflags(mon)),1);
    assert.deepEqual(choices.poss[0],{x:33,y:10});
    let reached;
    const waiting = new Promise(resolve => { reached = resolve; });
    display.onEmptyQueue = () => { reached(); };
    const completion = m_move(mon,0);
    await Promise.race([waiting,completion.then(() => { throw Error('No controlled trap prompt'); })]);
    assert.ok(display.isWaitingForInput);
    assert.equal(mon.mnum,oldType);
    assert.deepEqual([mon.mx,mon.my],[33,10]);
    assert.equal(door.doormask,oldMask,'arrival happened, but trap choice and door action are pending');
    assert.match(game.nhDisplay.grid[0].map(c=>c.ch).join(''),/Change .* into what\?/);
    let acknowledgments = 0;
    display.onEmptyQueue = () => {
        assert.ok(++acknowledgments <= 4,'bounded More acknowledgments');
        assert.ok(game.nhDisplay.grid.some(row => row.map(cell=>cell.ch).join('').includes('--More--')),
            'only acknowledge a real More prompt');
        return 32;
    };
    for (const key of target + '\r') display.pushKey(key.charCodeAt(0));
    assert.equal(await completion,MMOVE_MOVED);
    assert.equal(m_at(33,10),mon);
    assert.deepEqual([mon.mx,mon.my],[33,10]);
}

const changes = [
    {name:'gaining hands cannot retroactively open the door', from:P.PM_BROWN_PUDDING,
        to:P.PM_ORC_CAPTAIN, answer:'orc captain', oldOpen:false, newOpen:true, result:D_BROKEN, message:/smashes down a door/},
    {name:'losing hands retains the opening capability', from:P.PM_ORC,
        to:P.PM_GIANT_ANT, answer:'giant ant', oldOpen:true, newOpen:false, result:D_ISOPEN, message:/opens a door/},
    {name:'pet dispatch retains opening across its arrival trap', from:P.PM_ORC, tame:true,
        to:P.PM_GIANT_ANT, answer:'giant ant', oldOpen:true, newOpen:false, result:D_ISOPEN, message:/opens a door/},
    {name:'a previously unusable key does not gain unlocking capability', from:P.PM_BROWN_PUDDING,
        to:P.PM_ORC_CAPTAIN, answer:'orc captain', key:O.SKELETON_KEY, mask:D_LOCKED,
        oldOpen:false, newOpen:true, smash:true, message:/smashes down a door/},
    ...[O.CREDIT_CARD,O.SKELETON_KEY,O.LOCK_PICK].map(key => ({
        name:`retains unlocking with real tool ${key} after losing hands`, from:P.PM_ORC,
        to:P.PM_GIANT_ANT, answer:'giant ant', key, mask:D_LOCKED,
        oldOpen:true, newOpen:false, result:D_ISOPEN, message:/unlocks and opens a door/})),
    {name:'current amorphous form takes priority over retained opening', from:P.PM_ORC,
        to:P.PM_FOG_CLOUD, answer:'fog cloud', oldOpen:true, newOpen:false,
        result:D_CLOSED, message:/under the door/, newAmorphous:true},
    {name:'current wall-passing form bypasses door handling', from:P.PM_ORC,
        to:P.PM_XORN, answer:'xorn', oldOpen:true, newOpen:true,
        result:D_CLOSED, newPassesWalls:true},
    {name:'losing wall-passing uses the new body and retained opening', from:P.PM_XORN,
        to:P.PM_GIANT_ANT, answer:'giant ant', oldOpen:true, newOpen:false,
        result:D_ISOPEN, message:/opens a door/, oldPassesWalls:true},
];
for (const spec of changes) test(spec.name, async () => {
    const state = await setup(spec.from,spec);
    assert.equal(canOpen(state.mon),spec.oldOpen);
    assert.equal(!!state.mon.mtame,!!spec.tame);
    assert.equal(passes_walls(state.mon.data),!!spec.oldPassesWalls);
    if (spec.key !== undefined) assert.ok(state.mon.minvent.some(obj=>obj.otyp===spec.key));
    await moveThroughTrap(state,spec.answer);
    assert.equal(state.mon.mnum,spec.to);
    assert.equal(canOpen(state.mon),spec.newOpen);
    assert.equal(amorphous(state.mon.data),!!spec.newAmorphous);
    assert.equal(passes_walls(state.mon.data),!!spec.newPassesWalls);
    if (spec.smash) assert.ok([D_NODOOR,D_BROKEN].includes(state.door.doormask));
    else assert.equal(state.door.doormask,spec.result);
    if (spec.message) assert.match(game._toplines,spec.message);
    else assert.doesNotMatch(game._toplines,/opens a door|smashes down a door/);
    assert.ok(getRngLog().some(call=>/^rn2\(1\d\d\)=/.test(call)), 'real trap resistance roll');
    if (spec.mask === D_LOCKED)
        assert.equal(getRngLog().filter(call=>/^rn2\(2\)=/.test(call)).length, spec.smash ? 1 : 0,
            'only the locked-door smashing arm spends rn2(2)');
});

for (const type of [P.PM_DEATH,P.PM_FAMINE,P.PM_PESTILENCE,P.PM_WIZARD_OF_YENDOR])
    test(`retained keyless unlock predicate for ${type}`, async () => {
        const {mon,door} = await setup(type,{mask:D_LOCKED,trap:false});
        assert.equal(mon.minvent,null); assert.ok(is_rider(mon.data) || mon.iswiz);
        assert.equal(await m_move(mon,0),MMOVE_MOVED);
        assert.equal(door.doormask,D_ISOPEN);
        assert.match(game._toplines,/unlocks and opens a door/);
        assert.equal(getRngLog().some(call=>/^rn2\(2\)=/.test(call)),false);
    });

test('tiny hands and a key do not satisfy can_open or can_unlock', async () => {
    const {mon,door} = await setup(P.PM_LEPRECHAUN,{mask:D_LOCKED,key:O.SKELETON_KEY,trap:false});
    assert.equal(nohands(mon.data),false); assert.equal(verysmall(mon.data),true);
    assert.equal(await m_move(mon,0),MMOVE_NOMOVES);
    assert.deepEqual([mon.mx,mon.my],[34,10]); assert.equal(door.doormask,D_LOCKED);
});

test('amorphous key carrier without hands still passes under a locked door', async () => {
    const {mon,door} = await setup(P.PM_BROWN_PUDDING,{mask:D_LOCKED,key:O.CREDIT_CARD,trap:false});
    assert.equal(canOpen(mon),false); assert.ok(mon.minvent.some(obj=>obj.otyp===O.CREDIT_CARD));
    assert.equal(await m_move(mon,0),MMOVE_MOVED);
    assert.equal(door.doormask,D_LOCKED); assert.match(game._toplines,/oozes under the door/);
    assert.deepEqual(getRngLog(),[]);
});

test('earlier eating return leaves trap, door, form and RNG untouched', async () => {
    const {mon,door} = await setup(P.PM_ORC);
    mon.meating = 3;
    assert.equal(await m_move(mon,0),MMOVE_DONE);
    assert.equal(mon.meating,2); assert.equal(mon.mnum,P.PM_ORC);
    assert.deepEqual([mon.mx,mon.my],[34,10]); assert.equal(door.doormask,D_CLOSED);
    assert.deepEqual(getRngLog(),[]);
});
