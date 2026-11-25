// Constructed boundaries use the real form, equipment, damage and message owners.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { setup, clearMessages, messages, seed, x, y } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { polymon } from '../js/polyself.js';
import { makemon } from '../js/makemon.js';
import { hmonas } from '../js/uhitm.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { setworn } from '../js/worn.js';
import { Ring_on } from '../js/do_wear.js';
import { make_blinded } from '../js/potion.js';
import { christen_monst } from '../js/do_name.js';
import { pline } from '../js/display.js';
import { getRngLog } from '../js/rng.js';
import { PMNAMES as P } from '../js/monst_data.js';
import { ONAMES as O, OCLASSES, MATERIALS } from '../js/objects_data.js';
import * as C from '../js/const.js';

async function prepare(form, target = P.PM_SHADE) {
    const run = await setup();
    assert.equal(await polymon(form), 1);
    const mon = await makemon(game.mons[target], x + 1, y,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    Object.assign(mon, { mhp: 1000, mhpmax: 1000, msleeping: 1, mpeaceful: 0 });
    Object.assign(game.u, { dx: 1, dy: 0, uhitinc: 100 });
    game.bhitpos = { x: x + 1, y };
    game.notonhead = false;
    game.vis = false;
    clearMessages();
    seed(2);
    return { run, mon };
}

async function silverRing(slot) {
    const type = game.objects.findIndex(o => o.oc_class === OCLASSES.RING_CLASS
        && o.oc_material === MATERIALS.SILVER);
    assert.ok(type > 0);
    const ring = await addinv(mksobj(type, false, false));
    ring.dknown = 1;
    await setworn(ring, slot);
    await Ring_on(ring);
    return ring;
}

async function attack(mon) {
    clearMessages();
    seed(2);
    assert.equal(await hmonas(mon), true);
    assert.equal(game.vis, false, 'visibility belongs to the completed attack');
    assert.equal(game.twohits, 0);
}

test('shade immunity skips bite damage but still wakes the defender', async () => {
    const { mon } = await prepare(P.PM_WOLF);
    await attack(mon);
    assert.equal(mon.mhp, 1000);
    assert.equal(mon.msleeping, 0);
    assert.match(messages(), /Your bite passes harmlessly through/);
    assert.ok(!getRngLog().some(call => call.startsWith('d(2,4)=')));
});

for (const target of [P.PM_FOG_CLOUD, P.PM_RUST_MONSTER])
    test(`mimic contact preserves the solid/unsolid boundary for ${target}`, async () => {
        const { mon } = await prepare(P.PM_LARGE_MIMIC, target);
        await attack(mon);
        if (target === P.PM_FOG_CLOUD) {
            assert.equal(mon.mhp, 1000);
            assert.equal(game.u.ustuck, null);
            assert.match(messages(), /adhere attempt passes right through/);
            assert.ok(!getRngLog().some(call => call.startsWith('d(3,4)=')));
        } else {
            assert.ok(mon.mhp < 1000);
            assert.equal(game.u.ustuck, mon);
            assert.doesNotMatch(messages(), /passes right through/);
        }
    });

for (const rings of [0, 1, 2])
    test(`alternating claws carry the silver mask from ${rings} rings`, async () => {
        const { mon } = await prepare(P.PM_FLESH_GOLEM);
        if (rings > 0) await silverRing(C.W_RINGR);
        if (rings > 1) await silverRing(C.W_RINGL);
        await attack(mon);
        assert.equal((messages().match(/silver ring sears/g) || []).length, rings);
        assert.equal((messages().match(/attack passes harmlessly through/g) || []).length, 2 - rings);
        assert.equal(mon.mhp < 1000, rings > 0);
    });

test('unblessed gloves prevent contact with either silver ring', async () => {
    const { mon } = await prepare(P.PM_FLESH_GOLEM);
    await silverRing(C.W_RINGR);
    await silverRing(C.W_RINGL);
    const gloves = await addinv(mksobj(O.LEATHER_GLOVES, false, false));
    await setworn(gloves, C.W_ARMG);
    await attack(mon);
    assert.equal(mon.mhp, 1000);
    assert.doesNotMatch(messages(), /silver ring/);
});

for (const verbose of [true, false])
    test(`silver feedback follows verbose=${verbose} without suppressing damage`, async () => {
        const { mon } = await prepare(P.PM_FLESH_GOLEM);
        await silverRing(C.W_RINGR);
        game.flags.verbose = verbose;
        await attack(mon);
        assert.ok(mon.mhp < 1000);
        assert.equal(messages().includes('silver ring sears'), verbose);
    });

test('a blessed flimsy helmet supplies head-butt damage against a shade', async () => {
    const { mon } = await prepare(P.PM_MINOTAUR);
    const helmet = await addinv(mksobj(O.CORNUTHAUM, false, false));
    helmet.blessed = 1;
    await setworn(helmet, C.W_ARMH);
    await attack(mon);
    assert.ok(mon.mhp < 1000);
    assert.match(messages(), /You head butt/);
    assert.ok(getRngLog().some(call => call.startsWith('rnd(4)=')));
});

test('a rope-golem grasp retains silver feedback after two claw attempts', async () => {
    const { mon } = await prepare(P.PM_ROPE_GOLEM);
    await silverRing(C.W_RINGR);
    await attack(mon);
    assert.equal((messages().match(/silver ring sears/g) || []).length, 2);
    assert.match(messages(), /You grasp/);
    assert.equal(game.u.ustuck, null, 'a successful shade grasp never holds it');
});

test('a nearby unseen defender still sets attack visibility until More completes', async () => {
    const { run, mon } = await prepare(P.PM_WOLF);
    await make_blinded(100, false);
    christen_monst(mon, 'an exceptionally long named shade for suspended feedback');
    clearMessages();
    await pline('A long opening message occupies this line before the attack begins.');
    let entered, release, timer, finished = false;
    const waiting = new Promise(resolve => { entered = resolve; });
    run._display.onEmptyQueue = () => { entered(); return new Promise(resolve => { release = resolve; }); };
    const operation = hmonas(mon).then(() => { finished = true; });
    try {
        await Promise.race([waiting, operation.then(() => { throw Error('no pending More'); }),
            new Promise((_, reject) => { timer = setTimeout(() => reject(Error('More timeout')), 2000); })]);
        await setImmediate();
        assert.equal(finished, false);
        assert.equal(game.vis, true);
        assert.equal(mon.mhp, 1000);
    } finally {
        clearTimeout(timer);
        run._display.onEmptyQueue = () => 32;
        if (release) release(32);
        await operation;
    }
    assert.equal(game.vis, false);
    assert.equal(mon.mhp, 1000);
});
