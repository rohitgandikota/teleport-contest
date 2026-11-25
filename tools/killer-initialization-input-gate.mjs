// Ordinary keyboard producers. The snapshot hook only observes game state.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {G_GENOD, POLYMORPH, KILLED_BY_AN} from '../js/const.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/genocide-killer-initialization.json', import.meta.url)));
const empty = () => ({next: null, id: 0, format: 0, name: ''});
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs = run => ({screens: run.getScreens(), cursors: run.getCursors(),
    rng: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep()});

for (const [index, part] of recipe.segments.entries()) test(part.name, async () => {
    const rows = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            rows.push({step, hp: g.u.uhp, mh: g.u.mh, form: g.u.umonnum,
                original: g.u.umonster, race: g.urace.mnum,
                mortality: g.u.umortality || 0, killer: structuredClone(g.killer),
                genocided: [P.PM_HUMAN, P.PM_ORC, P.PM_GOBLIN]
                    .map(pm => !!(g.mvitals[pm].mvflags & G_GENOD)),
                inventory: (g.invent || []).map(o => ({type: o.otyp, letter: o.invlet,
                    quantity: o.quan, blessed: !!o.blessed, cursed: !!o.cursed}))});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    const observed = structuredClone(outputs(run));
    const unobserved = outputs(await runSegment({...part, storage: new InMemoryStorage()}));
    for (const key of Object.keys(observed))
        assert.deepEqual(observed[key], unobserved[key], key + ' observer neutrality');
    assert.equal(observed.screens.length, part.moves.length + 1);
    assert.equal(rows.length, part.moves.length + 1);
    assert.equal(run._display.inputQueueLength, 0);
    assert.equal(observed.frames.flat().length, 0);

    const readAt = part.moves.indexOf('ra  ');
    assert.ok(readAt >= 0);
    const initial = rows[0], before = rows[readAt], last = rows.at(-1);
    assert.equal(initial.inventory.length, 0, 'no preexisting item or death setup');
    assert.equal(initial.mortality, 0);
    assert.equal(initial.killer?.name || '', '');
    assert.equal(initial.killer?.next || null, null);
    assert.deepEqual(before.inventory, [{type: O.SCR_GENOCIDE, letter: 'a',
        quantity: 1, blessed: index === 1 || index === 4, cursed: false}]);
    assert.equal(before.mortality, 0);
    assert.deepEqual(before.genocided, [false, false, false]);
    assert.equal(before.race, index === 1 || index === 4 ? P.PM_ORC : P.PM_HUMAN);
    assert.equal(last.inventory.length, 0, 'the actual read owner consumes the scroll');
    if (index === 2) {
        assert.equal(before.form, before.original);
        assert.equal(last.form, last.original);
        assert.ok(last.hp > 0);
        assert.equal(last.mortality, 1);
        assert.deepEqual(last.killer, empty());
        assert.ok(rows.some(row => row.mortality === 1
            && row.killer?.name === 'scroll of genocide'));
    } else {
        assert.equal(before.form, P.PM_HILL_GIANT);
        assert.ok(before.mh > 0);
        assert.equal(last.form, P.PM_HILL_GIANT);
        assert.equal(last.mh, before.mh);
        assert.equal(last.mortality, 0);
        if (index < 2) {
            assert.equal(last.hp, -1);
            assert.deepEqual(before.killer, empty());
            if (index === 0) {
                assert.deepEqual(last.killer, {...empty(), next: {
                    id: POLYMORPH, format: KILLED_BY_AN,
                    name: 'scroll of genocide', next: null}});
                assert.equal(last.genocided[0], true);
            } else {
                assert.deepEqual(last.killer, {...empty(), name: 'scroll of genocide'});
                assert.equal(last.genocided[1], true);
                assert.equal(last.genocided[2], true);
            }
        } else {
            assert.equal(last.hp, before.hp);
            assert.deepEqual(last.killer, before.killer);
            assert.deepEqual(last.genocided, [false, false, index === 5]);
        }
    }
    const texts = observed.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('')).join('\n'));
    for (const phrase of recipe.branchAssertions[index].screenIncludes)
        assert.ok(texts.some(screen => screen.includes(phrase)), phrase);
    if (index >= 3) assert.doesNotMatch(texts.join('\n'), /feel dead inside|Die\? \[yn\]/);
    if (index === 3 || index === 4) assert.doesNotMatch(texts.join('\n'), /Wiped out/);
    console.log(JSON.stringify({case: index, name: part.name,
        boundaries: observed.screens.length, calls: observed.rng.length, frames: 0,
        observerNeutral: true, hashes: Object.fromEntries(
            Object.entries(observed).map(([key, value]) => [key, hash(value)]))}));
});
