#!/usr/bin/env node

// State checks for src/uhitm.c hmon_hitmon_poison(). The paired C recording
// pins terminal output and RNG order for the same four cases.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';

const recipePath = new URL('gen-sessions/recipes/poisoned-weapons.json',
                           import.meta.url);
const recipe = JSON.parse(await readFile(recipePath, 'utf8'));

async function run(index) {
    await runSegment({ ...recipe.segments[index], onFrame: () => {} });
}

function liveMonster(mnum) {
    return (game.level.monsters || []).find(mon => mon.mnum === mnum
                                             && (mon.mhp || 0) > 0);
}

function poisonedDarts() {
    return (game.invent || []).filter(obj => obj.otyp === ONAMES.DART
                                               && obj.opoisoned);
}

function assertNoPoisonMarker() {
    assert.ok(![...(game.unported || [])].some(path =>
        path.includes('hmon_hitmon:poison')
        || path.includes('hmon_hitmon:needpoismsg')
        || path.includes('hmon_hitmon:poison_deadly')
        || path.includes('hmon_hitmon:unpoisonmsg')),
    'poisoned-weapon cases leave no former poison marker');
}

await run(0);
assert.equal(liveMonster(PMNAMES.PM_SOLDIER), undefined,
             'deadly poison kills the soldier');
assertNoPoisonMarker();

await run(1);
let target = liveMonster(PMNAMES.PM_GREEN_DRAGON);
assert.ok(target, 'the poison-resistant green dragon survives');
assert.equal(target.mhpmax - target.mhp, 2,
             'the green dragon takes only the C-recorded dart damage');
assert.equal(poisonedDarts()[0]?.quan, 9,
             'resisted poison leaves the remaining dart stack poisoned');
assertNoPoisonMarker();

await run(2);
target = liveMonster(PMNAMES.PM_SOLDIER);
assert.equal(target?.mhp, 42,
             'the Samurai poisoned dart leaves the soldier at recorded HP');
assert.equal(game.u.ualign.record, 9,
             'Samurai dishonor reduces alignment by one');
assert.equal(game.u.ualign.abuse, 1,
             'Samurai dishonor records one alignment abuse');
assertNoPoisonMarker();

await run(3);
target = liveMonster(PMNAMES.PM_SOLDIER);
assert.equal(target?.mhp, 48,
             'the lawful Knight poisoned dart leaves the soldier at recorded HP');
assert.equal(game.u.ualign.record, 9,
             'lawful poison use reduces alignment by one');
assert.equal(game.u.ualign.abuse, 1,
             'lawful poison use records one alignment abuse');
assertNoPoisonMarker();

console.log('hero poisoned weapons state: PASS');
