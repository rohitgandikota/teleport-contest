// C mhitu.c:1047-1084. Real equipment producers and constructed owner boundaries.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup, seed, clearMessages, messages} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {u_slip_free} from '../js/mhitu.js';
import {mhitm_ad_phys, mhitm_ad_drin} from '../js/uhitm.js';
import {makemon} from '../js/makemon.js';
import {mksobj, curse, uncurse} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {setworn} from '../js/worn.js';
import {doapply} from '../js/apply.js';
import {makeknown} from '../js/o_init.js';
import {msgtype_parse_add} from '../js/options.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P, ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function prepare(species = P.PM_OWLBEAR) {
    const run = await setup();
    const mon = await makemon(game.mons[species], 32, 10,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    assert.ok(mon);
    game.flags.accessiblemsg = true;
    game.iflags.getpos_coords = 'm';
    clearMessages();
    return {run, mon};
}
const hug = mon => mon.data.mattk.find(a => a[0] === A.AT_HUGS);
const drain = mon => mon.data.mattk.find(a => a[1] === A.AD_DRIN);

async function armor(run, type, mask, greased = false) {
    const obj = await addinv(mksobj(type, false, false));
    if (greased) {
        const can = await addinv(mksobj(O.CAN_OF_GREASE, true, false));
        await uncurse(can);
        const charges = can.spe;
        assert.ok(charges > 0);
        clearMessages();
        run._display.pushKey(can.invlet.charCodeAt(0));
        run._display.pushKey(obj.invlet.charCodeAt(0));
        assert.equal(await doapply(), C.ECMD_TIME);
        assert.equal(can.spe, charges - 1);
        assert.equal(obj.greased, 1);
    }
    if (mask) await setworn(obj, mask);
    assert.equal(obj.where, C.OBJ_INVENT);
    clearMessages();
    return obj;
}

test('no selected armor returns false without a draw or message', async () => {
    const {mon} = await prepare(); seed(0);
    assert.equal(await u_slip_free(mon, hug(mon)), false);
    assert.deepEqual(getRngLog(), []);
    assert.equal(messages(), '');
});
for (const known of [false, true]) for (const mode of ['uncursed', 'cursed fail', 'cursed pass']) {
    test(`oilskin known=${known}, ${mode}`, async () => {
        const {run, mon} = await prepare();
        const cloak = await armor(run, O.OILSKIN_CLOAK, C.W_ARMC);
        assert.equal(!!game.objects[O.OILSKIN_CLOAK].oc_name_known, false);
        if (known) makeknown(O.OILSKIN_CLOAK);
        if (mode !== 'uncursed') await curse(cloak);
        clearMessages(); seed(mode === 'cursed pass' ? 2 : 0);
        const success = mode !== 'cursed fail';
        assert.equal(await u_slip_free(mon, hug(mon)), success);
        assert.equal(!!cloak.greased, false);
        assert.deepEqual(getRngLog(), mode === 'uncursed' ? []
            : [mode === 'cursed pass' ? 'rn2(3)=1' : 'rn2(3)=0']);
        if (success) {
            assert.match(messages(), known
                ? /<32,10>: The owlbear grabs you, but cannot hold onto your slippery oilskin[ \n]+cloak!/
                : /<32,10>: The owlbear grabs you, but cannot hold onto your slippery cloak!/);
            assert.doesNotMatch(messages(), /slippery slippery|grease wears off/);
        } else assert.equal(messages(), '');
    });
}
const greaseCases = [
    {name:'uncursed retained', cursed:false, seed:0, success:true, remains:1, calls:['rn2(2)=1']},
    {name:'uncursed worn off', cursed:false, seed:4, success:true, remains:0, calls:['rn2(2)=0']},
    {name:'cursed failure', cursed:true, seed:0, success:false, remains:1, calls:['rn2(3)=0']},
    {name:'cursed worn off', cursed:true, seed:2, success:true, remains:0, calls:['rn2(3)=1','rn2(2)=0']},
    {name:'cursed retained', cursed:true, seed:4, success:true, remains:1, calls:['rn2(3)=2','rn2(2)=1']},
];
for (const entry of greaseCases) test(`actual can greases body armor: ${entry.name}`, async () => {
    const {run, mon} = await prepare();
    const jacket = await armor(run, O.LEATHER_JACKET, C.W_ARM, true);
    if (entry.cursed) await curse(jacket);
    clearMessages(); seed(entry.seed);
    assert.equal(await u_slip_free(mon, hug(mon)), entry.success);
    assert.equal(jacket.greased, entry.remains);
    assert.deepEqual(getRngLog(), entry.calls);
    if (entry.success) assert.match(messages(), /<32,10>: The owlbear grabs you, but cannot hold onto your greased leather[ \n]+jacket!/);
    else assert.equal(messages(), '');
    assert.equal(messages().includes('The grease wears off.'), entry.remains === 0);
    assert.equal(jacket.where, C.OBJ_INVENT);
    assert.equal(game.u.uarm, jacket);
});
for (const outer of ['cloak', 'body', 'none']) test(`shirt protection with ${outer} over it`, async () => {
    const {run, mon} = await prepare();
    const shirt = await armor(run, O.T_SHIRT, C.W_ARMU, true);
    if (outer === 'body') await armor(run, O.LEATHER_JACKET, C.W_ARM);
    if (outer === 'cloak') await armor(run, O.ROBE, C.W_ARMC);
    clearMessages(); seed(0);
    assert.equal(await u_slip_free(mon, hug(mon)), outer === 'none');
    assert.equal(shirt.greased, 1);
    assert.deepEqual(getRngLog(), outer === 'none' ? ['rn2(2)=1'] : []);
    if (outer === 'none') assert.match(messages(), /your greased T-shirt!/);
    else assert.equal(messages(), '');
});
test('dry cloak masks greased body armor', async () => {
    const {run, mon} = await prepare();
    const jacket = await armor(run, O.LEATHER_JACKET, C.W_ARM, true);
    await armor(run, O.ROBE, C.W_ARMC); clearMessages(); seed(0);
    assert.equal(await u_slip_free(mon, hug(mon)), false);
    assert.equal(jacket.greased, 1);
    assert.deepEqual(getRngLog(), []);
});
for (const helmet of ['absent', 'dry', 'greased']) test(`brain attack selects ${helmet} helmet instead of oilskin`, async () => {
    const {run, mon} = await prepare(P.PM_MIND_FLAYER);
    await armor(run, O.OILSKIN_CLOAK, C.W_ARMC);
    let helm;
    if (helmet !== 'absent') {
        helm = await armor(run, O.HELMET, C.W_ARMH, helmet === 'greased');
        makeknown(O.HELMET);
    }
    clearMessages(); seed(0);
    assert.equal(await u_slip_free(mon, drain(mon)), helmet === 'greased');
    assert.deepEqual(getRngLog(), helmet === 'greased' ? ['rn2(2)=1'] : []);
    if (helm) assert.equal(game.u.uarmh, helm);
    if (helmet === 'greased') assert.match(messages(), /<32,10>: The mind flayer grabs you, but cannot hold onto your greased helmet!/);
    else assert.equal(messages(), '');
});
test('greased helmet does not protect an ordinary body grab', async () => {
    const {run, mon} = await prepare();
    const helm = await armor(run, O.HELMET, C.W_ARMH, true); seed(0);
    assert.equal(await u_slip_free(mon, hug(mon)), false);
    assert.equal(helm.greased, 1);
    assert.deepEqual(getRngLog(), []);
});
test('engulf exits before cursed oilskin or wear-off draws', async () => {
    const {run, mon} = await prepare(P.PM_AIR_ELEMENTAL);
    const cloak = await armor(run, O.OILSKIN_CLOAK, C.W_ARMC, true);
    await curse(cloak); clearMessages(); seed(4);
    const attack = mon.data.mattk.find(a => a[0] === A.AT_ENGL);
    assert.ok(attack);
    assert.equal(await u_slip_free(mon, attack), false);
    assert.equal(cloak.greased, 1);
    assert.deepEqual(getRngLog(), []);
    assert.equal(messages(), '');
});
test('actual wrap attack chooses slip wording', async () => {
    const {run, mon} = await prepare(P.PM_PYTHON);
    await armor(run, O.OILSKIN_CLOAK, C.W_ARMC);
    const attack = mon.data.mattk.find(a => a[1] === A.AD_WRAP);
    assert.ok(attack); seed(0);
    assert.equal(await u_slip_free(mon, attack), true);
    assert.match(messages(), /<32,10>: The python slips off of your slippery cloak!/);
    assert.deepEqual(getRngLog(), []);
});
test('accessible off consumes location without changing protection', async () => {
    const {run, mon} = await prepare();
    await armor(run, O.OILSKIN_CLOAK, C.W_ARMC);
    game.flags.accessiblemsg = false; seed(0);
    assert.equal(await u_slip_free(mon, hug(mon)), true);
    assert.match(messages(), /The owlbear grabs you, but cannot hold onto your slippery cloak!/);
    assert.doesNotMatch(messages(), /<32,10>/);
    assert.deepEqual(game.a11y.msg_loc, {x:0, y:0});
    assert.deepEqual(getRngLog(), []);
});

async function pendingMore(run, action, inspect) {
    let entered, release, complete = false, timer, result;
    const enteredMore = new Promise(resolve => { entered = resolve; });
    run._display.onEmptyQueue = () => {
        entered();
        return new Promise(resolve => { release = resolve; });
    };
    const pending = action().then(value => { complete = true; return value; });
    try {
        await Promise.race([enteredMore, pending.then(() => { throw Error('expected More'); }),
            new Promise((_, reject) => { timer = setTimeout(() => reject(Error('More timeout')), 2000); })]);
        await setImmediate();
        assert.equal(complete, false);
        inspect();
    } finally {
        clearTimeout(timer);
        run._display.onEmptyQueue = () => 32;
        release?.(32);
        result = await pending;
    }
    assert.equal(complete, true);
    return result;
}
test('protection More precedes wear-off RNG and true return', async () => {
    const {run, mon} = await prepare();
    const jacket = await armor(run, O.LEATHER_JACKET, C.W_ARM, true);
    assert.ok(msgtype_parse_add('stop "cannot hold onto"')); seed(4);
    assert.equal(await pendingMore(run, () => u_slip_free(mon, hug(mon)), () => {
        assert.match(game._toplines, /<32,10>: The owlbear grabs/);
        assert.equal(jacket.greased, 1);
        assert.deepEqual(getRngLog(), []);
    }), true);
    assert.equal(jacket.greased, 0);
    assert.deepEqual(getRngLog(), ['rn2(2)=0']);
});
test('wear-off More precedes clearing actual grease', async () => {
    const {run, mon} = await prepare();
    const jacket = await armor(run, O.LEATHER_JACKET, C.W_ARM, true);
    assert.ok(msgtype_parse_add('hide "cannot hold onto"'));
    assert.ok(msgtype_parse_add('stop "grease wears off"')); seed(4);
    assert.equal(await pendingMore(run, () => u_slip_free(mon, hug(mon)), () => {
        assert.equal(game._toplines, 'The grease wears off.');
        assert.equal(jacket.greased, 1);
        assert.deepEqual(getRngLog(), ['rn2(2)=0']);
    }), true);
    assert.equal(jacket.greased, 0);
});
test('physical caller waits before cancelling damage and never assigns a holder', async () => {
    const {run, mon} = await prepare();
    await armor(run, O.OILSKIN_CLOAK, C.W_ARMC);
    assert.ok(msgtype_parse_add('stop "cannot hold onto"'));
    const mhm = {damage:3, done:false, hitflags:C.M_ATTK_MISS}; seed(0);
    await pendingMore(run, () => mhitm_ad_phys(mon, hug(mon), game.youmonst, mhm), () => {
        assert.match(game._toplines, /<32,10>: The owlbear grabs/);
        assert.equal(mhm.damage, 3);
        assert.equal(game.u.ustuck, null);
    });
    assert.equal(mhm.damage, 0);
    assert.equal(game.u.ustuck, null);
    assert.deepEqual(getRngLog(), ['rn2(2)=1']);
});
test('brain caller returns before helmet-block or brain-damage draws', async () => {
    const {run, mon} = await prepare(P.PM_MIND_FLAYER);
    await armor(run, O.HELMET, C.W_ARMH, true);
    const hp = game.u.uhp, intelligence = game.u.acurr.a[C.A_INT];
    const mhm = {damage:3, done:false, hitflags:C.M_ATTK_MISS, indx:1}; seed(0);
    await mhitm_ad_drin(mon, drain(mon), game.youmonst, mhm);
    assert.equal(game.u.uhp, hp);
    assert.equal(game.u.acurr.a[C.A_INT], intelligence);
    assert.equal(mhm.damage, 3);
    assert.deepEqual(getRngLog(), ['rn2(2)=1']);
    assert.match(messages(), /<32,10>: The mind flayer grabs/);
});
