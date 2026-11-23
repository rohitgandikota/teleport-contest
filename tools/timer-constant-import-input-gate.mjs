// node tools/timer-constant-import-input-gate.mjs <three-segment-input-or-native.json>
// Observe actual input boundaries. Native parity uses the frozen runner/RNG gate.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { normalizeSession } from '../frozen/session_loader.mjs';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import { ICE, ROOM, PIT } from '../js/const.js';

const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const input = normalizeSession({ ...raw, version: raw.version || 5 });
assert.equal(input.segments.length, 3);

for (const [index, segment] of input.segments.entries()) {
    const states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    globalThis.__step_snapshot = { step: '*', cb(game, step) {
        const x = game.u.ux, y = game.u.uy;
        states.push({ step, moves: game.moves, position: [x, y],
            terrain: game.level.at(x, y).typ,
            trap: game.level.traps.find(t => t.tx === x && t.ty === y)?.ttyp ?? null,
            timers: (game.timer_base || []).map(t => ({ tid: t.tid, kind: t.kind,
                action: t.func_index, timeout: t.timeout,
                arg: typeof t.arg === 'number' ? t.arg : t.arg?.o_id })),
            debug: [!!game.iflags.debug_hunger, !!game.iflags.debug_mongen] });
    } };
    let run;
    try { run = await runSegment({ ...segment, storage: new InMemoryStorage() }); }
    finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    const result = { segment: index, boundaries: run.getScreens().length,
        calls: run.getRngLog().length, pass: false };
    try {
        assert.equal(result.boundaries, [113, 111, 106][index]);
        assert.equal(result.boundaries, segment.moves.length + 1, 'all input boundaries reached');
        const initial = states[99], final = states.at(-1);
        // Existing pinned-C melting-ice prefix, before any new suffix.
        assert.deepEqual(initial.position, [30, 7]);
        assert.equal(initial.moves, 4);
        assert.equal(initial.terrain, ICE); assert.equal(initial.trap, null);
        assert.deepEqual(initial.debug, [true, true]);
        assert.deepEqual(initial.timers,
            [{ tid: 1, kind: 1, action: 8, timeout: 337, arg: (30 << 16) | 7 }]);
        assert.deepEqual(final.position, initial.position);
        assert.equal(final.moves, initial.moves);
        assert.equal(final.terrain, ICE);
        assert.equal(final.trap, index === 1 ? PIT : null);
        assert.deepEqual(final.debug, [true, true]);
        if (index < 2) {
            const replaced = states[index === 0 ? 106 : 104];
            assert.equal(replaced.terrain, ROOM);
            assert.equal(replaced.trap, index === 1 ? PIT : null);
            assert.deepEqual(replaced.timers, [], 'non-ice transition cancels numeric timer');
            assert.deepEqual(final.timers, [], 'ordinary replacement ice has no timer');
        } else {
            assert.deepEqual(states[104].timers, initial.timers);
            assert.deepEqual(final.timers, initial.timers, 'unchanged ice must retain its timer');
        }
        const screens = run.getScreens().map(s => decodeScreen(s)
            .map(row => row.map(cell => cell.ch).join('')).join('\n'));
        assert.ok(screens[99].startsWith('Steady ice.'));
        assert.ok(screens.at(-1).startsWith(index === 2
            ? 'There is steady ice here.' : 'There is solid ice here.'));
        result.pass = true;
    } catch (error) {
        result.error = error.message;
        process.exitCode = 1;
    }
    console.log(JSON.stringify(result));
}
