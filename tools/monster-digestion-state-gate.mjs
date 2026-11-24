// Pinned C mhitm.c:1016-1120, mon.c:1726-1824, makemon.c:2051-2180.
// Real helpers and producers throughout. Direct damage-handler cases do not
// claim ordinary reach of every special victim or attacker/attack pairing.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mdamagem, gulpmm, mattackm, failed_grab } from '../js/mhitm.js';
import * as mon from '../js/mon.js';
import { makemon } from '../js/makemon.js';
import { tamedog, slimeproof } from '../js/dog.js';
import { mksobj, dobjsfree } from '../js/mkobj.js';
import { mpickobj } from '../js/steal.js';
import { m_dowear, mon_set_minvis } from '../js/worn.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { pline, TOPLINE_EMPTY } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { christen_monst } from '../js/do_name.js';
import { PMNAMES as P, ATTKS as A, MFLAGS as M } from '../js/monst_data.js';
import { ONAMES as O } from '../js/objects_data.js';
import { ROOM, MM_NOGRP, MM_NOMSG, NO_MINVENT, NO_NC_FLAGS, NON_PM,
    M_ATTK_DEF_DIED, M_ATTK_AGR_DIED, M_ATTK_MISS, M_ATTK_HIT,
    W_AMUL, OBJ_DELETED, G_GENOD } from '../js/const.js';
import { IN_SIGHT, COULD_SEE, TEMP_LIT } from '../js/vision.js';

const basic = { seed: 7341, datetime: '20000110090000', moves: ' ',
    nethackrc: 'OPTIONS=name:Digest,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n' };
async function setup(victim = P.PM_OGRE, tame = true, species = P.PM_PURPLE_WORM) {
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
    if (tame) assert.equal(await tamedog(attacker, null, false), true);
    dobjsfree(); game._toplin = TOPLINE_EMPTY; game._prevmsg = '';
    game.bhitpos = { x: defender.mx, y: defender.my }; game.notonhead = false;
    const attack = game.mons[P.PM_PURPLE_WORM].mattk.find(a => a[0] === A.AT_ENGL);
    assert.equal(attack[1], A.AD_DGST);
    return { attacker, defender, attack, replay };
}
function seed(value = 19) { initRng(value); enableRngLog(); }
const digest = state => mdamagem(state.attacker, state.defender, state.attack, null, 0);
function noRemains(defender) {
    assert.equal(defender.mhp, 0);
    assert.ok(!game.level.monsters.includes(defender));
    assert.ok(!game.level.objects.some(o => o.otyp === O.CORPSE && o.corpsenm === defender.mnum));
    assert.ok(!game.timer_base.some(t => t.arg?.corpsenm === defender.mnum));
}
function give(monster, species) {
    assert.equal(typeof mon.mon_givit, 'function', 'existing public C helper is exported');
    return mon.mon_givit(monster, game.mons[species]);
}

test('ordinary pet digestion kills, gives half nutrition and releases the virtual corpse', async () => {
    const state = await setup(), { attacker, defender } = state;
    const hunger = attacker.edog.hungrytime, deaths = game.mvitals[defender.mnum].died || 0;
    seed(); assert.equal(await digest(state), M_ATTK_DEF_DIED); noRemains(defender);
    assert.equal(attacker.edog.hungrytime, hunger + 500); assert.equal(attacker.meating, 7);
    assert.equal(game.mvitals[defender.mnum].died, deaths + 1);
    const body = game.objs_deleted.find(o => o.otyp === O.CORPSE);
    assert.equal(body.corpsenm, P.PM_OGRE); assert.equal(body.where, OBJ_DELETED);
    assert.equal(body.timed, 0);
    assert.ok(getRngLog()[0].startsWith('d(1,10)='), 'C initial damage roll is retained');
});

for (const [name, victim] of [['ogre', P.PM_OGRE], ['troll', P.PM_TROLL]]) {
    test(`real gulpmm ${name} kill moves the pet and clears the swallow owner`, async () => {
        const state = await setup(victim), { attacker, defender, attack } = state;
        const destination = [defender.mx, defender.my]; seed();
        assert.equal(await gulpmm(attacker, defender, attack), M_ATTK_DEF_DIED);
        noRemains(defender); assert.deepEqual([attacker.mx, attacker.my], destination);
        assert.equal(mon.m_at(...destination), attacker);
        assert.equal(game.mswallower, null); assert.deepEqual(game.timer_base, []);
    });
}

test('natural multiattack loop reaches digestion after the purple worm bite', async () => {
    const state = await setup(), { attacker, defender } = state;
    defender.mhp = defender.mhpmax = 100; // survive the first natural 2d8 bite
    seed(1); const result = await mattackm(attacker, defender);
    assert.ok(result & M_ATTK_DEF_DIED); noRemains(defender);
    assert.equal(attacker.edog.hungrytime, 1600);
    assert.ok(getRngLog().some(call => call.startsWith('d(2,8)=')));
    assert.ok(getRngLog().some(call => call.startsWith('d(1,10)=')));
});

test('wild digestion kills without constructing a virtual pet corpse', async () => {
    const state = await setup(P.PM_OGRE, false); const ident = game.context.ident;
    seed(); assert.equal(await digest(state), M_ATTK_DEF_DIED); noRemains(state.defender);
    assert.equal(game.context.ident, ident); assert.deepEqual(game.objs_deleted || [], []);
    assert.equal(state.attacker.meating || 0, 0);
});

test('worn victim lifesaving is consumed before digestion kills it', async () => {
    const state = await setup(), { defender } = state;
    const amulet = mksobj(O.AMULET_OF_LIFE_SAVING, false, false);
    await mpickobj(defender, amulet); await m_dowear(defender, true);
    assert.equal(mon.mlifesaver(defender), amulet); assert.ok(amulet.owornmask & W_AMUL);
    seed(); assert.equal(await digest(state), M_ATTK_DEF_DIED); noRemains(defender);
    assert.equal(amulet.where, OBJ_DELETED); assert.ok(!defender.minvent.includes(amulet));
});

test('ordinary physical damage does not run the nurse digestion tail', async () => {
    const state = await setup(P.PM_NURSE), { attacker, defender } = state;
    attacker.mhp = 1; defender.mhp = 1;
    const hunger = attacker.edog.hungrytime;
    const bite = attacker.data.mattk.find(a => a[0] === A.AT_BITE);
    seed(); assert.equal(await mdamagem(attacker, defender, bite, null, 0), M_ATTK_DEF_DIED);
    assert.ok(attacker.mhp < attacker.mhpmax); assert.equal(attacker.edog.hungrytime, hunger);
});

test('nurse digestion heals after death and before ordinary kill growth', async () => {
    const state = await setup(P.PM_NURSE), { attacker, defender } = state;
    attacker.m_lev = 15; attacker.mhpmax = 121; attacker.mhp = 1;
    seed(); assert.equal(await digest(state), M_ATTK_DEF_DIED); noRemains(defender);
    assert.equal(attacker.mhp, 121); assert.equal(attacker.mhpmax, 121);
    assert.equal(attacker.m_lev, 16); // capped growth has zero HP increase
});

test('damage-owner wraith arm gains exactly one level and does not run ordinary kill growth', async () => {
    const state = await setup(P.PM_WRAITH, false), { attacker, defender } = state;
    attacker.m_lev = 10; attacker.mhpmax = 80; attacker.mhp = 40;
    seed(); assert.equal(await digest(state), M_ATTK_DEF_DIED); noRemains(defender);
    assert.equal(attacker.m_lev, 11);
    assert.equal(getRngLog().filter(c => c.startsWith('rnd(8)=')).length, 1);
    assert.ok(!getRngLog().some(c => c.startsWith(`rnd(${defender.m_lev + 1})=`)));
});

test('ordinary grab rejects an unsolid wraith before damage dispatch', async () => {
    const { attacker, defender, attack } = await setup(P.PM_WRAITH, false);
    seed(); assert.equal(await failed_grab(attacker, defender, attack), true);
    assert.ok(defender.mhp > 0); assert.deepEqual(getRngLog(), []);
});

test('green slime digestion uses real newcham before ordinary growth', async () => {
    const state = await setup(P.PM_GREEN_SLIME, false); seed();
    assert.equal(await digest(state), M_ATTK_DEF_DIED); noRemains(state.defender);
    assert.equal(state.attacker.mnum, P.PM_GREEN_SLIME);
    assert.equal(state.attacker.data, game.mons[P.PM_GREEN_SLIME]);
});

test('genocided green slime is rejected by real newcham without aborting the kill', async () => {
    const state = await setup(P.PM_GREEN_SLIME, false);
    game.mvitals[P.PM_GREEN_SLIME].mvflags |= G_GENOD;
    seed(); assert.equal(await digest(state), M_ATTK_DEF_DIED); noRemains(state.defender);
    assert.equal(state.attacker.mnum, P.PM_PURPLE_WORM);
});

for (const species of [P.PM_GREEN_SLIME, P.PM_FIRE_ELEMENTAL, P.PM_GHOST]) {
    test(`damage-owner slimeproof guard retains real species ${species}`, async () => {
        // Handler-only pairing, using the unmodified purple-worm attack row.
        const state = await setup(P.PM_GREEN_SLIME, false, species);
        assert.equal(slimeproof(state.attacker.data), true); seed();
        assert.equal(await digest(state), M_ATTK_DEF_DIED); noRemains(state.defender);
        assert.equal(state.attacker.mnum, species);
    });
}

test('normal shapechanger death clears cham before the literal tail predicate', async () => {
    const state = await setup(P.PM_CHAMELEON, false), { attacker, defender } = state;
    assert.equal(defender.cham, P.PM_CHAMELEON);
    await mon.newcham(defender, game.mons[P.PM_OGRE], NO_NC_FLAGS);
    seed(); assert.equal(await digest(state), M_ATTK_DEF_DIED);
    assert.equal(defender.cham, NON_PM); assert.equal(defender.mnum, P.PM_CHAMELEON);
    assert.equal(attacker.mnum, P.PM_PURPLE_WORM);
});

test('saved victim form still triggers slime after death restores its chameleon species', async () => {
    const state = await setup(P.PM_CHAMELEON, false), { attacker, defender } = state;
    await mon.newcham(defender, game.mons[P.PM_GREEN_SLIME], NO_NC_FLAGS);
    assert.equal(defender.cham, P.PM_CHAMELEON); seed();
    assert.equal(await digest(state), M_ATTK_DEF_DIED);
    assert.equal(defender.cham, NON_PM); assert.equal(defender.mnum, P.PM_CHAMELEON);
    assert.equal(attacker.mnum, P.PM_GREEN_SLIME);
});

test('digested stalker conveys permanent invisibility and stun through the canonical helper', async () => {
    const state = await setup(P.PM_STALKER, false); seed();
    assert.equal(await digest(state), M_ATTK_DEF_DIED); noRemains(state.defender);
    assert.equal(state.attacker.perminvis, 1); assert.equal(state.attacker.minvis, 1);
    assert.equal(state.attacker.mstun, 1);
});

test('dead attacker still pays corpse intrinsic selection before mon_givit returns', async () => {
    const { attacker } = await setup(); attacker.mhp = 0; seed();
    await give(attacker, P.PM_FIRE_ANT);
    assert.deepEqual(getRngLog(), ['rn2(1)=0']);
    assert.equal(attacker.mintrinsics || 0, 0);
});

test('property-free food has no intrinsic selection or success draw', async () => {
    const { attacker } = await setup(); seed(); await give(attacker, P.PM_OGRE);
    assert.deepEqual(getRngLog(), []); assert.equal(attacker.mintrinsics || 0, 0);
});

for (const [label, randomSeed, gained] of [['success', 19, true], ['failure', 1, false]]) {
    test(`real corpse-intrinsic selection and chance ${label}`, async () => {
        const { attacker } = await setup(); seed(randomSeed);
        await give(attacker, P.PM_FIRE_ANT);
        assert.equal(!!(attacker.mintrinsics & M.MR_FIRE), gained);
        assert.equal(getRngLog()[0], 'rn2(1)=0');
        assert.ok(getRngLog()[1].startsWith('rn2(15)='));
    });
}

test('already invisible stalker meal still stuns without resetting invisibility', async () => {
    const { attacker } = await setup(); mon_set_minvis(attacker, false); seed();
    await give(attacker, P.PM_STALKER);
    assert.equal(attacker.perminvis, 1); assert.equal(attacker.minvis, 1);
    assert.equal(attacker.mstun, 1); assert.deepEqual(getRngLog(), []);
});

test('Rider fatal digestion returns before the post-kill victim tail', async () => {
    const state = await setup(P.PM_FAMINE, false);
    game.vis = false; seed(); assert.equal(await digest(state), M_ATTK_AGR_DIED);
    assert.ok(state.attacker.mhp <= 0); assert.ok(state.defender.mhp > 0);
});

test('real death-message suspension delays the nurse tail until feedback completes', async () => {
    const state = await setup(P.PM_NURSE), { attacker, defender, replay } = state;
    attacker.m_lev = 15; attacker.mhpmax = 121; attacker.mhp = 1;
    await pline('An earlier message fills the line before the next digestion message must wait.');
    let release, entered, finished = false;
    const blocked = new Promise(resolve => { entered = resolve; });
    const pause = new Promise(resolve => { release = resolve; });
    replay._display.onEmptyQueue = async () => { entered(); await pause; return 32; };
    seed(); const operation = digest(state).then(value => { finished = true; return value; });
    let timeout;
    try {
        await Promise.race([blocked, new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error('real death feedback did not block')), 2000);
        })]);
        assert.equal(finished, false); assert.equal(attacker.mhp, 1);
        assert.ok(game.level.monsters.includes(defender), 'death detachment still awaits feedback');
    } finally { clearTimeout(timeout); release(); await operation; }
    assert.equal(finished, true); assert.equal(attacker.mhp, 121); noRemains(defender);
});

for (const [label, victim, ready] of [
    ['polymorph', P.PM_GREEN_SLIME, a => a.mnum === P.PM_GREEN_SLIME],
    ['intrinsic feedback', P.PM_STALKER, a => !!a.perminvis],
]) {
    test(`mdamagem awaits real ${label} completion before returning`, async () => {
        const state = await setup(victim, false), { attacker, defender, replay } = state;
        christen_monst(attacker, 'The notably long named purple worm in this source control');
        let release, entered, finished = false, reads = 0;
        const blocked = new Promise(resolve => { entered = resolve; });
        const pause = new Promise(resolve => { release = resolve; });
        replay._display.onEmptyQueue = async () => {
            assert.ok(++reads < 20, 'bounded real message input');
            if (ready(attacker)) { entered(); await pause; }
            return 32;
        };
        seed(); const operation = digest(state).then(value => { finished = true; return value; });
        let timeout;
        try {
            await Promise.race([blocked, new Promise((_, reject) => {
                timeout = setTimeout(() => reject(new Error(label + ' did not request input')), 2000);
            })]);
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(finished, false); assert.equal(defender.mhp, 0);
            assert.equal(ready(attacker), true);
        } finally { clearTimeout(timeout); release(); await operation; }
        assert.equal(finished, true); noRemains(defender);
    });
}
