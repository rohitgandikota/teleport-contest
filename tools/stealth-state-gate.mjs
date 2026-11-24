// Source controls for youprop.h:210 and the existing mounted-state producer.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { game } from '../js/gstate.js';
import { Stealth } from '../js/youprop.js';
import { float_vs_flight, steed_vs_stealth } from '../js/polyself.js';
import { dismount_steed } from '../js/steed.js';
import { FROMOUTSIDE, W_RINGL, DISMOUNT_GENERIC } from '../js/const.js';
import { getRngLog, rn2 } from '../js/rng.js';
import { setup, mount, seed, clearMessages, messages }
    from './status-followup-test-setup.mjs';

test('Stealth requires an active source and no blocking mask', async () => {
    await setup(); seed();
    for (const [intrinsic, extrinsic] of [[0, 0], [FROMOUTSIDE, 0],
        [0, W_RINGL], [FROMOUTSIDE, W_RINGL]]) {
        game.u.intrinsic.HStealth = intrinsic;
        game.u.uprops.STEALTH = extrinsic;
        for (const blocked of [0, FROMOUTSIDE, 1]) {
            game.u.blocked.STEALTH = blocked;
            assert.equal(Stealth(), !!(intrinsic || extrinsic) && !blocked);
            assert.equal(game.u.intrinsic.HStealth, intrinsic);
            assert.equal(game.u.uprops.STEALTH, extrinsic);
            assert.equal(game.u.blocked.STEALTH, blocked);
        }
    }
    assert.deepEqual(getRngLog(), []);
});

for (const movement of ['ground', 'flight', 'levitation']) {
    test(`real mounting and dismounting preserve ${movement} stealth rules`, async () => {
        await setup();
        game.u.intrinsic.HStealth = FROMOUTSIDE;
        if (movement === 'flight') game.u.intrinsic.HFlying = FROMOUTSIDE;
        if (movement === 'levitation') game.u.intrinsic.HLevitation = FROMOUTSIDE;
        float_vs_flight();
        assert.equal(Stealth(), true);
        await mount();
        assert.ok(game.u.usteed);
        assert.equal(!!(game.u.blocked.STEALTH & FROMOUTSIDE), movement === 'ground');
        assert.equal(Stealth(), movement !== 'ground');
        clearMessages();
        await dismount_steed(DISMOUNT_GENERIC);
        assert.equal(game.u.usteed, null);
        assert.equal(game.u.blocked.STEALTH & FROMOUTSIDE, 0);
        assert.equal(Stealth(), true);
        assert.equal(messages().includes('You seem less noisy now.'), movement === 'ground');
    });
}

// Private C function access is supplied only by the test loader. Its body is unchanged.
import { disturb } from '../js/monmove.js';
import { makemon } from '../js/makemon.js';
import { PMNAMES } from '../js/monst_data.js';
import { COULD_SEE, IN_SIGHT } from '../js/vision.js';
import { TT_WEB, TT_PIT, NO_MINVENT, MM_NOGRP, MM_NOWAIT, MM_NOMSG }
    from '../js/const.js';

test('mount producer clears only FROMOUTSIDE and preserves other source-only blockers', async () => {
    await setup();
    game.u.intrinsic.HStealth = FROMOUTSIDE;
    game.u.blocked.STEALTH = W_RINGL;
    await mount();
    assert.equal(game.u.blocked.STEALTH, W_RINGL | FROMOUTSIDE);
    await dismount_steed(DISMOUNT_GENERIC);
    assert.equal(game.u.blocked.STEALTH, W_RINGL);
    assert.equal(Stealth(), false);
    assert.ok(!messages().includes('You seem less noisy now.'));
    // No current producer is claimed for W_RINGL as a blocker. This tests C's mask contract.
});

test('real float_vs_flight changes mounted blocking as floor trapping changes', async () => {
    await setup();
    game.u.intrinsic.HStealth = FROMOUTSIDE;
    await mount();
    seed();
    game.u.intrinsic.HLevitation = FROMOUTSIDE;
    float_vs_flight();
    assert.equal(game.u.blocked.STEALTH & FROMOUTSIDE, 0);
    assert.equal(Stealth(), true);
    game.u.utrap = 3;
    game.u.utraptype = TT_WEB;
    float_vs_flight();
    assert.equal(game.u.blocked.STEALTH & FROMOUTSIDE, FROMOUTSIDE);
    assert.equal(Stealth(), false);
    game.u.utraptype = TT_PIT;
    float_vs_flight();
    assert.equal(game.u.blocked.STEALTH & FROMOUTSIDE, 0);
    assert.equal(Stealth(), true);
    assert.deepEqual(getRngLog(), []);
});

// Each explicit draw list comes from the short-circuit order in monmove.c:341-352.
// Expected values come from the seeded RNG itself before replaying the real consumer.
const cases = [
    {name:'unblocked dog stops at stealth', species:PMNAMES.PM_JACKAL, draws:[], wakes:false},
    {name:'grounded mount permits dog wake without a draw', species:PMNAMES.PM_JACKAL, mounted:true, draws:[], wakes:true},
    {name:'stealthy ettin zero stops before final roll', species:PMNAMES.PM_ETTIN, seed:11, draws:[10], wakes:false, check:v=>assert.equal(v[0],0)},
    {name:'stealthy ettin nonzero reaches wake roll', species:PMNAMES.PM_ETTIN, seed:1, draws:[10,7], wakes:true, check:v=>{assert.notEqual(v[0],0);assert.equal(v[1],0);}},
    {name:'grounded mount skips ettin stealth roll', species:PMNAMES.PM_ETTIN, mounted:true, seed:1, draws:[7], wakes:v=>v[0]===0},
    {name:'unblocked nymph stops before rare wake roll', species:PMNAMES.PM_WOOD_NYMPH, draws:[], wakes:false},
    {name:'grounded mount reaches nymph rare wake roll', species:PMNAMES.PM_WOOD_NYMPH, mounted:true, seed:2, draws:[50], wakes:false, check:v=>assert.notEqual(v[0],0)},
    {name:'nymph rarity still precedes aggravation', species:PMNAMES.PM_WOOD_NYMPH, mounted:true, seed:21, aggravate:true, draws:[50], wakes:true, check:v=>assert.equal(v[0],0)},
    {name:'nymph success reaches the final wake roll', species:PMNAMES.PM_WOOD_NYMPH, mounted:true, seed:21, draws:[50,7], wakes:v=>v[1]===0, check:v=>assert.equal(v[0],0)},
    {name:'line of sight rejects before every RNG guard', species:PMNAMES.PM_JACKAL, mounted:true, noLos:true, draws:[], wakes:false},
    {name:'squared distance 100 remains eligible', species:PMNAMES.PM_JACKAL, mounted:true, dx:10, dy:0, draws:[], wakes:true},
    {name:'squared distance 101 rejects before every RNG guard', species:PMNAMES.PM_JACKAL, mounted:true, dx:10, dy:1, draws:[], wakes:false},
];
for (const spec of cases) test(`disturb: ${spec.name}`, async () => {
    await setup();
    game.u.intrinsic.HStealth = FROMOUTSIDE;
    if (spec.mounted) await mount();
    game.u.intrinsic.HAggravate_monster = spec.aggravate ? FROMOUTSIDE : 0;
    const x = game.u.ux + (spec.dx ?? 2), y = game.u.uy + (spec.dy ?? 0);
    const monster = makemon(game.mons[spec.species], x, y,
        NO_MINVENT | MM_NOGRP | MM_NOWAIT | MM_NOMSG);
    assert.ok(monster);assert.equal(monster.mx,x);assert.equal(monster.my,y);
    monster.msleeping = 1;monster.mpeaceful = 0;monster.m_ap_type = 0;
    game.viz_array[y][x] = spec.noLos ? 0 : COULD_SEE | IN_SIGHT;
    clearMessages();
    seed(spec.seed ?? 2);
    const values = spec.draws.map(bound=>rn2(bound));
    spec.check?.(values);
    const expected = getRngLog().map(call=>call.replace(/\s*@\s.*$/,''));
    const wakes = typeof spec.wakes === 'function' ? spec.wakes(values) : spec.wakes;
    seed(spec.seed ?? 2);
    const result = await disturb(monster);
    const actual = getRngLog().map(call=>call.replace(/\s*@\s.*$/,''));
    console.log('DISTURB_RECEIPT '+JSON.stringify({name:spec.name,expected,actual,result,wakes,
        blocked:game.u.blocked.STEALTH??0,sleeping:monster.msleeping}));
    assert.deepEqual(actual,expected,'complete source-ordered RNG stream');
    assert.equal(result,+wakes);assert.equal(monster.msleeping,wakes?0:1);
    assert.equal(messages().includes('wakes up'),wakes);
});
