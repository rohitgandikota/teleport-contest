// Real keyboard producers; this hook only observes state and restores its descriptor.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {can_blow, can_chant, can_be_strangled} from '../js/mondata.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {W_AMUL} from '../js/const.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/mondata-breath-chant.json', import.meta.url)));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs = run => ({screens: run.getScreens(), cursors: run.getCursors(),
    rng: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep()});

for (const [index, part] of recipe.segments.entries()) test(part.name, async () => {
    const rows = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            rows.push({step, form: g.u.umonnum, original: g.u.umonster,
                live: g.youmonst.data === g.mons[g.u.umonnum],
                timer: g.u.intrinsic.HStrangled || 0, mask: g.u.uprops.STRANGLED || 0,
                blind: !!g.u.ublind, mortality: g.u.umortality || 0,
                amulet: g.u.uamul?.o_id || null,
                blow: can_blow(g.youmonst), chant: can_chant(g.youmonst),
                vulnerable: can_be_strangled(g.youmonst),
                inventory: (g.invent || []).map(o => ({id: o.o_id, type: o.otyp,
                    letter: o.invlet, quantity: o.quan, worn: o.owornmask || 0,
                    blessed: !!o.blessed, cursed: !!o.cursed}))});
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

    const reading = [1, 4, 5].includes(index);
    const action = part.moves.lastIndexOf(reading ? 'rd' : 'aa');
    assert.ok(action > 0);
    const first = rows[0], before = rows[action], last = rows.at(-1);
    assert.equal(first.inventory.length, 0);
    assert.ok(rows.every(row => row.live && row.mortality === 0));
    const types = [O.TIN_WHISTLE, O.AMULET_OF_STRANGULATION];
    if (reading) types.push(O.BLINDFOLD, O.SCR_LIGHT);
    assert.deepEqual(before.inventory.map(o => o.type), types);
    assert.deepEqual(before.inventory.map(o => o.letter), reading ? ['a', 'b', 'c', 'd'] : ['a', 'b']);
    assert.ok(before.inventory.every(o => o.quantity === 1 && !o.blessed && !o.cursed));
    assert.equal(before.blind, reading);
    const active = index === 2 || index === 5;
    const worn = index < 3 || index === 5;
    assert.equal(before.form, active ? before.original : P.PM_SKELETON);
    assert.equal(before.vulnerable, active);
    assert.equal(before.mask, worn ? W_AMUL : 0);
    assert.equal(before.amulet, worn ? before.inventory[1].id : null);
    assert.equal(before.inventory[1].worn, worn ? W_AMUL : 0);
    if (active) assert.ok(before.timer > 0);
    else assert.equal(before.timer, 0);
    if (index === 0) {
        assert.ok(rows.slice(0, action).some(row => row.timer === 6 && row.form === row.original));
        assert.ok(rows.slice(0, action).some(row => row.timer === 0 && row.form === P.PM_SKELETON
            && row.mask === W_AMUL));
    }
    if (index === 1) assert.ok(rows.every(row => row.timer === 0));
    assert.equal(before.blow, !active);
    assert.equal(before.chant, !active);
    assert.equal(last.mask, before.mask);
    assert.equal(last.amulet, before.amulet);
    assert.equal(last.inventory.some(o => o.type === O.SCR_LIGHT), false);
    if (!reading) assert.deepEqual(last.inventory, before.inventory);
    const texts = observed.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('')).join('\n'));
    for (const phrase of recipe.branchAssertions[index].screenIncludes)
        assert.ok(texts.some(screen => screen.includes(phrase)), phrase);
    const suffix = texts.slice(action).join('\n');
    if (reading) assert.doesNotMatch(suffix, active ? /As you pronounce/ : /As you cogitate/);
    else assert.doesNotMatch(suffix, active ? /produce a high whistling/ : /incapable of using the whistle/);
    console.log(JSON.stringify({case: index, name: part.name,
        boundaries: observed.screens.length, calls: observed.rng.length, frames: 0,
        observerNeutral: true, hashes: Object.fromEntries(
            Object.entries(observed).map(([key, value]) => [key, hash(value)]))}));
});
