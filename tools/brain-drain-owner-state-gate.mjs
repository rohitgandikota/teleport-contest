// C uhitm.c:3169-3304. Constructed boundaries use the real owner and producers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup, seed, form, clearMessages, messages} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {mhitm_ad_drin, damageum} from '../js/uhitm.js';
import {mdamagem} from '../js/mhitm.js';
import {makemon} from '../js/makemon.js';
import {mksobj} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {mpickobj} from '../js/steal.js';
import {setworn, m_dowear, which_armor, mon_set_minvis} from '../js/worn.js';
import {Amulet_on, set_wear} from '../js/do_wear.js';
import {make_slimed, make_blinded, incr_itimeout} from '../js/potion.js';
import {Unchanging, Half_physical_damage} from '../js/youprop.js';
import {canseemon, canspotmon} from '../js/display.js';
import {has_head} from '../js/mondata.js';
import {tamedog} from '../js/dog.js';
import {artifact_exists} from '../js/artifact.js';
import {msgtype_parse_add} from '../js/options.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P, ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

async function create(type, x = 32) {
    const mon = await makemon(game.mons[type], x, 10,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    assert.ok(mon); assert.equal(mon.data, game.mons[type]);
    return mon;
}
const tentacle = mon => {
    const attack = mon.data.mattk.find(a => a[0] === A.AT_TENT && a[1] === A.AD_DRIN);
    assert.ok(attack); return attack;
};
const damage = (n = 5) => ({damage:n, hitflags:C.M_ATTK_HIT, done:false});
async function heroAttacks(type = P.PM_GREEN_SLIME) {
    const run = await setup(); form(P.PM_MIND_FLAYER);
    const mon = await create(type);
    game.skipdrin = false; game.notonhead = false;
    clearMessages(); seed(0); return {run, mon};
}
const drain = (mon, mhm) => mhitm_ad_drin(game.youmonst, tentacle(game.youmonst), mon, mhm);
async function amulet(type) {
    const obj = await addinv(mksobj(type, false, false));
    await Amulet_on(obj); assert.equal(game.u.uamul, obj); return obj;
}
async function helmet(type) {
    const obj = await addinv(mksobj(type, false, false));
    setworn(obj, C.W_ARMH); await set_wear(obj);
    assert.equal(game.u.uarmh, obj); assert.equal(obj.owornmask, C.W_ARMH); return obj;
}

for (const kind of ['fresh', 'already slimed', 'worn unchanging', 'carried unchanging', 'intrinsic unchanging']) {
    test(`headless green slime: ${kind}`, async () => {
        const {mon} = await heroAttacks();
        if (kind === 'already slimed') await make_slimed(7, null);
        if (kind === 'worn unchanging') await amulet(O.AMULET_OF_UNCHANGING);
        if (kind === 'carried unchanging') await addinv(mksobj(O.AMULET_OF_UNCHANGING, false, false));
        // Real timeout setter, as used by the wizard producer. State boundary only.
        if (kind === 'intrinsic unchanging') incr_itimeout('HUnchanging', 30);
        const protectedNow = kind === 'worn unchanging' || kind === 'intrinsic unchanging';
        assert.equal(Unchanging(), protectedNow); assert.equal(has_head(mon.data), false);
        const hp = mon.mhp, hunger = game.u.uhunger, mhm = damage();
        clearMessages(); seed(0); assert.equal(await drain(mon, mhm), undefined);
        assert.equal(mhm.damage, 0); assert.equal(game.skipdrin, true);
        assert.equal(mon.mhp, hp); assert.equal(game.u.uhunger, hunger);
        assert.deepEqual(getRngLog(), []);
        assert.equal(game.u.uprops.SLIMED || 0, protectedNow ? 0 : kind === 'already slimed' ? 7 : 10);
        assert.equal(messages().includes('suck in some slime'), !protectedNow && kind !== 'already slimed');
        assert.match(messages(), /green slime doesn't seem harmed/);
        assert.doesNotMatch(messages(), /eat .*brain|blocks .*attack/);
    });
}
for (const kind of ['headless acid blob', 'headed off-head']) test(`slime species negative: ${kind}`, async () => {
    const {mon} = await heroAttacks(kind === 'headless acid blob' ? P.PM_ACID_BLOB : P.PM_ORC);
    game.notonhead = kind === 'headed off-head'; // Caller boundary, not a native tail claim.
    const mhm = damage(); await drain(mon, mhm);
    assert.equal(mhm.damage, 0); assert.equal(game.skipdrin, true);
    assert.equal(game.u.uprops?.SLIMED || 0, 0); assert.deepEqual(getRngLog(), []);
    assert.match(messages(), /doesn't seem harmed/); assert.doesNotMatch(messages(), /suck in some slime/);
});
test('damageum awaits the headless owner and suppresses its rolled physical damage', async () => {
    const {mon} = await heroAttacks(), hp = mon.mhp;
    assert.equal(await damageum(mon, tentacle(game.youmonst), 0), C.M_ATTK_HIT);
    assert.equal(mon.mhp, hp); assert.equal(game.u.uprops.SLIMED, 10);
    assert.deepEqual(getRngLog(), ['d(2,1)=2']);
});
test('a second tentacle cannot refresh a real existing slime countdown', async () => {
    const {mon} = await heroAttacks(); await drain(mon, damage());
    assert.equal(game.u.uprops.SLIMED, 10);
    await make_slimed(6, null); clearMessages(); await drain(mon, damage());
    assert.equal(game.u.uprops.SLIMED, 6); assert.doesNotMatch(messages(), /suck in some slime/);
    assert.deepEqual(getRngLog(), []);
});

async function monsters(type = P.PM_GREEN_SLIME) {
    const run = await setup();
    const magr = await create(P.PM_MIND_FLAYER, 32), mdef = await create(type, 33);
    game.flags.accessiblemsg = true; game.iflags.getpos_coords = 'm';
    game.vis = true; game.skipdrin = false; game.notonhead = false;
    clearMessages(); seed(0); return {run, magr, mdef};
}
for (const mode of ['located', 'ordinary', 'global unseen', 'invisible defender', 'blind hero']) {
    test(`monster headless feedback: ${mode}`, async () => {
        const {magr, mdef} = await monsters(), mhm = damage(), hp = mdef.mhp;
        if (mode === 'ordinary') game.flags.accessiblemsg = false;
        if (mode === 'global unseen') game.vis = false;
        if (mode === 'invisible defender') await mon_set_minvis(mdef);
        if (mode === 'blind hero') await make_blinded(5, false);
        const visible = mode === 'located' || mode === 'ordinary';
        if (mode === 'invisible defender' || mode === 'blind hero') assert.equal(!!canspotmon(mdef), false);
        clearMessages(); seed(0);
        await mhitm_ad_drin(magr, tentacle(magr), mdef, mhm);
        assert.equal(mhm.damage, 0); assert.equal(mdef.mhp, hp); assert.equal(game.skipdrin, true);
        assert.equal(game.u.uprops?.SLIMED || 0, 0); assert.deepEqual(getRngLog(), []);
        if (visible) assert.match(messages(), /The green slime doesn't seem harmed\./);
        else assert.equal(messages(), '');
        assert.equal(messages().includes('<33,10>:'), mode === 'located');
        assert.deepEqual(game.a11y.msg_loc, {x:0,y:0});
    });
}
test('monster off-head branch uses the defender coordinate and skips later tentacles', async () => {
    const {magr, mdef} = await monsters(P.PM_ORC); game.notonhead = true;
    const mhm = damage(); await mhitm_ad_drin(magr, tentacle(magr), mdef, mhm);
    assert.match(messages(), /<33,10>: The orc doesn't seem harmed\./);
    assert.equal(game.skipdrin, true); assert.equal(mhm.damage, 0); assert.deepEqual(getRngLog(), []);
});
test('mdamagem calls the headless owner before applying any HP damage', async () => {
    const {magr, mdef} = await monsters(), hp = mdef.mhp;
    await mdamagem(magr, mdef, tentacle(magr), null, 10);
    assert.equal(mdef.mhp, hp); assert.equal(game.skipdrin, true);
    assert.match(messages(), /<33,10>: The green slime doesn't seem harmed\./);
    assert.equal(getRngLog()[0], 'd(2,1)=2');
});
test('tamed brain eater uses initialized EDOG only after a real headed target', async () => {
    const {magr, mdef} = await monsters(P.PM_ORC_CAPTAIN);
    assert.ok(await tamedog(magr, null, false)); assert.ok(magr.edog);
    const hungrytime = magr.edog.hungrytime, mhm = damage();
    clearMessages(); seed(0); await mhitm_ad_drin(magr, tentacle(magr), mdef, mhm);
    assert.equal(getRngLog()[0], 'rnd(10)=6');
    assert.match(getRngLog().at(-1), /^rnd\(60\)=/);
    assert.ok(magr.edog.hungrytime > hungrytime); assert.equal(mhm.damage, 11);
    assert.equal(game.skipdrin, false); assert.equal(mhm.hitflags, C.M_ATTK_HIT);
});
test('headed mindless target still consumes the helper damage sample, without nutrition', async () => {
    const {magr, mdef} = await monsters(P.PM_STONE_GOLEM);
    assert.ok(has_head(mdef.data)); assert.ok(await tamedog(magr, null, false));
    const hungrytime = magr.edog.hungrytime, mhm = damage();
    clearMessages(); seed(0); await mhitm_ad_drin(magr, tentacle(magr), mdef, mhm);
    assert.deepEqual(getRngLog(), ['rnd(10)=6']); assert.equal(mhm.damage, 5);
    assert.equal(mhm.hitflags, C.M_ATTK_MISS); assert.equal(magr.edog.hungrytime, hungrytime);
    assert.match(messages(), /doesn't notice/);
});

async function heroDefends() {
    const run = await setup(), magr = await create(P.PM_MIND_FLAYER);
    game.u.uhp = game.u.uhpmax = 100; // Valid HP boundary, no ordinary-input claim.
    game.skipdrin = false; clearMessages(); seed(0); return {run, magr};
}
const defend = (magr, mhm) => mhitm_ad_drin(magr, tentacle(magr), game.youmonst, mhm);
for (const half of [false, true]) test(`unblocked brain attack applies physical damage once, half=${half}`, async () => {
    const {magr} = await heroDefends();
    if (half) {
        const orb = mksobj(O.CRYSTAL_BALL, false, false);
        artifact_exists(orb, 'The Orb of Fate', true, C.ONAME_WISH);
        await addinv(orb); assert.ok(orb.oartifact);
    }
    assert.equal(Half_physical_damage(), half);
    const intelligence = game.u.acurr.a[C.A_INT], mhm = damage();
    clearMessages(); seed(0); await defend(magr, mhm);
    assert.equal(game.u.uhp, half ? 97 : 95); assert.equal(mhm.damage, 0);
    assert.ok(game.u.acurr.a[C.A_INT] < intelligence);
    assert.match(messages(), /Your brain is eaten!/); assert.match(messages(), /feel .*stupid/);
    assert.equal(getRngLog()[0], 'rnd(10)=6');
});
test('ordinary dry helmet blocks before physical damage or any brain sample', async () => {
    const {magr} = await heroDefends(); await helmet(O.HELMET);
    const mhm = damage(); clearMessages(); seed(0); await defend(magr, mhm);
    assert.deepEqual(getRngLog(), ['rn2(8)=1']); assert.equal(mhm.damage, 5);
    assert.equal(game.u.uhp, 100); assert.match(messages(), /blocks the attack to your head/);
    assert.doesNotMatch(messages(), /brain is eaten|constricts/);
});
test('headless hero form returns after hit feedback without invoking brain helpers', async () => {
    const {magr} = await heroDefends(); form(P.PM_ACID_BLOB);
    const mhm = damage(); clearMessages(); seed(0); await defend(magr, mhm);
    assert.match(messages(), /don't seem harmed/); assert.equal(game.skipdrin, true);
    assert.equal(mhm.damage, 5); assert.equal(game.u.uhp, 100); assert.deepEqual(getRngLog(), []);
});
test('real dunce cap failure keeps intelligence but reports constriction before memory rolls', async () => {
    const {magr} = await heroDefends(); const cap = await helmet(O.DUNCE_CAP);
    assert.ok(cap.cursed); const intelligence = game.u.acurr.a[C.A_INT], mhm = damage();
    clearMessages(); seed(14); await defend(magr, mhm);
    assert.equal(getRngLog()[0], 'rn2(8)=0'); assert.equal(mhm.damage, 0);
    assert.equal(game.u.uhp, 95); assert.equal(game.u.acurr.a[C.A_INT], intelligence);
    assert.ok(!getRngLog().some(c => c.startsWith('rnd(10)')));
    assert.match(messages(), /Your cap constricts briefly, then relaxes again\./);
    assert.doesNotMatch(messages(), /brain is eaten|feel .*stupid/);
});

async function pendingMore(run, pattern, action, inspect) {
    let enter, release, done = false, timer;
    const atMore = new Promise(resolve => { enter = resolve; });
    assert.ok(msgtype_parse_add(`stop "${pattern.source}"`));
    run._display.onEmptyQueue = () => {
        if (!pattern.test(game._toplines)) return 32;
        enter(); return new Promise(resolve => { release = resolve; });
    };
    const pending = action().then(() => { done = true; });
    try {
        await Promise.race([atMore, pending.then(() => { throw Error('expected More'); }),
            new Promise((_, reject) => { timer = setTimeout(() => reject(Error('More timeout')), 2000); })]);
        await setImmediate(); assert.equal(done, false); inspect();
    } finally {
        clearTimeout(timer); run._display.onEmptyQueue = () => 32; release?.(32); await pending;
    }
    assert.equal(done, true);
}
for (const message of ['doesn.t seem harmed', 'suck in some slime']) test(`hero awaits ${message} before its next mutation`, async () => {
    const {run, mon} = await heroAttacks(), mhm = damage();
    await pendingMore(run, new RegExp(message), () => drain(mon, mhm), () => {
        assert.equal(game.u.uprops?.SLIMED || 0, 0);
        assert.equal(mhm.damage, message === 'suck in some slime' ? 0 : 5);
        assert.equal(game.skipdrin, message === 'suck in some slime');
        assert.deepEqual(getRngLog(), []);
    });
    assert.equal(game.u.uprops.SLIMED, 10); assert.equal(mhm.damage, 0);
});
test('located monster harmless More completes before damage and skip flags change', async () => {
    const {run, magr, mdef} = await monsters(), mhm = damage();
    await pendingMore(run, /doesn.t seem harmed/, () => mhitm_ad_drin(magr, tentacle(magr), mdef, mhm), () => {
        assert.match(game._toplines, /<33,10>:/); assert.equal(mhm.damage, 5);
        assert.equal(game.skipdrin, false); assert.deepEqual(getRngLog(), []);
    });
    assert.equal(mhm.damage, 0); assert.equal(game.skipdrin, true);
});
test('dunce-cap More delays both memory-loss rolls until acknowledged', async () => {
    const {run, magr} = await heroDefends(); await helmet(O.DUNCE_CAP);
    const mhm = damage(), intelligence = game.u.acurr.a[C.A_INT]; clearMessages(); seed(14);
    await pendingMore(run, /cap constricts/, () => defend(magr, mhm), () => {
        assert.equal(game.u.uhp, 95); assert.equal(mhm.damage, 0);
        assert.equal(game.u.acurr.a[C.A_INT], intelligence);
        assert.equal(getRngLog()[0], 'rn2(8)=0');
        assert.match(getRngLog()[1], /^rnd\(2\)=/); assert.equal(getRngLog().length, 2);
    });
    assert.ok(getRngLog().filter(c => c.startsWith('rn2(5)')).length >= 2);
});

test('defender lifesaving stays armed while the owner only computes extra damage', async () => {
    const {magr, mdef} = await monsters(P.PM_ORC_CAPTAIN);
    const obj = mksobj(O.AMULET_OF_LIFE_SAVING, false, false);
    await mpickobj(mdef, obj); await m_dowear(mdef, true);
    assert.equal(which_armor(mdef, C.W_AMUL), obj);
    const hp = mdef.mhp, mhm = damage(); clearMessages(); seed(0);
    await mhitm_ad_drin(magr, tentacle(magr), mdef, mhm);
    assert.equal(mhm.damage, 11); assert.equal(mdef.mhp, hp);
    assert.equal(which_armor(mdef, C.W_AMUL), obj); assert.equal(game.skipdrin, false);
    assert.deepEqual(getRngLog(), ['rnd(10)=6']);
});
test('mdamagem consumes defender lifesaving only after the brain owner returns', async () => {
    const {magr, mdef} = await monsters(P.PM_ORC_CAPTAIN);
    const obj = mksobj(O.AMULET_OF_LIFE_SAVING, false, false);
    await mpickobj(mdef, obj); await m_dowear(mdef, true);
    mdef.mhp = 1; // Injured-target boundary, preserving real inventory and death helpers.
    clearMessages(); seed(0);
    await mdamagem(magr, mdef, tentacle(magr), null, 10);
    assert.ok(mdef.mhp > 0); assert.equal(which_armor(mdef, C.W_AMUL), null);
    assert.ok(!mdef.minvent.includes(obj)); assert.equal(game.skipdrin, false);
    assert.match(messages(), /medallion crumbles to dust/);
    assert.equal(getRngLog()[0], 'd(2,1)=2');
    assert.match(getRngLog()[1], /^rnd\(10\)=/);
});
test('physical lifesaving More completes before the brain sample and damage clearing', async () => {
    const {run, magr} = await heroDefends(), obj = await amulet(O.AMULET_OF_LIFE_SAVING);
    game.u.uhp = 1; const mortality = game.u.umortality || 0, mhm = damage();
    clearMessages(); seed(0);
    await pendingMore(run, /medallion begins to glow/, () => defend(magr, mhm), () => {
        assert.equal(game.u.uhp, 0); assert.equal(game.u.uamul, obj);
        assert.equal(mhm.damage, 5); assert.equal(game.u.umortality, mortality + 1);
        // C done() identifies the amulet before this message; discovery exercises Wis.
        assert.equal(game.objects[O.AMULET_OF_LIFE_SAVING].oc_name_known, 1);
        assert.deepEqual(getRngLog(), ['rn2(19)=6']);
    });
    assert.equal(game.u.uamul, null); assert.ok(!game.invent.includes(obj));
    assert.ok(game.u.uhp > 0); assert.equal(mhm.damage, 0);
    assert.match(messages(), /Your brain is eaten!/);
    assert.doesNotMatch(messages(), /Die\?|OK, so you don't die/);
    assert.equal(game.u.umortality, mortality + 1);
});
