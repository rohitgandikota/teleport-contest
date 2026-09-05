#!/usr/bin/env node

// C potion.c:1624 and :1497. Screens identify the impact and BUC transition;
// stored checks catch hidden saddle damage, knowledge and ownership errors.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeScreen, renderCell } from '../frozen/screen-decode.mjs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { ONAMES, OCLASSES } from '../js/objects_data.js';
import { OBJ_MINVENT, W_SADDLE } from '../js/const.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const lines = step => decodeScreen(step.screen).map(row => row.map(renderCell).join(''));
let count = 0, damageChecks = 0;
for (const name of ['mounted-potion-impact', 'saddle-water-state']) {
    const input = read(`gen-sessions/recipes/${name}.json`);
    const oracle = read(`gen-sessions/generated/${name}.session.json`);
    for (const [i, segment] of input.segments.entries()) {
        const steps = oracle.segments[i].steps;
        const ride = steps.findLastIndex(st => st.key === '#');
        const impacts = steps.flatMap((st, step) =>
            lines(st).some(row => /crashes on.*(?:saddle|head).*--More--/.test(row))
                ? [step] : []);
        const wanted = new Set([ride, ...impacts.flatMap(s => [s - 1, s])]);
        const trace = new Map();
        globalThis.__step_snapshot = { step: '*', cb: (state, step) => {
            if (!wanted.has(step)) return;
            const mon = state.u.usteed;
            assert.ok(mon, segment.name + ': mounted before the dismount command');
            const saddle = mon.minvent.find(o => o.otyp === ONAMES.SADDLE);
            assert.ok(saddle);
            assert.equal(saddle.where, OBJ_MINVENT);
            assert.equal(saddle.ocarry, mon);
            assert.equal(saddle.owornmask, W_SADDLE);
            assert.equal(saddle.leashmon, mon.m_id);
            assert.ok(mon.misc_worn_check & W_SADDLE);
            trace.set(step, { hp: mon.mhp, blessed: !!saddle.blessed,
                cursed: !!saddle.cursed, known: !!saddle.bknown });
        } };
        try {
            await runSegment({ ...segment, storage: new InMemoryStorage() });
        } finally {
            delete globalThis.__step_snapshot;
        }
        count++;
        for (const impact of impacts) {
            const text = lines(steps[impact]).join('\n');
            const draw = (steps[impact].rng || [])
                .map(r => /rn2\(5\)=(\d+) @ potionhit/.exec(r)).find(Boolean);
            assert.ok(draw, segment.name + ': C recorded the shard damage draw');
            // The next message causes the impact's More pause, so the shard
            // draw and damage already occurred in the impact frame itself.
            const before = trace.get(impact - 1), after = trace.get(impact);
            const damaged = !text.includes("pony's saddle") && Number(draw[1]) && before.hp > 1;
            assert.equal(after.hp, before.hp - Number(!!damaged), segment.name + ': shard damage');
            damageChecks++;
        }
        const state = trace.get(ride);
        assert.ok(state);
        if (name === 'saddle-water-state') {
            // Blind cases use C's selection draws plus H2Opotion_dip's knowledge
            // rule. A dismount then exposes an unknown curse as "seems to be".
            const expected = {
                uncurse: [false, false, true], unbless: [false, false, true],
                'already-blessed': [true, false, true], 'already-cursed': [false, true, true],
                'blind-holy-unknown': [true, false, false],
                'blind-unholy-head': [false, false, true],
                'blind-unholy-unknown': [false, true, false],
                'blind-holy-known': [true, false, true],
            }[segment.name];
            assert.deepEqual([state.blessed, state.cursed, state.known], expected, segment.name);
        } else {
            const text = steps.flatMap(lines).join('\n');
            assert.equal(state.blessed, text.includes('saddle glows with a light blue aura.'));
            assert.equal(state.cursed, text.includes('saddle glows with a black aura.'));
            assert.equal(state.known, true);
        }
        assert.equal(!!game.u.usteed, state.cursed, segment.name + ': dismount consequence');
        assert.equal((game.invent || []).filter(o => o.oclass === OCLASSES.POTION_CLASS).length, 0);
        assert.ok(!game.level.objects.some(o =>
            o.otyp === ONAMES.POT_WATER || o.otyp === ONAMES.POT_HEALING));
    }
}
console.log(`saddle impact state: PASS (${count} C scenarios, ${damageChecks} shard checks)`);
