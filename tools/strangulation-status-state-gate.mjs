// C insight.c status_enlightenment: the complete Strangled branch.
// Real timer/equipment/form producers; burial fixtures are explicitly constructed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup, clearMessages, seed } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { enlightenment, BASICENLIGHTENMENT, MAGICENLIGHTENMENT,
         ENL_GAMEINPROGRESS, ENL_GAMEOVERALIVE, ENL_GAMEOVERDEAD } from '../js/insight.js';
import { incr_itimeout, set_itimeout, make_stunned } from '../js/potion.js';
import { Amulet_on, Amulet_off } from '../js/do_wear.js';
import { addinv } from '../js/invent.js';
import { mksobj } from '../js/mkobj.js';
import { polymon } from '../js/polyself.js';
import { nh_timeout } from '../js/timeout.js';
import { rhack } from '../js/cmd.js';
import { getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { I_SPECIAL, TIMEOUT, W_AMUL } from '../js/const.js';

const status = (mode = BASICENLIGHTENMENT, final = ENL_GAMEINPROGRESS) =>
    enlightenment(mode, final).filter(line => /strang|buried/.test(line));
const screen = run => run._display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');

async function wear() {
    const obj = await addinv(mksobj(ONAMES.AMULET_OF_STRANGULATION, false, false));
    await Amulet_on(obj);
    return obj;
}

async function pauseAt(run, action, predicate) {
    let arrived, release, reads = 0;
    const arrival = new Promise(resolve => { arrived = resolve; });
    run._display.clearInputQueue();
    game.command_queue = [];
    run._display.onEmptyQueue = () => {
        assert.ok(++reads < 8, 'bounded real prompt reads');
        if (!predicate())
            return 32;
        arrived();
        return new Promise(resolve => { release = resolve; });
    };
    const pending = action();
    const stopped = await Promise.race([arrival.then(() => true), pending.then(() => false)]);
    return { pending, stopped, resume(key) {
        run._display.onEmptyQueue = () => 32;
        release?.(key);
    } };
}

for (const mode of [BASICENLIGHTENMENT, MAGICENLIGHTENMENT]) {
    test(`wizard timer is visible without an amulet, mode ${mode}`, async () => {
        await setup();
        incr_itimeout('HStrangled', 30);
        seed();
        assert.deepEqual(status(mode), [' You are being strangled (30).']);
        assert.equal(game.u.intrinsic.HStrangled, 30);
        assert.equal(game.u.uamul || null, null);
        assert.deepEqual(getRngLog(), []);
    });

    test(`ordinary mode reports the trouble without wizard details, mode ${mode}`, async () => {
        await setup();
        incr_itimeout('HStrangled', 30);
        game.wizard = false; // Explicit mode fixture, real timer producer.
        seed();
        assert.deepEqual(status(mode), [' You are being strangled.']);
        assert.deepEqual(getRngLog(), []);
    });
}

test('real worn amulet reports the existing abbreviated source description', async () => {
    await setup();
    const obj = await wear();
    seed();
    assert.deepEqual(status(), [' You are being strangled (6) because of your amulet.']);
    assert.equal(game.u.uamul, obj);
    assert.equal(obj.owornmask, W_AMUL);
    assert.equal(game.u.uprops.STRANGLED, W_AMUL);
    assert.deepEqual(getRngLog(), []);
});

test('nonwizard inspection omits the real amulet source and timeout', async () => {
    await setup();
    await wear();
    game.wizard = false;
    seed();
    assert.deepEqual(status(), [' You are being strangled.']);
    assert.deepEqual(getRngLog(), []);
});

test('immune real amulet wearer does not report its equipment mask as a countdown', async () => {
    await setup();
    await polymon(PMNAMES.PM_IRON_GOLEM);
    const obj = await wear();
    seed();
    assert.equal(game.u.uprops.STRANGLED, W_AMUL);
    assert.equal(game.u.intrinsic.HStrangled || 0, 0);
    assert.deepEqual(status(), []);
    assert.equal(game.u.uamul, obj);
    assert.deepEqual(getRngLog(), []);
});

test('real amulet removal removes the disclosure line', async () => {
    await setup();
    const obj = await wear();
    await Amulet_off();
    seed();
    assert.deepEqual(status(), []);
    assert.equal(game.u.intrinsic.HStrangled, 0);
    assert.equal(obj.owornmask, 0);
    assert.deepEqual(getRngLog(), []);
});

test('inspection reads the actual remaining timeout after a real tick', async () => {
    await setup();
    incr_itimeout('HStrangled', 30);
    await nh_timeout();
    seed();
    assert.deepEqual(status(), [' You are being strangled (29).']);
    assert.equal(game.u.intrinsic.HStrangled, 29);
    assert.deepEqual(getRngLog(), []);
});

test('the timeout suffix retains the full C TIMEOUT width', async () => {
    await setup();
    set_itimeout('HStrangled', TIMEOUT);
    seed();
    assert.deepEqual(status(), [' You are being strangled (16777215).']);
    assert.equal(game.u.intrinsic.HStrangled, TIMEOUT);
    assert.deepEqual(getRngLog(), []);
});

test('burial fixture takes precedence over normal timer and source details', async () => {
    await setup();
    await wear();
    game.u.uburied = true; // C bury_you state; no ordinary burial reach claimed.
    seed();
    assert.deepEqual(status(), [' You are buried.']);
    assert.deepEqual(status(BASICENLIGHTENMENT, ENL_GAMEOVERALIVE), [' You were buried.']);
    assert.equal(game.u.intrinsic.HStrangled, 6);
    assert.deepEqual(getRngLog(), []);
});

test('burial alone does not manufacture a strangulation disclosure', async () => {
    await setup();
    game.u.uburied = true; // Source-state negative for the outer Strangled guard.
    seed();
    assert.deepEqual(status(), []);
    assert.deepEqual(getRngLog(), []);
});

test('ordinary final disclosure uses past tense without claiming a strangulation death', async () => {
    await setup();
    incr_itimeout('HStrangled', 30);
    seed();
    for (const final of [ENL_GAMEOVERALIVE, ENL_GAMEOVERDEAD])
        assert.deepEqual(status(BASICENLIGHTENMENT, final), [' You were being strangled (30).']);
    assert.deepEqual(status(), [' You are being strangled (30).']);
    assert.deepEqual(getRngLog(), []);
});

for (const buried of [false, true]) {
    test(`real timeout expiry sets the final marker before pending Die, buried=${buried}`, async () => {
        const run = await setup();
        game.u.uburied = buried; // Burial state only is constructed.
        set_itimeout('HStrangled', 1);
        clearMessages();
        const held = await pauseAt(run, () => nh_timeout(), () => screen(run).includes('Die?'));
        const during = {
            word: game.u.intrinsic.HStrangled,
            alive: status(BASICENLIGHTENMENT, ENL_GAMEOVERALIVE),
            dead: status(BASICENLIGHTENMENT, ENL_GAMEOVERDEAD),
            live: status(),
        };
        held.resume('n'.charCodeAt(0));
        await held.pending;
        assert.equal(held.stopped, true);
        assert.equal(during.word, I_SPECIAL);
        const finalLine = buried ? ' You were buried.' : ' You died from strangulation.';
        assert.deepEqual(during.alive, [finalLine]);
        assert.deepEqual(during.dead, [finalLine]);
        assert.deepEqual(during.live, [buried ? ' You are buried.' : ' You are being strangled (0).']);
        assert.equal((game.u.intrinsic.HStrangled || 0) & I_SPECIAL, 0);
        assert.deepEqual(status(), []);
    });
}

test('the trouble appears after movement status and before the next internal trouble', async () => {
    await setup();
    await polymon(PMNAMES.PM_RED_DRAGON);
    incr_itimeout('HStrangled', 30);
    await make_stunned(3, false);
    seed();
    const lines = enlightenment(BASICENLIGHTENMENT, ENL_GAMEINPROGRESS);
    const strangled = lines.indexOf(' You are being strangled (30).');
    assert.ok(strangled > lines.indexOf(' You are flying from your creature form.'));
    assert.ok(strangled < lines.indexOf(' You are stunned.'));
    assert.deepEqual(getRngLog(), []);
});

test('real attributes command waits on its status page and completes without time or timer mutation', async () => {
    const run = await setup();
    incr_itimeout('HStrangled', 30);
    clearMessages();
    seed();
    const moves = game.moves;
    const held = await pauseAt(run, () => rhack(24),
        () => screen(run).includes('You are being strangled (30).'));
    const timer = game.u.intrinsic.HStrangled;
    held.resume(27);
    await held.pending;
    assert.equal(held.stopped, true);
    assert.equal(timer, 30);
    assert.equal(game.u.intrinsic.HStrangled, 30);
    assert.equal(game.moves, moves);
    assert.equal(game.context.move, 0);
    assert.deepEqual(getRngLog(), []);
});
