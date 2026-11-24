// C artifact.c:908 touch_artifact. Real object, inventory and mimic callers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { setup, seed, clearMessages, messages, x, y } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { touch_artifact, touch_artifact_mon } from '../js/artifact.js';
import { makemon } from '../js/makemon.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { oname } from '../js/do_name.js';
import { addinv } from '../js/invent.js';
import { mpickobj, maybe_absorb_item } from '../js/steal.js';
import { pick_lock } from '../js/lock.js';
import { set_levltyp } from '../js/mkmaze.js';
import { is_door_mappear } from '../js/monst.js';
import { pline, newsym } from '../js/display.js';
import { getRngLog } from '../js/rng.js';
import { artifact_names, artifact_otyps } from '../js/artilist_data.js';
import { PMNAMES as P } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import * as C from '../js/const.js';

async function artifact(name) {
    const index = artifact_names.indexOf(name);
    assert.ok(index > 0);
    const obj = mksobj(ONAMES[artifact_otyps[index]], false, false);
    assert.equal(await oname(obj, name, C.ONAME_WISH), obj);
    assert.equal(obj.oartifact, index);
    return obj;
}
async function monster(species = P.PM_SMALL_MIMIC) {
    const mon = await makemon(game.mons[species], x + 1, y,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    assert.ok(mon);
    return mon;
}
function state(obj, mon) {
    return { where: obj.where, id: obj.o_id, quantity: obj.quan,
        worn: obj.owornmask || 0, unpaid: !!obj.unpaid,
        hero: (game.invent || []).includes(obj), floor: game.level.objects.includes(obj),
        monster: (mon.minvent || []).includes(obj), heroHP: game.u.uhp, monsterHP: mon.mhp };
}

for (const owner of ['free', 'hero', 'floor', 'monster']) {
    test(`rejected monster touch is silent and retains ${owner} ownership`, async () => {
        await setup();
        const mon = await monster();
        const obj = await artifact('Excalibur');
        if (owner === 'hero')
            assert.equal(await addinv(obj), obj);
        else if (owner === 'floor')
            await place_object(obj, x, y);
        else if (owner === 'monster')
            await mpickobj(mon, obj);
        const before = state(obj, mon);
        clearMessages();
        seed();
        const operation = touch_artifact(obj, mon);
        assert.ok(operation instanceof Promise);
        assert.equal(await operation, 0);
        assert.equal(messages(), '');
        assert.deepEqual(getRngLog(), []);
        assert.deepEqual(state(obj, mon), before);
    });
}

for (const item of ['Frost Brand', 'ordinary', 'The Orb of Detection']) {
    test(`accepted async touch remains silent: ${item}`, async () => {
        await setup();
        const mon = await monster(item === 'The Orb of Detection' ? P.PM_MASTER_LICH : P.PM_SMALL_MIMIC);
        const obj = item === 'ordinary' ? mksobj(ONAMES.SKELETON_KEY, false, false) : await artifact(item);
        const before = state(obj, mon);
        clearMessages();
        seed();
        assert.equal(await touch_artifact(obj, mon), 1);
        assert.equal(messages(), '');
        assert.deepEqual(getRngLog(), []);
        assert.deepEqual(state(obj, mon), before);
    });
}

test('quiet monster predicate keeps its synchronous refusal contract', async () => {
    await setup();
    const mon = await monster();
    const obj = await artifact('Excalibur');
    clearMessages();
    seed();
    const result = touch_artifact_mon(obj, mon);
    assert.equal(result, 0);
    assert.ok(!(result instanceof Promise));
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), []);
});

for (const carried of [false, true]) {
    test(`real absorption refuses silently, carried=${carried}`, async () => {
        await setup();
        const mon = await monster();
        const obj = await artifact('Excalibur');
        if (carried)
            await addinv(obj);
        const before = state(obj, mon);
        clearMessages();
        seed();
        assert.equal(await maybe_absorb_item(mon, obj, 100, 100), undefined);
        assert.equal(messages(), '');
        assert.deepEqual(getRngLog(), ['rn2(100)=33']);
        assert.deepEqual(state(obj, mon), before);
    });
}

for (const item of ['ordinary', 'Frost Brand']) {
    test(`accepted absorption transfers the real carried object: ${item}`, async () => {
        await setup();
        const mon = await monster();
        const obj = item === 'ordinary' ? mksobj(ONAMES.SKELETON_KEY, false, false) : await artifact(item);
        await addinv(obj);
        clearMessages();
        seed();
        await maybe_absorb_item(mon, obj, 100, 100);
        assert.equal((game.invent || []).includes(obj), false);
        assert.equal(mon.minvent.includes(obj), true);
        assert.equal(obj.where, C.OBJ_MINVENT);
        assert.match(messages(), /absorbs/);
        assert.doesNotMatch(messages(), /evades|beyond your control|blasted/);
        assert.deepEqual(getRngLog(), ['rn2(100)=33']);
    });
}

test('protected invocation object stops before resistance RNG and touch', async () => {
    await setup();
    const mon = await monster();
    const obj = mksobj(ONAMES.BELL_OF_OPENING, false, false);
    const before = state(obj, mon);
    clearMessages();
    seed();
    await maybe_absorb_item(mon, obj, 100, 100);
    assert.deepEqual(getRngLog(), []);
    assert.equal(messages(), '');
    assert.deepEqual(state(obj, mon), before);
});

test('resisted artifact stops before touch feedback', async () => {
    await setup();
    const mon = await monster();
    const obj = await artifact('Excalibur');
    const before = state(obj, mon);
    clearMessages();
    seed();
    await maybe_absorb_item(mon, obj, 0, 0);
    assert.deepEqual(getRngLog(), ['rn2(100)=33']);
    assert.equal(messages(), '');
    assert.deepEqual(state(obj, mon), before);
});

for (const accepted of [false, true]) {
    test(`monster touch does not request More over pending text, accepted=${accepted}`, async () => {
        const run = await setup();
        const mon = await monster();
        const obj = await artifact(accepted ? 'Frost Brand' : 'Excalibur');
        clearMessages();
        await pline('A pending message occupies the top line before monster artifact contact.');
        const before = messages();
        run._display.clearInputQueue();
        run._display.onEmptyQueue = () => { throw Error('monster touch requested input'); };
        seed();
        assert.equal(await touch_artifact(obj, mon), Number(accepted));
        assert.equal(messages(), before);
        assert.deepEqual(getRngLog(), []);
    });
}

async function suspendAtMore(run, start, whileWaiting) {
    let arrived, release, timer;
    let complete = false;
    const waiting = new Promise(resolve => { arrived = resolve; });
    run._display.clearInputQueue();
    run._display.onEmptyQueue = () => {
        arrived();
        return new Promise(resolve => { release = resolve; });
    };
    const operation = start().then(value => {
        complete = true;
        return value;
    });
    try {
        await Promise.race([waiting, operation.then(() => {
            throw Error('expected a real pending More');
        }), new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error('More did not arrive')), 2000);
        })]);
        await setImmediate();
        assert.equal(complete, false);
        whileWaiting();
    } finally {
        clearTimeout(timer);
        run._display.onEmptyQueue = () => 32;
        release?.(32);
    }
    return await operation;
}

test('real pick_lock waits for mimic discovery before silent artifact refusal', async () => {
    const run = await setup();
    assert.equal(set_levltyp(x + 1, y, C.DOOR), true);
    game.level.at(x + 1, y).doormask = C.D_CLOSED;
    const mon = await monster();
    assert.equal(is_door_mappear(mon), true);
    newsym(mon.mx, mon.my);
    const obj = await artifact('The Master Key of Thievery');
    await addinv(obj);
    clearMessages();
    await pline('A pending message occupies the top line before checking this door.');
    seed(11); // Real first resistance draw is 90, passing the artifact threshold.
    const result = await suspendAtMore(run, () => pick_lock(obj, x + 1, y, null), () => {
        assert.equal(is_door_mappear(mon), true);
        assert.equal((game.invent || []).includes(obj), true);
        assert.deepEqual(getRngLog(), []);
    });
    assert.equal(result, -1);
    assert.equal(is_door_mappear(mon), false);
    assert.equal((game.invent || []).includes(obj), true);
    assert.equal((mon.minvent || []).includes(obj), false);
    assert.equal(obj.where, C.OBJ_INVENT);
    assert.doesNotMatch(messages(), /evades|beyond your control|blasted/);
    assert.deepEqual(getRngLog(), ['rn2(100)=90']);
});

test('hero carried refusal still awaits blast before damage and control feedback', async () => {
    const run = await setup();
    game.u.uhp = game.u.uhpmax = 200;
    const obj = await artifact('The Orb of Detection');
    await addinv(obj);
    clearMessages();
    await pline('A pending message occupies the top line before hero artifact contact.');
    seed();
    const result = await suspendAtMore(run, () => touch_artifact(obj, game.youmonst), () => {
        assert.equal(game.u.uhp, 200);
        assert.deepEqual(getRngLog(), []);
        assert.equal((game.invent || []).includes(obj), true);
    });
    assert.equal(result, 0);
    assert.ok(game.u.uhp > 0 && game.u.uhp < 200);
    assert.match(messages(), /blasted by/);
    assert.match(messages(), /beyond your control/);
    assert.equal(obj.where, C.OBJ_INVENT);
    assert.equal(game.level.objects.includes(obj), false);
});
