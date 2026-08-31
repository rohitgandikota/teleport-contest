#!/usr/bin/env node

// State checks for src/mhitu.c passiveum(). The paired C recording pins
// terminal output and RNG order for the same polymorphed-hero cases.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';

const recipePath = new URL('gen-sessions/recipes/passiveum-controls.json',
                           import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));

function snapshot(state, step) {
    return {
        step,
        hero: {
            umonnum: state.u.umonnum,
            mh: state.u.mh | 0,
            mhmax: state.u.mhmax | 0,
            uhp: state.u.uhp | 0,
            ublind: state.u.ublind | 0,
            umovement: state.u.umovement | 0,
        },
        monsters: (state.level.monsters || [])
            .filter(mon => (mon.mhp || 0) > 0)
            .map(mon => ({
                mnum: mon.mnum,
                mhp: mon.mhp | 0,
                mhpmax: mon.mhpmax | 0,
                mcanmove: mon.mcanmove,
                mfrozen: mon.mfrozen | 0,
                mstun: mon.mstun | 0,
            })),
    };
}

async function run(index) {
    const trace = [];
    globalThis.__step_snapshot = {
        step: '*',
        cb: (state, step) => trace.push(snapshot(state, step)),
    };
    try {
        await runSegment({ ...recipe.segments[index], onFrame: () => {} });
    } finally {
        delete globalThis.__step_snapshot;
    }
    return trace;
}

function liveMonster(mnum) {
    return (game.level.monsters || []).find(mon => mon.mnum === mnum
                                             && (mon.mhp || 0) > 0);
}

function traceHasMonster(trace, mnum, predicate) {
    return trace.some(frame => frame.monsters.some(mon => mon.mnum === mnum
                                                       && predicate(mon)));
}

await run(0);
let soldier = liveMonster(PMNAMES.PM_SOLDIER);
assert.equal(soldier?.mhp, 34,
             'acid-blob splash leaves the soldier at C-recorded HP');
assert.equal(soldier?.mhpmax, 37,
             'acid-blob target keeps its original maximum HP');
assert.ok(soldier.minvent.every(obj => !(obj.oeroded2 || 0)),
          'failed corrosion rolls leave the soldier inventory intact');

await run(1);
let target = liveMonster(PMNAMES.PM_YELLOW_DRAGON);
assert.equal(target?.mhp, target?.mhpmax,
             'acid resistance suppresses passive acid damage');

await run(2);
assert.equal(liveMonster(PMNAMES.PM_MINOTAUR), undefined,
             'unprotected cockatrice contact petrifies the minotaur');

await run(3);
soldier = liveMonster(PMNAMES.PM_SOLDIER);
assert.equal(soldier?.mhp, soldier?.mhpmax,
             'a wielded weapon protects the soldier from petrification');
assert.ok(soldier?.mw, 'the protected soldier is wielding a weapon');

await run(4);
target = liveMonster(PMNAMES.PM_BARROW_WIGHT);
assert.equal(target?.mw?.spe, 0,
             'disenchanter form drains the barrow wight weapon to +0');
assert.equal(game.u.umonnum, PMNAMES.PM_DISENCHANTER,
             'weapon drain leaves the hero in disenchanter form');

await run(5);
soldier = liveMonster(PMNAMES.PM_SOLDIER);
assert.equal(soldier?.mcanmove, 0,
             'floating-eye gaze leaves the soldier unable to move');
assert.equal(soldier?.mfrozen, 68,
             'floating-eye gaze installs the C-recorded freeze duration');

let trace = await run(6);
assert.ok(traceHasMonster(trace, PMNAMES.PM_SOLDIER,
                          mon => !mon.mcanmove && mon.mfrozen > 0),
          'gelatinous-cube contact freezes the soldier');
soldier = liveMonster(PMNAMES.PM_SOLDIER);
assert.equal(soldier?.mcanmove, 1,
             'the soldier recovers after the recorded frozen turns');
assert.equal(soldier?.mfrozen, 0,
             'gelatinous-cube freeze duration fully expires');

await run(7);
target = liveMonster(PMNAMES.PM_BLUE_JELLY);
assert.ok(target?.mcloned,
          'absorbed heat splits off a cloned blue jelly');
assert.equal(target?.mhp, 21,
             'the blue-jelly clone receives half the grown form HP');
assert.equal(target?.mhpmax, 21,
             'the blue-jelly clone receives half the grown maximum HP');
assert.equal(liveMonster(PMNAMES.PM_GIANT_ANT), undefined,
             'cold retaliation kills the giant ant attacker');

await run(8);
target = liveMonster(PMNAMES.PM_WINTER_WOLF_CUB);
assert.equal(target?.mhp, target?.mhpmax,
             'cold-resistant attacker takes no blue-jelly damage');
assert.equal(liveMonster(PMNAMES.PM_BLUE_JELLY), undefined,
             'resisted cold does not split off a blue-jelly clone');

trace = await run(9);
assert.ok(traceHasMonster(trace, PMNAMES.PM_GRID_BUG,
                          mon => mon.mstun === 1),
          'yellow-mold retaliation stuns the grid bug');
target = liveMonster(PMNAMES.PM_GRID_BUG);
assert.equal(target?.mstun, 0,
             'the grid bug recovers after the recorded turns');

await run(10);
target = liveMonster(PMNAMES.PM_FIRE_ANT);
assert.equal(target?.mhp, target?.mhpmax,
             'fire-resistant attacker takes no passive fire damage');
assert.equal(game.u.umonnum, PMNAMES.PM_FIRE_VORTEX,
             'fire control leaves the hero in fire-vortex form');

await run(11);
target = liveMonster(PMNAMES.PM_STORM_GIANT);
assert.equal(target?.mhp, target?.mhpmax,
             'shock-resistant attacker takes no electrical damage');
assert.equal(game.u.umonnum, PMNAMES.PM_TOURIST,
             'storm-giant attack rehumanizes the energy vortex');
assert.equal(game.u.uhp, 117,
             'rehumanization resumes the base HP pool at C-recorded HP');
assert.equal(game.u.umovement, 19,
             'rehumanization prorates fast-form movement before scheduling');

await run(12);
assert.equal(liveMonster(PMNAMES.PM_SOLDIER), undefined,
             'wounded soldier escapes upstairs from dungeon level one');
assert.equal(game.u.umonnum, PMNAMES.PM_FIRE_VORTEX,
             'soldier escape leaves the hero in fire-vortex form');
assert.equal(game.u.mh, 32,
             'fire-vortex form keeps the C-recorded polymorph HP');
assert.ok(![...(game.unported || [])].some(path =>
    path.startsWith('use_misc') || path.startsWith('migrate_monster')),
           'covered stair escape has no unported path marker');

await run(13);
assert.equal(liveMonster(PMNAMES.PM_GIANT_ANT), undefined,
             'energy-vortex retaliation kills the giant ant');
assert.equal(game.u.umonnum, PMNAMES.PM_ENERGY_VORTEX,
             'electric kill leaves the hero in energy-vortex form');
assert.equal(game.u.mh, 18,
             'energy-vortex form keeps the C-recorded polymorph HP');

console.log('polymorphed hero passive state: PASS');
