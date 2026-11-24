// Actual input and native branch witnesses. The independent strict gate checks every call.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {game} from '../js/gstate.js';
import {m_at} from '../js/mon.js';
import {is_covetous} from '../js/mondata.js';
import {PMNAMES} from '../js/monst_data.js';
import {observeDuration} from './deaf-duration-observer.mjs';

const file = process.argv[2] || new URL(
    'gen-sessions/generated/covetous-goal-attack.session.json', import.meta.url);
const input = JSON.parse(fs.readFileSync(file));
assert.equal(input.segments.length, 1);
const part = input.segments[0];
const previous = Object.getOwnPropertyDescriptor(globalThis, '__rng_probe_at');
let probe, observed;
try {
    globalThis.__rng_probe_at = {at:18486, cb() {
        const wizard = game.level.monsters.find(m => m.mnum === PMNAMES.PM_WIZARD_OF_YENDOR
            && m.minvis && m.mhp > 0);
        const target = wizard?.mgoal && m_at(wizard.mgoal.x, wizard.mgoal.y);
        probe = wizard && {type:wizard.mnum, covetous:is_covetous(wizard.data),
            at:[wizard.mx, wizard.my], goal:[wizard.mgoal.x, wizard.mgoal.y],
            differentTarget:target !== wizard, targetType:target?.mnum,
            distanceSquared:(wizard.mx - wizard.mgoal.x) ** 2 + (wizard.my - wizard.mgoal.y) ** 2};
    }};
    observed = await observeDuration(part);
} finally {
    if (previous) Object.defineProperty(globalThis, '__rng_probe_at', previous);
    else delete globalThis.__rng_probe_at;
}
const {run, evidence} = observed;
assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__rng_probe_at'), previous);
const clean = call => call.replace(/\s*@.*$/, '').replace(/^\d+\s+/, '').trim();
const c = part.steps.flatMap(s => s.rng).map(clean), js = run.getRngLog().map(clean);
console.log(JSON.stringify({probe, boundaries:evidence.boundaries, calls:evidence.calls,
    animations:evidence.animations, final:evidence.states.at(-1), hooksRestored:true}));

test('the real invisible covetous Wizard targets an adjacent diagonal energy vortex', () => {
    assert.deepEqual(probe, {type:PMNAMES.PM_WIZARD_OF_YENDOR, covetous:true,
        at:[73, 8], goal:[74, 7], differentTarget:true,
        targetType:PMNAMES.PM_ENERGY_VORTEX, distanceSquared:2});
});
test('movement enters the native monster attack and passive retaliation sequence', () => {
    assert.deepEqual(js.slice(0, 18487), c.slice(0, 18487));
    assert.deepEqual(c.slice(18487, 18494), ['rnd(20)=19', 'd(2,12)=11', 'rn2(3)=1',
        'rn2(6)=4', 'd(7,4)=16', 'rn2(3)=2', 'rn2(5)=2']);
    assert.deepEqual(js.slice(18487, 18494), c.slice(18487, 18494));
});
test('the repaired replay retains C survival, no thunder, and no animation', () => {
    assert.equal(evidence.boundaries, part.steps.length);
    assert.equal(evidence.calls, c.length);
    assert.equal(evidence.animations, 0);
    assert.equal(evidence.states.at(-1).mortality, 0);
    assert.doesNotMatch(evidence.messages.map(m => m.text).join('\n'), /Kaboom|You die|so you don't die/);
    assert.equal(evidence.hooksRestored, true);
});
