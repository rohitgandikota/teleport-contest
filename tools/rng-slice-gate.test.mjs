import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';

const native = JSON.parse(readFileSync(new URL(
    'gen-sessions/generated/game-exit-boundaries.session.json', import.meta.url)));
const runner = fileURLToPath(new URL('rng-slice-gate.mjs', import.meta.url));

function check(segment, mutate) {
    const input = structuredClone(native);
    input.segments = [input.segments[segment]];
    if (mutate) {
        input.source = 'test-mutant';
        delete input.recorded_with;
        mutate(input.segments[0]);
    }
    const directory = mkdtempSync(join(tmpdir(), 'rng-slice-gate-'));
    try {
        const path = join(directory, 'input.session.json');
        writeFileSync(path, JSON.stringify(input));
        const result = spawnSync(process.execPath, [runner, path], {
            encoding: 'utf8', timeout: 45000,
        });
        assert.equal(result.error, undefined);
        assert.equal(result.stderr, '');
        return {status: result.status, output: JSON.parse(result.stdout)};
    } finally {
        rmSync(directory, {recursive: true, force: true});
    }
}

test('character cancellation accepts its verified blank terminal frame', () => {
    const {status, output} = check(4);
    assert.equal(status, 0);
    assert.equal(output.blankExitFrames, 1);
    assert.equal(output.matchingSteps, 2);
    assert.equal(output.expectedCalls, 0);
    assert.equal(output.actualCalls, 0);
    assert.deepEqual(output.errors, []);
});

for (const [name, mutate, kind] of [
    ['nonblank exit frame', part => { part.steps.at(-1).screen = 'unexpected'; }, 'step-count'],
    ['calls in the exit frame', part => { part.steps.at(-1).rng = ['rn2(2)=0']; }, 'stream-length'],
    ['animation in the exit frame', part => {
        part.steps.at(-1).animation_frames = [{screen: 'unexpected', cursor: [0, 0, 1]}];
    }, 'step-count'],
]) test(`rejects ${name}`, () => {
    const {status, output} = check(4, mutate);
    assert.equal(status, 1);
    assert.equal(output.blankExitFrames, 0);
    assert.ok(output.errors.some(error => error.kind === kind));
});

test('a live game cannot omit an extra blank input boundary', () => {
    const {status, output} = check(1, part => {
        part.steps.push({key: ' ', screen: '', rng: [], cursor: [0, 0, 1]});
    });
    assert.equal(status, 1);
    assert.equal(output.blankExitFrames, 0);
    assert.ok(output.errors.some(error => error.kind === 'step-count'));
});

test('extra trailing calls are rejected even when every recorded call matches', () => {
    const {status, output} = check(1, part => {
        [...part.steps].reverse().find(step => step.rng?.length).rng.pop();
    });
    assert.equal(status, 1);
    assert.equal(output.actualCalls, output.expectedCalls + 1);
    assert.ok(output.errors.some(error => error.kind === 'stream-length'));
});

test('moving a call across an input boundary preserves the stream but fails the gate', () => {
    const {status, output} = check(1, part => {
        const index = part.steps.findIndex(step => step.rng?.length);
        assert.ok(index >= 0 && index + 1 < part.steps.length);
        part.steps[index + 1].rng.unshift(part.steps[index].rng.pop());
    });
    assert.equal(status, 1);
    assert.equal(output.actualCalls, output.expectedCalls);
    assert.ok(output.errors.some(error => error.kind === 'input-slice'));
    assert.ok(output.errors.every(error => error.kind === 'input-slice'));
});
