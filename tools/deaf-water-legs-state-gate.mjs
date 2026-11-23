// Constructed source controls with real property, injury, form and mount producers.
// These controls are not native coverage. Ordinary inputs have a separate gate.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {set_uasmon} from '../js/polyself.js';
import {set_uinwater, swim_move_danger} from '../js/hack.js';
import {boulder_hits_pool, set_wounded_legs, heal_legs} from '../js/do.js';
import {make_deaf, make_confused, make_stoned, incr_itimeout, peffects} from '../js/potion.js';
import {nh_timeout} from '../js/timeout.js';
import {wiz_intrinsic} from '../js/wizcmds.js';
import {makemon} from '../js/makemon.js';
import {tamedog} from '../js/dog.js';
import {put_saddle_on_mon, mount_steed, dismount_steed} from '../js/steed.js';
import {mksobj} from '../js/mkobj.js';
import {obj_extract_self} from '../js/invent.js';
import {pline} from '../js/display.js';
import {pushKeys, resetInputState} from '../js/input.js';
import {Deaf, Underwater, Flying, Levitation, Wounded_legs} from '../js/youprop.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {ROOM, POOL, WATER, FROMOUTSIDE, A_DEX, LEFT_SIDE, RIGHT_SIDE, BOTH_SIDES,
    OBJ_DELETED, NO_MINVENT, MM_NOGRP, MM_NOWAIT, MM_NOMSG, DISMOUNT_GENERIC,
    KILLED_BY, IN_SIGHT, COULD_SEE} from '../js/const.js';

const x = 31, y = 10;
function clearMessages() {
    game._toplines = ''; game._msg_history = []; game._toplin = 0;
    game._pending_message = ''; game._win_stop = false;
    game.iflags.last_msg = 0;
}
const messages = () => [...game._msg_history, game._toplines].join('\n');
function seed(value = 2) { initRng(value); enableRngLog(); }
function form(id) { game.u.umonnum = id; set_uasmon(); }
async function setup(id, extra = '') {
    const run = await runSegment({seed:99812, datetime:'20000110090000', moves:' ',
        storage:new InMemoryStorage(),
        nethackrc:'OPTIONS=name:Desired,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n' + extra});
    let reads = 0;
    run._display.onEmptyQueue = () => {
        if (++reads > 30) throw Error('unexpected repeated prompt');
        return 32;
    };
    game._preNhgetchHook = null;
    resetInputState();
    game.level.monsters = []; game.level.monAt.clear();
    for (const obj of [...game.level.objects]) await obj_extract_self(obj);
    game.level.traps = []; game.regions = []; game.timer_base = [];
    Object.assign(game.u, {ux:x, uy:y, dx:0, dy:0, utrap:0, uswallow:false,
        ustuck:null, usteed:null, usleep:0, mtimedone:0, usptime:0});
    game.multi = 0; game.vision_full_recalc = 0;
    game.context.nopick = false;
    for (let xx = x - 3; xx <= x + 3; xx++) for (let yy = y - 3; yy <= y + 3; yy++) {
        Object.assign(game.level.at(xx, yy), {typ:ROOM, lit:1, waslit:1, seenv:255, roomno:0});
        game.viz_array[yy][xx] = IN_SIGHT | COULD_SEE;
    }
    if (id !== undefined) form(id);
    clearMessages(); seed();
    return run;
}
async function submerge(terrain = WATER, id = PMNAMES.PM_WATER_ELEMENTAL) {
    form(id);
    game.level.at(x, y).typ = terrain;
    await set_uinwater(1);
    assert.equal(Underwater(), true);
    assert.equal(Object.hasOwn(game.u.uprops || {}, 'UNDERWATER'), false);
    clearMessages(); seed();
}
function healed() {
    assert.equal(Wounded_legs(), false);
    assert.equal(game.u.intrinsic.HWounded_legs || 0, 0);
    assert.equal(game.u.EWounded_legs || 0, 0);
    assert.equal(game.u.atemp.a[A_DEX], 0);
}
async function mount() {
    const pony = await makemon(game.mons[PMNAMES.PM_PONY], x + 1, y,
        NO_MINVENT | MM_NOGRP | MM_NOWAIT | MM_NOMSG);
    assert.ok(pony && await tamedog(pony, null, false));
    put_saddle_on_mon(mksobj(ONAMES.SADDLE, false, false), pony);
    assert.equal(await mount_steed(pony, true), true);
    assert.equal(game.u.usteed, pony);
    clearMessages(); seed();
}

for (const conduct of [false, true]) {
    test(`timed hearing expiry preserves startup deaf conduct=${conduct}`, async () => {
        await setup(undefined, conduct ? 'OPTIONS=deaf\n' : '');
        await make_deaf(1, false);
        assert.equal(Deaf(), true);
        clearMessages(); seed();
        await nh_timeout();
        assert.equal(game.u.intrinsic.HDeaf || 0, 0);
        assert.equal(Deaf(), conduct);
        assert.match(messages(), conduct ? /unable to hear anything/ : /can hear again/);
        assert.deepEqual(getRngLog(), []);
    });
}
for (const [from, to] of [[POOL, WATER], [WATER, POOL], [POOL, POOL]]) {
    test(`submerged movement ${from} to ${to} preserves the no-danger return`, async () => {
        await setup(); await submerge(from);
        game.level.at(x + 1, y).typ = to;
        assert.equal(await swim_move_danger(x + 1, y), false);
        assert.equal(messages(), '');
        assert.deepEqual(getRngLog(), []);
    });
}
for (const control of ['ordinary', 'm-prefix', 'confused']) {
    test(`dry water-wall entry, ${control} control`, async () => {
        await setup(); game.level.at(x + 1, y).typ = WATER;
        if (control === 'm-prefix') game.context.nopick = true;
        if (control === 'confused') await make_confused(10, false);
        assert.equal(await swim_move_danger(x + 1, y), control === 'ordinary');
        if (control === 'ordinary') assert.match(messages(), /You avoid stepping into the wall of water/);
        else assert.equal(messages(), '');
        assert.deepEqual(getRngLog(), []);
    });
}
for (const fills of [true, false]) {
    test(`boulder ${fills ? 'fills' : 'sinks in'} water wall with blocked natural flight`, async () => {
        await setup(); await submerge(WATER, PMNAMES.PM_AIR_ELEMENTAL);
        const obj = mksobj(ONAMES.BOULDER, false, false);
        seed(fills ? 2 : 1);
        assert.equal(await boulder_hits_pool(obj, x, y, false), true);
        assert.equal(obj.where, OBJ_DELETED);
        assert.equal(Underwater(), !fills);
        assert.equal(Flying(), fills);
        assert.equal(!!(game.u.blocked.FLYING & FROMOUTSIDE), !fills);
        assert.equal(game.level.at(x, y).typ, fills ? ROOM : WATER);
        assert.deepEqual(getRngLog(), [`rn2(10)=${fills ? 3 : 5}`]);
        if (fills) assert.match(messages(), /You start flying\.[\s\S]*You find yourself on dry land again!/);
        else assert.doesNotMatch(messages(), /start flying|dry land/);
    });
}
test('boulder fill releases potion levitation through the existing terrain producer', async () => {
    await setup(PMNAMES.PM_WATER_ELEMENTAL);
    await peffects(mksobj(ONAMES.POT_LEVITATION, false, false));
    assert.equal(Levitation(), true);
    await submerge(WATER);
    assert.equal(Levitation(), false);
    const obj = mksobj(ONAMES.BOULDER, false, false);
    seed();
    assert.equal(await boulder_hits_pool(obj, x, y, false), true);
    assert.equal(Levitation(), true);
    assert.equal(game.u.blocked.LEVITATION & FROMOUTSIDE, 0);
    assert.equal(Underwater(), false);
    assert.deepEqual(getRngLog(), ['rn2(10)=3']);
});
test('ordinary pool fill keeps the existing dry-land feedback without flight', async () => {
    await setup(); await submerge(POOL);
    const obj = mksobj(ONAMES.BOULDER, false, false);
    seed();
    assert.equal(await boulder_hits_pool(obj, x, y, false), true);
    assert.equal(Underwater(), false);
    assert.equal(Flying(), false);
    assert.match(messages(), /find yourself on dry land again/);
    assert.doesNotMatch(messages(), /start flying/);
    assert.deepEqual(getRngLog(), ['rn2(10)=3']);
});
test('boulder consumption waits for terrain-transition feedback to be acknowledged', async () => {
    const run = await setup(); await submerge(WATER, PMNAMES.PM_AIR_ELEMENTAL);
    const obj = mksobj(ONAMES.BOULDER, false, false);
    await pline('A pending message which must be acknowledged before the terrain feedback.');
    let release, notify, held = false, released = false;
    const entered = new Promise(resolve => { notify = resolve; });
    run._display.onEmptyQueue = () => {
        if (held) return 32;
        held = true;
        return new Promise(resolve => { release = resolve; notify(); });
    };
    seed();
    const operation = boulder_hits_pool(obj, x, y, false);
    try {
        assert.equal(await Promise.race([entered.then(() => 'prompt'), operation.then(() => 'complete')]), 'prompt');
        assert.equal(Flying(), true, 'flight is restored before its pending feedback');
        assert.equal(Underwater(), false);
        assert.notEqual(obj.where, OBJ_DELETED, 'consumption follows the awaited transition');
    } finally {
        if (release) { release(32); released = true; }
        await operation;
    }
    assert.equal(released, true);
    assert.equal(obj.where, OBJ_DELETED);
    assert.deepEqual(getRngLog(), ['rn2(10)=3']);
});
test('wizard UI reads and extends H-only wounded legs without side bits or Dexterity loss', async () => {
    await setup(); pushKeys('3m\r'); await wiz_intrinsic();
    assert.equal(game.u.intrinsic.HWounded_legs, 3);
    assert.equal(Wounded_legs(), true);
    assert.equal(game.u.EWounded_legs || 0, 0);
    assert.equal(game.u.atemp.a[A_DEX], 0);
    assert.equal(game.u.uprops?.WOUNDED_LEGS || 0, 0);
    assert.equal(game.u.wiz_intrinsic_timeouts?.WOUNDED_LEGS || 0, 0);
    clearMessages(); pushKeys('7m\r'); await wiz_intrinsic();
    assert.equal(game.u.intrinsic.HWounded_legs, 10);
    assert.match(messages(), /Timeout for wounded legs increased by 7/);
    assert.deepEqual(getRngLog(), []);
});
test('C generic timer producer creates an H-only injury whose expiry does not heal', async () => {
    await setup(); incr_itimeout('HWounded_legs', 1);
    assert.equal(Wounded_legs(), true);
    assert.equal(game.u.EWounded_legs || 0, 0);
    await nh_timeout();
    healed();
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), []);
});
test('real side-bit injuries lose Dexterity once, keep the longest time and heal at expiry', async () => {
    await setup();
    await set_wounded_legs(LEFT_SIDE, 2);
    await set_wounded_legs(RIGHT_SIDE, 1);
    assert.equal(game.u.atemp.a[A_DEX], -1);
    assert.equal(game.u.intrinsic.HWounded_legs, 2);
    assert.equal(game.u.EWounded_legs, BOTH_SIDES);
    await nh_timeout();
    assert.equal(game.u.intrinsic.HWounded_legs, 1);
    clearMessages(); await nh_timeout();
    healed();
    assert.match(messages(), /Your legs feel better\./);
    assert.deepEqual(getRngLog(), []);
});
for (const dog of [false, true]) for (const both of [false, true]) {
    test(`real ${dog ? 'dog' : 'human'} ${both ? 'two-leg' : 'one-leg'} injury uses the correct healing name`, async () => {
        await setup(dog ? PMNAMES.PM_LITTLE_DOG : undefined);
        await set_wounded_legs(LEFT_SIDE, 10);
        if (both) await set_wounded_legs(RIGHT_SIDE, 12);
        clearMessages(); seed();
        assert.equal(await heal_legs(0), undefined);
        healed();
        const expected = `Your ${dog ? 'rear ' : ''}${both ? 'legs feel' : 'leg feels'} better.`;
        assert.equal(messages(), expected);
        assert.deepEqual(getRngLog(), []);
    });
}
test('real mounted injury heals without hero limb feedback', async () => {
    await setup(); await mount();
    await set_wounded_legs(BOTH_SIDES, 10);
    clearMessages(); seed(); await heal_legs(0);
    healed(); assert.ok(game.u.usteed);
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), []);
});
test('dismount heals the steed injury before releasing the mount without a hero healing message', async () => {
    await setup(); await mount();
    await set_wounded_legs(BOTH_SIDES, 10);
    clearMessages(); seed(); await dismount_steed(DISMOUNT_GENERIC);
    healed(); assert.equal(game.u.usteed, null);
    assert.doesNotMatch(messages(), /leg.*feel.*better/);
});
for (const mounted of [false, true]) {
    test(`real petrification countdown ${mounted ? 'preserves the steed injury' : 'heals without extra limb feedback'}`, async () => {
        await setup(); if (mounted) await mount();
        await set_wounded_legs(BOTH_SIDES, 10);
        await make_stoned(3, null, KILLED_BY, 'source control');
        clearMessages(); seed(); await nh_timeout();
        if (mounted) {
            assert.equal(game.u.intrinsic.HWounded_legs, 9);
            assert.equal(game.u.EWounded_legs, BOTH_SIDES);
            assert.equal(game.u.atemp.a[A_DEX], -1);
        } else healed();
        assert.doesNotMatch(messages(), /leg.*feel.*better/);
        assert.equal(game.u.uprops.STONED, 2);
    });
}
