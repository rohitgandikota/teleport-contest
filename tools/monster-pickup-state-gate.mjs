#!/usr/bin/env node

// C steal.c:618-687, light.c:70/729-778, dothrow.c:2286-2315 and
// mhitu.c:1399/1470. Replays inspect hidden state; source controls below
// exercise further legal object states and earn no native C coverage.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mpickobj } from '../js/steal.js';
import { mksobj, add_to_container, place_object } from '../js/mkobj.js';
import { addinv, freeinv, weight } from '../js/invent.js';
import { makemon } from '../js/makemon.js';
import { begin_burn } from '../js/timeout.js';
import { obj_is_burning, snuff_light_source, new_light_source, del_light_source }
    from '../js/light.js';
import { artifact_exists } from '../js/artifact.js';
import { ready_weapon } from '../js/wield.js';
import { canseemon } from '../js/display.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { ART_SUNSWORD } from '../js/artilist_data.js';
import { OBJ_FREE, OBJ_INVENT, OBJ_MINVENT, OBJ_CONTAINED, OBJ_DELETED,
    LOST_NONE, LOST_THROWN, LOST_DROPPED, LOST_STOLEN, LS_OBJECT, LS_MONSTER,
    BURN_OBJECT, MM_NOGRP, MM_NOMSG, NO_MINVENT, ONAME_LEVEL_DEF }
    from '../js/const.js';

const read = name => JSON.parse(readFileSync(new URL(
    `gen-sessions/recipes/${name}.json`, import.meta.url)));
const source = read('monster-pickup-light').segments[0];
const lights = obj => game.light_sources.filter(s => s.type === LS_OBJECT && s.id === obj.o_id);
const burns = obj => (game.timer_base || []).filter(t => t.func_index === BURN_OBJECT && t.arg === obj);
let count = 0;
for (const file of ['monster-pickup-light', 'monster-pickup-currents',
                    'engulf-carried-light', 'swallowed-corpse-transfer']) {
    for (const segment of read(file).segments) {
        let original, wasLit = false, wasBlind = false;
        globalThis.__step_snapshot = { step: '*', cb: state => {
            original ||= state.invent?.find(o => o.invlet === 'a');
            wasLit ||= !!original?.lamplit;
            wasBlind ||= !!state.u.ublind;
        } };
        try {
            await runSegment({ ...segment, storage: new InMemoryStorage() });
        } finally {
            delete globalThis.__step_snapshot;
        }
        const label = file + ':' + segment.name;
        assert.ok(original, label);
        assert.equal(game.thrownobj ?? null, null, label + ': projectile tracking cleared');
        if (file === 'engulf-carried-light') {
            assert.ok(wasLit, label + ': lit before engulfing');
            assert.ok(game.invent.includes(original));
            assert.equal(original.where, OBJ_INVENT);
            const fire = segment.name === 'fire-lamp';
            assert.equal(!!original.lamplit, fire);
            assert.equal(lights(original).length, +fire);
            assert.equal(burns(original).length, +fire);
        } else if (segment.name === 'worm-cockatrice') {
            assert.equal(original.where, OBJ_DELETED);
            assert.equal(game.u.uswallow, 0);
            assert.equal(original.timed | 0, 0);
            const statue = game.level.objects.find(o => o.otyp === ONAMES.STATUE
                && o.corpsenm === PMNAMES.PM_PURPLE_WORM);
            assert.ok(statue, label + ': engulfer became a statue');
            assert.ok(!statue.cobj?.includes(original));
        } else {
            assert.ok(!game.invent.includes(original));
            assert.equal(original.where, OBJ_MINVENT);
            assert.ok(original.ocarry.minvent.includes(original));
            assert.equal(original.how_lost, LOST_STOLEN);
            assert.equal(original.no_charge | 0, 0);
            assert.ok(!original.lamplit);
            assert.equal(lights(original).length, 0);
            assert.equal(burns(original).length, 0);
            if (file !== 'swallowed-corpse-transfer') {
                assert.equal(wasLit, !['lamp-unlit', 'candle-blocked'].includes(segment.name));
                assert.equal(original.timed | 0, 0);
            }
        }
        if (segment.name === 'dust-lamp')
            assert.ok(wasBlind, 'the silent light-out branch is reached while blind');
        count++;
    }
}

async function setup(segment = { ...source, moves: ' ' }) {
    resetInputState();
    await runSegment({ ...segment, storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
    game.iflags.debug_mongen = false;
    pushKeys(' '.repeat(300));
}
async function monster(mnum = PMNAMES.PM_OWLBEAR) {
    const mon = await makemon(game.mons[mnum], game.u.ux, game.u.uy,
        MM_NOGRP | MM_NOMSG | NO_MINVENT);
    assert.ok(mon);
    return mon;
}

try {
    // C grants pets and the current holder an exception to lost knowledge.
    for (const disposition of ['visible', 'hidden', 'held', 'pet']) {
        for (const loss of [LOST_THROWN, LOST_DROPPED, LOST_STOLEN]) {
            await setup();
            const mon = await monster();
            mon.minvis = disposition === 'visible' ? 0 : 1;
            if (disposition === 'held') game.u.ustuck = mon;
            if (disposition === 'pet') mon.mtame = 10;
            assert.equal(!!canseemon(mon), disposition === 'visible');
            const obj = mksobj(ONAMES.LONG_SWORD, false, false);
            for (const key of ['known', 'dknown', 'bknown', 'rknown', 'cknown', 'lknown', 'tknown'])
                obj[key] = 1;
            obj.no_charge = 1;
            obj.how_lost = loss;
            game.thrownobj = obj;
            assert.equal(mpickobj(mon, obj), 0, 'unlit construction finishes synchronously');
            assert.equal(game.thrownobj, null);
            assert.equal(obj.where, OBJ_MINVENT);
            assert.equal(obj.ocarry, mon);
            assert.equal(obj.no_charge, 0);
            assert.equal(obj.how_lost, disposition === 'pet' ? loss
                : loss === LOST_DROPPED ? LOST_NONE : LOST_STOLEN);
            for (const key of ['dknown', 'bknown', 'rknown', 'cknown', 'lknown', 'tknown'])
                assert.equal(obj[key], +(disposition !== 'hidden'), disposition + ':' + key);
            assert.equal(obj.known, disposition === 'hidden'
                ? +!game.objects[obj.otyp].oc_uses_known : 1);
        }
    }

    await setup();
    const carrier = await monster();
    const first = mksobj(ONAMES.ARROW, false, false);
    first.quan = 2;
    first.owt = weight(first);
    assert.equal(mpickobj(carrier, first), 0);
    const second = mksobj(ONAMES.ARROW, false, false);
    second.quan = 3;
    second.owt = weight(second);
    game.kickedobj = second;
    assert.equal(mpickobj(carrier, second), 1, 'return whether add_to_minv freed a merged object');
    assert.equal(game.kickedobj, null);
    assert.equal(second.where, OBJ_DELETED);
    assert.equal(first.quan, 5);
    assert.equal(carrier.minvent.length, 1);

    // Both attached punishment objects must stay outside minvent.
    assert.equal(await mpickobj(carrier, null), 1);
    for (const [slot, type] of [['uball', ONAMES.HEAVY_IRON_BALL], ['uchain', ONAMES.IRON_CHAIN]]) {
        const attached = mksobj(type, false, false);
        game.u[slot] = attached;
        assert.equal(await mpickobj(carrier, attached), 0);
        assert.equal(attached.where | 0, OBJ_FREE);
        assert.ok(!carrier.minvent.includes(attached));
        game.u[slot] = null;
    }
    assert.equal(game.impossible_log.length, 3);

    // Use a C-recorded unpaid stack, then transfer it directly or in nested
    // containers. The bill owner is resolved at the acquiring object's square.
    for (const nested of [false, true]) {
        await setup(read('inventory-unpaid-merging').segments[0]);
        const shop = game.level.monsters.find(m => m.isshk);
        const apples = game.invent.find(o => o.otyp === ONAMES.APPLE);
        assert.ok(apples.unpaid);
        const mon = await monster();
        freeinv(apples);
        let obj = apples;
        if (nested) {
            const inner = mksobj(ONAMES.SACK, false, false);
            obj = mksobj(ONAMES.LARGE_BOX, false, false);
            add_to_container(inner, apples);
            add_to_container(obj, inner);
        }
        obj.ox = game.u.ux;
        obj.oy = game.u.uy;
        assert.equal(await mpickobj(mon, obj), 0);
        assert.equal(apples.unpaid, 0);
        assert.equal(shop.eshk.billct, 0);
        assert.equal(shop.eshk.bill_p.length, 0);
        assert.equal(obj.where, OBJ_MINVENT);
        assert.equal(apples.where, nested ? OBJ_CONTAINED : OBJ_MINVENT);
    }

    for (const type of [ONAMES.OIL_LAMP, ONAMES.BRASS_LANTERN,
        ONAMES.MAGIC_LAMP, ONAMES.WAX_CANDLE, ONAMES.TALLOW_CANDLE, ONAMES.POT_OIL]) {
        await setup();
        const mon = await monster(PMNAMES.PM_ICE_VORTEX);
        const obj = mksobj(type, false, false);
        obj.age = 500;
        obj.spe = 1;
        await addinv(obj);
        await begin_burn(obj, false);
        assert.ok(obj_is_burning(obj));
        // The C loop uses cached light coordinates, even when they are stale.
        const light = lights(obj)[0];
        light.x = mon.mx;
        light.y = mon.my;
        game.moves += 7;
        freeinv(obj);
        game.u.ustuck = mon;
        game.u.uswallow = 1;
        await mpickobj(mon, obj);
        assert.equal(obj.where, OBJ_MINVENT);
        assert.equal(obj.ocarry, mon);
        assert.equal(obj.lamplit, 0);
        assert.equal(obj.age, type === ONAMES.MAGIC_LAMP ? 500 : 493);
        assert.equal(lights(obj).length, 0);
        assert.equal(burns(obj).length, 0);
    }

    await setup();
    const lamps = [];
    for (let i = 0; i < 2; i++) {
        const obj = mksobj(ONAMES.OIL_LAMP, false, false);
        obj.age = 500;
        place_object(obj, game.u.ux, game.u.uy);
        await begin_burn(obj, false);
        lamps.push(obj);
    }
    assert.deepEqual(game.light_sources.map(s => s.id), lamps.toReversed().map(o => o.o_id));
    assert.equal(game.vision_full_recalc, 1);
    const [older, newer] = lamps;
    snuff_light_source(game.u.ux + 1, game.u.uy);
    assert.ok(older.lamplit && newer.lamplit, 'a different cached square is untouched');

    // A real, wielded Sunsword is a permanent light, not timed fuel.
    const sword = mksobj(ONAMES.LONG_SWORD, false, false);
    sword.oname = 'Sunsword';
    game.iflags.override_ID = true;
    artifact_exists(sword, sword.oname, true, ONAME_LEVEL_DEF);
    assert.equal(sword.oartifact, ART_SUNSWORD);
    await addinv(sword);
    await ready_weapon(sword);
    assert.ok(obj_is_burning(sword));
    snuff_light_source(game.u.ux, game.u.uy);
    assert.ok(sword.lamplit, 'skip an artifact and continue to ordinary light');
    assert.equal(newer.lamplit, 0, 'only the newest eligible source is extinguished');
    assert.equal(older.lamplit, 1);
    snuff_light_source(game.u.ux, game.u.uy);
    assert.equal(older.lamplit, 0);
    assert.ok(sword.lamplit);

    const emptyMagic = mksobj(ONAMES.MAGIC_LAMP, false, false);
    emptyMagic.spe = 0;
    emptyMagic.lamplit = 1;
    assert.equal(obj_is_burning(emptyMagic), false, 'an empty magic lamp is not ignitable');
    const stone = mksobj(ONAMES.ROCK, false, false);
    stone.lamplit = 1;
    assert.equal(obj_is_burning(stone), false, 'lamplit alone is insufficient');
    new_light_source(game.u.ux, game.u.uy, 0, LS_OBJECT, 0);
    snuff_light_source(game.u.ux, game.u.uy);
    del_light_source(LS_OBJECT, 0);
    new_light_source(game.u.ux, game.u.uy, 1, LS_MONSTER, game.youmonst.m_id);
    snuff_light_source(game.u.ux, game.u.uy);
    assert.ok(sword.lamplit);
} finally {
    resetInputState();
}
console.log(`monster pickup state: PASS (${count} C replays plus source controls)`);
