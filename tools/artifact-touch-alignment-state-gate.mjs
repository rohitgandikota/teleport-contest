// C artifact.c:908 touch_artifact; real alignment, artifact and inventory producers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { setup, seed, clearMessages, messages, x, y } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { touch_artifact, touch_artifact_mon } from '../js/artifact.js';
import { mk_roamer, priestini, mon_aligntyp } from '../js/priest.js';
import { makemon } from '../js/makemon.js';
import { set_mon_data, is_covetous, is_mplayer } from '../js/mondata.js';
import { set_levltyp } from '../js/mkmaze.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { oname } from '../js/do_name.js';
import { mpickobj } from '../js/steal.js';
import { can_touch_safely, can_carry, mpickstuff } from '../js/mon.js';
import { select_hwep } from '../js/weapon.js';
import { hold_another_object } from '../js/invent.js';
import { pline } from '../js/display.js';
import { getRngLog } from '../js/rng.js';
import { artifact_names, artifact_otyps } from '../js/artilist_data.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES as P } from '../js/monst_data.js';
import * as C from '../js/const.js';

async function artifact(name) {
    const index = artifact_names.indexOf(name);
    assert.ok(index > 0);
    const obj = mksobj(ONAMES[artifact_otyps[index]], false, false);
    assert.equal(await oname(obj, name, C.ONAME_WISH), obj);
    assert.equal(obj.oartifact, index);
    return obj;
}
async function monster(species) {
    return await makemon(game.mons[species], x + 1, y,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
}
async function roamer(alignment) {
    const mon = await mk_roamer(game.mons[P.PM_ALIGNED_CLERIC], alignment, x + 1, y, false);
    assert.ok(mon.isminion && !mon.ispriest && !mon.mpeaceful);
    assert.equal(mon.emin.min_align, alignment);
    assert.equal(mon_aligntyp(mon), alignment);
    return mon;
}
function quiet(mon, obj, expected) {
    clearMessages();
    seed(2);
    const inventory = [...(mon.minvent || [])];
    const floor = [...game.level.objects];
    const hp = mon.mhp;
    const result = touch_artifact_mon(obj, mon);
    assert.equal(result, expected);
    assert.ok(!(result instanceof Promise));
    assert.deepEqual(getRngLog(), []);
    assert.equal(messages(), '');
    assert.equal(mon.mhp, hp);
    assert.deepEqual(mon.minvent || [], inventory);
    assert.deepEqual(game.level.objects, floor);
}

for (const alignment of [C.A_LAWFUL, C.A_NEUTRAL, C.A_CHAOTIC, C.A_NONE]) {
    test(`roamer alignment overrides neutral species: ${alignment}`, async () => {
        await setup();
        const mon = await roamer(alignment);
        assert.equal(mon.data.maligntyp, C.A_NEUTRAL);
        quiet(mon, await artifact('Vorpal Blade'), Number(alignment === C.A_NEUTRAL));
        quiet(mon, await artifact('Excalibur'), Number(alignment === C.A_LAWFUL));
    });
    test(`real shrine alignment survives species change: ${alignment}`, async () => {
        await setup();
        assert.equal(set_levltyp(x + 2, y, C.ALTAR), true);
        game.level.at(x + 2, y).altarmask = C.Align2amask(alignment) | C.AM_SHRINE;
        const building = game.in_mklev;
        try {
            game.in_mklev = true;
            priestini(game.u.uz, game.level.rooms[0], x + 2, y, false);
        } finally {
            game.in_mklev = building;
        }
        const mon = game.level.monsters.find(mon => mon.ispriest);
        assert.ok(mon?.epri && !mon.isminion);
        set_mon_data(mon, game.mons[P.PM_IMP]);
        assert.equal(mon.epri.shralign, alignment);
        assert.equal(mon_aligntyp(mon), alignment);
        quiet(mon, await artifact('Vorpal Blade'), Number(alignment === C.A_NEUTRAL));
        quiet(mon, await artifact('Excalibur'), Number(alignment === C.A_LAWFUL));
    });
}

test('owned A_NONE is preserved even for a chaotic species', async () => {
    await setup();
    const mon = await mk_roamer(game.mons[P.PM_HILL_GIANT], C.A_NONE, x + 1, y, false);
    assert.ok(!mon.ispriest && mon.isminion);
    assert.ok(mon.data.maligntyp < 0 && mon.data.maligntyp !== C.A_NONE);
    assert.equal(mon_aligntyp(mon), C.A_NONE);
    quiet(mon, await artifact('Stormbringer'), 0);
});

test('ordinary chaotic species keeps its matching artifact', async () => {
    await setup();
    const mon = await monster(P.PM_HILL_GIANT);
    assert.ok(mon.data.maligntyp < 0 && mon.data.maligntyp !== C.A_NONE);
    quiet(mon, await artifact('Stormbringer'), 1);
});

test('artifact A_NONE bypasses alignment restriction', async () => {
    await setup();
    quiet(await roamer(C.A_NONE), await artifact('Frost Brand'), 1);
});

test('nonartifact has no alignment restriction', async () => {
    await setup();
    quiet(await roamer(C.A_LAWFUL), mksobj(ONAMES.LONG_SWORD, false, false), 1);
});

test('Excalibur keeps its monster role exception', async () => {
    await setup();
    quiet(await roamer(C.A_LAWFUL), await artifact('Excalibur'), 1);
});

test('foreign intelligent quest artifact still rejects matching monster alignment', async () => {
    await setup();
    quiet(await roamer(C.A_LAWFUL), await artifact('The Orb of Detection'), 0);
});

test('covetous monster bypasses role and alignment restrictions', async () => {
    await setup();
    const mon = await monster(P.PM_MASTER_LICH);
    assert.ok(is_covetous(mon.data));
    quiet(mon, await artifact('The Orb of Detection'), 1);
});

test('player-like monster bypasses role and alignment restrictions', async () => {
    await setup();
    const mon = await monster(P.PM_WIZARD);
    assert.ok(is_mplayer(mon.data));
    quiet(mon, await artifact('The Orb of Detection'), 1);
});

test('bane rejection survives the covetous exception', async () => {
    await setup();
    const mon = await monster(P.PM_ORCUS);
    assert.ok(is_covetous(mon.data));
    quiet(mon, await artifact('Demonbane'), 0);
});

test('non-intelligent artifact race does not add a monster class restriction', async () => {
    await setup();
    quiet(await roamer(C.A_CHAOTIC), await artifact('Grimtooth'), 1);
});

for (const alignment of [C.A_LAWFUL, C.A_NEUTRAL]) {
    test(`floor pickup preserves real object ownership at alignment ${alignment}`, async () => {
        await setup();
        const mon = await roamer(alignment);
        const obj = await artifact('Vorpal Blade');
        await place_object(obj, mon.mx, mon.my);
        clearMessages();
        seed(2);
        const allowed = alignment === C.A_NEUTRAL;
        assert.equal(can_touch_safely(mon, obj), allowed);
        assert.equal(can_carry(mon, obj), Number(allowed));
        assert.equal(await mpickstuff(mon), allowed);
        assert.equal(game.level.objects.includes(obj), !allowed);
        assert.equal(mon.minvent.includes(obj), allowed);
        assert.equal(obj.where, allowed ? C.OBJ_MINVENT : C.OBJ_FLOOR);
        assert.equal(messages().includes('picks up'), allowed);
        assert.deepEqual(getRngLog(), []);
    });
}

test('real monster weapon selection uses owned lawful alignment', async () => {
    await setup();
    const mon = await roamer(C.A_LAWFUL);
    const sword = await artifact('Excalibur');
    await mpickobj(mon, sword);
    quiet(mon, sword, 1);
    assert.equal(select_hwep(mon), sword);
    assert.deepEqual(getRngLog(), []);
});

test('forced monster insertion is not an eligibility test', async () => {
    await setup();
    const mon = await roamer(C.A_LAWFUL);
    const obj = await artifact('Vorpal Blade');
    quiet(mon, obj, 0);
    await mpickobj(mon, obj);
    assert.equal(mon.minvent.includes(obj), true);
    assert.equal(obj.where, C.OBJ_MINVENT);
    assert.equal(game.level.objects.includes(obj), false);
});

test('accepted async monster touch completes without feedback or damage', async () => {
    await setup();
    const mon = await roamer(C.A_LAWFUL);
    const obj = await artifact('Excalibur');
    clearMessages();
    seed(2);
    const hp = mon.mhp;
    assert.equal(await touch_artifact(obj, mon), 1);
    assert.equal(mon.mhp, hp);
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), []);
});

test('hero hold caller awaits real More before blast and refusal placement', async () => {
    const run = await setup();
    game.u.uhp = game.u.uhpmax = 200;
    const obj = await artifact('The Orb of Detection');
    clearMessages();
    await pline('A pending message fills the top line before artifact contact.');
    seed(2);
    let enter, release, timer;
    let complete = false;
    const waiting = new Promise(resolve => { enter = resolve; });
    run._display.clearInputQueue();
    run._display.onEmptyQueue = () => {
        enter();
        return new Promise(resolve => { release = resolve; });
    };
    const operation = hold_another_object(obj, null, null, null).then(result => {
        complete = true;
        return result;
    });
    try {
        await Promise.race([waiting, operation.then(() => {
            throw Error('expected a real pending More');
        }), new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error('More did not arrive')), 2000);
        })]);
        await setImmediate();
        assert.equal(complete, false);
        assert.equal(game.u.uhp, 200);
        assert.deepEqual(getRngLog(), []);
    } finally {
        clearTimeout(timer);
        run._display.onEmptyQueue = () => 32;
        release?.(32);
        assert.equal(await operation, obj);
    }
    assert.ok(game.u.uhp < 200 && game.u.uhp > 0);
    assert.match(messages(), /blasted by/);
    assert.match(messages(), /evades your grasp/);
    assert.equal(game.level.objects.includes(obj), true);
    assert.equal((game.invent || []).includes(obj), false);
});
