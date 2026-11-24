// Constructed source-state controls through normal imports and real helpers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { setup, seed, clearMessages, messages, x, y } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { doeat, is_edible } from '../js/eat.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { oname } from '../js/do_name.js';
import { addinv } from '../js/invent.js';
import { polymon } from '../js/polyself.js';
import { setuwep } from '../js/wield.js';
import { cmdq_add_key } from '../js/cmd.js';
import { pline } from '../js/display.js';
import { d, rn2, getRngLog } from '../js/rng.js';
import { Antimagic } from '../js/youprop.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { ART_MASTER_KEY_OF_THIEVERY } from '../js/artilist_data.js';
import { CQ_CANNED, ECMD_OK, ECMD_TIME, OBJ_INVENT, ONAME_WISH, Upolyd } from '../js/const.js';

async function fixture({ owner = 'floor', form = true, wielded = false, hp = 200 } = {}) {
    const run = await setup();
    game.u.uhp = game.u.uhpmax = 200;
    if (form) {
        assert.equal(await polymon(PMNAMES.PM_XORN), 1);
        assert.equal(game.youmonst.data, game.mons[PMNAMES.PM_XORN]);
        game.u.mh = game.u.mhmax = hp;
    }
    const obj = mksobj(ONAMES.SKELETON_KEY, false, false);
    assert.equal(await oname(obj, 'The Master Key of Thievery', ONAME_WISH), obj);
    assert.equal(obj.oartifact, ART_MASTER_KEY_OF_THIEVERY);
    if (owner === 'floor')
        await place_object(obj, x, y);
    else
        await addinv(obj);
    if (wielded)
        await setuwep(obj);
    clearMessages();
    run._display.clearInputQueue();
    game.command_queue = [];
    return { run, obj };
}

function ownership(obj) {
    return { id: obj.o_id, where: obj.where, quantity: obj.quan,
        eaten: obj.oeaten || 0, floor: game.level.objects.includes(obj),
        inventory: (game.invent || []).includes(obj) };
}

function select(run, obj, floor = false) {
    if (floor)
        run._display.pushKey('y'.charCodeAt(0));
    else
        cmdq_add_key(CQ_CANNED, obj.invlet);
}

function damageReference() {
    seed(3);
    const damage = d(4, 10);
    rn2(2); // C exercise(A_WIS, FALSE), same ordinary attributes as setup.
    const rng = [...getRngLog()];
    seed(3);
    return { damage, rng };
}

for (const owner of ['floor', 'carried', 'wielded']) {
    test(`rejected edible artifact retains ${owner} ownership before any food mutation`, async () => {
        const floor = owner === 'floor';
        const { run, obj } = await fixture({ owner: floor ? 'floor' : 'inventory',
            wielded: owner === 'wielded' });
        assert.equal(is_edible(obj), true);
        assert.equal(!!Antimagic(), false);
        const before = ownership(obj);
        const conduct = game.u.uconduct.food || 0;
        const piece = game.context.victual?.piece;
        select(run, obj, floor);
        const expected = damageReference();
        assert.equal(await doeat(), ECMD_TIME);
        assert.equal(game.u.mh, 200 - expected.damage);
        assert.equal(game.u.uhp, 200);
        assert.deepEqual(getRngLog(), expected.rng);
        assert.deepEqual(ownership(obj), before);
        assert.equal(game.u.uconduct.food || 0, conduct);
        assert.equal(game.context.victual?.piece, piece);
        assert.match(messages(), /are blasted by/);
        assert.match(messages(), floor ? /evades your grasp/ : /beyond your control/);
        if (owner === 'wielded') {
            assert.equal(game.u.uwep, null);
            assert.equal(obj.owornmask || 0, 0);
        }
    });
}

test('floor refusal that ends the form still exits before consuming the artifact', async () => {
    const { run, obj } = await fixture({ hp: 1 });
    const before = ownership(obj);
    select(run, obj, true);
    const expected = damageReference();
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(Upolyd(game.u), false);
    assert.equal(game.u.uhp, 200);
    assert.deepEqual(getRngLog(), expected.rng);
    assert.deepEqual(ownership(obj), before);
    assert.equal(game.u.uconduct.food || 0, 0);
});

test('a declined floor artifact never reaches contact', async () => {
    const { run, obj } = await fixture();
    const before = ownership(obj);
    run._display.pushKey('q'.charCodeAt(0));
    seed();
    assert.equal(await doeat(), ECMD_OK);
    assert.equal(game.u.mh, 200);
    assert.deepEqual(ownership(obj), before);
    assert.deepEqual(getRngLog(), []);
    assert.doesNotMatch(messages(), /blasted|evades|beyond your control/);
});

test('a cancelled inventory selection never reaches contact', async () => {
    const { run, obj } = await fixture({ owner: 'inventory' });
    const before = ownership(obj);
    run._display.pushKey(27);
    seed();
    assert.equal(await doeat(), ECMD_OK);
    assert.equal(game.u.mh, 200);
    assert.deepEqual(ownership(obj), before);
    assert.deepEqual(getRngLog(), []);
    assert.doesNotMatch(messages(), /blasted|evades|beyond your control/);
});

for (const artifact of [false, true]) {
    test(`an explicitly selected nonedible key stops before contact, artifact=${artifact}`, async () => {
        const run = await setup();
        const obj = mksobj(ONAMES.SKELETON_KEY, false, false);
        if (artifact)
            await oname(obj, 'The Master Key of Thievery', ONAME_WISH);
        await addinv(obj);
        await addinv(mksobj(ONAMES.APPLE, false, false));
        const before = ownership(obj);
        const hp = game.u.uhp;
        assert.equal(is_edible(obj), false);
        clearMessages();
        run._display.clearInputQueue();
        run._display.pushKey(obj.invlet.charCodeAt(0));
        seed();
        assert.equal(await doeat(), ECMD_OK);
        assert.equal(game.u.uhp, hp);
        assert.deepEqual(ownership(obj), before);
        assert.deepEqual(getRngLog(), []);
        assert.match(messages(), /cannot eat that/);
        assert.doesNotMatch(messages(), /blasted|evades|beyond your control/);
    });
}

for (const floor of [false, true]) {
    test(`ordinary apple still enters the existing food path, floor=${floor}`, async () => {
        const run = await setup();
        const obj = mksobj(ONAMES.APPLE, false, false);
        if (floor)
            await place_object(obj, x, y);
        else
            await addinv(obj);
        clearMessages();
        run._display.clearInputQueue();
        select(run, obj, floor);
        const hp = game.u.uhp;
        const conduct = game.u.uconduct.food || 0;
        seed();
        assert.equal(await doeat(), ECMD_TIME);
        assert.equal(game.u.uhp, hp);
        assert.equal(game.u.uconduct.food, conduct + 1);
        assert.doesNotMatch(messages(), /blasted|evades|beyond your control/);
    });
}

test('carried artifact contact awaits real More before damage or food mutation', async () => {
    const { run, obj } = await fixture({ owner: 'inventory' });
    const before = ownership(obj);
    select(run, obj);
    await pline('A pending message occupies the top line before eating this artifact.');
    let arrived, release, timer;
    let complete = false;
    const waiting = new Promise(resolve => { arrived = resolve; });
    run._display.onEmptyQueue = () => {
        arrived();
        return new Promise(resolve => { release = resolve; });
    };
    seed(3);
    const operation = doeat().then(value => {
        complete = true;
        return value;
    });
    try {
        await Promise.race([waiting, operation.then(() => {
            throw Error('expected pending hero artifact feedback');
        }), new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error('More did not arrive')), 2000);
        })]);
        await setImmediate();
        assert.equal(complete, false);
        assert.equal(game.u.mh, 200);
        assert.deepEqual(getRngLog(), []);
        assert.deepEqual(ownership(obj), before);
        assert.equal(game.u.uconduct.food || 0, 0);
    } finally {
        clearTimeout(timer);
        run._display.onEmptyQueue = () => 32;
        release?.(32);
    }
    assert.equal(await operation, ECMD_TIME);
    assert.ok(game.u.mh > 0 && game.u.mh < 200);
    assert.deepEqual(ownership(obj), before);
    assert.match(messages(), /blasted by/);
    assert.match(messages(), /beyond your control/);
    assert.equal(obj.where, OBJ_INVENT);
});
