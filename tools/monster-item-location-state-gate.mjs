// C muse.c:293 and mon.c:1847, reached through real item-use and pickup helpers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { setup, clearMessages, messages, seed } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { makemon } from '../js/makemon.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { weight } from '../js/invent.js';
import { mpickobj } from '../js/steal.js';
import { mpickstuff } from '../js/mon.js';
import { find_defensive, use_defensive } from '../js/muse.js';
import { makeknown, observe_object } from '../js/o_init.js';
import { potionhit, make_deaf, make_blinded } from '../js/potion.js';
import { canseemon, pline } from '../js/display.js';
import { cansee } from '../js/vision.js';
import { getRngLog } from '../js/rng.js';
import { ONAMES as O } from '../js/objects_data.js';
import { PMNAMES as P } from '../js/monst_data.js';
import * as C from '../js/const.js';

async function prepare({ accessible = true, visible = true, deaf = false,
    verbose = true, blind = false, floor = false } = {}) {
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
    const obj = mksobj(O.POT_HEALING, false, false);
    obj.quan = 2;
    obj.owt = weight(obj);
    makeknown(obj.otyp);
    if (floor) {
        await place_object(obj, 33, 10);
    } else {
        await mpickobj(mon, obj);
        await potionhit(mon, mksobj(O.POT_CONFUSION, false, false), C.POTHIT_OTHER_THROW);
        assert.ok(mon.mhp < mon.mhpmax, 'real potion impact wounds the drinker');
    }
    if (deaf)
        await make_deaf(100, false);
    if (blind)
        await make_blinded(100, false);
    game.flags.accessiblemsg = accessible;
    game.flags.verbose = verbose;
    game.iflags.getpos_coords = 'm';
    clearMessages();
    seed(7);
    return { run, mon, obj };
}

for (const accessible of [false, true]) {
    for (const visible of [false, true]) {
        for (const deaf of [false, true]) {
            test(`drinking: accessible=${accessible}, visible=${visible}, deaf=${deaf}`, async () => {
                const { mon, obj } = await prepare({ accessible, visible, deaf });
                assert.equal(!!canseemon(mon), visible);
                const hp = mon.mhp;
                assert.equal(find_defensive(mon, false), true);
                assert.equal(game.m.defensive, obj);
                assert.equal(await use_defensive(mon), 2);
                assert.ok(mon.mhp > hp);
                assert.equal(obj.quan, 1, 'one potion consumed from a real stack');
                assert.equal(obj.where, C.OBJ_MINVENT);
                const output = messages();
                if (visible) {
                    assert.ok(output.includes(`${accessible ? '<33,10>: ' : ''}The goblin drinks a potion of healing!`), output);
                    assert.equal(obj.dknown, 1);
                } else if (!deaf) {
                    assert.match(output, /You hear a chugging sound\./);
                    assert.doesNotMatch(output, /<33,10>:/);
                    assert.equal(obj.dknown, 0);
                } else {
                    assert.equal(output.trim(), '');
                    assert.equal(obj.dknown, 0);
                }
                assert.deepEqual(game.a11y.msg_loc, { x: 0, y: 0 });
            });
        }
    }
}

for (const accessible of [false, true]) {
    for (const verbose of [false, true]) {
        test(`pickup: accessible=${accessible}, verbose=${verbose}`, async () => {
            const { mon, obj } = await prepare({ accessible, verbose, floor: true });
            assert.equal(obj.dknown, 0);
            assert.equal(await mpickstuff(mon), true);
            assert.equal(obj.where, C.OBJ_MINVENT);
            assert.ok(mon.minvent.includes(obj));
            assert.equal(game.level.objectAt(33, 10), null);
            assert.equal(obj.dknown, 1, 'distant_name still observes nearby items when quiet');
            assert.ok(mon.misc_worn_check & C.I_SPECIAL);
            if (verbose)
                assert.ok(messages().includes(`${accessible ? '<33,10>: ' : ''}The goblin picks up 2 potions of healing.`), messages());
            else
                assert.equal(messages().trim(), '');
            assert.deepEqual(getRngLog(), []);
            assert.deepEqual(game.a11y.msg_loc, { x: 0, y: 0 });
        });
    }
}

test('pickup message uses visible square even when its monster is invisible', async () => {
    const { mon, obj } = await prepare({ visible: false, floor: true });
    assert.equal(!!cansee(33, 10), true);
    assert.equal(!!canseemon(mon), false);
    assert.equal(await mpickstuff(mon), true);
    assert.match(messages(), /<33,10>: .* picks up 2 potions of healing\./);
    assert.equal(obj.where, C.OBJ_MINVENT);
});

test('unseen square pickup transfers ownership without feedback', async () => {
    const { mon, obj } = await prepare({ blind: true, floor: true });
    assert.equal(!!cansee(33, 10), false);
    assert.equal(await mpickstuff(mon), true);
    assert.equal(messages().trim(), '');
    assert.equal(obj.where, C.OBJ_MINVENT);
    assert.equal(obj.dknown, 0);
});

async function withPendingMessage(run, start, inspect) {
    await pline('An earlier message leaves too little room for the next item message.');
    let enter, release, timer, settled = false;
    const waiting = new Promise(resolve => { enter = resolve; });
    run._display.onEmptyQueue = () => {
        enter();
        return new Promise(resolve => { release = resolve; });
    };
    const pending = start().then(value => { settled = true; return value; });
    try {
        await Promise.race([waiting, pending.then(() => { throw Error('no pending message'); }),
            new Promise((_, reject) => { timer = setTimeout(() => reject(Error('missing More')), 2000); })]);
        await setImmediate();
        assert.equal(settled, false);
        inspect();
    } finally {
        clearTimeout(timer);
        run._display.onEmptyQueue = () => 32;
        release?.(32);
        await pending;
    }
    return pending;
}

test('drinking waits after observation and before healing or consumption', async () => {
    const { run, mon, obj } = await prepare();
    const hp = mon.mhp;
    assert.equal(find_defensive(mon, false), true);
    assert.equal(await withPendingMessage(run, () => use_defensive(mon), () => {
        assert.equal(obj.dknown, 1);
        assert.equal(obj.quan, 2, 'singular naming restores the quantity before waiting');
        assert.equal(obj.where, C.OBJ_MINVENT);
        assert.equal(mon.mhp, hp);
        assert.ok(!getRngLog().some(call => /^d\(6,4\)/.test(call)));
    }), 2);
    assert.equal(obj.quan, 1);
    assert.match(messages(), /<33,10>: The goblin drinks a potion of healing!/);
});

test('pickup waits after naming and before floor extraction or gear scheduling', async () => {
    const { run, mon, obj } = await prepare({ floor: true });
    const worn = mon.misc_worn_check;
    assert.equal(await withPendingMessage(run, () => mpickstuff(mon), () => {
        assert.equal(obj.dknown, 1);
        assert.equal(obj.where, C.OBJ_FLOOR);
        assert.equal(game.level.objectAt(33, 10), obj);
        assert.equal((mon.minvent || []).includes(obj), false);
        assert.equal(mon.misc_worn_check, worn);
    }), true);
    assert.equal(obj.where, C.OBJ_MINVENT);
    assert.match(messages(), /<33,10>: The goblin picks up 2 potions of healing\./);
});

test('ordinary pickup still merges into a real carried stack after its feedback', async () => {
    const { mon, obj } = await prepare({ floor: true });
    const carried = mksobj(O.POT_HEALING, false, false);
    observe_object(carried);
    await mpickobj(mon, carried);
    assert.equal(await mpickstuff(mon), true);
    assert.equal(carried.quan, 3);
    assert.equal(obj.where, C.OBJ_DELETED);
    assert.ok(game.objs_deleted.includes(obj));
    assert.equal(game.level.objectAt(33, 10), null);
    assert.match(messages(), /<33,10>: The goblin picks up 2 potions of healing\./);
});
