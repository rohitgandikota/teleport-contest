// Tower1.lua creates Vlad, three class-V monsters and three waiting brides,
// then seven chests. Observe real input; do not inject game state or helpers.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { normalizeSession } from '../frozen/session_loader.mjs';
import { PMNAMES as P } from '../js/monst_data.js';
import { ONAMES as O } from '../js/objects_data.js';
import { STRAT_WAITFORU } from '../js/const.js';

const input = normalizeSession(JSON.parse(readFileSync(process.argv[2], 'utf8')));
assert.equal(input.segments.length, 1);
const segment = input.segments[0], states = [];
const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
globalThis.__step_snapshot = { step: '*', cb(g, step) {
    states[step] = { step, prompt: g._toplines, in_mklev: g.in_mklev,
        level: { ...g.u.uz }, tower: g.tower_dnum, control: g.flags.monpolycontrol,
        monsters: g.level.monsters.filter(m => m.mhp > 0).map(m => ({
            type: m.mnum, base: m.cham, name: m.mgivenname || m.mextra?.mgivenname,
            strategy: m.mstrategy, inventory: (m.minvent || []).map(o => o.otyp) })),
        chests: g.level.objects.filter(o => o.otyp === O.CHEST).length };
} };
let run;
try { run = await runSegment({ ...segment, storage: new InMemoryStorage() }); }
finally {
    if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
    else delete globalThis.__step_snapshot;
}
assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
const prompts = states.filter(s => s?.prompt?.startsWith('Change ')
    && /into what(?: kind of monster)?\? $/.test(s.prompt));
assert.equal(prompts.length, 6);
for (const [i, state] of prompts.entries()) {
    assert.equal(state.in_mklev, true);
    assert.equal(state.control, true);
    assert.equal(state.level.dnum, state.tower);
    assert.equal(state.level.dlevel, 1);
    assert.equal(state.monsters.length, i + 2, 'Vlad, completed predecessors and pending creation');
    assert.equal(state.chests, 0, 'treasure follows all completed monster calls');
    const pending = state.monsters[0];
    assert.equal(pending.type, pending.base);
    assert.deepEqual(pending.inventory, [], 'initial selection precedes equipment');
    assert.equal(state.monsters.filter(m => m.type === P.PM_VAMPIRE_BAT).length, Math.min(i, 3));
    assert.equal(state.monsters.filter(m => m.name).length, Math.max(0, i - 3));
    assert.ok(state.monsters.some(m => m.type === P.PM_VLAD_THE_IMPALER
        && m.inventory.includes(O.CANDELABRUM_OF_INVOCATION)));
}
const final = states.at(-1);
assert.equal(final.in_mklev, false);
assert.equal(final.chests, 7);
const brides = final.monsters.filter(m => ['Madame', 'Marquise', 'Countess'].includes(m.name));
assert.equal(brides.length, 3);
for (const bride of brides) {
    assert.equal(bride.type, bride.base, 'waiting brides revert by explicit form');
    assert.ok(bride.strategy & STRAT_WAITFORU);
}
assert.equal(final.monsters.filter(m => m.type === P.PM_VAMPIRE_BAT).length, 3);
assert.equal(run.getScreens().length, 83);
console.log(JSON.stringify({ name: segment.name, passed: true, prompts: prompts.length,
    boundaries: run.getScreens().length, calls: run.getRngLog().length }));
