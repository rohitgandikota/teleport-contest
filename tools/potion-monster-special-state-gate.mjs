#!/usr/bin/env node

// State checks for healing reversals, cursed invisibility, and special water
// reactions in src/potion.c:potionhit(). The C recording pins visible output
// and RNG order; these checks pin the monster fields which are not displayed.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';
import { glyph_is_invisible_at } from '../js/display.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/potion-monster-special.json', import.meta.url),
'utf8'));

function livingMonsters(mnum) {
    return [...(game.level.monsters || [])]
        .filter(mon => (mon.mhp | 0) > 0
                    && (mnum === undefined || mon.mnum === mnum))
        .sort((a, b) => (a.m_id | 0) - (b.m_id | 0));
}

function newestLivingMonster() {
    return livingMonsters().at(-1);
}

const states = [];
for (const segment of recipe.segments) {
    await runSegment({ ...segment, onFrame: () => {} });
    const target = newestLivingMonster();
    assert.ok(target, 'the created potion target survives the segment');
    states.push({
        mnum: target.mnum,
        hp: target.mhp | 0,
        maxHp: target.mhpmax | 0,
        peaceful: !!target.mpeaceful,
        invisible: !!target.minvis,
        permanentlyInvisible: !!target.perminvis,
        invisibleMarker: glyph_is_invisible_at(target.mx, target.my),
        unported: [...(game.unported || [])],
    });
}

const { unported: healingMarkers, ...healingState } = states[0];
assert.deepEqual(healingState, {
    mnum: PMNAMES.PM_HILL_GIANT,
    hp: 56,
    maxHp: 56,
    peaceful: true,
    invisible: false,
    permanentlyInvisible: false,
    invisibleMarker: false,
}, 'full healing restores the chipped target and suppresses anger');

assert.equal(states[1].mnum, PMNAMES.PM_PESTILENCE,
             'the healing reversal keeps the Pestilence target');
assert.equal(states[1].hp, 21,
             'full healing halves Pestilence hit points after impact');
assert.equal(states[1].maxHp, 42,
             'the healing reversal does not lower maximum hit points');
assert.equal(states[1].peaceful, false,
             'harmful healing angers Pestilence');

assert.equal(states[2].mnum, PMNAMES.PM_PESTILENCE,
             'the sickness reversal keeps the Pestilence target');
assert.equal(states[2].hp, 42,
             'sickness restores Pestilence to maximum hit points');
assert.equal(states[2].peaceful, true,
             'beneficial sickness does not anger Pestilence');

assert.equal(states[3].mnum, PMNAMES.PM_IRON_GOLEM,
             'the poison-resistant target remains an iron golem');
assert.equal(states[3].hp, 119,
             'resisted sickness leaves only the one-point impact chip');
assert.equal(states[3].peaceful, false,
             'resisted sickness still angers the target');

assert.equal(states[4].mnum, PMNAMES.PM_HILL_GIANT,
             'cursed invisibility keeps the visible target form');
assert.equal(states[4].invisible, false,
             'cursed invisibility does not hide a visible target');
assert.equal(states[4].permanentlyInvisible, false,
             'the visible target gains no permanent invisibility');
assert.equal(states[4].peaceful, true,
             'the harmless transparent flash suppresses anger');

assert.equal(states[5].mnum, PMNAMES.PM_HILL_GIANT,
             'cursed invisibility keeps the invisible target form');
assert.equal(states[5].invisible, false,
             'cursed invisibility reveals an invisible target');
assert.equal(states[5].permanentlyInvisible, false,
             'revealing the target clears permanent invisibility');
assert.equal(states[5].invisibleMarker, false,
             'revealing the target clears the temporary invisible marker');
assert.equal(states[5].peaceful, false,
             'revealing an invisible target angers it');

await runSegment({ ...recipe.segments[6], onFrame: () => {} });
const gremlins = livingMonsters(PMNAMES.PM_GREMLIN);
assert.equal(gremlins.length, 2,
             'ordinary water splits one gremlin into two');
const [parent, clone] = gremlins;
assert.equal(parent.mcloned | 0, 0,
             'the original gremlin is not marked as a clone');
assert.equal(parent.mhp | 0, 15,
             'the original keeps the odd current hit point');
assert.equal(parent.mhpmax | 0, 15,
             'the original keeps half the maximum hit points');
assert.equal(parent.mpeaceful, 1,
             'the beneficial split leaves the original peaceful');
assert.equal(clone.mcloned | 0, 1,
             'the new gremlin is marked as a clone');
assert.equal(clone.mhp | 0, 14,
             'the clone receives the lower half of current hit points');
assert.equal(clone.mhpmax | 0, 15,
             'the clone receives half the maximum hit points');
assert.equal(clone.mpeaceful, 0,
             'the C-recorded peacefulness roll makes this clone hostile');

assert.equal(states[7].mnum, PMNAMES.PM_IRON_GOLEM,
             'the rust target remains an iron golem');
assert.equal(states[7].hp, 113,
             'water applies the C-recorded six rust damage after impact');
assert.equal(states[7].maxHp, 120,
             'rust does not lower maximum hit points');
assert.equal(states[7].peaceful, false,
             'rust angers the target');

await runSegment({
    ...recipe.segments[8],
    moves: recipe.segments[8].moves.slice(0, -1),
    onFrame: () => {},
});
const transformedWere = newestLivingMonster();
assert.equal(transformedWere.mnum, PMNAMES.PM_WEREWOLF,
             'cursed water transforms a human werewolf into wolf form');
assert.equal(transformedWere.mhp | 0, transformedWere.mhpmax | 0,
             'cursed water heals the were creature to maximum hit points');
assert.equal(transformedWere.mpeaceful, 1,
             'beneficial cursed water leaves the were creature peaceful');

assert.equal(states[8].mnum, PMNAMES.PM_HUMAN_WEREWOLF,
             'the recorded next-turn roll returns the wolf to human form');
assert.equal(states[8].hp, 31,
             'the healed were creature stays at maximum hit points');
assert.equal(states[8].maxHp, 31,
             'shape changes preserve the were creature maximum hit points');
assert.equal(states[8].peaceful, true,
             'the final were creature remains peaceful');

for (const [index, state] of states.entries()) {
    assert.ok(!state.unported.some(path => path.includes('potionhit')),
              `segment ${index} leaves no potionhit implementation marker`);
}

console.log('thrown monster potion special effects state: PASS');
