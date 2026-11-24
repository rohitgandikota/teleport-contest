// C allmain.c:684-696, hack.c:4161-4173, eat.c:3877-3890.
// Constructed source controls with real queue producers and consumers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {set_occupation, stop_occupation} from '../js/allmain.js';
import {cmdq_add_ec, cmdq_add_key, cmdq_add_int, cmdq_add_dir,
    cmdq_add_userinput, cmdq_peek, cmdq_pop} from '../js/cmd.js';
import {dosearch} from '../js/detect.js';
import {ddoinv, addinv} from '../js/invent.js';
import {doapply} from '../js/apply.js';
import {use_pick_axe} from '../js/dig.js';
import {eatfood, unfaint} from '../js/eat.js';
import {nomul} from '../js/hack.js';
import {mksobj} from '../js/mkobj.js';
import {makemon} from '../js/makemon.js';
import {missmu} from '../js/mhitu.js';
import {pline, TOPLINE_EMPTY} from '../js/display.js';
import {resetInputState} from '../js/input.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {CQ_CANNED, CQ_REPEAT, CMDQ_EXTCMD, CMDQ_KEY, CMDQ_INT, CMDQ_DIR,
    CMDQ_USER_INPUT, ECMD_TIME, OBJ_DELETED, MM_NOMSG, MM_NOGRP,
    NO_MINVENT} from '../js/const.js';

async function setup() {
    const run = await runSegment({seed: 74817, datetime: '20000110090000', moves: ' \x1b',
        storage: new InMemoryStorage(),
        nethackrc: 'OPTIONS=name:Desired,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'});
    feedback(run);
    game.occupation = null; game.multi = 0; nomul(0);
    game.command_queue = []; game.in_doagain = false;
    game.occtxt = 'previous occupation'; game.occtime = 12;
    game.context.victual = {}; game.afternmv = unfaint;
    game.u.uhunger = 900; game.u.uhs = 1;
    resetMessage();
    return run;
}
function feedback(run) {
    game._preNhgetchHook = null; resetInputState();
    let keys = 0;
    run._display.onEmptyQueue = () => { assert.ok(++keys <= 16); return 32; };
}
function resetMessage() {
    game._toplin = TOPLINE_EMPTY; game._toplines = ''; game._prevmsg = '';
    game._pending_message = ''; game._msg_history = [];
}
function resetRng() { initRng(74817); enableRngLog(); }
function text() { return [...game._msg_history, game._toplines, game._pending_message].join('\n'); }
function queues() {
    cmdq_add_ec(CQ_CANNED, ddoinv);
    cmdq_add_key(CQ_CANNED, 'a'); cmdq_add_int(CQ_CANNED, 3);
    cmdq_add_dir(CQ_CANNED, 1, 0, 0); cmdq_add_userinput(CQ_CANNED);
    assert.deepEqual(game.command_queue[CQ_CANNED].map(n => n.typ),
        [CMDQ_EXTCMD, CMDQ_KEY, CMDQ_INT, CMDQ_DIR, CMDQ_USER_INPUT]);
    cmdq_add_ec(CQ_REPEAT, dosearch); cmdq_add_key(CQ_REPEAT, 's');
    return game.command_queue[CQ_REPEAT];
}

for (const occupied of [false, true]) for (const multi of [-4, 0, 6])
    test(`${occupied ? 'occupied' : 'idle'}, multi=${multi}: clear canned only`, async () => {
        await setup(); const repeat = queues();
        if (occupied) set_occupation(dosearch, 'searching', 0);
        game.occtime = 12;
        game.multi = multi; game.u.usleep = 99; game.u.uinvulnerable = true;
        game.multi_reason = 'existing reason'; game.multireasonbuf = 'existing reason';
        game.context.run = 1; game.context.travel = game.context.travel1 = game.context.mv = 1;
        game.disp.botl = false; resetRng();
        await stop_occupation();
        assert.equal(game.occupation, null);
        assert.equal(game.multi, multi < 0 ? multi : 0);
        assert.equal(game.afternmv, unfaint); assert.equal(game.occtime, 12);
        assert.equal(game.u.usleep, multi < 0 ? 99 : 0);
        assert.equal(game.u.uinvulnerable, multi < 0);
        assert.equal(game.context.run, multi < 0 ? 1 : 0);
        assert.equal(game.context.travel, multi < 0 ? 1 : 0);
        assert.equal(game.multi_reason, multi < 0 ? 'existing reason' : null);
        assert.equal(game.disp.botl, occupied || multi >= 0);
        assert.equal(cmdq_peek(CQ_CANNED), null);
        assert.equal(cmdq_pop(), null);
        assert.equal(game.command_queue[CQ_REPEAT], repeat);
        assert.equal(repeat.length, 2);
        assert.equal(text().includes('You stop searching.'), occupied);
        assert.deepEqual(getRngLog(), []);
    });

test('during do-again, clear canned while preserving the active repeat queue', async () => {
    await setup(); const repeat = queues(); game.multi = -4; game.in_doagain = true;
    resetRng(); await stop_occupation();
    assert.equal(cmdq_peek(CQ_CANNED), null);
    assert.equal(game.command_queue[CQ_REPEAT], repeat);
    assert.equal(cmdq_pop().fn, dosearch); assert.equal(cmdq_pop().key, 's');
    assert.equal(game.multi, -4); assert.deepEqual(getRngLog(), []);
});

test('empty queue and negative idle countdown retain sleep and completion state', async () => {
    await setup(); game.multi = -8; game.u.usleep = 21; game.disp.botl = false;
    resetRng(); await stop_occupation();
    assert.equal(cmdq_peek(CQ_CANNED), null); assert.equal(cmdq_peek(CQ_REPEAT), null);
    assert.equal(game.multi, -8); assert.equal(game.u.usleep, 21);
    assert.equal(game.afternmv, unfaint); assert.equal(game.disp.botl, false);
    assert.equal(text(), '\n'); assert.deepEqual(getRngLog(), []);
});

test('stop preserves C occupation text while clearing the callable', async () => {
    await setup(); set_occupation(dosearch, 'searching', 0);
    await stop_occupation();
    assert.equal(game.occupation, null); assert.equal(game.occtxt, 'searching');
});

for (const multi of [-4, 0])
    test(`actual pick-axe wield producer, supplied multi=${multi}`, async () => {
        await setup(); const pick = mksobj(O.PICK_AXE, false, false); await addinv(pick);
        assert.equal(await use_pick_axe(pick), ECMD_TIME);
        assert.equal(game.u.uwep, pick);
        assert.equal(cmdq_peek(CQ_CANNED).fn, doapply);
        assert.deepEqual(game.command_queue[CQ_CANNED].map(n => n.typ), [CMDQ_EXTCMD, CMDQ_KEY]);
        assert.equal(game.command_queue[CQ_CANNED][1].key, pick.invlet);
        // This countdown is a constructed precondition, not an input witness.
        game.multi = multi; resetRng();
        await stop_occupation();
        assert.equal(cmdq_peek(CQ_CANNED), null); assert.equal(game.u.uwep, pick);
        assert.equal(game.multi, multi); assert.deepEqual(getRngLog(), []);
    });

for (const finished of [false, true])
    test(`${finished ? 'finished' : 'unfinished'} meal uses the real eatfood closure`, async () => {
        await setup(); const apple = mksobj(O.APPLE, false, false); await addinv(apple);
        game.context.victual = {piece: apple, eating: 1, usedtime: finished ? 3 : 1, reqtime: 3};
        set_occupation(eatfood, 'eating the apple', 0); queues(); game.multi = -4;
        resetRng(); await stop_occupation();
        assert.equal(game.occupation, null); assert.equal(game.multi, -4);
        assert.equal(cmdq_peek(CQ_CANNED), null);
        assert.equal(text().includes('You stop eating the apple.'), !finished);
        assert.equal(text().includes('You finish eating the apple.'), finished);
        assert.equal(apple.where === OBJ_DELETED, finished);
        if (finished) assert.deepEqual(game.context.victual, {});
        else assert.equal(game.context.victual.piece, apple);
        assert.deepEqual(getRngLog(), []);
    });

test('real terminal suspension finishes feedback before clearing occupation and canned queue', async () => {
    const run = await setup();
    await pline('This occupied message line leaves no room for another occupation message.');
    set_occupation(dosearch, 'searching', 0); queues(); game.multi = -4;
    let release, complete = false;
    run._display.onEmptyQueue = () => new Promise(resolve => { release = resolve; });
    const pending = stop_occupation(); pending.then(() => { complete = true; });
    try {
        for (let i = 0; i < 20 && !release; i++) await new Promise(resolve => setImmediate(resolve));
        assert.equal(typeof release, 'function'); assert.equal(complete, false);
        assert.equal(game.occupation, dosearch); assert.ok(cmdq_peek(CQ_CANNED));
    } finally {
        feedback(run); if (release) release(32); await pending;
    }
    assert.equal(complete, true); assert.equal(game.occupation, null);
    assert.equal(cmdq_peek(CQ_CANNED), null); assert.equal(game.multi, -4);
    assert.match(text(), /You stop searching\./);
});

test('actual missmu caller awaits stop and drops pending commands during helplessness', async () => {
    await setup();
    const mon = await makemon(game.mons[P.PM_NEWT], game.u.ux + 1, game.u.uy,
        MM_NOMSG | MM_NOGRP | NO_MINVENT);
    assert.ok(mon); queues(); game.multi = -4;
    resetRng(); await missmu(mon, false, mon.data.mattk[0]);
    assert.match(text(), /misses!/); assert.equal(cmdq_peek(CQ_CANNED), null);
    assert.equal(game.multi, -4); assert.equal(game.afternmv, unfaint);
    assert.deepEqual(getRngLog(), []);
});
