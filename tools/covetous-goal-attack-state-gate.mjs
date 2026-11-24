// C monmove.c:1778-1801. Constructed controls using real monster/object producers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {makemon, place_monster, remove_monster} from '../js/makemon.js';
import {mksobj, place_object} from '../js/mkobj.js';
import {obj_extract_self} from '../js/invent.js';
import {m_at} from '../js/mon.js';
import {tactics} from '../js/wizard.js';
import {m_move} from '../js/monmove.js';
import {mattackm} from '../js/mhitm.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {resetInputState} from '../js/input.js';
import {vision_recalc} from '../js/vision.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {ROOM, COLNO, ROWNO, NO_MINVENT, MM_NOMSG, MM_NOGRP, MM_NOCOUNTBIRTH,
    MMOVE_MOVED, MMOVE_DIED, MMOVE_DONE, M_ATTK_HIT, M_ATTK_AGR_DIED, M_ATTK_DEF_DIED} from '../js/const.js';

function seed(n) { initRng(n); enableRngLog(); }
function relocate(mon, x, y) {
    remove_monster(mon.mx, mon.my); place_monster(mon, x, y);
}
async function setup({diagonal = true, targetType = PMNAMES.PM_ENERGY_VORTEX,
    attackerType = PMNAMES.PM_WIZARD_OF_YENDOR, fresh = false,
    goalObject = ONAMES.AMULET_OF_YENDOR} = {}) {
    const run = await runSegment({seed:99812, datetime:'20000110090000', moves:' ',
        nethackrc:'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage:new InMemoryStorage()});
    let acknowledgments = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(++acknowledgments <= 50, 'bounded message acknowledgments'); return 32;
    };
    game._preNhgetchHook = null; resetInputState();
    game.level.monsters = []; game.level.monAt.clear();
    for (const obj of [...game.level.objects]) await obj_extract_self(obj);
    game.level.traps = []; game.regions = []; game.timer_base = [];
    game.u.ux = 31; game.u.uy = 10;
    for (let x = 1; x < COLNO; x++) for (let y = 0; y < ROWNO; y++)
        Object.assign(game.level.at(x, y), {typ:ROOM, lit:1, waslit:1, seenv:255, roomno:0});
    vision_recalc(0);
    const flags = NO_MINVENT | MM_NOMSG | MM_NOGRP | MM_NOCOUNTBIRTH;
    const attacker = await makemon(game.mons[attackerType], 34, 10, flags);
    const target = await makemon(game.mons[targetType], 35, diagonal ? 11 : 10, flags);
    assert.ok(attacker && target);
    attacker.msleeping = target.msleeping = 0;
    attacker.mpeaceful = target.mpeaceful = 0;
    if (!fresh) {
        const amulet = mksobj(goalObject, true, false);
        await place_object(amulet, target.mx, target.my);
        await tactics(attacker);
        relocate(attacker, 34, 10);
        if (attackerType !== PMNAMES.PM_ORC_CAPTAIN)
            assert.deepEqual(attacker.mgoal, {x:target.mx, y:target.my});
    }
    game._toplin = 0; game._toplines = ''; game._pending_message = ''; game._msg_history = [];
    game.bhitpos = {x:1, y:1}; game.notonhead = true;
    attacker.mlstmv = -1; seed(14);
    return {run, attacker, target};
}
const state = (attacker, target) => ({attackerHp:attacker.mhp, targetHp:target.mhp,
    attackerAlive:m_at(attacker.mx, attacker.my) === attacker,
    targetAlive:m_at(target.mx, target.my) === target, mlstmv:attacker.mlstmv,
    rng:getRngLog(), bhitpos:{...game.bhitpos}, notonhead:game.notonhead});

for (const spec of [
    {name:'orthogonal target', diagonal:false},
    {name:'diagonal target, C 5.0 distance at most two'},
    {name:'defender death still returns moved', attackerType:PMNAMES.PM_ARCH_LICH,
        goalObject:ONAMES.SPE_BOOK_OF_THE_DEAD, targetType:PMNAMES.PM_GIANT_ANT, targetHp:1},
    {name:'passive attacker death returns died', attackerHp:1},
    {name:'attack miss still consumes the movement opportunity', attackerLevel:-20},
]) test(spec.name, async () => {
    const prepare = async () => {
        const s = await setup(spec);
        if (spec.targetHp !== undefined) s.target.mhp = spec.targetHp;
        if (spec.attackerHp !== undefined) s.attacker.mhp = spec.attackerHp;
        if (spec.attackerLevel !== undefined) s.attacker.m_lev = spec.attackerLevel;
        return s;
    };
    let {attacker, target} = await prepare();
    game.bhitpos = {x:target.mx, y:target.my}; game.notonhead = false;
    const attackResult = await mattackm(attacker, target);
    const expected = state(attacker, target);
    if (spec.targetHp === 1) assert.ok(attackResult & M_ATTK_DEF_DIED);
    if (spec.attackerHp === 1) assert.ok(attackResult & M_ATTK_AGR_DIED);
    if (spec.attackerLevel === -20) assert.equal(attackResult & M_ATTK_HIT, 0);
    ({attacker, target} = await prepare());
    const result = await m_move(attacker, 0);
    assert.equal(result, attackResult & M_ATTK_AGR_DIED ? MMOVE_DIED : MMOVE_MOVED);
    assert.deepEqual(state(attacker, target), expected,
        'caller preserves the real attack, passive retaliation, targeting fields and complete RNG');
});

for (const variant of ['distant', 'empty', 'self', 'invalid', 'fresh', 'noncovetous', 'eating'])
    test(`${variant} control does not take the covetous attack arm`, async () => {
        const {attacker, target} = await setup({fresh:variant === 'fresh',
            attackerType:variant === 'noncovetous' ? PMNAMES.PM_ORC_CAPTAIN : PMNAMES.PM_WIZARD_OF_YENDOR});
        if (variant === 'distant') relocate(attacker, 37, 14);
        if (variant === 'empty') relocate(target, 45, 15);
        if (variant === 'self') attacker.mgoal = {x:attacker.mx, y:attacker.my};
        if (variant === 'invalid') attacker.mgoal = {x:0, y:0};
        if (variant === 'noncovetous') attacker.mgoal = {x:target.mx, y:target.my};
        if (variant === 'eating') attacker.meating = 2;
        const hp = target.mhp;
        const result = await m_move(attacker, 0);
        assert.equal(target.mhp, hp);
        assert.equal(attacker.mlstmv, -1, 'no out-of-sequence monster attack');
        assert.equal(getRngLog().some(call => /^rnd\(20\)/.test(call)), false);
        if (variant === 'eating') {
            assert.equal(attacker.meating, 1);
            assert.equal(result, MMOVE_DONE);
            assert.deepEqual(getRngLog(), []);
        }
    });
