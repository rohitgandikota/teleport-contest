// node tools/dbridge-predicate-input-gate.mjs <three-segment-input-or-native.json>
// Read-only state checks for the native Castle recordings. Replay parity is separate.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { normalizeSession } from '../frozen/session_loader.mjs';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import { DRAWBRIDGE_UP, DB_EAST, DB_ICE, DB_MOAT, DB_LAVA, DB_FLOOR } from '../js/const.js';
import { MELT_ICE_AWAY, TIMER_LEVEL } from '../js/timeout.js';
import { Cold_resistance, Levitation, Wwalking } from '../js/youprop.js';
import { ONAMES } from '../js/objects_data.js';

const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const input = normalizeSession({ ...raw, version: raw.version || 5 });
assert.equal(input.segments.length, 3);
const X = 14, Y = 11;

for (const [index, segment] of input.segments.entries()) {
    const states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    globalThis.__step_snapshot = { step: '*', cb(game, step) {
        const cell = game.level.at(X, Y);
        states.push({ step, moves: game.moves, position: [game.u.ux, game.u.uy],
            level: { ...game.u.uz }, hp: game.u.uhp,
            span: [cell.typ, cell.drawbridgemask],
            cold: !!Cold_resistance(), levitation: !!Levitation(), waterwalking: !!Wwalking(),
            bootsKnown: !!game.objects[ONAMES.WATER_WALKING_BOOTS].oc_name_known,
            timers: (game.timer_base || []).filter(t => t.arg === (X << 16 | Y))
                .map(t => ({ id: t.tid, kind: t.kind, action: t.func_index, timeout: t.timeout })) });
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
        assert.equal(result.boundaries, [225, 250, 243][index]);
        assert.equal(result.boundaries, segment.moves.length + 1);
        const text = run.getScreens().map(s => decodeScreen(s)
            .map(row => row.map(cell => cell.ch).join('')).join('\n'));
        const ice = states[111], final = states.at(-1);
        assert.deepEqual(ice.level, { dnum: 0, dlevel: 26 });
        assert.deepEqual(ice.position, [9, Y]);
        assert.deepEqual(states[110].span, [DRAWBRIDGE_UP, DB_EAST | DB_MOAT]);
        assert.deepEqual(ice.span, [DRAWBRIDGE_UP, DB_EAST | DB_ICE]);
        assert.equal(ice.timers.length, 1);
        assert.equal(ice.timers[0].kind, TIMER_LEVEL);
        assert.equal(ice.timers[0].action, MELT_ICE_AWAY);
        assert.ok(ice.timers[0].timeout > ice.moves);
        assert.ok(text[111].startsWith('The moat is bridged with ice!'));
        assert.ok(states.every(s => s.hp > 0), 'all actions finish without death or rescue');
        assert.deepEqual(final.position, [X, Y]);
        assert.equal(final.cold, true);
        assert.equal(final.waterwalking, true);

        if (index === 0) {
            // Unidentified boots do not suppress the erroneous liquid-avoidance branch.
            assert.equal(states[199].bootsKnown, false);
            assert.equal(states[199].levitation, false);
            assert.deepEqual(states[199].position, [X - 1, Y]);
            assert.deepEqual(states[200].position, [X, Y]);
            assert.deepEqual(states[220].span, ice.span);
            assert.deepEqual(states[220].timers, ice.timers);
            assert.deepEqual(states[221].span, [DRAWBRIDGE_UP, DB_EAST | DB_MOAT]);
            assert.deepEqual(final.timers, []);
            assert.ok(text[221].startsWith('As you dig, the hole fills with water!'));
        } else if (index === 1) {
            // Levitation lets both source variants reach exactly this lava target.
            assert.equal(states[244].levitation, true);
            assert.deepEqual(states[244].position, [X - 1, Y]);
            assert.deepEqual(states[244].span, [DRAWBRIDGE_UP, DB_EAST | DB_LAVA]);
            assert.deepEqual(states[244].timers, []);
            assert.deepEqual(states[245].span, [DRAWBRIDGE_UP, DB_EAST | DB_FLOOR]);
            assert.deepEqual(final.timers, []);
            assert.ok(text[245].startsWith('The lava cools and solidifies.'));
        } else {
            // C zap.c:5324 firms existing timed ice; it does not freeze water anew.
            assert.equal(states[237].levitation, true);
            assert.deepEqual(states[237].position, [X - 1, Y]);
            assert.deepEqual(states[237].span, ice.span);
            assert.deepEqual(states[237].timers, ice.timers);
            assert.deepEqual(final.span, ice.span);
            assert.equal(final.timers.length, 1);
            assert.ok(final.timers[0].timeout > ice.timers[0].timeout);
            assert.notEqual(final.timers[0].id, ice.timers[0].id);
            assert.ok(!text[238].includes('The water freezes.'));
            assert.ok(text.at(-1).startsWith('There is sturdy ice here.'));
        }
        result.pass = true;
    } catch (error) {
        result.error = error.message;
        process.exitCode = 1;
    }
    console.log(JSON.stringify(result));
}
