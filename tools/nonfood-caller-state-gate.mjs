// Real caller chains for exceptional accepted meals. No helper replacements.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup, seed, clearMessages, messages, x, y } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { doeat } from '../js/eat.js';
import { mksobj } from '../js/mkobj.js';
import { addinv, fully_identify_obj } from '../js/invent.js';
import { oname } from '../js/do_name.js';
import { polymon } from '../js/polyself.js';
import { makemon } from '../js/makemon.js';
import { tamedog } from '../js/dog.js';
import { doapply } from '../js/apply.js';
import { init_objects } from '../js/o_init.js';
import { cmdq_add_key } from '../js/cmd.js';
import { set_itimeout } from '../js/potion.js';
import { getRngLog, rn2 } from '../js/rng.js';
import { ONAMES, MATERIALS } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { M_AP_TYPE } from '../js/const.js';
import { Breathless } from '../js/youprop.js';
import { CQ_CANNED, ECMD_TIME, MM_NOMSG, NO_MINVENT, MM_NOGRP, MM_NOWAIT,
    MM_EGD, GD_EATGOLD, M_AP_NOTHING,
    FROMOUTSIDE, ONAME_WISH, NOT_HUNGRY, Upolyd } from '../js/const.js';

function select(run, obj, chosenSeed = 2) {
    clearMessages();
    run._display.clearInputQueue();
    game.command_queue = [];
    cmdq_add_key(CQ_CANNED, obj.invlet);
    game.u.uhunger = 500;
    game.u.uhs = NOT_HUNGRY;
    seed(chosenSeed);
}

function initMetal(typ) {
    for (let value = 1; value <= 64; value++) {
        seed(value);
        init_objects();
        const mat = game.objects[typ].oc_material;
        if (mat >= MATERIALS.IRON && mat <= MATERIALS.MITHRIL)
            return;
    }
    throw Error('object initializer did not produce the selected metal accessory');
}

function effectSeed(bound, predicate = () => true) {
    for (let value = 1; value <= 1000; value++) {
        seed(value);
        if (!rn2(bound) && predicate())
            return value;
    }
    throw Error('bounded effect seed search failed');
}

test('eating gold reaches the real vault watcher after whole-stack disposal', async () => {
    const run = await setup();
    await polymon(PMNAMES.PM_XORN);
    const guard = await makemon(game.mons[PMNAMES.PM_GUARD], x + 1, y,
        MM_EGD | MM_NOMSG | NO_MINVENT);
    guard.isgd = 1;
    guard.mpeaceful = 1;
    Object.assign(guard.mextra.egd, { gdlevel: { ...game.u.uz }, witness: 0 });
    const gold = mksobj(ONAMES.GOLD_PIECE, false, false);
    gold.quan = 1000;
    await addinv(gold);
    select(run, gold);
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(guard.mextra.egd.witness, GD_EATGOLD);
    assert.equal(guard.mpeaceful, 1);
    assert.equal(game.invent.includes(gold), false);
    assert.deepEqual(getRngLog(), []);
});

test('a leash attached by doapply releases its real pet when eaten', async () => {
    const run = await setup();
    const pet = await makemon(game.mons[PMNAMES.PM_LITTLE_DOG], x + 1, y,
        MM_NOMSG | NO_MINVENT | MM_NOGRP | MM_NOWAIT);
    await tamedog(pet, null, false);
    const leash = mksobj(ONAMES.LEASH, false, false);
    await addinv(leash);
    cmdq_add_key(CQ_CANNED, leash.invlet);
    run._display.pushKey(108);
    assert.equal(await doapply(), ECMD_TIME);
    assert.equal(leash.leashmon, pet.m_id);
    assert.equal(pet.mleashed, 1);
    await polymon(PMNAMES.PM_GELATINOUS_CUBE);
    select(run, leash);
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(leash.leashmon, 0);
    assert.equal(pet.mleashed, 0);
    assert.equal(game.invent.includes(leash), false);
    assert.equal(game.u.uconduct.unvegetarian, 1);
});

test('shape-protection ring reaches the real mimic cleanup owner', async () => {
    const run = await setup();
    initMetal(ONAMES.RIN_PROTECTION_FROM_SHAPE_CHAN);
    await polymon(PMNAMES.PM_XORN);
    const mon = await makemon(game.mons[PMNAMES.PM_SMALL_MIMIC], x + 1, y,
        MM_NOMSG | NO_MINVENT | MM_NOGRP | MM_NOWAIT);
    assert.notEqual(M_AP_TYPE(mon), M_AP_NOTHING);
    const ring = mksobj(ONAMES.RIN_PROTECTION_FROM_SHAPE_CHAN, false, false);
    await addinv(ring);
    select(run, ring, effectSeed(3));
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(game.u.intrinsic.HProtection_from_shape_changers & FROMOUTSIDE, FROMOUTSIDE);
    assert.equal(M_AP_TYPE(mon), M_AP_NOTHING);
    assert.equal(mon.msleeping, 1);
    assert.deepEqual(getRngLog(), ['rn2(3)=0']);
});

test('strangulation uses the breathless xorn recovery without a suffocation draw', async () => {
    const run = await setup();
    initMetal(ONAMES.AMULET_OF_STRANGULATION);
    await polymon(PMNAMES.PM_XORN);
    const amulet = mksobj(ONAMES.AMULET_OF_STRANGULATION, false, false);
    await addinv(amulet);
    assert.equal(Breathless(), true);
    const chosenSeed = effectSeed(5);
    select(run, amulet, chosenSeed);
    assert.equal(await doeat(), ECMD_TIME);
    assert.match(messages(), /choke, but recover your composure/);
    assert.doesNotMatch(messages(), /Magic spreads/);
    assert.equal(game.invent.includes(amulet), false);
    assert.deepEqual(getRngLog(), ['rn2(5)=0']);
});

test('intrinsic unchanging suppresses rehumanization after the effect roll', async () => {
    const run = await setup();
    initMetal(ONAMES.AMULET_OF_UNCHANGING);
    await polymon(PMNAMES.PM_XORN);
    set_itimeout('HUnchanging', 30);
    const amulet = mksobj(ONAMES.AMULET_OF_UNCHANGING, false, false);
    await addinv(amulet);
    select(run, amulet, effectSeed(5));
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(Upolyd(game.u), true);
    assert.equal(game.u.intrinsic.HUnchanging, 30);
    assert.doesNotMatch(messages(), /Magic spreads/);
    assert.deepEqual(getRngLog(), ['rn2(5)=0']);
});

test('cursed accepted nonfood retains all three harmless rotten checks', async () => {
    const run = await setup();
    await polymon(PMNAMES.PM_XORN);
    const obj = mksobj(ONAMES.DAGGER, false, false);
    obj.cursed = 1;
    await addinv(obj);
    select(run, obj);
    assert.equal(await doeat(), ECMD_TIME);
    assert.match(messages(), /Blecch!  Awful metal!/);
    assert.doesNotMatch(messages(), /delicious/);
    assert.equal(game.invent.includes(obj), false);
    assert.deepEqual(getRngLog(), ['rn2(4)=1', 'rn2(4)=2', 'rn2(3)=2']);
});

test('fully identified accepted artifact retains the proper-name meal prefix', async () => {
    const run = await setup();
    await polymon(PMNAMES.PM_XORN);
    const sword = mksobj(ONAMES.LONG_SWORD, false, false);
    await oname(sword, 'Vorpal Blade', ONAME_WISH);
    await addinv(sword);
    fully_identify_obj(sword);
    select(run, sword);
    assert.equal(await doeat(), ECMD_TIME);
    assert.match(messages(), /Vorpal Blade is delicious!/);
    assert.doesNotMatch(messages(), /This Vorpal Blade|blasted|evades/);
    assert.equal(game.invent.includes(sword), false);
    assert.deepEqual(getRngLog(), []);
});
