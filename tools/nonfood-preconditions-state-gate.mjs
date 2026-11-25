// Normal-import controls through real selection, status and object owners.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { setup, seed, clearMessages, messages, x, y } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { doeat, is_edible } from '../js/eat.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { addinv, weight } from '../js/invent.js';
import { polymon } from '../js/polyself.js';
import { setuwep } from '../js/wield.js';
import { setworn } from '../js/worn.js';
import { Ring_on } from '../js/do_wear.js';
import { cmdq_add_key } from '../js/cmd.js';
import { init_objects, makeknown } from '../js/o_init.js';
import { getRngLog, rn2, rnd } from '../js/rng.js';
import { pline } from '../js/display.js';
import { ONAMES, MATERIALS } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { CQ_CANNED, ECMD_TIME, OBJ_FLOOR, OBJ_INVENT, W_RINGL, TIMEOUT } from '../js/const.js';

async function fixture({ floor = false, quantity = 1, wielded = false,
    cursed = false, ring = false, form = PMNAMES.PM_RUST_MONSTER } = {}) {
    const run = await setup();
    if (ring) {
        seed(3);
        init_objects();
        assert.equal(game.objects[ONAMES.RIN_SLOW_DIGESTION].oc_material, MATERIALS.IRON);
    }
    assert.equal(await polymon(form), 1);
    const obj = mksobj(ring ? ONAMES.RIN_SLOW_DIGESTION : ONAMES.DAGGER, false, false);
    Object.assign(obj, { quan: quantity, oerodeproof: 1, cursed: +cursed, rknown: 0 });
    obj.owt = weight(obj);
    if (floor)
        await place_object(obj, x, y);
    else
        await addinv(obj);
    if (wielded)
        await setuwep(obj);
    if (ring && cursed) {
        await setworn(obj, W_RINGL);
        await Ring_on(obj);
    }
    clearMessages();
    run._display.clearInputQueue();
    game.command_queue = [];
    if (floor)
        run._display.pushKey(121);
    else
        cmdq_add_key(CQ_CANNED, obj.invlet);
    seed(3);
    if (quantity > 1)
        rnd(2); // C next_ident() during splitobj().
    const stun = rn2(10);
    const rng = [...getRngLog()];
    seed(3);
    return { run, obj, stun, rng };
}

for (const floor of [false, true]) {
    for (const quantity of [1, 3]) {
        test(`rustproof rejection keeps C stack identity, floor=${floor}, quantity=${quantity}`, async () => {
            const { obj, stun, rng } = await fixture({ floor, quantity });
            const hunger = game.u.uhunger;
            const conduct = game.u.uconduct.food || 0;
            const oldPiece = game.context.victual?.piece;
            assert.equal(await doeat(), ECMD_TIME);
            const pile = [];
            for (let item = game.level.objectAt(x, y); item; item = item.nexthere)
                pile.push(item);
            const spat = pile.find(item => item.otyp === ONAMES.DAGGER && !item.oerodeproof);
            assert.ok(spat);
            assert.equal(spat.quan, 1);
            assert.equal(spat.rknown, 1);
            assert.equal(spat.where, OBJ_FLOOR);
            assert.equal(floor || quantity === 1 ? spat === obj : spat !== obj, true);
            if (quantity > 1) {
                const rest = floor ? pile.find(item => item !== spat) : obj;
                assert.equal(rest.quan, quantity - 1);
                assert.equal(rest.oerodeproof, 1);
                assert.equal(rest.rknown, 1);
                assert.equal(rest.where, floor ? OBJ_FLOOR : OBJ_INVENT);
            }
            assert.equal(game.u.intrinsic.HStun & TIMEOUT, stun);
            assert.equal(game.u.uhunger, hunger);
            assert.equal(game.u.uconduct.food || 0, conduct);
            assert.equal(game.context.victual?.piece, oldPiece);
            assert.deepEqual(getRngLog(), rng);
            assert.match(messages(), /was rustproofed!/);
            assert.match(messages(), /out onto the floor/);
        });
    }
}

for (const ring of [false, true]) {
    test(`rustproof cursed equipment remains attached, ring=${ring}`, async () => {
        const { obj, rng } = await fixture({ cursed: true, wielded: !ring, ring });
        assert.equal(await doeat(), ECMD_TIME);
        assert.equal(obj.where, OBJ_INVENT);
        assert.equal(obj.oerodeproof, 0);
        assert.equal(obj.bknown, 1);
        assert.equal(ring ? game.u.uleft : game.u.uwep, obj);
        assert.notEqual(obj.owornmask, 0);
        assert.match(messages(), /You spit out the/);
        assert.doesNotMatch(messages(), /onto the|indigestible/);
        assert.deepEqual(getRngLog(), rng);
    });
}

test('rustproof single wielded item clears equipment before floor placement', async () => {
    const { obj, rng } = await fixture({ wielded: true });
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(game.u.uwep, null);
    assert.equal(obj.owornmask, 0);
    assert.equal(obj.where, OBJ_FLOOR);
    assert.deepEqual(getRngLog(), rng);
});

test('rustproof feedback waits before stripping the proofing or drawing stun', async () => {
    const { run, obj } = await fixture();
    await pline('Earlier feedback still occupies the top line.');
    let release, arrived;
    const waiting = new Promise(resolve => { arrived = resolve; });
    run._display.onEmptyQueue = () => {
        arrived();
        return new Promise(resolve => { release = resolve; });
    };
    const operation = doeat();
    await waiting;
    await setImmediate();
    const during = { proof: obj.oerodeproof, known: obj.rknown,
        where: obj.where, rng: [...getRngLog()] };
    run._display.onEmptyQueue = () => 32;
    release(32);
    await operation;
    assert.deepEqual(during, { proof: 1, known: 1, where: OBJ_INVENT, rng: [] });
    assert.equal(obj.where, OBJ_FLOOR);
});

for (const known of [false, true]) {
    test(`slow digestion is retained without nutrition or conduct, known=${known}`, async () => {
        const { run, obj } = await fixture({ ring: true, form: PMNAMES.PM_XORN });
        obj.oerodeproof = 0;
        if (known)
            makeknown(obj.otyp);
        else {
            // Leave actual naming available and complete its getlin normally.
            run._display.onEmptyQueue = () => 27;
        }
        clearMessages();
        seed(2);
        const before = { hunger: game.u.uhunger, conduct: game.u.uconduct.food || 0,
            quantity: obj.quan, piece: game.context.victual?.piece };
        assert.equal(is_edible(obj), true);
        assert.equal(await doeat(), ECMD_TIME);
        assert.equal(obj.where, OBJ_INVENT);
        assert.equal(obj.quan, before.quantity);
        assert.equal(game.u.uhunger, before.hunger);
        assert.equal(game.u.uconduct.food || 0, before.conduct);
        assert.equal(game.context.victual?.piece, before.piece);
        assert.match(messages(), /This ring is indigestible!/);
        assert.match(messages(), /Awful metal!/);
        assert.deepEqual(getRngLog(), ['rn2(4)=1', 'rn2(4)=2', 'rn2(3)=2']);
    });
}
