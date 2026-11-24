// C muse.c:2488 and worn.c:488, reached with real item/status producers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { setup, clearMessages, messages, seed } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { makemon } from '../js/makemon.js';
import { mksobj } from '../js/mkobj.js';
import { addinv, weight } from '../js/invent.js';
import { mpickobj } from '../js/steal.js';
import { m_dowear, mon_adjust_speed } from '../js/worn.js';
import { find_misc, use_misc, MUSE_POT_SPEED } from '../js/muse.js';
import { make_hallucinated, make_deaf } from '../js/potion.js';
import { oname } from '../js/do_name.js';
import { setuwep } from '../js/wield.js';
import { Hallucination } from '../js/youprop.js';
import { canseemon, pline } from '../js/display.js';
import { objdescr_is } from '../js/o_init.js';
import { getRngLog } from '../js/rng.js';
import { ONAMES as O } from '../js/objects_data.js';
import { PMNAMES as P } from '../js/monst_data.js';
import { ART_GRAYSWANDIR } from '../js/artilist_data.js';
import * as C from '../js/const.js';

async function prepare({ accessible = true, visible = true, deaf = false,
    slowed = false, count = 2, hallucinating = false, artifact = false,
    removeArtifact = false } = {}) {
    const run = await setup();
    let reads = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(++reads <= 30, `unexpected repeated prompt: ${game._toplines}`);
        return game._toplin === 3 ? 27 : 32;
    };
    game.stairs = null;
    const mon = await makemon(game.mons[P.PM_GOBLIN], 33, 10,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG
        | (visible ? 0 : C.MM_MINVIS));
    assert.ok(mon);
    mon.mpeaceful = 0;
    mon.mux = game.u.ux;
    mon.muy = game.u.uy;
    if (slowed)
        await mon_adjust_speed(mon, -1, null);
    const obj = mksobj(O.POT_SPEED, false, false);
    obj.quan = count;
    obj.owt = weight(obj);
    assert.equal(objdescr_is(obj, 'milky') || objdescr_is(obj, 'smoky'), false,
        'this ordinary potion does not enter the independent occupant precheck');
    await mpickobj(mon, obj);
    if (hallucinating)
        await make_hallucinated(100, false);
    let sword;
    if (artifact) {
        sword = mksobj(O.SILVER_SABER, false, false);
        await oname(sword, 'Grayswandir', C.ONAME_NO_FLAGS);
        await addinv(sword);
        await setuwep(sword);
        assert.equal(sword.oartifact, ART_GRAYSWANDIR);
        assert.equal(game.u.uwep, sword);
        assert.ok(game.u.uprops.HALLUC_RES & C.W_WEP);
        if (removeArtifact)
            await setuwep(null);
    }
    if (deaf)
        await make_deaf(100, false);
    game.flags.accessiblemsg = accessible;
    game.iflags.getpos_coords = 'm';
    clearMessages();
    seed(7);
    assert.equal(!!canseemon(mon), visible);
    assert.equal(game.objects[O.POT_SPEED].oc_name_known, 0);
    return { run, mon, obj, sword };
}

function select(mon, obj) {
    assert.equal(find_misc(mon), true);
    assert.equal(game.m.has_misc, MUSE_POT_SPEED);
    assert.equal(game.m.misc, obj);
}

for (const accessible of [false, true]) {
    for (const visible of [false, true]) {
        for (const deaf of [false, true]) {
            test(`speed potion: accessible=${accessible}, visible=${visible}, deaf=${deaf}`, async () => {
                const { mon, obj } = await prepare({ accessible, visible, deaf });
                select(mon, obj);
                assert.equal(await use_misc(mon), 2);
                assert.equal(mon.permspeed, C.MFAST);
                assert.equal(mon.mspeed, C.MFAST);
                assert.equal(obj.quan, 1);
                assert.equal(obj.where, C.OBJ_MINVENT);
                assert.equal(obj.owt, weight(obj));
                const output = messages();
                if (visible) {
                    const prefix = accessible ? '<33,10>: ' : '';
                    assert.match(output, new RegExp(`${prefix}The goblin drinks a .* potion!`));
                    assert.ok(output.includes(`${prefix}The goblin is suddenly moving faster.`), output);
                    assert.equal(obj.dknown, 1);
                    assert.equal(game.objects[O.POT_SPEED].oc_name_known, 1);
                    if (!accessible)
                        assert.doesNotMatch(output, /<33,10>:/);
                } else {
                    if (deaf)
                        assert.equal(output.trim(), '');
                    else
                        assert.match(output, /You hear a chugging sound\./);
                    assert.doesNotMatch(output, /<33,10>:|faster/);
                    assert.equal(obj.dknown, 0);
                    assert.equal(game.objects[O.POT_SPEED].oc_name_known, 0);
                }
                assert.deepEqual(getRngLog(), visible ? ['rn2(19)=3'] : [],
                    'visible discovery credits wisdom through the real learnwand chain');
                assert.deepEqual(game.a11y.msg_loc, { x: 0, y: 0 });
            });
        }
    }
}

for (const accessible of [false, true]) {
    test(`slowed drinker advances one stage, accessible=${accessible}`, async () => {
        const { mon, obj } = await prepare({ slowed: true, accessible });
        assert.equal(mon.permspeed, C.MSLOW);
        assert.equal(mon.mspeed, C.MSLOW);
        select(mon, obj);
        assert.equal(await use_misc(mon), 2);
        assert.equal(mon.permspeed, 0);
        assert.equal(mon.mspeed, 0);
        assert.equal(obj.quan, 1);
        assert.ok(messages().includes(`${accessible ? '<33,10>: ' : ''}The goblin is suddenly moving faster.`));
        assert.doesNotMatch(messages(), /much faster/);
        assert.deepEqual(getRngLog(), ['rn2(19)=3']);
    });
}

for (const wornBoots of [false, true]) {
    test(`already-fast selection rejects potion, worn boots=${wornBoots}`, async () => {
        const { mon, obj } = await prepare();
        if (wornBoots) {
            const boots = mksobj(O.SPEED_BOOTS, false, false);
            await mpickobj(mon, boots);
            assert.equal(m_dowear(mon, true), undefined,
                'ordinary fresh equipment setup remains synchronous');
            assert.ok(boots.owornmask & C.W_ARMF);
        } else {
            assert.equal(mon_adjust_speed(mon, 2, null), undefined,
                'creation speed adjustment remains synchronous and silent');
        }
        clearMessages();
        seed(7);
        assert.equal(mon.mspeed, C.MFAST);
        assert.equal(find_misc(mon), false);
        assert.equal(game.m.misc, null);
        assert.equal(game.m.has_misc, 0);
        assert.equal(obj.quan, 2);
        assert.ok(mon.minvent.includes(obj));
        assert.equal(messages().trim(), '');
        assert.deepEqual(getRngLog(), []);
    });
}

test('singleton potion is removed through canonical consumption after its effect', async () => {
    const { mon, obj } = await prepare({ count: 1 });
    select(mon, obj);
    assert.equal(await use_misc(mon), 2);
    assert.equal(mon.mspeed, C.MFAST);
    assert.equal((mon.minvent || []).includes(obj), false);
    assert.equal(obj.where, C.OBJ_DELETED);
    assert.ok(game.objs_deleted.includes(obj));
    assert.equal(game.objects[O.POT_SPEED].oc_name_known, 1);
});

for (const mode of ['active', 'artifact-resisted', 'artifact-removed']) {
    test(`real hallucination and artifact producers: ${mode}`, async () => {
        const resisted = mode === 'artifact-resisted';
        const { mon, obj } = await prepare({ hallucinating: true,
            artifact: mode !== 'active', removeArtifact: mode === 'artifact-removed' });
        assert.equal(!!Hallucination(), !resisted);
        assert.ok(game.u.intrinsic.HHallucination > 0);
        const displayBefore = structuredClone(game.dispCtx);
        select(mon, obj);
        assert.equal(await use_misc(mon), 2);
        assert.equal(mon.mspeed, C.MFAST);
        assert.equal(obj.quan, 1);
        assert.match(messages(), /<33,10>: .* drinks /);
        assert.match(messages(), /<33,10>: .* is suddenly moving faster\./);
        if (resisted) {
            assert.match(messages(), /The goblin drinks/);
            assert.equal(obj.dknown, 1);
            assert.equal(game.objects[O.POT_SPEED].oc_name_known, 1);
            assert.deepEqual(getRngLog(), ['rn2(19)=3']);
            assert.deepEqual(game.dispCtx, displayBefore);
        } else {
            assert.equal(obj.dknown, 0);
            assert.equal(game.objects[O.POT_SPEED].oc_name_known, 0);
            assert.deepEqual(getRngLog(), []);
            assert.notDeepEqual(game.dispCtx, displayBefore,
                'hallucinated names advance the separate display context');
        }
    });
}

async function holdMessage(run, start, inspect) {
    let enter, release, timer;
    let done = false;
    const waiting = new Promise(resolve => { enter = resolve; });
    run._display.onEmptyQueue = () => {
        enter();
        return new Promise(resolve => { release = resolve; });
    };
    const pending = start().then(result => { done = true; return result; });
    try {
        await Promise.race([waiting,
            pending.then(() => { throw Error('expected pending message'); }),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(Error('missing More prompt')), 2000);
            })]);
        await setImmediate();
        assert.equal(done, false);
        inspect();
    } finally {
        clearTimeout(timer);
        run._display.onEmptyQueue = () => 32;
        release?.(32);
        await pending;
    }
    return pending;
}

test('drinking waits before speed mutation, discovery and consumption', async () => {
    const { run, mon, obj } = await prepare();
    select(mon, obj);
    await pline('An earlier message leaves too little room for drinking feedback.');
    assert.equal(await holdMessage(run, () => use_misc(mon), () => {
        assert.equal(mon.permspeed, 0);
        assert.equal(mon.mspeed, 0);
        assert.equal(obj.quan, 2);
        assert.equal(obj.dknown, 1);
        assert.equal(obj.where, C.OBJ_MINVENT);
        assert.equal(game.objects[O.POT_SPEED].oc_name_known, 0);
        assert.deepEqual(getRngLog(), []);
    }), 2);
    assert.equal(mon.mspeed, C.MFAST);
    assert.equal(obj.quan, 1);
    assert.match(messages(), /<33,10>: The goblin drinks /);
});

test('speed effect waits before learning and consumption after the speed mutation', async () => {
    const { run, mon, obj } = await prepare();
    select(mon, obj);
    assert.equal(await holdMessage(run, () => use_misc(mon), () => {
        assert.equal(mon.permspeed, C.MFAST);
        assert.equal(mon.mspeed, C.MFAST);
        assert.equal(obj.quan, 2);
        assert.equal(obj.where, C.OBJ_MINVENT);
        assert.equal(game.objects[O.POT_SPEED].oc_name_known, 0);
        assert.match(game._toplines, /The goblin drinks /);
        assert.deepEqual(getRngLog(), [], 'discovery waits for the effect message');
    }), 2);
    assert.equal(obj.quan, 1);
    assert.equal(game.objects[O.POT_SPEED].oc_name_known, 1);
    assert.match(messages(), /<33,10>: The goblin is suddenly moving faster\./);
    assert.deepEqual(getRngLog(), ['rn2(19)=3']);
});

test('quiet pickup preference does not suppress the speed-effect message', async () => {
    const { mon, obj } = await prepare();
    game.flags.verbose = false;
    select(mon, obj);
    assert.equal(await use_misc(mon), 2);
    assert.match(messages(), /<33,10>: The goblin is suddenly moving faster\./);
    assert.equal(obj.quan, 1);
});
