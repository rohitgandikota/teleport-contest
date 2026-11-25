// C uhitm.c:2056-2099, 3174-3308, 3337-3429. No private exports or helper mocks.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup, seed, form, clearMessages, messages} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {mhitm_ad_drin, mhitm_ad_wrap, damageum} from '../js/uhitm.js';
import {failed_grab} from '../js/mhitm.js';
import {makemon} from '../js/makemon.js';
import {mksobj, curse, uncurse} from '../js/mkobj.js';
import {addinv, freeinv} from '../js/invent.js';
import {mpickobj} from '../js/steal.js';
import {m_dowear, which_armor, mon_set_minvis} from '../js/worn.js';
import {christen_monst} from '../js/do_name.js';
import {See_invisible} from '../js/youprop.js';
import {doapply} from '../js/apply.js';
import {makeknown} from '../js/o_init.js';
import {msgtype_parse_add} from '../js/options.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P, ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function prepare(species = P.PM_ORC_CAPTAIN, hero = P.PM_MIND_FLAYER) {
    const run = await setup();
    form(hero);
    const mon = await makemon(game.mons[species], 32, 10,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    assert.ok(mon);
    assert.equal(mon.data, game.mons[species]);
    game.notonhead = false; game.skipdrin = false;
    clearMessages();
    return {run, mon};
}
const attack = type => {
    const row = game.youmonst.data.mattk.find(a => a[1] === type);
    assert.ok(row); return row;
};
const damage = () => ({damage:2, hitflags:C.M_ATTK_HIT, done:false});
const drain = (mon, mhm) => mhitm_ad_drin(game.youmonst, attack(A.AD_DRIN), mon, mhm);

async function armor(run, mon, type, mask, greased = false, worn = true) {
    const obj = await addinv(mksobj(type, false, false));
    if (greased) {
        const can = await addinv(mksobj(O.CAN_OF_GREASE, true, false));
        await uncurse(can);
        const charges = can.spe;
        assert.ok(charges > 0);
        run._display.pushKey(can.invlet.charCodeAt(0));
        run._display.pushKey(obj.invlet.charCodeAt(0));
        assert.equal(await doapply(), C.ECMD_TIME);
        assert.equal(can.spe, charges - 1);
        assert.equal(obj.greased, 1);
    }
    await freeinv(obj);
    assert.equal(await mpickobj(mon, obj), 0);
    if (worn) {
        await m_dowear(mon, true);
        assert.equal(which_armor(mon, mask), obj);
        assert.equal(obj.owornmask, mask);
    }
    assert.equal(obj.where, C.OBJ_MINVENT);
    assert.ok(mon.minvent.includes(obj));
    clearMessages();
    return obj;
}
const greaseCases = [
    {name:'uncursed retained', cursed:false, seed:0, success:true, remains:1, calls:['rn2(2)=1']},
    {name:'uncursed worn off', cursed:false, seed:4, success:true, remains:0, calls:['rn2(2)=0']},
    {name:'cursed failure', cursed:true, seed:0, success:false, remains:1, calls:['rn2(3)=0','rn2(8)=7']},
    {name:'cursed worn off', cursed:true, seed:2, success:true, remains:0, calls:['rn2(3)=1','rn2(2)=0']},
    {name:'cursed retained', cursed:true, seed:4, success:true, remains:1, calls:['rn2(3)=2','rn2(2)=1']},
];
for (const entry of greaseCases) test(`brain drain, actual greased helmet: ${entry.name}`, async () => {
    const {run, mon} = await prepare();
    const helm = await armor(run, mon, O.DWARVISH_IRON_HELM, C.W_ARMH, true);
    if (entry.cursed) await curse(helm);
    const hp = mon.mhp, hunger = game.u.uhunger, mhm = damage();
    clearMessages(); seed(entry.seed);
    assert.equal(await drain(mon, mhm), undefined);
    assert.deepEqual(getRngLog(), entry.calls);
    assert.equal(helm.greased, entry.remains);
    assert.equal(mhm.damage, 2); // C retains ordinary attack damage on a slip.
    assert.equal(mon.mhp, hp); assert.equal(game.u.uhunger, hunger);
    assert.equal(game.skipdrin, false);
    assert.equal(which_armor(mon, C.W_ARMH), helm);
    assert.equal(helm.where, C.OBJ_MINVENT);
    if (entry.success) assert.match(messages(), /You grab, but cannot hold onto the orc-captain's greased hard[ \n]+hat!/);
    else assert.match(messages(), /helm blocks your attack/);
    assert.equal(messages().includes('The grease wears off.'), entry.remains === 0);
    assert.doesNotMatch(messages(), /eat .*brain/);
});
test('dry helmet uses its original block draw without a grease draw', async () => {
    const {run, mon} = await prepare();
    await armor(run, mon, O.DWARVISH_IRON_HELM, C.W_ARMH);
    clearMessages(); seed(0); const mhm = damage();
    await drain(mon, mhm);
    assert.deepEqual(getRngLog(), ['rn2(8)=1']);
    assert.equal(mhm.damage, 2);
    assert.match(messages(), /helm blocks your attack/);
});
for (const name of ['Jones', 'visible invisible monster']) test(`canonical possessive: ${name}`, async () => {
    const {run, mon} = await prepare();
    await armor(run, mon, O.DWARVISH_IRON_HELM, C.W_ARMH, true);
    if (name === 'visible invisible monster') {
        await mon_set_minvis(mon);
        assert.ok(See_invisible(), 'mind flayer form sees invisible targets');
    }
    else christen_monst(mon, name);
    clearMessages(); seed(0); await drain(mon, damage());
    assert.match(messages(), name === 'visible invisible monster'
        ? /cannot hold onto the invisible orc-captain's greased hard hat!/
        : /cannot hold onto Jones' greased hard hat!/);
    assert.deepEqual(getRngLog(), ['rn2(2)=1']);
});
test('next tentacle checks the helmet after real grease wears off', async () => {
    const {run, mon} = await prepare();
    const helm = await armor(run, mon, O.DWARVISH_IRON_HELM, C.W_ARMH, true);
    seed(4); await drain(mon, damage());
    assert.equal(helm.greased, 0); assert.equal(game.skipdrin, false);
    clearMessages(); await drain(mon, damage());
    assert.equal(getRngLog()[0], 'rn2(2)=0');
    assert.match(getRngLog()[1], /^rn2\(8\)=[1-7]$/);
    assert.equal(getRngLog().length, 2);
    assert.match(messages(), /helm blocks your attack/);
});
for (const kind of ['none', 'carried helmet', 'oilskin cloak', 'greased suit']) {
    test(`brain drain ignores ${kind} as head protection`, async () => {
        const {run, mon} = await prepare();
        if (kind === 'carried helmet') await armor(run, mon, O.DWARVISH_IRON_HELM, C.W_ARMH, true, false);
        if (kind === 'oilskin cloak') await armor(run, mon, O.OILSKIN_CLOAK, C.W_ARMC);
        if (kind === 'greased suit') await armor(run, mon, O.LEATHER_JACKET, C.W_ARM, true);
        const hunger = game.u.uhunger, mhm = damage(); clearMessages(); seed(0);
        await drain(mon, mhm);
        assert.match(messages(), /You eat the orc-captain's brain!/);
        assert.doesNotMatch(messages(), /cannot hold|grease wears/);
        assert.equal(getRngLog()[0], 'rnd(10)=6');
        assert.ok(!getRngLog().some(x => /^rn2\([238]\)/.test(x)));
        assert.ok(mhm.damage > 2); assert.ok(game.u.uhunger > hunger);
    });
}
for (const offHead of [false, true]) test(`brain exclusion: ${offHead ? 'off-head' : 'headless'}`, async () => {
    const {run, mon} = await prepare(offHead ? P.PM_ORC_CAPTAIN : P.PM_GREEN_SLIME);
    if (offHead) {
        await armor(run, mon, O.DWARVISH_IRON_HELM, C.W_ARMH, true);
        game.notonhead = true; // Caller boundary, no ordinary headless-helmet claim.
    }
    const mhm = damage(); clearMessages(); seed(0); await drain(mon, mhm);
    assert.equal(mhm.damage, 0); assert.equal(game.skipdrin, true);
    assert.deepEqual(getRngLog(), []);
    assert.doesNotMatch(messages(), /cannot hold|blocks your|eat .*brain/);
    // Slime timeout is a separate known caller omission, not asserted here.
});

// C's tailmiss = !notonhead and failed_grab exclude ordinary hero body slips.
// These direct wrap boundaries deliberately bypass that outer caller guard.
async function wrapSetup() {
    const fixture = await prepare(P.PM_ORC_CAPTAIN, P.PM_MIND_FLAYER);
    game.notonhead = true;
    return fixture;
}
const wrap = (mon, mhm) => {
    form(P.PM_PYTHON); // Gear was greased while the constructed hero had hands.
    return mhitm_ad_wrap(game.youmonst, attack(A.AD_WRAP), mon, mhm);
};
for (const known of [false, true]) for (const mode of ['uncursed', 'cursed fail', 'cursed pass']) {
    test(`constructed wrap oilskin known=${known}, ${mode}`, async () => {
        const {run, mon} = await wrapSetup();
        const cloak = await armor(run, mon, O.OILSKIN_CLOAK, C.W_ARMC);
        if (known) makeknown(O.OILSKIN_CLOAK);
        if (mode !== 'uncursed') await curse(cloak);
        const mhm = damage(); clearMessages(); seed(mode === 'cursed pass' ? 19 : 11);
        await wrap(mon, mhm);
        const success = mode !== 'cursed fail';
        assert.deepEqual(getRngLog(), mode === 'uncursed' ? ['rn2(10)=0']
            : ['rn2(10)=0', mode === 'cursed pass' ? 'rn2(3)=1' : 'rn2(3)=0']);
        assert.equal(mhm.damage, success ? 0 : 2);
        assert.equal(game.u.ustuck, success ? null : mon);
        assert.equal(!!cloak.greased, false);
        if (success) assert.match(messages(), known ? /slippery oilskin cloak!/ : /slippery cloak!/);
        else assert.match(messages(), /coil yourself around/);
        assert.doesNotMatch(messages(), /slippery slippery|grease wears/);
    });
}
for (const slot of ['cloak', 'suit', 'shirt']) test(`constructed wrap greased ${slot} keeps ownership`, async () => {
    const {run, mon} = await wrapSetup();
    const [type, mask] = {cloak:[O.ROBE,C.W_ARMC],suit:[O.LEATHER_JACKET,C.W_ARM],shirt:[O.T_SHIRT,C.W_ARMU]}[slot];
    const obj = await armor(run, mon, type, mask, true);
    const mhm = damage(); clearMessages(); seed(19); await wrap(mon, mhm);
    assert.deepEqual(getRngLog(), ['rn2(10)=0','rn2(2)=0']);
    assert.equal(mhm.damage, 0); assert.equal(game.u.ustuck, null);
    assert.equal(obj.greased, 0); assert.equal(which_armor(mon, mask), obj);
    assert.equal(obj.where, C.OBJ_MINVENT);
    assert.match(messages(), /You slip off of .*greased/);
});
test('constructed wrap greased unknown oilskin uses its actual object name', async () => {
    const {run, mon} = await wrapSetup();
    await armor(run, mon, O.OILSKIN_CLOAK, C.W_ARMC, true);
    assert.equal(!!game.objects[O.OILSKIN_CLOAK].oc_name_known, false);
    clearMessages(); seed(19); await wrap(mon, damage());
    assert.match(messages(), /greased slippery cloak!/);
    assert.deepEqual(getRngLog(), ['rn2(10)=0','rn2(2)=0']);
});
for (const outer of ['cloak', 'suit']) test(`constructed wrap dry ${outer} hides greased shirt`, async () => {
    const {run, mon} = await wrapSetup();
    const shirt = await armor(run, mon, O.T_SHIRT, C.W_ARMU, true);
    await armor(run, mon, outer === 'cloak' ? O.ROBE : O.LEATHER_JACKET,
        outer === 'cloak' ? C.W_ARMC : C.W_ARM);
    clearMessages(); seed(11); const mhm = damage(); await wrap(mon, mhm);
    assert.deepEqual(getRngLog(), ['rn2(10)=0']);
    assert.equal(shirt.greased, 1); assert.equal(game.u.ustuck, mon);
    assert.equal(mhm.damage, 2); assert.match(messages(), /coil yourself around/);
});
test('constructed wrap ignores greased helmet', async () => {
    const {run, mon} = await wrapSetup();
    const helm = await armor(run, mon, O.DWARVISH_IRON_HELM, C.W_ARMH, true);
    clearMessages(); seed(11); const mhm = damage(); await wrap(mon, mhm);
    assert.deepEqual(getRngLog(), ['rn2(10)=0']);
    assert.equal(helm.greased, 1); assert.equal(game.u.ustuck, mon);
});
test('head-target wrap retains pinned C tailmiss quirk', async () => {
    const {run, mon} = await wrapSetup();
    await armor(run, mon, O.OILSKIN_CLOAK, C.W_ARMC);
    game.notonhead = false; clearMessages(); seed(11);
    const mhm = damage(); await wrap(mon, mhm);
    assert.equal(mhm.damage, 0); assert.equal(game.u.ustuck, null);
    assert.deepEqual(getRngLog(), []); assert.match(messages(), /brush against .*tail/);
});
test('failed_grab rejects off-head wrap before the owner can draw', async () => {
    const {mon} = await wrapSetup(); form(P.PM_PYTHON); seed(11);
    assert.equal(await failed_grab(game.youmonst, mon, attack(A.AD_WRAP)), true);
    assert.deepEqual(getRngLog(), []); assert.match(messages(), /fails to hold .*tail/);
});
test('monster against monster brain drain does not use hero-only slippery armor', async () => {
    const {run, mon} = await prepare();
    const magr = await makemon(game.mons[P.PM_MIND_FLAYER], 33, 10,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    const helm = await armor(run, mon, O.DWARVISH_IRON_HELM, C.W_ARMH, true);
    game.vis = true; clearMessages(); seed(0); const mhm = damage();
    await mhitm_ad_drin(magr, magr.data.mattk.find(a => a[1] === A.AD_DRIN), mon, mhm);
    assert.deepEqual(getRngLog(), ['rn2(8)=1']);
    assert.equal(helm.greased, 1); assert.equal(mhm.damage, 2);
    assert.doesNotMatch(messages(), /cannot hold|grease wears/);
});

async function pendingMore(run, action, inspect, pattern = /cannot hold onto/) {
    let entered, release, complete = false, timer;
    const atMore = new Promise(resolve => { entered = resolve; });
    run._display.onEmptyQueue = () => {
        if (!pattern.test(game._toplines)) return 32;
        entered(); return new Promise(resolve => { release = resolve; });
    };
    const pending = action().then(value => { complete = true; return value; });
    try {
        await Promise.race([atMore, pending.then(() => { throw Error('expected More'); }),
            new Promise((_, reject) => { timer = setTimeout(() => reject(Error('More timeout')), 2000); })]);
        await setImmediate(); assert.equal(complete, false); inspect();
    } finally {
        clearTimeout(timer); run._display.onEmptyQueue = () => 32; release?.(32); await pending;
    }
    assert.equal(complete, true);
}
for (const message of ['cannot hold onto', 'grease wears off']) test(`brain caller awaits ${message} More`, async () => {
    const {run, mon} = await prepare();
    const helm = await armor(run, mon, O.DWARVISH_IRON_HELM, C.W_ARMH, true);
    const mhm = damage(); const hp = mon.mhp;
    assert.ok(msgtype_parse_add(`stop "${message}"`)); clearMessages(); seed(4);
    await pendingMore(run, () => drain(mon, mhm), () => {
        assert.match(game._toplines, new RegExp(message));
        assert.equal(helm.greased, 1); assert.equal(mon.mhp, hp); assert.equal(mhm.damage, 2);
        assert.deepEqual(getRngLog(), message === 'cannot hold onto' ? [] : ['rn2(2)=0']);
    }, new RegExp(message));
    assert.equal(helm.greased, 0); assert.deepEqual(getRngLog(), ['rn2(2)=0']);
});
test('damageum awaits slip feedback then applies retained physical damage', async () => {
    const {run, mon} = await prepare();
    await armor(run, mon, O.DWARVISH_IRON_HELM, C.W_ARMH, true);
    assert.ok(msgtype_parse_add('stop "cannot hold onto"'));
    const hp = mon.mhp; clearMessages(); seed(0);
    await pendingMore(run, () => damageum(mon, attack(A.AD_DRIN), 0), () => {
        assert.equal(mon.mhp, hp);
        assert.deepEqual(getRngLog(), ['d(2,1)=2']); // Before the grease draw.
    });
    assert.equal(mon.mhp, hp - 2);
    assert.equal(game.skipdrin, false);
    assert.equal(getRngLog().length, 2);
});
