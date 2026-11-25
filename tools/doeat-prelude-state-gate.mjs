// Normal imports through real selection, scroll, form and object owners.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup, seed, clearMessages, messages } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { doeat } from '../js/eat.js';
import { pline } from '../js/display.js';
import { set_levltyp } from '../js/mkmaze.js';
import { mksobj, bless, curse } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { set_itimeout } from '../js/potion.js';
import { seffects } from '../js/read.js';
import { polymon } from '../js/polyself.js';
import { makeknown } from '../js/o_init.js';
import { cmdq_add_key } from '../js/cmd.js';
import { getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { CQ_CANNED, ECMD_OK, ECMD_TIME, OBJ_INVENT, IRONBARS } from '../js/const.js';

async function fixture({ type = 'APPLE', form = null, cursed = false,
    proof = false, sense = true } = {}) {
    const run = await setup();
    if (form)
        await polymon(PMNAMES[form]);
    const detection = mksobj(ONAMES.SCR_FOOD_DETECTION, false, false);
    if (sense)
        bless(detection);
    makeknown(detection.otyp);
    await addinv(detection);
    await seffects(detection);
    assert.equal(!!game.u.uedibility, sense);
    const obj = mksobj(ONAMES[type], false, false);
    if (cursed)
        await curse(obj);
    obj.oerodeproof = +proof;
    await addinv(obj);
    clearMessages();
    run._display.clearInputQueue();
    run._display.onEmptyQueue = () => 32;
    game.command_queue = [];
    cmdq_add_key(CQ_CANNED, obj.invlet);
    seed();
    return { run, obj };
}
for (const answer of ['n', '\x1b', ' ']) {
    test(`warning decline ${JSON.stringify(answer)} consumes sense, not food or a turn`, async () => {
        const { run, obj } = await fixture({ cursed: true });
        const before = { count: obj.quan, hunger: game.u.uhunger, food: game.u.uconduct.food };
        run._display.pushKey(answer.charCodeAt(0));
        assert.equal(await doeat(), ECMD_OK);
        assert.equal(game.u.uedibility, 0);
        assert.equal(obj.where, OBJ_INVENT);
        assert.deepEqual({ count: obj.quan, hunger: game.u.uhunger, food: game.u.uconduct.food }, before);
        assert.match(messages(), /might have been poisoned/);
        assert.match(messages(), /nose stops tingling and your sense of smell returns to normal/);
        assert.deepEqual(getRngLog(), []);
    });
}
test('accepted warning clears sense before the real food owner proceeds', async () => {
    const { run } = await fixture({ cursed: true });
    run._display.pushKey(121);
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(game.u.uedibility, 0);
    assert.equal(game.u.uconduct.food, 1);
    const text = messages();
    assert.ok(text.indexOf('stops tingling') < text.indexOf('Blecch!'));
});
test('safe food retains the real blessed-detection sense', async () => {
    await fixture({ type: 'CARROT' });
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(game.u.uedibility, 1);
    assert.equal(game.u.uconduct.food, 1);
    assert.doesNotMatch(messages(), /stops tingling|anyway\?/);
});
test('unblessed detection leaves the ordinary cursed-food path alone', async () => {
    await fixture({ cursed: true, sense: false });
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(!!game.u.uedibility, false);
    assert.doesNotMatch(messages(), /stops tingling|anyway\?/);
});
test('selection cancellation precedes all edibility handling', async () => {
    const { obj } = await fixture({ cursed: true });
    game.command_queue = [];
    cmdq_add_key(CQ_CANNED, '\x1b');
    assert.equal(await doeat(), ECMD_OK);
    assert.equal(game.u.uedibility, 1);
    assert.equal(obj.where, OBJ_INVENT);
    assert.deepEqual(getRngLog(), []);
});
test('strangulation rejects before selection or sense consumption', async () => {
    await fixture({ cursed: true });
    set_itimeout('HStrangled', 5);
    const queue = structuredClone(game.command_queue);
    assert.equal(await doeat(), ECMD_OK);
    assert.equal(game.u.uedibility, 1);
    assert.deepEqual(game.command_queue, queue);
    assert.match(messages(), /can't breathe air/);
    assert.deepEqual(getRngLog(), []);
});
test('overloaded capacity rejects before warning and preserves the sense', async () => {
    await fixture({ cursed: true });
    await addinv(mksobj(ONAMES.BOULDER, false, false));
    seed();
    assert.equal(await doeat(), ECMD_OK);
    assert.equal(game.u.uedibility, 1);
    assert.match(messages(), /carrying so much stuff/);
    assert.doesNotMatch(messages(), /stops tingling|anyway\?/);
    assert.deepEqual(getRngLog(), []);
});
test('sense warning precedes the explicit nonedible-object rejection', async () => {
    const { run, obj } = await fixture({ type: 'LEATHER_GLOVES' });
    await addinv(mksobj(ONAMES.CARROT, false, false));
    // C getobj accepts excluded items only through the prompted path.
    game.command_queue = [];
    run._display.pushKey(obj.invlet.charCodeAt(0));
    run._display.pushKey(121);
    assert.equal(await doeat(), ECMD_OK);
    assert.equal(game.u.uedibility, 0);
    assert.equal(obj.where, OBJ_INVENT);
    assert.equal(game.u.uconduct.food, 0);
    assert.match(messages(), /foul and unfamiliar/);
    assert.match(messages(), /cannot eat that/);
});
test('the consumed-sense message uses the actual cube body part', async () => {
    const { run, obj } = await fixture({ type: 'TALLOW_CANDLE', form: 'PM_GELATINOUS_CUBE' });
    run._display.pushKey(110);
    assert.equal(await doeat(), ECMD_OK);
    assert.equal(obj.where, OBJ_INVENT);
    assert.match(messages(), /sensor stops tingling/);
});
for (const answer of ['n', 'y']) {
    test(`rustproof guard follows the complete warning, answer=${answer}`, async () => {
        const { run, obj } = await fixture({ type: 'DAGGER', form: 'PM_RUST_MONSTER', proof: true });
        run._display.pushKey(answer.charCodeAt(0));
        assert.equal(await doeat(), answer === 'n' ? ECMD_OK : ECMD_TIME);
        assert.equal(game.u.uedibility, 0);
        assert.equal(obj.oerodeproof, answer === 'n' ? 1 : 0);
        assert.equal(game.u.uconduct.food, 0);
        assert.match(messages(), /disgusting to you/);
        if (answer === 'n')
            assert.deepEqual(getRngLog(), []);
        else
            assert.match(messages(), /was rustproofed/);
    });
}
test('pending actual question retains sense and object until the answer completes', async () => {
    const { run, obj } = await fixture({ cursed: true });
    let arrived, release;
    const waiting = new Promise(resolve => { arrived = resolve; });
    run._display.onEmptyQueue = () => {
        arrived();
        return new Promise(resolve => { release = resolve; });
    };
    const operation = doeat();
    const pending = await Promise.race([waiting.then(() => true), operation.then(() => false)]);
    const during = { sense: game.u.uedibility, where: obj.where, food: game.u.uconduct.food,
        text: game._pending_message, rng: [...getRngLog()] };
    run._display.onEmptyQueue = () => 32;
    release?.(110);
    await operation;
    assert.equal(pending, true);
    assert.equal(during.sense, 1);
    assert.equal(during.where, OBJ_INVENT);
    assert.equal(during.food, 0);
    assert.match(during.text, /Eat it anyway/);
    assert.deepEqual(during.rng, []);
    assert.equal(game.u.uedibility, 0);
    assert.equal(obj.where, OBJ_INVENT);
});

test('nose feedback finishes before the sense is cleared', async () => {
    const { run, obj } = await fixture({ cursed: true });
    await pline('An existing message occupies enough of the line to require acknowledgement.');
    cmdq_add_key(CQ_CANNED, 'n');
    let arrived, release;
    const waiting = new Promise(resolve => { arrived = resolve; });
    run._display.onEmptyQueue = () => {
        arrived();
        return new Promise(resolve => { release = resolve; });
    };
    const operation = doeat();
    const pending = await Promise.race([waiting.then(() => true), operation.then(() => false)]);
    const during = { sense: game.u.uedibility, where: obj.where, food: game.u.uconduct.food };
    run._display.onEmptyQueue = () => 32;
    release?.(32);
    const result = await operation;
    assert.equal(pending, true);
    assert.deepEqual(during, { sense: 1, where: OBJ_INVENT, food: 0 });
    assert.equal(result, ECMD_OK);
    assert.equal(game.u.uedibility, 0);
    assert.match(messages(), /stops tingling/);
    assert.deepEqual(getRngLog(), []);
});

test('the real food-detection sense survives a safe iron-bars sentinel', async () => {
    const { run } = await fixture({ form: 'PM_XORN' });
    assert.equal(set_levltyp(game.u.ux, game.u.uy, IRONBARS), true);
    game.command_queue = [];
    run._display.pushKey(121);
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(game.u.uedibility, 1);
    assert.equal(game.context.digging.effort, 60);
    assert.equal(game.u.uconduct.food, 0);
    assert.doesNotMatch(messages(), /stops tingling|anyway\?/);
    assert.deepEqual(getRngLog(), []);
});
