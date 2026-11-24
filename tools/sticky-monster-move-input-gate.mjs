// Read-only observations of the unchanged C input pair. Output equality and
// complete RNG streams/slices are checked by the frozen runner and rng-slice-gate.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {sticks} from '../js/mondata.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const name = 'sticky-hero-blocks-monster-escape';
const bytes = readFileSync(new URL(`./gen-sessions/generated/${name}.session.json`, import.meta.url));
const native = JSON.parse(bytes);
const recipe = JSON.parse(readFileSync(new URL(`./gen-sessions/recipes/${name}.json`, import.meta.url)));
const registry = JSON.parse(readFileSync(new URL('./gen-sessions/coverage-requirements.json', import.meta.url)));
const rawSha256 = createHash('sha256').update(bytes).digest('hex');
const expectedRawHash = 'ec2f0b3dec18295562b626aae404026f713b76d98de8266f46ff1dad706dcba0';
const monsterState = mon => mon && ({id:mon.m_id, type:mon.mnum, at:[mon.mx,mon.my],
    fleeing:!!mon.mflee, hp:mon.mhp});

// Metadata is checked separately from native output. This never rewrites either.
test('native bytes, all five input fields and registered recipe coverage remain intact', () => {
    assert.equal(rawSha256, expectedRawHash);
    assert.equal(native.version, 5);
    assert.equal(native.source, 'c');
    assert.equal(native.segments.length, 2);
    const fields = ['name','seed','datetime','nethackrc','moves'];
    const tuples = segments => segments.map(s => fields.map(key => s[key]));
    assert.deepEqual(tuples(recipe.segments), tuples(native.segments));
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    const valid = new Set(registry.requirements.map(entry => entry.id));
    assert.ok(recipe.coverage.every(id => valid.has(id)), 'registered coverage only');
});

for (const [index, part] of native.segments.entries()) test(part.name, async () => {
    const states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            states[step] = {
                form:g.u.umonnum, sticky:sticks(g.youmonst.data), swallowed:!!g.u.uswallow,
                held:monsterState(g.u.ustuck),
                golems:g.level.monsters.filter(m => m.mnum === PMNAMES.PM_IRON_GOLEM)
                    .map(monsterState),
                scrolls:(g.invent || []).filter(o => o.otyp === ONAMES.SCR_SCARE_MONSTER)
                    .map(o => ({letter:o.invlet, quantity:o.quan, blessed:!!o.blessed})),
                wand:(g.invent || []).filter(o => o.otyp === ONAMES.WAN_OPENING)
                    .map(o => ({letter:o.invlet, charges:o.spe})),
                mortality:g.u.umortality || 0,
                top:g.nhDisplay.grid[0].map(cell => cell.ch).join('').trimEnd(),
            };
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    assert.equal(states.length, part.steps.length);
    assert.equal(states[101].form, PMNAMES.PM_OWLBEAR);
    assert.ok(states[101].sticky && !states[101].swallowed);
    const grabbed = states[103].held;
    assert.ok(grabbed && grabbed.type === PMNAMES.PM_IRON_GOLEM);
    assert.equal(grabbed.fleeing, false);
    assert.deepEqual(grabbed.at, [62,10]);
    assert.match(states[103].top, /You grab the iron golem!/);
    const scrollStep = index === 0 ? 140 : 145;
    assert.deepEqual(states[scrollStep].scrolls, [{letter:'o',quantity:3,blessed:true}]);
    const heldOrReleased = index === 0 ? states[150].held : states[107].held;
    console.log(JSON.stringify({segment:index, rawSha256, grabbed,
        atBranch:heldOrReleased, finalGolems:states.at(-1).golems,
        boundaries:run.getScreens().length, calls:run.getRngLog().length,
        descriptorRestored:true}));
    if (index === 0) {
        assert.equal(states[149].held?.id, grabbed.id);
        assert.equal(states[149].held.fleeing, true, 'scroll already set mflee');
        for (let step = 150; step < states.length; step++) {
            assert.equal(states[step].held?.id, grabbed.id, `held identity at ${step}`);
            assert.deepEqual(states[step].held.at, grabbed.at, `held square at ${step}`);
            assert.equal(states[step].held.fleeing, true);
        }
        assert.equal(states[150].top, 'The iron golem cannot escape from you!');
    } else {
        assert.equal(states[106].held?.id, grabbed.id);
        assert.equal(states[107].held, null);
        assert.equal(states[107].top, 'You release the iron golem.');
        assert.equal(states[107].wand[0].charges, states[105].wand[0].charges - 1);
        assert.ok(states.slice(107).every(state => state.held === null));
        const fleeing = states.slice(scrollStep + 1).flatMap(state => state.golems)
            .filter(mon => mon.id === grabbed.id && mon.fleeing);
        assert.ok(fleeing.length, 'the released golem is genuinely fleeing');
        assert.ok(fleeing.some(mon => mon.at[0] !== grabbed.at[0] || mon.at[1] !== grabbed.at[1]),
            'released golem actually leaves its original square');
        assert.ok(states.every(state => !state.top.includes('cannot escape')));
    }
    assert.ok(states.every(state => state.mortality === 0));
    assert.equal(run.getScreens().length, [161,166][index]);
    assert.equal(run.getRngLog().length, [2904,2957][index]);
    assert.deepEqual(run.getCursors(), part.steps.map(step => step.cursor));
    assert.deepEqual(run.getAnimationFramesByStep(), part.steps.map(step => step.animation_frames || []));
});
