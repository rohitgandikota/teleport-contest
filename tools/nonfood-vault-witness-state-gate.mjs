// Constructed source controls with real guard, vision and message producers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { setup, seed, clearMessages, messages, x, y } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import * as vault from '../js/vault.js';
import { makemon } from '../js/makemon.js';
import { set_itimeout } from '../js/potion.js';
import { pline } from '../js/display.js';
import { getRngLog } from '../js/rng.js';
import { PMNAMES } from '../js/monst_data.js';
import { GD_EATGOLD, GD_DESTROYGOLD, MM_EGD, MM_NOMSG, NO_MINVENT,
    ROOM, ROOMOFFSET, VAULT } from '../js/const.js';

async function fixture() {
    const run = await setup();
    const guard = await makemon(game.mons[PMNAMES.PM_GUARD], x + 1, y,
        MM_EGD | MM_NOMSG | NO_MINVENT);
    assert.ok(guard?.mextra?.egd);
    guard.isgd = 1;
    guard.mpeaceful = 1;
    Object.assign(guard.mextra.egd, {
        gdlevel: { ...game.u.uz }, ogx: guard.mx, ogy: guard.my,
        witness: 0, gddone: 0, warncnt: 0, dropgoldcnt: 0,
        fcbeg: 0, fcend: 1, gdx: x + 2, gdy: y, vroom: 0,
        fakecorr: [{ fx: guard.mx, fy: guard.my, ftyp: ROOM, flags: 0 }],
    });
    game.level.rooms[0].rtype = VAULT;
    game.u.urooms = String.fromCharCode(ROOMOFFSET);
    clearMessages();
    seed();
    return { run, guard, egd: guard.mextra.egd };
}

for (const [activity, verb] of [[GD_EATGOLD, 'consume'], [GD_DESTROYGOLD, 'destroy']]) {
    test(`visible guard records and consumes ${verb} witness before ordinary escort logic`, async () => {
        const { guard, egd } = await fixture();
        assert.equal(typeof vault.vault_gd_watching, 'function');
        assert.equal(vault.vault_gd_watching(activity), undefined);
        assert.equal(egd.witness, activity);
        assert.equal(guard.mpeaceful, 1);
        assert.equal(await vault.gd_move(guard), -1);
        assert.equal(egd.witness, 0);
        assert.equal(guard.mpeaceful, 0);
        assert.match(messages(), new RegExp(`How dare you ${verb} that gold`));
        assert.deepEqual(getRngLog(), []);
    });
}

for (const condition of ['blind guard', 'invisible hero', 'underwater hero', 'unrecognized activity']) {
    test(`watching keeps the prior witness for ${condition}`, async () => {
        const { guard, egd } = await fixture();
        egd.witness = GD_DESTROYGOLD;
        if (condition === 'blind guard')
            guard.mcansee = 0;
        if (condition === 'invisible hero')
            set_itimeout('HInvis', 10);
        if (condition === 'underwater hero')
            game.u.uinwater = true;
        const activity = condition === 'unrecognized activity' ? 3 : GD_EATGOLD;
        assert.equal(typeof vault.vault_gd_watching, 'function');
        vault.vault_gd_watching(activity);
        assert.equal(egd.witness, GD_DESTROYGOLD);
        assert.deepEqual(getRngLog(), []);
    });
}

test('deaf hero still triggers hostility and witness disposal without speech', async () => {
    const { guard, egd } = await fixture();
    set_itimeout('HDeaf', 10);
    egd.witness = GD_EATGOLD;
    assert.equal(await vault.gd_move(guard), -1);
    assert.equal(egd.witness, 0);
    assert.equal(guard.mpeaceful, 0);
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), []);
});

test('teleported guard exits before consuming its witness', async () => {
    const { guard, egd } = await fixture();
    egd.ogx = guard.mx - 3;
    egd.witness = GD_EATGOLD;
    assert.equal(await vault.gd_move(guard), -1);
    assert.equal(egd.witness, GD_EATGOLD);
    assert.equal(guard.mpeaceful, 1);
    assert.deepEqual(getRngLog(), []);
});

test('pending real More retains the witness and peaceful state until speech completes', async () => {
    const { run, guard, egd } = await fixture();
    egd.witness = GD_EATGOLD;
    await pline('A previous message occupies the top line.');
    run._display.clearInputQueue();
    run._display.onEmptyQueue = null;
    let settled = false;
    const pending = vault.gd_move(guard).then(result => {
        settled = true;
        return result;
    });
    await setImmediate();
    assert.equal(settled, false);
    assert.equal(egd.witness, GD_EATGOLD);
    assert.equal(guard.mpeaceful, 1);
    run._display.pushKey(32);
    assert.equal(await pending, -1);
    assert.equal(egd.witness, 0);
    assert.equal(guard.mpeaceful, 0);
    assert.deepEqual(getRngLog(), []);
});
