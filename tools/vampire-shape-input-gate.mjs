// node tools/vampire-shape-input-gate.mjs <four-case-session.json>
// Read-only observations of real inputs. Keep the ordinary fog control.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { normalizeSession } from '../frozen/session_loader.mjs';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import { Is_rogue_level, STRAT_WAITFORU } from '../js/const.js';
import { canseemon } from '../js/display.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';

const input = normalizeSession(JSON.parse(readFileSync(process.argv[2], 'utf8')));
assert.equal(input.segments.length, 4);
const bases = [PMNAMES.PM_VAMPIRE, PMNAMES.PM_VAMPIRE_LEADER,
    PMNAMES.PM_VAMPIRE, PMNAMES.PM_VLAD_THE_IMPALER];
const expected = [PMNAMES.PM_VAMPIRE_BAT, PMNAMES.PM_VAMPIRE_BAT,
    PMNAMES.PM_FOG_CLOUD, PMNAMES.PM_VLAD_THE_IMPALER];
for (const [index, segment] of input.segments.entries()) {
    const states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    globalThis.__step_snapshot = { step: '*', cb(g, step) {
        states[step] = { step, rogue: !!Is_rogue_level(g.u.uz), moves: g.moves,
            monsters: (g.level.monsters || []).filter(m => m.cham === bases[index]).map(m => ({
                id: m.m_id, base: m.cham, type: m.mnum, asleep: m.msleeping,
                hp: m.mhp, maxhp: m.mhpmax, strategy: m.mstrategy,
                invisible: m.minvis, visible: canseemon(m),
                inventory: (m.minvent || []).map(o => o.otyp) })) };
    } };
    let run;
    try { run = await runSegment({ ...segment, storage: new InMemoryStorage() }); }
    finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const calls = run.getRngLog().map(s => s.replace(/\s*@.*$/, ''));
    const screens = run.getScreens().map(s => decodeScreen(s)
        .map(row => row.map(c => c.ch).join('')).join('\n'));
    const result = { segment: index, boundaries: screens.length, calls: calls.length, pass: false };
    try {
        assert.equal(screens.length, [43,46,21,62][index]);
        assert.equal(screens.length, segment.moves.length + 1);
        const firstStep = [41,44,19,48][index];
        assert.ok(states.slice(0, firstStep).every(s => s.monsters.length === 0));
        const first = states[firstStep], final = states.at(-1);
        assert.equal(final.rogue, index < 2);
        assert.equal(first.monsters.length, index === 0 ? 2 : 1);
        assert.deepEqual(final.monsters.map(m => m.id), first.monsters.map(m => m.id));
        assert.ok(first.monsters.every(m => m.asleep && m.type === expected[index]));
        assert.ok(final.monsters.every(m => m.type === expected[index]));
        if (index === 0) {
            assert.equal(calls[3028], 'rn2(4)=0', 'second vampire takes the fog-selection roll');
            assert.ok(screens[41].startsWith('A vampire bat appears next to you.'));
            assert.ok(!screens[41].includes('fog cloud appears'));
        } else if (index === 1) {
            assert.deepEqual(calls.slice(3000,3002), ['rn2(10)=0', 'rn2(4)=1']);
            assert.ok(screens[44].startsWith('A vampire bat appears next to you.'));
        } else if (index === 2) {
            assert.equal(calls[2636], 'rn2(4)=0');
            assert.ok(screens[19].startsWith('A fog cloud appears next to you.'));
        } else {
            const beforeShift = states[54].monsters[0];
            assert.equal(beforeShift.hp, beforeShift.maxhp);
            assert.ok(beforeShift.invisible); assert.equal(beforeShift.visible, false);
            assert.equal(beforeShift.strategy & STRAT_WAITFORU, 0);
            assert.ok(beforeShift.inventory.includes(ONAMES.CANDELABRUM_OF_INVOCATION));
            // C native call3011 enters the natural shift at step55. The next
            // call is movement, because the special-item guard keeps Vlad.
            assert.deepEqual(calls.slice(3011,3013), ['rn2(6)=0', 'rn2(12)=9']);
            assert.equal(final.moves, 13);
            assert.ok(states.slice(firstStep).every(s => s.monsters[0].type === expected[index]
                && s.monsters[0].inventory.includes(ONAMES.CANDELABRUM_OF_INVOCATION)));
        }
        result.pass = true;
    } catch (error) {
        result.error = error.message;
        process.exitCode = 1;
    }
    console.log(JSON.stringify(result));
}
