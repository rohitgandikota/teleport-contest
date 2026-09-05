#!/usr/bin/env node

// Source controls for C mon.c:2808-2887/3287-3374, worn.c:1377-1424,
// mthrowu.c:1154-1171 and dog.c:1292-1365. These legal states are separate
// from C-recorded replay evidence and earn no native coverage credit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { monstone, mondead, mlifesaver } from '../js/mon.js';
import { makemon } from '../js/makemon.js';
import { mksobj, add_to_container } from '../js/mkobj.js';
import { weight } from '../js/invent.js';
import { mpickobj } from '../js/steal.js';
import { extract_from_minvent, update_mon_extrinsics, m_dowear } from '../js/worn.js';
import { m_useup, m_useupall } from '../js/mthrowu.js';
import { begin_burn, stop_timer, obj_stop_timers } from '../js/timeout.js';
import { initedog } from '../js/dog.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES, MFLAGS } from '../js/monst_data.js';
import { OBJ_FREE, OBJ_MINVENT, OBJ_CONTAINED, OBJ_DELETED, OBJ_FLOOR,
    W_ARM, W_ARMC, W_ARMF, W_AMUL, W_WEP, I_SPECIAL, NEED_WEAPON, MFAST,
    LS_OBJECT, BURN_OBJECT, G_GENOD, MM_NOGRP, MM_NOMSG, NO_MINVENT,
    POOL, CORPSTAT_HISTORIC, CORPSTAT_FEMALE }
    from '../js/const.js';

const source = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/monster-pickup-light.json', import.meta.url))).segments[0];
const lights = obj => game.light_sources.filter(s => s.type === LS_OBJECT && s.id === obj.o_id);
const burns = obj => (game.timer_base || []).filter(t => t.func_index === BURN_OBJECT && t.arg === obj);
const statues = () => game.level.objects.filter(o => o.otyp === ONAMES.STATUE);

let replayCount = 0;
for (const name of ['monster-statue-containers', 'monster-lifesaving-petrification',
                    'monster-stone-equipment']) {
    const recipe = JSON.parse(readFileSync(new URL(
        `gen-sessions/recipes/${name}.json`, import.meta.url)));
    for (const segment of recipe.segments) {
        let original, carrier, wasLit = false;
        globalThis.__step_snapshot = { step: '*', cb: state => {
            original ||= state.invent?.find(o => o.invlet ===
                (name === 'monster-statue-containers' ? 'p' : 'o'));
            if (original?.where === OBJ_MINVENT) carrier = original.ocarry;
            wasLit ||= !!original?.lamplit;
        } };
        try {
            await runSegment({ ...segment, storage: new InMemoryStorage() });
        } finally {
            delete globalThis.__step_snapshot;
        }
        const label = name + ':' + segment.name;
        assert.ok(original, label);
        if (name === 'monster-statue-containers') {
            assert.equal(original.where, OBJ_CONTAINED, label);
            if (segment.name.includes('-looted-')) {
                // C records both successful selection draws before stoning.
                assert.equal(original.ocontainer.otyp, ONAMES.STATUE);
                const bag = original.ocontainer.cobj.find(o => o.otyp === ONAMES.SACK);
                assert.equal(bag.cobj.length, 0);
            } else {
                assert.equal(original.ocontainer.otyp, ONAMES.SACK);
                assert.equal(original.ocontainer.where, OBJ_CONTAINED);
                assert.equal(original.ocontainer.ocontainer.otyp, ONAMES.STATUE);
            }
            assert.equal(statues().length, 1);
            assert.equal(wasLit, false);
        } else if (name === 'monster-lifesaving-petrification') {
            assert.equal(original.where, OBJ_DELETED, label);
            assert.equal(carrier.mhp, carrier.mhpmax);
            assert.ok(carrier.mhp >= 10);
            assert.equal(carrier.mtame, 0);
            assert.equal(carrier.mpeaceful, 1);
            assert.equal(statues().length, 0);
            assert.equal(game.mvitals[carrier.mnum].died | 0, 0);
            assert.equal(carrier.misc_worn_check & W_AMUL, 0);
        } else if (segment.name === 'gold-armor-statue') {
            assert.ok(wasLit, label + ': armor shone while worn');
            assert.equal(original.where, OBJ_CONTAINED);
            assert.equal(original.ocontainer.otyp, ONAMES.STATUE);
            assert.equal(original.owornmask, 0);
            assert.equal(original.lamplit, 0);
            assert.equal(lights(original).length, 0);
        } else {
            assert.equal(original.where, OBJ_MINVENT, label);
            assert.ok(carrier.mhp > 0);
            assert.equal(statues().length, 0);
            if (segment.name === 'amulet-armor-protection') {
                assert.equal(mlifesaver(carrier), original);
            } else if (segment.name === 'speed-boots-movement') {
                assert.equal(original.owornmask & W_ARMF, W_ARMF);
                assert.equal(carrier.mspeed, MFAST);
            } else {
                assert.ok(wasLit && original.lamplit);
                assert.equal(lights(original).length, 1);
                assert.equal(burns(original).length, 0);
            }
        }
        replayCount++;
    }
}

async function setup(mnum = PMNAMES.PM_SOLDIER) {
    resetInputState();
    await runSegment({ ...source, moves: ' ', storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
    game.iflags.debug_mongen = false;
    pushKeys(' '.repeat(300));
    const mon = await makemon(game.mons[mnum], game.u.ux, game.u.uy,
        MM_NOGRP | MM_NOMSG | NO_MINVENT);
    assert.ok(mon);
    return mon;
}

async function give(mon, type, mask = 0) {
    const obj = mksobj(type, false, false);
    await mpickobj(mon, obj);
    obj.owornmask = mask;
    mon.misc_worn_check = (mon.misc_worn_check || 0) | mask;
    if (mask & W_WEP) mon.mw = obj;
    return obj;
}

try {
    // Both death entry points consume a worn amulet before making remains.
    // Low maximum HP is a legal consequence of life draining.
    for (const die of [monstone, mondead]) {
        for (const level of [0, 20]) {
            for (const invisible of [false, true]) {
                const mon = await setup();
                const amulet = await give(mon, ONAMES.AMULET_OF_LIFE_SAVING, W_AMUL);
                mon.minvis = +invisible;
                mon.m_lev = level;
                mon.mhpmax = 1;
                mon.mhp = 0;
                mon.mfrozen = 7;
                mon.mcanmove = 0;
                assert.equal(mlifesaver(mon), amulet);
                await die(mon);
                assert.equal(mon.mhpmax, Math.max(10, level + 1));
                assert.equal(mon.mhp, mon.mhpmax);
                assert.equal(mon.mcanmove, 1);
                assert.equal(mon.mfrozen, 0);
                assert.equal(amulet.where, OBJ_DELETED);
                assert.equal(mon.minvent.length, 0);
                assert.equal(mon.misc_worn_check & W_AMUL, 0);
                assert.ok(mon.misc_worn_check & I_SPECIAL);
                assert.equal(statues().length, 0);
                assert.equal(game.mvitals[mon.mnum].died | 0, 0);
                assert.equal(game.objects[ONAMES.AMULET_OF_LIFE_SAVING].oc_name_known, 1);
            }
        }
    }

    for (const condition of ['unworn', 'nonliving', 'genocided']) {
        const mon = await setup(condition === 'nonliving'
            ? PMNAMES.PM_HUMAN_ZOMBIE : PMNAMES.PM_SOLDIER);
        const amulet = await give(mon, ONAMES.AMULET_OF_LIFE_SAVING,
            condition === 'unworn' ? 0 : W_AMUL);
        if (condition === 'genocided') game.mvitals[mon.mnum].mvflags |= G_GENOD;
        else assert.equal(mlifesaver(mon), null);
        await monstone(mon);
        assert.equal(mon.mhp, 0);
        assert.equal(statues().length, 1);
        assert.equal(amulet.where, condition === 'genocided' ? OBJ_DELETED : OBJ_CONTAINED);
        assert.equal(game.mvitals[mon.mnum].died, 1);
    }

    // A statue keeps carried objects but stops fuel and weapon ownership.
    // Invocation tools and boulders remain outside it. Named unique traits
    // retain gender and historic flags after inventory extraction.
    const mon = await setup(PMNAMES.PM_MEDUSA);
    mon.mgivenname = 'Opal';
    mon.female = 1;
    mon.mtrapped = 1;
    const lamp = await give(mon, ONAMES.OIL_LAMP);
    lamp.age = 500;
    await begin_burn(lamp, false);
    game.moves += 7;
    const weapon = await give(mon, ONAMES.LONG_SWORD, W_WEP);
    const sack = await give(mon, ONAMES.SACK);
    const knife = mksobj(ONAMES.CRYSKNIFE, false, false);
    add_to_container(sack, knife);
    const boulder = await give(mon, ONAMES.BOULDER);
    const bell = await give(mon, ONAMES.BELL_OF_OPENING);
    const smock = await give(mon, ONAMES.ALCHEMY_SMOCK, W_ARMC);
    mon.mextrinsics = MFLAGS.MR_POISON | MFLAGS.MR_ACID;
    await monstone(mon);
    const statue = statues()[0];
    assert.ok(statue);
    assert.equal(statue.corpsenm, PMNAMES.PM_MEDUSA);
    assert.equal(statue.oname, 'Opal');
    assert.equal(statue.spe, CORPSTAT_HISTORIC | CORPSTAT_FEMALE);
    assert.equal(mon.mtrapped, 0);
    assert.equal(mon.mw, null);
    assert.equal(mon.weapon_check, NEED_WEAPON);
    assert.equal(statue.omonst.mw, null);
    assert.equal(statue.omonst.minvent, null);
    assert.equal(statue.omonst.misc_worn_check & (W_WEP | W_ARMC), 0);
    // C deliberately skips update_mon_extrinsics for an already dead owner.
    assert.equal(statue.omonst.mextrinsics, MFLAGS.MR_POISON | MFLAGS.MR_ACID);
    assert.equal(lamp.lamplit, 0);
    assert.equal(lamp.age, 493);
    assert.equal(lights(lamp).length, 0);
    assert.equal(burns(lamp).length, 0);
    for (const obj of [lamp, weapon, sack, smock]) {
        assert.equal(obj.where, OBJ_CONTAINED);
        assert.equal(obj.ocontainer, statue);
        assert.equal(obj.owornmask | 0, 0);
    }
    assert.equal(knife.otyp, ONAMES.WORM_TOOTH);
    assert.equal(knife.ocontainer, sack);
    for (const obj of [boulder, bell]) {
        assert.equal(obj.where, OBJ_FLOOR);
        assert.ok(!statue.cobj.includes(obj));
    }
    assert.equal(statue.owt, weight(statue));

    const poolMon = await setup(PMNAMES.PM_STONE_GIANT);
    const falling = await give(poolMon, ONAMES.BOULDER);
    game.level.at(poolMon.mx, poolMon.my).typ = POOL;
    await monstone(poolMon);
    assert.equal(falling.where, OBJ_DELETED, 'a dropped boulder receives pool floor effects');
    assert.ok(!game.level.objects.includes(falling));

    const armored = await setup();
    const gold = await give(armored, ONAMES.GOLD_DRAGON_SCALE_MAIL, W_ARM);
    await begin_burn(gold, false);
    assert.ok(gold.lamplit && lights(gold).length);
    await extract_from_minvent(armored, gold, true, true);
    assert.equal(gold.where, OBJ_FREE);
    assert.equal(gold.owornmask, 0);
    assert.equal(gold.lamplit, 0, 'gold armor must be snuffed before its worn bit is cleared');
    assert.equal(lights(gold).length, 0);

    const quick = await setup();
    const boots = await give(quick, ONAMES.SPEED_BOOTS, W_ARMF);
    update_mon_extrinsics(quick, boots, true, true);
    assert.equal(quick.mspeed, MFAST, 'silent creation applies speed synchronously');
    assert.equal(!!game.in_mklev, false, 'temporary creation flag is restored');
    await extract_from_minvent(quick, boots, true, false);
    assert.equal(quick.mspeed, quick.permspeed | 0);
    assert.equal(boots.where, OBJ_FREE);

    const wearer = await setup();
    const cap = await give(wearer, ONAMES.DUNCE_CAP);
    cap.blessed = 1;
    m_dowear(wearer, true);
    assert.equal(cap.cursed, 1);
    assert.equal(cap.blessed, 0, 'autocursing removes a former blessing');

    // Direct timer cancellation has the same cleanup as extinguishing.
    for (const stop of [o => stop_timer(BURN_OBJECT, o), obj_stop_timers]) {
        const holder = await setup();
        const bag = await give(holder, ONAMES.SACK);
        const nestedLamp = mksobj(ONAMES.OIL_LAMP, false, false);
        nestedLamp.age = 500;
        add_to_container(bag, nestedLamp);
        begin_burn(nestedLamp, false);
        assert.equal(lights(nestedLamp).length, 1, 'contained light resolves its carrier');
        assert.deepEqual([lights(nestedLamp)[0].x, lights(nestedLamp)[0].y],
            [holder.mx, holder.my]);
        game.moves += 7;
        stop(nestedLamp);
        assert.equal(nestedLamp.age, 493);
        assert.equal(nestedLamp.lamplit, 0);
        assert.equal(nestedLamp.timed, 0);
        assert.equal(lights(nestedLamp).length, 0);
        assert.equal(burns(nestedLamp).length, 0);
    }

    const consumer = await setup();
    const stack = await give(consumer, ONAMES.DAGGER, W_WEP);
    stack.quan = 2;
    stack.owt = weight(stack);
    await m_useup(consumer, stack);
    assert.equal(stack.where, OBJ_MINVENT);
    assert.equal(stack.quan, 1);
    assert.equal(stack.owt, weight(stack));
    assert.equal(consumer.mw, stack);
    await m_useup(consumer, stack);
    assert.equal(stack.where, OBJ_DELETED);
    assert.equal(consumer.mw, null);
    assert.equal(consumer.weapon_check, NEED_WEAPON);
    const burning = await give(consumer, ONAMES.WAX_CANDLE);
    burning.age = 100;
    burning.quan = 3;
    await begin_burn(burning, false);
    await m_useupall(consumer, burning);
    assert.equal(burning.where, OBJ_DELETED);
    assert.equal(burns(burning).length, 0);
    assert.equal(lights(burning).length, 0);

    const pet = await setup();
    initedog(pet, true);
    pet.edog.abuse = 10; // C's deterministic hostile branch, no random reprieve.
    pet.edog.mhpmax_penalty = 9;
    pet.mhpmax = 1;
    const petAmulet = await give(pet, ONAMES.AMULET_OF_LIFE_SAVING, W_AMUL);
    await monstone(pet);
    assert.equal(pet.mtame, 0);
    assert.equal(pet.mpeaceful, 0);
    assert.equal(pet.edog.mhpmax_penalty, 0);
    assert.equal(pet.mhp, pet.mhpmax);
    assert.ok(pet.mhp >= 10);
    assert.equal(petAmulet.where, OBJ_DELETED);
    assert.equal(statues().length, 0);
} finally {
    resetInputState();
}

console.log(`monster statue, life-saving and inventory cleanup state: PASS (${replayCount} C replays plus source controls)`);
