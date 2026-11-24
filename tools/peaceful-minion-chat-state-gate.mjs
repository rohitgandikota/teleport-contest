// C sounds.c:679 domonnoise and priest.c:280 mon_aligntyp, real producers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { setup, seed, clearMessages, messages, x, y } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { domonnoise, dochat } from '../js/sounds.js';
import { create_particular } from '../js/read.js';
import { makemon } from '../js/makemon.js';
import { mk_roamer, priestini, mon_aligntyp } from '../js/priest.js';
import { set_mon_data } from '../js/mondata.js';
import { set_levltyp } from '../js/mkmaze.js';
import { tamedog } from '../js/dog.js';
import { make_deaf } from '../js/potion.js';
import { pline } from '../js/display.js';
import { getRngLog } from '../js/rng.js';
import { PMNAMES as P, MFLAGS } from '../js/monst_data.js';
import * as C from '../js/const.js';

const good = '"It\'s not too late."';
const bad = '"We\'re all doomed."';
const creationFlags = C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG;

async function archon(run) {
    run._display.clearInputQueue();
    for (const key of 'peaceful Archon\r')
        run._display.pushKey(key.charCodeAt(0));
    assert.equal(await create_particular(), true);
    const mon = game.level.monsters.find(mon => mon.mnum === P.PM_ARCHON);
    assert.ok(mon?.mpeaceful && !mon.isminion && !mon.ispriest);
    assert.equal(mon.data, game.mons[P.PM_ARCHON]);
    assert.equal(mon.data.maligntyp, 15);
    return mon;
}

async function speak(mon, lawful) {
    clearMessages();
    seed(2);
    const before = getRngLog().slice();
    const operation = domonnoise(mon);
    assert.ok(operation instanceof Promise);
    assert.equal(await operation, C.ECMD_TIME);
    assert.equal(messages(), lawful ? good : bad);
    assert.deepEqual(getRngLog(), before, 'peaceful classification and speech use no RNG');
}

test('ordinary wizard-created Archon uses normalized species alignment', async () => {
    const run = await setup();
    await speak(await archon(run), true);
});

for (const alignment of [C.A_LAWFUL, C.A_NEUTRAL, C.A_CHAOTIC, C.A_NONE]) {
    test(`real roamer record overrides lawful species: ${alignment}`, async () => {
        await setup();
        const mon = await mk_roamer(game.mons[P.PM_ANGEL], alignment, x + 1, y, true);
        assert.ok(mon?.isminion && !mon.ispriest && mon.mpeaceful);
        assert.equal(mon.emin.min_align, alignment);
        assert.equal(mon_aligntyp(mon), alignment);
        await speak(mon, alignment === C.A_LAWFUL);
    });
}

for (const alignment of [C.A_LAWFUL, C.A_NEUTRAL, C.A_CHAOTIC, C.A_NONE]) {
    test(`shrine alignment survives a real species change: ${alignment}`, async () => {
        await setup();
        assert.equal(set_levltyp(x + 2, y, C.ALTAR), true);
        game.level.at(x + 2, y).altarmask = C.Align2amask(alignment) | C.AM_SHRINE;
        const building = game.in_mklev;
        try {
            game.in_mklev = true;
            priestini(game.u.uz, game.level.rooms[0], x + 2, y, false);
        } finally {
            game.in_mklev = building;
        }
        const mon = game.level.monsters.find(mon => mon.ispriest);
        assert.ok(mon?.epri && !mon.isminion && mon.mpeaceful);
        set_mon_data(mon, game.mons[P.PM_ARCHON]);
        assert.equal(mon.epri.shralign, alignment);
        assert.equal(mon_aligntyp(mon), alignment);
        await speak(mon, alignment === C.A_LAWFUL);
    });
}

test('lawful metadata alone does not grant the species-minion flag', async () => {
    await setup();
    const mon = await mk_roamer(game.mons[P.PM_IMP], C.A_LAWFUL, x + 1, y, true);
    assert.ok(mon.isminion);
    assert.equal(mon_aligntyp(mon), C.A_LAWFUL);
    assert.equal(mon.data.mflags2 & MFLAGS.M2_MINION, 0);
    await speak(mon, false);
});

test('pacifying a renegade preserves the flag but peaceful chat stays lawful', async () => {
    await setup();
    game.u.ualign.type = C.A_LAWFUL;
    const mon = await mk_roamer(game.mons[P.PM_ANGEL], C.A_LAWFUL, x + 1, y, false);
    assert.ok(mon.emin.renegade && !mon.mpeaceful);
    assert.equal(await tamedog(mon, null, false), false, 'minion becomes peaceful without becoming a pet');
    assert.ok(mon.mpeaceful && mon.emin.renegade && !mon.mtame);
    await speak(mon, true);
});

test('hostile minion keeps the already-fixed cuss path', async () => {
    await setup();
    const mon = await mk_roamer(game.mons[P.PM_ANGEL], C.A_LAWFUL, x + 1, y, false);
    assert.ok(!mon.mpeaceful && !mon.emin.renegade);
    clearMessages();
    seed(2);
    assert.equal(await domonnoise(mon), C.ECMD_TIME);
    assert.deepEqual(getRngLog().map(call => call.split('=')[0]),
        ['rn2(3)', 'rn2(2)', 'rn2(14)']);
    assert.notEqual(messages(), good);
    assert.notEqual(messages(), bad);
});

test('real Deaf status returns before classification and message', async () => {
    const run = await setup();
    const mon = await archon(run);
    await make_deaf(10, false);
    clearMessages();
    seed(2);
    assert.equal(await domonnoise(mon), C.ECMD_OK);
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), []);
});

test('silent species returns before peaceful classification', async () => {
    await setup();
    const mon = await mk_roamer(game.mons[P.PM_HORNED_DEVIL], C.A_LAWFUL, x + 1, y, true);
    clearMessages();
    seed(2);
    assert.equal(await domonnoise(mon), C.ECMD_OK);
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), []);
});

function direction(mon) {
    const directions = new Map([
        ['-1,-1', 'y'], ['0,-1', 'k'], ['1,-1', 'u'], ['-1,0', 'h'],
        ['1,0', 'l'], ['-1,1', 'b'], ['0,1', 'j'], ['1,1', 'n'],
    ]);
    const key = directions.get(`${mon.mx - game.u.ux},${mon.my - game.u.uy}`);
    assert.ok(key, 'the real creation producer placed an adjacent monster');
    return key.charCodeAt(0);
}

test('dochat reads the real direction and returns the owner result', async () => {
    const run = await setup();
    const mon = await archon(run);
    clearMessages();
    seed(2);
    run._display.clearInputQueue();
    run._display.pushKey(direction(mon));
    assert.equal(await dochat(), C.ECMD_TIME);
    assert.ok(messages().includes(good));
    assert.equal(mon.mstrategy & C.STRAT_WAITMASK, 0);
    assert.deepEqual(getRngLog(), []);
});

test('peaceful speech has no cuss wakeup tail', async () => {
    await setup();
    const mon = await mk_roamer(game.mons[P.PM_ANGEL], C.A_LAWFUL, x + 1, y, true);
    const sleeper = await makemon(game.mons[P.PM_NEWT], x + 2, y, creationFlags | C.MM_ASLEEP);
    assert.ok(sleeper.msleeping);
    await speak(mon, true);
    assert.ok(sleeper.msleeping);
});

test('peaceful response waits for a real More before returning ECMD_TIME', async () => {
    const run = await setup();
    const mon = await archon(run);
    clearMessages();
    await pline('An earlier long message occupies the line before the monster speaks.');
    seed(2);
    let enter;
    let release;
    let timer;
    let complete = false;
    const waiting = new Promise(resolve => { enter = resolve; });
    run._display.clearInputQueue();
    run._display.onEmptyQueue = () => {
        enter();
        return new Promise(resolve => { release = resolve; });
    };
    const operation = domonnoise(mon).then(result => {
        complete = true;
        return result;
    });
    try {
        await Promise.race([waiting, operation.then(() => {
            throw Error('expected real pending More');
        }), new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error('More did not arrive')), 2000);
        })]);
        await setImmediate();
        assert.equal(complete, false);
        assert.deepEqual(getRngLog(), []);
    } finally {
        clearTimeout(timer);
        run._display.onEmptyQueue = () => 32;
        release?.(32);
        assert.equal(await operation, C.ECMD_TIME);
    }
    assert.ok(messages().includes(good));
});

test('dochat remains pending until its real direction input is supplied', async () => {
    const run = await setup();
    const mon = await archon(run);
    clearMessages();
    seed(2);
    let enter;
    let release;
    let timer;
    let complete = false;
    const waiting = new Promise(resolve => { enter = resolve; });
    run._display.clearInputQueue();
    run._display.onEmptyQueue = () => {
        enter();
        return new Promise(resolve => { release = resolve; });
    };
    const operation = dochat().then(result => {
        complete = true;
        return result;
    });
    try {
        await Promise.race([waiting, new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error('direction prompt did not arrive')), 2000);
        })]);
        await setImmediate();
        assert.equal(complete, false);
        assert.deepEqual(getRngLog(), []);
    } finally {
        clearTimeout(timer);
        run._display.onEmptyQueue = () => 32;
        release?.(direction(mon));
        assert.equal(await operation, C.ECMD_TIME);
    }
    assert.ok(messages().includes(good));
});
