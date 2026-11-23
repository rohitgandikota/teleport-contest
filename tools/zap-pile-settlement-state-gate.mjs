// Run: node --test tools/zap-pile-settlement-state-gate.mjs
// Real-input state controls for src/zap.c:2503, bhitpile's final fill_pit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { resetInputState } from '../js/input.js';
import { ONAMES } from '../js/objects_data.js';
import { PIT, HOLE } from '../js/const.js';

const native = JSON.parse(readFileSync(new URL(
    './gen-sessions/generated/zap-pile-settlement.session.json', import.meta.url)));
const normalize = call => call.replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim();
const cases = [
    { name: 'boulder fills pit', type: ONAMES.BOULDER, trap: PIT, settles: true },
    { name: 'boulder plugs hole', type: ONAMES.BOULDER, trap: HOLE, settles: true },
    { name: 'rock leaves pit open', type: ONAMES.ROCK, trap: PIT, settles: false },
    { name: 'boulder stays on ordinary floor', type: ONAMES.BOULDER, trap: null, settles: false },
];

function floorObjects(x, y, type) {
    return game.level.objectsAt(x, y).filter(obj => obj.otyp === type);
}

function trapAt(x, y) {
    return game.level.traps.find(trap => trap.tx === x && trap.ty === y)?.ttyp ?? null;
}

for (const [index, control] of cases.entries()) {
    test(control.name, async () => {
        const segment = native.segments[index];
        const boundary = segment.moves.indexOf('za>');
        assert.ok(boundary > 0);
        resetInputState();
        await runSegment({ ...segment, moves: segment.moves.slice(0, boundary),
            storage: new InMemoryStorage() });
        const { ux: x, uy: y } = game.u;
        assert.equal(floorObjects(x, y, control.type).length, 1,
            'wished object is on the floor before the zap');
        assert.equal(trapAt(x, y), control.trap, 'trap state before the zap');

        resetInputState();
        const result = await runSegment({ ...segment, storage: new InMemoryStorage() });
        assert.equal(floorObjects(x, y, control.type).length, control.settles ? 0 : 1,
            'boulder is consumed only over a pit or hole');
        assert.equal(trapAt(x, y), control.settles ? null : control.trap);

        const slices = result.getRngSlices();
        assert.equal(slices.length, segment.steps.length);
        for (const [step, recorded] of segment.steps.entries())
            assert.deepEqual(slices[step].map(normalize), recorded.rng.map(normalize),
                `input ${step}`);
        assert.deepEqual(result.getRngLog().map(normalize),
            segment.steps.flatMap(step => step.rng.map(normalize)));
        assert.deepEqual(result.getCursors(), segment.steps.map(step => step.cursor));
    });
}
