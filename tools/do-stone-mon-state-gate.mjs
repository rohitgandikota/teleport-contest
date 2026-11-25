// C uhitm.c:3945-3978. Constructed owner boundaries through normal public APIs.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup, seed, clearMessages, messages} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {mhitm_ad_ston, mhitm_ad_phys} from '../js/uhitm.js';
import {makemon} from '../js/makemon.js';
import {mksobj, set_corpsenm} from '../js/mkobj.js';
import {weight} from '../js/invent.js';
import {mpickobj} from '../js/steal.js';
import {m_dowear, which_armor, mon_set_minvis} from '../js/worn.js';
import {mon_give_prop, mlifesaver} from '../js/mon.js';
import {resists_ston, poly_when_stoned} from '../js/mondata.js';
import {canseemon} from '../js/display.js';
import {mon_wield_item, select_hwep} from '../js/weapon.js';
import {tamedog} from '../js/dog.js';
import {cancel_monst} from '../js/zap.js';
import {msgtype_parse_add} from '../js/options.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P, ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function create(species, x) {
    const mon = await makemon(game.mons[species], x, 10,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    assert.ok(mon);
    assert.equal(mon.data, game.mons[species]);
    return mon;
}
async function prepare(species = P.PM_ORC, attacker = P.PM_COCKATRICE) {
    const run = await setup();
    const magr = await create(attacker, 32), mdef = await create(species, 33);
    game.vis = true; game.flags.accessiblemsg = true; game.iflags.getpos_coords = 'm';
    clearMessages(); seed(0);
    return {run, magr, mdef};
}
const damage = () => ({damage:7, hitflags:C.M_ATTK_HIT, done:false, dieroll:10});
const touch = mon => {
    const attack = mon.data.mattk.find(a => a[0] === A.AT_TUCH && a[1] === A.AD_STON);
    assert.ok(attack); return attack;
};
const attack = (magr, mdef, mhm) => mhitm_ad_ston(magr, touch(magr), mdef, mhm);
const statues = () => game.level.objects.filter(o => o.otyp === O.STATUE);
async function carry(mon, type) {
    const obj = mksobj(type, false, false);
    await mpickobj(mon, obj);
    assert.equal(obj.where, C.OBJ_MINVENT); assert.equal(obj.ocarry, mon);
    return obj;
}
async function lifesaver(mon) {
    const obj = await carry(mon, O.AMULET_OF_LIFE_SAVING);
    await m_dowear(mon, true);
    assert.equal(which_armor(mon, C.W_AMUL), obj);
    assert.equal(mlifesaver(mon), obj);
    return obj;
}
function assertKilled(magr, mdef, mhm) {
    assert.ok(mdef.mhp <= 0);
    assert.equal(mhm.done, true); assert.equal(mhm.hitflags, C.M_ATTK_DEF_DIED);
    assert.equal(mhm.damage, 7, 'the owner leaves damage untouched after death');
    assert.ok(magr.mhp > 0);
    assert.equal(statues().length, 1);
    assert.equal(statues()[0].corpsenm, mdef.mnum);
}

for (const accessible of [true, false]) test(`visible petrification, accessible=${accessible}`, async () => {
    const {magr, mdef} = await prepare(); game.flags.accessiblemsg = accessible;
    const dagger = await carry(mdef, O.DAGGER), mhm = damage(); clearMessages(); seed(0);
    await attack(magr, mdef, mhm); assertKilled(magr, mdef, mhm);
    assert.match(messages(), accessible ? /<33,10>: The orc turns to stone!/ : /The orc turns to stone!/);
    if (!accessible) assert.doesNotMatch(messages(), /<33,10>/);
    assert.equal(dagger.where, C.OBJ_CONTAINED);
    assert.equal(dagger.ocontainer, statues()[0]);
    assert.equal(statues()[0].owt, weight(statues()[0]));
    assert.deepEqual(game.a11y.msg_loc, {x:0, y:0});
});
for (const mode of ['global unseen', 'invisible defender']) test(`${mode} suppresses the visible message`, async () => {
    const {magr, mdef} = await prepare();
    if (mode === 'global unseen') game.vis = false;
    else { mon_set_minvis(mdef, false); assert.equal(!!canseemon(mdef), false); }
    clearMessages(); seed(0); const mhm = damage();
    await attack(magr, mdef, mhm); assertKilled(magr, mdef, mhm);
    assert.doesNotMatch(messages(), /turns to stone|sad feeling/);
});
for (const species of [P.PM_LIZARD, P.PM_STONE_GOLEM]) test(`innate resistant species ${species} takes no stoning damage`, async () => {
    const {magr, mdef} = await prepare(species), mhm = damage(), hp = mdef.mhp;
    assert.ok(resists_ston(mdef)); assert.equal(poly_when_stoned(mdef.data), false);
    await attack(magr, mdef, mhm);
    assert.equal(mdef.mhp, hp); assert.equal(mhm.damage, 0);
    assert.equal(mhm.done, false); assert.equal(mhm.hitflags, C.M_ATTK_HIT);
    assert.equal(statues().length, 0); assert.equal(messages(), ''); assert.deepEqual(getRngLog(), []);
});
for (const species of [P.PM_FLESH_GOLEM, P.PM_CLAY_GOLEM, P.PM_IRON_GOLEM]) test(`actual golem ${species} converts before damage`, async () => {
    const {magr, mdef} = await prepare(species), mhm = damage(), id = mdef.m_id;
    assert.equal(!!resists_ston(mdef), false); assert.ok(poly_when_stoned(mdef.data));
    await attack(magr, mdef, mhm);
    assert.equal(mdef.m_id, id); assert.equal(mdef.data, game.mons[P.PM_STONE_GOLEM]);
    assert.ok(mdef.mhp > 0); assert.equal(mhm.damage, 0); assert.equal(mhm.done, false);
    assert.equal(mhm.hitflags, C.M_ATTK_HIT); assert.equal(statues().length, 0);
    assert.match(messages(), /<33,10>: The .* golem solidifies\.\.\./);
    assert.match(messages(), /Now it's a stone golem\./);
});
for (const flag of [C.G_GENOD, C.G_EXTINCT]) test(`stone-golem vital flag ${flag} distinguishes genocide from extinction`, async () => {
    const {magr, mdef} = await prepare(P.PM_IRON_GOLEM), mhm = damage();
    // Source boundary: these flags are normally written by genocide/birth accounting.
    game.mvitals[P.PM_STONE_GOLEM].mvflags |= flag;
    try {
        await attack(magr, mdef, mhm);
        if (flag === C.G_GENOD) { assertKilled(magr, mdef, mhm); assert.equal(mdef.mnum, P.PM_IRON_GOLEM); }
        else { assert.equal(mdef.mnum, P.PM_STONE_GOLEM); assert.equal(mhm.damage, 0); assert.equal(mhm.done, false); }
    } finally { game.mvitals[P.PM_STONE_GOLEM].mvflags &= ~flag; }
});
test('monster property producer does not grant stone resistance to a non-stone golem', async () => {
    const {magr, mdef} = await prepare(P.PM_FLESH_GOLEM), mhm = damage();
    const before = mdef.mintrinsics, message = {v:null};
    mon_give_prop(mdef, C.STONE_RES, message);
    assert.equal(mdef.mintrinsics, before); assert.equal(message.v, null);
    assert.equal(!!resists_ston(mdef), false);
    await attack(magr, mdef, mhm); assert.equal(mdef.mnum, P.PM_STONE_GOLEM);
});
test('cancelled cockatrice exits in the public caller before the owner', async () => {
    const {magr, mdef} = await prepare(), mhm = damage(), hp = mdef.mhp;
    const wand = mksobj(O.WAN_CANCELLATION, false, false);
    seed(4); assert.equal(await cancel_monst(magr, wand, true, false, false), true);
    assert.equal(magr.mcan, 1); clearMessages(); seed(0);
    await attack(magr, mdef, mhm);
    assert.equal(mdef.mhp, hp); assert.deepEqual(mhm, damage());
    assert.equal(statues().length, 0); assert.equal(messages(), ''); assert.deepEqual(getRngLog(), []);
});

for (const quantity of [1, 2]) test(`acid cure quantity ${quantity} completes disposal before the surviving miss`, async () => {
    const {magr, mdef} = await prepare(), obj = await carry(mdef, O.POT_ACID), mhm = damage();
    // HP and stack count are constructed boundaries; object ownership is produced normally.
    mdef.mhp = mdef.mhpmax = 100; obj.quan = quantity; obj.owt = weight(obj);
    mdef.mstrategy |= C.STRAT_WAITFORU; clearMessages(); seed(0);
    await attack(magr, mdef, mhm);
    assert.ok(mdef.mhp > 0 && mdef.mhp < 100); assert.equal(mdef.mstrategy & C.STRAT_WAITFORU, 0);
    assert.equal(mhm.done, true); assert.equal(mhm.hitflags, C.M_ATTK_MISS); assert.equal(mhm.damage, 7);
    assert.equal(statues().length, 0); assert.doesNotMatch(messages(), /turns to stone/);
    assert.equal(obj.where, quantity === 1 ? C.OBJ_DELETED : C.OBJ_MINVENT);
    if (quantity === 2) { assert.equal(obj.quan, 1); assert.equal(obj.owt, weight(obj)); }
    assert.ok(getRngLog().some(call => call.startsWith('rnd(15)=')));
});
test('resistant defender leaves its carried acid untouched', async () => {
    const {magr, mdef} = await prepare(P.PM_LIZARD), obj = await carry(mdef, O.POT_ACID), mhm = damage();
    clearMessages(); seed(0); const hp = mdef.mhp;
    await attack(magr, mdef, mhm);
    assert.equal(obj.where, C.OBJ_MINVENT); assert.equal(obj.ocarry, mdef);
    assert.equal(mdef.mhp, hp); assert.equal(mhm.damage, 0); assert.equal(mhm.done, false);
    assert.deepEqual(getRngLog(), []); assert.equal(messages(), '');
});
test('fatal acid cure returns death flags and growth without a statue', async () => {
    const {magr, mdef} = await prepare(), obj = await carry(mdef, O.POT_ACID), mhm = damage();
    mdef.mhp = 1; clearMessages(); seed(0); await attack(magr, mdef, mhm);
    assert.ok(mdef.mhp <= 0); assert.equal(obj.where, C.OBJ_DELETED);
    assert.equal(mhm.done, true); assert.equal(mhm.hitflags, C.M_ATTK_DEF_DIED); assert.equal(mhm.damage, 7);
    assert.equal(statues().length, 0); assert.match(messages(), /dies/);
    assert.ok(getRngLog().findIndex(call => call.startsWith('rnd(15)=')) >= 0);
    const calls = getRngLog(), growth = calls.findLastIndex(call => call.startsWith(`rnd(${mdef.m_lev + 1})=`));
    assert.ok(growth > calls.findIndex(call => call.startsWith('rnd(15)=')));
    assert.ok(calls.length - growth <= 2, 'only the conditional current-HP growth draw follows');
    if (calls.length - growth === 2) assert.match(calls.at(-1), /^rn2\(/);
});
test('lizard corpse cure uses normal corpse lifecycle and clears confusion', async () => {
    const {magr, mdef} = await prepare(), obj = mksobj(O.CORPSE, false, false), mhm = damage();
    set_corpsenm(obj, P.PM_LIZARD); await mpickobj(mdef, obj);
    mdef.mconf = 1; mdef.mstun = 1; const hp = mdef.mhp; clearMessages(); seed(0);
    await attack(magr, mdef, mhm);
    assert.equal(obj.where, C.OBJ_DELETED); assert.equal(mdef.mhp, hp);
    assert.equal(!!mdef.mconf, false); assert.equal(!!mdef.mstun, false);
    assert.equal(mhm.hitflags, C.M_ATTK_MISS); assert.equal(mhm.done, true); assert.equal(statues().length, 0);
});
for (const mode of ['eating', 'frozen']) test(`${mode} defender cannot use carried acid`, async () => {
    const {magr, mdef} = await prepare(), obj = await carry(mdef, O.POT_ACID), mhm = damage();
    if (mode === 'eating') mdef.meating = 2;
    else { mdef.mfrozen = 2; mdef.mcanmove = 0; }
    clearMessages(); seed(0); await attack(magr, mdef, mhm); assertKilled(magr, mdef, mhm);
    assert.equal(obj.where, C.OBJ_CONTAINED); assert.equal(obj.ocontainer, statues()[0]);
    assert.doesNotMatch(messages(), /quaffs/);
});
for (const genocided of [false, true]) test(`worn life-saving amulet, genocided=${genocided}`, async () => {
    const {magr, mdef} = await prepare(), obj = await lifesaver(mdef), mhm = damage();
    if (genocided) game.mvitals[P.PM_ORC].mvflags |= C.G_GENOD;
    clearMessages(); seed(0);
    try {
        await attack(magr, mdef, mhm);
        assert.equal(obj.where, C.OBJ_DELETED); assert.equal(which_armor(mdef, C.W_AMUL), null);
        assert.match(messages(), /medallion crumbles to dust!/);
        assert.equal(mhm.done, true); assert.equal(mhm.damage, 7);
        if (genocided) { assertKilled(magr, mdef, mhm); assert.match(messages(), /still genocided/); }
        else { assert.equal(mhm.hitflags, C.M_ATTK_MISS); assert.equal(mdef.mhp, mdef.mhpmax);
            assert.ok(mdef.mhp >= 10); assert.equal(statues().length, 0);
            // mon.c makeknown -> o_init.c discover_object -> exercise wisdom.
            assert.deepEqual(getRngLog(), ['rn2(19)=6']); }
    } finally { game.mvitals[P.PM_ORC].mvflags &= ~C.G_GENOD; }
});
for (const visible of [true, false]) test(`actual tamed defender death, global visibility=${visible}`, async () => {
    const {magr, mdef} = await prepare(); assert.equal(await tamedog(mdef, null, false), true);
    assert.ok(mdef.mtame && mdef.edog); game.vis = visible; clearMessages(); seed(0);
    const mhm = damage(); await attack(magr, mdef, mhm); assertKilled(magr, mdef, mhm);
    assert.equal(messages().includes('peculiarly sad feeling'), !visible);
});
test('growth into a genocided adult adds aggressor death after petrifying the defender', async () => {
    const {magr, mdef} = await prepare(P.PM_ORC, P.PM_CHICKATRICE), mhm = damage();
    // Constructed legal growth threshold; species and attacks come from makemon.
    magr.m_lev = game.mons[P.PM_COCKATRICE].mlevel - 1;
    magr.mhp = magr.mhpmax = magr.m_lev * 8;
    game.mvitals[P.PM_COCKATRICE].mvflags |= C.G_GENOD;
    clearMessages(); seed(0);
    try {
        await attack(magr, mdef, mhm);
        assert.ok(mdef.mhp <= 0 && magr.mhp <= 0);
        assert.equal(mhm.hitflags, C.M_ATTK_DEF_DIED | C.M_ATTK_AGR_DIED);
        assert.equal(mhm.done, true); assert.equal(mhm.damage, 7);
        assert.equal(statues().length, 1); assert.match(messages(), /grows up into a cockatrice.*dies/);
    } finally { game.mvitals[P.PM_COCKATRICE].mvflags &= ~C.G_GENOD; }
});
test('real wielded cockatrice corpse retains one physical point against a resistant defender', async () => {
    const {magr, mdef} = await prepare(P.PM_STONE_GOLEM, P.PM_SKELETON);
    const obj = mksobj(O.CORPSE, false, false); set_corpsenm(obj, P.PM_COCKATRICE);
    await mpickobj(magr, obj); assert.equal(select_hwep(magr), obj);
    magr.weapon_check = C.NEED_HTH_WEAPON; assert.equal(await mon_wield_item(magr), 1);
    assert.equal(magr.mw, obj); clearMessages(); seed(0); const mhm = damage(), hp = mdef.mhp;
    await mhitm_ad_phys(magr, magr.data.mattk[0], mdef, mhm);
    assert.equal(mdef.mhp, hp); assert.equal(mhm.damage, 1); assert.equal(mhm.done, false);
    assert.equal(obj.where, C.OBJ_MINVENT); assert.equal(magr.mw, obj); assert.equal(statues().length, 0);
});

async function atMore(run, action, inspect) {
    let entered, release, done = false, timer;
    const waiting = new Promise(resolve => { entered = resolve; });
    run._display.onEmptyQueue = () => { entered(); return new Promise(resolve => { release = resolve; }); };
    const pending = action().then(value => { done = true; return value; });
    try {
        await Promise.race([waiting, pending.then(() => { throw Error('expected pending More'); }),
            new Promise((_, reject) => { timer = setTimeout(() => reject(Error('More timeout')), 2000); })]);
        await setImmediate(); assert.equal(done, false); inspect();
    } finally { clearTimeout(timer); run._display.onEmptyQueue = () => 32; release?.(32); await pending; }
    assert.equal(done, true);
}
test('petrification More precedes death, statue creation and growth', async () => {
    const {run, magr, mdef} = await prepare(), mhm = damage(), hp = mdef.mhp;
    assert.ok(msgtype_parse_add('stop "turns to stone"')); seed(0);
    await atMore(run, () => attack(magr, mdef, mhm), () => {
        assert.match(game._toplines, /<33,10>: The orc turns to stone!/);
        assert.equal(mdef.mhp, hp); assert.equal(statues().length, 0);
        assert.deepEqual(mhm, damage()); assert.deepEqual(getRngLog(), []);
    }); assertKilled(magr, mdef, mhm);
});
test('conversion More precedes species mutation and clearing damage', async () => {
    const {run, magr, mdef} = await prepare(P.PM_IRON_GOLEM), mhm = damage();
    assert.ok(msgtype_parse_add('stop "solidifies"')); seed(0);
    await atMore(run, () => attack(magr, mdef, mhm), () => {
        assert.match(game._toplines, /<33,10>: The iron golem solidifies/);
        assert.equal(mdef.mnum, P.PM_IRON_GOLEM); assert.deepEqual(mhm, damage()); assert.deepEqual(getRngLog(), []);
    }); assert.equal(mdef.mnum, P.PM_STONE_GOLEM); assert.equal(mhm.damage, 0);
});
test('acid drinking More precedes disposal and acid damage', async () => {
    const {run, magr, mdef} = await prepare(), obj = await carry(mdef, O.POT_ACID), mhm = damage();
    mdef.mhp = mdef.mhpmax = 100; assert.ok(msgtype_parse_add('stop "quaffs"')); clearMessages(); seed(0);
    await atMore(run, () => attack(magr, mdef, mhm), () => {
        assert.equal(obj.where, C.OBJ_MINVENT); assert.equal(mdef.mhp, 100);
        assert.deepEqual(mhm, damage()); assert.deepEqual(getRngLog(), []);
    }); assert.equal(obj.where, C.OBJ_DELETED); assert.equal(mhm.hitflags, C.M_ATTK_MISS);
});
test('medallion More precedes disposal, revival and surviving miss', async () => {
    const {run, magr, mdef} = await prepare(), obj = await lifesaver(mdef), mhm = damage();
    assert.ok(msgtype_parse_add('hide "turns to stone"'));
    assert.ok(msgtype_parse_add('hide "But wait"'));
    assert.ok(msgtype_parse_add('hide "begins to glow"'));
    assert.ok(msgtype_parse_add('hide "looks much better"'));
    assert.ok(msgtype_parse_add('stop "crumbles to dust"')); clearMessages(); seed(0);
    await atMore(run, () => attack(magr, mdef, mhm), () => {
        assert.equal(mdef.mhp, 0); assert.equal(obj.where, C.OBJ_MINVENT); assert.equal(mlifesaver(mdef), obj);
        assert.deepEqual(mhm, damage()); assert.equal(statues().length, 0);
        assert.deepEqual(getRngLog(), ['rn2(19)=6'], 'discovery exercise has happened; revival and growth have not');
    }); assert.equal(obj.where, C.OBJ_DELETED); assert.ok(mdef.mhp > 0); assert.equal(mhm.hitflags, C.M_ATTK_MISS);
});
test('unseen pet death More precedes growth and final hit flags', async () => {
    const {run, magr, mdef} = await prepare(); assert.equal(await tamedog(mdef, null, false), true);
    game.vis = false; const mhm = damage(), hp = magr.mhp, max = magr.mhpmax;
    assert.ok(msgtype_parse_add('stop "peculiarly sad feeling"')); clearMessages(); seed(0);
    await atMore(run, () => attack(magr, mdef, mhm), () => {
        assert.ok(mdef.mhp <= 0); assert.equal(statues().length, 1);
        assert.equal(magr.mhp, hp); assert.equal(magr.mhpmax, max); assert.deepEqual(mhm, damage());
    }); assertKilled(magr, mdef, mhm);
});
