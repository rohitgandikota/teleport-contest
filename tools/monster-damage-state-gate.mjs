// Pinned C mhitm.c:1016-1120 and uhitm.c:2281-4832.
// Real monster, item, wearing and combat helpers. Direct mdamagem cases use
// unchanged species attack rows; constructed branch states are not C replays.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { makemon } from '../js/makemon.js';
import { mdamagem, hitmm, gazemm, explmm } from '../js/mhitm.js';
import * as uhitm from '../js/uhitm.js';
import { mksobj, dobjsfree } from '../js/mkobj.js';
import { mpickobj } from '../js/steal.js';
import { m_dowear, which_armor } from '../js/worn.js';
import { mon_wield_item } from '../js/weapon.js';
import { oname } from '../js/do_name.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { pline, TOPLINE_EMPTY } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { defended, set_mon_data } from '../js/mondata.js';
import { PMNAMES as P, ATTKS as A } from '../js/monst_data.js';
import { ONAMES as O } from '../js/objects_data.js';
import { ART_VORPAL_BLADE } from '../js/artilist_data.js';
import { ROOM, MM_NOGRP, MM_NOMSG, NO_MINVENT, STRAT_WAITFORU,
    M_ATTK_DEF_DIED, M_ATTK_MISS, M_ATTK_HIT, M_ATTK_AGR_DONE,
    NEED_HTH_WEAPON, W_ARM, W_WEP } from '../js/const.js';
import { IN_SIGHT, COULD_SEE, TEMP_LIT } from '../js/vision.js';

const basic = { seed: 7341, datetime: '20000110090000', moves: ' ',
    nethackrc: 'OPTIONS=name:Damage,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n' };
async function setup(species, adtyp, victim = P.PM_HUMAN) {
    const replay = await runSegment({ ...basic, storage: new InMemoryStorage() });
    let reads = 0;
    replay._display.onEmptyQueue = () => { assert.ok(++reads < 80); return 32; };
    game._preNhgetchHook = null; resetInputState();
    game.level.objects = []; game.level.objAt.clear();
    game.level.monsters = []; game.level.monAt = new Map(); game.level.traps = [];
    game.invent = []; game.timer_base = []; game.light_sources = []; game.billobjs = [];
    game.u.ux = 30; game.u.uy = 10; game.u.ushops = ''; game.moves = 100;
    game.vis = true; game.flags.verbose = false; game.flags.monpolycontrol = false;
    for (let x = 27; x <= 36; x++) for (let y = 7; y <= 13; y++) {
        Object.assign(game.level.at(x, y), { typ: ROOM, lit: 1, roomno: 0 });
        game.viz_array[y][x] = IN_SIGHT | COULD_SEE | TEMP_LIT;
    }
    const flags = MM_NOGRP | MM_NOMSG | NO_MINVENT;
    const attacker = await makemon(game.mons[species], 31, 10, flags);
    const defender = await makemon(game.mons[victim], 32, 10, flags);
    assert.ok(attacker && defender);
    const attack = attacker.data.mattk.find(a => a[1] === adtyp && a[0] !== A.AT_NONE);
    assert.ok(attack, 'active unmodified species attack');
    attacker.mcan = 0; attacker.mspec_used = 0;
    defender.mhp = defender.mhpmax = 100; defender.msleeping = 0;
    defender.mstrategy = STRAT_WAITFORU; defender.mconf = 0; defender.mstun = 0;
    dobjsfree(); game._toplin = TOPLINE_EMPTY; game._prevmsg = '';
    game.bhitpos = { x: defender.mx, y: defender.my }; game.notonhead = false;
    return { attacker, defender, attack, replay };
}
function seed(n = 19) { initRng(n); enableRngLog(); }
const hit = ({ attacker, defender, attack }, weapon = null, roll = 0) =>
    mdamagem(attacker, defender, attack, weapon, roll);
function rolled() {
    const match = /^d\(\d+,\d+\)=(\d+)$/.exec(getRngLog()[0]);
    assert.ok(match, 'base dice remain first'); return +match[1];
}
async function armor(mon, type) {
    const item = mksobj(type, false, false);
    await mpickobj(mon, item); await m_dowear(mon, true);
    assert.equal(which_armor(mon, W_ARM), item); return item;
}

for (const roll of [1, 2]) test(`real Vorpal weapon hit carries die roll ${roll}`, async () => {
    const state = await setup(P.PM_HUMAN, A.AD_PHYS);
    const sword = mksobj(O.LONG_SWORD, false, false);
    await oname(sword, 'Vorpal Blade', 0);
    assert.equal(sword.oartifact, ART_VORPAL_BLADE);
    await mpickobj(state.attacker, sword);
    state.attacker.weapon_check = NEED_HTH_WEAPON;
    assert.equal(await mon_wield_item(state.attacker), 1);
    assert.equal(state.attacker.mw, sword); assert.ok(sword.owornmask & W_WEP);
    seed(); const result = await hitmm(state.attacker, state.defender, state.attack, sword, roll);
    if (roll === 1) {
        assert.ok(result & M_ATTK_DEF_DIED); assert.equal(state.defender.mhp, 0);
        assert.ok(getRngLog().some(c => c.startsWith('rn2(2)=')), 'beheading message draw');
    } else {
        assert.equal(result, M_ATTK_HIT); assert.ok(state.defender.mhp > 0 && state.defender.mhp < 100);
    }
});

test('ordinary sword roll one does not gain an artifact effect', async () => {
    const state = await setup(P.PM_HUMAN, A.AD_PHYS);
    const sword = mksobj(O.LONG_SWORD, false, false);
    await mpickobj(state.attacker, sword); state.attacker.weapon_check = NEED_HTH_WEAPON;
    await mon_wield_item(state.attacker); seed();
    assert.equal(await hit(state, sword, 1), M_ATTK_HIT);
    assert.ok(state.defender.mhp > 0 && state.defender.mhp < 100);
});

for (const cancelled of [false, true]) test(`xan legs ${cancelled ? 'cancelled' : 'active'} retain C physical rule`, async () => {
    const s = await setup(P.PM_XAN, A.AD_LEGS); s.attacker.mcan = +cancelled;
    seed(); assert.equal(await hit(s), cancelled ? M_ATTK_MISS : M_ATTK_HIT);
    assert.equal(s.defender.mhp, 100 - (cancelled ? 0 : rolled()));
});

for (const cancelled of [false, true]) test(`abbot stun ${cancelled ? 'cancelled' : 'active'} keeps base damage`, async () => {
    const s = await setup(P.PM_ABBOT, A.AD_STUN); s.attacker.mcan = +cancelled;
    seed(); assert.equal(await hit(s), M_ATTK_HIT);
    assert.equal(s.defender.mhp, 100 - rolled()); assert.equal(!!s.defender.mstun, !cancelled);
});

for (const condition of ['active', 'cancelled', 'already confused', 'cooldown']) test(`confusion ${condition} retains base dice`, async () => {
    const s = await setup(P.PM_YEENOGHU, A.AD_CONF);
    assert.ok(s.attack[2] > 0 && s.attack[3] > 0, 'nonzero confusion dice');
    if (condition === 'cancelled') s.attacker.mcan = 1;
    if (condition === 'already confused') s.defender.mconf = 1;
    if (condition === 'cooldown') s.attacker.mspec_used = 1;
    seed(); await hit(s);
    assert.equal(!!s.defender.mconf, condition === 'active' || condition === 'already confused');
    assert.equal(s.defender.mhp, 100 - rolled());
    assert.equal(!!(s.defender.mstrategy & STRAT_WAITFORU), condition !== 'active');
});

test('real gaze caller reaches confusion for a seeing awake target', async () => {
    const s = await setup(P.PM_UMBER_HULK, A.AD_CONF); seed();
    await gazemm(s.attacker, s.defender, s.attack); assert.equal(s.defender.mconf, 1);
});

test('real gaze caller stops before dispatch for a sleeping target', async () => {
    const s = await setup(P.PM_UMBER_HULK, A.AD_CONF); s.defender.msleeping = 1; seed();
    assert.equal(await gazemm(s.attacker, s.defender, s.attack), M_ATTK_MISS);
    assert.equal(s.defender.mconf, 0); assert.deepEqual(getRngLog(), []);
});

for (const [kind, species, type, field] of [
    ['rust', P.PM_RUST_MONSTER, A.AD_RUST, 'oeroded'],
    ['rot', P.PM_BROWN_PUDDING, A.AD_DCAY, 'oeroded2'],
    ['corrosion', P.PM_BLACK_PUDDING, A.AD_CORR, 'oeroded2'],
]) for (const cancelled of [false, true]) test(`${kind} ${cancelled ? 'cancelled' : 'active'} uses real worn armor`, async () => {
    const s = await setup(species, type);
    const item = await armor(s.defender, kind === 'rot' ? O.LEATHER_ARMOR : O.CHAIN_MAIL);
    s.attacker.mcan = +cancelled; seed(); await hit(s);
    assert.equal(item[field] || 0, cancelled ? 0 : 1);
    assert.equal(s.defender.mhp, 100 - (cancelled ? rolled() : 0));
    assert.equal(!!(s.defender.mstrategy & STRAT_WAITFORU), cancelled);
    assert.equal(getRngLog().some(c => c.startsWith('rn2(5)=')), !cancelled);
});

for (const [species, type, victim] of [
    [P.PM_RUST_MONSTER, A.AD_RUST, P.PM_IRON_GOLEM],
    [P.PM_BROWN_PUDDING, A.AD_DCAY, P.PM_WOOD_GOLEM],
    [P.PM_BROWN_PUDDING, A.AD_DCAY, P.PM_LEATHER_GOLEM],
]) for (const saved of [false, true]) test(`golem ${victim} destruction ${saved ? 'with unusable amulet' : 'without amulet'}`, async () => {
    const s = await setup(species, type, victim);
    if (saved) {
        const amulet = mksobj(O.AMULET_OF_LIFE_SAVING, false, false);
        await mpickobj(s.defender, amulet); await m_dowear(s.defender, true);
    }
    seed(); const result = await hit(s);
    // C nonliving golems cannot use lifesaving, even when carrying an amulet.
    assert.equal(result, M_ATTK_DEF_DIED); assert.equal(s.defender.mhp, 0);
});

for (const cancelled of [false, true]) test(`disenchanter ${cancelled ? 'cancelled' : 'active'} keeps normal damage and enchantment`, async () => {
    const s = await setup(P.PM_DISENCHANTER, A.AD_ENCH);
    const item = await armor(s.defender, O.CHAIN_MAIL); item.spe = 3;
    s.attacker.mcan = +cancelled; seed(); assert.equal(await hit(s), M_ATTK_HIT);
    assert.equal(s.defender.mhp, 100 - rolled()); assert.equal(item.spe, 3);
    assert.equal(getRngLog().filter(c => c.startsWith('rn2(3)=')).length, 1, 'only knockback draw');
});

for (const [victim, harmed] of [[P.PM_OGRE, true], [P.PM_ROCK_MOLE, true], [P.PM_HORSE, true],
    [P.PM_FIRE_ELEMENTAL, false]]) test(`Famine real diet predicate for ${victim}`, async () => {
    const s = await setup(P.PM_FAMINE, A.AD_FAMN, victim); seed(); await hit(s);
    assert.equal(s.defender.mhp, 100 - (harmed ? rolled() : 0));
});

for (const [species, adtyp] of [[P.PM_SCORPIUS, A.AD_DISE], [P.PM_PESTILENCE, A.AD_PEST]]) {
    for (const [victim, immune] of [[P.PM_OGRE, false], [P.PM_GHOUL, true], [P.PM_RED_MOLD, true]]) {
        test(`disease ${adtyp} species ${victim} keeps original attack row`, async () => {
            const s = await setup(species, adtyp, victim), original = [...s.attack];
            seed(); await hit(s); assert.deepEqual(s.attack, original);
            assert.equal(s.defender.mhp, 100 - (immune ? 0 : rolled()));
        });
    }
    test(`disease ${adtyp} respects actual green dragon armor`, async () => {
        const s = await setup(species, adtyp); await armor(s.defender, O.GREEN_DRAGON_SCALE_MAIL);
        assert.equal(defended(s.defender, A.AD_DISE), true);
        seed(); await hit(s); assert.equal(s.defender.mhp, 100);
    });
}

for (const state of ['active', 'cancelled', 'blind', 'eyeless']) test(`black light ${state} confuses without HP damage`, async () => {
    const s = await setup(P.PM_BLACK_LIGHT, A.AD_HALU, state === 'eyeless' ? P.PM_ACID_BLOB : P.PM_OGRE);
    if (state === 'cancelled') s.attacker.mcan = 1;
    if (state === 'blind') s.defender.mcansee = 0;
    seed(); await hit(s); assert.equal(s.defender.mhp, 100);
    assert.equal(!!s.defender.mconf, state === 'active');
});

test('real black-light explosion reaches the new confusion route before attacker death', async () => {
    const s = await setup(P.PM_BLACK_LIGHT, A.AD_HALU); seed();
    await explmm(s.attacker, s.defender, s.attack);
    assert.equal(s.defender.mconf, 1); assert.equal(s.defender.mhp, 100);
    assert.equal(s.attacker.mhp, 0);
});

for (const condition of ['allowed', 'restricted', 'cancelled', 'no gold']) test(`gold theft ${condition} keeps real inventory and teleport ownership`, async () => {
    const s = await setup(P.PM_LEPRECHAUN, A.AD_SGLD);
    const gold = mksobj(O.GOLD_PIECE, false, false); gold.quan = 37;
    if (condition !== 'no gold') await mpickobj(s.defender, gold);
    s.attacker.mcan = +(condition === 'cancelled');
    game.level.flags.noteleport = condition === 'restricted';
    const xy = [s.attacker.mx, s.attacker.my]; seed(); const result = await hit(s);
    const stolen = condition === 'allowed' || condition === 'restricted';
    assert.equal((s.attacker.minvent || []).includes(gold), stolen);
    assert.equal(s.defender.mhp, 100);
    assert.equal(!!(s.defender.mstrategy & STRAT_WAITFORU), !stolen);
    if (condition === 'allowed') {
        assert.equal(result, M_ATTK_AGR_DONE); assert.notDeepEqual([s.attacker.mx, s.attacker.my], xy);
    } else {
        assert.equal(result, M_ATTK_MISS); assert.deepEqual([s.attacker.mx, s.attacker.my], xy);
    }
});

test('Wizard Amulet attack still does no monster-target damage', async () => {
    const s = await setup(P.PM_WIZARD_OF_YENDOR, A.AD_SAMU); seed();
    assert.equal(await hit(s), M_ATTK_MISS); assert.equal(s.defender.mhp, 100);
});

test('ordinary bite damage and leading dice remain unchanged', async () => {
    const s = await setup(P.PM_LITTLE_DOG, A.AD_PHYS); seed();
    assert.equal(await hit(s), M_ATTK_HIT); assert.equal(s.defender.mhp, 100 - rolled());
});

test('status mutation waits for real message completion through mdamagem', async () => {
    const s = await setup(P.PM_ABBOT, A.AD_STUN);
    await pline('An earlier message fills the line before the next combat message must wait.');
    let release, entered, finished = false;
    const blocked = new Promise(resolve => { entered = resolve; });
    const pause = new Promise(resolve => { release = resolve; });
    s.replay._display.onEmptyQueue = async () => { entered(); await pause; return 32; };
    seed(); const pending = hit(s).then(result => { finished = true; return result; });
    try {
        await Promise.race([blocked, pending.then(() => { throw new Error('damage completed before message'); })]);
        assert.equal(finished, false); assert.equal(s.defender.mstun, 0); assert.equal(s.defender.mhp, 100);
    } finally { release(); await pending; }
    assert.equal(s.defender.mstun, 1); assert.equal(s.defender.mhp, 100 - rolled());
});

const record = damage => ({ damage, hitflags: M_ATTK_MISS,
    permdmg: 0, specialdmg: 0, dieroll: 1, done: false, indx: 0 });
for (const [species, adtyp, handler, form] of [
    [P.PM_RUST_MONSTER, A.AD_RUST, 'mhitm_ad_rust', P.PM_IRON_GOLEM],
    [P.PM_BROWN_PUDDING, A.AD_DCAY, 'mhitm_ad_dcay', P.PM_WOOD_GOLEM],
]) for (const cancelled of [false, true]) test(`${handler}: canonical hero-form state ${cancelled ? 'retained' : 'ended'}`, async () => {
    const s = await setup(species, adtyp);
    const { polymon } = await import('../js/polyself.js');
    assert.equal(await polymon(form), 1); assert.equal(game.youmonst.data.pmidx, form);
    // C set_uasmon uses this live species table. The current JS producer's
    // separate static-table identity defect has its own retained diagnostic.
    set_mon_data(game.youmonst, game.mons[form]);
    s.attacker.mcan = +cancelled; const mhm = record(7); seed();
    await uhitm[handler](s.attacker, s.attack, game.youmonst, mhm);
    assert.equal(game.u.umonnum, cancelled ? form : game.u.umonster);
    assert.equal(mhm.damage, 7); assert.equal(mhm.done, false);
});

for (const [species, adtyp, handler, form, deathFlag] of [
    [P.PM_RUST_MONSTER, A.AD_RUST, 'mhitm_ad_rust', P.PM_IRON_GOLEM, true],
    [P.PM_BROWN_PUDDING, A.AD_DCAY, 'mhitm_ad_dcay', P.PM_WOOD_GOLEM, false],
]) test(`${handler}: hero attack preserves C's distinct hit flags`, async () => {
    const s = await setup(species, adtyp, form);
    const { polymon } = await import('../js/polyself.js'); await polymon(species);
    const mhm = record(7); seed();
    await uhitm[handler](game.youmonst, s.attack, s.defender, mhm);
    assert.equal(s.defender.mhp, 0); assert.equal(mhm.damage, 0);
    assert.equal(!!(mhm.hitflags & M_ATTK_DEF_DIED), deathFlag);
    assert.ok(getRngLog().some(c => c.startsWith('rn2(5)=')), 'armor selection still follows death');
});

for (const cancelled of [false, true]) test(`shared stun hero arm ${cancelled ? 'cancelled' : 'triggered'}`, async () => {
    const s = await setup(P.PM_ABBOT, A.AD_STUN); s.attacker.mcan = +cancelled;
    // Seed 5's first rn2(4) is 0; the source gate also checks the timeout mask.
    seed(5); const mhm = record(7);
    await uhitm.mhitm_ad_stun(s.attacker, s.attack, game.youmonst, mhm);
    assert.equal(mhm.damage, cancelled ? 7 : 3);
    assert.equal(!!game.u.intrinsic.HStun, !cancelled);
    assert.equal(getRngLog().some(c => c.startsWith('rn2(4)=')), !cancelled);
});

for (const [species, adtyp, handler] of [[P.PM_FAMINE, A.AD_FAMN, 'mhitm_ad_famn'],
    [P.PM_PESTILENCE, A.AD_PEST, 'mhitm_ad_pest']]) test(`${handler}: existing hero effect retains normal damage`, async () => {
    const s = await setup(species, adtyp), mhm = record(7), hunger = game.u.uhunger;
    seed(); await uhitm[handler](s.attacker, s.attack, game.youmonst, mhm);
    assert.equal(mhm.damage, 7); assert.equal(mhm.done, false);
    if (adtyp === A.AD_FAMN) assert.ok(game.u.uhunger < hunger);
    else assert.ok(game.u.uprops.SICK);
});

for (const cancelled of [false, true]) test(`shared seduction wrapper ${cancelled ? 'cancelled' : 'same-gender'} leaves hero damage`, async () => {
    const s = await setup(P.PM_AMOROUS_DEMON, A.AD_SSEX); s.attacker.female = 0;
    s.attacker.mcan = +cancelled; const mhm = record(7); seed();
    await uhitm.mhitm_ad_ssex(s.attacker, s.attack, game.youmonst, mhm);
    assert.equal(mhm.damage, 7); assert.equal(mhm.done, false); assert.deepEqual(getRngLog(), []);
});

test('seduction wrapper retains real monster inventory theft', async () => {
    const s = await setup(P.PM_AMOROUS_DEMON, A.AD_SSEX);
    const item = mksobj(O.FOOD_RATION, false, false); await mpickobj(s.defender, item);
    game.level.flags.noteleport = true; seed(); await hit(s);
    assert.ok(s.attacker.minvent.includes(item)); assert.ok(!s.defender.minvent.includes(item));
    assert.equal(s.defender.mhp, 100);
});

test('mdamagem initializes the complete C record in source order', () => {
    const text = mdamagem.toString();
    const begin = text.indexOf('const mhm = {'), end = text.indexOf('};', begin);
    const fields = [...text.slice(begin,end).matchAll(/^\s*([a-z]+)(?::\s*([^,\n]+))?,?$/gm)]
        .map(m => [m[1], m[2] || m[1]]);
    assert.deepEqual(fields, [['hitflags','M_ATTK_MISS'], ['permdmg','0'],
        ['specialdmg','0'], ['dieroll','dieroll'], ['done','false']]);
    assert.ok(text.slice(begin,end).includes('damage: d(mattk[2], mattk[3])'));
});
