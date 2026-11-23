#!/usr/bin/env node
// Constructed regressions for paths found by the scope/import audit.
// These check C source contracts; they do not claim native branch coverage.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { Sting_effects } from '../js/artifact.js';
import { discard_migrations } from '../js/dog.js';
import { toss_up } from '../js/dothrow.js';
import { undesirable_disp } from '../js/monmove.js';
import { gazemm, explmm } from '../js/mhitm.js';
import { seffects } from '../js/read.js';
import { domonnoise } from '../js/sounds.js';
import { nh_timeout } from '../js/timeout.js';
import { create_gas_cloud } from '../js/region.js';
import { makemon } from '../js/makemon.js';
import { mksobj, place_object, add_to_container } from '../js/mkobj.js';
import { which_armor } from '../js/worn.js';
import { initRng, rn2 } from '../js/rng.js';
import { ART_STING, ART_ORCRIST, ART_GRIMTOOTH } from '../js/artilist_data.js';
import { PMNAMES, ATTKS } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { ROOM, OBJ_MIGRATING, OBJ_DELETED, W_SADDLE, FROMOUTSIDE, TIMEOUT,
         MM_NOGRP, MM_NOMSG, NO_MINVENT, M_ATTK_AGR_DIED } from '../js/const.js';

const segment = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/variant-steed.json', import.meta.url))).segments[0];

async function setup() {
    const replay = await runSegment({ ...segment, moves: '  n',
        storage: new InMemoryStorage() });
    replay._display.onEmptyQueue = () => 0x1b;
    game.u.ux = 30;
    game.u.uy = 10;
    game.u.uhp = game.u.uhpmax = 200;
    game.moves = 1;
    game.level.monAt.clear();
    for (let x = 28; x <= 34; x++)
        for (let y = 8; y <= 12; y++)
            game.level.at(x, y).typ = ROOM;
    game._toplines = '';
    game._msg_history = [];
}

function messages() {
    return [...game._msg_history, game._toplines].join('\n');
}

for (const [name, artifact, otyp] of [
    ['Sting', ART_STING, ONAMES.ELVEN_DAGGER],
    ['Orcrist', ART_ORCRIST, ONAMES.ELVEN_BROADSWORD],
    ['Grimtooth', ART_GRIMTOOTH, ONAMES.ORCISH_DAGGER],
]) {
    test(`${name} warns about orcs and stops glowing when they leave`, async () => {
        await setup();
        const weapon = mksobj(otyp, false, false);
        weapon.oartifact = artifact;
        game.u.uwep = weapon;
        game.warn_obj_cnt = 0;
        await Sting_effects(1);
        assert.ok(messages().includes(`${name} flickers`));
        game.warn_obj_cnt = 1;
        await Sting_effects(0);
        assert.ok(messages().includes(`${name} stops flickering.`));
    });
}

test('discarding migrations frees a container and its contents', async () => {
    await setup();
    const bag = mksobj(ONAMES.SACK, false, false);
    const item = mksobj(ONAMES.DAGGER, false, false);
    add_to_container(bag, item);
    bag.ox = game.u.uz.dnum;
    bag.oy = game.u.uz.dlevel;
    bag.where = OBJ_MIGRATING;
    game.migrating_mons = [];
    game.migrating_objs = [bag];
    discard_migrations();
    assert.deepEqual(game.migrating_objs, []);
    assert.equal(bag.where, OBJ_DELETED);
    assert.equal(item.where, OBJ_DELETED);
});

test('a cream pie thrown upward blinds its thrower', async () => {
    await setup();
    game.u.uarmh = null;
    const pie = mksobj(ONAMES.CREAM_PIE, false, false);
    assert.equal(await toss_up(pie, false), false);
    assert.equal(pie.where, OBJ_DELETED);
    assert.ok(game.u.ucreamed > 0);
    assert.ok(game.u.intrinsic.HBlinded > 0);
});

test('pets refuse displacement onto cursed objects', async () => {
    await setup();
    const pony = game.level.monsters.find(m => m.mnum === PMNAMES.PM_PONY);
    assert.ok(pony);
    assert.equal(undesirable_disp(pony, 31, 10), false);
    const obj = mksobj(ONAMES.ROCK, false, false);
    obj.cursed = true;
    place_object(obj, 31, 10);
    assert.equal(undesirable_disp(pony, 31, 10), true);
    pony.mtame = 0;
    assert.equal(undesirable_disp(pony, 31, 10), false);
});

test('an Archon gaze blinds another monster', async () => {
    await setup();
    const flags = MM_NOGRP | MM_NOMSG | NO_MINVENT;
    const archon = await makemon(game.mons[PMNAMES.PM_ARCHON], 31, 10, flags);
    const target = await makemon(game.mons[PMNAMES.PM_PONY], 32, 10, flags);
    target.msleeping = 0;
    const attack = archon.data.mattk.find(a => a[0] === ATTKS.AT_GAZE);
    assert.ok(attack);
    await gazemm(archon, target, attack);
    assert.equal(!!target.mcansee, false);
    assert.ok(target.mblinded > 0);
});

test('a flaming sphere explosion kills the sphere and hurts its target', async () => {
    await setup();
    const flags = MM_NOGRP | MM_NOMSG | NO_MINVENT;
    const sphere = await makemon(game.mons[PMNAMES.PM_FLAMING_SPHERE], 31, 10, flags);
    const target = await makemon(game.mons[PMNAMES.PM_PONY], 32, 10, flags);
    target.mhp = target.mhpmax = 200;
    const attack = sphere.data.mattk.find(a => a[0] === ATTKS.AT_EXPL);
    assert.ok(attack);
    const result = await explmm(sphere, target, attack);
    assert.ok(result & M_ATTK_AGR_DIED);
    assert.ok(sphere.mhp <= 0);
    assert.ok(target.mhp < 200);
});

test('remove curse reaches the mounted saddle after scanning inventory', async () => {
    await setup();
    const pony = game.level.monsters.find(m => m.mnum === PMNAMES.PM_PONY);
    const saddle = which_armor(pony, W_SADDLE);
    saddle.cursed = true;
    game.u.usteed = pony;
    const scroll = mksobj(ONAMES.SCR_REMOVE_CURSE, false, false);
    await seffects(scroll);
    assert.equal(!!saddle.cursed, false);
    assert.equal(saddle.bknown, 1);
    assert.match(messages(), /saddle glows amber/);
});

test('Death can deliver a tribute quote', async () => {
    await setup();
    const death = await makemon(game.mons[PMNAMES.PM_DEATH], 31, 10,
        MM_NOGRP | MM_NOMSG | NO_MINVENT);
    let seed = 1;
    for (;; seed++) {
        initRng(seed);
        if (rn2(3)) break;
    }
    initRng(seed);
    await domonnoise(death);
    assert.ok(game._toplines.length > 10);
    assert.equal(game._toplines, game._toplines.toUpperCase());
});

for (const [turns, expected] of [[5, 'You start to feel bloated.'],
                               [4, ''], [3, 'You are feeling rather flabby.']]) {
    test(`phasing warning at ${turns} remaining turns`, async () => {
        await setup();
        game.u.intrinsic.HPasses_walls = turns;
        await nh_timeout();
        assert.equal(messages(), expected);
        assert.equal(game.u.intrinsic.HPasses_walls, turns - 1);
    });
}

test('another phasing source suppresses expiration warnings', async () => {
    for (const external of [false, true]) {
        await setup();
        game.u.intrinsic.HPasses_walls = 5 | (external ? 0 : FROMOUTSIDE);
        game.u.uprops.PASSES_WALLS = external ? 1 : 0;
        await nh_timeout();
        assert.doesNotMatch(messages(), /bloated|flabby/);
        assert.equal(game.u.intrinsic.HPasses_walls & TIMEOUT, 4);
    }
});

for (const [turns, expected] of [[5, 'You seem to have some trouble breathing.'],
                               [4, ''], [3, 'The air here seems foul.']]) {
    test(`gas protection warning at ${turns} remaining turns`, async () => {
        await setup();
        await create_gas_cloud(game.u.ux, game.u.uy, 1, 8);
        game._toplines = '';
        game._msg_history = [];
        game._toplin = 0;
        game.u.intrinsic.HMagical_breathing = turns;
        await nh_timeout();
        assert.equal(game._toplines, expected);
        assert.equal(game.u.intrinsic.HMagical_breathing, turns - 1);
        assert.equal(game.u.uhp, 200, 'the warning does not remove protection');
    });
}

test('gas warnings require danger and no other breathing protection', async () => {
    for (const protection of ['outside-cloud', 'permanent', 'external', 'poison-resistant']) {
        await setup();
        if (protection !== 'outside-cloud')
            await create_gas_cloud(game.u.ux, game.u.uy, 1, 8);
        game.u.intrinsic.HMagical_breathing = 5
            | (protection === 'permanent' ? FROMOUTSIDE : 0);
        game.u.uprops.MAGICAL_BREATHING = protection === 'external' ? 1 : 0;
        game.u.uprops.POISON_RES = protection === 'poison-resistant' ? 1 : 0;
        await nh_timeout();
        assert.doesNotMatch(messages(), /trouble breathing|air here seems foul/);
        assert.equal(game.u.intrinsic.HMagical_breathing & TIMEOUT, 4);
    }
});
