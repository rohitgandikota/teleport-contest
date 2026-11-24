// Immutable parent C recording plus read-only ordinary producer observations.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { PMNAMES as P, ATTKS as A } from '../js/monst_data.js';
import { ONAMES as O } from '../js/objects_data.js';
import { OBJ_FREE, OBJ_DELETED } from '../js/const.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with { type: 'json' };
const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/monster-pet-digestion.json', import.meta.url)));
const raw = readFileSync(new URL('gen-sessions/generated/monster-pet-digestion.session.json', import.meta.url));
const native = JSON.parse(raw);
const counts = [[66, 2943, 0], [67, 3399, 3]];

test('native provenance, four input fields, absent optional names and all input keys', () => {
    assert.equal(createHash('sha256').update(raw).digest('hex'),
        '9f24def269b32e532c6b8bb14b732ccbb0c0ed76253c1d6a1d0e80f1f44ca0c4');
    assert.equal(native.source, 'c'); assert.equal(native.version, 5);
    assert.equal(native.segments.length, 2); assert.equal(recipe.segments.length, 2);
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    const registered = new Set(tags.requirements.map(r => r.id));
    for (const category of recipe.coverage) assert.ok(registered.has(category), category);
    for (const [i, part] of native.segments.entries()) {
        for (const field of ['seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(part[field], recipe.segments[i][field]);
        assert.equal(Object.hasOwn(part, 'name'), false);
        assert.equal(Object.hasOwn(recipe.segments[i], 'name'), false);
        assert.deepEqual(part.steps.map(s => s.key), [null, ...part.moves]);
        assert.equal(part.steps.length, counts[i][0]);
        // Ordinary recorded C RNG entries, excluding optional trace annotations.
        assert.equal(part.steps.flatMap(s => s.rng || []).filter(s => !s.startsWith('^')).length, counts[i][1]);
        assert.equal(part.steps.reduce((n, s) => n + (s.animation_frames || []).length, 0), counts[i][2]);
    }
});

for (const [i, part] of recipe.segments.entries()) test(`${i ? 'troll' : 'ogre'}: ordinary pet digestion completes and retains no corpse timer`, async () => {
    const species = i ? P.PM_TROLL : P.PM_OGRE;
    const rows = [], descriptor = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let replay;
    try {
        globalThis.__step_snapshot = { step: '*', cb(g, step) {
            const pet = g.level?.monsters.find(m => m.mnum === P.PM_PURPLE_WORM && m.mtame);
            const target = g.level?.monsters.find(m => m.mnum === species);
            rows.push({ step, turn: g.moves, pet: pet && { id: pet.m_id,
                hunger: pet.edog?.hungrytime, eating: pet.meating || 0,
                attack: pet.data.mattk.some(a => a[0] === A.AT_ENGL && a[1] === A.AD_DGST) },
                target: target && { id: target.m_id, hp: target.mhp,
                    asleep: target.msleeping, hostile: !target.mpeaceful && !target.mtame },
                corpses: (g.level?.objects || []).filter(o => o.otyp === O.CORPSE && o.corpsenm === species).length,
                freeCorpseTimers: (g.timer_base || []).filter(t => t.arg?.otyp === O.CORPSE
                    && (t.arg.where === OBJ_FREE || t.arg.where === OBJ_DELETED)).length });
        } };
        replay = await runSegment({ ...part, storage: new InMemoryStorage() });
    } finally {
        if (descriptor) Object.defineProperty(globalThis, '__step_snapshot', descriptor);
        else delete globalThis.__step_snapshot;
    }
    assert.equal(replay.getScreens().length, counts[i][0]);
    const created = rows.find(r => r.pet && r.target);
    assert.ok(created.pet.attack && created.target.asleep && created.target.hostile);
    assert.equal(created.pet.hunger, 1001);
    const eaten = rows.find(r => r.pet?.hunger === (i ? 1351 : 1501));
    assert.ok(eaten, 'C half nutrition came from whole-monster digestion');
    assert.equal(eaten.step, i ? 51 : 46); assert.equal(eaten.pet.id, created.pet.id);
    assert.equal(eaten.pet.eating, i ? 4 : 7); assert.equal(eaten.target, undefined);
    assert.ok(rows.filter(r => r.step >= eaten.step).every(r => !r.target && !r.corpses));
    assert.ok(rows.every(r => r.freeCorpseTimers === 0), 'no leaked virtual corpse timer');
    const text = replay.getScreens().map(s => decodeScreen(s).map(row => row.map(c => c.ch).join('')).join('\n')).join('\n');
    for (const value of recipe.branchAssertions[i].screenIncludes) assert.ok(text.includes(value), value);
    for (const value of recipe.branchAssertions[i].screenExcludes) assert.ok(!text.includes(value), value);
});
