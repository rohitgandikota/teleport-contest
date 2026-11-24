// C uhitm.c:4492-4565 and dogmove.c:156-216. Constructed owner controls,
// using real monster, pet, corpse, timer and deallocation producers.
// They do not establish ordinary-input reach through mdamagem.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mhitm_ad_dgst } from '../js/uhitm.js';
import { engulf_target } from '../js/mhitm.js';
import { makemon } from '../js/makemon.js';
import { tamedog } from '../js/dog.js';
import { mksobj, set_corpsenm, place_object, dobjsfree } from '../js/mkobj.js';
import { begin_burn, run_timers, ROT_CORPSE, REVIVE_MON } from '../js/timeout.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { pline, TOPLINE_EMPTY } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES, ATTKS, MFLAGS } from '../js/monst_data.js';
import { ROOM, MM_NOGRP, MM_NOMSG, NO_MINVENT, OBJ_DELETED,
    M_ATTK_MISS, M_ATTK_AGR_DIED } from '../js/const.js';
import { IN_SIGHT, COULD_SEE, TEMP_LIT } from '../js/vision.js';

const basic = { seed: 7341, datetime: '20000110090000', moves: ' ',
    nethackrc: 'OPTIONS=name:Digest,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n' };

async function setup(victim = PMNAMES.PM_OGRE, tame = true) {
    const replay = await runSegment({ ...basic, storage: new InMemoryStorage() });
    let keys = 0;
    replay._display.onEmptyQueue = () => {
        assert.ok(++keys <= 30, 'bounded real acknowledgments'); return 32;
    };
    game._preNhgetchHook = null; resetInputState();
    game.level.objects = []; game.level.objAt.clear();
    game.level.monsters = []; game.level.monAt = new Map(); game.level.traps = [];
    game.invent = []; game.timer_base = []; game.light_sources = []; game.billobjs = [];
    game.u.ux = 30; game.u.uy = 10; game.u.ushops = ''; game.moves = 100;
    game.vis = true; game.flags.verbose = false;
    for (let x = 28; x <= 35; x++) for (let y = 8; y <= 12; y++) {
        Object.assign(game.level.at(x, y), { typ: ROOM, lit: 1, roomno: 0 });
        game.viz_array[y][x] = IN_SIGHT | COULD_SEE | TEMP_LIT;
    }
    const flags = MM_NOGRP | MM_NOMSG | NO_MINVENT;
    const pet = await makemon(game.mons[PMNAMES.PM_PURPLE_WORM], 31, 10, flags);
    const target = await makemon(game.mons[victim], 32, 10, flags);
    assert.ok(pet && target);
    if (tame) assert.equal(await tamedog(pet, null, false), true);
    assert.equal(!!pet.mtame, tame);
    dobjsfree(); game._toplin = TOPLINE_EMPTY; game._prevmsg = '';
    const attack = pet.data.mattk.find(a => a[0] === ATTKS.AT_ENGL && a[1] === ATTKS.AD_DGST);
    assert.ok(attack, 'real purple worm digestion attack');
    return { pet, target, attack, replay };
}
function seed(value = 19) { initRng(value); enableRngLog(); }
function record() { return { damage: 17, hitflags: M_ATTK_MISS, done: false }; }
function virtual(target) {
    const corpses = (game.objs_deleted || []).filter(o => o.otyp === ONAMES.CORPSE);
    assert.equal(corpses.length, 1, 'one staged virtual corpse');
    const body = corpses[0];
    assert.equal(body.corpsenm, target.mnum); assert.equal(body.where, OBJ_DELETED);
    assert.equal(body.timed || 0, 0); assert.equal(body.lua_ref_cnt || 0, 0);
    assert.ok(!game.timer_base.some(t => t.arg === body));
    assert.ok(!game.level.objects.includes(body) && !game.invent.includes(body));
    assert.ok(!game.level.monsters.some(m => m.minvent?.includes(body)));
    return body;
}

for (const [name, species, nutrition, eating] of [
    ['ogre', PMNAMES.PM_OGRE, 500, 7],
    ['troll', PMNAMES.PM_TROLL, 350, 4],
    ['lizard', PMNAMES.PM_LIZARD, 40, 1],
]) {
    test(`${name}: real virtual corpse is released after nutrition with C quarter/half reductions`, async () => {
        const { pet, target, attack } = await setup(species);
        const hunger = pet.edog.hungrytime, hp = target.mhp;
        seed(); const mhm = record(); await mhitm_ad_dgst(pet, attack, target, mhm);
        assert.equal(mhm.damage, hp); assert.equal(target.mhp, hp, 'handler leaves death to mdamagem');
        assert.equal(pet.edog.hungrytime, hunger + nutrition);
        assert.equal(pet.meating, eating); virtual(target);
        assert.equal(game.timer_base.length, 0);
        assert.equal(mhm.done, false); assert.equal(mhm.hitflags, M_ATTK_MISS);
    });
}

test('deferred physical release drains only the already-detached virtual record', async () => {
    const { pet, target, attack } = await setup(); seed();
    await mhitm_ad_dgst(pet, attack, target, record());
    const body = virtual(target), id = body.o_id;
    assert.ok(id > 0); const draws = [...getRngLog()];
    assert.equal(dobjsfree(), undefined); assert.deepEqual(body, {});
    assert.deepEqual(game.objs_deleted || [], []); assert.deepEqual(getRngLog(), draws);
});

test('unrelated floor corpse timer, burning light, billing and transient owners survive', async () => {
    const { pet, target, attack } = await setup();
    const body = mksobj(ONAMES.CORPSE, false, false); set_corpsenm(body, PMNAMES.PM_OGRE);
    await place_object(body, 33, 10);
    const lamp = mksobj(ONAMES.OIL_LAMP, false, false); lamp.age = 500;
    await place_object(lamp, 34, 10); await begin_burn(lamp, false);
    const timers = [...game.timer_base], lights = [...game.light_sources];
    game.thrownobj = body; game.kickedobj = lamp;
    game.context.tin = { tin: body, o_id: body.o_id };
    game.context.objsplit = { parent_oid: body.o_id, child_oid: lamp.o_id };
    const split = { ...game.context.objsplit };
    seed(); await mhitm_ad_dgst(pet, attack, target, record()); virtual(target);
    assert.deepEqual(game.timer_base, timers); assert.deepEqual(game.light_sources, lights);
    assert.equal(body.timed, 1); assert.equal(lamp.lamplit, 1);
    assert.equal(game.thrownobj, body); assert.equal(game.kickedobj, lamp);
    assert.equal(game.context.tin.tin, body); assert.deepEqual(game.context.objsplit, split);
    assert.deepEqual(game.billobjs, []);
});

for (const victim of [PMNAMES.PM_OGRE, PMNAMES.PM_TROLL]) {
    test(`removed ${victim === PMNAMES.PM_TROLL ? 'revival' : 'rot'} timer cannot run later`, async () => {
        const { pet, target, attack, replay } = await setup(victim);
        seed(); await mhitm_ad_dgst(pet, attack, target, record());
        const hunger = pet.edog.hungrytime, before = [...getRngLog()];
        const messages = game._prevmsg;
        game.moves += 1000; await run_timers();
        assert.deepEqual(getRngLog(), before, 'no abandoned corpse callback draws');
        assert.equal(game._prevmsg, messages, 'no abandoned corpse feedback');
        assert.equal(pet.edog.hungrytime, hunger);
        assert.equal(game.timer_base.length, 0);
        assert.ok(replay._display);
    });
}

test('mksobj(false) and set_corpsenm really produce rot, revival and timer-free variants', async () => {
    await setup();
    seed(2); const body = mksobj(ONAMES.CORPSE, false, false);
    assert.ok(body.timed, 'init=false still schedules the initial corpse');
    set_corpsenm(body, PMNAMES.PM_OGRE);
    assert.deepEqual(game.timer_base.map(t => t.func_index), [ROT_CORPSE]);
    seed(2); set_corpsenm(body, PMNAMES.PM_TROLL);
    assert.deepEqual(game.timer_base.map(t => t.func_index), [REVIVE_MON]);
    set_corpsenm(body, PMNAMES.PM_LIZARD);
    assert.equal(body.timed || 0, 0); assert.deepEqual(game.timer_base, []);
});

for (const kind of ['wild', 'minion', 'nocorpse']) {
    test(`${kind}: no virtual corpse or pet nutrition is allocated`, async () => {
        const { pet, target, attack } = await setup(
            kind === 'nocorpse' ? PMNAMES.PM_HUMAN_ZOMBIE : PMNAMES.PM_OGRE, kind !== 'wild');
        if (kind === 'minion') pet.isminion = 1; // source guard, not ordinary minion provenance
        if (kind === 'nocorpse') assert.ok(game.mvitals[target.mnum].mvflags & MFLAGS.G_NOCORPSE);
        assert.ok(engulf_target(pet, target), 'natural engulf size/terrain preconditions');
        const hunger = pet.edog?.hungrytime, ident = game.context.ident;
        seed(kind === 'nocorpse' ? 1 : 19);
        const mhm = record(); await mhitm_ad_dgst(pet, attack, target, mhm);
        assert.equal(mhm.damage, target.mhp); assert.equal(pet.edog?.hungrytime, hunger);
        assert.equal(pet.meating || 0, 0); assert.equal(game.context.ident, ident);
        assert.deepEqual(game.objs_deleted || [], []); assert.deepEqual(game.timer_base, []);
        assert.deepEqual(getRngLog(), kind === 'nocorpse' ? ['rn2(3)=0'] : []);
    });
}

for (const side of ['hero-attacker', 'hero-defender']) {
    test(`${side}: shared handler leaves digestion to the hero-specific owner`, async () => {
        const { pet, target, attack } = await setup(); const mhm = record(); seed();
        await mhitm_ad_dgst(side === 'hero-attacker' ? game.youmonst : pet,
            attack, side === 'hero-defender' ? game.youmonst : target, mhm);
        assert.equal(mhm.damage, 0); assert.equal(mhm.done, false);
        assert.deepEqual(getRngLog(), []); assert.deepEqual(game.objs_deleted || [], []);
    });
}

test('corpse_chance false for a swallowed lich preserves the no-nutrition return', async () => {
    const { pet, target, attack } = await setup(PMNAMES.PM_LICH);
    const hunger = pet.edog.hungrytime; seed();
    await mhitm_ad_dgst(pet, attack, target, record());
    assert.equal(pet.edog.hungrytime, hunger); assert.deepEqual(game.timer_base, []);
    assert.deepEqual(game.objs_deleted || [], []); assert.deepEqual(getRngLog(), []);
});

test('Rider digestion kills the aggressor before virtual-corpse construction', async () => {
    const { pet, target, attack } = await setup(PMNAMES.PM_FAMINE);
    game.vis = false; pet.mtame = 0; const mhm = record(); seed();
    await mhitm_ad_dgst(pet, attack, target, mhm);
    assert.equal(mhm.done, true); assert.equal(mhm.hitflags, M_ATTK_AGR_DIED);
    assert.ok(pet.mhp <= 0); assert.ok(target.mhp > 0);
    assert.ok(!(game.objs_deleted || []).some(o => o.corpsenm === target.mnum));
});

test('real More suspension finishes before corpse allocation and cleanup', async () => {
    const { pet, target, attack, replay } = await setup();
    game.flags.verbose = true;
    await pline('An earlier message fills the line before the next digestion message must wait.');
    let release, entered;
    const blocked = new Promise(resolve => { entered = resolve; });
    const pause = new Promise(resolve => { release = resolve; });
    replay._display.onEmptyQueue = async () => { entered(); await pause; return 32; };
    const hunger = pet.edog.hungrytime, ident = game.context.ident; seed();
    let finished = false;
    const operation = mhitm_ad_dgst(pet, attack, target, record()).then(() => { finished = true; });
    let timeout;
    try {
        await Promise.race([blocked, new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error('real More did not block')), 2000);
        })]);
        assert.equal(finished, false); assert.equal(pet.edog.hungrytime, hunger);
        assert.equal(game.context.ident, ident); assert.deepEqual(game.objs_deleted || [], []);
    } finally {
        clearTimeout(timeout); release(); await operation;
    }
    virtual(target); assert.equal(pet.edog.hungrytime, hunger + 500);
    assert.equal(finished, true);
});
