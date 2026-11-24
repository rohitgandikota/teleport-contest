// Pinned C mhitm.c:1016-1120, mon.c:1726-1824, makemon.c:2051-2180.
// Real helpers and producers throughout. Direct damage-handler cases do not
// claim ordinary reach of every special victim or attacker/attack pairing.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mdamagem } from '../js/mhitm.js';
import { makemon, grow_up } from '../js/makemon.js';
import { tamedog, dog_eat } from '../js/dog.js';
import { mksobj, dobjsfree, place_object } from '../js/mkobj.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { pline, TOPLINE_EMPTY } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { PMNAMES as P, ATTKS as A } from '../js/monst_data.js';
import { ONAMES as O } from '../js/objects_data.js';
import { ROOM, MM_NOGRP, MM_NOMSG, NO_MINVENT,
    M_ATTK_DEF_DIED, M_ATTK_AGR_DIED,
    OBJ_DELETED, OBJ_FLOOR, G_GENOD, G_EXTINCT } from '../js/const.js';
import { IN_SIGHT, COULD_SEE, TEMP_LIT } from '../js/vision.js';

import { bee_eat_jelly } from '../js/monmove.js';
import { dosave0, dorecover, gamestate_decode } from '../js/save.js';

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
test('wraith growth death returns both death flags with real grow_up and genocide', async () => {
    // Handler-only pairing: bees do not naturally have a digestion attack.
    const state = await setup(P.PM_WRAITH, false, P.PM_KILLER_BEE);
    state.attacker.m_lev = 8; // one below the real queen-bee form's level
    game.mvitals[P.PM_QUEEN_BEE].mvflags |= G_GENOD;
    seed(); assert.equal(await digest(state), M_ATTK_DEF_DIED | M_ATTK_AGR_DIED);
    assert.equal(state.attacker.mhp, 0); assert.equal(state.attacker.mnum, P.PM_QUEEN_BEE);
});

test('direct grow_up also loses the existing death callback after a real new game', async () => {
    const state = await setup(P.PM_WRAITH, false, P.PM_KILLER_BEE);
    state.attacker.m_lev = 8;
    game.mvitals[P.PM_QUEEN_BEE].mvflags |= G_GENOD;
    const { grow_up } = await import('../js/makemon.js');
    seed(); assert.equal(await grow_up(state.attacker, null), null);
    assert.equal(state.attacker.mhp, 0);
});

test('two ordinary new-game startups retain the live imported death function', async () => {
    let previous;
    for (let n = 0; n < 2; n++) {
        const { attacker } = await setup(P.PM_OGRE, false, P.PM_KILLER_BEE);
        assert.notEqual(game, previous); previous = game;
        assert.equal(Object.hasOwn(game, '_mondied_ref'), false);
        attacker.m_lev = 8;
        game.mvitals[P.PM_QUEEN_BEE].mvflags |= G_GENOD;
        seed(); assert.equal(await grow_up(attacker, null), null);
        assert.equal(attacker.mhp, 0);
        assert.ok(!game.level.monsters.includes(attacker));
    }
});

test('dead monster returns null before draws, feedback or another death', async () => {
    const { attacker, defender } = await setup(); attacker.mhp = 0;
    const deaths = game.mvitals[attacker.mnum].died;
    seed(); assert.equal(await grow_up(attacker, defender), null);
    assert.deepEqual(getRngLog(), []);
    assert.equal(game.mvitals[attacker.mnum].died, deaths);
});

test('kill growth below the HP threshold returns the same form', async () => {
    const { attacker, defender } = await setup(P.PM_OGRE, false);
    attacker.m_lev = 10; attacker.mhpmax = 40; attacker.mhp = 20;
    defender.m_lev = 0;
    const form = attacker.data; seed();
    assert.equal(await grow_up(attacker, defender), form);
    assert.equal(attacker.m_lev, 10); assert.equal(attacker.mhpmax, 41);
    assert.equal(attacker.mhp, 20); assert.deepEqual(getRngLog(), ['rnd(1)=1']);
});

test('victim-free growth respects the level and HP ceilings', async () => {
    const { attacker } = await setup(P.PM_OGRE, false);
    attacker.m_lev = 49; attacker.mhpmax = 400; attacker.mhp = 400;
    seed(); assert.equal(await grow_up(attacker, null), attacker.data);
    assert.equal(attacker.m_lev, 49); assert.equal(attacker.mhpmax, 400);
    assert.equal(attacker.mhp, 400);
    assert.equal(getRngLog().filter(c => c.startsWith('rnd(8)=')).length, 1);
});

for (const flag of [0, G_EXTINCT]) {
    test(`queen transition survives when target flags are ${flag}`, async () => {
        const { attacker } = await setup(P.PM_OGRE, false, P.PM_KILLER_BEE);
        attacker.m_lev = 8; attacker.female = 0; attacker.movement = 17;
        game.mvitals[P.PM_QUEEN_BEE].mvflags = flag;
        const deaths = game.mvitals[P.PM_QUEEN_BEE].died;
        seed(); assert.equal(await grow_up(attacker, null), game.mons[P.PM_QUEEN_BEE]);
        assert.equal(attacker.mnum, P.PM_QUEEN_BEE); assert.equal(attacker.m_lev, 9);
        assert.equal(attacker.female, 1); assert.equal(attacker.movement, 17);
        assert.equal(game.mvitals[P.PM_QUEEN_BEE].died, deaths);
        assert.ok(game.level.monsters.includes(attacker));
    });
}

test('real royal-jelly producer returns death after consuming a single lump', async () => {
    const { attacker } = await setup(P.PM_OGRE, false, P.PM_KILLER_BEE);
    const jelly = mksobj(O.LUMP_OF_ROYAL_JELLY, false, false);
    await place_object(jelly, attacker.mx, attacker.my);
    game.mvitals[P.PM_QUEEN_BEE].mvflags |= G_GENOD;
    seed(); assert.equal(await bee_eat_jelly(attacker, jelly), 1);
    assert.equal(attacker.mnum, P.PM_QUEEN_BEE); assert.equal(attacker.mhp, 0);
    assert.equal(jelly.where, OBJ_DELETED);
    assert.ok(!game.level.objects.includes(jelly));
});

test('real dog_eat converts royal-jelly growth death to its caller result 2', async () => {
    const { attacker } = await setup(P.PM_OGRE, true, P.PM_KILLER_BEE);
    const jelly = mksobj(O.LUMP_OF_ROYAL_JELLY, false, false);
    await place_object(jelly, attacker.mx, attacker.my);
    game.mvitals[P.PM_QUEEN_BEE].mvflags |= G_GENOD;
    seed(); assert.equal(await dog_eat(attacker, jelly, attacker.mx, attacker.my, false), 2);
    assert.equal(attacker.mhp, 0); assert.equal(jelly.where, OBJ_DELETED);
});

test('an existing queen prevents royal-jelly growth and leaves the object untouched', async () => {
    const { attacker } = await setup(P.PM_OGRE, false, P.PM_KILLER_BEE);
    const queen = await makemon(game.mons[P.PM_QUEEN_BEE], 34, 10, MM_NOGRP | MM_NOMSG | NO_MINVENT);
    assert.ok(queen);
    const jelly = mksobj(O.LUMP_OF_ROYAL_JELLY, false, false);
    await place_object(jelly, attacker.mx, attacker.my);
    const oldLevel = attacker.m_lev;
    seed(); assert.equal(await bee_eat_jelly(attacker, jelly), -1);
    assert.equal(attacker.m_lev, oldLevel); assert.equal(attacker.mnum, P.PM_KILLER_BEE);
    assert.equal(jelly.where, OBJ_FLOOR); assert.deepEqual(getRngLog(), []);
});

for (const freshBoot of [false, true]) {
    test(`${freshBoot ? 'new-game startup' : 'direct recovery'} after full save keeps growth death callable`, async () => {
        const { attacker } = await setup(P.PM_OGRE, false, P.PM_KILLER_BEE);
        attacker.m_lev = 8; attacker.msleeping = 1;
        const id = attacker.m_id, oldGame = game, storage = game.storage;
        game.mvitals[P.PM_QUEEN_BEE].mvflags |= G_GENOD;
        assert.equal(await dosave0(), true);
        const saved = gamestate_decode(JSON.parse(storage.getItem(`save:${game.plname}`)));
        assert.equal(Object.hasOwn(saved, '_mondied_ref'), false);
        if (freshBoot) {
            const replay = await runSegment({ ...basic, moves: ' n ', storage });
            replay._display.onEmptyQueue = () => 32;
            game._preNhgetchHook = null; resetInputState();
            assert.notEqual(game, oldGame);
        } else {
            assert.equal(await dorecover(), true); assert.equal(game, oldGame);
        }
        assert.equal(game.program_state.beyond_savefile_load, 1);
        assert.equal(Object.hasOwn(game, '_mondied_ref'), false);
        const restored = game.level.monsters.find(m => m.m_id === id);
        assert.ok(restored); assert.notEqual(restored, attacker);
        assert.equal(restored.data, game.mons[P.PM_KILLER_BEE]);
        assert.ok(game.mvitals[P.PM_QUEEN_BEE].mvflags & G_GENOD);
        seed(); assert.equal(await grow_up(restored, null), null);
        assert.equal(restored.mhp, 0); assert.equal(restored.mnum, P.PM_QUEEN_BEE);
        assert.ok(!game.level.monsters.includes(restored));
    });
}

test('growth death awaits real feedback before changing form or finishing', async () => {
    const { attacker, replay } = await setup(P.PM_OGRE, false, P.PM_KILLER_BEE);
    attacker.m_lev = 8; game.mvitals[P.PM_QUEEN_BEE].mvflags |= G_GENOD;
    await pline('An earlier message fills the line before the next growth message must wait.');
    let entered, release, finished = false;
    const blocked = new Promise(resolve => { entered = resolve; });
    const pause = new Promise(resolve => { release = resolve; });
    replay._display.onEmptyQueue = async () => { entered(); await pause; return 32; };
    seed(); const operation = grow_up(attacker, null).then(result => { finished = true; return result; });
    let timeout;
    try {
        await Promise.race([blocked, new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error('growth feedback did not block')), 2000);
        })]);
        assert.equal(finished, false); assert.equal(attacker.mnum, P.PM_KILLER_BEE);
        assert.ok(attacker.mhp > 0); assert.equal(attacker.m_lev, 9);
    } finally { clearTimeout(timeout); release(); await operation; }
    assert.equal(finished, true); assert.equal(attacker.mhp, 0);
});

// These five controls distinguish the separate set_mon_data amendment.
for (const movement of [17, 0, -5]) {
    test(`slower little-dog growth prorates remaining movement ${movement}`, async () => {
        const { attacker } = await setup(P.PM_OGRE, false, P.PM_LITTLE_DOG);
        attacker.m_lev = 3; attacker.movement = movement;
        assert.equal(attacker.data.mmove, 18); assert.equal(game.mons[P.PM_DOG].mmove, 16);
        seed(); assert.equal(await grow_up(attacker, null), game.mons[P.PM_DOG]);
        assert.equal(attacker.movement, movement === 17 ? 15 : movement === -5 ? -4 : 0);
    });
}

test('genocided slower form updates movement before real death cleanup', async () => {
    const { attacker } = await setup(P.PM_OGRE, false, P.PM_LITTLE_DOG);
    attacker.m_lev = 3; attacker.movement = 17;
    game.mvitals[P.PM_DOG].mvflags |= G_GENOD;
    seed(); assert.equal(await grow_up(attacker, null), null);
    assert.equal(attacker.mnum, P.PM_DOG); assert.equal(attacker.mhp, 0);
    assert.equal(attacker.movement, 15);
});

test('kill-triggered slower form uses the same canonical movement rule', async () => {
    const { attacker, defender } = await setup(P.PM_OGRE, false, P.PM_LITTLE_DOG);
    attacker.m_lev = 3; attacker.mhpmax = 25; attacker.movement = 17;
    seed(); assert.equal(await grow_up(attacker, defender), game.mons[P.PM_DOG]);
    assert.equal(attacker.m_lev, 4); assert.equal(attacker.movement, 15);
});
