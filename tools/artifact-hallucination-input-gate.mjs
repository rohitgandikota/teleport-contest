#!/usr/bin/env node
// Read-only reach checks for the five native HALRES input cases.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { Hallucination } from '../js/youprop.js';
import { ART_GRAYSWANDIR } from '../js/artilist_data.js';
import { ONAMES } from '../js/objects_data.js';
import { W_WEP, W_ARM } from '../js/const.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/artifact-hallucination-resistance.json', import.meta.url)));
const storage = new InMemoryStorage();
let saved;
for (const [index, part] of recipe.segments.entries()) {
    const states = [], messages = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = { step: '*', cb(g, step) {
            states.push({ step, timer: g.u.intrinsic?.HHallucination || 0,
                timerAlias: g.u.uprops?.HALLUC || 0, mask: g.u.uprops?.HALLUC_RES || 0,
                hallucinating: Hallucination(), weapon: g.u.uwep?.otyp || 0,
                artifact: g.u.uwep?.oartifact || 0, armor: g.u.uarm?.otyp || 0,
                carried: (g.invent || []).some(o => o.oartifact === ART_GRAYSWANDIR),
                floor: (g.level?.objects || []).some(o => o.oartifact === ART_GRAYSWANDIR) });
            const text = g.nhDisplay.grid[0].map(c => c.ch).join('').trimEnd();
            if (text !== messages.at(-1)) messages.push(text);
        } };
        run = await runSegment({ ...part, storage });
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.ok(states.length, part.name + ': actual input boundaries observed');
    // nh_timeout decrements the intrinsic counter; HALLUC is its display
    // predicate mirror and is cleared when the timeout expires.
    for (const state of states) assert.equal(!!state.timer, !!state.timerAlias);
    const final = states.at(-1), text = messages.join('\n');
    const wielded = s => s.timer > 0 && s.artifact === ART_GRAYSWANDIR
        && !!(s.mask & W_WEP) && !s.hallucinating;
    assert.ok(states.some(wielded), part.name + ': active timer suppressed while wielding');
    assert.ok(final.timer > 0, part.name + ': timer survives the transition');

    if (index < 4) {
        assert.ok(part.moves.includes('#wizintrinsic'));
        assert.ok(states.some(s => s.timer > 0 && s.hallucinating && s.mask === 0),
            part.name + ': actual intrinsic command starts hallucination');
        assert.match(text, /Everything looks SO boring/);
    }
    if (index === 0) {
        const first = states.findIndex(wielded);
        assert.ok(states.slice(first + 1).some(s => !s.weapon && s.hallucinating && !s.mask));
        assert.equal(final.carried, true); assert.equal(final.floor, false);
        assert.equal(final.mask, 0); assert.equal(final.hallucinating, true);
        assert.match(text, /bare handed/); assert.match(text, /Everything looks so cosmic/);
    } else if (index === 1) {
        const first = states.findIndex(wielded);
        const replacement = states.findIndex((s, i) => i > first
            && s.weapon === ONAMES.DAGGER && s.hallucinating && s.mask === 0);
        assert.ok(replacement > first, 'dagger replaces active Grayswandir');
        const rewield = states.findIndex((s, i) => i > replacement && wielded(s));
        assert.ok(rewield > replacement, 'Grayswandir is wielded again before dropping');
        assert.equal(final.floor, true); assert.equal(final.carried, false);
        assert.equal(final.mask, 0); assert.equal(final.hallucinating, true);
        assert.match(text, /You drop a silver saber named Grayswandir/);
    } else if (index === 2) {
        assert.ok(states.some(s => s.mask === (W_WEP | W_ARM)
            && s.armor === ONAMES.GOLD_DRAGON_SCALE_MAIL));
        assert.equal(final.mask, W_ARM); assert.equal(final.hallucinating, false);
        assert.equal(final.weapon, 0); assert.equal(final.carried, true);
        // C's mask-change announcement still occurs with another resistance.
        assert.match(text, /bare handed.*Everything looks so cosmic/);
    } else if (index === 3) {
        assert.equal(final.mask, W_WEP); assert.equal(final.hallucinating, false);
        assert.match(text, /Be seeing you\.\.\./);
        saved = final;
    } else {
        assert.ok(saved, 'restore follows the preceding saved game');
        assert.equal(states[0].timer, saved.timer);
        assert.equal(states[0].mask, W_WEP);
        assert.equal(states[0].artifact, ART_GRAYSWANDIR);
        assert.match(text, /welcome back/);
        assert.equal(final.mask, 0); assert.equal(final.hallucinating, true);
        assert.equal(final.weapon, 0); assert.equal(final.carried, true);
        assert.match(text, /Everything looks so cosmic/);
    }
    console.log(JSON.stringify({ name: part.name, boundaries: run.getScreens().length,
        rngCalls: run.getRngLog().length, final }));
}
