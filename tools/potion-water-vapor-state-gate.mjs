#!/usr/bin/env node

// State checks for water vapor on gremlin and lycanthrope hero forms. The C
// recording pins every visible frame and random call while these assertions
// pin clone ownership, split hit points, infection, form state, and disposal.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/potion-water-vapor.json', import.meta.url),
'utf8'));

function waterState() {
    const all = [...(game.invent || []), ...(game.level.objects || [])];
    return {
        carried: (game.invent || [])
            .filter(obj => obj.otyp === ONAMES.POT_WATER).length,
        blessedOrCursed: all.filter(obj => obj.otyp === ONAMES.POT_WATER
            && (obj.blessed || obj.cursed)).length,
    };
}

const states = [];
for (const segment of recipe.segments) {
    await runSegment({ ...segment, onFrame: () => {} });
    states.push({
        ulycn: game.u.ulycn,
        umonster: game.u.umonster,
        umonnum: game.u.umonnum,
        mtimedone: game.u.mtimedone | 0,
        mh: game.u.mh | 0,
        mhmax: game.u.mhmax | 0,
        water: waterState(),
        clone: (game.level.monsters || []).find(mon =>
            mon.mnum === PMNAMES.PM_GREMLIN && mon.mcloned),
        unported: [...(game.unported || [])],
    });
}

const gremlin = states[0];
assert.equal(gremlin.umonnum, PMNAMES.PM_GREMLIN,
             'ordinary water vapor leaves the hero in gremlin form');
assert.deepEqual([gremlin.mh, gremlin.mhmax], [13, 13],
                 'the original gremlin keeps half of current and maximum HP');
assert.ok(gremlin.clone, 'water vapor creates a gremlin clone');
assert.deepEqual([gremlin.clone.mhp, gremlin.clone.mhpmax], [13, 13],
                 'the clone receives the other half of current and maximum HP');
assert.equal(gremlin.clone.mgivenname, 'wizard',
             'the clone receives the hero name');
assert.ok(gremlin.clone.mtame > 0 && gremlin.clone.mpeaceful,
          'the clone is initialized as the hero\'s tame companion');
assert.equal(gremlin.water.carried, 0,
             'the gremlin test bottle is consumed');

const cursed = states[1];
assert.equal(cursed.ulycn, PMNAMES.PM_WEREWOLF,
             'cursed vapor leaves the werewolf infection active');
assert.equal(cursed.umonnum, PMNAMES.PM_WEREWOLF,
             'cursed vapor changes the unpolymorphed hero into a werewolf');
assert.deepEqual([cursed.mh, cursed.mhmax], [17, 17],
                 'the werewolf body receives its C-recorded hit points');
assert.ok(cursed.mtimedone > 0,
          'the cursed-vapor beast body has a polymorph timer');
assert.equal(cursed.water.blessedOrCursed, 0,
             'the cursed water bottle is consumed');

const blessed = states[2];
assert.equal(blessed.ulycn, PMNAMES.PM_WEREWOLF,
             'blessed vapor does not cure lycanthropy');
assert.equal(blessed.umonnum, blessed.umonster,
             'blessed vapor restores the infected hero to base form');
assert.deepEqual([blessed.mtimedone, blessed.mh, blessed.mhmax], [0, 0, 0],
                 'returning to base form clears the monster timer and HP');
assert.equal(blessed.water.blessedOrCursed, 0,
             'kicking the holy-water bottle removes it from the floor');

for (const [index, state] of states.entries()) {
    assert.ok(!state.unported.some(path =>
        path === 'potionbreathe:water-transformation'
        || path === 'really_kick_object:breakage'
        || path.includes('vertical_throw')
        || path.includes('breakobj')),
    `segment ${index} leaves no water-vapor or potion-breakage marker`);
}

console.log('water potion vapor state: PASS');
