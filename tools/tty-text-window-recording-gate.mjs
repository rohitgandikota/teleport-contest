// Pin every original C byte, input field and concrete branch witness.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {recordingIntegrityErrors, branchAssertionErrors} from './gen-sessions/assertions.mjs';

const specifications = [
    {
        "name": "tty-text-window-history",
        "directory": "generated",
        "sha256": "bf9dbac8a21dd799d335fb41d9de725c52aa19905348c30fb4987c9a7a30a7b2",
        "bytes": 946955,
        "segments": 7
    },
    {
        "name": "tty-text-window-followthrough",
        "directory": "generated",
        "sha256": "2d09a3598357fc3bd6fab5f64d14b3993912ec4fd54fda65ed174e2fe4baf578",
        "bytes": 1769607,
        "segments": 13
    },
    {
        "name": "tty-text-window-callers",
        "directory": "diagnostics",
        "sha256": "3c8034afd0985dce055e625b71aa763ad463d6502885f2740f8004dac372429e",
        "bytes": 513312,
        "segments": 4
    },
    {
        "name": "tty-menu-cancellation-callers",
        "directory": "generated",
        "sha256": "60c9de3a3bd42f2ff1770ac3ea796dbd5ce1df23d1a7bbe9924e8f24ea389b52",
        "bytes": 1305628,
        "segments": 10
    }
];
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const registry = read('gen-sessions/branch-requirements.json');
const coverage = read('gen-sessions/coverage-requirements.json');
for (const spec of specifications) test(`original C recording: ${spec.name}`, () => {
    const raw = readFileSync(new URL(`gen-sessions/${spec.directory}/${spec.name}.session.json`, import.meta.url));
    const native = JSON.parse(raw);
    const recipe = read(`gen-sessions/recipes/${spec.name}.json`);
    assert.equal(createHash('sha256').update(raw).digest('hex'), spec.sha256);
    assert.equal(raw.length, spec.bytes);
    assert.equal(native.source, 'c');
    assert.equal(native.version, 5);
    assert.equal(native.segments.length, spec.segments);
    assert.equal(recipe.segments.length, spec.segments);
    assert.ok(recipe.requireBranchAssertions);
    assert.ok(recipe.branches.every(id => registry.requirements.some(row => row.id === id)));
    assert.ok(recipe.coverage.every(id => coverage.requirements.some(row => row.id === id)));
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    for (const [i, part] of native.segments.entries()) {
        for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves']) {
            assert.equal(Object.hasOwn(part, key), Object.hasOwn(recipe.segments[i], key));
            assert.deepEqual(part[key], recipe.segments[i][key]);
        }
        assert.deepEqual(part.steps.map(step => step.key), [null, ...part.moves]);
    }
});
