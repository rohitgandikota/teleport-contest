// Source-state controls for muse.c:238 mreadmsg, reached through real callers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { setup, clearMessages, messages, seed } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { makemon } from '../js/makemon.js';
import { mksobj, curse } from '../js/mkobj.js';
import { mpickobj } from '../js/steal.js';
import { potionhit, make_hallucinated, make_deaf, set_itimeout } from '../js/potion.js';
import { find_defensive, use_defensive, find_offensive, use_offensive } from '../js/muse.js';
import { canseemon, sensemon, glyph_is_invisible_at, pline } from '../js/display.js';
import { makeknown } from '../js/o_init.js';
import { getRngLog } from '../js/rng.js';
import { PMNAMES as P } from '../js/monst_data.js';
import { ONAMES as O } from '../js/objects_data.js';
import * as C from '../js/const.js';

async function prepare({ visible = true, sensed = false, confused = false,
    hallucinating = false, deaf = false, female = false, accessible = false,
    known = true, type = O.SCR_TELEPORTATION } = {}) {
    const run = await setup();
    let reads = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(++reads <= 30, `unexpected repeated prompt: ${game._toplines}`);
        return game._toplin === 3 ? 27 : 32;
    };
    game.stairs = null;
    const mon = await makemon(game.mons[P.PM_GOBLIN], 33, 10,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG
        | (visible ? 0 : C.MM_MINVIS) | (female ? C.MM_FEMALE : C.MM_MALE));
    assert.ok(mon);
    mon.mpeaceful = 0;
    mon.mux = game.u.ux;
    mon.muy = game.u.uy;
    // A real carried Amulet blocks cursed scroll migration after the message.
    // No teleport, death, or RNG helper is replaced.
    await mpickobj(mon, mksobj(O.AMULET_OF_YENDOR, false, false));
    const obj = mksobj(type, false, false);
    if (type === O.SCR_TELEPORTATION)
        curse(obj);
    await mpickobj(mon, obj);
    if (confused) {
        await potionhit(mon, mksobj(O.POT_CONFUSION, false, false), C.POTHIT_OTHER_THROW);
        assert.equal(mon.mconf, 1, 'real potion impact confuses the reader');
    }
    if (known)
        makeknown(type);
    if (sensed)
        set_itimeout('HDetect_monsters', 100);
    if (hallucinating)
        await make_hallucinated(100, false);
    if (deaf)
        await make_deaf(100, false);
    game.flags.accessiblemsg = accessible;
    game.iflags.getpos_coords = 'm';
    clearMessages();
    seed(7);
    assert.equal(!!canseemon(mon), visible);
    assert.equal(!!sensemon(mon), sensed);
    return { run, mon, obj };
}

async function readScroll(mon, obj) {
    assert.equal(find_defensive(mon, true), true);
    assert.equal(game.m.defensive, obj, 'selection uses the real carried scroll');
    const result = await use_defensive(mon);
    assert.equal(result, 2, 'reading spends the action even when teleport is blocked');
    assert.equal(mon.minvent.includes(obj), false);
    assert.equal(obj.where, C.OBJ_DELETED, 'canonical consumption stages the detached scroll');
    assert.ok(game.objs_deleted.includes(obj));
    assert.deepEqual([mon.mx, mon.my], [33, 10]);
    assert.deepEqual(game.a11y.msg_loc, { x: 0, y: 0 });
    return messages();
}

for (const accessible of [false, true]) {
    for (const deaf of [false, true]) {
        test(`visible reading: accessibility=${accessible}, deaf=${deaf}`, async () => {
            const { mon, obj } = await prepare({ accessible, deaf });
            const output = await readScroll(mon, obj);
            assert.ok(output.includes(`${accessible ? '<33,10>: ' : ''}The goblin reads a scroll of teleportation!`), output);
            if (!accessible)
                assert.ok(!output.includes('<33,10>:'), output);
            assert.deepEqual(getRngLog(), ['rn2(3)=1', 'rn2(5)=4', 'rn2(3)=0']);
        });
    }
}

for (const female of [false, true]) {
    test(`sensed invisible confused reader uses ${female ? 'she' : 'he'}`, async () => {
        const { mon, obj } = await prepare({ visible: false, sensed: true, confused: true, female });
        const output = await readScroll(mon, obj);
        assert.ok(output.includes(`Being confused, ${female ? 'she' : 'he'} mispronounces the magic words...`), output);
        assert.ok(output.includes('You hear a goblin reading a scroll of teleportation.'), output);
        assert.deepEqual(getRngLog(), ['rn2(3)=1', 'rn2(5)=4', 'rn2(3)=0']);
    });
}

test('unseen and unsensed confused reader remains it without a pronoun draw', async () => {
    const { mon, obj } = await prepare({ visible: false, confused: true });
    const output = await readScroll(mon, obj);
    assert.ok(output.includes('Being confused, it mispronounces the magic words...'), output);
    assert.equal(glyph_is_invisible_at(33, 10), true, 'audible nearby reader leaves real map memory');
    assert.deepEqual(getRngLog(), ['rn2(3)=1', 'rn2(5)=4', 'rn2(3)=0']);
});

test('unseen hallucinated confusion draws mhe before the teleport-level decision', async () => {
    const { mon, obj } = await prepare({ visible: false, confused: true, hallucinating: true });
    const output = await readScroll(mon, obj);
    assert.ok(output.includes('Being confused, she mispronounces the magic words...'), output);
    assert.deepEqual(getRngLog(), ['rn2(3)=1', 'rn2(2)=0', 'rn2(4)=1', 'rn2(5)=0']);
});

test('hallucinated reader without confusion spends no pronoun draw', async () => {
    const { mon, obj } = await prepare({ visible: false, hallucinating: true });
    const output = await readScroll(mon, obj);
    assert.ok(!output.includes('Being confused'), output);
    assert.equal(getRngLog().some(call => call.startsWith('rn2(4)=')), false);
});

test('unseen deaf confused reader gives no feedback or hallucination draw', async () => {
    const { mon, obj } = await prepare({ visible: false, deaf: true, confused: true,
        hallucinating: true, known: false });
    const output = await readScroll(mon, obj);
    assert.equal(output.trim(), '');
    assert.equal(obj.dknown, 0);
    assert.deepEqual(getRngLog(), ['rn2(3)=1', 'rn2(5)=4', 'rn2(3)=0']);
});

test('audible unknown scroll becomes observed and uses attempting to incant', async () => {
    const { run, mon, obj } = await prepare({ visible: false, confused: true, known: false });
    const heard = [];
    run._display.onEmptyQueue = () => {
        heard.push(game._toplines, game._pending_message);
        return game._toplin === 3 ? 27 : 32;
    };
    await readScroll(mon, obj);
    const output = [...heard, messages()].join('\n');
    assert.match(output, /You hear someone attempting to incant XOR OTA\./);
    assert.equal(obj.dknown, 1);
    assert.equal(game.objects[obj.otyp].oc_encountered, 1);
    assert.equal(game.objects[obj.otyp].oc_name_known, 0, 'canceling a call prompt does not identify');
});

test('visible confused reading retains the monster name, not a pronoun', async () => {
    const { mon, obj } = await prepare({ confused: true, accessible: true });
    const output = await readScroll(mon, obj);
    assert.ok(output.includes('Being confused, the goblin mispronounces the magic words...'), output);
    assert.equal(getRngLog().some(call => call.startsWith('rn2(4)=')), false);
});

test('defensive reading waits before migration, naming and final scroll disposal', async () => {
    const { run, mon, obj } = await prepare({ accessible: true });
    assert.equal(find_defensive(mon, true), true);
    await pline('An earlier message leaves too little room for the scroll reading message.');
    let enter, release, timer, settled = false;
    const waiting = new Promise(resolve => { enter = resolve; });
    run._display.onEmptyQueue = () => {
        enter();
        return new Promise(resolve => { release = resolve; });
    };
    const before = getRngLog().slice();
    const pending = use_defensive(mon).then(result => { settled = true; return result; });
    try {
        await Promise.race([waiting, pending.then(() => { throw Error('no pending message'); }),
            new Promise((_, reject) => { timer = setTimeout(() => reject(Error('missing More prompt')), 2000); })]);
        await setImmediate();
        assert.equal(settled, false);
        assert.equal(obj.where, C.OBJ_FREE, 'C extracts teleport scroll before reading');
        assert.equal(mon.minvent.includes(obj), false);
        assert.equal((game.objs_deleted || []).includes(obj), false);
        assert.deepEqual([mon.mx, mon.my], [33, 10]);
        assert.deepEqual(getRngLog(), before, 'no level-teleport decision before acknowledgement');
    } finally {
        clearTimeout(timer);
        run._display.onEmptyQueue = () => 32;
        release?.(32);
        await pending;
    }
    assert.equal(await pending, 2);
    assert.equal(obj.where, C.OBJ_DELETED);
    assert.match(messages(), /<33,10>: The goblin reads/);
});

test('offensive earth scroll shares location-aware reading without changing disposal order', async () => {
    const { mon, obj } = await prepare({ accessible: true, confused: true, type: O.SCR_EARTH });
    // A blessed scroll leaves its reader's square empty. Confusion produces rocks.
    obj.blessed = 1;
    mon.mhp = mon.mhpmax = 50;
    game.u.ux = mon.mux = 32;
    game.u.uhp = game.u.uhpmax = 100;
    assert.equal(find_offensive(mon), true);
    assert.equal(game.m.offensive, obj);
    assert.equal(await use_offensive(mon), 2);
    assert.match(messages(), /<33,10>: The goblin reads a scroll of earth!/);
    assert.equal(obj.where, C.OBJ_DELETED);
    assert.equal(mon.minvent.includes(obj), false);
    assert.equal(game.level.objectAt(33, 10), null);
});

test('ordinary wounded selection reaches reading without the no-moves escape override', async () => {
    const { mon, obj } = await prepare({ confused: true });
    assert.ok(mon.mhp < mon.mhpmax && mon.mhp < 10);
    assert.equal(find_defensive(mon, false), true);
    assert.equal(game.m.defensive, obj);
    assert.equal(await use_defensive(mon), 2);
    assert.equal(obj.where, C.OBJ_DELETED);
});

test('create-monster scroll waits with inventory intact, then creates and consumes', async () => {
    const { run, mon, obj } = await prepare({ accessible: true, type: O.SCR_CREATE_MONSTER });
    assert.equal(find_defensive(mon, true), true);
    assert.equal(game.m.defensive, obj);
    await pline('An earlier message leaves too little room for the scroll reading message.');
    const count = game.level.monsters.length;
    let enter, release, timer;
    const waiting = new Promise(resolve => { enter = resolve; });
    run._display.onEmptyQueue = () => {
        enter();
        return new Promise(resolve => { release = resolve; });
    };
    const pending = use_defensive(mon);
    try {
        await Promise.race([waiting, pending.then(() => { throw Error('no pending message'); }),
            new Promise((_, reject) => { timer = setTimeout(() => reject(Error('missing More prompt')), 2000); })]);
        assert.equal(mon.minvent.includes(obj), true);
        assert.equal(obj.where, C.OBJ_MINVENT);
        assert.equal(game.level.monsters.length, count);
        assert.match(getRngLog().at(-1), /^rn2\(73\)=[1-9][0-9]*$/,
            'the ordinary count draw precedes reading and takes the one-monster branch');
    } finally {
        clearTimeout(timer);
        run._display.onEmptyQueue = () => 32;
        release?.(32);
        await pending;
    }
    assert.equal(await pending, 2);
    // NO_MM_FLAGS permits makemon to add the selected species' group too.
    assert.ok(game.level.monsters.length > count);
    assert.equal(obj.where, C.OBJ_DELETED);
    assert.match(messages(), /<33,10>: The goblin reads a scroll of create monster!/);
});
