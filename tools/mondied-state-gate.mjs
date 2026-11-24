// Source-derived mondied contracts. Constructed death boundaries with real
// terrain, equipment, corpse, and vault helpers; no native reachability claim.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup, seed, clearMessages, x, y} from './status-followup-test-setup.mjs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {mondied, mlifesaver} from '../js/mon.js';
import {accessible} from '../js/monmove.js';
import {set_levltyp} from '../js/mkmaze.js';
import {punish} from '../js/read.js';
import {findgd} from '../js/vault.js';
import {mksobj, add_to_minv} from '../js/mkobj.js';
import {m_dowear} from '../js/worn.js';
import {make_hallucinated} from '../js/potion.js';
import {Hallucination} from '../js/youprop.js';
import {cansee} from '../js/vision.js';
import {resetInputState} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

const corpses = () => game.level.objects.filter(obj => obj.otyp === O.CORPSE);
async function monster(id = P.PM_TROLL) {
    const mon = await makemon(game.mons[id], x + 1, y,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    assert.ok(mon);
    return mon;
}

// monmove.c:2188 rejects closed/locked doors; mon.c:3263 allows pools.
for (const [name, type, mask, remains] of [
    ['room', C.ROOM, 0, true],
    ['corridor', C.CORR, 0, true],
    ['open door', C.DOOR, C.D_ISOPEN, true],
    ['broken door', C.DOOR, C.D_BROKEN, true],
    ['closed door', C.DOOR, C.D_CLOSED, false],
    ['locked door', C.DOOR, C.D_LOCKED, false],
    ['stone', C.STONE, 0, false],
    ['pool exception', C.POOL, 0, true],
]) {
    await test(`corpse eligibility at ${name}`, async () => {
        await setup();
        const mon = await monster();
        assert.ok(set_levltyp(mon.mx, mon.my, type));
        game.level.at(mon.mx, mon.my).doormask = mask;
        assert.equal(accessible(mon.mx, mon.my), remains && type !== C.POOL);
        const deaths = game.mvitals[P.PM_TROLL].died || 0;
        seed(2);
        assert.equal(await mondied(mon), undefined);
        assert.equal(mon.mhp, 0);
        assert.ok(!game.level.monsters.includes(mon));
        assert.equal(game.mvitals[P.PM_TROLL].died, deaths + 1);
        assert.equal(corpses().length, remains ? 1 : 0);
        if (remains) {
            const corpse = corpses()[0];
            assert.equal(corpse.corpsenm, P.PM_TROLL);
            assert.deepEqual([corpse.ox, corpse.oy], [mon.mx, mon.my]);
        } else {
            assert.deepEqual(getRngLog(), [], 'big monster needs no chance draw; no corpse creation');
        }
    });
}

// C mon.c:3247-3249: kittens require rn2(3), even on ineligible terrain.
for (const [rngSeed, chance] of [[1, 0], [2, 1]]) {
    for (const stone of [false, true]) {
        await test(`small-monster chance ${chance}, ${stone ? 'stone' : 'floor'}`, async () => {
            await setup();
            const mon = await monster(P.PM_KITTEN);
            if (stone) assert.ok(set_levltyp(mon.mx, mon.my, C.STONE));
            seed(rngSeed);
            await mondied(mon);
            assert.equal(getRngLog()[0], `rn2(3)=${chance}`);
            const remains = !stone && chance === 0;
            assert.equal(corpses().length, remains ? 1 : 0);
            if (!remains) assert.deepEqual(getRngLog(), [`rn2(3)=${chance}`]);
        });
    }
}

const foundation = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/vault-interrogation-feedback.json', import.meta.url))).segments[0];
async function escortedGuard() {
    const run = await runSegment({...foundation,
        moves: foundation.moves + 'd$ll\x1b\x1b', storage: new InMemoryStorage()});
    game._preNhgetchHook = null;
    resetInputState();
    let reads = 0;
    run._display.onEmptyQueue = async () => {
        assert.ok(++reads < 50, 'bounded real feedback reads');
        await setImmediate();
        return 32;
    };
    const guard = findgd();
    assert.ok(guard && guard.isgd);
    assert.deepEqual([guard.mx, guard.my], [27, 5]);
    assert.equal(guard.mextra.egd.fcend, 3);
    assert.equal(guard.mextra.egd.fcbeg, 0);
    assert.equal(game.level.at(0, 0).typ, C.STONE);
    assert.equal(corpses().length, 0);
    return guard;
}

// Real grddead/parkguard changes the coordinates. Killing is constructed;
// the existing recorded guard inputs use xkilled, not this mondied route.
for (const [blocked, rngSeed, chance] of [[true, 1, 0], [true, 2, 1], [false, 1, 0]]) {
    await test(`parked guard, ${blocked ? 'ball blocks' : 'free'} corridor, chance ${chance}`, async () => {
        const guard = await escortedGuard();
        if (blocked) {
            await punish(null);
            assert.deepEqual([game.u.uball.ox, game.u.uball.oy, game.u.uball.where],
                [25, 5, C.OBJ_FLOOR]);
        }
        seed(rngSeed);
        await mondied(guard);
        assert.deepEqual([guard.mx, guard.my], [0, 0]);
        assert.equal(guard.mhp, 0);
        assert.equal(guard.isgd, blocked ? 1 : 0);
        assert.equal(game.level.monsters.includes(guard), blocked);
        assert.equal(game.mvitals[P.PM_GUARD].died || 0, blocked ? 0 : 1);
        assert.equal(guard.mextra.egd.fcbeg, blocked ? 0 : 3);
        assert.equal(game.level.at(27, 5).typ, blocked ? C.CORR : C.STONE);
        assert.equal(corpses().length, 0, 'off-map terrain never creates a random-location corpse');
        assert.deepEqual(getRngLog(), [`rn2(3)=${chance}`],
            'corpse chance still precedes the post-death terrain rejection');
        if (blocked) {
            assert.equal(findgd(), guard);
            assert.equal(game.level.monAt.get('0,0'), guard);
            assert.equal(guard.mstate & C.MON_DETACH, 0);
        }
    });
}

await test('worn lifesaving returns before guard cleanup or corpse chance', async () => {
    const guard = await escortedGuard();
    await punish(null);
    const amulet = mksobj(O.AMULET_OF_LIFE_SAVING, false, false);
    add_to_minv(guard, amulet);
    await m_dowear(guard, true);
    assert.equal(mlifesaver(guard), amulet);
    seed(1);
    await mondied(guard);
    assert.deepEqual([guard.mx, guard.my], [27, 5]);
    assert.equal(guard.mhp, guard.mhpmax);
    assert.ok(guard.mhp > 0 && game.level.monsters.includes(guard));
    assert.equal(guard.isgd, 1);
    assert.equal(guard.mextra.egd.fcbeg, 0);
    assert.equal(game.mvitals[P.PM_GUARD].died || 0, 0);
    assert.equal(mlifesaver(guard), null);
    assert.ok(!guard.minvent.includes(amulet));
    assert.equal(corpses().length, 0);
    assert.deepEqual(getRngLog(), [], 'no corpse-chance draw after successful lifesaving');
});

// make_corpse owns the floor redraw (mon.c:934-940). A second owner redraw
// samples a different hallucinated object despite unchanged gameplay RNG.
for (const hallucinating of [false, true]) {
    await test(`corpse display samples once, hallucination ${hallucinating}`, async () => {
        await setup();
        const mon = await monster();
        if (hallucinating) await make_hallucinated(20, false, 0);
        assert.equal(!!Hallucination(), hallucinating);
        assert.ok(cansee(mon.mx, mon.my));
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, '__rng_log_disp');
        try {
            globalThis.__rng_log_disp = true;
            clearMessages();
            seed(2);
            await mondied(mon);
            assert.equal(corpses().length, 1);
            const draws = getRngLog().filter(entry => entry.startsWith(
                `~drn2(${O.NUM_OBJECTS - O.FIRST_OBJECT})=`));
            assert.equal(draws.length, hallucinating ? 1 : 0);
        } finally {
            if (descriptor) Object.defineProperty(globalThis, '__rng_log_disp', descriptor);
            else delete globalThis.__rng_log_disp;
        }
    });
}

await test('corpse_chance dust feedback finishes without corpse creation', async () => {
    await setup();
    const mon = await monster(P.PM_LICH);
    clearMessages();
    seed(1);
    await mondied(mon);
    assert.equal(mon.mhp, 0);
    assert.equal(corpses().length, 0);
    assert.match([...game._msg_history, game._toplines].join('\n'), /body crumbles into dust/);
    assert.deepEqual(getRngLog(), []);
});
