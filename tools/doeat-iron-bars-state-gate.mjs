// Normal imports, real terrain/object/form producers and real input queues.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup, seed, clearMessages, messages } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { doeat, floorfood } from '../js/eat.js';
import { polymon } from '../js/polyself.js';
import { set_levltyp } from '../js/mkmaze.js';
import { mksobj, place_object, set_corpsenm } from '../js/mkobj.js';
import { hands_obj } from '../js/invent.js';
import { maketrap } from '../js/mklev.js';
import { cmdq_add_key } from '../js/cmd.js';
import { pline } from '../js/display.js';
import { getRngLog, rnd } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { CQ_CANNED, CQ_REPEAT, IRONBARS, CORR, W_NONDIGGABLE,
    BEAR_TRAP, ECMD_OK, ECMD_TIME } from '../js/const.js';

async function fixture(form = 'PM_XORN', bars = true) {
    const run = await setup();
    if (form)
        await polymon(PMNAMES[form]);
    if (bars)
        assert.equal(set_levltyp(game.u.ux, game.u.uy, IRONBARS), true);
    clearMessages();
    run._display.clearInputQueue();
    run._display.onEmptyQueue = () => 32;
    game.command_queue = [];
    seed();
    return run;
}

test('three real eating commands chew, resume and dissolve bars without a food occupation', async () => {
    const run = await fixture();
    const startHunger = game.u.uhunger;
    const victual = structuredClone(game.context.victual);
    const occupation = game.occupation;
    for (const [turn, effort] of [[0, 60], [1, 90], [2, 0]]) {
        clearMessages();
        run._display.pushKey(121);
        assert.equal(await doeat(), ECMD_TIME);
        assert.equal(game.context.digging.effort, effort);
        assert.deepEqual(game.context.victual, victual);
        assert.equal(game.occupation, occupation);
        assert.equal(game.level.at(game.u.ux, game.u.uy).typ, turn < 2 ? IRONBARS : CORR);
        assert.equal(game.u.uconduct.food, turn < 2 ? 0 : 1);
        if (turn < 2) {
            assert.equal(game.u.uhunger, startHunger);
            assert.match(messages(), /pause to swallow/);
            assert.deepEqual(getRngLog(), []);
        } else {
            assert.match(messages(), /devour the iron bars/);
            assert.doesNotMatch(messages(), /pause to swallow/);
        }
    }
    const actualRng = [...getRngLog()];
    seed();
    const nutrition = rnd(20) + game.objects[ONAMES.HEAVY_IRON_BALL].oc_weight;
    assert.deepEqual(actualRng, getRngLog());
    assert.equal(game.u.uhunger, startHunger + nutrition);
});

for (const condition of ['quit', 'too-full', 'undiggable', 'nonmetal-form']) {
    test(`iron bars negative: ${condition}`, async () => {
        const run = await fixture(condition === 'nonmetal-form' ? null : 'PM_XORN');
        if (condition === 'too-full')
            game.u.uhunger = 1501;
        if (condition === 'undiggable')
            game.level.at(game.u.ux, game.u.uy).wall_info |= W_NONDIGGABLE;
        const digging = structuredClone(game.context.digging);
        const hunger = game.u.uhunger;
        if (condition === 'quit')
            run._display.pushKey(113);
        assert.equal(await doeat(), ECMD_OK);
        assert.deepEqual(game.context.digging, digging);
        assert.equal(game.level.at(game.u.ux, game.u.uy).typ, IRONBARS);
        assert.equal(game.u.uhunger, hunger);
        assert.equal(game.u.uconduct.food, 0);
        assert.deepEqual(getRngLog(), []);
    });
}

test('actual resume is reset when the stored digging level differs', async () => {
    const run = await fixture();
    run._display.pushKey(121);
    assert.equal(await doeat(), ECMD_TIME);
    game.context.digging.level.dlevel++;
    clearMessages();
    run._display.pushKey(121);
    assert.equal(await doeat(), ECMD_TIME);
    assert.equal(game.context.digging.effort, 60);
    assert.match(messages(), /start chewing/);
    assert.doesNotMatch(messages(), /resume eating/);
});

for (const kind of ['bear-trap', 'iron-bars', 'gold', 'carrot', 'sacrifice', 'tin']) {
    test(`floor choice consumes the real canned answer: ${kind}`, async () => {
        const run = await fixture('PM_XORN', kind === 'iron-bars');
        let expected;
        if (kind === 'bear-trap') {
            const trap = await maketrap(game.u.ux, game.u.uy, BEAR_TRAP);
            trap.tseen = 1;
        } else if (kind === 'iron-bars') {
            expected = hands_obj;
        } else {
            const type = kind === 'gold' ? ONAMES.GOLD_PIECE
                : ['sacrifice', 'tin'].includes(kind) ? ONAMES.CORPSE : ONAMES.CARROT;
            expected = mksobj(type, false, false);
            if (type === ONAMES.CORPSE)
                set_corpsenm(expected, PMNAMES.PM_LICHEN);
            await place_object(expected, game.u.ux, game.u.uy);
        }
        clearMessages();
        run._display.onEmptyQueue = () => { throw Error('canned answer was not consumed'); };
        cmdq_add_key(CQ_CANNED, 'y');
        const selected = await floorfood(kind === 'sacrifice' ? kind : kind === 'tin' ? kind : 'eat',
            kind === 'sacrifice' ? 1 : kind === 'tin' ? 2 : 0);
        if (kind === 'bear-trap') {
            assert.equal(selected.otyp, ONAMES.BEARTRAP);
            assert.equal(game.level.traps.length, 0);
        } else {
            assert.equal(selected, expected);
        }
        assert.equal(game.command_queue[CQ_CANNED].length, 0);
    });
}

test('keyboard floor choice records the answer for do-again', async () => {
    const run = await fixture();
    run._display.pushKey(121);
    assert.equal(await floorfood('eat', 0), hands_obj);
    assert.equal(game.command_queue[CQ_REPEAT]?.at(-1)?.key, 'y');
});

test('pending real More completes chewing feedback before the pause message', async () => {
    const run = await fixture();
    await pline('An existing message occupies enough of the line to require acknowledgement.');
    cmdq_add_key(CQ_CANNED, 'y');
    let arrived, release;
    const waiting = new Promise(resolve => { arrived = resolve; });
    run._display.onEmptyQueue = () => {
        arrived();
        return new Promise(resolve => { release = resolve; });
    };
    const operation = doeat();
    const pending = await Promise.race([waiting.then(() => true), operation.then(() => false)]);
    const during = { effort: game.context.digging.effort, text: messages(), food: game.u.uconduct.food };
    run._display.onEmptyQueue = () => 32;
    release?.(32);
    const result = await operation;
    assert.equal(pending, true);
    assert.equal(during.effort, 60);
    assert.doesNotMatch(during.text, /pause to swallow/);
    assert.equal(during.food, 0);
    assert.equal(result, ECMD_TIME);
    assert.match(messages(), /pause to swallow/);
    assert.deepEqual(getRngLog(), []);
});
