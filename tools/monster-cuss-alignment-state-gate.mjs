// C wizard.c:846 cuss and priest.c:280 mon_aligntyp, through real producers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { setup, seed, clearMessages, messages, x, y } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { cuss } from '../js/wizard.js';
import { makemon } from '../js/makemon.js';
import { mk_roamer, priestini, mon_aligntyp } from '../js/priest.js';
import { set_mon_data } from '../js/mondata.js';
import { set_levltyp } from '../js/mkmaze.js';
import { make_deaf } from '../js/potion.js';
import { pline } from '../js/display.js';
import { getRngLog } from '../js/rng.js';
import { PMNAMES as P, MFLAGS } from '../js/monst_data.js';
import * as C from '../js/const.js';

const creationFlags = C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG;
async function create(species, dx = 1, extraFlags = 0) {
    const mon = await makemon(game.mons[species], x + dx, y, creationFlags | extraFlags);
    assert.ok(mon);
    assert.equal(mon.data, game.mons[species]);
    return mon;
}

async function speak(mon, angel) {
    clearMessages();
    seed(2);
    const operation = cuss(mon);
    assert.ok(operation instanceof Promise, 'the owner retains its async contract');
    assert.equal(await operation, undefined, 'C void owner has no gameplay return value');
    const log = getRngLog();
    const calls = log.map(entry => entry.split('=')[0]);
    if (angel) {
        assert.deepEqual(calls, ['rn2(3)', 'rn2(2)', 'rn2(14)']);
    } else {
        const modulus = mon.data.mflags2 & MFLAGS.M2_MINION ? 100 : 5;
        assert.equal(calls[0], `rn2(${modulus})`);
        assert.deepEqual(calls.slice(1), log[0].endsWith('=0')
            ? [] : ['rn2(3)', 'rn2(2)', 'rn2(27)']);
    }
    assert.ok(messages().length > 0);
}

for (const species of [P.PM_COUATL, P.PM_KI_RIN, P.PM_ARCHON]) {
    test(`species alignment magnitude is normalized: ${species}`, async () => {
        await setup();
        const mon = await create(species);
        assert.ok(mon.data.maligntyp > C.A_LAWFUL);
        assert.ok(!mon.ispriest && !mon.isminion);
        const before = [...getRngLog()];
        assert.equal(mon_aligntyp(mon), C.A_LAWFUL);
        assert.deepEqual(getRngLog(), before, 'alignment classification has no RNG');
        await speak(mon, true);
    });
}

for (const alignment of [C.A_LAWFUL, C.A_NEUTRAL, C.A_CHAOTIC, C.A_NONE]) {
    test(`roamer alignment overrides lawful species: ${alignment}`, async () => {
        await setup();
        const mon = await mk_roamer(game.mons[P.PM_ANGEL], alignment, x + 1, y, true);
        assert.ok(mon?.isminion && !mon.ispriest);
        assert.equal(mon.emin.min_align, alignment);
        assert.equal(mon.emin.renegade, false);
        assert.equal(mon_aligntyp(mon), alignment);
        await speak(mon, alignment === C.A_LAWFUL);
    });
}

async function priest(alignment, changeSpecies) {
    const ax = x + 2;
    assert.equal(set_levltyp(ax, y, C.ALTAR), true);
    game.level.at(ax, y).altarmask = C.Align2amask(alignment) | C.AM_SHRINE;
    // priestini is called during temple/altar construction, before live play.
    const inMklev = game.in_mklev;
    try {
        game.in_mklev = true;
        priestini(game.u.uz, game.level.rooms[0], ax, y, false);
    } finally {
        game.in_mklev = inMklev;
    }
    const mon = game.level.monsters.find(candidate => candidate.ispriest);
    assert.ok(mon?.epri && !mon.isminion);
    assert.equal(mon.epri.shralign, alignment);
    if (changeSpecies)
        set_mon_data(mon, game.mons[P.PM_COUATL]);
    return mon;
}

for (const alignment of [C.A_LAWFUL, C.A_NEUTRAL, C.A_CHAOTIC, C.A_NONE]) {
    test(`priest keeps shrine alignment after species change: ${alignment}`, async () => {
        await setup();
        const mon = await priest(alignment, true);
        assert.ok(mon.data.mflags2 & MFLAGS.M2_MINION);
        assert.equal(mon_aligntyp(mon), alignment);
        await speak(mon, alignment === C.A_LAWFUL);
    });
}

test('lawful alignment alone does not make a species a minion', async () => {
    await setup();
    const mon = await priest(C.A_LAWFUL, false);
    assert.equal(mon_aligntyp(mon), C.A_LAWFUL);
    assert.equal(mon.data.mflags2 & MFLAGS.M2_MINION, 0);
    await speak(mon, false);
});

test('renegade lawful minion retains the demon branch', async () => {
    await setup();
    game.u.ualign.type = C.A_LAWFUL;
    const mon = await mk_roamer(game.mons[P.PM_ANGEL], C.A_LAWFUL, x + 1, y, false);
    assert.equal(mon_aligntyp(mon), C.A_LAWFUL);
    assert.equal(mon.emin.renegade, true, 'real roamer producer assigns renegade');
    await speak(mon, false);
});

test('ordinary non-minion retains its five-way aspersion roll', async () => {
    await setup();
    const mon = await create(P.PM_HORNED_DEVIL);
    assert.equal(mon.data.mflags2 & MFLAGS.M2_MINION, 0);
    await speak(mon, false);
});

test('Wizard owner branch keeps priority and its own RNG', async () => {
    await setup();
    const mon = await create(P.PM_WIZARD_OF_YENDOR);
    assert.ok(mon.iswiz);
    clearMessages();
    seed(2);
    assert.equal(await cuss(mon), undefined);
    assert.match(getRngLog()[0], /^rn2\(5\)=/);
    assert.ok(!getRngLog().some(entry => /^rn2\((14|27|100)\)=/.test(entry)));
    assert.ok(messages().length > 0);
});

test('real deafness returns before text, RNG and nearby wakeup', async () => {
    await setup();
    const mon = await create(P.PM_ARCHON);
    const sleeper = await create(P.PM_NEWT, 2, C.MM_ASLEEP);
    await make_deaf(10, false);
    clearMessages();
    seed(2);
    assert.equal(await cuss(mon), undefined);
    assert.deepEqual(getRngLog(), []);
    assert.equal(messages(), '');
    assert.ok(sleeper.msleeping);
});

test('cuss wakes only monsters strictly inside its squared radius', async () => {
    await setup();
    const mon = await create(P.PM_COUATL);
    const near = await create(P.PM_NEWT, 2, C.MM_ASLEEP);
    const edge = await create(P.PM_NEWT, -4, C.MM_ASLEEP);
    assert.ok(near.msleeping && edge.msleeping);
    await speak(mon, true);
    assert.equal(near.msleeping, 0);
    assert.ok(edge.msleeping, 'distance squared 25 is outside C strict-less-than bound');
});

test('pending More completes before the wakeup tail', async () => {
    const run = await setup();
    const mon = await create(P.PM_COUATL);
    const sleeper = await create(P.PM_NEWT, 2, C.MM_ASLEEP);
    clearMessages();
    await pline('An earlier long message occupies the line before the monster speaks.');
    seed(2);
    let entered;
    let release;
    let timer;
    let finished = false;
    const waiting = new Promise(resolve => { entered = resolve; });
    run._display.clearInputQueue();
    run._display.onEmptyQueue = () => {
        entered();
        return new Promise(resolve => { release = resolve; });
    };
    const operation = cuss(mon).then(result => {
        finished = true;
        return result;
    });
    try {
        await Promise.race([waiting, operation.then(() => {
            throw Error('expected a real pending More');
        }), new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error('More did not arrive')), 2000);
        })]);
        await setImmediate();
        assert.equal(finished, false);
        assert.ok(sleeper.msleeping, 'wake_nearto has not run through the pending message');
        assert.deepEqual(getRngLog().map(entry => entry.split('=')[0]),
            ['rn2(3)', 'rn2(2)', 'rn2(14)']);
    } finally {
        clearTimeout(timer);
        run._display.onEmptyQueue = () => 32;
        release?.(32);
        assert.equal(await operation, undefined);
    }
    assert.equal(sleeper.msleeping, 0);
});
