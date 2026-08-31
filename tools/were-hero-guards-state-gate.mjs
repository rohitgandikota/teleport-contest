#!/usr/bin/env node

// State checks for src/were.c hero-change guards and lookup tables. The
// paired C recording pins visible frames and random-call order.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { rngLogLength } from '../js/rng.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { NON_PM } from '../js/const.js';
import {
    counter_were, were_beastie, you_unwere, you_were,
} from '../js/were.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/were-hero-guards.json', import.meta.url), 'utf8'));

function adjacentHostile() {
    return (game.level.monsters || []).find(mon =>
        (mon.mhp | 0) > 0 && !mon.mpeaceful
        && Math.abs(mon.mx - game.u.ux) <= 1
        && Math.abs(mon.my - game.u.uy) <= 1);
}

await runSegment({ ...recipe.segments[0], onFrame: () => {} });
assert.equal(game.u.ulycn, PMNAMES.PM_WEREWOLF,
             'the controlled case retains the werewolf infection');
assert.equal(game.u.umonnum, PMNAMES.PM_WEREWOLF,
             'control accepts a change even with a hostile monster nearby');
assert.equal(game.u.uright?.otyp, ONAMES.RIN_POLYMORPH_CONTROL,
             'the worn ring supplies polymorph control');
assert.ok(adjacentHostile(),
          'the controlled change finishes beside a hostile monster');

const unchangedTimer = game.u.mtimedone;
const beforeCurrentForm = rngLogLength();
await you_were();
assert.equal(rngLogLength(), beforeCurrentForm,
             'a redundant change while already a werewolf draws nothing');
assert.equal(game.u.umonnum, PMNAMES.PM_WEREWOLF,
             'a redundant change preserves the current werewolf body');
assert.equal(game.u.mtimedone, unchangedTimer,
             'a redundant change preserves the polymorph timer');

game.u.mtimedone = 0;
const beforeExtension = rngLogLength();
await you_unwere(false);
assert.equal(rngLogLength(), beforeExtension + 1,
             'a blocked expired form draws one replacement timer');
assert.equal(game.u.umonnum, PMNAMES.PM_WEREWOLF,
             'a nearby hostile blocks return to human form');
assert.ok(game.u.mtimedone >= 200 && game.u.mtimedone <= 399,
          'the blocked form receives the C-defined 200 to 399 turn timer');

await runSegment({ ...recipe.segments[1], onFrame: () => {} });
assert.equal(game.u.ulycn, PMNAMES.PM_WEREWOLF,
             'the uncontrolled case remains infected');
assert.equal(game.u.umonnum, game.u.umonster,
             'a nearby hostile blocks an uncontrolled change');
assert.ok(adjacentHostile(),
          'the uncontrolled guard is exercised beside a hostile monster');

await runSegment({ ...recipe.segments[2], onFrame: () => {} });
assert.equal(game.u.ulycn, PMNAMES.PM_WEREWOLF,
             'the Unchanging case remains infected');
assert.equal(game.u.umonnum, game.u.umonster,
             'Unchanging prevents the werewolf body change');
assert.equal(game.u.uamul?.otyp, ONAMES.AMULET_OF_UNCHANGING,
             'the worn amulet supplies Unchanging');

const P = PMNAMES;
for (const [human, beast] of [
    [P.PM_HUMAN_WERERAT, P.PM_WERERAT],
    [P.PM_HUMAN_WEREJACKAL, P.PM_WEREJACKAL],
    [P.PM_HUMAN_WEREWOLF, P.PM_WEREWOLF],
]) {
    assert.equal(counter_were(human), beast,
                 'counter_were maps each human form to its beast');
    assert.equal(counter_were(beast), human,
                 'counter_were maps each beast back to its human form');
}
assert.equal(counter_were(P.PM_LICHEN), NON_PM,
             'counter_were rejects an unrelated monster');

for (const [beast, family] of [
    [P.PM_WERERAT,
     [P.PM_WERERAT, P.PM_SEWER_RAT, P.PM_GIANT_RAT, P.PM_RABID_RAT]],
    [P.PM_WEREJACKAL,
     [P.PM_WEREJACKAL, P.PM_JACKAL, P.PM_FOX, P.PM_COYOTE]],
    [P.PM_WEREWOLF,
     [P.PM_WEREWOLF, P.PM_WOLF, P.PM_WARG, P.PM_WINTER_WOLF,
      P.PM_WINTER_WOLF_CUB]],
]) {
    for (const member of family)
        assert.equal(were_beastie(member), beast,
                     'were_beastie maps every helper to its family');
}
assert.equal(were_beastie(P.PM_LICHEN), NON_PM,
             'were_beastie rejects an unrelated monster');

console.log('hero lycanthropy guards and were lookup tables: PASS');
