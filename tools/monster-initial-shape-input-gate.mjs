// Read-only witnesses for initial makemon selection and Vlad's exception.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { normalizeSession } from '../frozen/session_loader.mjs';
import { PMNAMES as P } from '../js/monst_data.js';
import { ONAMES as O } from '../js/objects_data.js';

const input = normalizeSession(JSON.parse(readFileSync(process.argv[2], 'utf8')));
const expected = [P.PM_KITTEN, P.PM_CHAMELEON, P.PM_VAMPIRE_BAT, P.PM_WOLF, P.PM_VLAD_THE_IMPALER];
const bases = [P.PM_CHAMELEON, P.PM_CHAMELEON, P.PM_VAMPIRE, P.PM_VAMPIRE_LEADER, P.PM_VLAD_THE_IMPALER];
assert.equal(input.segments.length, 5);
for (const [index, segment] of input.segments.entries()) {
    const states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    globalThis.__step_snapshot = { step: '*', cb(g, step) {
        const target = g.level.monsters.find(m => m.cham === bases[index]);
        states[step] = { prompt: g._toplines, control: g.flags.monpolycontrol,
            target: target && { id: target.m_id, type: target.mnum, base: target.cham,
                asleep: target.msleeping, inventory: (target.minvent || []).map(o => o.otyp) } };
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
    const final = states.at(-1);
    assert.equal(final.target?.type, expected[index]);
    assert.equal(final.target?.base, bases[index]);
    assert.equal(final.target?.asleep, 1);
    assert.equal(prompts.length, index === 4 ? 0 : index === 2 ? 2 : 1);
    for (const prompt of prompts) {
        assert.equal(prompt.control, true);
        assert.equal(prompt.target.type, bases[index], 'base body remains until initial input completes');
        assert.deepEqual(prompt.target.inventory, [], 'initial newcham precedes inventory');
    }
    if (index === 4) assert.ok(final.target.inventory.includes(O.CANDELABRUM_OF_INVOCATION));
    assert.equal(run.getScreens().length, [42, 45, 41, 43, 43][index]);
    console.log(JSON.stringify({ segment: index, name: segment.name, passed: true,
        prompts: prompts.length, boundaries: run.getScreens().length, calls: run.getRngLog().length }));
}
