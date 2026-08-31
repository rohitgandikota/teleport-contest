#!/usr/bin/env node

// State checks for scroll-of-taming target selection and attitude changes.
// The paired C recording pins every visible frame and random call while this
// gate checks the underlying monster, steed, engulfer, and shopkeeper state.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';

const recipePath = new URL('gen-sessions/recipes/taming-branches.json',
                           import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));
const kopTypes = new Set([
    PMNAMES.PM_KEYSTONE_KOP,
    PMNAMES.PM_KOP_SERGEANT,
    PMNAMES.PM_KOP_LIEUTENANT,
    PMNAMES.PM_KOP_KAPTAIN,
]);

function living(state, predicate = () => true) {
    return (state.level.monsters || []).filter(mon =>
        (mon.mhp | 0) > 0 && predicate(mon));
}

function chebyshev(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function snapshot(state, step) {
    return {
        step,
        message: state._pending_message || '',
        hero: {
            x: state.u.ux,
            y: state.u.uy,
            confusion: state.u.intrinsic?.HConfusion | 0,
            blindfold: state.u.ublindf?.otyp ?? null,
            steed: state.u.usteed?.mnum ?? null,
            gallop: state.u.ugallop | 0,
            swallow: state.u.uswallow | 0,
            stuck: state.u.ustuck?.mnum ?? null,
        },
        monsters: living(state).map(mon => ({
            mnum: mon.mnum,
            x: mon.mx,
            y: mon.my,
            peaceful: mon.mpeaceful | 0,
            tame: mon.mtame | 0,
            sleeping: mon.msleeping | 0,
            shk: mon.isshk | 0,
            following: mon.eshk?.following | 0,
            robbed: mon.eshk?.robbed | 0,
            home: mon.eshk?.shk
                ? { x: mon.eshk.shk.x, y: mon.eshk.shk.y }
                : null,
        })),
    };
}

async function run(index, watchedSteps) {
    const trace = new Map();
    globalThis.__step_snapshot = {
        step: '*',
        cb: (state, step) => {
            if (watchedSteps.has(step))
                trace.set(step, snapshot(state, step));
        },
    };
    try {
        await runSegment({ ...recipe.segments[index], onFrame: () => {} });
    } finally {
        delete globalThis.__step_snapshot;
    }
    return trace;
}

function monsterAt(trace, step, mnum, predicate = () => true) {
    return trace.get(step).monsters.find(mon =>
        mon.mnum === mnum && predicate(mon));
}

function kopCount(trace, step) {
    return trace.get(step).monsters.filter(mon => kopTypes.has(mon.mnum)).length;
}

function assertNoFormerMarkers(...markers) {
    const paths = [...(game.unported || [])];
    assert.ok(!paths.some(path => markers.includes(path)),
              `former implementation marker reached: ${paths.join(', ')}`);
}

let trace = await run(0, new Set([20, 21]));
const emptyRadius = trace.get(20);
assert.equal(emptyRadius.monsters.filter(mon => chebyshev(emptyRadius.hero, mon) <= 1).length,
             0, 'the no-candidate fixture has an empty ordinary radius');
assert.equal(trace.get(21).message,
             'As you read the scroll, it disappears.  Nothing interesting happens.',
             'an empty target set reports the distinct no-candidate message');

trace = await run(1, new Set([42, 43, 44]));
assert.equal(monsterAt(trace, 42, PMNAMES.PM_NEWT).peaceful, 1,
             'the cursed target begins peaceful');
assert.equal(monsterAt(trace, 43, PMNAMES.PM_NEWT).peaceful, 0,
             'the cursed scroll makes the target hostile');
assert.equal(trace.get(44).message, 'The neighborhood is unfriendlier.',
             'a visible cursed result uses the unfriendlier message');

trace = await run(2, new Set([41, 42, 43]));
assert.equal(monsterAt(trace, 41, PMNAMES.PM_KITTEN).tame, 10,
             'the existing pet begins at maximum ordinary tameness');
assert.equal(monsterAt(trace, 42, PMNAMES.PM_KITTEN).tame, 10,
             'a maximum-tameness candidate remains unchanged');
assert.equal(trace.get(43).message, 'Nothing interesting seems to happen.',
             'a candidate with no state change uses the seems-to-happen message');

trace = await run(3, new Set([93, 94, 95]));
const resistedBefore = monsterAt(trace, 93, PMNAMES.PM_ARCH_LICH);
const resistedAfter = monsterAt(trace, 94, PMNAMES.PM_ARCH_LICH);
assert.deepEqual(
    [resistedBefore.peaceful, resistedBefore.tame, resistedBefore.sleeping],
    [0, 0, 1], 'the resistant arch-lich begins hostile and sleeping');
assert.deepEqual(
    [resistedAfter.peaceful, resistedAfter.tame, resistedAfter.sleeping],
    [0, 0, 1], 'successful magic resistance preserves all attitude state');
assert.equal(trace.get(95).message, 'Nothing interesting seems to happen.',
             'a resisted candidate is distinguished from no candidates');

trace = await run(4, new Set([63, 64, 65]));
const confusedBefore = monsterAt(trace, 63, PMNAMES.PM_NEWT,
    mon => chebyshev(trace.get(63).hero, mon) === 3);
assert.ok(confusedBefore, 'the confused target starts outside the ordinary radius');
assert.equal(trace.get(63).hero.confusion, 30,
             'the debug intrinsic installs real confusion state');
const confusedAfter = monsterAt(trace, 65, PMNAMES.PM_NEWT,
    mon => mon.x === confusedBefore.x && mon.y === confusedBefore.y);
assert.deepEqual([confusedAfter.peaceful, confusedAfter.tame], [1, 5],
                 'the extended confused radius reaches and tames the distant newt');
assert.equal(trace.get(65).message,
             'Being confused, you mispronounce the magic words...',
             'the confused branch reports its altered reading');

trace = await run(5, new Set([73, 74, 75]));
assert.equal(trace.get(73).hero.blindfold, ONAMES.BLINDFOLD,
             'the unseen-result case reads while wearing a blindfold');
assert.equal(monsterAt(trace, 73, PMNAMES.PM_NEWT).peaceful, 1,
             'the unseen target begins peaceful');
assert.equal(monsterAt(trace, 74, PMNAMES.PM_NEWT).peaceful, 0,
             'the unseen cursed target still becomes hostile');
assert.equal(trace.get(75).message, 'The neighborhood seems unfriendlier.',
             'an unseen attitude change uses the qualified message');

trace = await run(6, new Set([30, 57, 58, 59]));
assert.equal(trace.get(30).hero.steed, PMNAMES.PM_PONY,
             'the successful ride leaves the pony installed as the steed');
assert.ok(trace.get(30).hero.gallop > 0,
          'kicking an accepting steed starts a timed gallop');
const steedBefore = monsterAt(trace, 57, PMNAMES.PM_PONY);
assert.deepEqual(
    [steedBefore.x, steedBefore.y, steedBefore.tame],
    [trace.get(57).hero.x, trace.get(57).hero.y, 9],
    'the low-tameness steed is a target on the hero square');
assert.equal(monsterAt(trace, 58, PMNAMES.PM_PONY).tame, 10,
             'the blessed scroll restores the existing pet to tameness ten');
assert.equal(trace.get(59).message, 'The neighborhood is friendlier.',
             'the existing-pet boost counts as a positive result');
assertNoFormerMarkers('dokick:steed');

trace = await run(7, new Set([83, 84, 85]));
assert.deepEqual(
    [trace.get(83).hero.swallow, trace.get(83).hero.stuck],
    [1, PMNAMES.PM_PURPLE_WORM],
    'the swallowed case reads while held by the purple worm');
const engulfer = monsterAt(trace, 84, PMNAMES.PM_PURPLE_WORM);
assert.deepEqual(
    [engulfer.x, engulfer.y, engulfer.peaceful, engulfer.tame],
    [trace.get(84).hero.x, trace.get(84).hero.y, 0, 0],
    'the engulfer is the hero-square target and preserves state after resistance');
assert.equal(trace.get(85).message, 'Nothing interesting seems to happen.',
             'a resisted swallowed target still counts as a candidate');

trace = await run(8, new Set([117, 118, 119, 120]));
const pursuing = trace.get(117).monsters.find(mon => mon.shk && mon.following);
assert.ok(pursuing && !pursuing.peaceful && pursuing.robbed > 0,
          'the target begins as a pursuing, robbed, angry shopkeeper');
assert.equal(chebyshev(trace.get(117).hero, pursuing), 1,
             'the angry shopkeeper is inside the ordinary target radius');
assert.ok(kopCount(trace, 117) > 0,
          'the robbery has active Kops before reconciliation');
const reconciled = trace.get(118).monsters.find(mon => mon.shk && mon.home);
assert.deepEqual(
    [reconciled.x, reconciled.y],
    [reconciled.home.x, reconciled.home.y],
    'the resistant shopkeeper is returned to the home shop square');
assert.deepEqual(
    [reconciled.peaceful, reconciled.following, reconciled.robbed],
    [1, 0, 0],
    'shopkeeper reconciliation clears anger, pursuit, and robbery debt');
assert.ok(kopCount(trace, 118) > 0,
          'Kop dismissal waits behind the shopkeeper disappearance page');
assert.equal(kopCount(trace, 119), 0,
             'continuing the reconciliation dismisses every live Kop');
assert.equal(trace.get(120).message, 'The neighborhood seems friendlier.',
             'the unseen returned shopkeeper counts as a positive result');
assertNoFormerMarkers('tamedog:make_happy_shk');

console.log('scroll-of-taming branch state: PASS');
