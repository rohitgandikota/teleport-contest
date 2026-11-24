// C steal.c:213-289 and do_wear.c off handlers retain slot pointers after replacement.
// These constructed controls use actual wear, removal and polymorph producers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, seed, clearMessages, messages} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {accessory_or_armor_on} from '../js/do_wear.js';
import {unmul} from '../js/hack.js';
import {addinv} from '../js/invent.js';
import {mksobj} from '../js/mkobj.js';
import {poly_obj} from '../js/zap.js';
import {pline} from '../js/display.js';
import {Fast, Very_fast} from '../js/attrib.js';
import {Stealth} from '../js/youprop.js';
import {getRngLog, rnd, rn2} from '../js/rng.js';
import {ONAMES} from '../js/objects_data.js';
import {W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU,
    A_DEX, A_INT, A_WIS, FROMEXPER} from '../js/const.js';

async function wear(type, spe = 0, complete = true) {
    const obj = await addinv(mksobj(type, false, false));
    obj.spe = spe;
    await accessory_or_armor_on(obj);
    if (complete && game.afternmv) await unmul('');
    return obj;
}

function oracle(discoverReplacement = false) {
    seed(711);
    rnd(2); // C mkobj.c:521 next_ident
    if (discoverReplacement) rn2(19); // C o_init.c:481 -> attrib.c:509
    rn2(100); // C invent.c:1446 delobj_core -> obj_resists
    const log = [...getRngLog()];
    seed(711);
    return log;
}

const cases = [
    ['suit', ONAMES.BLUE_DRAGON_SCALE_MAIL, W_ARM, 'uarm'],
    ['cloak', ONAMES.ELVEN_CLOAK, W_ARMC, 'uarmc'],
    ['boots', ONAMES.SPEED_BOOTS, W_ARMF, 'uarmf'],
    ['gloves', ONAMES.GAUNTLETS_OF_DEXTERITY, W_ARMG, 'uarmg'],
    ['helmet', ONAMES.HELM_OF_BRILLIANCE, W_ARMH, 'uarmh'],
    ['shield', ONAMES.SMALL_SHIELD, W_ARMS, 'uarms'],
    ['shirt', ONAMES.T_SHIRT, W_ARMU, 'uarmu'],
];

for (const [name, type, mask, slot] of cases) test(`replaced ${name} runs its old-slot removal`, async () => {
    await setup();
    const old = await wear(type, 2), inUse = old.in_use;
    assert.equal(game.u[slot], old);
    assert.equal(old.owornmask, mask);
    if (mask === W_ARMG) assert.equal(game.u.abon.a[A_DEX], 2);
    if (mask === W_ARMH) for (const a of [A_INT, A_WIS]) assert.equal(game.u.abon.a[a], 2);
    if (mask === W_ARM || mask === W_ARMF) assert.equal(Very_fast(), true);
    if (mask === W_ARMC) assert.equal(Stealth(), true);
    (game.context_takeoff ||= {}).mask = mask;
    clearMessages();
    const expected = oracle();
    const obj = await poly_obj(old, mask === W_ARM ? ONAMES.LEATHER_CLOAK : ONAMES.LEATHER_ARMOR);
    assert.equal(game.u[slot], null);
    assert.equal(old.owornmask | 0, 0);
    assert.equal(obj.owornmask | 0, 0, 'incompatible replacement is carried');
    assert.equal(game.invent.includes(old), false);
    assert.equal(game.invent.includes(obj), true);
    assert.equal(old.in_use, inUse);
    assert.equal(game.context_takeoff.mask & mask, 0);
    if (mask === W_ARMG) assert.equal(game.u.abon.a[A_DEX], 0);
    if (mask === W_ARMH) for (const a of [A_INT, A_WIS]) assert.equal(game.u.abon.a[a], 0);
    if (mask === W_ARM || mask === W_ARMF) {
        assert.equal(Very_fast(), false);
        assert.ok(messages().includes(mask === W_ARM ? 'You slow down.' : 'You feel yourself slow down.'));
    }
    if (mask === W_ARMC) {
        assert.equal(Stealth(), false);
        assert.ok(messages().includes('You sure are noisy.'));
    }
    assert.deepEqual(getRngLog(), expected);
});

for (const intrinsic of [false, true]) test(`speed-boots removal wording with intrinsic Fast ${intrinsic}`, async () => {
    await setup();
    game.u.intrinsic.HFast = intrinsic ? FROMEXPER : 0;
    const old = await wear(ONAMES.SPEED_BOOTS);
    clearMessages();
    const expected = oracle();
    await poly_obj(old, ONAMES.LEATHER_CLOAK);
    assert.equal(Very_fast(), false);
    assert.equal(Fast(), intrinsic);
    assert.equal(messages(), intrinsic ? 'You feel yourself slow down a bit.' : 'You feel yourself slow down.');
    assert.equal(game.context_takeoff.cancelled_don, false);
    assert.deepEqual(getRngLog(), expected);
});

test('another real speed source suppresses the boots-loss message', async () => {
    await setup();
    const old = await wear(ONAMES.SPEED_BOOTS);
    await wear(ONAMES.BLUE_DRAGON_SCALE_MAIL);
    clearMessages();
    const expected = oracle();
    await poly_obj(old, ONAMES.LEATHER_CLOAK);
    assert.equal(game.u.uprops.FAST, W_ARM);
    assert.equal(Very_fast(), true);
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), expected);
});

test('interrupted dressing suppresses Boots_off feedback and cancels pending completion', async () => {
    await setup();
    const old = await wear(ONAMES.SPEED_BOOTS, 0, false);
    assert.ok(game.afternmv);
    assert.ok(game.multi < 0);
    clearMessages();
    const expected = oracle();
    await poly_obj(old, ONAMES.LEATHER_CLOAK);
    assert.equal(game.afternmv, null);
    assert.equal(game.multi, 0);
    assert.equal(game.u.uarmf, null);
    assert.equal(game.context_takeoff.cancelled_don, false);
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), expected);
});

test('old callback completes before set_wear starts the replacement callback', async () => {
    const run = await setup();
    const old = await wear(ONAMES.SPEED_BOOTS), inUse = old.in_use;
    game.objects[ONAMES.ELVEN_BOOTS].oc_name_known = 0;
    clearMessages();
    await pline('A previous message fills this line before the next equipment effect.');
    let release, reached, settled = false;
    const waiting = new Promise(resolve => { reached = resolve; });
    run._display.onEmptyQueue = () => {
        reached();
        return new Promise(resolve => { release = resolve; });
    };
    const expected = oracle(true);
    const pending = poly_obj(old, ONAMES.ELVEN_BOOTS).then(obj => { settled = true; return obj; });
    try {
        await Promise.race([waiting, pending]);
        assert.equal(settled, false);
        assert.equal(game.u.uarmf, null, 'old boots are off; new boots are not yet equipped');
        assert.equal(game.objects[ONAMES.ELVEN_BOOTS].oc_name_known, 0);
        assert.equal(old.in_use, 1, 'removal protects the old object during the prompt');
        assert.deepEqual(getRngLog(), expected.slice(0, 1));
    } finally {
        run._display.onEmptyQueue = () => 32;
        if (release) release(32);
        await pending;
    }
    assert.equal(game.u.uarmf.otyp, ONAMES.ELVEN_BOOTS);
    assert.equal(game.u.uarmf.known, 1);
    assert.equal(old.in_use, inUse);
    assert.ok(messages().includes('slow down.'));
    assert.ok(messages().includes('walk very quietly.'));
    assert.deepEqual(getRngLog(), expected);
});
