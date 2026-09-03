#!/usr/bin/env node

// State checks for monster theft, life drain, brain drain, and petrification.
// The paired C recording pins every input screen, cursor, and RNG call.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { nh_timeout } from '../js/timeout.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { EDOG, has_edog } from '../js/const.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/monster-special-status-melee.json',
    import.meta.url), 'utf8'));
const cTrace = JSON.parse(await readFile(new URL(
    'gen-sessions/generated/monster-special-status-melee.session.json',
    import.meta.url), 'utf8'));

function liveMonsters(mnum) {
    return (game.level?.monsters || []).filter(mon =>
        mon.mnum === mnum && (mon.mhp | 0) > 0);
}

function cRng(index) {
    return cTrace.segments[index].steps.flatMap(step => step.rng || []);
}

function cLines(index) {
    return cTrace.segments[index].steps.map(step =>
        (step.screen || '').split('\n')[0]);
}

function relevantUnported() {
    return [...(game.unported || [])].filter(path =>
        /mhitm_ad_sedu:mhitm|mhitm_ad_drli:mhitm|mhitm_ad_drin:nonhero|mhitm_ad_ston:mhitm|mdamagem:petrify_agr|mattackm:failed_grab|hurtle_u:monster_collision/
            .test(path));
}

function monsterSnapshot(mon) {
    return {
        pos: [mon.mx | 0, mon.my | 0],
        inventory: (mon.minvent || []).map(obj => obj.otyp),
    };
}

const emptySegment = recipe.segments[0];
const emptyAttack = emptySegment.moves.lastIndexOf('m.');
assert.ok(emptyAttack > 0,
          'empty-inventory fixture contains its forced wait command');
await runSegment({
    ...emptySegment,
    moves: emptySegment.moves.slice(0, emptyAttack),
});
const nymphBefore = monsterSnapshot(liveMonsters(
    PMNAMES.PM_WATER_NYMPH)[0]);

for (const [index, segment] of recipe.segments.entries()) {
    const replay = await runSegment({ ...segment });
    const expectedRng = cRng(index).length;
    assert.equal(replay.getRngLog().length, expectedRng,
                 `segment ${index} matches the C RNG total`);
    assert.deepEqual(relevantUnported(), [],
                     `segment ${index} leaves no former gap marker`);
    if (game.u.wiz_intrinsic_timeouts?.CONFLICT) {
        assert.equal(game.u.uprops?.CONFLICT,
                     game.u.wiz_intrinsic_timeouts.CONFLICT,
                     `segment ${index} exposes the live conflict timeout`);
    }
}

assert.ok(cLines(0).some(line =>
    line.includes('The water nymph smiles at the lichen engagingly.')),
'C trace reaches the nymph attack against an empty-inventory lichen');
assert.ok(cRng(0).some(call =>
    call.includes('rnd(20)=11 @ mattackm')),
'C trace spends the nymph monster-versus-monster hit roll');
assert.ok(cLines(0).every(line =>
    !line.includes('steals') && !line.includes('disappears')),
'empty-inventory attack neither steals nor relocates the nymph');
await runSegment({ ...emptySegment });
const emptyNymphs = liveMonsters(PMNAMES.PM_WATER_NYMPH);
assert.equal(emptyNymphs.length, 1, 'empty-inventory nymph survives');
assert.deepEqual(monsterSnapshot(emptyNymphs[0]), nymphBefore,
                 'empty-inventory attack preserves nymph position and items');
assert.ok(liveMonsters(PMNAMES.PM_LICHEN).every(mon =>
    !(mon.minvent || []).length),
'all lichen targets remain empty-handed');

await runSegment({ ...recipe.segments[1] });
assert.ok(cLines(1).some(line =>
    line.includes('steals a K-ration from the soldier')),
'C trace reaches inventory theft from another monster');
assert.ok(cLines(1).some(line => line.includes('suddenly disappears')),
          'C trace reaches post-theft nymph relocation');
assert.ok(cRng(1).some(call => call.includes('@ rloc')),
          'C trace spends relocation coordinates after theft');
const stealingNymph = liveMonsters(PMNAMES.PM_WATER_NYMPH)[0];
assert.ok(stealingNymph.minvent.some(obj => obj.otyp === ONAMES.K_RATION),
          'nymph owns the stolen K-ration');
assert.ok(liveMonsters(PMNAMES.PM_SOLDIER).every(mon =>
    !mon.minvent.some(obj => obj.otyp === ONAMES.K_RATION)),
'neither soldier retains the stolen K-ration');

await runSegment({ ...recipe.segments[2] });
assert.ok(cRng(2).some(call =>
    call.includes('d(2,6)=7 @ mhitm_ad_drli')),
'C trace reaches monster-versus-monster life drain');
assert.ok(cLines(2).some(line => line.includes('becomes weaker!')),
          'C trace reports the drained monster losing a level');
assert.ok(cLines(2).some(line =>
    line.includes('The wraith touches the wraith.  The wraith touches the wraith.')),
'C trace covers successful touch attacks against unsolid monsters');
assert.deepEqual(liveMonsters(PMNAMES.PM_HILL_GIANT).map(mon =>
    [mon.m_lev | 0, mon.mhpmax | 0]).sort((a, b) => a[0] - b[0]),
[[11, 46], [12, 48]],
'life drain preserves the C giant levels and maximum hit points');
assert.deepEqual(liveMonsters(PMNAMES.PM_WRAITH).map(mon => mon.m_lev | 0),
                 [9, 9, 9, 9],
                 'all four wraiths keep their expected levels');

await runSegment({ ...recipe.segments[3] });
assert.equal(cRng(3).filter(call =>
    /rnd\(10\)=\d+ @ eat_brains/.test(call)).length, 4,
'C trace reaches four intelligence-drain rolls');
assert.equal(cRng(3).filter(call =>
    /rnd\(60\)=\d+ @ eat_brains/.test(call)).length, 4,
'C trace reaches four brain-eating nutrition rolls');
assert.equal(cLines(3).filter(line => line.includes('brain is eaten!')).length,
             4, 'C trace reports four successful brain-eating attacks');
assert.deepEqual(liveMonsters(PMNAMES.PM_MIND_FLAYER).map(mon =>
    mon.edog?.hungrytime | 0).sort((a, b) => a - b),
[1001, 1102],
'brain eating applies the C pet nutrition changes');
for (const pet of liveMonsters(PMNAMES.PM_MIND_FLAYER)) {
    assert.equal(EDOG(pet), pet.edog,
                 'C macro and pet AI read the same initialized nutrition state');
    assert.equal(has_edog(pet), true, 'tamed mind flayer has pet state');
}

await runSegment({ ...recipe.segments[4] });
assert.ok(cLines(4).some(line =>
    line.includes('The cockatrice touches the hill giant.  The hill giant turns to stone!')),
'C trace reaches active petrification');
assert.ok(cLines(4).some(line =>
    line.includes('The hill giant hits the cockatrice.  The hill giant turns to stone!')),
'C trace reaches contact petrification of the attacker');
assert.equal(liveMonsters(PMNAMES.PM_COCKATRICE).length, 4,
             'all four cockatrices survive');
assert.equal(liveMonsters(PMNAMES.PM_HILL_GIANT).length, 0,
             'both petrified giants are removed');
assert.equal((game.level?.objects || []).filter(obj =>
    obj.otyp === ONAMES.STATUE
        && obj.corpsenm === PMNAMES.PM_HILL_GIANT).length, 2,
'both petrification paths leave hill giant statues');

game.u.uprops.FREE_ACTION = 1;
game.u.wiz_intrinsic_timeouts = { FREE_ACTION: 1 };
game.u.wiz_intrinsic_base_props = {
    FREE_ACTION: { had: false, value: undefined },
};
await nh_timeout();
assert.equal(Object.hasOwn(game.u.uprops, 'FREE_ACTION'), false,
             'expired generic wizard intrinsic removes a new property');

game.u.uprops.FREE_ACTION = 1;
game.u.wiz_intrinsic_timeouts = { FREE_ACTION: 1 };
game.u.wiz_intrinsic_base_props = {
    FREE_ACTION: { had: true, value: 37 },
};
await nh_timeout();
assert.equal(game.u.uprops.FREE_ACTION, 37,
             'expired generic wizard intrinsic restores an existing value');

console.log('monster special status melee state: PASS');
