// Ordinary inputs and passive state observations. Full native parity is separate.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { Underwater, Flying } from '../js/youprop.js';
import { ONAMES } from '../js/objects_data.js';
import { decodeScreen, renderCell } from '../frozen/screen-decode.mjs';
import { branchAssertionErrors, recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const read = path => readFileSync(new URL(path, import.meta.url));
const recipe = JSON.parse(read('gen-sessions/recipes/pager-restricted-inspection.json'));
const rawBytes = read('gen-sessions/generated/pager-restricted-inspection.session.json');
const raw = JSON.parse(rawBytes);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs = run => ({ screens: run.getScreens(), cursors: run.getCursors(),
    calls: run.getRngLog(), slices: run.getRngSlices(), frames: run.getAnimationFramesByStep() });

test('recipe inputs and witnesses match the unchanged native recording', () => {
    assert.equal(createHash('sha256').update(rawBytes).digest('hex'),
        '3816327d637212dc76745ebfa00f838a0d863a0c5e8d94401db532920210c23d');
    assert.equal(raw.source, 'c');
    assert.equal(raw.version, 5);
    assert.equal(raw.segments.length, 4);
    assert.equal(recipe.segments.length, 4);
    assert.deepEqual(recordingIntegrityErrors(raw), []);
    assert.deepEqual(branchAssertionErrors(recipe, raw), []);
    const requirements = JSON.parse(read('gen-sessions/coverage-requirements.json'));
    const tags = new Set(requirements.requirements.map(r => r.id));
    assert.ok(recipe.coverage.every(tag => tags.has(tag)));
    for (const [i, part] of raw.segments.entries()) {
        for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
            assert.equal(Object.hasOwn(part, field), Object.hasOwn(recipe.segments[i], field));
            assert.deepEqual(part[field], recipe.segments[i][field]);
        }
        assert.deepEqual(part.steps.map(step => step.key), [null, ...part.moves]);
    }
});

for (const [i, part] of raw.segments.entries())
test(part.name, async () => {
    const states = [], previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = { step: '*', cb(g, step) {
            states[step] = { hp: g.u.uhp, mortality: g.u.umortality || 0,
                underwater: Underwater(), flying: !!Flying(),
                amulet: g.u.uamul?.otyp, position: [g.u.ux, g.u.uy] };
        } };
        run = await runSegment({ ...part, storage: new InMemoryStorage() });
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    const observed = outputs(run);
    assert.equal(states.length, part.moves.length + 1);
    assert.ok(states.every(s => s.hp > 0 && s.mortality === 0));
    const final = states.at(-1);
    assert.deepEqual(final.position, [40, 6]);
    assert.equal(final.underwater, i < 2);
    assert.equal(final.flying, i === 3);
    assert.equal(final.amulet, i === 3
        ? ONAMES.AMULET_OF_FLYING : ONAMES.AMULET_OF_MAGICAL_BREATHING);
    const tops = observed.screens.map(screen => decodeScreen(screen)[0]
        .map(renderCell).join('').trimEnd());
    if (i === 0) {
        assert.equal(tops[58], 'land');
        assert.equal(tops[59], 'unreconnoitered');
        assert.equal(tops[60], '         unreconnoitered');
    } else if (i === 1) {
        assert.equal(tops[58], 'land');
        assert.ok(tops[59].includes('(land)'));
        assert.ok(!tops.some(text => text.includes('unreconnoitered')));
    } else {
        assert.equal(tops[i === 2 ? 59 : 48], 'floor of a room');
        assert.ok(!tops.some(text => text.includes('unreconnoitered')));
    }
    const unobserved = outputs(await runSegment({ ...part, storage: new InMemoryStorage() }));
    for (const key of Object.keys(observed))
        assert.equal(hash(observed[key]), hash(unobserved[key]), `${key}: passive observation`);
});
