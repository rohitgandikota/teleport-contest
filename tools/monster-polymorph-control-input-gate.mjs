// Prove ordinary-monster and input preconditions without changing game state.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { normalizeSession } from '../frozen/session_loader.mjs';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';

const input = normalizeSession(JSON.parse(readFileSync(process.argv[2], 'utf8')));
assert.equal(input.segments.length, 6);
for (const [index, segment] of input.segments.entries()) {
    const states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    globalThis.__step_snapshot = { step: '*', cb(g, step) {
        const m = (g.level.monsters || []).find(mon => mon.m_id === 44);
        const wand = (g.invent || []).find(o => o.otyp === ONAMES.WAN_POLYMORPH);
        states[step] = { wizard: g.wizard, control: g.flags.monpolycontrol,
            coords: g.iflags.getpos_coords, prompt: g._toplines, moves: g.moves,
            wand: wand && { letter: wand.invlet, charges: wand.spe },
            target: m && { type: m.mnum, base: m.cham, asleep: m.msleeping,
                x: m.mx, y: m.my, hp: m.mhp } };
    } };
    let run;
    try { run = await runSegment({ ...segment, storage: new InMemoryStorage() }); }
    finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const state = states[63];
    assert.ok(state.wizard && state.control);
    assert.deepEqual(state.target, { type: PMNAMES.PM_NEWT, base: -1, asleep: 1,
        x: 32, y: 15, hp: 2 });
    assert.equal(state.coords, index === 3 ? 's' : 'n');
    assert.match(state.prompt, /^Change the newt @ .* into what\? /);
    assert.equal(state.wand.letter, 'a');
    assert.equal(state.wand.charges, states[60].wand.charges - 1);
    assert.equal(run.getScreens().length, [73,70,75,75,69,82][index]);
    // Expected forms are independently visible in the pinned C messages.
    const expected = [PMNAMES.PM_NEWT, PMNAMES.PM_BLACK_DRAGON, PMNAMES.PM_BLACK_DRAGON,
        PMNAMES.PM_KITTEN, PMNAMES.PM_MASTER_LICH, PMNAMES.PM_KITTEN];
    assert.equal(states.at(-1).target?.type, expected[index]);
    assert.ok(!states.at(-1).prompt.startsWith('Change '));
    if (index === 5)
        assert.match(states[70].prompt, /into what kind of monster\? /);
    console.log(JSON.stringify({ segment: index, name: segment.name, reached: true,
        boundaries: run.getScreens().length, calls: run.getRngLog().length,
        finalType: states.at(-1).target?.type,
        pendingPrompt: states.at(-1).prompt.startsWith('Change ') }));
}
