// Ordinary command reach, separately from any future native comparison.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {canseemon} from '../js/display.js';
import {couldsee} from '../js/vision.js';
import {Blind, Hallucination, Free_action} from '../js/youprop.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors} from './gen-sessions/assertions.mjs';
import registry from './gen-sessions/coverage-requirements.json' with {type:'json'};
const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/hero-gaze-counter-effects.json', import.meta.url)));
const expected = [[P.PM_FLOATING_EYE,84], [P.PM_FLOATING_EYE,117],
    [P.PM_FLOATING_EYE,93], [P.PM_MEDUSA,111], [P.PM_NEWT,76]];

test('recipe has registered coverage, ordinary tuples and explicit positive/negative assertions', () => {
    const known = new Set(registry.requirements.map(r => r.id));
    for (const category of recipe.coverage) assert.ok(known.has(category), category);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    const fields = ['name','seed','datetime','nethackrc','moves'];
    const tuples = recipe.segments.map(s => fields.map(k => [Object.hasOwn(s,k),s[k]]));
    assert.equal(createHash('sha256').update(JSON.stringify(tuples)).digest('hex'), '4af8bad4d4ccff3028fa26fb4df007739d2b83e162e3b3f5f6f95e7b1c8d185a');
});
for (const [i, part] of recipe.segments.entries()) test(part.name, async () => {
    const rows = [], prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g,step) {
            rows.push({step, form:g.u.umonnum, turn:g.moves, energy:g.u.uen,
                blind:Blind(), hallucinating:Hallucination(), freeAction:Free_action(),
                left:g.u.uleft?.otyp, mortality:g.u.umortality || 0, amulet:g.u.uamul?.otyp,
                safe:g.flags.safe_dog, confirm:g.flags.confirm,
                monsters:g.level.monsters.map(m => ({id:m.m_id, species:m.mnum,
                    canonical:m.data === g.mons[m.mnum], seen:canseemon(m), couldsee:couldsee(m.mx,m.my),
                    sleeping:!!m.msleeping, movable:!!m.mcanmove, eyes:!!m.mcansee, cancelled:!!m.mcan,
                    tame:m.mtame || 0, confused:!!m.mconf}))});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
        else delete globalThis.__step_snapshot;
    }
    const [species, boundaries] = expected[i];
    assert.equal(run.getScreens().length, boundaries);
    const start = part.moves.lastIndexOf('#monster\r');
    const before = rows.find(r => r.step === start), after = rows.find(r => r.step === start + 9);
    assert.equal(before.form, P.PM_UMBER_HULK);
    assert.equal(before.blind, false); assert.equal(before.hallucinating, false);
    assert.equal(before.safe, false); assert.equal(before.confirm, false);
    const target = before.monsters.find(m => m.species === species);
    assert.ok(target?.canonical && target.seen && target.couldsee && target.movable && target.eyes);
    assert.equal(target.cancelled, false); assert.equal(target.confused, false);
    assert.equal(target.sleeping, i === 2);
    assert.equal(after.energy, before.energy - 15, 'real command spends energy before its effects');
    if (i === 0) assert.ok(rows.at(-1).turn > before.turn + 100, 'paralysis advances ordinary turns');
    if (i === 1) {
        assert.equal(before.left, O.RIN_FREE_ACTION); assert.equal(before.freeAction, true);
        assert.ok(rows.at(-1).turn < before.turn + 10);
    }
    if (i === 3) {
        assert.equal(target.tame, 0, 'C tamedog rejects Medusa despite the requested modifier');
        assert.equal(before.amulet, O.AMULET_OF_LIFE_SAVING); assert.equal(before.mortality, 0);
        assert.equal(rows.at(-1).mortality, 1); assert.equal(rows.at(-1).amulet, undefined);
    } else assert.equal(rows.at(-1).mortality, 0);
    const final = rows.at(-1).monsters.find(m => m.id === target.id);
    assert.ok(final); assert.equal(final.confused, i !== 2);
    const text = run.getScreens().map(s => decodeScreen(s).map(row => row.map(renderCell).join('')).join('\n')).join('\n');
    for (const message of recipe.branchAssertions[i].screenIncludes) assert.ok(text.includes(message), message);
    for (const message of recipe.branchAssertions[i].screenExcludes) assert.ok(!text.includes(message), message);
});
