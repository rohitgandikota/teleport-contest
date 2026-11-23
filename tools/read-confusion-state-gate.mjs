#!/usr/bin/env node
// C-derived scroll controls. Private exports are exposed only by the test loader.
import {register} from 'node:module';
import {game} from '../js/gstate.js';
register('./read-confusion-state-loader.mjs', import.meta.url);
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const { runSegment } = await import('../js/jsmain.js');
const { InMemoryStorage } = await import('../js/storage.js');
const { mksobj } = await import('../js/mkobj.js');
const { addinv } = await import('../js/invent.js');
const { setworn } = await import('../js/worn.js');
const { makemon, NO_MINVENT, MM_NOMSG } = await import('../js/makemon.js');
const { ONAMES } = await import('../js/objects_data.js');
const { PMNAMES } = await import('../js/monst_data.js');
const { ROOM, IN_SIGHT, COULD_SEE, W_ARMH, OBJ_DELETED } = await import('../js/const.js');
const { initRng, enableRngLog, getRngLog, d, rnd, rn2 } = await import('../js/rng.js');
const {
    seffect_charging, seffect_earth, seffect_scare_monster,
    seffect_create_monster, seffect_enchant_armor, seffect_teleportation,
} = await import('../js/read.js');

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/recharge-source-gaps.json', import.meta.url)));

async function setup(mode = 'none') {
    const run = await runSegment({ ...recipe.segments[0], moves: ' ',
        storage: new InMemoryStorage() });
    let dismissals = 0;
    run._display.onEmptyQueue = () => {
        if (++dismissals > 30) throw Error('unexpected repeated prompt');
        return 0x1b;
    };
    game._preNhgetchHook = null;
    game.level.monsters = []; game.level.monAt.clear();
    game.level.objects = []; game.level.traps = []; game.regions = [];
    game.u.ux = 31; game.u.uy = 10;
    game.u.uswallow = false; game.u.ustuck = null; game.u.usteed = null;
    game.u.intrinsic = {}; game.u.uprops = {}; game.u.blocked = {};
    game.u.ublind = 0; game.u.ublindf = null;
    game.u.uhp = game.u.uhpmax = 1000;
    game.u.uen = 10; game.u.uenmax = 30;
    game.u.uhave.amulet = 0;
    game.invent = [];
    game.known = false; game.wizard = false;
    for (let x = 23; x <= 39; x++) for (let y = 2; y <= 18; y++) {
        Object.assign(game.level.at(x, y), { typ: ROOM, doormask: 0,
            lit: 1, waslit: 1, seenv: 255, roomno: 0 });
        game.viz_array[y][x] = IN_SIGHT | COULD_SEE;
    }
    if (mode === 'intrinsic') game.u.intrinsic.HConfusion = 100;
    if (mode === 'compatibility') game.u.uprops.CONFUSION = 1;
    game._toplines = ''; game._msg_history = [];
}

function scroll(type, buc = 'uncursed') {
    const obj = mksobj(ONAMES[type], false, false);
    obj.blessed = buc === 'blessed'; obj.cursed = buc === 'cursed';
    game.objects[obj.otyp].oc_name_known = true;
    return obj;
}
function seed(value = 3) { initRng(value); enableRngLog(); }
function calls() { return getRngLog().map(call => call.split('=')[0]); }
function messages() { return [...game._msg_history, game._toplines].join('\n'); }

// read.c:1798-1825: confused charging returns before useup/getobj. A cursed
// scroll drains energy without a draw; the other two roll exactly 4d4/6d4.
for (const mode of ['none', 'intrinsic', 'compatibility']) {
    for (const buc of ['uncursed', 'blessed', 'cursed']) {
        test(`charging: ${mode}, ${buc}`, async () => {
            await setup(mode);
            const obj = scroll('SCR_CHARGING', buc);
            addinv(obj);
            seed();
            const consumed = await seffect_charging(obj);
            if (mode === 'none') {
                assert.equal(consumed, true);
                assert.equal(obj.where, OBJ_DELETED);
                assert.deepEqual([game.u.uen, game.u.uenmax], [10, 30]);
                assert.deepEqual(calls(), []);
            } else {
                assert.equal(consumed, false);
                assert.ok(game.invent.includes(obj));
                assert.deepEqual([game.u.uen, game.u.uenmax],
                    buc === 'cursed' ? [0, 30] : [30, 30]);
                assert.deepEqual(calls(), buc === 'cursed' ? []
                    : [`d(${buc === 'blessed' ? 6 : 4},4)`]);
                assert.match(messages(), buc === 'cursed' ? /discharged/ : /charged up/);
            }
        });
    }
}
test('charging increases the maximum when current energy plus 4d4 exceeds it', async () => {
    await setup('intrinsic');
    const obj = scroll('SCR_CHARGING');
    game.u.uen = game.u.uenmax = 30;
    seed(); const gain = d(4, 4); const expectedRng = [...getRngLog()];
    seed(); await seffect_charging(obj);
    assert.deepEqual([game.u.uen, game.u.uenmax], [30 + gain, 30 + gain]);
    assert.deepEqual(getRngLog(), expectedRng);
});

// read.c:1924-1970: confusion changes boulders to rock stacks without
// changing the blessed/cursed position filters or the loop's x/y order.
for (const mode of ['none', 'intrinsic', 'compatibility']) {
    for (const buc of ['blessed', 'cursed']) {
        test(`earth: ${mode}, ${buc}`, async () => {
            await setup(mode);
            const obj = scroll('SCR_EARTH', buc);
            seed(); await seffect_earth(obj);
            const drops = game.level.objects.filter(o =>
                Math.abs(o.ox - 31) <= 1 && Math.abs(o.oy - 10) <= 1);
            assert.equal(drops.length, buc === 'blessed' ? 8 : 1);
            assert.ok(drops.every(o => o.otyp ===
                (mode === 'none' ? ONAMES.BOULDER : ONAMES.ROCK)));
            assert.ok(drops.every(o => mode === 'none' ? o.quan === 1
                : o.quan >= 2 && o.quan <= 6));
            assert.equal(drops.some(o => o.ox === 31 && o.oy === 10), buc === 'cursed');
            assert.equal(calls().filter(c => c === 'rn2(5)').length,
                mode === 'none' ? 0 : drops.length);
            assert.equal(game.u.uhp === 1000, buc === 'blessed');
            assert.equal(game.known, true);
        });
    }
}

// read.c:1459-1487: inverted fear wakes visible live monsters and never
// calls resist; offscreen/dead monsters are untouched.
for (const [mode, buc] of [ ['none', 'uncursed'], ['intrinsic', 'uncursed'],
                          ['compatibility', 'uncursed'], ['none', 'cursed'] ]) {
    test(`scare monster: ${mode}, ${buc}`, async () => {
        await setup(mode);
        const mon = await makemon(game.mons[PMNAMES.PM_ACID_BLOB], 32, 10,
            NO_MINVENT | MM_NOMSG);
        Object.assign(mon, { mflee: 1, mfrozen: 12, msleeping: 1, mcanmove: 0 });
        const unseen = { ...mon, m_id: mon.m_id + 100, mx: 23, my: 2 };
        const dead = { ...mon, m_id: mon.m_id + 101, mx: 30, my: 10, mhp: 0 };
        game.level.monsters.push(unseen, dead);
        game.viz_array[2][23] = 0;
        const obj = scroll('SCR_SCARE_MONSTER', buc);
        seed(); await seffect_scare_monster(obj);
        const inverted = mode !== 'none' || buc === 'cursed';
        assert.deepEqual([mon.mflee, mon.mfrozen, mon.msleeping, mon.mcanmove],
            inverted ? [0, 0, 0, 1] : [1, 12, 1, 0]);
        for (const ignored of [unseen, dead])
            assert.deepEqual([ignored.mflee, ignored.mfrozen, ignored.msleeping,
                ignored.mcanmove], [1, 12, 1, 0]);
        // resist: scroll attack level 9, acid blob defense level clamped to 1.
        assert.deepEqual(calls(), inverted ? [] : ['rn2(108)']);
        assert.match(messages(), inverted ? /sad wailing close by/ : /maniacal laughter close by/);
    });
}

// read.c:1124-1167: confusing the enchantment proof/repair path preserves
// spe and returns before the ordinary rnd(enchantment) draw.
for (const mode of ['none', 'intrinsic', 'compatibility']) {
    for (const buc of ['uncursed', 'cursed']) {
        test(`enchant armor: ${mode}, ${buc}`, async () => {
            await setup(mode);
            const armor = mksobj(ONAMES.HELMET, false, false);
            armor.spe = 0; armor.oeroded = 1; armor.oeroded2 = 2;
            armor.oerodeproof = buc === 'cursed' ? 1 : 0;
            addinv(armor); setworn(armor, W_ARMH);
            const obj = scroll('SCR_ENCHANT_ARMOR', buc);
            seed(); await seffect_enchant_armor(obj);
            if (mode === 'none') {
                assert.equal(Math.sign(armor.spe), buc === 'cursed' ? -1 : 1);
                assert.deepEqual([armor.oeroded, armor.oeroded2], [1, 2]);
                assert.deepEqual(calls(), ['rnd(3)']);
            } else {
                assert.equal(armor.spe, 0);
                assert.equal(armor.oerodeproof, buc === 'cursed' ? 0 : 1);
                assert.deepEqual([armor.oeroded, armor.oeroded2],
                    buc === 'cursed' ? [1, 2] : [0, 0]);
                assert.deepEqual(calls(), []);
            }
        });
    }
}

// read.c:1613-1621: blessing suppresses rn2(73); confusion requests thirteen
// acid blobs. The rare extra-count roll still precedes all monster creation.
for (const mode of ['none', 'intrinsic', 'compatibility']) {
    test(`create monster: blessed, ${mode}`, async () => {
        await setup(mode);
        const obj = scroll('SCR_CREATE_MONSTER', 'blessed');
        seed(); await seffect_create_monster(obj);
        assert.ok(!calls().includes('rn2(73)'));
        if (mode === 'none') {
            assert.ok(game.level.monsters.some(m => m.mnum !== PMNAMES.PM_ACID_BLOB));
        } else {
            assert.equal(game.level.monsters.length, 13);
            assert.ok(game.level.monsters.every(m => m.mnum === PMNAMES.PM_ACID_BLOB));
        }
    });
}
test('create monster: rare extra count follows rn2(73), before creating acid blobs', async () => {
    await setup('intrinsic');
    const obj = scroll('SCR_CREATE_MONSTER');
    seed(18); assert.equal(rn2(73), 0); const extra = rnd(4);
    const prefix = [...getRngLog()];
    seed(18); await seffect_create_monster(obj);
    assert.deepEqual(getRngLog().slice(0, 2), prefix);
    assert.equal(game.level.monsters.length, 13 + extra);
    assert.ok(game.level.monsters.every(m => m.mnum === PMNAMES.PM_ACID_BLOB));
});

// read.c:2019-2031: a numeric compatibility value selects level_tele, too.
// Real teleport helpers are exercised, with the Amulet guard preventing a
// level change. Normal scrolltele spends rn2(3), level_tele spends no RNG.
for (const [mode, buc] of [ ['none', 'uncursed'], ['intrinsic', 'uncursed'],
                          ['compatibility', 'uncursed'], ['none', 'cursed'] ]) {
    test(`teleportation: ${mode}, ${buc}`, async () => {
        await setup(mode); game.u.uhave.amulet = 1;
        const obj = scroll('SCR_TELEPORTATION', buc);
        const position = [game.u.ux, game.u.uy, game.u.uz.dnum, game.u.uz.dlevel];
        seed(); await seffect_teleportation(obj);
        const level = mode !== 'none' || buc === 'cursed';
        assert.deepEqual(calls(), level ? [] : ['rn2(3)']);
        assert.equal(game.known, level, 'only the level-teleport effect sets known');
        assert.match(messages(), level ? /very disoriented/ : /feel disoriented/);
        assert.deepEqual([game.u.ux, game.u.uy, game.u.uz.dnum, game.u.uz.dlevel], position);
    });
}

const native = JSON.parse(readFileSync(new URL(
    'gen-sessions/generated/read-confusion-contracts.session.json', import.meta.url)));
const stripCaller = call => call.replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim();
test('native confused scroll inputs reach each intended effect', () => {
    for (const [segment, step, text] of [
        [0,80,'You feel charged up!'], [0,89,'You feel discharged.'],
        [1,88,'covered by a shimmering golden shield!'], [1,89,'looks as good as new!'],
        [2,50,'The ceiling rumbles around you!'], [3,105,'You hear sad wailing close by.'],
    ]) assert.ok(native.segments[segment].steps[step].screen.includes(text), text);
});
for (const [index, segment] of native.segments.entries()) {
    test(`native scroll case ${index}: every input retains its RNG slice`, async () => {
        const run = await runSegment({...segment, storage:new InMemoryStorage()});
        const slices = run.getRngSlices();
        for (const [step, expected] of segment.steps.entries())
            assert.deepEqual((slices[step] || []).map(stripCaller),
                expected.rng.map(stripCaller), `input ${step}`);
        assert.equal(run.getRngLog().length, segment.steps.reduce((n,s) => n+s.rng.length, 0));
        assert.deepEqual(run.getCursors(), segment.steps.map(s => s.cursor));
    });
}
