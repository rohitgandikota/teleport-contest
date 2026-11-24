#!/usr/bin/env node
// Real producers and consumers through normal imports. Constructed state is
// separate from the ordinary-input pet witness and is not native coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { flip_level } from '../js/sp_lev.js';
import { get_level_extends } from '../js/mklev.js';
import { makemon } from '../js/makemon.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { mpickobj } from '../js/steal.js';
import { addinv } from '../js/invent.js';
import { tactics } from '../js/wizard.js';
import { dog_goal } from '../js/dog.js';
import { m_move } from '../js/monmove.js';
import { couldsee } from '../js/vision.js';
import { gettrack } from '../js/track.js';
import { getRngLog } from '../js/rng.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { COLNO, ROWNO, NO_MINVENT, STRAT_GROUND, STRAT_MONSTR,
    STRAT_PLAYER, STRAT_STRATMASK, MMOVE_MOVED } from '../js/const.js';

const recipe = JSON.parse(fs.readFileSync(new URL(
    './gen-sessions/recipes/flip-pet-goal-memory.json', import.meta.url)));
const input = recipe.segments[0];
const setupMoves = input.moves.slice(0, input.moves.indexOf('#wizfliplevel'));
assert.ok(setupMoves.endsWith('15.'));

async function setup() {
    await runSegment({ ...input, moves: setupMoves, storage: new InMemoryStorage() });
    const pet = game.level.monsters.find(mon => mon.mtame);
    assert.ok(pet);
    assert.deepEqual(pet.edog.ogoal, { x: 24, y: 5 });
    assert.equal(couldsee(pet.mx, pet.my), false);
    assert.equal(gettrack(pet.mx, pet.my), null);
    return pet;
}

async function covetousGoal(owner = 'floor') {
    // The input setup disables generation. These constructed controls enable
    // the real constructor, just as the wizard creation command does.
    game.iflags.debug_mongen = false;
    // Acknowledge real relocation/acquisition messages without replacing tty.
    for (let i = 0; i < 8; i++)
        game.nhDisplay.pushKey(32);
    const wizard = await makemon(game.mons[PMNAMES.PM_WIZARD_OF_YENDOR], 29, 9, NO_MINVENT);
    assert.ok(wizard);
    const book = mksobj(ONAMES.SPE_BOOK_OF_THE_DEAD, false, false);
    let target;
    let strategy;
    if (owner === 'floor') {
        await place_object(book, 28, 6);
        target = { x: 28, y: 6 };
        strategy = STRAT_GROUND;
    } else if (owner === 'hero') {
        await addinv(book);
        target = { x: game.u.ux, y: game.u.uy };
        strategy = STRAT_PLAYER;
    } else {
        const carrier = await makemon(game.mons[PMNAMES.PM_GIANT], 28, 6, NO_MINVENT);
        assert.ok(carrier);
        await mpickobj(carrier, book);
        target = { x: carrier.mx, y: carrier.my };
        strategy = STRAT_MONSTR;
    }
    await tactics(wizard);
    assert.deepEqual(wizard.mgoal, target, 'target_on chose the actual object owner');
    assert.equal(wizard.mstrategy & STRAT_STRATMASK, strategy);
    return wizard;
}

function bounds() {
    const area = get_level_extends();
    return {
        xmin: Math.max(1, area.xmin), xmax: Math.min(COLNO - 1, area.xmax),
        ymin: Math.max(0, area.ymin), ymax: Math.min(ROWNO - 1, area.ymax)
    };
}

function mirror(point, mask, area) {
    return {
        x: mask & 2 ? area.xmin + area.xmax - point.x : point.x,
        y: mask & 1 ? area.ymin + area.ymax - point.y : point.y
    };
}

for (const mask of [1, 2, 3]) {
    for (const extras of [false, true]) {
        test(`axis ${mask}, extras ${extras}: active goal moves; pet goal and tracks stay`, async () => {
            const pet = await setup();
            const wizard = await covetousGoal();
            const area = bounds();
            const goal = wizard.mgoal;
            const original = { ...goal };
            const remembered = pet.edog.ogoal;
            const rememberedValue = { ...remembered };
            const tracks = structuredClone({ pet: pet.mtrack, hero: game.utrack });
            const records = [...game.level.monsters];
            const rng = [...getRngLog()];
            await flip_level(mask, extras);
            assert.strictEqual(wizard.mgoal, goal);
            assert.deepEqual(goal, mirror(original, mask, area));
            assert.strictEqual(pet.edog.ogoal, remembered);
            assert.deepEqual(remembered, rememberedValue);
            assert.deepEqual({ pet: pet.mtrack, hero: game.utrack }, tracks);
            assert.ok(records.every((mon, index) => game.level.monsters[index] === mon));
            assert.deepEqual(getRngLog(), rng);
            await flip_level(mask, extras);
            assert.deepEqual(goal, original);
            assert.deepEqual(remembered, rememberedValue);
            assert.deepEqual(getRngLog(), rng);
        });
    }
}

for (const owner of ['hero', 'monster']) {
    test(`real tactics produces the ${owner} target before the flip`, async () => {
        await setup();
        const wizard = await covetousGoal(owner);
        const goal = { ...wizard.mgoal };
        const target = mirror(goal, 3, bounds());
        const rng = [...getRngLog()];
        await flip_level(3, true);
        assert.deepEqual(wizard.mgoal, target);
        assert.deepEqual(getRngLog(), rng);
    });
}

test('the next real pet goal consumer uses the retained pre-flip coordinate', async () => {
    const pet = await setup();
    const remembered = { ...pet.edog.ogoal };
    await flip_level(2, true);
    assert.equal(couldsee(pet.mx, pet.my), false);
    assert.equal(gettrack(pet.mx, pet.my), null);
    const distance = (game.u.ux - pet.mx) ** 2 + (game.u.uy - pet.my) ** 2;
    dog_goal(pet, pet.edog, false, distance, false);
    assert.deepEqual({ x: game.gg.gx, y: game.gg.gy }, remembered);
    assert.equal(pet.edog.ogoal.x, 0, 'C clears x after consuming the remembered goal');
});

test('the real covetous movement consumer attacks at the transformed carrier goal', async () => {
    await setup();
    const wizard = await covetousGoal('monster');
    const target = mirror(wizard.mgoal, 3, bounds());
    await flip_level(3, true);
    const carrier = game.level.monAt.get(`${target.x},${target.y}`);
    assert.ok(carrier && carrier !== wizard);
    assert.ok((wizard.mx - target.x) ** 2 + (wizard.my - target.y) ** 2 <= 2);
    const calls = getRngLog().length;
    assert.equal(await m_move(wizard, false), MMOVE_MOVED);
    assert.deepEqual(game.bhitpos, target);
    assert.ok(getRngLog().length > calls, 'the real melee consumer ran');
});

for (const mask of [0, 4]) {
    test(`mask ${mask}: early return preserves both goals without RNG`, async () => {
        const pet = await setup();
        const wizard = await covetousGoal();
        const goals = structuredClone([wizard.mgoal, pet.edog.ogoal]);
        const rng = [...getRngLog()];
        await flip_level(mask, true);
        assert.deepEqual([wizard.mgoal, pet.edog.ogoal], goals);
        assert.deepEqual(getRngLog(), rng);
    });
}

test('zero, absent and out-of-area goals keep their C sentinel meaning', async () => {
    await setup();
    const wizard = await covetousGoal();
    for (const value of [undefined, { x: 0, y: 6 }, { x: 79, y: 0 }, { x: -1, y: -1 }]) {
        wizard.mgoal = value;
        const before = value && { ...value };
        const rng = [...getRngLog()];
        await flip_level(3, true);
        assert.strictEqual(wizard.mgoal, value);
        assert.deepEqual(wizard.mgoal, before);
        assert.deepEqual(getRngLog(), rng);
    }
});
