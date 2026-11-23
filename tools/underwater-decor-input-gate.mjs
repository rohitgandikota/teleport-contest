// Actual-input reach and tuple integrity. Native parity is scored separately.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { Underwater, Swimming, Blind } from '../js/youprop.js';
import { POOL, DOOR, FROMFORM, PLNMSG_BACK_ON_GROUND } from '../js/const.js';
import { PMNAMES } from '../js/monst_data.js';
const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/underwater-decor.json', import.meta.url)));
const native = JSON.parse(readFileSync(new URL('gen-sessions/generated/underwater-decor.session.json', import.meta.url)));

test('actual water-elemental Swimming, doorway exit and underwater decor return', async () => {
    assert.equal(native.source, 'c');
    assert.equal(recipe.segments.length, 1); assert.equal(native.segments.length, 1);
    const part = recipe.segments[0], recorded = native.segments[0], states = [];
    for (const field of ['seed', 'datetime', 'nethackrc', 'moves'])
        assert.equal(part[field], recorded[field], `${field} remains the native input`);
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = { step: '*', cb(g, step) {
            states.push({ step, x: g.u.ux, y: g.u.uy, turn: g.moves,
                underwater: Underwater(), raw: g.u.uprops?.UNDERWATER ?? 0,
                swimming: Swimming(), hswimming: g.u.intrinsic?.HSwimming ?? 0,
                eswimming: g.u.uprops?.SWIMMING ?? 0, blind: Blind(), mnum: g.u.umonnum,
                typ: g.level.at(g.u.ux, g.u.uy).typ, lastMsg: g.iflags.last_msg,
                prev: g.iflags.prev_decor, hp: g.u.uhp, mh: g.u.mh,
                mortality: g.u.umortality ?? 0, mention: g.flags.mention_decor,
                text: g.nhDisplay.grid[0].map(cell => cell.ch).join('').trimEnd() });
        }};
        run = await runSegment({ ...part, storage: new InMemoryStorage() });
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    assert.equal(run.getScreens().length, part.moves.length + 1);
    assert.equal(run.getScreens().length, recorded.steps.length);
    assert.ok(states.every(s => s.hp > 0 && s.mortality === 0));
    const submerged = states.find(s => s.underwater && s.typ === POOL && s.swimming);
    assert.ok(submerged);
    assert.equal(submerged.mnum, PMNAMES.PM_WATER_ELEMENTAL);
    assert.equal(submerged.hswimming & FROMFORM, FROMFORM);
    assert.equal(submerged.eswimming, 0); assert.equal(submerged.raw, 0);
    assert.equal(submerged.blind, true);
    const leaving = states.find(s => s.step > submerged.step && s.text.includes('You are back in a doorway.'));
    assert.ok(leaving); assert.equal(leaving.typ, DOOR); assert.equal(leaving.underwater, false);
    // The marker is visible at this boundary. The next monster pline clears it
    // (pline.c:281); requiring it after the next input would test the wrong phase.
    assert.equal(leaving.lastMsg, PLNMSG_BACK_ON_GROUND);
    const returning = states.find(s => s.step > leaving.step && s.underwater && s.typ === POOL
        && s.text.includes('You touch bottom.'));
    assert.ok(returning); assert.equal(returning.raw, 0); assert.equal(returning.swimming, true);
    const described = states.find(s => s.step > returning.step && s.underwater && s.prev === POOL);
    assert.ok(described); assert.equal(described.mention, true); assert.equal(described.raw, 0);
    assert.equal(described.typ, POOL); assert.ok(described.mh > 0);
    assert.ok(!states.some(s => s.underwater && s.text.includes('There is a pool of water here.')));
    console.log(JSON.stringify({ boundaries: run.getScreens().length, calls: run.getRngLog().length,
        underwaterStep: submerged.step, exitStep: leaving.step, returnStep: returning.step,
        decorStep: described.step, nativeParityCheckedHere: false }));
});
